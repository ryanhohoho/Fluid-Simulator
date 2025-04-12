/**
 * main.js
 * main entry point for the paper cutting simulation
 */

// global objects
let scene, camera, renderer, controls;
let paper, cuttingSystem, physicsSystem;
let interactionMode = 'camera'; // 'camera' or 'cutting'
let lastTime = 0;
let elapsedTime = 0;

// simulation parameters
const params = {
  paperWidth: 30,
  paperHeight: 40,
  paperThickness: 0.05,
  subdivisions: 40, // higher = better cutting resolution
  stiffness: 0.5,
  airResistance: 0.7,
  gravity: 9.8,
  paperTexture: 'realistic',
  debugMode: false,
};

// initialization
function init() {
  console.log('Initializing paper cutting simulation...');
  
  try {
    // Hide loading screen on error after timeout
    setTimeout(() => {
      const loadingScreen = document.getElementById('loading-screen');
      if (loadingScreen) loadingScreen.style.display = 'none';
    }, 10000); // 10 second fallback
    
    // create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);
    
    // add lighting
    setupLighting();
    
    // setup camera
    const aspect = window.innerWidth / window.innerHeight;
    camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
    camera.position.set(0, 0, 50);
    camera.lookAt(0, 0, 0);
    
    // setup renderer
    renderer = new THREE.WebGLRenderer({ 
      canvas: document.getElementById('canvas'),
      antialias: true
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    // enable depth buffer
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    
    // Setup orbit controls
    if (typeof THREE.OrbitControls !== 'undefined') {
      console.log("Using THREE.OrbitControls");
      controls = new THREE.OrbitControls(camera, renderer.domElement);
    } else if (typeof OrbitControls !== 'undefined') {
      console.log("Using custom OrbitControls");
      controls = new OrbitControls(camera, renderer.domElement);
    } else {
      console.warn("OrbitControls not found, camera controls will be limited");
      // Simple fallback controls
      controls = {
        update: function() {},
        enabled: true
      };
    }
    
    if (controls.enableDamping !== undefined) {
      controls.enableDamping = true;
      controls.dampingFactor = 0.1;
      controls.rotateSpeed = 0.7;
      controls.enablePan = true;
      controls.minDistance = 20;
      controls.maxDistance = 100;
    }
    
    // initialize systems - important: create physics first!
    physicsSystem = new PaperPhysics(scene, params);
    paper = new PaperMesh(scene, physicsSystem, params);
    cuttingSystem = new CuttingSystem(scene, camera, paper, physicsSystem, params);
    
    // add event listeners
    setupEventListeners();
    
    // initial paper creation
    paper.createPaper();
    
    // update UI
    updateUIElements();
    
    // start animation loop
    animate();
    
    // Hide loading screen
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
      loadingScreen.style.opacity = '0';
      setTimeout(() => {
        loadingScreen.style.display = 'none';
      }, 500);
    }
    
    console.log('Initialization complete');
  } catch (e) {
    console.error("Error during initialization:", e);
    
    // Hide loading screen on error
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) loadingScreen.style.display = 'none';
    
    // Show error message
    alert("An error occurred during initialization. Please check the console for details.");
  }
}

// Setup lighting for the scene
function setupLighting() {
  // ambient light
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);
  
  // main directional light
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(10, 20, 15);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.width = 2048;
  directionalLight.shadow.mapSize.height = 2048;
  directionalLight.shadow.camera.near = 0.5;
  directionalLight.shadow.camera.far = 50;
  directionalLight.shadow.camera.left = -25;
  directionalLight.shadow.camera.right = 25;
  directionalLight.shadow.camera.top = 25;
  directionalLight.shadow.camera.bottom = -25;
  scene.add(directionalLight);
  
  // back light
  const backLight = new THREE.DirectionalLight(0xffffff, 0.3);
  backLight.position.set(-10, 10, -10);
  scene.add(backLight);
}

// animation loop
function animate(time) {
  requestAnimationFrame(animate);
  
  try {
    // compute delta time in seconds
    const deltaTime = time ? (time - lastTime) / 1000 : 1/60;
    lastTime = time;
    elapsedTime += deltaTime;
    
    // limit delta time to avoid large jumps
    const limitedDelta = Math.min(deltaTime, 1/30);
    
    // update physics
    if (physicsSystem) {
      physicsSystem.update(limitedDelta, elapsedTime);
    }
    
    // update cutting system
    if (cuttingSystem) {
      cuttingSystem.update();
    }
    
    // update paper mesh
    if (paper) {
      paper.update();
    }
    
    // update controls
    if (interactionMode === 'camera' && controls && controls.update) {
      controls.update();
    }
    
    // render
    if (renderer && scene && camera) {
      renderer.render(scene, camera);
    }
  } catch (e) {
    console.error("Error in animation loop:", e);
    // Don't stop the animation loop, just report the error
  }
}

// handle window resize
function onWindowResize() {
  if (!camera || !renderer) return;
  
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// setup event listeners
function setupEventListeners() {
  // window resize
  window.addEventListener('resize', onWindowResize);
  
  // keyboard events for mode switching
  document.addEventListener('keydown', (event) => {
    if (event.code === 'Space') {
      event.preventDefault();
      toggleCuttingMode(true);
    } else if (event.code === 'KeyD' && event.ctrlKey) {
      event.preventDefault();
      toggleDebugMode();
    }
  });
  
  document.addEventListener('keyup', (event) => {
    if (event.code === 'Space') {
      event.preventDefault();
      toggleCuttingMode(false);
    }
  });
  
  // mouse events for cutting
  document.addEventListener('mousedown', (event) => {
    if (interactionMode === 'cutting' && cuttingSystem) {
      cuttingSystem.startCutting(event.clientX, event.clientY);
    }
  });
  
  document.addEventListener('mousemove', (event) => {
    // update cursor position for cutting mode
    if (interactionMode === 'cutting') {
      const cursor = document.getElementById('cutting-cursor');
      if (cursor) {
        cursor.style.left = (event.clientX - 16) + 'px';
        cursor.style.top = (event.clientY - 16) + 'px';
      }
      
      // continue cutting if in cutting mode
      if (cuttingSystem) {
        cuttingSystem.updateCutting(event.clientX, event.clientY);
      }
    }
  });
  
  document.addEventListener('mouseup', () => {
    if (interactionMode === 'cutting' && cuttingSystem) {
      cuttingSystem.endCutting();
    }
  });
  
  // UI controls
  const stiffnessSlider = document.getElementById('stiffness-slider');
  if (stiffnessSlider) {
    stiffnessSlider.addEventListener('input', (event) => {
      params.stiffness = parseFloat(event.target.value);
      if (physicsSystem) {
        physicsSystem.updateParameters(params);
      }
      updateUIElements();
    });
  }
  
  const airResistanceSlider = document.getElementById('air-resistance-slider');
  if (airResistanceSlider) {
    airResistanceSlider.addEventListener('input', (event) => {
      params.airResistance = parseFloat(event.target.value);
      if (physicsSystem) {
        physicsSystem.updateParameters(params);
      }
      updateUIElements();
    });
  }
  
  const paperTextureSelect = document.getElementById('paper-texture');
  if (paperTextureSelect) {
    paperTextureSelect.addEventListener('change', (event) => {
      params.paperTexture = event.target.value;
      if (paper) {
        paper.updateTexture(params.paperTexture);
      }
      updateUIElements();
    });
  }
  
  const newPaperButton = document.getElementById('new-paper');
  if (newPaperButton) {
    newPaperButton.addEventListener('click', () => {
      if (paper) {
        paper.createPaper();
      }
    });
  }
  
  const resetSceneButton = document.getElementById('reset-scene');
  if (resetSceneButton) {
    resetSceneButton.addEventListener('click', () => {
      // remove all cut pieces
      if (physicsSystem) {
        physicsSystem.clearCutPieces();
      }
      // create new paper
      if (paper) {
        paper.createPaper();
      }
    });
  }
  
  // Help modal functionality
  const helpButton = document.getElementById('help-button');
  const helpModal = document.getElementById('help-modal');
  const closeHelp = document.getElementById('close-help');
  
  if (helpButton && helpModal) {
    helpButton.addEventListener('click', function() {
      helpModal.style.display = 'flex';
    });
  }
  
  if (closeHelp && helpModal) {
    closeHelp.addEventListener('click', function() {
      helpModal.style.display = 'none';
    });
  }
}

// update UI elements to reflect current parameters
function updateUIElements() {
  try {
    // update sliders
    const stiffnessSlider = document.getElementById('stiffness-slider');
    if (stiffnessSlider) {
      stiffnessSlider.value = params.stiffness;
    }
    
    const airResistanceSlider = document.getElementById('air-resistance-slider');
    if (airResistanceSlider) {
      airResistanceSlider.value = params.airResistance;
    }
    
    // update dropdown
    const paperTextureSelect = document.getElementById('paper-texture');
    if (paperTextureSelect) {
      paperTextureSelect.value = params.paperTexture;
    }
    
    // update mode indicator with current mode
    const modeIndicator = document.getElementById('mode-indicator');
    if (modeIndicator) {
      modeIndicator.textContent = interactionMode === 'cutting' ? 'CUTTING MODE' : 'CAMERA MODE';
      
      // Add debug indicator if in debug mode
      if (params.debugMode) {
        modeIndicator.textContent += ' (DEBUG)';
      }
    }
  } catch (e) {
    console.warn("Error updating UI elements:", e);
  }
}

// toggle cutting mode
function toggleCuttingMode(enableCutting) {
  if (enableCutting) {
    interactionMode = 'cutting';
    if (controls && controls.enabled !== undefined) controls.enabled = false;
    
    const modeIndicator = document.getElementById('mode-indicator');
    if (modeIndicator) modeIndicator.textContent = 'CUTTING MODE';
    
    const cuttingCursor = document.getElementById('cutting-cursor');
    if (cuttingCursor) cuttingCursor.style.opacity = '1';
    
    document.body.style.cursor = 'none';
  } else {
    interactionMode = 'camera';
    if (controls && controls.enabled !== undefined) controls.enabled = true;
    
    const modeIndicator = document.getElementById('mode-indicator');
    if (modeIndicator) modeIndicator.textContent = 'CAMERA MODE';
    
    const cuttingCursor = document.getElementById('cutting-cursor');
    if (cuttingCursor) cuttingCursor.style.opacity = '0';
    
    document.body.style.cursor = 'auto';
    
    // ensure cutting is ended if we release space while cutting
    if (cuttingSystem) {
      cuttingSystem.endCutting();
    }
  }
  
  // Update UI to show debug status if needed
  updateUIElements();
}

// toggle debug mode
function toggleDebugMode() {
  params.debugMode = !params.debugMode;
  
  // Toggle physics system debug visualization if available
  if (physicsSystem && physicsSystem.toggleDebugVisualization) {
    physicsSystem.toggleDebugVisualization();
  }
  
  // Update UI
  updateUIElements();
  
  console.log(`Debug mode ${params.debugMode ? 'enabled' : 'disabled'}`);
}

// initialize everything when the DOM is ready
window.addEventListener('DOMContentLoaded', init);