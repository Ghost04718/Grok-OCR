import OpenAI from 'openai';

// Create context menu items when extension is installed
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'performOCR',
    title: 'Perform OCR on this image',
    contexts: ['image']
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'performOCR') {
    const imageUrl = info.srcUrl;
    
    // Get the API key from storage
    chrome.storage.sync.get(['apiKey'], async (result) => {
      if (!result.apiKey) {
        // If no API key is set, open the options page
        chrome.runtime.openOptionsPage();
        return;
      }
      
      try {
        const text = await performOCR(imageUrl, result.apiKey);
        
        // Send the result to the popup
        chrome.storage.local.set({ 
          ocrResult: text,
          imageUrl: imageUrl,
          timestamp: new Date().toISOString()
        });
        
        // Open the popup to display the result
        chrome.action.openPopup();
      } catch (error) {
        console.error('OCR Error:', error);
        chrome.storage.local.set({ 
          ocrError: error.message,
          timestamp: new Date().toISOString()
        });
        chrome.action.openPopup();
      }
    });
  }
});

// Function to perform OCR using grok-2-vision
async function performOCR(imageUrl, apiKey) {
  try {
    // Get the custom prompt from storage or use the default one
    const result = await chrome.storage.sync.get(['customPrompt']);
    const promptText = result.customPrompt || "Perform OCR on this image. Extract and return all visible text.";
    
    const openai = new OpenAI({ 
      apiKey: apiKey,
      baseURL: "https://api.x.ai/v1"
    });
    
    const completion = await openai.chat.completions.create({
      model: "grok-2-vision-latest",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: imageUrl,
                detail: "high",
              },
            },
            {
              type: "text",
              text: promptText,
            },
          ],
        },
      ],
    });
    
    return completion.choices[0].message.content;
  } catch (error) {
    console.error('Grok API Error:', error);
    throw new Error(`OCR failed: ${error.message}`);
  }
}