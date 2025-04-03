/**
 * LightController class
 * Handles creation and control of a moveable light source
 */
class LightController {
    constructor(simulation) {
        this.simulation = simulation;
        this.scene = simulation.sceneManager.scene;
        
        // Default light parameters
        this.lightParams = {
            position: new THREE.Vector3(10, 30, 15),
            intensity: 0.8,
            color: 0xffffff,
            castShadow: true
        };
        
        // Create the light
        this.createLight();
        
        // Create light helper (visual representation)
        this.createLightHelper();
        
        // Setup UI controls
        this.setupControls();
    }
    
    /**
     * Create the directional light
     */
    createLight() {
        // Remove any existing main light
        if (this.light) {
            this.scene.remove(this.light);
            if (this.lightHelper) {
                this.scene.remove(this.lightHelper);
            }
        }
        
        // Create new directional light
        this.light = new THREE.DirectionalLight(
            this.lightParams.color, 
            this.lightParams.intensity
        );
        this.light.position.copy(this.lightParams.position);
        this.light.castShadow = this.lightParams.castShadow;
        
        // Setup shadow properties
        this.light.shadow.camera.left = -30;
        this.light.shadow.camera.right = 30;
        this.light.shadow.camera.top = 30;
        this.light.shadow.camera.bottom = -30;
        this.light.shadow.camera.near = 0.1;
        this.light.shadow.camera.far = 100;
        this.light.shadow.mapSize.width = 1024;
        this.light.shadow.mapSize.height = 1024;
        
        // Add light to scene
        this.scene.add(this.light);
    }
    
    /**
     * Create visual helper for the light
     */
    createLightHelper() {
        if (this.lightHelper) {
            this.scene.remove(this.lightHelper);
        }
        
        this.lightHelper = new THREE.DirectionalLightHelper(this.light, 5);
        this.scene.add(this.lightHelper);
    }
    
    /**
     * Update light parameters based on UI controls
     */
    updateLight() {
        this.light.position.copy(this.lightParams.position);
        this.light.intensity = this.lightParams.intensity;
        
        // Update the helper
        if (this.lightHelper) {
            this.lightHelper.update();
        }
    }
    
    /**
     * Setup UI controls for the light
     */
    setupControls() {
        // Create light controls section in settings panel
        this.createLightControlsUI();
        
        // Setup event listeners
        this.setupEventListeners();
    }
    
    /**
     * Create light controls UI in settings panel
     */
    createLightControlsUI() {
        // Find settings panel
        const settingsPanel = document.getElementById('settings-panel');
        if (!settingsPanel) return;
        
        // Create light controls section
        const lightSection = document.createElement('div');
        lightSection.className = 'section';
        lightSection.id = 'light-controls-section';
        
        lightSection.innerHTML = `
            <div class="section-title">Light Controls</div>
            
            <div class="control-group">
                <div class="control-label">
                    <span class="control-name">Light Intensity</span>
                    <span class="control-value" id="light-intensity-value">${this.lightParams.intensity.toFixed(2)}</span>
                </div>
                <input type="range" id="light-intensity" class="slider" min="0" max="2" step="0.1" value="${this.lightParams.intensity}">
            </div>
            
            <div class="control-group">
                <div class="control-label">
                    <span class="control-name">Light Position X</span>
                    <span class="control-value" id="light-position-x-value">${this.lightParams.position.x.toFixed(1)}</span>
                </div>
                <input type="range" id="light-position-x" class="slider" min="-30" max="30" step="1" value="${this.lightParams.position.x}">
            </div>
            
            <div class="control-group">
                <div class="control-label">
                    <span class="control-name">Light Position Y</span>
                    <span class="control-value" id="light-position-y-value">${this.lightParams.position.y.toFixed(1)}</span>
                </div>
                <input type="range" id="light-position-y" class="slider" min="5" max="50" step="1" value="${this.lightParams.position.y}">
            </div>
            
            <div class="control-group">
                <div class="control-label">
                    <span class="control-name">Light Position Z</span>
                    <span class="control-value" id="light-position-z-value">${this.lightParams.position.z.toFixed(1)}</span>
                </div>
                <input type="range" id="light-position-z" class="slider" min="-30" max="30" step="1" value="${this.lightParams.position.z}">
            </div>
            
            <div class="control-group">
                <div class="control-label">
                    <span class="control-name">Cast Shadows</span>
                    <label class="switch texture-switch">
                        <input type="checkbox" id="light-cast-shadows" ${this.lightParams.castShadow ? 'checked' : ''}>
                        <span class="slider-switch"></span>
                    </label>
                </div>
            </div>
        `;
        
        // Add to settings panel
        settingsPanel.insertBefore(lightSection, document.getElementById('reset-button').parentNode);
    }
    
    /**
     * Setup event listeners for light controls
     */
    setupEventListeners() {
        // Light intensity slider
        const intensitySlider = document.getElementById('light-intensity');
        const intensityValue = document.getElementById('light-intensity-value');
        
        if (intensitySlider && intensityValue) {
            intensitySlider.addEventListener('input', () => {
                const newValue = parseFloat(intensitySlider.value);
                intensityValue.textContent = newValue.toFixed(2);
                this.lightParams.intensity = newValue;
                this.updateLight();
            });
        }
        
        // Light position X slider
        const positionXSlider = document.getElementById('light-position-x');
        const positionXValue = document.getElementById('light-position-x-value');
        
        if (positionXSlider && positionXValue) {
            positionXSlider.addEventListener('input', () => {
                const newValue = parseFloat(positionXSlider.value);
                positionXValue.textContent = newValue.toFixed(1);
                this.lightParams.position.x = newValue;
                this.updateLight();
            });
        }
        
        // Light position Y slider
        const positionYSlider = document.getElementById('light-position-y');
        const positionYValue = document.getElementById('light-position-y-value');
        
        if (positionYSlider && positionYValue) {
            positionYSlider.addEventListener('input', () => {
                const newValue = parseFloat(positionYSlider.value);
                positionYValue.textContent = newValue.toFixed(1);
                this.lightParams.position.y = newValue;
                this.updateLight();
            });
        }
        
        // Light position Z slider
        const positionZSlider = document.getElementById('light-position-z');
        const positionZValue = document.getElementById('light-position-z-value');
        
        if (positionZSlider && positionZValue) {
            positionZSlider.addEventListener('input', () => {
                const newValue = parseFloat(positionZSlider.value);
                positionZValue.textContent = newValue.toFixed(1);
                this.lightParams.position.z = newValue;
                this.updateLight();
            });
        }
        
        // Cast shadows toggle
        const castShadowsToggle = document.getElementById('light-cast-shadows');
        
        if (castShadowsToggle) {
            castShadowsToggle.addEventListener('change', () => {
                this.lightParams.castShadow = castShadowsToggle.checked;
                this.light.castShadow = this.lightParams.castShadow;
            });
        }
    }
}
