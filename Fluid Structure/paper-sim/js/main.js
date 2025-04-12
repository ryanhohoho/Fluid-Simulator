/**
 * main.js
 * main entry point for the improved paper cutting simulation with bendable paper
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
  subdivisions: 40, // higher = better cutting resolution and bending quality
  stiffness: 0.5,
  airResistance: 0.7,
  gravity: 9.8,
  paperTexture: 'white',
};

// initialization
function init() {
  console.log('Initializing paper cutting simulation with bendable paper...');
  
  // create scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf0f0f0);
  
  // add subtle ambient lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);
  
  // add directional light
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
  
  // add another directional light from opposite side (softer)
  const backLight = new THREE.DirectionalLight(0xffffff, 0.3);
  backLight.position.set(-10, 10, -10);
  scene.add(backLight);
  
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
  
  // setup orbit controls using our extended version
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.1;
  controls.rotateSpeed = 0.7;
  controls.enablePan = true;
  controls.minDistance = 20;
  controls.maxDistance = 100;
  
  // initialize systems
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
  
  console.log('Initialization complete');
}

// animation loop
function animate(time) {
  requestAnimationFrame(animate);
  
  // compute delta time in seconds
  const deltaTime = time ? (time - lastTime) / 1000 : 1/60;
  lastTime = time;
  elapsedTime += deltaTime;
  
  // limit delta time to avoid large jumps
  const limitedDelta = Math.min(deltaTime, 1/30);
  
  // update physics
  physicsSystem.update(limitedDelta, elapsedTime);
  
  // update cutting system
  cuttingSystem.update();
  
  // update paper mesh
  paper.update();
  
  // update controls
  if (interactionMode === 'camera') {
    controls.update();
  }
  
  // render
  renderer.render(scene, camera);
}

// handle window resize
function onWindowResize() {
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
    if (interactionMode === 'cutting') {
      cuttingSystem.startCutting(event.clientX, event.clientY);
    }
  });
  
  document.addEventListener('mousemove', (event) => {
    // update cursor position for cutting mode
    if (interactionMode === 'cutting') {
      const cursor = document.getElementById('cutting-cursor');
      cursor.style.left = (event.clientX - 16) + 'px';
      cursor.style.top = (event.clientY - 16) + 'px';
      
      // continue cutting if mouse is down
      cuttingSystem.updateCutting(event.clientX, event.clientY);
    }
  });
  
  document.addEventListener('mouseup', () => {
    if (interactionMode === 'cutting') {
      cuttingSystem.endCutting();
    }
  });
  
  // UI controls
  document.getElementById('stiffness-slider').addEventListener('input', (event) => {
    params.stiffness = parseFloat(event.target.value);
    physicsSystem.updateParameters(params);
    updateUIElements();
  });
  
  document.getElementById('air-resistance-slider').addEventListener('input', (event) => {
    params.airResistance = parseFloat(event.target.value);
    physicsSystem.updateParameters(params);
    updateUIElements();
  });
  
  document.getElementById('paper-texture').addEventListener('change', (event) => {
    params.paperTexture = event.target.value;
    paper.updateTexture(params.paperTexture);
    updateUIElements();
  });
  
  document.getElementById('new-paper').addEventListener('click', () => {
    paper.createPaper();
  });
  
  document.getElementById('reset-scene').addEventListener('click', () => {
    // remove all cut pieces
    physicsSystem.clearCutPieces();
    // create new paper
    paper.createPaper();
  });
}

// update UI elements to reflect current parameters
function updateUIElements() {
  // update sliders
  document.getElementById('stiffness-slider').value = params.stiffness;
  document.getElementById('air-resistance-slider').value = params.airResistance;
  
  // update dropdown
  document.getElementById('paper-texture').value = params.paperTexture;
}

// toggle cutting mode
function toggleCuttingMode(enableCutting) {
  if (enableCutting) {
    interactionMode = 'cutting';
    controls.enabled = false;
    document.getElementById('mode-indicator').textContent = 'CUTTING MODE';
    document.getElementById('cutting-cursor').style.opacity = '1';
    document.body.style.cursor = 'none';
  } else {
    interactionMode = 'camera';
    controls.enabled = true;
    document.getElementById('mode-indicator').textContent = 'CAMERA MODE';
    document.getElementById('cutting-cursor').style.opacity = '0';
    document.body.style.cursor = 'auto';
    
    // ensure cutting is ended if we release space while cutting
    cuttingSystem.endCutting();
  }
}

// initialize everything when the DOM is ready
window.addEventListener('DOMContentLoaded', init);