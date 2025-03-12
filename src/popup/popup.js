// Track the most recent operations to prevent duplicates
const recentOperations = new Map();

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const loadingElement = document.getElementById('loading');
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
  
  // Remove any existing event listeners to prevent duplicates
  document.querySelectorAll('button').forEach(button => {
    const newButton = button.cloneNode(true);
    button.parentNode.replaceChild(newButton, button);
  });
  
  // Re-get the button references after cloning
  const copyButton = document.getElementById('copy-button');
  const downloadButton = document.getElementById('download-button');
  const settingsButton = document.getElementById('settings-button');
  const openOptionsButton = document.getElementById('open-options');
  
  // Initial setup
  initializeTheme();
  hideAll();
  
  // Check if we have a result or error
  chrome.storage.local.get(['ocrResult', 'ocrError', 'imageUrl', 'timestamp'], (data) => {
    // If no data or older than 5 minutes, show default state
    const now = new Date().getTime();
    const timestamp = data.timestamp ? new Date(data.timestamp).getTime() : 0;
    const isRecent = (now - timestamp) < 5 * 60 * 1000; // 5 minutes
    
    if (!isRecent) {
      showDefaultState();
      return;
    }
    
    if (data.ocrError) {
      showError(data.ocrError);
    } else if (data.ocrResult) {
      showResults(data.ocrResult, data.imageUrl);
    } else {
      showDefaultState();
    }
  });
  
  // Theme initialization
  function initializeTheme() {
    chrome.storage.sync.get(['theme'], (result) => {
      if (result.theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        toggleThemeBtn.innerHTML = '<i class="fas fa-sun"></i>';
      } else {
        document.documentElement.setAttribute('data-theme', 'light');
        toggleThemeBtn.innerHTML = '<i class="fas fa-moon"></i>';
      }
    });
  }
  
  // Hide all UI elements
  function hideAll() {
    loadingElement.style.display = 'none';
    errorContainer.style.display = 'none';
    
    if (imageCard) imageCard.style.display = 'none';
    if (textCard) textCard.style.display = 'none';
    if (instruction) instruction.style.display = 'none';
  }
  
  // Function to show the default state
  function showDefaultState() {
    hideAll();
    
    // Show only the instruction
    instruction.style.display = 'flex';
  }
  
  // Function to show error
  function showError(error) {
    hideAll();
    
    errorContainer.style.display = 'flex';
    errorMessage.textContent = error;
  }
  
  // Function to show results
  function showResults(result, imageUrl) {
    hideAll();
    
    // Set the image preview
    if (imageUrl) {
      imagePreview.src = imageUrl;
      expandedImage.src = imageUrl;
      imageCard.style.display = 'block';
    } else {
      imageCard.style.display = 'none';
    }
    
    // Format and display the text result
    textContent.textContent = result;
    textCard.style.display = 'block';
    
    // Update word count
    updateWordCount(result);
  }
  
  // Update word count
  function updateWordCount(text) {
    if (!text) {
      wordCountBadge.textContent = '0 words';
      return;
    }
    
    const wordCount = text.trim().split(/\s+/).length;
    wordCountBadge.textContent = `${wordCount} word${wordCount !== 1 ? 's' : ''}`;
  }
  
  // Show toast notification with strong deduplication
  function showToast(message, type = 'info') {
    const toastKey = `${type}:${message}`;
    const now = Date.now();
    
    // Check if we've shown this toast recently (within 5 seconds)
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
    
    // Clean up old operations after 10 minutes to prevent memory leaks
    const tenMinutesAgo = now - 600000;
    for (const [existingKey, timestamp] of recentOperations.entries()) {
      if (timestamp < tenMinutesAgo) {
        recentOperations.delete(existingKey);
      }
    }
  }
  
  // Toggle theme
  toggleThemeBtn.addEventListener('click', () => {
    executeOnce('toggle-theme', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      
      document.documentElement.setAttribute('data-theme', newTheme);
      
      if (newTheme === 'dark') {
        toggleThemeBtn.innerHTML = '<i class="fas fa-sun"></i>';
      } else {
        toggleThemeBtn.innerHTML = '<i class="fas fa-moon"></i>';
      }
      
      // Save theme preference
      chrome.storage.sync.set({ theme: newTheme });
      
      showToast(`${newTheme.charAt(0).toUpperCase() + newTheme.slice(1)} mode activated`, 'info');
    });
  });
  
  // Copy text to clipboard with strong debounce
  copyButton.addEventListener('click', () => {
    executeOnce('copy-text', () => {
      const text = textContent.textContent;
      navigator.clipboard.writeText(text).then(() => {
        showToast('Text copied to clipboard!', 'success');
      }).catch(() => {
        showToast('Failed to copy text', 'error');
      });
    });
  });
  
  // Download text as file with strong debounce
  downloadButton.addEventListener('click', () => {
    executeOnce('download-text', () => {
      const text = textContent.textContent;
      const blob = new Blob([text], {type: 'text/plain'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      
      // Create filename with date
      const date = new Date().toISOString().slice(0, 10);
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
  
  // Expand image with click handlers (using once)
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
  
  // Keyboard shortcut handling
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
});