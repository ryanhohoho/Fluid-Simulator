/**
 * Settings Modal Functionality
 * Add this code to a new file (settings-modal.js) or add at the end of your main.js
 */

// Wait for DOM content to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM fully loaded, initializing settings modal');
    initSettingsModal();
  });
  
  // Settings modal initialization function
  function initSettingsModal() {
    // Get elements
    const modal = document.getElementById('settings-modal');
    const openButton = document.getElementById('open-settings-modal');
    const closeButton = document.getElementById('close-settings-modal');
    const themeToggle = document.getElementById('central-theme-toggle');
    const mainThemeToggle = document.getElementById('theme-toggle'); // original theme toggle
    
    // Debugging - confirm elements found
    console.log('Modal element:', modal);
    console.log('Open button:', openButton);
    console.log('Close button:', closeButton);
    console.log('Theme toggle:', themeToggle);
    
    // Check if elements exist
    if (!modal || !openButton) {
      console.error('Settings modal elements not found');
      return;
    }
    
    // Set initial theme state
    if (themeToggle) {
      // Check current theme
      const isLightTheme = document.documentElement.hasAttribute('data-theme') && 
                            document.documentElement.getAttribute('data-theme') === 'light';
      
      // Update toggle accordingly
      themeToggle.checked = isLightTheme;
      console.log('Initial theme state:', isLightTheme ? 'light' : 'dark');
    }
    
    // Open modal
    openButton.addEventListener('click', function(event) {
      console.log('Open button clicked');
      event.preventDefault();
      event.stopPropagation();
      
      // Display modal
      modal.classList.add('active');
      document.body.style.overflow = 'hidden'; // Prevent scrolling behind modal
    });
    
    // Close modal
    if (closeButton) {
      closeButton.addEventListener('click', function() {
        console.log('Close button clicked');
        modal.classList.remove('active');
        document.body.style.overflow = ''; // Restore scrolling
      });
    }
    
    // Close when clicking outside modal content
    modal.addEventListener('click', function(event) {
      // Only close if clicking outside the modal content
      if (event.target === modal) {
        console.log('Clicked outside modal content, closing');
        modal.classList.remove('active');
        document.body.style.overflow = ''; // Restore scrolling
      }
    });
    
    // Theme toggle functionality
    if (themeToggle) {
      themeToggle.addEventListener('change', function() {
        console.log('Theme toggle changed to:', this.checked ? 'light' : 'dark');
        
        // Update theme
        const newTheme = this.checked ? 'light' : 'dark';
        
        // Apply theme
        if (newTheme === 'light') {
          document.documentElement.setAttribute('data-theme', 'light');
        } else {
          document.documentElement.removeAttribute('data-theme');
        }
        
        // Keep main toggle in sync if it exists
        if (mainThemeToggle) {
          mainThemeToggle.checked = this.checked;
        }
        
        // Save theme preference
        localStorage.setItem('theme', newTheme);
        
        // Dispatch theme change event for components to react
        const event = new CustomEvent('themeChange', {
          detail: { theme: newTheme }
        });
        document.dispatchEvent(event);
      });
    }
  }
  
  // If window.load has already fired, initialize immediately
  if (document.readyState === 'complete') {
    console.log('Document already loaded, initializing immediately');
    initSettingsModal();
  }
  
  // Backup initialization on window load
  window.addEventListener('load', function() {
    console.log('Window loaded, checking if initialization needed');
    const modal = document.getElementById('settings-modal');
    
    if (modal && !modal.classList.contains('initialized')) {
      console.log('Backup initialization on window load');
      initSettingsModal();
      modal.classList.add('initialized');
    }
  });