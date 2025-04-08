/**
 * PaperSimulation class
 * main simulation class that orchestrates all components
 */
class PaperSimulation {
    constructor() {
        // simulation parameters
        this.params = {
            // paper properties
            paperSize: 1.0,
            paperThickness: 0.01,
            paperTexture: 'white',
            
            // physics properties
            gravity: 9.8,
            airResistance: 0.05,
            stiffness: 0.8,
            
            // cutting tool properties
            cutWidth: 0.02,
            cutColor: '#ff3b30'
        };
        
        // simulation state
        this.isPaused = false;
        this.interactionMode = 'camera'; // 'camera' or 'cutting'
        
        // state change flags
        this.paperSizeChanged = false;
        this.paperThicknessChanged = false;
        
        try {
            // initialize main components
            this.initializeComponents();
            
            // start animation loop
            this.animate();
            
            // update status
            this.uiController.updateStatus('Simulation ready');
        } catch (error) {
            console.error('Initialization error:', error);
            // show error in UI if possible
            const statusElement = document.getElementById('status');
            if (statusElement) {
                statusElement.textContent = 'Error: ' + error.message;
            }
        }
    }
    
    /**
     * initialize all simulation components
     */
    initializeComponents() {
        console.log('Initializing scene manager...');
        this.sceneManager = new SceneManager(this);
        
        console.log('Initializing physics engine...');
        this.physicsEngine = new PhysicsEngine(this);
        
        console.log('Initializing paper manager...');
        this.paperManager = new PaperManager(this);
        
        console.log('Initializing paper cutter...');
        this.paperCutter = new PaperCutter(this);
        
        console.log('Initializing UI controller...');
        this.uiController = new UIController(this);
        
        console.log('Setting up camera controls...');
        this.sceneManager.setupControls();
        
        // Setup event listeners for window resize
        window.addEventListener('resize', () => {
            if (this.sceneManager) {
                this.sceneManager.onWindowResize();
            }
        });
        
        // Ensure proper vertically oriented view
        this.sceneManager.camera.position.set(0, 0, 5);
        this.sceneManager.camera.lookAt(0, 0, 0);
        if (this.sceneManager.controls) {
            this.sceneManager.controls.target.set(0, 0, 0);
            this.sceneManager.controls.update();
        }
    }
    
    /**
     * reset the simulation
     */
    resetSimulation() {
        this.uiController.updateStatus('Resetting simulation...');
        
        // reset the paper
        this.paperManager.reset();
        
        this.uiController.updateStatus('Simulation reset complete');
    }
    
    /**
     * update the simulation
     */
    update() {
        // skip updates if paused
        if (this.isPaused) return;
        
        // check if we need to update paper properties
        if (this.paperSizeChanged || this.paperThicknessChanged) {
            this.resetSimulation();
            this.paperSizeChanged = false;
            this.paperThicknessChanged = false;
        }
        
        // update physics
        this.physicsEngine.update();
        
        // update paper and paper pieces
        this.paperManager.update();
        
        // update paper cutter
        this.paperCutter.update();
    }
    
    /**
     * animation loop
     */
    animate() {
        requestAnimationFrame(this.animate.bind(this));
        
        try {
            // update simulation
            this.update();
            
            // update scene
            this.sceneManager.updateScene();
        } catch (error) {
            console.error('Animation error:', error);
            this.uiController.updateStatus('Animation error: ' + error.message);
        }
    }
    
    /**
     * toggle pause state
     */
    togglePause() {
        this.isPaused = !this.isPaused;
        
        // update status
        const status = this.isPaused ? 'Simulation paused' : 'Simulation resumed';
        this.uiController.updateStatus(status);
    }
}