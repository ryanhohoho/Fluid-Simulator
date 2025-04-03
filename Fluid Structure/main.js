/**
 * Main application entry point for the fluid simulation
 * Handles UI initialization, theme switching, logo loading, and simulation start
 */

// logo handling - this allows for easy logo updates across all instances
function updateLogo(logoUrl) {
    const logoElements = document.querySelectorAll('.logo-img');
    for (const logoEl of logoElements) {
        logoEl.src = logoUrl;
        if (logoUrl) {
            logoEl.style.display = 'block';
            logoEl.parentElement.querySelector('.logo-placeholder').style.display = 'none';
        } else {
            logoEl.style.display = 'none';
            logoEl.parentElement.querySelector('.logo-placeholder').style.display = 'flex';
        }
    }
    // save to localStorage for persistence
    if (logoUrl) localStorage.setItem('appLogo', logoUrl);
}

// initialize from localStorage if available
const savedLogo = localStorage.getItem('appLogo');
if (savedLogo) {
    updateLogo(savedLogo);
}

// theme toggle functionality
const themeToggle = document.getElementById('theme-toggle');

// check for saved theme preference or default to dark
const savedTheme = localStorage.getItem('theme') || 'dark';

// apply the theme
function applyTheme(theme) {
    if (theme === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
        themeToggle.checked = true;
    } else {
        document.documentElement.removeAttribute('data-theme');
        themeToggle.checked = false;
    }
    
    // dispatch theme change event
    dispatchThemeChangeEvent(theme);
}

// initial theme application
applyTheme(savedTheme);

// theme toggle event listener
themeToggle.addEventListener('change', function() {
    const newTheme = this.checked ? 'light' : 'dark';
    applyTheme(newTheme);
    localStorage.setItem('theme', newTheme);
});

// helper function to dispatch theme change event
function dispatchThemeChangeEvent(theme) {
    const event = new CustomEvent('themeChange', {
        detail: { theme: theme }
    });
    document.dispatchEvent(event);
}

// loading simulation progress
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
        window.sim = new ParticleSimulation();
    } catch (error) {
        console.error("Failed to start simulation:", error);
        document.getElementById('status').textContent = "Failed to start: " + error.message;
        
        // hide loading screen even on error
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.style.display = 'none';
        }
    }
}
