/**
 * paper-mesh.js
 * handles the creation and management of the paper's geometry
 */

class PaperMesh {
  constructor(scene, physicsSystem, params) {
    this.scene = scene;
    this.physicsSystem = physicsSystem;
    this.params = params;
    
    // paper mesh
    this.mesh = null;
    
    // paper dimensions
    this.width = params.paperWidth;
    this.height = params.paperHeight;
    this.thickness = params.paperThickness;
    
    // texture instances
    this.textures = {};
    
    // load paper textures
    this.loadTextures();
  }
  
  loadTextures() {
    const textureLoader = new THREE.TextureLoader();
    
    // white paper texture (subtle)
    this.textures.white = {
      diffuse: textureLoader.load('https://cdn.jsdelivr.net/gh/mrdoob/three.js@master/examples/textures/lava/cloud.png', (texture) => {
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(2, 3);
        texture.offset.set(0, 0);
        // make it very subtle
        texture.minFilter = THREE.LinearMipmapLinearFilter;
      }),
      normal: null,
      roughness: null,
    };
    
    // create graph paper texture procedurally
    this.textures.graph = {
      diffuse: this.createGraphPaperTexture(),
      normal: null,
      roughness: null,
    };
    
    // parchment paper texture
    this.textures.parchment = {
      diffuse: textureLoader.load('https://cdn.jsdelivr.net/gh/mrdoob/three.js@master/examples/textures/terrain/grasslight-big.jpg', (texture) => {
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(1, 1);
        texture.offset.set(0, 0);
      }),
      normal: null,
      roughness: null,
    };
  }
  
  // create a procedural graph paper texture
  createGraphPaperTexture() {
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
  }
  
  // create the paper mesh
  createPaper() {
    // remove existing paper if any
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh.material.dispose();
    }
    
    // create a subdivided plane geometry
    const geometry = new THREE.PlaneGeometry(
      this.width, 
      this.height, 
      this.params.subdivisions, 
      this.params.subdivisions
    );
    
    // create material based on current texture selection
    const material = this.createPaperMaterial();
    
    // create mesh
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.userData.isPaper = true;
    
    // position the paper at the center of the scene, vertically
    this.mesh.position.set(0, 0, 0);
    this.mesh.rotation.set(0, 0, 0);
    
    // add to scene
    this.scene.add(this.mesh);
    
    // create physics representation
    this.physicsSystem.initializeMainPaper(this.mesh);
    
    // add front and back faces (for thickness visualization)
    this.addPaperThickness();
    
    console.log("Created paper with", this.params.subdivisions, "subdivisions");
  }
  
  // create material for paper based on texture selection
  createPaperMaterial() {
    const textureSet = this.textures[this.params.paperTexture];
    
    const material = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.2,
      metalness: 0.0,
      reflectivity: 0.1,
      clearcoat: 0.1,
      clearcoatRoughness: 0.4,
      side: THREE.DoubleSide,
      map: textureSet.diffuse,
      normalMap: textureSet.normal,
      roughnessMap: textureSet.roughness,
    });
    
    return material;
  }
  
  // add thin edges to visualize paper thickness
  addPaperThickness() {
    // clone the main geometry
    const frontGeo = this.mesh.geometry.clone();
    const backGeo = this.mesh.geometry.clone();
    const edgeGeo = new THREE.BufferGeometry();
    
    // get positions array
    const frontPositions = frontGeo.getAttribute('position');
    const backPositions = backGeo.getAttribute('position');
    
    // displace front/back faces along the normal (z) direction
    const halfThickness = this.thickness / 2;
    
    for (let i = 0; i < frontPositions.count; i++) {
      // offset front vertices forward
      frontPositions.setZ(i, halfThickness);
      
      // offset back vertices backward
      backPositions.setZ(i, -halfThickness);
    }
    
    // create edge geometry
    const positions = [];
    const indices = [];
    const numVerts = frontPositions.count;
    
    // indices for the side/edge faces
    for (let i = 0; i < this.params.subdivisions; i++) {
      for (let j = 0; j < this.params.subdivisions; j++) {
        // calculate indices for the four corners of this grid cell
        const a = i * (this.params.subdivisions + 1) + j;
        const b = i * (this.params.subdivisions + 1) + (j + 1);
        const c = (i + 1) * (this.params.subdivisions + 1) + (j + 1);
        const d = (i + 1) * (this.params.subdivisions + 1) + j;
        
        // if this is an edge vertex, add it to the edge geometry
        if (i === 0 || i === this.params.subdivisions || 
            j === 0 || j === this.params.subdivisions) {
          
          // get positions
          const posA = new THREE.Vector3();
          const posB = new THREE.Vector3();
          posA.fromBufferAttribute(frontPositions, a);
          posB.fromBufferAttribute(backPositions, a);
          
          // add vertices
          positions.push(posA.x, posA.y, posA.z);
          positions.push(posB.x, posB.y, posB.z);
        }
      }
    }
    
    // create edge material
    const edgeMaterial = new THREE.MeshStandardMaterial({
      color: 0xf0f0f0,
      roughness: 0.5,
      metalness: 0.0,
      side: THREE.DoubleSide
    });
    
    // set buffer attributes
    edgeGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    
    // create edge mesh
    this.edgeMesh = new THREE.Mesh(edgeGeo, edgeMaterial);
    this.edgeMesh.castShadow = true;
    
    // add to scene
    this.scene.add(this.edgeMesh);
  }
  
  // update paper texture
  updateTexture(textureName) {
    if (!this.mesh) return;
    
    const textureSet = this.textures[textureName];
    if (!textureSet) return;
    
    // update material texture
    this.mesh.material.map = textureSet.diffuse;
    this.mesh.material.normalMap = textureSet.normal;
    this.mesh.material.roughnessMap = textureSet.roughness;
    this.mesh.material.needsUpdate = true;
  }
  
  // update method called each frame
  update() {
    // update any animations or procedural behaviors here
  }
}