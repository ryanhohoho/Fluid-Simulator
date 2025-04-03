/**
 * SceneManager class
 * Handles the Three.js scene setup including renderer, camera, lighting, and container
 */
class SceneManager {
    constructor(simulation) {
        this.simulation = simulation;
        this.initRenderer();
        
        // No longer directly initializing lights - LightController will handle this
        this.initAmbientLight();
        
        this.createContainer();
    }
    
    /**
     * Initialize the Three.js renderer and scene
     */
    initRenderer() {
        // setup three.js scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000000); // dark background by default
        
        // setup camera
        const aspect = window.innerWidth / window.innerHeight;
        this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
        this.camera.position.set(40, 40, 40); // Set camera farther away for debugging
        console.log("Camera position set to:", this.camera.position);
        this.camera.lookAt(0, 0, 0);
        
        // setup renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        // Try to replace canvas, if it fails use a fallback
        try {
            document.getElementById('canvas').replaceWith(this.renderer.domElement);
            this.renderer.domElement.id = 'canvas';
        } catch(e) {
            console.error("Failed to replace canvas:", e);
            const fallback = document.getElementById('container-fallback');
            if (fallback) {
                fallback.appendChild(this.renderer.domElement);
                console.log("Renderer added to fallback container");
            }
        }
        
        // add fog for depth perception
        this.scene.fog = new THREE.Fog(0x000000, 70, 100);
        
        // setup event listeners
        this.setupEventListeners();
    }
    
    /**
     * Setup event listeners for theme changes and window resizing
     */
    setupEventListeners() {
        // add event listener for theme changes to update fog and background
        document.addEventListener('themeChange', (e) => {
            const theme = e.detail.theme;
            if (theme === 'light') {
                this.scene.background = new THREE.Color(0xffffff);
                this.scene.fog = new THREE.Fog(0xffffff, 70, 100);
            } else {
                this.scene.background = new THREE.Color(0x000000);
                this.scene.fog = new THREE.Fog(0x000000, 70, 100);
            }
        });
        
        // handle window resize
        window.addEventListener('resize', this.onWindowResize.bind(this));
    }
    
    /**
     * Handle window resize event
     */
    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    /**
     * Initialize ambient light for the scene
     * Main light will be handled by LightController
     */
    initAmbientLight() {
        // ambient light
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(ambientLight);
    }
    
    
    /**
     * Create the simulation container
     */
    createContainer() {
        const size = this.simulation.params.containerSize;
        const halfSize = size / 2;
        
        // create a group for the container
        this.container = new THREE.Group();
        this.scene.add(this.container);
        
        // create box edges with thicker lines
        const boxGeometry = new THREE.BoxGeometry(size, size, size);
        const boxEdges = new THREE.EdgesGeometry(boxGeometry);
        const edgeMaterial = new THREE.LineBasicMaterial({ 
            color: 0x000000, // black
            opacity: 0.1, 
            transparent: true,
            linewidth: 0
        });
        const boxOutline = new THREE.LineSegments(boxEdges, edgeMaterial);
        this.container.add(boxOutline);
        
        // create semi-transparent sides
        const panelMaterial = new THREE.MeshBasicMaterial({
            color: 0x000000,
            opacity: 0,
            transparent: true,
            side: THREE.DoubleSide
        });
        
        // bottom panel
        const bottomPanel = new THREE.Mesh(
            new THREE.PlaneGeometry(size, size),
            panelMaterial.clone()
        );
        bottomPanel.rotation.x = Math.PI / 2;
        bottomPanel.position.y = -halfSize;
        this.container.add(bottomPanel);
        
        // side panels (slightly visible)
        const sidePanelMaterial = panelMaterial.clone();
        sidePanelMaterial.opacity = 0;
        
        // front panel (z+)
        const frontPanel = new THREE.Mesh(
            new THREE.PlaneGeometry(size, size),
            sidePanelMaterial
        );
        frontPanel.position.z = halfSize;
        this.container.add(frontPanel);
        
        // back panel (z-)
        const backPanel = new THREE.Mesh(
            new THREE.PlaneGeometry(size, size),
            sidePanelMaterial
        );
        backPanel.position.z = -halfSize;
        backPanel.rotation.y = Math.PI;
        this.container.add(backPanel);
        
        // left panel (x-)
        const leftPanel = new THREE.Mesh(
            new THREE.PlaneGeometry(size, size),
            sidePanelMaterial
        );
        leftPanel.position.x = -halfSize;
        leftPanel.rotation.y = Math.PI / 2;
        this.container.add(leftPanel);
        
        // right panel (x+)
        const rightPanel = new THREE.Mesh(
            new THREE.PlaneGeometry(size, size),
            sidePanelMaterial
        );
        rightPanel.position.x = halfSize;
        rightPanel.rotation.y = -Math.PI / 2;
        this.container.add(rightPanel);
    }
    
    /**
     * Setup orbit controls for the camera
     */
    setupControls() {
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enabled = (this.simulation.interactionMode === 'camera');
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.1;
        this.controls.rotateSpeed = 0.7;
        this.controls.zoomSpeed = 1.0;
        this.controls.minDistance = 10;
        this.controls.maxDistance = 80;
    }
    
    /**
     * Clear the container
     */
    clearContainer() {
        while (this.container.children.length > 0) {
            const child = this.container.children[0];
            this.container.remove(child);
            Utils.disposeObject(child);
        }
    }
    
    /**
     * Recreate the container
     */
    recreateContainer() {
        this.clearContainer();
        this.createContainer();
    }
    
    /**
     * Update the scene
     */
    updateScene() {
        console.log("Scene update called");
        if (this.controls && this.simulation.interactionMode === 'camera') {
            this.controls.update();
        }
        
        // Log information about scene
        if (this.scene) {
            console.log("Scene children count:", this.scene.children.length);
        }
        
        // render the scene
        if (this.renderer && this.camera) {
            console.log("Rendering scene...");
            this.renderer.render(this.scene, this.camera);
        } else {
            console.error("Cannot render: renderer or camera is undefined");
        }
    }
}
