/**
 * UIController class
 * Handles all UI elements and user interactions for the simulation
 */
class UIController {
    constructor(simulation) {
        this.simulation = simulation;
        this.statusElement = document.getElementById('status');
        this.modeIndicator = document.getElementById('mode-indicator');
        
        this.setupUIControls();
        this.setupKeyboardControls();
        this.setupMouseEvents();
    }
    
    updateStatus(message) {
        if (this.statusElement) {
            this.statusElement.textContent = message;
        }
        console.log(message);
    }
    
    updateModeIndicator() {
        if (this.modeIndicator) {
            if (this.simulation.interactionMode === 'camera') {
                this.modeIndicator.textContent = 'CAMERA MODE';
            } else {
                this.modeIndicator.textContent = 'INTERACTION MODE';
            }
        }
    }
    
    setupKeyboardControls() {
        // set up keyboard controls for toggling interaction mode
        document.addEventListener('keydown', (event) => {
            if (event.code === 'Space') {
                event.preventDefault(); // prevent page scrolling
                
                // toggle interaction mode
                this.simulation.interactionMode = (this.simulation.interactionMode === 'camera') ? 'interaction' : 'camera';
                
                // update controls
                if (this.simulation.sceneManager.controls) {
                    this.simulation.sceneManager.controls.enabled = (this.simulation.interactionMode === 'camera');
                }
                
                // update display
                this.updateModeIndicator();
            }
        });
    }
    
    setupMouseEvents() {
        const renderer = this.simulation.sceneManager.renderer;
        
        // set up mouse event handlers
        renderer.domElement.addEventListener('mousemove', this.onMouseMove.bind(this));
        renderer.domElement.addEventListener('mousedown', this.onMouseDown.bind(this));
        document.addEventListener('mouseup', this.onMouseUp.bind(this));
    }
    
    onMouseMove(event) {
        // skip if we're over a UI element
        if (this.isOverUIElement(event)) return;
        
        // calculate mouse position in normalized device coordinates (-1 to +1)
        this.simulation.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.simulation.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        
        // if in interaction mode, handle mouse interaction with particles
        if (this.simulation.interactionMode === 'interaction') {
            // save previous position
            this.simulation.prevMousePosition3D.copy(this.simulation.mousePosition3D);
            
            // cast ray from camera
            this.simulation.raycaster.setFromCamera(this.simulation.mouse, this.simulation.sceneManager.camera);
            
            // update intersection plane to face camera
            this.simulation.intersectionPlane.normal.copy(
                this.simulation.sceneManager.camera.getWorldDirection(new THREE.Vector3()).negate()
            );
            
            // find intersection with the plane
            const intersects = new THREE.Vector3();
            if (this.simulation.raycaster.ray.intersectPlane(this.simulation.intersectionPlane, intersects)) {
                this.simulation.mousePosition3D.copy(intersects);
                
                // calculate velocity - limited to prevent explosions
                this.simulation.mouseVelocity.subVectors(
                    this.simulation.mousePosition3D, 
                    this.simulation.prevMousePosition3D
                );
                
                // limit mouse velocity to prevent explosions
                const maxMouseVel = 1.5;
                const mouseVelLength = this.simulation.mouseVelocity.length();
                if (mouseVelLength > maxMouseVel) {
                    this.simulation.mouseVelocity.multiplyScalar(maxMouseVel / mouseVelLength);
                }
                
                // if dragging an object, update its position
                if (this.simulation.objectLoader.isDraggingObject) {
                    this.simulation.objectLoader.updateDragging(this.simulation.mousePosition3D);
                }
            }
        }
    }
    
    onMouseDown(event) {
        // skip if we're over a UI element
        if (this.isOverUIElement(event)) return;
        
        // if in interaction mode
        if (this.simulation.interactionMode === 'interaction') {
            this.simulation.isMouseDown = true;
            
            // check if we're clicking on an object
            this.simulation.raycaster.setFromCamera(
                this.simulation.mouse, 
                this.simulation.sceneManager.camera
            );
            
            // create an array of meshes to check for intersections
            const objectMeshes = this.simulation.objectLoader.objects.map(obj => obj.mesh);
            
            // raycasting - check for intersection with object meshes
            const intersects = this.simulation.raycaster.intersectObjects(objectMeshes, true);
            
            if (intersects.length > 0) {
                // find the parent object of the intersected mesh
                let hitMesh = intersects[0].object;
                
                // get the top-level object
                while (hitMesh.parent && !objectMeshes.includes(hitMesh)) {
                    hitMesh = hitMesh.parent;
                }
                
                // find the corresponding object in our objects array
                const selectedObject = this.simulation.objectLoader.objects.find(obj => obj.mesh === hitMesh);
                
                if (selectedObject) {
                    // select the object
                    this.simulation.objectLoader.selectObject(selectedObject.id);
                    
                    // start dragging the object
                    this.simulation.objectLoader.startDragging(
                        selectedObject, 
                        this.simulation.mousePosition3D
                    );
                    
                    return; // skip regular mouse interaction
                }
            }
            
            // update mouse position if not dragging an object
            this.onMouseMove(event);
        }
    }
    
    onMouseUp() {
        this.simulation.isMouseDown = false;
        
        // if we were dragging an object, apply velocity based on motion
        if (this.simulation.objectLoader.isDraggingObject) {
            this.simulation.objectLoader.endDragging(this.simulation.mouseVelocity);
        }
    }
    
    // helper function to check if mouse is over UI elements
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
    
    setupUIControls() {
        // set up UI controls
        const controls = {
            // appearance
            particleSize: document.getElementById('particle-size'),
            particleSizeValue: document.getElementById('particle-size-value'),
            particleCount: document.getElementById('particle-count'),
            particleCountValue: document.getElementById('particle-count-value'),
            containerSize: document.getElementById('container-size'),
            containerSizeValue: document.getElementById('container-size-value'),
            
            // physics
            gravity: document.getElementById('gravity'),
            gravityValue: document.getElementById('gravity-value'),
            energyLoss: document.getElementById('energy-loss'),
            energyLossValue: document.getElementById('energy-loss-value'),
            friction: document.getElementById('friction'),
            frictionValue: document.getElementById('friction-value'),
            repulsion: document.getElementById('repulsion'),
            repulsionValue: document.getElementById('repulsion-value'),
            speedLimit: document.getElementById('speed-limit'),
            speedLimitValue: document.getElementById('speed-limit-value'),
            
            // interaction
            mouseRadius: document.getElementById('mouse-radius'),
            mouseRadiusValue: document.getElementById('mouse-radius-value'),
            mouseStrength: document.getElementById('mouse-strength'),
            mouseStrengthValue: document.getElementById('mouse-strength-value'),
            
            // buttons
            resetButton: document.getElementById('reset-button')
        };
        
        // initialize sliders with current values
        controls.particleSize.value = this.simulation.params.particleSize;
        controls.particleSizeValue.textContent = this.simulation.params.particleSize.toFixed(2);
        
        controls.particleCount.value = this.simulation.params.particleCount;
        controls.particleCountValue.textContent = this.simulation.params.particleCount;
        
        controls.containerSize.value = this.simulation.params.containerSize;
        controls.containerSizeValue.textContent = this.simulation.params.containerSize.toFixed(1);
        
        controls.gravity.value = this.simulation.params.gravity;
        controls.gravityValue.textContent = this.simulation.params.gravity.toFixed(2);
        
        controls.energyLoss.value = this.simulation.params.energyLoss;
        controls.energyLossValue.textContent = this.simulation.params.energyLoss.toFixed(2);
        
        controls.friction.value = this.simulation.params.friction;
        controls.frictionValue.textContent = this.simulation.params.friction.toFixed(2);
        
        controls.repulsion.value = this.simulation.params.repulsion;
        controls.repulsionValue.textContent = this.simulation.params.repulsion.toFixed(2);
        
        controls.speedLimit.value = this.simulation.params.speedLimit;
        controls.speedLimitValue.textContent = this.simulation.params.speedLimit.toFixed(2);
        
        controls.mouseRadius.value = this.simulation.params.mouseRadius;
        controls.mouseRadiusValue.textContent = this.simulation.params.mouseRadius.toFixed(1);
        
        controls.mouseStrength.value = this.simulation.params.mouseStrength;
        controls.mouseStrengthValue.textContent = this.simulation.params.mouseStrength.toFixed(2);
        
        // set up event listeners for controls
        controls.particleSize.addEventListener('input', () => {
            const newValue = parseFloat(controls.particleSize.value);
            controls.particleSizeValue.textContent = newValue.toFixed(2);
            this.simulation.params.particleSize = newValue;
            this.simulation.recreateParticlesNeeded = true;
        });
        
        controls.particleCount.addEventListener('input', () => {
            const newValue = parseInt(controls.particleCount.value);
            controls.particleCountValue.textContent = newValue;
            this.simulation.params.particleCount = newValue;
            this.simulation.recreateParticlesNeeded = true;
        });
        
        controls.containerSize.addEventListener('input', () => {
            const newValue = parseFloat(controls.containerSize.value);
            controls.containerSizeValue.textContent = newValue.toFixed(1);
            this.simulation.params.containerSize = newValue;
            this.simulation.params.boundSize = newValue; // update bound size as well
            this.simulation.recreateContainerNeeded = true;
        });
        
        controls.gravity.addEventListener('input', () => {
            const newValue = parseFloat(controls.gravity.value);
            controls.gravityValue.textContent = newValue.toFixed(2);
            this.simulation.params.gravity = newValue;
        });
        
        controls.energyLoss.addEventListener('input', () => {
            const newValue = parseFloat(controls.energyLoss.value);
            controls.energyLossValue.textContent = newValue.toFixed(2);
            this.simulation.params.energyLoss = newValue;
        });
        
        controls.friction.addEventListener('input', () => {
            const newValue = parseFloat(controls.friction.value);
            controls.frictionValue.textContent = newValue.toFixed(2);
            this.simulation.params.friction = newValue;
        });
        
        controls.repulsion.addEventListener('input', () => {
            const newValue = parseFloat(controls.repulsion.value);
            controls.repulsionValue.textContent = newValue.toFixed(2);
            this.simulation.params.repulsion = newValue;
        });
        
        controls.speedLimit.addEventListener('input', () => {
            const newValue = parseFloat(controls.speedLimit.value);
            controls.speedLimitValue.textContent = newValue.toFixed(2);
            this.simulation.params.speedLimit = newValue;
        });
        
        controls.mouseRadius.addEventListener('input', () => {
            const newValue = parseFloat(controls.mouseRadius.value);
            controls.mouseRadiusValue.textContent = newValue.toFixed(1);
            this.simulation.params.mouseRadius = newValue;
        });
        
        controls.mouseStrength.addEventListener('input', () => {
            const newValue = parseFloat(controls.mouseStrength.value);
            controls.mouseStrengthValue.textContent = newValue.toFixed(2);
            this.simulation.params.mouseStrength = newValue;
        });
        
        // reset button
        controls.resetButton.addEventListener('click', () => {
            this.simulation.resetSimulation();
        });
        
        // reset button in navbar
        document.getElementById('reset-simulation').addEventListener('click', () => {
            this.simulation.resetSimulation();
        });
        
        // settings panel toggle
        const toggleSettingsBtn = document.getElementById('toggle-settings');
        const settingsPanel = document.getElementById('settings-panel');
        const collapseButton = document.getElementById('collapse-button');
        
        let settingsPanelVisible = true;
        
        toggleSettingsBtn.addEventListener('click', function() {
            if (settingsPanelVisible) {
                settingsPanel.style.transform = 'translateX(350px)';
                settingsPanelVisible = false;
            } else {
                settingsPanel.style.transform = 'translateX(0)';
                settingsPanelVisible = true;
            }
        });
        
        collapseButton.addEventListener('click', function() {
            settingsPanel.style.transform = 'translateX(350px)';
            settingsPanelVisible = false;
        });

        // pause button
        const pauseButton = document.getElementById('pause-simulation');
        pauseButton.addEventListener('click', () => {
            this.simulation.togglePause();
        });
    }
    
    togglePause() {
        const pauseButton = document.getElementById('pause-simulation');
        
        if (this.simulation.isPaused) {
            pauseButton.innerHTML = `
                <svg class="play-icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
                <span>Resume</span>
            `;
            this.updateStatus("Simulation paused");
        } else {
            pauseButton.innerHTML = `
                <svg class="pause-icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="6" y="4" width="4" height="16"></rect>
                    <rect x="14" y="4" width="4" height="16"></rect>
                </svg>
                <span>Pause</span>
            `;
            this.updateStatus("Simulation resumed");
        }
    }
}
