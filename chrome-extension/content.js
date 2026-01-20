/**
 * Robost Clarity - Content Script
 * Injected into LLM provider pages to capture prompt submissions at the DOM level.
 */

(function () {
    'use strict';

    // Prevent multiple injections
    if (window.__robostClarityInjected) return;
    window.__robostClarityInjected = true;

    console.log('Robost Clarity: Content script injected');

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
        // console.log('Robost Clarity: Detecting provider for hostname:', hostname);
        for (const domain of Object.keys(PROVIDER_SELECTORS)) {
            if (hostname.includes(domain)) {
                // console.log('Robost Clarity: Detected provider:', domain);
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

        // Check if extension context is still valid
        if (!chrome.runtime?.id) {
            console.warn('Robost Clarity: Extension context invalidated, suppressing message sending.');
            return;
        }

        console.log('Robost Clarity: Sending prompt to background', { provider, promptLength: promptText.length });

        try {
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
                // Check for lastError to avoid "Unchecked runtime.lastError"
                if (chrome.runtime.lastError) {
                    console.log('Robost Clarity: Note - Failed to send to background (could be transient/context invalid)', chrome.runtime.lastError.message);
                } else {
                    console.log('Robost Clarity: Background response:', response);
                }
            });
        } catch (e) {
            console.warn('Robost Clarity: Error sending message (context likely invalidated):', e);
        }
    }

    // Monitor form submissions
    function monitorFormSubmissions(provider, selectors) {
        // Monitor Enter key press
        document.addEventListener('keydown', (e) => {
            // Check context validity early
            if (!chrome.runtime?.id) return;

            if (e.key === 'Enter' && !e.shiftKey) {
                const activeElement = document.activeElement;
                const promptText = getPromptText(activeElement);

                if (promptText && promptText.trim().length > 0) {
                    console.log('Robost Clarity: Detected Enter key submission');
                    // Small delay to allow the submission to complete
                    setTimeout(() => {
                        // Check again inside timeout
                        if (chrome.runtime?.id) {
                            sendToBackground(promptText, provider);
                        }
                    }, 100);
                }
            }
        }, true);

        // Monitor click on submit buttons
        document.addEventListener('click', (e) => {
            // Check context validity
            if (!chrome.runtime?.id) return;

            const target = e.target;
            const submitBtn = target.closest(selectors.submitBtn);

            if (submitBtn) {
                console.log('Robost Clarity: Detected Submit button click');
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
        console.log('Robost Clarity: Initializing fetch interceptor');

        window.fetch = async function (...args) {
            const [resource, config] = args;

            // We process the capture asynchronously to not block the actually request
            (async () => {
                try {
                    let bodyText = '';
                    let url = '';
                    let method = 'GET';

                    if (resource instanceof Request) {
                        url = resource.url;
                        method = resource.method;
                        try {
                            const clone = resource.clone();
                            bodyText = await clone.text();
                        } catch (e) {
                            console.warn('Robost Clarity: Failed to clone/read Request body', e);
                        }
                    } else {
                        url = resource;
                        // Config might be undefined
                        if (config) {
                            method = config.method || 'GET';
                            if (config.body) {
                                if (typeof config.body === 'string') {
                                    bodyText = config.body;
                                } else if (config.body instanceof FormData) {
                                    const obj = {};
                                    config.body.forEach((value, key) => obj[key] = value);
                                    bodyText = JSON.stringify(obj);
                                } else {
                                    bodyText = JSON.stringify(config.body);
                                }
                            }
                        }
                    }

                    // console.log('Robost Clarity: Fetch intercepted', { url, method, hasBody: !!bodyText });

                    // Normalized check
                    if (method.toUpperCase() === 'POST' && bodyText) {
                        // Check for common prompt fields
                        const hasKeywords = bodyText.includes('"messages"') ||
                            bodyText.includes('"prompt"') ||
                            bodyText.includes('"content"') ||
                            (detectProvider() === 'chatgpt.com' && bodyText.includes('action'));

                        if (hasKeywords) {
                            const provider = detectProvider();
                            if (provider) {
                                console.log('Robost Clarity: LLM Request Detected via Fetch!', { provider, url });

                                // Check extension context before sending
                                if (chrome.runtime?.id) {
                                    try {
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
                                        }, (response) => {
                                            if (chrome.runtime.lastError) {
                                                // just swallow it or log lightly
                                            }
                                        });
                                    } catch (e) {
                                        // Context invalid
                                    }
                                }
                            } else {
                                // console.log('Robost Clarity: LLM keywords found but provider not detected');
                            }
                        }
                    }
                } catch (err) {
                    console.error('Robost Clarity Intercept Error:', err);
                }
            })();

            return originalFetch.apply(this, args);
        };
    }

    // Initialize monitoring
    function init() {
        const provider = detectProvider();
        console.log('Robost Clarity: Init called. Provider detected:', provider);

        if (!provider) {
            console.log('Robost Clarity: Unknown provider, using generic monitoring');
        }

        const selectors = PROVIDER_SELECTORS[provider] || {
            input: 'textarea, input[type="text"], div[contenteditable="true"]',
            submitBtn: 'button[type="submit"], button[aria-label*="Send"]'
        };

        // Set up DOM-level monitoring
        monitorFormSubmissions(provider || 'unknown', selectors);

        console.log('Robost Clarity: Monitoring initialized for', provider || 'generic');
    }

    // Initialize fetch interception immediately to catch early requests
    interceptFetch();

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
