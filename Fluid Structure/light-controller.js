/**
 * LightController class
 * Handles creation and control of a moveable light source
 * Features:
 * - Interactive dragging of light by clicking and moving the yellow sphere
 * - Toggle between directional and point light types
 * - Color picker for customizing light color
 * - No collision with container - can be placed anywhere
 * - Button to hide light visuals while keeping illumination
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
            castShadow: true,
            type: 'directional', // 'directional' or 'point'
            visible: true // visibility of helpers and handles
        };
        
        // Dragging state
        this.isDraggingLight = false;
        
        // Create the light
        this.createLight();
        
        // Create drag handle for light
        this.createDragHandle();
        
        // Setup UI controls
        this.setupControls();
        
        // Setup dragging functionality
        this.setupDragging();
    }
    
    /**
     * Create the light based on current type
     */
    createLight() {
        // Remove any existing main light
        if (this.light) {
            this.scene.remove(this.light);
            if (this.lightHelper) {
                this.scene.remove(this.lightHelper);
            }
        }
        
        // Create light based on type
        if (this.lightParams.type === 'directional') {
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
            
            // Create directional light helper
            this.lightHelper = new THREE.DirectionalLightHelper(this.light, 5);
            this.lightHelper.visible = this.lightParams.visible;
            this.scene.add(this.lightHelper);
        } else {
            // Create point light (spherical)
            this.light = new THREE.PointLight(
                this.lightParams.color,
                this.lightParams.intensity,
                100, // distance
                1.0  // decay
            );
            this.light.position.copy(this.lightParams.position);
            this.light.castShadow = this.lightParams.castShadow;
            
            // Setup shadow properties
            this.light.shadow.mapSize.width = 1024;
            this.light.shadow.mapSize.height = 1024;
            
            // Create point light helper
            this.lightHelper = new THREE.PointLightHelper(this.light, 1);
            this.lightHelper.visible = this.lightParams.visible;
            this.scene.add(this.lightHelper);
        }
        
        // Add light to scene
        this.scene.add(this.light);
    }
    
    /**
     * Create draggable handle for light positioning
     */
    createDragHandle() {
        // remove existing handle if any
        if (this.dragHandle) {
            this.scene.remove(this.dragHandle);
        }
        
        // create a more visually appealing sphere for dragging
        const geometry = new THREE.SphereGeometry(2, 32, 32);
        const material = new THREE.MeshPhysicalMaterial({
            color: 0xefc941,
            metalness: 0.3,
            roughness: 0.2,
            transparent: true,
            opacity: 0.9,
            emissive: 0xefc941,
            emissiveIntensity: 0.4,
            depthTest: false
        });
        
        this.dragHandle = new THREE.Mesh(geometry, material);
        this.dragHandle.position.copy(this.lightParams.position);
        this.dragHandle.renderOrder = 1000; // ensure it renders on top
        this.dragHandle.visible = this.lightParams.visible;
        
        // Don't include in container - add directly to scene
        this.scene.add(this.dragHandle);
    }
    
    /**
     * Update light parameters
     */
    updateLight() {
        this.light.position.copy(this.lightParams.position);
        this.light.intensity = this.lightParams.intensity;
        this.light.color.set(this.lightParams.color);
        
        // Update draggable handle position
        if (this.dragHandle) {
            this.dragHandle.position.copy(this.lightParams.position);
            this.dragHandle.visible = this.lightParams.visible;
        }
        
        // Update the helper
        if (this.lightHelper) {
            this.lightHelper.visible = this.lightParams.visible;
            this.lightHelper.update();
        }
    }
    
    /**
     * Setup dragging functionality
     */
    setupDragging() {
        const renderer = this.simulation.sceneManager.renderer;
        const camera = this.simulation.sceneManager.camera;
        
        // raycaster for object selection
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();
        
        // create invisible plane for dragging in 3D space
        const dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1));
        
        renderer.domElement.addEventListener('mousemove', (event) => {
            // skip if over UI or not in camera mode or light is hidden
            if (this.isOverUIElement(event) || 
                this.simulation.interactionMode !== 'camera' ||
                !this.lightParams.visible) return;
            
            // update mouse position
            mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
            
            // check for hover
            raycaster.setFromCamera(mouse, camera);
            const intersects = raycaster.intersectObject(this.dragHandle);
            
            if (intersects.length > 0) {
                document.body.style.cursor = this.isDraggingLight ? 'grabbing' : 'grab';
                // highlight the handle
                this.dragHandle.material.opacity = 0.9;
            } else if (!this.isDraggingLight) {
                document.body.style.cursor = 'auto';
                this.dragHandle.material.opacity = 0.7;
            }
            
            // handle dragging
            if (this.isDraggingLight) {
                // update the plane normal to face the camera
                dragPlane.normal.copy(camera.getWorldDirection(new THREE.Vector3()).negate());
                
                // cast ray and find intersection with drag plane
                raycaster.setFromCamera(mouse, camera);
                const intersectionPoint = new THREE.Vector3();
                raycaster.ray.intersectPlane(dragPlane, intersectionPoint);
                
                // update light position - no restrictions so it can go anywhere
                this.lightParams.position.copy(intersectionPoint);
                this.updateLight();
            }
        });
        
        renderer.domElement.addEventListener('mousedown', (event) => {
            // skip if over UI or not in camera mode or light is hidden
            if (this.isOverUIElement(event) || 
                this.simulation.interactionMode !== 'camera' ||
                !this.lightParams.visible) return;
            
            // update mouse and check for intersection with drag handle
            mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
            
            raycaster.setFromCamera(mouse, camera);
            const intersects = raycaster.intersectObject(this.dragHandle);
            
            if (intersects.length > 0) {
                this.isDraggingLight = true;
                document.body.style.cursor = 'grabbing';
                
                // position the drag plane at the light position
                dragPlane.constant = -this.lightParams.position.dot(dragPlane.normal);
                
                // prevent camera orbit controls while dragging
                if (this.simulation.sceneManager.controls) {
                    this.simulation.sceneManager.controls.enabled = false;
                }
            }
        });
        
        // handle mouseup globally
        document.addEventListener('mouseup', () => {
            if (this.isDraggingLight) {
                this.isDraggingLight = false;
                document.body.style.cursor = 'auto';
                
                // re-enable orbit controls
                if (this.simulation.sceneManager.controls) {
                    this.simulation.sceneManager.controls.enabled = true;
                }
            }
        });
    }
    
    /**
     * Helper to check if mouse is over UI elements
     */
    isOverUIElement(event) {
        const elements = [
            document.querySelector('.navbar'),
            document.querySelector('.info-panel'),
            document.querySelector('.settings-panel'),
            document.querySelector('.footer')
        ];
        
        for (const element of elements) {
            if (element) {
                const rect = element.getBoundingClientRect();
                if (
                    event.clientX >= rect.left && 
                    event.clientX <= rect.right && 
                    event.clientY >= rect.top && 
                    event.clientY <= rect.bottom
                ) {
                    return true;
                }
            }
        }
        
        return false;
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
            <div class="section-title">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="5"></circle>
                    <line x1="12" y1="1" x2="12" y2="3"></line>
                    <line x1="12" y1="21" x2="12" y2="23"></line>
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                    <line x1="1" y1="12" x2="3" y2="12"></line>
                    <line x1="21" y1="12" x2="23" y2="12"></line>
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                </svg>
                Light Controls
            </div>
            
            <div class="control-group">
                <div class="control-label">
                    <span class="control-name">Light Type</span>
                    <label class="switch texture-switch">
                        <input type="checkbox" id="light-type">
                        <span class="slider-switch"></span>
                    </label>
                </div>
                <div class="light-type-label" id="light-type-label">Directional</div>
            </div>
            
            <div class="control-group">
                <div class="control-label">
                    <span class="control-name">Light Intensity</span>
                    <span class="control-value" id="light-intensity-value">${this.lightParams.intensity.toFixed(2)}</span>
                </div>
                <input type="range" id="light-intensity" class="slider" min="0" max="2" step="0.1" value="${this.lightParams.intensity}">
            </div>
            
            <div class="control-group">
                <div class="control-label">
                    <span class="control-name">Light Color</span>
                </div>
                <div class="color-control">
                    <div class="color-preview" id="color-preview"></div>
                    <input type="color" id="color-picker" value="#ffffff">
                    <div class="color-hex" id="color-hex-value">#FFFFFF</div>
                </div>
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
            
            <div class="control-group">
                <div class="control-label">
                    <span class="control-name">Show Light</span>
                    <label class="switch texture-switch">
                        <input type="checkbox" id="light-visible" checked>
                        <span class="slider-switch"></span>
                    </label>
                </div>
                <div class="light-type-label">Hide visual components only</div>
            </div>
            
            <div class="control-group">
                <div class="drag-hint">
                    <small>• Drag the yellow sphere to move the light</small>
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
        
        // Light type toggle
        const typeToggle = document.getElementById('light-type');
        const typeLabel = document.getElementById('light-type-label');
        
        if (typeToggle && typeLabel) {
            typeToggle.addEventListener('change', () => {
                this.lightParams.type = typeToggle.checked ? 'point' : 'directional';
                typeLabel.textContent = typeToggle.checked ? 'Point (Spherical)' : 'Directional';
                
                // recreate light with new type
                this.createLight();
                this.updateLight();
            });
        }
        
        // Light visibility toggle
        const visibleToggle = document.getElementById('light-visible');
        
        if (visibleToggle) {
            visibleToggle.addEventListener('change', () => {
                this.lightParams.visible = visibleToggle.checked;
                this.updateLight();
            });
        }
        
        // Color picker with real-time updates
        const colorPicker = document.getElementById('color-picker');
        const colorPreview = document.getElementById('color-preview');
        const colorHexValue = document.getElementById('color-hex-value');
        
        if (colorPicker && colorPreview && colorHexValue) {
            // set initial color
            const initialColor = '#' + this.lightParams.color.toString(16).padStart(6, '0').toUpperCase();
            colorPicker.value = initialColor;
            colorPreview.style.backgroundColor = initialColor;
            colorHexValue.textContent = initialColor;
            
            // update color in real-time as the picker changes
            colorPicker.addEventListener('input', () => {
                // convert hex string to integer
                const hexColor = colorPicker.value.replace('#', '');
                const colorInt = parseInt(hexColor, 16);
                
                // update light color instantly
                this.lightParams.color = colorInt;
                this.updateLight();
                
                // update preview and hex display
                colorPreview.style.backgroundColor = colorPicker.value;
                colorHexValue.textContent = colorPicker.value.toUpperCase();
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