# Grok OCR Chrome Extension

A polished Chrome extension that uses grok-2-vision to perform OCR (Optical Character Recognition) on images. The extension allows you to right-click on any image on a webpage and extract text from it using the Grok API.

## Features

- Right-click on any image to extract text
- User-provided Grok API key
- Beautiful, minimal UI with dark mode support
- Customizable OCR prompts with preset templates
- Context menu with quick access to preset prompts
- Keyboard shortcut for quick OCR (Ctrl+Shift+Y or ⌘+Shift+Y on Mac)
- Expand image view for better visibility
- Word count for extracted text
- Download extracted text as file
- Auto-copy feature for clipboard integration
- Beautiful welcome page for new users

## Setup

### Prerequisites

- Node.js and npm installed
- A Grok API key from x.ai

### Installation

1. Clone or download this repository
2. Navigate to the project folder in your terminal
3. Install dependencies:
   ```
   npm install
   ```
4. Build the extension:
   ```
   npm run build
   ```
5. Load the extension in Chrome:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" using the toggle in the top-right corner
   - Click "Load unpacked" and select the `dist` folder from this project

### Configuration

1. After installing the extension, click on the extension icon in your browser toolbar
2. Click the Settings icon to open the options page
3. Enter your Grok API key
4. (Optional) Customize your OCR prompt or select one of the preset prompts
5. Configure additional options like auto-copy and dark mode
6. Click "Save Settings"

## Usage

### Basic Usage

1. Navigate to any webpage with images
2. Right-click on an image
3. Select "Perform OCR on this image" from the context menu
4. Wait for the OCR processing to complete
5. View the extracted text in the popup
6. Use the copy or download buttons to save the text

### Using Preset Prompts

1. Right-click on an image
2. Hover over "OCR with preset..."
3. Select one of the preset options:
   - Basic Text Extraction
   - Preserve Layout
   - Convert to Markdown
   - Translate to English
   - Extract Table Data

### Keyboard Shortcuts

- Use `Ctrl+Shift+Y` (or `⌘+Shift+Y` on Mac) to perform OCR on the first sizable image on the current page

## Development

- Use `npm run watch` to build and watch for changes during development
- The extension is built using webpack and follows Chrome Extension Manifest V3

## Customization Options

### Theme Options
- Toggle between light and dark mode for comfortable viewing in any environment

### OCR Options
- Customize the prompt used to instruct the Grok AI
- Choose from preset prompts for specific OCR tasks
- Auto-copy extracted text to clipboard
- Show word count for extracted text

## Notes

- The extension stores your API key securely in Chrome's sync storage
- The OCR processing is done via the Grok API, so an internet connection is required
- Large or complex images may take longer to process

## Folder Structure

```
grok-ocr-extension/
├── dist/               # Built extension (created by webpack)
├── src/                # Source files
│   ├── background.js   # Background script for context menu and API
│   ├── manifest.json   # Chrome extension manifest
│   ├── welcome.html    # Welcome page for new users
│   ├── popup/          # Popup UI files
│   ├── options/        # Options page files
│   ├── images/         # Icon images
│   └── icons/          # Extension icons
├── webpack.config.js   # Webpack configuration
└── package.json        # Node.js dependencies and scripts
```

## Data Privacy

### What Data We Collect

- **API Key**: Your Grok API key is stored locally in Chrome's sync storage.
- **User Preferences**: Theme preferences, custom prompts, and other extension settings are stored in Chrome's sync storage.
- **Image Data**: When you perform OCR, the image URL is sent to the Grok API.
- **OCR Results**: The text extracted from images is temporarily stored in Chrome's local storage.

### How Your Data is Handled

- **Local Storage**: Most data is stored locally on your device using Chrome's built-in storage APIs:
  - Sync storage (for settings that persist across your Chrome installations)
  - Local storage (for temporary OCR results)
  
- **Data Transmission**: The extension only sends data to the Grok API (api.x.ai) when performing OCR:
  - The image URL for processing
  - Your API key for authentication
  - The custom prompt you've specified

- **No Third-Party Analytics**: This extension does not use any third-party analytics or tracking services.

### Data Retention

- **Temporary Storage**: OCR results are stored only temporarily (cleared after 5 minutes of inactivity or when Chrome is closed).
- **User Control**: You can clear all local data at any time by:
  1. Right-clicking the extension icon
  2. Selecting "Manage extensions"
  3. Clicking "Clear Data" on the extension's details page

### Security Practices

- **API Key Security**: Your API key is stored securely using Chrome's sync storage, which is encrypted.
- **No External Servers**: The extension does not maintain any external servers. All processing is done either locally or via the Grok API.
- **Minimal Permissions**: The extension only requests the minimum permissions needed to function.

### Third-Party Services

This extension relies on the Grok API provided by x.ai. Please refer to x.ai's privacy policy for information about how they handle data sent to their API.

## License

MIT
