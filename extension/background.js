/**
 * Robost Clarity - Background Service Worker
 * Handles LLM traffic interception and communication with backend API.
 */

// Configuration
const CONFIG = {
  apiBaseUrl: 'https://robost-api-ehnzr3alha-ww.a.run.app', // Production API
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
  loadStoredAuth();
  loadStats();
});

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

// Get provider info from URL
function getProviderFromUrl(url) {
  try {
    const hostname = new URL(url).hostname;
    for (const [domain, info] of Object.entries(CONFIG.llmProviders)) {
      if (hostname.includes(domain)) {
        return info;
      }
    }
  } catch (error) {
    console.error('Failed to parse URL:', error);
  }
  return null;
}

// Send LLM request to backend
async function sendLlmRequest(data) {
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

// Handle intercepted LLM traffic
async function handleLlmTraffic(details) {
  const providerInfo = getProviderFromUrl(details.url);
  if (!providerInfo) return;

  stats.promptsDetected++;
  await saveStats();

  // Extract request data
  const requestData = {
    timestamp: new Date().toISOString(),
    provider: providerInfo.provider,
    provider_name: providerInfo.name,
    url: details.url,
    method: details.method,
    // Note: Request body is captured via content script
  };

  // Send to backend
  await sendLlmRequest(requestData);
}

// Listen for web requests to LLM providers
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (details.method === 'POST') {
      handleLlmTraffic(details);
    }
  },
  {
    urls: [
      'https://chatgpt.com/*',
      'https://*.openai.com/*',
      'https://claude.ai/*',
      'https://*.anthropic.com/*',
      'https://gemini.google.com/*',
      'https://*.canva.com/*',
      'https://deepseek.com/*',
      'https://*.perplexity.ai/*',
      'https://copilot.microsoft.com/*',
      'https://x.ai/*',
      'https://*.deepl.com/*',
      'https://*.grammarly.com/*'
    ]
  }
);

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'GET_STATUS':
      sendResponse({
        isAuthenticated: authState.isAuthenticated,
        organizationName: authState.organizationName,
        email: authState.email,
        stats: stats
      });
      break;

    case 'LOGIN':
      authenticate(message.email, message.password).then(sendResponse);
      return true; // Keep channel open for async response

    case 'LOGOUT':
      logout().then(() => sendResponse({ success: true }));
      return true;

    case 'LLM_REQUEST':
      // Handle LLM request from content script
      sendLlmRequest({
        ...message.data,
        source: 'content_script'
      }).then((success) => sendResponse({ success }));
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
