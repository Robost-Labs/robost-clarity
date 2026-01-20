/**
 * Robost Clarity - Popup Script
 * Handles UI interactions for the extension popup.
 */

// DOM Elements
const loginSection = document.getElementById('login-section');
const dashboardSection = document.getElementById('dashboard-section');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const statusIndicator = document.getElementById('status-indicator');
const orgName = document.getElementById('org-name');
const userEmail = document.getElementById('user-email');
const promptsDetected = document.getElementById('prompts-detected');
const promptsSent = document.getElementById('prompts-sent');
const lastActivity = document.getElementById('last-activity');

// Initialize popup
document.addEventListener('DOMContentLoaded', () => {
    checkStatus();
});

// Check authentication status
function checkStatus() {
    chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (response) => {
        if (chrome.runtime.lastError) {
            console.error('Error getting status:', chrome.runtime.lastError);
            showLogin();
            return;
        }
        if (response && response.isAuthenticated) {
            showDashboard(response);
        } else {
            showLogin();
        }
    });
}

// Show login section
function showLogin() {
    loginSection.classList.remove('hidden');
    dashboardSection.classList.add('hidden');
    updateStatusIndicator(false);
}

// Show dashboard section
function showDashboard(data) {
    loginSection.classList.add('hidden');
    dashboardSection.classList.remove('hidden');
    updateStatusIndicator(true);

    // Update display
    orgName.textContent = data.organizationName || 'Organization';
    userEmail.textContent = data.email || '';
    promptsDetected.textContent = data.stats?.promptsDetected || 0;
    promptsSent.textContent = data.stats?.promptsSent || 0;

    if (data.stats?.lastActivity) {
        const date = new Date(data.stats.lastActivity);
        lastActivity.textContent = `Last activity: ${formatTime(date)}`;
    } else {
        lastActivity.textContent = 'Monitoring LLM activity';
    }
}

// Update status indicator
function updateStatusIndicator(connected) {
    if (connected) {
        statusIndicator.classList.remove('status-disconnected');
        statusIndicator.classList.add('status-connected');
        statusIndicator.querySelector('.status-text').textContent = 'Connected';
    } else {
        statusIndicator.classList.remove('status-connected');
        statusIndicator.classList.add('status-disconnected');
        statusIndicator.querySelector('.status-text').textContent = 'Disconnected';
    }
}

// Format time helper
function formatTime(date) {
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) {
        return 'Just now';
    } else if (diff < 3600000) {
        const mins = Math.floor(diff / 60000);
        return `${mins} min${mins > 1 ? 's' : ''} ago`;
    } else if (diff < 86400000) {
        const hours = Math.floor(diff / 3600000);
        return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else {
        return date.toLocaleDateString();
    }
}

// Show error message
function showError(message) {
    loginError.textContent = message;
    loginError.classList.remove('hidden');
}

// Hide error message
function hideError() {
    loginError.classList.add('hidden');
}

// Set loading state
function setLoading(loading) {
    const btnText = loginBtn.querySelector('.btn-text');
    const btnLoading = loginBtn.querySelector('.btn-loading');

    if (loading) {
        btnText.classList.add('hidden');
        btnLoading.classList.remove('hidden');
        loginBtn.disabled = true;
    } else {
        btnText.classList.remove('hidden');
        btnLoading.classList.add('hidden');
        loginBtn.disabled = false;
    }
}

// Handle login form submission
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();
    setLoading(true);

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    chrome.runtime.sendMessage(
        { type: 'LOGIN', email, password },
        (response) => {
            setLoading(false);

            if (chrome.runtime.lastError) {
                console.error('Login error:', chrome.runtime.lastError);
                showError('Connection error. Please try again.');
                return;
            }

            if (response && response.success) {
                checkStatus();
            } else {
                showError(response?.error || 'Login failed. Please try again.');
            }
        }
    );

}
);

// Handle Google Login
const googleLoginBtn = document.getElementById('google-login-btn');
if (googleLoginBtn) {
    googleLoginBtn.addEventListener('click', () => {
        hideError();
        setLoading(true);

        const clientId = "832846281418-imi8thvrec39v4rt05a8vk97eaaduch8.apps.googleusercontent.com"; // Updated to match Admin Dashboard Client ID
        const redirectUri = chrome.identity.getRedirectURL(); // https://<extension-id>.chromiumapp.org/
        const nonce = Math.random().toString(36).substring(2, 15);

        const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
        authUrl.searchParams.set('client_id', clientId);
        authUrl.searchParams.set('response_type', 'id_token');
        authUrl.searchParams.set('redirect_uri', redirectUri);
        authUrl.searchParams.set('scope', 'openid email profile');
        authUrl.searchParams.set('nonce', nonce);
        authUrl.searchParams.set('prompt', 'consent'); // Always ask for consent? Maybe 'select_account'

        chrome.identity.launchWebAuthFlow(
            {
                url: authUrl.toString(),
                interactive: true
            },
            (redirectUrl) => {
                if (chrome.runtime.lastError) {
                    setLoading(false);
                    console.error('Google Auth Error:', chrome.runtime.lastError);
                    showError('Google Sign-In failed or cancelled.');
                    return;
                }

                if (redirectUrl) {
                    // Extract id_token from URL hash
                    const url = new URL(redirectUrl);
                    const params = new URLSearchParams(url.hash.substring(1)); // hash starts with #
                    const idToken = params.get('id_token');

                    if (idToken) {
                        // Send to backend via background script (or directly if we want, but keeping 'LOGIN' msg pattern is consistently)
                        // Actually, we can reuse the LOGIN message or create a new one. 
                        // Let's create a new message type 'GOOGLE_LOGIN' to keep it clean.
                        chrome.runtime.sendMessage(
                            { type: 'GOOGLE_LOGIN', token: idToken },
                            (response) => {
                                setLoading(false);
                                if (response && response.success) {
                                    checkStatus();
                                } else {
                                    showError(response?.error || 'Google Login backend verification failed.');
                                }
                            }
                        );
                    } else {
                        setLoading(false);
                        showError('No ID token found in Google response.');
                    }
                } else {
                    setLoading(false);
                    showError('Google Sign-In failed.');
                }
            }
        );
    });
}

// Handle logout
logoutBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'LOGOUT' }, () => {
        showLogin();
    });
});

// Refresh stats periodically
setInterval(() => {
    if (!dashboardSection.classList.contains('hidden')) {
        chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (response) => {
            if (response.isAuthenticated) {
                promptsDetected.textContent = response.stats?.promptsDetected || 0;
                promptsSent.textContent = response.stats?.promptsSent || 0;
            }
        });
    }
}, 5000);
