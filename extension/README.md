# Robost Clarity Chrome Extension

A Chrome extension for monitoring LLM usage across your organization.

## Features

- **Authentication**: Secure login for Employee and Admin users
- **LLM Traffic Monitoring**: Captures prompts sent to major LLM providers
- **Real-time Statistics**: View prompt count and sync status

## Supported LLM Providers

- ChatGPT (chatgpt.com)
- Claude (claude.ai)
- Gemini (gemini.google.com)
- Canva Magic Studio (canva.com)
- DeepSeek (deepseek.com)
- Perplexity AI (perplexity.ai)
- Microsoft Copilot (copilot.microsoft.com)
- Grok (x.ai)
- DeepL (deepl.com)
- Grammarly (grammarly.com)

## Installation (Development)

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked"
4. Select this `extension` directory
5. The Robost Clarity icon will appear in your toolbar

## Usage

1. Click the extension icon
2. Log in with your organization email
3. Browse to any supported LLM provider
4. The extension will automatically detect and log prompts

## Configuration

The extension connects to the Robost Clarity backend API. By default, it uses `http://localhost:8000`. This can be configured for production deployments.

## Files

- `manifest.json` - Extension configuration (Manifest V3)
- `background.js` - Service worker for traffic interception
- `content.js` - Content script for DOM-level monitoring
- `popup.html` - Extension popup UI
- `popup.js` - Popup interaction logic
- `styles/popup.css` - Popup styling

## Security

- User credentials are never stored locally
- Only JWT tokens are cached for session management
- All communication with the backend uses HTTPS in production
- Prompt data is transmitted securely to your organization's Robost server
