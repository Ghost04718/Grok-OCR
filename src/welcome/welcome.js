document.addEventListener('DOMContentLoaded', function() {
  console.log('Welcome page loaded!');
  
  // Get the theme toggle button
  var themeToggleBtn = document.getElementById('theme-toggle');
  console.log('Toggle button found:', !!themeToggleBtn);
  
  if (!themeToggleBtn) {
    console.error('Theme toggle button not found!');
    return;
  }
  
  // Very direct approach to theme toggle: onclick attribute
  themeToggleBtn.onclick = function() {
    console.log('Button clicked!');
    
    // Get current theme
    var currentTheme = document.documentElement.getAttribute('data-theme');
    console.log('Current theme:', currentTheme);
    
    // Toggle theme
    var newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    console.log('New theme will be:', newTheme);
    
    // Apply theme
    document.documentElement.setAttribute('data-theme', newTheme);
    
    // Update button icon
    if (newTheme === 'dark') {
      themeToggleBtn.innerHTML = '<i class="fas fa-sun"></i>';
    } else {
      themeToggleBtn.innerHTML = '<i class="fas fa-moon"></i>';
    }
    
    // Save theme
    chrome.storage.sync.set({ theme: newTheme }, function() {
      console.log('Theme saved:', newTheme);
    });
  };
  
  // Initialize theme
  chrome.storage.sync.get(['theme'], function(result) {
    console.log('Retrieved theme from storage:', result.theme);
    var theme = result.theme || 'light';
    
    // Apply theme
    document.documentElement.setAttribute('data-theme', theme);
    
    // Update button icon
    if (theme === 'dark') {
      themeToggleBtn.innerHTML = '<i class="fas fa-sun"></i>';
    } else {
      themeToggleBtn.innerHTML = '<i class="fas fa-moon"></i>';
    }
  });
  
  console.log('Welcome page initialization complete!');
});