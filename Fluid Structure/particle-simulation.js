/**
 * ParticleSimulation class
 * Main simulation class that orchestrates the 3D fluid simulation
 */
class ParticleSimulation {
    constructor() {
        console.log("ParticleSimulation constructor started");
        
        // simulation state
        this.isPaused = false;
        
        // default simulation parameters
        this.params = {
            particleCount: 1500,
            particleSize: 0.70,
            containerSize: 23.0,
            gravity: 0.14,
            energyLoss: 0.25,
            friction: 0.00,
            repulsion: 0.20,
            speedLimit: 1.10,
            mouseRadius: 5.0,
            mouseStrength: 2.00,
            boundSize: 23.0 // added for easy reference
        };
        
        // states for recreation
        this.recreateParticlesNeeded = false;
        this.recreateContainerNeeded = false;
        
        // interaction modes
        this.interactionMode = 'camera'; // 'camera' or 'interaction'
        
        // mouse interaction
        console.log("Initializing raycaster and mouse");
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.mousePosition3D = new THREE.Vector3();
        this.prevMousePosition3D = new THREE.Vector3();
        this.mouseVelocity = new THREE.Vector3();
        this.isMouseDown = false;
        this.intersectionPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1));
        
        try {
            // initialize modules
            console.log("Initializing scene manager");
            this.sceneManager = new SceneManager(this);
            
            console.log("Initializing object loader");
            this.objectLoader = new ObjectLoader(this);
            
            console.log("Initializing particle manager");
            this.particleManager = new ParticleManager(this);
            
            console.log("Initializing physics engine");
            this.physicsEngine = new PhysicsEngine(this);
            
            console.log("Initializing UI controller");
            this.uiController = new UIController(this);
            
            console.log("Initializing light controller");
            this.lightController = new LightController(this);
            
            // create initial particles
            console.log("Creating particles");
            this.particleManager.createParticles();
            
            // setup camera controls
            console.log("Setting up camera controls");
            this.sceneManager.setupControls();
            
            this.updateStatus("Simulation running");
            
            // start animation loop
            console.log("Starting animation loop");
            this.animate();
        } catch (error) {
            console.error("Initialization error:", error);
            this.updateStatus("Error: " + error.message);
            throw error; // Re-throw to be caught by main.js
        }
    }
    
    /**
     * Update the status message
     * @param {string} message - The status message to display
     */
    updateStatus(message) {
        console.log("Status update:", message);
        
        // First try the direct DOM approach if uiController isn't available
        const statusElement = document.getElementById('status');
        if (statusElement) {
            statusElement.textContent = message;
        }
        
        // Then try through uiController if it exists
        if (this.uiController) {
            try {
                this.uiController.updateStatus(message);
            } catch (e) {
                console.warn("Error updating status through uiController:", e);
            }
        }
    }
    
    /**
     * Reset the simulation
     */
    resetSimulation() {
        console.log("Resetting simulation");
        this.updateStatus("Resetting simulation...");
        
        // Store the existing objects to preserve them
        const existingObjects = [...this.objectLoader.objects];
        
        // clear existing particles
        this.particleManager.clearParticles();
        
        // recreate container if needed
        if (this.recreateContainerNeeded) {
            this.sceneManager.recreateContainer();
            this.recreateContainerNeeded = false;
        }
        
        // recreate particles
        this.particleManager.createParticles();
        this.recreateParticlesNeeded = false;
        
        // Re-add objects to container
        if (existingObjects.length > 0) {
            // Clear current objects array but keep the meshes in the scene temporarily
            this.objectLoader.objects = [];
            
            // Re-add each object properly
            existingObjects.forEach(obj => {
                // Update object scale and position if container size changed
                if (obj.originalContainerSize && obj.originalContainerSize !== this.params.containerSize) {
                    const scaleFactor = this.params.containerSize / obj.originalContainerSize;
                    
                    // Scale the position to maintain relative position in container
                    obj.physics.position.x *= scaleFactor;
                    obj.physics.position.y *= scaleFactor;
                    obj.physics.position.z *= scaleFactor;
                }
                
                // Update current container size reference
                obj.originalContainerSize = this.params.containerSize;
                
                // Ensure object is visible and has correct materials
                obj.mesh.visible = true;
                
                // Update mesh position 
                obj.mesh.position.copy(obj.physics.position);
                
                // Re-add to the scene if not already there
                if (!this.sceneManager.container.children.includes(obj.mesh)) {
                    this.sceneManager.container.add(obj.mesh);
                }
                
                // Force material update to ensure visibility
                this.objectLoader.updateObjectMaterials(obj, document.getElementById('use-textures')?.checked ?? true);
                
                // Add to objects array
                this.objectLoader.objects.push(obj);
            });
        }
        
        this.updateStatus("Simulation reset complete");
    }
    
    /**
     * Update the simulation
     */
    update() {
        // skip updates if paused
        if (this.isPaused) return;

        // check if we need to recreate the simulation
        if (this.recreateParticlesNeeded || this.recreateContainerNeeded) {
            this.resetSimulation();
            return;
        }
        
        // update physics using the physics engine
        this.physicsEngine.update();
        
        // update particle visuals
        this.particleManager.updateParticleVisuals();
    }
    
    /**
     * Animation loop
     */
    animate() {
        requestAnimationFrame(this.animate.bind(this));
        
        try {
            // update simulation
            this.update();
            
            // update and render scene
            this.sceneManager.updateScene();
        } catch (error) {
            console.error("Animation error:", error);
            this.updateStatus("Animation error: " + error.message);
        }
    }
    
    /**
     * Toggle pause state
     */
    togglePause() {
        this.isPaused = !this.isPaused;
        console.log("Simulation " + (this.isPaused ? "paused" : "resumed"));
        this.uiController.togglePause();
    }
}
