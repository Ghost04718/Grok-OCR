// Default prompt to use if none is specified
const DEFAULT_PROMPT = "Perform OCR on this image. Extract and return all visible text.";

// Track recent operations to prevent duplicates
const recentOperations = new Map();

// Global flag to ensure we only initialize once
let hasInitialized = false;

document.addEventListener('DOMContentLoaded', () => {
  // Prevent multiple initializations
  if (hasInitialized) {
    console.log('Already initialized, skipping duplicate initialization');
    return;
  }
  
  // Set the flag immediately
  hasInitialized = true;
  
  console.log('Initializing options page...');
  
  // Initialize elements - using let to allow reassignment
  let apiKeyInput = document.getElementById('apiKey');
  let customPromptInput = document.getElementById('customPrompt');
  let showWordCountCheckbox = document.getElementById('showWordCount');
  let autoCopyCheckbox = document.getElementById('autoCopy');
  
  // Button references - using let to allow reassignment
  let toggleVisibilityBtn = document.getElementById('toggleVisibility');
  let saveButton = document.getElementById('saveButton');
  let resetButton = document.getElementById('resetButton');
  let toggleThemeBtn = document.getElementById('toggle-theme');
  let showInfoBtn = document.getElementById('show-info');
  let closeModalBtn = document.getElementById('close-modal');
  let presetGrid = document.querySelector('.preset-grid');
  let infoModal = document.getElementById('info-modal');
  
  // Get the test API button reference - don't create dynamically
  let testApiButton = document.getElementById('testApiButton');
  
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
        console.log(`Skipping action ${key}: cooldown in effect (last executed ${now - lastTime}ms ago)`);
        return false; // Indicate the action was skipped
      }
    }
    
    // Mark action as executed immediately to prevent race conditions
    recentOperations.set(key, now);
    
    // Execute the action
    action();
    
    // Clean up old operations 
    const tenMinutesAgo = now - 600000;
    for (const [existingKey, timestamp] of recentOperations.entries()) {
      if (timestamp < tenMinutesAgo) {
        recentOperations.delete(existingKey);
      }
    }
    
    return true; // Indicate action was executed
  }
  
  // Save options to chrome.storage
  function saveOptions() {
    // Avoid duplicate executions
    if (saveButton.disabled) return;
    
    executeOnce('save-options', () => {
      const apiKey = apiKeyInput.value;
      const customPrompt = customPromptInput.value;
      const autoCopy = autoCopyCheckbox.checked;
      const showWordCount = showWordCountCheckbox.checked;
      
      // Store original button text
      const originalText = saveButton.innerHTML;
      
      try {
        // Show saving indicator
        saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
        saveButton.disabled = true;
        
        chrome.storage.sync.set({ 
          apiKey,
          customPrompt,
          autoCopy,
          showWordCount
        }, () => {
          // Show success toast
          showToast('Settings saved successfully!', 'success');
          
          // Immediately restore button to avoid being stuck
          saveButton.innerHTML = originalText;
          saveButton.disabled = false;
        });
      } catch (error) {
        // Handle any unexpected errors
        showToast(`Error saving settings: ${error.message}`, 'error');
        saveButton.innerHTML = originalText;
        saveButton.disabled = false;
      }
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
          
          // Setup event listeners after restoration is complete
          setupEventListeners();
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
  
  // Test API key with improved handling
  function testApiKey() {
    // Avoid duplicate executions
    if (testApiButton.disabled) return;
    
    executeOnce('test-api', async () => {
      const apiKey = apiKeyInput.value.trim();
      
      if (!apiKey) {
        showToast('Please enter an API key first', 'error');
        return;
      }
      
      // Store original button text
      const originalText = testApiButton.innerHTML;
      
      try {
        // Show testing indicator
        testApiButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Testing...';
        testApiButton.disabled = true;
        
        // Create test API request
        const response = await fetch('https://api.x.ai/v1/models', {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        });
        
        const data = await response.json();
        
        if (response.ok && data) {
          showToast('API key is valid!', 'success');
        } else {
          showToast(`API key validation failed: ${data.error?.message || 'Unknown error'}`, 'error');
        }
      } catch (error) {
        showToast(`Error testing API key: ${error.message}`, 'error');
      } finally {
        // Always restore button state, using direct assignment rather than setTimeout
        testApiButton.innerHTML = originalText;
        testApiButton.disabled = false;
      }
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
      
      // Show notification
      showToast('Preset prompt applied', 'success');
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
  
  // Show toast message with improved deduplication
  function showToast(message, type = 'info') {
    const toastKey = `${type}:${message}`;
    const now = Date.now();
    
    // Check if we've shown this toast recently (within 5 seconds)
    if (recentOperations.has(toastKey)) {
      const lastShown = recentOperations.get(toastKey);
      if (now - lastShown < 5000) {
        console.log('Skipping duplicate toast:', message);
        return; // Skip showing duplicate toast
      }
    }
    
    // Track this toast with longer expiration
    recentOperations.set(toastKey, now);
    
    // Find toast container - if it doesn't exist, create it
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'toast-container';
      toastContainer.className = 'toast-container';
      document.body.appendChild(toastContainer);
    }
    
    // Remove any existing toast with the same key
    const existingToast = toastContainer.querySelector(`[data-key="${toastKey}"]`);
    if (existingToast) {
      existingToast.remove();
    }
    
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
  
  // Setup event listeners - only call once after restoration
  function setupEventListeners() {
    console.log('Setting up event listeners...');
    
    // Safety check to prevent multiple event listener registrations
    if (saveButton.dataset.listenersAttached === 'true') {
      console.log('Listeners already attached, skipping');
      return;
    }
    
    // Mark that we've attached listeners
    saveButton.dataset.listenersAttached = 'true';
    
    // Single theme toggle handler
    toggleThemeBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      
      // Execute the theme toggle with cooldown protection
      executeOnce('toggle-theme', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        // Apply theme change
        document.documentElement.setAttribute('data-theme', newTheme);
        
        // Update icon
        toggleThemeBtn.innerHTML = newTheme === 'dark' 
          ? '<i class="fas fa-sun"></i>' 
          : '<i class="fas fa-moon"></i>';
        
        // Save preference
        chrome.storage.sync.set({ theme: newTheme });
        
        // Show confirmation
        showToast(`${newTheme.charAt(0).toUpperCase() + newTheme.slice(1)} mode activated`, 'info');
      });
    });
    
    // Button click handlers
    saveButton.addEventListener('click', saveOptions);
    toggleVisibilityBtn.addEventListener('click', toggleApiKeyVisibility);
    resetButton.addEventListener('click', resetToDefault);
    showInfoBtn.addEventListener('click', toggleInfoModal);
    closeModalBtn.addEventListener('click', toggleInfoModal);
    
    // Add test API button event listener if the button exists
    if (testApiButton) {
      testApiButton.addEventListener('click', testApiKey);
    }
    
    // Delegate for preset buttons
    presetGrid.addEventListener('click', applyPresetPrompt);
    
    // Close modal when clicking outside
    infoModal.addEventListener('click', (e) => {
      if (e.target === infoModal) {
        toggleInfoModal();
      }
    });
    
    // Global keyboard event handling
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && infoModal.classList.contains('visible')) {
        toggleInfoModal();
      }
      
      // Save on Ctrl+S
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveOptions();
      }
    });
    
    // Handle checkbox changes
    autoCopyCheckbox.onchange = function() {
      if (!isRestoringOptions) {
        saveSetting('autoCopy', this.checked);
        showToast(`Auto-copy ${this.checked ? 'enabled' : 'disabled'}`, 'info');
      }
    };
    
    showWordCountCheckbox.onchange = function() {
      if (!isRestoringOptions) {
        saveSetting('showWordCount', this.checked);
        showToast(`Word count display ${this.checked ? 'enabled' : 'disabled'}`, 'info');
      }
    };
    
    // Auto-save input fields with debouncing
    let apiKeyTimer = null;
    let promptTimer = null;
    
    apiKeyInput.addEventListener('input', () => {
      if (isRestoringOptions) return;
      
      if (apiKeyTimer) {
        clearTimeout(apiKeyTimer);
      }
      
      apiKeyTimer = setTimeout(() => {
        saveSetting('apiKey', apiKeyInput.value);
      }, 1000);
    });
    
    customPromptInput.addEventListener('input', () => {
      if (isRestoringOptions) return;
      
      if (promptTimer) {
        clearTimeout(promptTimer);
      }
      
      promptTimer = setTimeout(() => {
        saveSetting('customPrompt', customPromptInput.value);
        
        // Update preset button highlighting
        document.querySelectorAll('.preset-button').forEach(btn => {
          btn.classList.remove('active');
        });
        
        highlightMatchingPreset(customPromptInput.value);
      }, 1000);
    });
    
    console.log('Event listeners setup complete');
  }
});