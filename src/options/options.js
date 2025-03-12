// Default prompt to use if none is specified
const DEFAULT_PROMPT = "Perform OCR on this image. Extract and return all visible text.";

// Track recent operations to prevent duplicates
const recentOperations = new Map();

// Initialize the page only once
let isInitialized = false;

document.addEventListener('DOMContentLoaded', () => {
  // Only initialize once
  if (isInitialized) return;
  isInitialized = true;
  
  // Initialize elements
  const apiKeyInput = document.getElementById('apiKey');
  const customPromptInput = document.getElementById('customPrompt');
  const showWordCountCheckbox = document.getElementById('showWordCount');
  const autoCopyCheckbox = document.getElementById('autoCopy');
  
  // Remove any existing event listeners to prevent duplicates
  document.querySelectorAll('button, input[type="checkbox"]').forEach(element => {
    const newElement = element.cloneNode(true);
    element.parentNode.replaceChild(newElement, element);
  });
  
  // Re-get references after cloning
  const toggleVisibilityBtn = document.getElementById('toggleVisibility');
  const saveButton = document.getElementById('saveButton');
  const resetButton = document.getElementById('resetButton');
  const toggleThemeBtn = document.getElementById('toggle-theme');
  const showInfoBtn = document.getElementById('show-info');
  const closeModalBtn = document.getElementById('close-modal');
  const presetGrid = document.querySelector('.preset-grid');
  const infoModal = document.getElementById('info-modal');
  
  // Mark initialization as in progress
  let isRestoringOptions = true;
  
  // Initialize theme and UI
  initializeTheme();
  restoreOptions();
  
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
  
  // Save options to chrome.storage
  function saveOptions() {
    executeOnce('save-options', () => {
      const apiKey = apiKeyInput.value;
      const customPrompt = customPromptInput.value;
      const autoCopy = autoCopyCheckbox.checked;
      const showWordCount = showWordCountCheckbox.checked;
      
      chrome.storage.sync.set({ 
        apiKey,
        customPrompt,
        autoCopy,
        showWordCount
      }, () => {
        // Show success toast
        showToast('Settings saved successfully!', 'success');
      });
    });
  }
  
  // Save a specific setting without showing notification
  function saveSetting(key, value) {
    if (isRestoringOptions) return;
    
    const setting = {};
    setting[key] = value;
    
    chrome.storage.sync.set(setting);
  }
  
  // Restore options from chrome.storage
  function restoreOptions() {
    isRestoringOptions = true;
    
    chrome.storage.sync.get(
      ['apiKey', 'customPrompt', 'autoCopy', 'showWordCount'],
      (result) => {
        if (result.apiKey) {
          apiKeyInput.value = result.apiKey;
        }
        
        if (result.customPrompt) {
          customPromptInput.value = result.customPrompt;
          highlightMatchingPreset(result.customPrompt);
        }
        
        if (result.autoCopy !== undefined) {
          autoCopyCheckbox.checked = result.autoCopy;
        }
        
        if (result.showWordCount !== undefined) {
          showWordCountCheckbox.checked = result.showWordCount;
        } else {
          // Default to true if not set
          showWordCountCheckbox.checked = true;
        }
        
        // Mark initialization as complete after a delay
        setTimeout(() => {
          isRestoringOptions = false;
        }, 500);
      }
    );
  }
  
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
  
  // Reset to default prompt
  function resetToDefault() {
    executeOnce('reset-default', () => {
      customPromptInput.value = DEFAULT_PROMPT;
      
      // Highlight the Basic OCR preset button
      const presetButtons = document.querySelectorAll('.preset-button');
      presetButtons.forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-prompt') === DEFAULT_PROMPT) {
          btn.classList.add('active');
        }
      });
      
      // Show toast notification
      showToast('Default prompt restored', 'info');
    });
  }
  
  // Toggle API key visibility
  function toggleApiKeyVisibility() {
    executeOnce('toggle-visibility', () => {
      const icon = toggleVisibilityBtn.querySelector('i');
      
      if (apiKeyInput.type === 'password') {
        apiKeyInput.type = 'text';
        icon.className = 'fas fa-eye-slash';
      } else {
        apiKeyInput.type = 'password';
        icon.className = 'fas fa-eye';
      }
    });
  }
  
  // Toggle theme
  function toggleTheme() {
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
      
      // Show toast notification
      showToast(`${newTheme.charAt(0).toUpperCase() + newTheme.slice(1)} mode activated`, 'info');
    });
  }
  
  // Apply preset prompt
  function applyPresetPrompt(event) {
    const button = event.target.closest('.preset-button');
    if (!button) return;
    
    const promptText = button.getAttribute('data-prompt');
    if (!promptText) return;
    
    executeOnce(`preset-${promptText.slice(0, 10)}`, () => {
      customPromptInput.value = promptText;
      
      // Highlight the clicked button
      document.querySelectorAll('.preset-button').forEach(btn => {
        btn.classList.remove('active');
      });
      
      button.classList.add('active');
      
      // Focus the textarea
      customPromptInput.focus();
    });
  }
  
  // Highlight matching preset button
  function highlightMatchingPreset(customPrompt) {
    const presetButtons = document.querySelectorAll('.preset-button');
    let matchFound = false;
    
    presetButtons.forEach(btn => {
      const buttonPrompt = btn.getAttribute('data-prompt');
      btn.classList.remove('active');
      
      if (buttonPrompt === customPrompt) {
        btn.classList.add('active');
        matchFound = true;
      }
    });
    
    return matchFound;
  }
  
  // Show toast message with strong deduplication
  function showToast(message, type = 'info') {
    const toastKey = `${type}:${message}`;
    const now = Date.now();
    
    // Check if we've shown this toast recently (within 5 seconds)
    if (recentOperations.has(toastKey)) {
      const lastShown = recentOperations.get(toastKey);
      if (now - lastShown < 5000) {
        return; // Skip showing duplicate toast
      }
    }
    
    // Track this toast
    recentOperations.set(toastKey, now);
    
    // Create toast element
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
    const toastContainer = document.getElementById('toast-container');
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
  
  // Toggle modal visibility
  function toggleInfoModal() {
    executeOnce('toggle-modal', () => {
      infoModal.classList.toggle('visible');
    });
  }
  
  // Event Listeners - Using a single handler to attach all listeners
  function setupEventListeners() {
    // Button click handlers with debounce and tracking
    saveButton.addEventListener('click', saveOptions);
    toggleVisibilityBtn.addEventListener('click', toggleApiKeyVisibility);
    resetButton.addEventListener('click', resetToDefault);
    toggleThemeBtn.addEventListener('click', toggleTheme);
    showInfoBtn.addEventListener('click', toggleInfoModal);
    closeModalBtn.addEventListener('click', toggleInfoModal);
    
    // Delegate for preset buttons
    presetGrid.addEventListener('click', applyPresetPrompt);
    
    // Close modal when clicking outside
    infoModal.addEventListener('click', (e) => {
      if (e.target === infoModal) {
        toggleInfoModal();
      }
    });
    
    // Close modal with Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && infoModal.classList.contains('visible')) {
        toggleInfoModal();
      }
    });
    
    // Handle checkbox changes directly, using onChange instead of addEventListener
    autoCopyCheckbox.onchange = function() {
      if (!isRestoringOptions) {
        saveSetting('autoCopy', this.checked);
      }
    };
    
    showWordCountCheckbox.onchange = function() {
      if (!isRestoringOptions) {
        saveSetting('showWordCount', this.checked);
      }
    };
  }
  
  // Set up event listeners after a slight delay to ensure DOM is ready
  setTimeout(setupEventListeners, 100);
});