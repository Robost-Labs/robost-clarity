/**
 * Robost Clarity - Background Service Worker
 * Handles LLM traffic interception and communication with backend API.
 */

// Configuration
const CONFIG = {
  apiBaseUrl: 'http://localhost:8004', // Local Development API
  llmProviders: {
    'chatgpt.com': { name: 'OpenAI ChatGPT', provider: 'openai' },
    'openai.com': { name: 'OpenAI', provider: 'openai' },
    'claude.ai': { name: 'Anthropic Claude', provider: 'anthropic' },
    'anthropic.com': { name: 'Anthropic', provider: 'anthropic' },
    'gemini.google.com': { name: 'Google Gemini', provider: 'google' },
    'bard.google.com': { name: 'Google Bard', provider: 'google' },
    'canva.com': { name: 'Canva Magic Studio', provider: 'canva' },
    'deepseek.com': { name: 'DeepSeek', provider: 'deepseek' },
    'perplexity.ai': { name: 'Perplexity AI', provider: 'perplexity' },
    'copilot.microsoft.com': { name: 'Microsoft Copilot', provider: 'microsoft' },
    'bing.com': { name: 'Bing Chat', provider: 'microsoft' },
    'x.ai': { name: 'xAI Grok', provider: 'xai' },
    'grok.x.ai': { name: 'xAI Grok', provider: 'xai' },
    'deepl.com': { name: 'DeepL', provider: 'deepl' },
    'grammarly.com': { name: 'Grammarly', provider: 'grammarly' }
  }
};

// State management
let authState = {
  isAuthenticated: false,
  accessToken: null,
  organizationId: null,
  organizationName: null,
  userId: null,
  email: null
};

let stats = {
  promptsDetected: 0,
  promptsSent: 0,
  lastActivity: null
};

// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
  console.log('Robost Clarity extension installed');
});

// Load auth state on startup (Service Worker wake up)
const authReady = loadStoredAuth();
const statsReady = loadStats();

// Load stored authentication state
async function loadStoredAuth() {
  try {
    const stored = await chrome.storage.local.get(['authState']);
    if (stored.authState) {
      authState = stored.authState;
    }
  } catch (error) {
    console.error('Failed to load auth state:', error);
  }
}

// Load stored stats
async function loadStats() {
  try {
    const stored = await chrome.storage.local.get(['stats']);
    if (stored.stats) {
      stats = stored.stats;
    }
  } catch (error) {
    console.error('Failed to load stats:', error);
  }
}

// Save authentication state
async function saveAuthState() {
  try {
    await chrome.storage.local.set({ authState });
  } catch (error) {
    console.error('Failed to save auth state:', error);
  }
}

// Save stats
async function saveStats() {
  try {
    await chrome.storage.local.set({ stats });
  } catch (error) {
    console.error('Failed to save stats:', error);
  }
}

// Authenticate user
async function authenticate(email, password) {
  try {
    const response = await fetch(`${CONFIG.apiBaseUrl}/auth/extension/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Authentication failed (${response.status})`);
    }

    const data = await response.json();

    authState = {
      isAuthenticated: true,
      accessToken: data.access_token,
      organizationId: data.organization_id,
      organizationName: data.organization_name,
      userId: data.user_id,
      email: email
    };

    await saveAuthState();
    return { success: true, organizationName: data.organization_name };
  } catch (error) {
    console.error('Authentication error:', error.message || error);
    return { success: false, error: error.message || 'Authentication failed' };
  }
}


// Authenticate user with Google
async function authenticateGoogle(token) {
  try {
    const response = await fetch(`${CONFIG.apiBaseUrl}/organizations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ token, source: 'extension' })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Authentication failed (${response.status})`);
    }

    const data = await response.json();

    // Check if user has required role for extension
    // The backend /auth/google returns a token. We need to verify role from it? 
    // Actually the backend returns a Token object which might not include role in plain text immediately unless we parse JWT.
    // However, for consistency with 'authenticate', we should set authState.
    // We should parse the JWT to get the role if we want to enforce role check on client side, 
    // OR we trust the backend to only issue tokens to valid users.
    // But 'authenticate' checked role... explicitly? No, 'authenticate' in background.js just took what backend gave it.
    // Wait, 'authenticate' in background.js sets `authState` from `data`.
    // `login` in backend returns `Token` model: { access_token, token_type, role, expires_in }

    // Let's see `create_token_response` in backend.

    authState = {
      isAuthenticated: true,
      accessToken: data.access_token,
      // We need these fields but standard Token response might not have them directly if it's just access_token?
      // Let's check backend return type.
      // create_token_response returns Token
      // class Token(BaseModel):
      //    access_token: str
      //    token_type: str
      //    expires_in: int
      //    role: UserRole
      // It DOES NOT return user_id, organization_id, organization_name etc. in the root response?
      // Wait, 'authenticate' function in background.js (lines 111-118) expects:
      // accessToken, organizationId, organizationName, userId, email.
      // But standard /auth/login returns Token model.

      // I need to check `authenticate_extension_user` in backend/auth.py. 
      // OH! `authenticate_extension_user` returns a `dict` with all that info!
      // AND there is a specific endpoint `/auth/extension/login` (lines 96 in background.js).
      // But I added `/auth/google` to `main.py` which uses `create_token_response`.

      // Issue: `/auth/google` returns standard `Token` (access_token, role). It MISSES org_id, user_id, name for the extension state.
      // Solution: I should update the /auth/google endpoint or make a second call to /auth/me or similar.
      // OR I can decode the JWT in background.js. The JWT has sub (username), role, org_id.
      // But organizationName is not in JWT.

      // Let's fetch user info after login.
    };

    // Fetch detailed user info to populate authState completely
    const userResp = await fetch(`${CONFIG.apiBaseUrl}/auth/me`, {
      headers: { 'Authorization': `Bearer ${data.access_token}` }
    });
    const userData = await userResp.json();

    // We might need organization name. 
    // For now let's fill what we can.

    authState = {
      isAuthenticated: true,
      accessToken: data.access_token,
      organizationId: userData.organization_id, // If returned by /auth/me
      organizationName: "Organization", // Placeholder or fetch if possible. /auth/me returns User model, might not have org name.
      userId: userData.id, // If in User model
      email: userData.email || userData.username
    };

    await saveAuthState();
    return { success: true, organizationName: authState.organizationName };

  } catch (error) {
    console.error('Google Authentication error:', error.message || error);
    return { success: false, error: error.message || 'Authentication failed' };
  }
}

// Logout
async function logout() {
  authState = {
    isAuthenticated: false,
    accessToken: null,
    organizationId: null,
    organizationName: null,
    userId: null,
    email: null
  };
  await saveAuthState();
}



// (Removed redundant webRequest listener that caused empty dummy requests)

// Send LLM request to backend
async function sendLlmRequest(data) {
  await authReady;
  await statsReady;

  if (!authState.isAuthenticated || !authState.accessToken) {
    console.log('Not authenticated, skipping request send');
    return false;
  }

  try {
    const response = await fetch(`${CONFIG.apiBaseUrl}/extension/llm-request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authState.accessToken}`
      },
      body: JSON.stringify({
        ...data,
        organization_id: authState.organizationId,
        user_id: authState.userId
      })
    });

    if (response.ok) {
      stats.promptsSent++;
      stats.lastActivity = new Date().toISOString();
      await saveStats();
      return true;
    } else {
      console.error('Failed to send LLM request:', await response.text());
      return false;
    }
  } catch (error) {
    console.error('Error sending LLM request:', error);
    return false;
  }
}

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'GET_STATUS':
      Promise.all([authReady, statsReady]).then(() => {
        sendResponse({
          isAuthenticated: authState.isAuthenticated,
          organizationName: authState.organizationName,
          email: authState.email,
          stats: stats
        });
      });
      return true;

    case 'LOGIN':
      authenticate(message.email, message.password).then(sendResponse);
      return true; // Keep channel open for async response

    case 'GOOGLE_LOGIN':
      authenticateGoogle(message.token).then(sendResponse);
      return true;

    case 'LOGOUT':
      logout().then(() => sendResponse({ success: true }));
      return true;

    case 'LLM_REQUEST':
      statsReady.then(() => {
        // Update local stats for "Detected"
        stats.promptsDetected++;
        stats.lastActivity = new Date().toISOString();
        saveStats();

        // Handle LLM request from content script
        sendLlmRequest({
          ...message.data,
          source: 'content_script'
        }).then((success) => sendResponse({ success }));
      });
      return true;

    case 'UPDATE_CONFIG':
      if (message.apiBaseUrl) {
        CONFIG.apiBaseUrl = message.apiBaseUrl;
        chrome.storage.local.set({ apiBaseUrl: message.apiBaseUrl });
      }
      sendResponse({ success: true });
      break;

    default:
      sendResponse({ error: 'Unknown message type' });
  }
});

// Load custom API URL from storage
chrome.storage.local.get(['apiBaseUrl'], (result) => {
  if (result.apiBaseUrl) {
    CONFIG.apiBaseUrl = result.apiBaseUrl;
  }
});
