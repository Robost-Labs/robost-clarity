/**
 * Robost Clarity - Content Script
 * Injected into LLM provider pages to capture prompt submissions at the DOM level.
 */

(function () {
    'use strict';

    // Prevent multiple injections
    if (window.__robostClarityInjected) return;
    window.__robostClarityInjected = true;

    // Provider-specific selectors for prompt inputs
    const PROVIDER_SELECTORS = {
        'chatgpt.com': {
            input: 'textarea[data-id="root"], #prompt-textarea',
            submitBtn: 'button[data-testid="send-button"], button[aria-label*="Send"]'
        },
        'claude.ai': {
            input: 'div[contenteditable="true"], textarea',
            submitBtn: 'button[aria-label*="Send"], button[type="submit"]'
        },
        'gemini.google.com': {
            input: 'rich-textarea, textarea',
            submitBtn: 'button.send-button, button[aria-label*="Send"]'
        },
        'perplexity.ai': {
            input: 'textarea',
            submitBtn: 'button[aria-label*="Submit"], button[type="submit"]'
        },
        'copilot.microsoft.com': {
            input: 'textarea#searchbox, textarea',
            submitBtn: 'button[aria-label*="Submit"]'
        }
    };

    // Detect current provider
    function detectProvider() {
        const hostname = window.location.hostname;
        for (const domain of Object.keys(PROVIDER_SELECTORS)) {
            if (hostname.includes(domain)) {
                return domain;
            }
        }
        return null;
    }

    // Get prompt text from various input types
    function getPromptText(element) {
        if (!element) return null;

        // Handle contenteditable divs
        if (element.getAttribute('contenteditable') === 'true') {
            return element.textContent || element.innerText;
        }

        // Handle textareas and inputs
        if (element.value !== undefined) {
            return element.value;
        }

        return null;
    }

    // Send intercepted prompt to background script
    function sendToBackground(promptText, provider) {
        if (!promptText || promptText.trim().length === 0) return;

        chrome.runtime.sendMessage({
            type: 'LLM_REQUEST',
            data: {
                timestamp: new Date().toISOString(),
                provider: provider,
                url: window.location.href,
                prompt: promptText.substring(0, 10000), // Limit prompt size
                source: 'content_script',
                method: 'POST'
            }
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.log('Robost Clarity: Failed to send to background', chrome.runtime.lastError);
            }
        });
    }

    // Monitor form submissions
    function monitorFormSubmissions(provider, selectors) {
        // Monitor Enter key press
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                const activeElement = document.activeElement;
                const promptText = getPromptText(activeElement);

                if (promptText && promptText.trim().length > 0) {
                    // Small delay to allow the submission to complete
                    setTimeout(() => {
                        sendToBackground(promptText, provider);
                    }, 100);
                }
            }
        }, true);

        // Monitor click on submit buttons
        document.addEventListener('click', (e) => {
            const target = e.target;
            const submitBtn = target.closest(selectors.submitBtn);

            if (submitBtn) {
                const inputElement = document.querySelector(selectors.input);
                const promptText = getPromptText(inputElement);

                if (promptText && promptText.trim().length > 0) {
                    sendToBackground(promptText, provider);
                }
            }
        }, true);
    }

    // Intercept fetch requests (XHR-level monitoring)
    function interceptFetch() {
        const originalFetch = window.fetch;

        window.fetch = async function (...args) {
            const [url, options] = args;

            // Check if this is a potential LLM API call
            if (options && options.method === 'POST' && options.body) {
                try {
                    let bodyText = '';
                    if (typeof options.body === 'string') {
                        bodyText = options.body;
                    } else if (options.body instanceof FormData) {
                        // Skip FormData for now
                    } else {
                        bodyText = JSON.stringify(options.body);
                    }

                    // Check for common prompt fields
                    if (bodyText.includes('"messages"') ||
                        bodyText.includes('"prompt"') ||
                        bodyText.includes('"content"')) {

                        const provider = detectProvider();
                        if (provider) {
                            chrome.runtime.sendMessage({
                                type: 'LLM_REQUEST',
                                data: {
                                    timestamp: new Date().toISOString(),
                                    provider: provider,
                                    url: typeof url === 'string' ? url : url.toString(),
                                    requestBody: bodyText.substring(0, 10000),
                                    source: 'fetch_intercept',
                                    method: 'POST'
                                }
                            });
                        }
                    }
                } catch (error) {
                    // Silently fail to not disrupt page functionality
                }
            }

            return originalFetch.apply(this, args);
        };
    }

    // Initialize monitoring
    function init() {
        const provider = detectProvider();
        if (!provider) {
            console.log('Robost Clarity: Unknown provider, using generic monitoring');
        }

        const selectors = PROVIDER_SELECTORS[provider] || {
            input: 'textarea, input[type="text"], div[contenteditable="true"]',
            submitBtn: 'button[type="submit"], button[aria-label*="Send"]'
        };

        // Set up DOM-level monitoring
        monitorFormSubmissions(provider || 'unknown', selectors);

        // Set up fetch interception
        interceptFetch();

        console.log('Robost Clarity: Monitoring initialized for', provider || 'generic');
    }

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
