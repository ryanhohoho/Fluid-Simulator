/**
 * new-paper-mesh.js
 * completely rebuilt paper mesh system for reliable paper cutting simulation
 */

class PaperMesh {
  constructor(scene, physicsSystem, params) {
    this.scene = scene;
    this.physicsSystem = physicsSystem;
    this.params = params;
    
    // paper mesh
    this.mesh = null;
    
    // paper dimensions
    this.width = params.paperWidth || 30;
    this.height = params.paperHeight || 40;
    this.thickness = params.paperThickness || 0.05;
    
    // texture instances
    this.textures = {};
    
    // edge mesh for thickness visualization
    this.edgeMesh = null;
    
    console.log("PaperMesh initialized with dimensions:", this.width, "x", this.height);
    
    // load paper textures
    this.loadTextures();
  }
  
  // Load all paper textures
  loadTextures() {
    const textureLoader = new THREE.TextureLoader();
    
    // white paper texture (subtle)
    this.textures.white = {
      diffuse: textureLoader.load('https://cdn.jsdelivr.net/gh/mrdoob/three.js@master/examples/textures/lava/cloud.png', (texture) => {
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(2, 3);
        texture.offset.set(0, 0);
      })
    };
    
    // create graph paper texture procedurally
    this.textures.graph = {
      diffuse: this.createGraphPaperTexture()
    };
    
    // parchment paper texture
    this.textures.parchment = {
      diffuse: textureLoader.load('https://cdn.jsdelivr.net/gh/mrdoob/three.js@master/examples/textures/terrain/grasslight-big.jpg', (texture) => {
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(1, 1);
        texture.offset.set(0, 0);
      })
    };
    
    // realistic paper texture
    this.textures.realistic = {
      diffuse: this.createRealisticPaperTexture()
    };
    
    // create a fallback texture
    const fallbackCanvas = document.createElement('canvas');
    fallbackCanvas.width = 64;
    fallbackCanvas.height = 64;
    const ctx = fallbackCanvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, 64, 64);
    
    // subtle grid pattern
    ctx.strokeStyle = 'rgba(0,0,0,0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 64; i += 8) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(64, i);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 64);
      ctx.stroke();
    }
    
    const fallbackTexture = new THREE.CanvasTexture(fallbackCanvas);
    
    // Set fallback for failed texture loads
    this.textures.fallback = {
      diffuse: fallbackTexture
    };
    
    console.log("Paper textures loaded");
  }
  
  // Create a procedural graph paper texture
  createGraphPaperTexture() {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d');
      
      // fill with off-white color
      ctx.fillStyle = '#f8f8f8';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // draw grid lines
      ctx.strokeStyle = '#bbbbff';
      ctx.lineWidth = 1;
      
      // draw vertical lines
      const gridSize = 32;
      for (let x = 0; x <= canvas.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      
      // draw horizontal lines
      for (let y = 0; y <= canvas.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }
      
      // draw main grid lines (darker)
      ctx.strokeStyle = '#8888ff';
      ctx.lineWidth = 2;
      
      for (let x = 0; x <= canvas.width; x += gridSize * 4) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      
      for (let y = 0; y <= canvas.height; y += gridSize * 4) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }
      
      // create texture from canvas
      const texture = new THREE.CanvasTexture(canvas);
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(1, 1.5);
      texture.needsUpdate = true;
      
      return texture;
    } catch (e) {
      console.error("Error creating graph paper texture:", e);
      return this.textures.fallback.diffuse;
    }
  }
  
  // Create a realistic paper texture procedurally
  createRealisticPaperTexture() {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d');
      
      // Fill with slightly off-white base color
      ctx.fillStyle = '#f7f7f2';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Create paper grain texture
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      // Apply subtle noise for paper grain
      for (let i = 0; i < data.length; i += 4) {
        const noise = Math.random() * 10 - 5;
        data[i] = Math.max(0, Math.min(255, data[i] + noise));
        data[i+1] = Math.max(0, Math.min(255, data[i+1] + noise));
        data[i+2] = Math.max(0, Math.min(255, data[i+2] + noise));
      }
      
      ctx.putImageData(imageData, 0, 0);
      
      // Add subtle fibers
      for (let i = 0; i < 1000; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const length = Math.random() * 5 + 2;
        const angle = Math.random() * Math.PI * 2;
        
        ctx.strokeStyle = `rgba(${Math.random() * 50 + 200}, ${Math.random() * 50 + 200}, ${Math.random() * 50 + 200}, 0.1)`;
        ctx.lineWidth = Math.random() * 1.5 + 0.5;
        
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(
          x + Math.cos(angle) * length,
          y + Math.sin(angle) * length
        );
        ctx.stroke();
      }
      
      // Create texture from canvas
      const texture = new THREE.CanvasTexture(canvas);
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(1, 1);
      texture.needsUpdate = true;
      
      return texture;
    } catch (e) {
      console.error("Error creating realistic paper texture:", e);
      return this.textures.fallback.diffuse;
    }
  }
  
  // Create the paper mesh
  createPaper() {
    try {
      console.log("Creating paper mesh");
      
      // Remove existing paper mesh if any
      if (this.mesh) {
        this.scene.remove(this.mesh);
        if (this.mesh.geometry) this.mesh.geometry.dispose();
        if (this.mesh.material) this.mesh.material.dispose();
      }
      
      // Remove edge mesh if any
      if (this.edgeMesh) {
        this.scene.remove(this.edgeMesh);
        if (this.edgeMesh.geometry) this.edgeMesh.geometry.dispose();
        if (this.edgeMesh.material) this.edgeMesh.material.dispose();
        this.edgeMesh = null;
      }
      
      // Get subdivisions from params
      const subdivisions = this.params.subdivisions || 20;
      
      // Create a plane geometry for the paper
      const geometry = new THREE.PlaneGeometry(
        this.width, 
        this.height, 
        subdivisions, 
        subdivisions
      );
      
      // Create material
      const material = this.createPaperMaterial();
      
      // Create mesh
      this.mesh = new THREE.Mesh(geometry, material);
      this.mesh.castShadow = true;
      this.mesh.receiveShadow = true;
      
      // Position at origin
      this.mesh.position.set(0, 0, 0);
      
      // Add to scene
      this.scene.add(this.mesh);
      
      // Add paper thickness visualization
      this.addPaperThickness();
      
      // Initialize physics
      if (this.physicsSystem) {
        this.physicsSystem.initializeMainPaper(this.mesh);
      }
      
      console.log("Created paper with", subdivisions, "subdivisions");
      return this.mesh;
    } catch (e) {
      console.error("Error creating paper mesh:", e);
      return null;
    }
  }
  
  // Create material for paper based on texture selection
  createPaperMaterial() {
    try {
      // Get the requested texture
      let textureSet = this.textures[this.params.paperTexture];
      
      // Fallback to white if not found
      if (!textureSet || !textureSet.diffuse) {
        textureSet = this.textures.white;
      }
      
      // Final fallback to ensure we have a texture
      if (!textureSet || !textureSet.diffuse) {
        textureSet = this.textures.fallback;
      }
      
      // Create the material
      const material = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        roughness: 0.4,
        metalness: 0.0,
        reflectivity: 0.05,
        side: THREE.DoubleSide,
        map: textureSet.diffuse
      });
      
      return material;
    } catch (e) {
      console.error("Error creating paper material:", e);
      
      // Simple fallback material
      return new THREE.MeshBasicMaterial({ 
        color: 0xffffff, 
        side: THREE.DoubleSide 
      });
    }
  }
  
  // Add visualization of paper thickness along edges
  addPaperThickness() {
    try {
      if (!this.mesh || !this.mesh.geometry) {
        console.warn("Cannot add paper thickness: mesh or geometry is missing");
        return;
      }
      
      const width = this.width;
      const height = this.height;
      const thickness = this.thickness;
      
      // Create a simple extruded box for the paper edge
      const edgeGeometry = new THREE.BoxGeometry(width, height, thickness);
      
      // Create material for edges
      const edgeMaterial = new THREE.MeshStandardMaterial({
        color: 0xf5f5f5,
        roughness: 0.7,
        metalness: 0.0
      });
      
      // Create edge mesh
      this.edgeMesh = new THREE.Mesh(edgeGeometry, edgeMaterial);
      
      // Position at same place as main paper
      this.edgeMesh.position.copy(this.mesh.position);
      this.edgeMesh.rotation.copy(this.mesh.rotation);
      
      // Add to scene
      this.scene.add(this.edgeMesh);
      
      console.log("Added paper thickness visualization");
    } catch (e) {
      console.error("Error adding paper thickness:", e);
    }
  }
  
  // Update paper texture
  updateTexture(textureName) {
    if (!this.mesh || !this.mesh.material) return;
    
    try {
      const textureSet = this.textures[textureName];
      if (!textureSet || !textureSet.diffuse) return;
      
      // Update material texture
      this.mesh.material.map = textureSet.diffuse;
      this.mesh.material.needsUpdate = true;
      
      console.log("Updated paper texture to", textureName);
    } catch (e) {
      console.warn("Error updating texture:", e);
    }
  }
  
  // Update called each frame
  update() {
    // Sync edge mesh with main paper mesh
    if (this.edgeMesh && this.mesh) {
      this.edgeMesh.position.copy(this.mesh.position);
      this.edgeMesh.quaternion.copy(this.mesh.quaternion);
    }
  }
}