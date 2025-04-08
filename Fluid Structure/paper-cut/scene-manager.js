/**
 * SceneManager class
 * handles setup and management of the three.js scene, camera, renderer, and lighting
 */
class SceneManager {
    constructor(simulation) {
        this.simulation = simulation;
        this.initRenderer();
        this.setupLighting();
        this.createEnvironment();
    }
    
    /**
     * initialize the three.js renderer and scene
     */
    initRenderer() {
        // setup three.js scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x121212); // dark background by default
        
        // setup camera
        const aspect = window.innerWidth / window.innerHeight;
        this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
        this.camera.position.set(0, 0, 3); // position camera in front of the paper
        this.camera.lookAt(0, 0, 0);
        
        // setup renderer with nice shadows
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            canvas: document.getElementById('canvas'),
            alpha: true
        });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        // if canvas replacement fails, append it
        if (!document.getElementById('canvas')) {
            document.body.appendChild(this.renderer.domElement);
            this.renderer.domElement.id = 'canvas';
        }
        
        // add subtle fog for depth perception
        this.scene.fog = new THREE.Fog(0x121212, 5, 15);
        
        // setup event listeners
        this.setupEventListeners();
    }
    
    /**
     * setup event listeners for theme changes and window resizing
     */
    setupEventListeners() {
        // add event listener for theme changes to update fog and background
        document.addEventListener('themeChange', (e) => {
            const theme = e.detail.theme;
            if (theme === 'light') {
                this.scene.background = new THREE.Color(0xf5f5f5);
                this.scene.fog = new THREE.Fog(0xf5f5f5, 5, 15);
                // update lights for light theme
                this.ambientLight.intensity = 0.7;
                this.directionalLight.intensity = 0.8;
            } else {
                this.scene.background = new THREE.Color(0x121212);
                this.scene.fog = new THREE.Fog(0x121212, 5, 15);
                // update lights for dark theme
                this.ambientLight.intensity = 0.4;
                this.directionalLight.intensity = 1.0;
            }
        });
        
        // handle window resize
        window.addEventListener('resize', this.onWindowResize.bind(this));
    }
    
    /**
     * handle window resize event
     */
    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    /**
     * setup lighting for the scene
     */
    setupLighting() {
        // ambient light
        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(this.ambientLight);
        
        // main directional light with shadows
        this.directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
        this.directionalLight.position.set(5, 5, 7);
        this.directionalLight.castShadow = true;
        
        // optimize shadow settings
        this.directionalLight.shadow.mapSize.width = 2048;
        this.directionalLight.shadow.mapSize.height = 2048;
        this.directionalLight.shadow.camera.near = 0.5;
        this.directionalLight.shadow.camera.far = 20;
        this.directionalLight.shadow.camera.left = -5;
        this.directionalLight.shadow.camera.right = 5;
        this.directionalLight.shadow.camera.top = 5;
        this.directionalLight.shadow.camera.bottom = -5;
        this.directionalLight.shadow.bias = -0.0005;
        
        this.scene.add(this.directionalLight);
        
        // add accent rim light to highlight paper edges
        this.rimLight = new THREE.DirectionalLight(0x2196f3, 0.3);
        this.rimLight.position.set(-5, 0, -3);
        this.scene.add(this.rimLight);
        
        // add subtle point light for additional highlights
        this.pointLight = new THREE.PointLight(0xffffff, 0.3, 10);
        this.pointLight.position.set(2, -3, 3);
        this.scene.add(this.pointLight);
    }
    
    /**
     * create environmental elements
     */
    createEnvironment() {
        // create a floor to receive shadows
        const floorGeometry = new THREE.PlaneGeometry(20, 20);
        const floorMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x222222,
            roughness: 0.8,
            metalness: 0.2,
            transparent: true,
            opacity: 0.7
        });
        
        this.floor = new THREE.Mesh(floorGeometry, floorMaterial);
        this.floor.rotation.x = -Math.PI / 2;
        this.floor.position.y = -3;
        this.floor.receiveShadow = true;
        this.scene.add(this.floor);
        
        // add subtle background elements for depth
        this.createBackgroundElements();
    }
    
    /**
     * create aesthetic background elements
     */
    createBackgroundElements() {
        // create distant decorative elements
        const bgGroup = new THREE.Group();
        
        // create a few floating planes with different opacities
        for (let i = 0; i < 5; i++) {
            const size = Math.random() * 2 + 1;
            const planeGeo = new THREE.PlaneGeometry(size, size);
            const planeMat = new THREE.MeshBasicMaterial({
                color: 0x2196f3,
                transparent: true,
                opacity: Math.random() * 0.2 + 0.05,
                side: THREE.DoubleSide
            });
            
            const plane = new THREE.Mesh(planeGeo, planeMat);
            
            // position randomly in background
            plane.position.set(
                Math.random() * 14 - 7,
                Math.random() * 10 - 5,
                -Math.random() * 5 - 3
            );
            
            // random rotation
            plane.rotation.set(
                Math.random() * Math.PI,
                Math.random() * Math.PI,
                Math.random() * Math.PI
            );
            
            bgGroup.add(plane);
        }
        
        this.scene.add(bgGroup);
        this.backgroundElements = bgGroup;
    }
    
    /**
     * setup orbit controls for the camera
     */
    setupControls() {
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.1;
        this.controls.rotateSpeed = 0.7;
        this.controls.zoomSpeed = 1.0;
        this.controls.panSpeed = 0.8;
        this.controls.minDistance = 1;
        this.controls.maxDistance = 10;
        
        // center controls on paper
        this.controls.target.set(0, 0, 0);
        
        // update control state based on interaction mode
        this.controls.enabled = (this.simulation.interactionMode === 'camera');
    }
    
    /**
     * add glow effect to the paper
     */
    addPaperGlow(paperMesh) {
        // create a glow material
        const glowMaterial = new THREE.ShaderMaterial({
            uniforms: {
                c: { type: "f", value: 0.2 },
                p: { type: "f", value: 1.0 },
                glowColor: { type: "c", value: new THREE.Color(0x3388ff) },
                viewVector: { type: "v3", value: this.camera.position }
            },
            vertexShader: `
                uniform vec3 viewVector;
                uniform float c;
                uniform float p;
                varying float intensity;
                void main() {
                    vec3 vNormal = normalize(normal);
                    vec3 vNormel = normalize(viewVector);
                    intensity = pow(c - dot(vNormal, vNormel), p);
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 glowColor;
                varying float intensity;
                void main() {
                    vec3 glow = glowColor * intensity;
                    gl_FragColor = vec4(glow, intensity * 0.4);
                }
            `,
            side: THREE.FrontSide,
            blending: THREE.AdditiveBlending,
            transparent: true,
            depthWrite: false
        });
        
        // create slightly larger version of the paper mesh
        const paperGeometry = paperMesh.geometry.clone();
        const glowMesh = new THREE.Mesh(paperGeometry, glowMaterial);
        
        // scale it slightly larger
        glowMesh.scale.multiplyScalar(1.02);
        
        // add to scene
        paperMesh.add(glowMesh);
        this.glowMesh = glowMesh;
        
        // update viewVector in render loop
        this.updateGlow = () => {
            glowMaterial.uniforms.viewVector.value = new THREE.Vector3().subVectors(
                this.camera.position,
                glowMesh.position
            );
        };
    }
    
    /**
     * update and render the scene
     */
    updateScene() {
        // update controls if enabled
        if (this.controls && this.simulation.interactionMode === 'camera') {
            this.controls.update();
        }
        
        // update paper glow if it exists
        if (this.updateGlow) {
            this.updateGlow();
        }
        
        // animate background elements
        if (this.backgroundElements) {
            this.backgroundElements.children.forEach((plane, i) => {
                plane.rotation.x += 0.001 * (i % 3 + 1);
                plane.rotation.y += 0.002 * ((i + 1) % 3 + 1);
            });
        }
        
        // render the scene
        this.renderer.render(this.scene, this.camera);
    }
}