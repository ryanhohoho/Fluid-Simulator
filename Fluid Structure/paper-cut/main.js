/**
 * main application entry point for the paper cutting simulation
 * handles loading screen, initialization, and simulation start
 */

// initialize loading animation
function simulateLoading() {
    const progressBar = document.getElementById('loading-progress-bar');
    let progress = 0;
    
    const interval = setInterval(() => {
        progress += 5;
        progressBar.style.width = `${progress}%`;
        
        if (progress >= 100) {
            clearInterval(interval);
            document.getElementById('loading-screen').classList.add('fade-out');
            
            setTimeout(() => {
                document.getElementById('loading-screen').style.display = 'none';
                
                // start the simulation after loading is complete
                initializeSimulation();
            }, 500);
        }
    }, 50);
}

// start loading simulation
simulateLoading();

// initialize the simulation
function initializeSimulation() {
    try {
        // create global simulation instance
        window.paperSimulation = new PaperSimulation();
        
        // check initial theme preference
        const savedTheme = localStorage.getItem('theme') || 'dark';
        applyTheme(savedTheme);
        
    } catch (error) {
        console.error('Failed to start simulation:', error);
        
        // display error in status
        const statusElement = document.getElementById('status');
        if (statusElement) {
            statusElement.textContent = 'Failed to start: ' + error.message;
        }
        
        // hide loading screen even on error
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.style.display = 'none';
        }
    }
}

// apply theme
function applyTheme(theme) {
    if (theme === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) themeToggle.checked = true;
    } else {
        document.documentElement.removeAttribute('data-theme');
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) themeToggle.checked = false;
    }
    
    // dispatch theme change event
    dispatchThemeChangeEvent(theme);
}

// helper function to dispatch theme change event
function dispatchThemeChangeEvent(theme) {
    const event = new CustomEvent('themeChange', {
        detail: { theme: theme }
    });
    document.dispatchEvent(event);
}