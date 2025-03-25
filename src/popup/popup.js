// Improved popup logic with better error handling and state management
document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const loadingElement = document.getElementById('loading');
  const loadingText = document.querySelector('.loading-container p');
  const errorContainer = document.getElementById('error-container');
  const errorMessage = document.getElementById('error-message');
  const resultsContainer = document.getElementById('results-container');
  const imageCard = document.querySelector('.image-card');
  const textCard = document.querySelector('.text-card');
  const instruction = document.getElementById('instruction');
  const imagePreview = document.getElementById('image-preview');
  const textContent = document.getElementById('text-content');
  const wordCountBadge = document.getElementById('word-count');
  const expandImageBtn = document.getElementById('expand-image');
  const expandedOverlay = document.getElementById('expanded-image-overlay');
  const expandedImage = document.getElementById('expanded-image');
  const closeExpandedBtn = document.getElementById('close-expanded');
  const toggleThemeBtn = document.getElementById('toggle-theme');
  const toastContainer = document.getElementById('toast-container');
  
  // Button references
  const copyButton = document.getElementById('copy-button');
  const downloadButton = document.getElementById('download-button');
  const settingsButton = document.getElementById('settings-button');
  const openOptionsButton = document.getElementById('open-options');
  
  // Track recent operations to prevent duplicates
  const recentOperations = new Map();
  
  // Track popup state
  let currentState = {
    processing: false,
    ocrResult: null,
    ocrError: null,
    imageUrl: null,
    timestamp: null
  };
  
  // Status check timer and loading animation
  let statusCheckTimer = null;
  let loadingDotsTimer = null;
  
  // Initial setup
  initializeTheme();
  showLoading(); // Show loading state by default
  
  // Load initial state
  loadInitialState();
  
  // Initialize theme from storage
  function initializeTheme() {
    console.log('Initializing theme...');
    chrome.storage.sync.get(['theme'], function(result) {
      console.log('Theme from storage:', result.theme);
      applyTheme(result.theme || 'light');
    });
  }
  
  // Apply theme to document
  function applyTheme(themeName) {
    console.log('Applying theme:', themeName);
    
    // Set the theme attribute on html element
    document.documentElement.setAttribute('data-theme', themeName);
    
    // Update the button icon - using simplified approach
    if (toggleThemeBtn) {
      toggleThemeBtn.innerHTML = themeName === 'dark' 
        ? '<i class="fas fa-sun"></i>' 
        : '<i class="fas fa-moon"></i>';
    }
  }
  
  // Start loading animation
  function startLoadingAnimation() {
    let dots = 0;
    
    // Clear existing timer if any
    if (loadingDotsTimer) {
      clearInterval(loadingDotsTimer);
    }
    
    // Update loading text with animated dots
    loadingDotsTimer = setInterval(() => {
      dots = (dots + 1) % 4;
      const dotsText = '.'.repeat(dots);
      loadingText.textContent = `Extracting text from image${dotsText}`;
    }, 500);
  }
  
  // Stop loading animation
  function stopLoadingAnimation() {
    if (loadingDotsTimer) {
      clearInterval(loadingDotsTimer);
      loadingDotsTimer = null;
    }
  }
  
  // Function to load initial state with fallback
  function loadInitialState() {
    // Check if we have state in local storage
    chrome.storage.local.get(['ocrResult', 'ocrError', 'imageUrl', 'processing', 'timestamp'], (data) => {
      console.log('Initial state loaded:', data);
      
      // Update current state
      if (data) {
        currentState = {
          processing: !!data.processing,
          ocrResult: data.ocrResult || null,
          ocrError: data.ocrError || null,
          imageUrl: data.imageUrl || null,
          timestamp: data.timestamp || null
        };
      }
      
      // Check if state is recent (within last 30 minutes)
      const now = new Date().getTime();
      const timestamp = currentState.timestamp ? new Date(currentState.timestamp).getTime() : 0;
      const isRecent = (now - timestamp) < 30 * 60 * 1000; // 30 minutes
      
      if (!isRecent) {
        console.log('No recent state found, showing default state');
        showDefaultState();
        return;
      }
      
      // Update UI based on current state
      updateUIFromState();
      
      // If still processing, start status check
      if (currentState.processing) {
        startStatusCheck();
        startLoadingAnimation();
      }
    });
  }
  
  // Function to update UI based on current state
  function updateUIFromState() {
    // Reset UI
    hideAll();
    
    // Handle different states
    if (currentState.processing) {
      showLoading();
      startLoadingAnimation();
    } else if (currentState.ocrError) {
      stopLoadingAnimation();
      showError(currentState.ocrError);
    } else if (currentState.ocrResult) {
      stopLoadingAnimation();
      showResults(currentState.ocrResult, currentState.imageUrl);
    } else {
      stopLoadingAnimation();
      showDefaultState();
    }
  }
  
  // Check processing status periodically
  function startStatusCheck() {
    // Clear any existing timer
    if (statusCheckTimer) {
      clearInterval(statusCheckTimer);
    }
    
    // Start a new timer
    statusCheckTimer = setInterval(() => {
      chrome.storage.local.get(['ocrResult', 'ocrError', 'imageUrl', 'processing', 'timestamp'], (data) => {
        // Only update if state has changed
        if (data.timestamp !== currentState.timestamp) {
          console.log('State changed, updating UI:', data);
          
          // Update current state
          currentState = {
            processing: !!data.processing,
            ocrResult: data.ocrResult || null,
            ocrError: data.ocrError || null,
            imageUrl: data.imageUrl || null,
            timestamp: data.timestamp || null
          };
          
          // Update UI
          updateUIFromState();
          
          // Stop checking if no longer processing
          if (!currentState.processing) {
            clearInterval(statusCheckTimer);
            statusCheckTimer = null;
          }
        }
      });
    }, 1000); // Check every second
  }
  
  // Hide all UI elements
  function hideAll() {
    loadingElement.style.display = 'none';
    errorContainer.style.display = 'none';
    resultsContainer.style.display = 'none';
    
    if (imageCard) imageCard.style.display = 'none';
    if (textCard) textCard.style.display = 'none';
    if (instruction) instruction.style.display = 'none';
  }
  
  // Show loading status
  function showLoading() {
    hideAll();
    loadingElement.style.display = 'flex';
  }
  
  // Show default state
  function showDefaultState() {
    hideAll();
    instruction.style.display = 'flex';
  }
  
  // Show error
  function showError(error) {
    hideAll();
    errorContainer.style.display = 'flex';
    
    // Make sure error message is a string
    const errorText = typeof error === 'string' ? error : 'An unknown error occurred';
    errorMessage.textContent = errorText;
    
    console.log('Showing error:', errorText);
  }
  
  // Show results
  function showResults(result, imageUrl) {
    hideAll();
    resultsContainer.style.display = 'block';
    
    // Display the image if available
    if (imageUrl) {
      imagePreview.src = imageUrl;
      expandedImage.src = imageUrl;
      imageCard.style.display = 'block';
      
      // Add loading indicator for image
      imagePreview.style.opacity = '0.5';
      
      // Remove loading indicator when image loads
      imagePreview.onload = () => {
        imagePreview.style.opacity = '1';
      };
      
      // Handle image load error
      imagePreview.onerror = () => {
        imagePreview.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>';
        imagePreview.style.opacity = '1';
      };
    } else {
      imageCard.style.display = 'none';
    }
    
    // Display the text result
    if (result) {
      textContent.textContent = result;
      textCard.style.display = 'block';
      
      // Update word count
      updateWordCount(result);
      
      // Check if auto-copy is enabled
      chrome.storage.sync.get(['autoCopy'], (settings) => {
        if (settings.autoCopy) {
          setTimeout(() => {
            executeOnce('auto-copy', () => {
              navigator.clipboard.writeText(textContent.textContent)
                .then(() => showToast('Text automatically copied to clipboard', 'success'))
                .catch(() => console.log('Auto copy failed'));
            });
          }, 500);
        }
      });
    } else {
      textCard.style.display = 'none';
    }
  }
  
  // Update word count
  function updateWordCount(text) {
    // Check if word count display is enabled
    chrome.storage.sync.get(['showWordCount'], (result) => {
      if (result.showWordCount === false) {
        wordCountBadge.style.display = 'none';
        return;
      }
      
      wordCountBadge.style.display = 'inline-block';
      
      if (!text) {
        wordCountBadge.textContent = '0 words';
        return;
      }
      
      // Calculate word count (consider mixed English/Chinese)
      const wordCount = text.trim().split(/\s+/).length;
      // For Chinese, character count might be more meaningful
      const charCount = text.replace(/\s/g, '').length;
      
      // For Chinese and English mixed text, show both counts
      if (/[\u4e00-\u9fa5]/.test(text)) {
        wordCountBadge.textContent = `${charCount} characters`;
      } else {
        wordCountBadge.textContent = `${wordCount} words`;
      }
    });
  }
  
  // Show toast notification with deduplication
  function showToast(message, type = 'info') {
    const toastKey = `${type}:${message}`;
    const now = Date.now();
    
    // Check if we've shown this toast recently
    if (recentOperations.has(toastKey)) {
      const lastShown = recentOperations.get(toastKey);
      if (now - lastShown < 5000) {
        return; // Skip showing this toast
      }
    }
    
    // Track this toast
    recentOperations.set(toastKey, now);
    
    // Create and add toast to container
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.dataset.key = toastKey;
    
    let icon;
    switch (type) {
      case 'success':
        icon = '<i class="fas fa-check-circle"></i>';
        break;
      case 'error':
        icon = '<i class="fas fa-exclamation-circle"></i>';
        break;
      default:
        icon = '<i class="fas fa-info-circle"></i>';
    }
    
    toast.innerHTML = `${icon} ${message}`;
    
    // Remove any existing toast with the same key
    const existingToast = toastContainer.querySelector(`[data-key="${toastKey}"]`);
    if (existingToast) {
      existingToast.remove();
    }
    
    toastContainer.appendChild(toast);
    
    // Remove toast after delay
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 3000);
  }
  
  // Execute action with cooldown
  function executeOnce(key, action, cooldownMs = 2000) {
    const now = Date.now();
    if (recentOperations.has(key)) {
      const lastTime = recentOperations.get(key);
      if (now - lastTime < cooldownMs) {
        console.log(`Skipping action ${key}: cooldown in effect`);
        return;
      }
    }
    
    recentOperations.set(key, now);
    action();
    
    // Clean up old operations after 10 minutes
    const tenMinutesAgo = now - 600000;
    for (const [existingKey, timestamp] of recentOperations.entries()) {
      if (timestamp < tenMinutesAgo) {
        recentOperations.delete(existingKey);
      }
    }
  }
  
  // EVENT LISTENERS
  
  // Simple direct approach to theme toggle
  toggleThemeBtn.onclick = function(e) {
    e.preventDefault();
    e.stopPropagation();
    console.log('Theme toggle clicked!');
    
    // Get current theme
    const currentTheme = document.documentElement.getAttribute('data-theme');
    console.log('Current theme:', currentTheme);
    
    // Determine new theme
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    console.log('Switching to theme:', newTheme);
    
    // Apply theme
    applyTheme(newTheme);
    
    // Save preference
    chrome.storage.sync.set({ theme: newTheme }, function() {
      console.log('Theme saved to storage:', newTheme);
      showToast(`Switched to ${newTheme} mode`, 'info');
    });
  };
  
  // Copy text to clipboard
  copyButton.addEventListener('click', () => {
    executeOnce('copy-text', () => {
      const text = textContent.textContent;
      navigator.clipboard.writeText(text).then(() => {
        showToast('Text copied to clipboard', 'success');
      }).catch(() => {
        showToast('Failed to copy text', 'error');
      });
    });
  });
  
  // Download text as file
  downloadButton.addEventListener('click', () => {
    executeOnce('download-text', () => {
      const text = textContent.textContent;
      const blob = new Blob([text], {type: 'text/plain'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      
      // Create filename with date and timestamp
      const date = new Date().toISOString().replace(/:/g, '-').slice(0, 19);
      a.download = `ocr-text-${date}.txt`;
      a.href = url;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
      
      showToast('Text file downloaded', 'success');
    });
  });
  
  // Expand image
  imagePreview.addEventListener('click', () => {
    expandedOverlay.classList.add('visible');
  });
  
  expandImageBtn.addEventListener('click', () => {
    executeOnce('expand-image', () => {
      expandedOverlay.classList.add('visible');
    });
  });
  
  closeExpandedBtn.addEventListener('click', () => {
    executeOnce('close-expanded', () => {
      expandedOverlay.classList.remove('visible');
    });
  });
  
  expandedOverlay.addEventListener('click', (e) => {
    if (e.target === expandedOverlay) {
      expandedOverlay.classList.remove('visible');
    }
  });
  
  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Escape key to close expanded image
    if (e.key === 'Escape' && expandedOverlay.classList.contains('visible')) {
      expandedOverlay.classList.remove('visible');
    }
    
    // Ctrl+C to copy text when text content is focused
    if (e.key === 'c' && (e.ctrlKey || e.metaKey) && document.activeElement === textContent) {
      executeOnce('copy-shortcut', () => {
        copyButton.click();
      });
    }
  });
  
  // Open options page
  settingsButton.addEventListener('click', () => {
    executeOnce('open-settings', () => {
      chrome.runtime.openOptionsPage();
    });
  });
  
  openOptionsButton.addEventListener('click', () => {
    executeOnce('open-options', () => {
      chrome.runtime.openOptionsPage();
    });
  });
  
  // Create and add retry button to error container
  const retryButton = document.createElement('button');
  retryButton.className = 'primary-button';
  retryButton.innerHTML = '<i class="fas fa-redo"></i> Try Again';
  retryButton.style.marginTop = '16px';
  
  retryButton.addEventListener('click', () => {
    executeOnce('retry-ocr', () => {
      // If we have an image URL, try OCR again
      if (currentState.imageUrl) {
        // Set processing state
        chrome.storage.local.set({
          processing: true,
          ocrError: null,
          ocrResult: null,
          timestamp: new Date().toISOString()
        }, () => {
          // Update current state
          currentState.processing = true;
          currentState.ocrError = null;
          currentState.ocrResult = null;
          currentState.timestamp = new Date().toISOString();
          
          // Show loading state
          showLoading();
          startLoadingAnimation();
          startStatusCheck();
          
          // Tell background script to retry
          chrome.runtime.sendMessage({
            action: 'retry-ocr',
            imageUrl: currentState.imageUrl
          });
        });
      } else {
        showToast('No image to process', 'error');
      }
    });
  });
  
  // Add retry button to error container
  errorContainer.appendChild(retryButton);
  
  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'update-state') {
      // Update state and UI
      currentState = message.state;
      updateUIFromState();
      sendResponse({received: true});
    }
  });
  
  // Add a drag-to-select behavior for text content
  textContent.addEventListener('mouseup', () => {
    const selection = window.getSelection();
    if (selection.toString().length > 0) {
      // Show copy option for selected text
      const floatingCopy = document.createElement('div');
      floatingCopy.className = 'floating-copy';
      floatingCopy.innerHTML = '<i class="fas fa-copy"></i> Copy selection';
      
      // Position near selection
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      
      floatingCopy.style.top = `${rect.top - 30}px`;
      floatingCopy.style.left = `${rect.left}px`;
      
      document.body.appendChild(floatingCopy);
      
      // Remove after clicking or after a delay
      floatingCopy.addEventListener('click', () => {
        navigator.clipboard.writeText(selection.toString()).then(() => {
          showToast('Selection copied to clipboard', 'success');
        });
        document.body.removeChild(floatingCopy);
      });
      
      setTimeout(() => {
        if (document.body.contains(floatingCopy)) {
          document.body.removeChild(floatingCopy);
        }
      }, 3000);
      
      // Remove on click outside
      document.addEventListener('click', function removeFloating(e) {
        if (e.target !== floatingCopy && !floatingCopy.contains(e.target)) {
          if (document.body.contains(floatingCopy)) {
            document.body.removeChild(floatingCopy);
          }
          document.removeEventListener('click', removeFloating);
        }
      });
    }
  });
  
  // Cleanup before page close
  window.addEventListener('beforeunload', () => {
    if (statusCheckTimer) {
      clearInterval(statusCheckTimer);
    }
    if (loadingDotsTimer) {
      clearInterval(loadingDotsTimer);
    }
  });
  
  // Add floating copy button styles
  const style = document.createElement('style');
  style.textContent = `
    .floating-copy {
      position: fixed;
      background-color: var(--primary);
      color: white;
      padding: 6px 12px;
      border-radius: 4px;
      font-size: 12px;
      cursor: pointer;
      z-index: 1000;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
      display: flex;
      align-items: center;
      gap: 6px;
      animation: fadeIn 0.2s ease;
    }
    
    .floating-copy:hover {
      background-color: var(--primary-hover);
    }
    
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(5px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `;
  document.head.appendChild(style);
});