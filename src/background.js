import OpenAI from 'openai';

// Create context menu items when extension is installed
chrome.runtime.onInstalled.addListener(() => {
  // Create context menu items, removing any existing ones first
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'performOCR',
      title: 'Perform OCR on this image',
      contexts: ['image']
    });
    
    chrome.contextMenus.create({
      id: 'downloadAndOCR',
      title: 'Download and OCR (more reliable)',
      contexts: ['image']
    });
  });
  
  // Open welcome page on install - updated path
  chrome.tabs.create({ url: 'welcome/welcome.html' });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  const imageUrl = info.srcUrl;
  
  if (info.menuItemId === 'performOCR') {
    processImage(imageUrl, false);
  } 
  else if (info.menuItemId === 'downloadAndOCR') {
    processImage(imageUrl, true);
  }
});

// Centralized image processing function with better status tracking
async function processImage(imageUrl, useDownloadMethod) {
  // Get the API key from storage
  chrome.storage.sync.get(['apiKey'], async (result) => {
    if (!result.apiKey) {
      // If no API key is set, open the options page and notify user
      chrome.storage.local.set({ 
        ocrError: 'API key not set. Please enter your Grok API key in the settings.',
        processing: false,
        timestamp: new Date().toISOString()
      });
      chrome.runtime.openOptionsPage();
      return;
    }
    
    // Save current image URL for display in popup
    chrome.storage.local.set({ 
      processing: true,
      imageUrl: imageUrl,
      timestamp: new Date().toISOString(),
      // Clear any previous results/errors
      ocrResult: null,
      ocrError: null
    }, () => {
      // Open popup to show loading status
      chrome.action.openPopup();
    });
    
    try {
      // Use different methods based on the context menu choice
      let text;
      
      console.log(`Starting OCR process for ${imageUrl} using ${useDownloadMethod ? 'download' : 'direct'} method`);
      
      if (useDownloadMethod) {
        text = await performOCRWithDownload(imageUrl, result.apiKey);
      } else {
        text = await performOCR(imageUrl, result.apiKey);
      }
      
      // Verify we got a valid result
      if (!text || typeof text !== 'string') {
        throw new Error('Received invalid OCR result from API');
      }
      
      console.log('OCR completed successfully, storing results');
      
      // Send results to popup with verification
      chrome.storage.local.set({ 
        ocrResult: text,
        imageUrl: imageUrl,
        processing: false,
        timestamp: new Date().toISOString()
      }, () => {
        // Notify the popup if it's open
        sendMessageToPopup({
          action: 'update-state',
          state: {
            processing: false,
            ocrResult: text,
            imageUrl: imageUrl,
            timestamp: new Date().toISOString()
          }
        });
      });
    } catch (error) {
      console.error('OCR Error:', error);
      
      // Format error message for display
      let errorMessage = error.message || 'Unknown error occurred';
      
      // Add more context if it's a network or API error
      if (error.status || error.statusText) {
        errorMessage = `API error (${error.status}): ${errorMessage}`;
      }
      
      // Store error in local storage for popup to display
      chrome.storage.local.set({ 
        ocrError: errorMessage,
        processing: false,
        timestamp: new Date().toISOString()
      }, () => {
        // Notify the popup if it's open
        sendMessageToPopup({
          action: 'update-state',
          state: {
            processing: false,
            ocrError: errorMessage,
            imageUrl: imageUrl,
            timestamp: new Date().toISOString()
          }
        });
      });
    }
  });
}

// Send a message to the popup if it's open
function sendMessageToPopup(message) {
  // Try sending a message, but don't worry if it fails (popup might not be open)
  try {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        // Suppress the error - popup is probably just not open
        console.log('Could not send message to popup, it might be closed');
      }
    });
  } catch (e) {
    // Ignore errors - popup might not be open
  }
}

// Main OCR function - thoroughly revised to match Grok Vision API requirements
async function performOCR(imageUrl, apiKey) {
  try {
    // Get custom prompt or use default
    const result = await chrome.storage.sync.get(['customPrompt']);
    const promptText = result.customPrompt || "Perform OCR on this image. Extract and return all visible text.";
    
    // Create the API client with proper configuration
    const openai = new OpenAI({ 
      apiKey: apiKey,
      baseURL: "https://api.x.ai/v1"
    });
    
    console.log('Starting OCR with Grok for image:', imageUrl);
    
    // ATTEMPT 1: Try direct URL method first (as recommended in docs)
    try {
      console.log('Attempting direct URL method');
      
      // Exactly match the structure shown in the documentation
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
                  detail: "high"
                }
              },
              {
                type: "text",
                text: promptText
              }
            ]
          }
        ]
      });
      
      console.log('Direct URL method successful!');
      
      // Verify we have a proper response
      if (completion && completion.choices && completion.choices[0] && 
          completion.choices[0].message && completion.choices[0].message.content) {
        return completion.choices[0].message.content;
      } else {
        throw new Error('Received incomplete response from API');
      }
    } catch (urlError) {
      console.error('Direct URL method failed:', urlError);
      console.log('Trying local image conversion approach...');
      
      // Continue to next approach
    }
    
    // ATTEMPT 2: Convert the image locally and send as base64
    try {
      console.log('Attempting local image conversion');
      
      // Get image data with content script (most reliable method for browser extension)
      const imageData = await getImageViaContentScript(imageUrl);
      
      if (!imageData || !imageData.base64Data) {
        throw new Error('Failed to get valid image data');
      }
      
      console.log(`Image converted to ${imageData.mimeType}, size: ${Math.round(imageData.base64Data.length * 0.75 / 1024)}KB`);
      
      // Check if image size is within limits (10MB max according to docs)
      const imageSizeInMB = (imageData.base64Data.length * 0.75) / (1024 * 1024);
      if (imageSizeInMB > 10) {
        throw new Error(`Image is too large (${imageSizeInMB.toFixed(1)}MB). Maximum size is 10MB.`);
      }
      
      // Create the data URL with proper mime type
      const dataUrl = `data:${imageData.mimeType};base64,${imageData.base64Data}`;
      
      // Exactly follow the format in the documentation for base64 images
      const completion = await openai.chat.completions.create({
        model: "grok-2-vision-latest",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: dataUrl,
                  detail: "high"
                }
              },
              {
                type: "text",
                text: promptText
              }
            ]
          }
        ]
      });
      
      console.log('Local conversion method successful!');
      
      if (completion && completion.choices && completion.choices[0] && 
          completion.choices[0].message && completion.choices[0].message.content) {
        return completion.choices[0].message.content;
      } else {
        throw new Error('Received incomplete response from API');
      }
    } catch (conversionError) {
      console.error('Local conversion failed:', conversionError);
      
      // Provide specific error for user
      if (conversionError.message.includes('API key')) {
        throw new Error('Invalid API key. Please check your Grok API key in settings.');
      } else if (conversionError.message.includes('CORS') || conversionError.message.includes('access')) {
        throw new Error('Cannot access this image due to browser security restrictions. Try the "Download and OCR" option.');
      } else if (conversionError.message.includes('too large')) {
        throw new Error(conversionError.message);
      } else {
        throw new Error(`OCR failed: ${conversionError.message}. Try the "Download and OCR" option.`);
      }
    }
  } catch (error) {
    console.error('Overall OCR process failed:', error);
    throw error;
  }
}

// Get and convert image using content script (handles CORS issues)
async function getImageViaContentScript(imageUrl) {
  console.log('Getting image via content script:', imageUrl);
  
  return new Promise((resolve, reject) => {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      if (!tabs || !tabs.length || !tabs[0].id) {
        reject(new Error('No active tab found'));
        return;
      }
      
      chrome.scripting.executeScript({
        target: {tabId: tabs[0].id},
        func: function(url) {
          return new Promise((resolve, reject) => {
            try {
              console.log('Loading image in page context:', url);
              
              // Create image element in the page
              const img = new Image();
              img.crossOrigin = 'anonymous';
              
              // Set timeout to avoid hanging
              const timeoutId = setTimeout(() => {
                reject(new Error('Image loading timed out'));
              }, 15000);
              
              img.onload = function() {
                clearTimeout(timeoutId);
                
                try {
                  // Check if image loaded correctly
                  if (img.width <= 0 || img.height <= 0) {
                    reject(new Error('Invalid image dimensions'));
                    return;
                  }
                  
                  // Create canvas to draw the image
                  const canvas = document.createElement('canvas');
                  canvas.width = img.width;
                  canvas.height = img.height;
                  
                  const ctx = canvas.getContext('2d');
                  ctx.fillStyle = '#FFFFFF';
                  ctx.fillRect(0, 0, canvas.width, canvas.height);
                  
                  try {
                    // Draw image to canvas
                    ctx.drawImage(img, 0, 0);
                    
                    // Try JPEG first (better compatibility with vision APIs)
                    try {
                      const jpegDataURL = canvas.toDataURL('image/jpeg', 0.92);
                      const base64Data = jpegDataURL.split(',')[1];
                      
                      // Make sure base64 is properly padded
                      let paddedBase64 = base64Data;
                      while (paddedBase64.length % 4 > 0) {
                        paddedBase64 += '=';
                      }
                      
                      resolve({
                        base64Data: paddedBase64,
                        mimeType: 'image/jpeg',
                        width: img.width,
                        height: img.height
                      });
                    } catch (jpegError) {
                      console.warn('JPEG encoding failed, trying PNG');
                      
                      // If JPEG fails, try PNG
                      const pngDataURL = canvas.toDataURL('image/png');
                      const base64Data = pngDataURL.split(',')[1];
                      
                      // Make sure base64 is properly padded
                      let paddedBase64 = base64Data;
                      while (paddedBase64.length % 4 > 0) {
                        paddedBase64 += '=';
                      }
                      
                      resolve({
                        base64Data: paddedBase64,
                        mimeType: 'image/png',
                        width: img.width,
                        height: img.height
                      });
                    }
                  } catch (drawError) {
                    reject(new Error('Canvas security error: CORS policy prevents access to image'));
                  }
                } catch (e) {
                  reject(new Error('Canvas error: ' + e.message));
                }
              };
              
              img.onerror = function(e) {
                clearTimeout(timeoutId);
                reject(new Error('Image loading failed: ' + (e.message || 'Unknown error')));
              };
              
              // Add cache-busting to avoid browser cache
              const cacheBuster = Date.now();
              const imgUrl = url + (url.includes('?') ? '&' : '?') + '_cb=' + cacheBuster;
              
              // Set the source
              img.src = imgUrl;
              
              // Append image to DOM temporarily (helps with some scenarios)
              const container = document.createElement('div');
              container.style.position = 'fixed';
              container.style.left = '-9999px';
              container.style.top = '-9999px';
              container.style.opacity = '0';
              container.appendChild(img);
              document.body.appendChild(container);
              
              // Clean up after loading
              img.onload = function() {
                clearTimeout(timeoutId);
                
                try {
                  // Remove from DOM
                  if (container.parentNode) {
                    document.body.removeChild(container);
                  }
                  
                  // Check if image loaded correctly
                  if (img.width <= 0 || img.height <= 0) {
                    reject(new Error('Invalid image dimensions'));
                    return;
                  }
                  
                  // Process the image as before...
                  const canvas = document.createElement('canvas');
                  canvas.width = img.width;
                  canvas.height = img.height;
                  
                  const ctx = canvas.getContext('2d');
                  ctx.fillStyle = '#FFFFFF';
                  ctx.fillRect(0, 0, canvas.width, canvas.height);
                  
                  try {
                    // Draw image to canvas
                    ctx.drawImage(img, 0, 0);
                    
                    // Try JPEG first
                    try {
                      const jpegDataURL = canvas.toDataURL('image/jpeg', 0.92);
                      const base64Data = jpegDataURL.split(',')[1];
                      
                      let paddedBase64 = base64Data;
                      while (paddedBase64.length % 4 > 0) {
                        paddedBase64 += '=';
                      }
                      
                      resolve({
                        base64Data: paddedBase64,
                        mimeType: 'image/jpeg',
                        width: img.width,
                        height: img.height
                      });
                    } catch (jpegError) {
                      // Try PNG as fallback
                      const pngDataURL = canvas.toDataURL('image/png');
                      const base64Data = pngDataURL.split(',')[1];
                      
                      let paddedBase64 = base64Data;
                      while (paddedBase64.length % 4 > 0) {
                        paddedBase64 += '=';
                      }
                      
                      resolve({
                        base64Data: paddedBase64,
                        mimeType: 'image/png',
                        width: img.width,
                        height: img.height
                      });
                    }
                  } catch (drawError) {
                    reject(new Error('Canvas security error: CORS policy prevents access to image'));
                  }
                } catch (e) {
                  reject(new Error('Canvas error: ' + e.message));
                }
              };
              
              img.onerror = function(e) {
                clearTimeout(timeoutId);
                if (container.parentNode) {
                  document.body.removeChild(container);
                }
                reject(new Error('Image loading failed: ' + (e.message || 'Unknown error')));
              };
            } catch (e) {
              reject(new Error('Content script error: ' + e.message));
            }
          });
        },
        args: [imageUrl]
      }, (results) => {
        if (chrome.runtime.lastError) {
          reject(new Error('Script execution error: ' + chrome.runtime.lastError.message));
          return;
        }
        
        if (results && results[0] && results[0].result) {
          resolve(results[0].result);
        } else {
          reject(new Error('Script returned no result'));
        }
      });
    });
  });
}

// Improved download-based OCR method
async function performOCRWithDownload(imageUrl, apiKey) {
  try {
    console.log('Starting download-based OCR for:', imageUrl);
    
    // Get custom prompt or use default
    const result = await chrome.storage.sync.get(['customPrompt']);
    const promptText = result.customPrompt || "Perform OCR on this image. Extract and return all visible text.";
    
    // Download the image
    const downloadedImageData = await downloadAndConvertImage(imageUrl);
    
    if (!downloadedImageData || !downloadedImageData.base64Data) {
      throw new Error('Failed to download and process image');
    }
    
    console.log('Image downloaded and converted, size:', Math.round(downloadedImageData.base64Data.length * 0.75 / 1024) + 'KB');
    
    // Check if image size is within limits (10MB max according to docs)
    const imageSizeInMB = (downloadedImageData.base64Data.length * 0.75) / (1024 * 1024);
    if (imageSizeInMB > 10) {
      throw new Error(`Image is too large (${imageSizeInMB.toFixed(1)}MB). Maximum size is 10MB.`);
    }
    
    // Create API client
    const openai = new OpenAI({
      apiKey: apiKey,
      baseURL: "https://api.x.ai/v1"
    });
    
    // Create data URL
    const dataUrl = `data:${downloadedImageData.mimeType};base64,${downloadedImageData.base64Data}`;
    
    // Call the API - carefully following the exact format from documentation
    const completion = await openai.chat.completions.create({
      model: "grok-2-vision-latest",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: dataUrl,
                detail: "high"
              }
            },
            {
              type: "text",
              text: promptText
            }
          ]
        }
      ]
    });
    
    console.log('API call with downloaded image successful!');
    
    if (completion && completion.choices && completion.choices[0] && 
        completion.choices[0].message && completion.choices[0].message.content) {
      return completion.choices[0].message.content;
    } else {
      throw new Error('Received incomplete response from API');
    }
  } catch (error) {
    console.error('Download OCR process error:', error);
    
    // Provide helpful error message
    if (error.message.includes('API key')) {
      throw new Error('Invalid API key. Please check your Grok API key in settings.');
    } else if (error.message.includes('download')) {
      throw new Error('Failed to download the image. The image might be inaccessible.');
    } else if (error.message.includes('too large')) {
      throw new Error(error.message);
    } else {
      throw new Error('OCR failed: ' + error.message);
    }
  }
}

// Download and convert image to base64
async function downloadAndConvertImage(imageUrl) {
  return new Promise((resolve, reject) => {
    try {
      // Create unique filename
      const filename = 'grok-ocr-' + Date.now() + '.jpg';
      
      console.log('Starting download for:', imageUrl);
      
      // Initiate download
      chrome.downloads.download({
        url: imageUrl,
        filename: filename,
        saveAs: false // Auto-download without dialog
      }, (downloadId) => {
        if (chrome.runtime.lastError) {
          reject(new Error('Download failed: ' + chrome.runtime.lastError.message));
          return;
        }
        
        console.log('Download initiated, ID:', downloadId);
        
        // Track download progress
        chrome.downloads.onChanged.addListener(function downloadListener(delta) {
          if (delta.id === downloadId) {
            console.log('Download status update:', delta);
            
            // Download completed
            if (delta.state && delta.state.current === 'complete') {
              // Remove listener to prevent memory leaks
              chrome.downloads.onChanged.removeListener(downloadListener);
              
              console.log('Download completed, processing file');
              
              // Get file details
              chrome.downloads.search({id: downloadId}, async (items) => {
                if (!items || !items.length) {
                  reject(new Error('Downloaded file not found'));
                  return;
                }
                
                try {
                  const item = items[0];
                  console.log('Downloaded file:', item.filename);
                  
                  // In Chrome extensions we can access the downloaded file using an internal URL
                  if (item.url) {
                    // Use fetch to get the file content
                    const response = await fetch(item.url);
                    const blob = await response.blob();
                    
                    // Determine MIME type (defaulting to JPEG if unknown)
                    const mimeType = blob.type.startsWith('image/') ? blob.type : 'image/jpeg';
                    
                    // Convert blob to base64
                    const reader = new FileReader();
                    reader.onloadend = function() {
                      try {
                        // Extract base64 data
                        const dataUrl = reader.result;
                        const base64Data = dataUrl.split(',')[1];
                        
                        // Ensure proper padding
                        let paddedBase64 = base64Data;
                        while (paddedBase64.length % 4 > 0) {
                          paddedBase64 += '=';
                        }
                        
                        resolve({
                          base64Data: paddedBase64,
                          mimeType: mimeType
                        });
                      } catch (e) {
                        reject(new Error('Failed to process downloaded file: ' + e.message));
                      }
                    };
                    
                    reader.onerror = function() {
                      reject(new Error('Failed to read downloaded file'));
                    };
                    
                    reader.readAsDataURL(blob);
                  } else {
                    reject(new Error('Downloaded file URL not available'));
                  }
                } catch (error) {
                  console.error('Error processing downloaded file:', error);
                  reject(new Error('Failed to process downloaded file: ' + error.message));
                }
              });
            } 
            // Download error
            else if (delta.error) {
              chrome.downloads.onChanged.removeListener(downloadListener);
              reject(new Error('Download error: ' + delta.error.current));
            }
          }
        });
      });
    } catch (error) {
      reject(new Error('Download setup failed: ' + error.message));
    }
  });
}

// Command handling for keyboard shortcuts
chrome.commands.onCommand.addListener((command) => {
  if (command === 'perform-ocr') {
    // Find first suitable image on current page
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      if (!tabs || !tabs.length || !tabs[0].id) {
        chrome.storage.local.set({ 
          ocrError: 'No active tab found.',
          processing: false,
          timestamp: new Date().toISOString()
        });
        chrome.action.openPopup();
        return;
      }
      
      chrome.scripting.executeScript({
        target: {tabId: tabs[0].id},
        func: findFirstSuitableImage
      }, (results) => {
        if (chrome.runtime.lastError) {
          chrome.storage.local.set({ 
            ocrError: 'Script execution error: ' + chrome.runtime.lastError.message,
            processing: false,
            timestamp: new Date().toISOString()
          });
          chrome.action.openPopup();
          return;
        }
        
        if (results && results[0] && results[0].result) {
          const imageUrl = results[0].result;
          
          if (imageUrl) {
            // Simulate right-click menu click
            chrome.contextMenus.onClicked.dispatch({
              menuItemId: 'performOCR',
              srcUrl: imageUrl
            }, tabs[0]);
          } else {
            // Show message in popup if no image found
            chrome.storage.local.set({ 
              ocrError: 'No suitable image found. Please right-click on a specific image to perform OCR.',
              processing: false,
              timestamp: new Date().toISOString()
            });
            chrome.action.openPopup();
          }
        }
      });
    });
  }
});

// Find first suitable image on page
function findFirstSuitableImage() {
  const images = Array.from(document.querySelectorAll('img'));
  
  // Sort images by size (largest first) to find most significant image
  images.sort((a, b) => {
    const aSize = (a.naturalWidth || a.width) * (a.naturalHeight || a.height);
    const bSize = (b.naturalWidth || b.width) * (b.naturalHeight || b.height);
    return bSize - aSize;
  });
  
  // Find first image of reasonable size
  for (const image of images) {
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    
    // Look for reasonably sized images that are visible
    if (width > 100 && height > 100 && 
        width < 4000 && height < 4000 && // Increased max size to 4000px
        image.offsetWidth > 0 && image.offsetHeight > 0 && 
        image.src && image.src.length > 0 &&
        !image.src.startsWith('data:') && // Avoid data URLs
        !image.src.includes('icon') && // Skip likely icons
        !image.src.includes('logo')) { // Skip likely logos
      return image.src;
    }
  }
  
  // Fallback to any image of reasonable size
  for (const image of images) {
    if ((image.naturalWidth || image.width) > 100 && 
        (image.naturalHeight || image.height) > 100 && 
        image.src && image.src.length > 0) {
      return image.src;
    }
  }
  
  return null; // No suitable image found
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle retry requests
  if (message.action === 'retry-ocr' && message.imageUrl) {
    console.log('Received retry request for image:', message.imageUrl);
    
    // Try the download method as it's more reliable
    processImage(message.imageUrl, true);
    
    // Acknowledge receipt
    sendResponse({received: true});
  }
  
  // Always return true for async response
  return true;
});