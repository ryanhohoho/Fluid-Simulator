/**
 * UIController class
 * handles user interactions, ui updates, and input processing
 */
class UIController {
    constructor(simulation) {
        this.simulation = simulation;
        this.statusElement = document.getElementById('status');
        this.modeIndicator = document.getElementById('mode-indicator');
        this.cutIndicator = document.getElementById('cut-indicator');
        
        // setup UI event listeners
        this.setupUIControls();
        this.setupKeyboardControls();
        this.setupMouseEvents();
        this.setupHelpModal();
        
        // raycaster for converting mouse position to 3D coordinates
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        // cutting state
        this.cutStartPosition = null;
        this.cutEndPosition = null;
        this.isCutting = false;
    }
    
    /**
     * update the status message
     */
    updateStatus(message) {
        if (this.statusElement) {
            this.statusElement.textContent = message;
        }
    }
    
    /**
     * update the mode indicator
     */
    updateModeIndicator() {
        if (this.modeIndicator) {
            if (this.simulation.interactionMode === 'camera') {
                this.modeIndicator.textContent = 'CAMERA MODE';
                this.cutIndicator.classList.remove('active');
            } else {
                this.modeIndicator.textContent = 'CUTTING MODE';
                this.cutIndicator.classList.add('active');
            }
        }
    }
    
    /**
     * setup keyboard controls
     */
    setupKeyboardControls() {
        document.addEventListener('keydown', (event) => {
            if (event.code === 'Space') {
                event.preventDefault(); // prevent page scrolling
                
                // toggle interaction mode
                this.simulation.interactionMode = (this.simulation.interactionMode === 'camera') ? 'cutting' : 'camera';
                
                // update controls
                if (this.simulation.sceneManager.controls) {
                    this.simulation.sceneManager.controls.enabled = (this.simulation.interactionMode === 'camera');
                }
                
                // update display
                this.updateModeIndicator();
            } else if (event.code === 'KeyR') {
                // reset simulation
                this.simulation.resetSimulation();
            } else if (event.code === 'Escape') {
                // cancel current cut if in cutting mode
                if (this.simulation.interactionMode === 'cutting' && this.isCutting) {
                    this.cancelCut();
                }
            }
        });
    }
    
    /**
     * setup mouse events
     */
    setupMouseEvents() {
        const canvas = this.simulation.sceneManager.renderer.domElement;
        
        // setup mouse event handlers
        canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
        canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
        canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
        canvas.addEventListener('mouseleave', this.onMouseLeave.bind(this));
        
        // touch events
        canvas.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: false });
        canvas.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false });
        canvas.addEventListener('touchend', this.onTouchEnd.bind(this));
    }
    
    /**
     * handle mouse move event
     */
    onMouseMove(event) {
        // skip if over a UI element
        if (this.isOverUIElement(event)) return;
        
        // update mouse position in normalized device coordinates (-1 to +1)
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        
        // if in cutting mode, update cutting visualization
        if (this.simulation.interactionMode === 'cutting') {
            this.updateCutPreview();
        }
    }
    
    /**
     * handle mouse down event
     */
    onMouseDown(event) {
        // skip if over a UI element
        if (this.isOverUIElement(event)) return;
        
        // if in cutting mode, start a cut
        if (this.simulation.interactionMode === 'cutting' && event.button === 0) {
            this.startCut();
        }
    }
    
    /**
     * handle mouse up event
     */
    onMouseUp(event) {
        // if in cutting mode, complete the cut
        if (this.simulation.interactionMode === 'cutting' && event.button === 0 && this.isCutting) {
            this.completeCut();
        }
    }
    
    /**
     * handle mouse leave event
     */
    onMouseLeave() {
        // cancel current cut if in cutting mode
        if (this.simulation.interactionMode === 'cutting' && this.isCutting) {
            this.cancelCut();
        }
    }
    
    /**
     * handle touch start event
     */
    onTouchStart(event) {
        event.preventDefault();
        
        // skip if over a UI element
        if (this.isOverUIElement(event.touches[0])) return;
        
        // normalize touch position
        this.mouse.x = (event.touches[0].clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.touches[0].clientY / window.innerHeight) * 2 + 1;
        
        // if in cutting mode, start a cut
        if (this.simulation.interactionMode === 'cutting') {
            this.startCut();
        }
    }
    
    /**
     * handle touch move event
     */
    onTouchMove(event) {
        event.preventDefault();
        
        // normalize touch position
        this.mouse.x = (event.touches[0].clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.touches[0].clientY / window.innerHeight) * 2 + 1;
        
        // if in cutting mode, update cutting visualization
        if (this.simulation.interactionMode === 'cutting' && this.isCutting) {
            this.updateCutPreview();
        }
    }
    
    /**
     * handle touch end event
     */
    onTouchEnd(event) {
        // if in cutting mode, complete the cut
        if (this.simulation.interactionMode === 'cutting' && this.isCutting) {
            this.completeCut();
        }
    }
    
    /**
     * check if the pointer is over a UI element
     */
    isOverUIElement(event) {
        let clientX, clientY;
        
        if (event.clientX !== undefined) {
            // it's a mouse event
            clientX = event.clientX;
            clientY = event.clientY;
        } else if (event.touches && event.touches[0]) {
            // it's a touch event
            clientX = event.touches[0].clientX;
            clientY = event.touches[0].clientY;
        } else {
            return false;
        }
        
        // Use utility function for better element detection
        return Utils.isPointOverUI(clientX, clientY);
    }
    
    /**
     * get 3D position from mouse coordinates
     */
    get3DPosition() {
        // set up raycaster from mouse position
        this.raycaster.setFromCamera(this.mouse, this.simulation.sceneManager.camera);
        
        // check for intersection with paper
        const paperMesh = this.simulation.paperManager.paperMesh;
        
        if (paperMesh) {
            const intersects = this.raycaster.intersectObject(paperMesh);
            
            if (intersects.length > 0) {
                return intersects[0].point;
            }
        }
        
        return null;
    }
    
    /**
     * start a cut at the current mouse position
     */
    startCut() {
        const position = this.get3DPosition();
        
        if (position) {
            this.cutStartPosition = position;
            this.cutEndPosition = position.clone();
            this.isCutting = true;
            
            // Get paper normal at intersection point
            const paperMesh = this.simulation.paperManager.paperMesh;
            const raycaster = this.raycaster;
            const intersects = raycaster.intersectObject(paperMesh);
            
            let normal = new THREE.Vector3(0, 0, 1); // default normal
            
            if (intersects.length > 0 && intersects[0].face) {
                normal = intersects[0].face.normal.clone();
                // Transform normal to world space
                normal.transformDirection(paperMesh.matrixWorld);
            }
            
            // Start cutting with blade
            this.simulation.paperCutter.startCutting(position, normal);
            
            // Update blade position
            this.simulation.paperCutter.updateBladePosition(position, normal);
            
            // update status
            this.updateStatus('Cutting paper with blade...');
        }
    }
    
    /**
     * update the cut as the mouse/blade moves
     */
    updateCutPreview() {
        if (!this.isCutting) return;
        
        const position = this.get3DPosition();
        
        if (position) {
            // Calculate movement from last position
            const lastEndPosition = this.cutEndPosition?.clone() || null;
            this.cutEndPosition = position;
            
            // Get paper normal at intersection point
            const paperMesh = this.simulation.paperManager.paperMesh;
            const raycaster = this.raycaster;
            const intersects = raycaster.intersectObject(paperMesh);
            
            let normal = new THREE.Vector3(0, 0, 1); // default normal
            
            if (intersects.length > 0 && intersects[0].face) {
                normal = intersects[0].face.normal.clone();
                // Transform normal to world space
                normal.transformDirection(paperMesh.matrixWorld);
            }
            
            // Update blade position and orientation
            this.simulation.paperCutter.updateBladePosition(position, normal);
            
            // Detect if we've moved far enough for a continuous cut
            if (lastEndPosition && lastEndPosition.distanceTo(position) > 0.01) {
                // Track movement direction for blade orientation
                const moveDirection = new THREE.Vector3().subVectors(
                    position, lastEndPosition
                ).normalize();
                
                // Apply cutting forces gradually along the path
                this.simulation.paperCutter.performCutAtPosition(position, moveDirection);
            }
        }
    }
    
    /**
     * complete the cut with the current end position
     */
    completeCut() {
        if (!this.isCutting) return;
        
        // make sure we have valid cut positions
        if (this.cutStartPosition && this.cutEndPosition) {
            // check if the cut is long enough
            const cutLength = this.cutStartPosition.distanceTo(this.cutEndPosition);
            
            if (cutLength > 0.05) {
                // Finish the cutting process
                this.simulation.paperCutter.finishCutting();
                
                // update status
                this.updateStatus('Paper cut complete');
            } else {
                // cut was too short
                this.updateStatus('Cut was too short - try again');
            }
        }
        
        // reset cutting state
        this.isCutting = false;
        this.cutStartPosition = null;
        this.cutEndPosition = null;
    }
    
    /**
     * cancel the current cut operation
     */
    cancelCut() {
        // reset cutting state
        this.isCutting = false;
        this.cutStartPosition = null;
        this.cutEndPosition = null;
        
        // hide blade and indicators
        this.simulation.paperCutter.hideBladeAndIndicators();
        
        // update status
        this.updateStatus('Cut cancelled');
    }
    
    /**
     * setup UI controls
     */
    setupUIControls() {
        // set up UI controls
        this.controls = {
            // paper properties
            paperSize: document.getElementById('paper-size'),
            paperSizeValue: document.getElementById('paper-size-value'),
            paperThickness: document.getElementById('paper-thickness'),
            paperThicknessValue: document.getElementById('paper-thickness-value'),
            
            // physics properties
            gravity: document.getElementById('gravity'),
            gravityValue: document.getElementById('gravity-value'),
            airResistance: document.getElementById('air-resistance'),
            airResistanceValue: document.getElementById('air-resistance-value'),
            stiffness: document.getElementById('stiffness'),
            stiffnessValue: document.getElementById('stiffness-value'),
            
            // cutting tool properties
            cutWidth: document.getElementById('cut-width'),
            cutWidthValue: document.getElementById('cut-width-value'),
            
            // buttons
            resetButton: document.getElementById('reset-button'),
            resetSimulationButton: document.getElementById('reset-simulation'),
            
            // theme toggle
            themeToggle: document.getElementById('theme-toggle'),
            
            // paper texture options
            textureOptions: document.querySelectorAll('.texture-option'),
            
            // cut color options
            colorOptions: document.querySelectorAll('.color-option')
        };
        
        // initialize sliders with current values
        if (this.controls.paperSize) {
            this.controls.paperSize.addEventListener('input', () => {
                const value = parseFloat(this.controls.paperSize.value);
                this.controls.paperSizeValue.textContent = value.toFixed(2);
                this.simulation.params.paperSize = value;
                
                // flag paper for resize on next update
                this.simulation.paperSizeChanged = true;
            });
        }
        
        if (this.controls.paperThickness) {
            this.controls.paperThickness.addEventListener('input', () => {
                const value = parseFloat(this.controls.paperThickness.value);
                this.controls.paperThicknessValue.textContent = value.toFixed(3);
                this.simulation.params.paperThickness = value;
                
                // flag paper thickness for update
                this.simulation.paperThicknessChanged = true;
            });
        }
        
        if (this.controls.gravity) {
            this.controls.gravity.addEventListener('input', () => {
                const value = parseFloat(this.controls.gravity.value);
                this.controls.gravityValue.textContent = value.toFixed(1);
                this.simulation.params.gravity = value;
                
                // update physics engine
                this.simulation.physicsEngine.updateParameters({
                    gravity: value
                });
            });
        }
        
        if (this.controls.airResistance) {
            this.controls.airResistance.addEventListener('input', () => {
                const value = parseFloat(this.controls.airResistance.value);
                this.controls.airResistanceValue.textContent = value.toFixed(2);
                this.simulation.params.airResistance = value;
                
                // update physics engine
                this.simulation.physicsEngine.updateParameters({
                    airResistance: value
                });
            });
        }
        
        if (this.controls.stiffness) {
            this.controls.stiffness.addEventListener('input', () => {
                const value = parseFloat(this.controls.stiffness.value);
                this.controls.stiffnessValue.textContent = value.toFixed(1);
                this.simulation.params.stiffness = value;
            });
        }
        
        if (this.controls.cutWidth) {
            this.controls.cutWidth.addEventListener('input', () => {
                const value = parseFloat(this.controls.cutWidth.value);
                this.controls.cutWidthValue.textContent = value.toFixed(2);
                this.simulation.params.cutWidth = value;
                
                // update paper cutter
                this.simulation.paperCutter.setCutWidth(value);
            });
        }
        
        // reset buttons
        if (this.controls.resetButton) {
            this.controls.resetButton.addEventListener('click', () => {
                this.simulation.resetSimulation();
            });
        }
        
        if (this.controls.resetSimulationButton) {
            this.controls.resetSimulationButton.addEventListener('click', () => {
                this.simulation.resetSimulation();
            });
        }
        
        // theme toggle
        if (this.controls.themeToggle) {
            this.controls.themeToggle.addEventListener('change', () => {
                const isDark = !this.controls.themeToggle.checked;
                this.updateTheme(isDark ? 'dark' : 'light');
            });
            
            // initialize theme based on saved preference
            const savedTheme = localStorage.getItem('theme') || 'dark';
            this.controls.themeToggle.checked = savedTheme === 'light';
            this.updateTheme(savedTheme);
        }
        
        // paper texture options
        if (this.controls.textureOptions) {
            this.controls.textureOptions.forEach(option => {
                option.addEventListener('click', () => {
                    // remove selected class from all options
                    this.controls.textureOptions.forEach(opt => {
                        opt.classList.remove('selected');
                    });
                    
                    // add selected class to clicked option
                    option.classList.add('selected');
                    
                    // get texture type
                    const textureType = option.getAttribute('data-texture');
                    
                    // update paper texture
                    this.simulation.params.paperTexture = textureType;
                    this.simulation.paperManager.updatePaperTexture(textureType);
                });
            });
        }
        
        // cut color options
        if (this.controls.colorOptions) {
            this.controls.colorOptions.forEach(option => {
                option.addEventListener('click', () => {
                    // remove selected class from all options
                    this.controls.colorOptions.forEach(opt => {
                        opt.classList.remove('selected');
                    });
                    
                    // add selected class to clicked option
                    option.classList.add('selected');
                    
                    // get color value
                    const colorValue = option.getAttribute('data-color');
                    
                    // update cut color
                    this.simulation.params.cutColor = colorValue;
                    this.simulation.paperCutter.setCutColor(colorValue);
                });
            });
        }
        
        // settings panel toggle
        const toggleSettingsBtn = document.getElementById('toggle-settings');
        const settingsPanel = document.getElementById('settings-panel');
        const collapseButton = document.getElementById('collapse-button');
        
        if (toggleSettingsBtn && settingsPanel && collapseButton) {
            let settingsPanelVisible = true;
            
            toggleSettingsBtn.addEventListener('click', () => {
                if (settingsPanelVisible) {
                    settingsPanel.style.transform = 'translateX(350px)';
                    settingsPanelVisible = false;
                } else {
                    settingsPanel.style.transform = 'translateX(0)';
                    settingsPanelVisible = true;
                }
            });
            
            collapseButton.addEventListener('click', () => {
                settingsPanel.style.transform = 'translateX(350px)';
                settingsPanelVisible = false;
            });
        }
    }
    
    /**
     * setup help modal
     */
    setupHelpModal() {
        const helpButton = document.getElementById('help-button');
        const helpModal = document.getElementById('help-modal');
        const closeButton = helpModal ? helpModal.querySelector('.close-button') : null;
        
        if (helpButton && helpModal && closeButton) {
            helpButton.addEventListener('click', () => {
                helpModal.classList.add('active');
            });
            
            closeButton.addEventListener('click', () => {
                helpModal.classList.remove('active');
            });
            
            // close modal when clicking outside content
            helpModal.addEventListener('click', (event) => {
                if (event.target === helpModal) {
                    helpModal.classList.remove('active');
                }
            });
            
            // close modal on escape key
            document.addEventListener('keydown', (event) => {
                if (event.key === 'Escape' && helpModal.classList.contains('active')) {
                    helpModal.classList.remove('active');
                }
            });
        }
    }
    
    /**
     * update the theme
     */
    updateTheme(theme) {
        // save theme preference
        localStorage.setItem('theme', theme);
        
        // update document theme
        if (theme === 'light') {
            document.documentElement.setAttribute('data-theme', 'light');
        } else {
            document.documentElement.removeAttribute('data-theme');
        }
        
        // dispatch theme change event for other components
        const event = new CustomEvent('themeChange', {
            detail: { theme: theme }
        });
        document.dispatchEvent(event);
    }
}