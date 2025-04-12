/**
 * paper-physics.js
 * manages the flexible paper physics simulation with bendable pieces and natural movement
 */

class PaperPhysics {
  constructor(scene, params) {
    this.scene = scene;
    this.params = params;
    
    // main paper reference
    this.mainPaper = null;
    
    // list of cut pieces
    this.cutPieces = [];
    
    // physics properties
    this.gravity = params.gravity;
    this.stiffness = params.stiffness;
    this.airResistance = params.airResistance;
    
    // turbulence parameters
    this.turbulenceStrength = 0.08;
    this.turbulenceScale = 0.2;
    this.turbulenceSpeed = 0.5;
    this.noiseOffset = Math.random() * 1000;
    
    // anchors for hanging paper
    this.anchors = [];
    
    // create ground plane for detecting when to stop simulation
    this.createGroundPlane();
    
    // initialize noise for turbulence
    this.initializeNoise();
  }
  
  // initialize simplex noise for turbulence
  initializeNoise() {
    // simple perlin noise implementation
    this.noise = {
      grad3: [
        [1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],
        [1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],
        [0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]
      ],
      p: [],
      perm: new Array(512),
      gradP: new Array(512)
    };
    
    // seed the noise function
    this.seed(Math.random());
  }
  
  // seed the noise function
  seed(seed) {
    const noise = this.noise;
    
    if(seed > 0 && seed < 1) {
      // scale the seed out
      seed *= 65536;
    }
    
    seed = Math.floor(seed);
    if(seed < 256) {
      seed |= seed << 8;
    }
    
    const p = noise.p;
    for(let i = 0; i < 256; i++) {
      let v;
      if (i & 1) {
        v = p[i] ^ (seed & 255);
      } else {
        v = p[i] ^ ((seed>>8) & 255);
      }
      
      noise.perm[i] = noise.perm[i + 256] = v;
      noise.gradP[i] = noise.gradP[i + 256] = noise.grad3[v % 12];
    }
  }
  
  // simplified 3D simplex noise function
  simplexNoise(x, y, z) {
    // faster but more approximate noise implementation for real-time use
    const n0 = Math.sin(x * 10 + this.noiseOffset) * 0.5 + 0.5;
    const n1 = Math.sin(y * 8 + x * 5 + this.noiseOffset * 0.8) * 0.5 + 0.5;
    const n2 = Math.sin(z * 6 + x * 4 + y * 3 + this.noiseOffset * 0.6) * 0.5 + 0.5;
    
    return (n0 + n1 + n2) / 3;
  }
  
  // get turbulence vector at a point
  getTurbulence(position, time) {
    const x = position.x * this.turbulenceScale + time * this.turbulenceSpeed;
    const y = position.y * this.turbulenceScale + time * this.turbulenceSpeed * 0.8;
    const z = position.z * this.turbulenceScale + time * this.turbulenceSpeed * 0.6;
    
    // generate 3 different noise values for x, y, z components
    const noiseX = this.simplexNoise(x, y + 100, z + 200) * 2 - 1;
    const noiseY = this.simplexNoise(x + 100, y, z + 300) * 2 - 1;
    const noiseZ = this.simplexNoise(x + 200, y + 300, z) * 2 - 1;
    
    // create turbulence vector
    return new THREE.Vector3(
      noiseX * this.turbulenceStrength,
      noiseY * this.turbulenceStrength, 
      noiseZ * this.turbulenceStrength
    );
  }
  
  createGroundPlane() {
    // invisible ground plane at y = -50
    const groundGeometry = new THREE.PlaneGeometry(500, 500);
    const groundMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff, 
      transparent: true,
      opacity: 0.0,
      side: THREE.DoubleSide
    });
    
    this.groundPlane = new THREE.Mesh(groundGeometry, groundMaterial);
    this.groundPlane.rotation.x = -Math.PI / 2;
    this.groundPlane.position.y = -50;
    this.groundPlane.receiveShadow = true;
    this.scene.add(this.groundPlane);
  }
  
  // initialize main paper physics
  initializeMainPaper(paperMesh) {
    this.mainPaper = {
      mesh: paperMesh,
      velocity: new THREE.Vector3(0, 0, 0),
      angularVelocity: new THREE.Vector3(0, 0, 0),
      mass: 1.0,
      inertia: new THREE.Matrix3().identity().multiplyScalar(1/6 * paperMesh.geometry.parameters.width * paperMesh.geometry.parameters.height),
      isFixed: true,  // main paper is fixed/hanging
      particles: [],  // for mass-spring system
      springs: [],    // for mass-spring system
      bendingSprings: [] // for bending constraints
    };
    
    // create mass-spring system for the main paper
    this.createMassSpringSystem(this.mainPaper);
    
    // create anchors for the main paper
    this.createAnchors();
  }
  
  // create mass-spring system for a paper piece
  createMassSpringSystem(paperPiece) {
    const mesh = paperPiece.mesh;
    const geometry = mesh.geometry;
    const positions = geometry.getAttribute('position');
    
    // particles (mass points)
    const particles = [];
    const particleMap = new Map(); // map vertex index to particle index
    
    // create particles at each vertex
    for (let i = 0; i < positions.count; i++) {
      const vertex = new THREE.Vector3().fromBufferAttribute(positions, i);
      
      // transform to world space
      vertex.applyMatrix4(mesh.matrixWorld);
      
      // create particle
      const particle = {
        position: vertex.clone(),
        lastPosition: vertex.clone(),
        velocity: new THREE.Vector3(0, 0, 0),
        force: new THREE.Vector3(0, 0, 0),
        mass: 0.01, // small mass for each point
        fixed: false // will be set true for anchored points
      };
      
      particles.push(particle);
      particleMap.set(i, particles.length - 1);
    }
    
    // create structural springs (edges of triangles)
    const springs = [];
    
    // function to add a spring between two particles
    const addSpring = (i1, i2, stiffness, restLength = null) => {
      const p1Index = particleMap.get(i1);
      const p2Index = particleMap.get(i2);
      
      if (p1Index === undefined || p2Index === undefined) return;
      
      const p1 = particles[p1Index];
      const p2 = particles[p2Index];
      
      // calculate rest length if not provided
      if (restLength === null) {
        restLength = p1.position.distanceTo(p2.position);
      }
      
      // add spring
      springs.push({
        p1: p1Index,
        p2: p2Index,
        restLength: restLength,
        stiffness: stiffness
      });
    };
    
    // process all triangles to create springs
    const indices = geometry.index ? geometry.index.array : null;
    
    if (indices) {
      // indexed geometry
      for (let i = 0; i < indices.length; i += 3) {
        const a = indices[i];
        const b = indices[i + 1];
        const c = indices[i + 2];
        
        // create springs for each edge
        addSpring(a, b, this.params.stiffness * 10);
        addSpring(b, c, this.params.stiffness * 10);
        addSpring(c, a, this.params.stiffness * 10);
      }
    } else {
      // non-indexed geometry
      for (let i = 0; i < positions.count; i += 3) {
        const a = i;
        const b = i + 1;
        const c = i + 2;
        
        // create springs for each edge
        addSpring(a, b, this.params.stiffness * 10);
        addSpring(b, c, this.params.stiffness * 10);
        addSpring(c, a, this.params.stiffness * 10);
      }
    }
    
    // create bending springs (between non-adjacent vertices that share a face)
    const bendingSprings = [];
    
    // create a map of vertex pairs that have structural springs
    const structuralPairs = new Set();
    for (const spring of springs) {
      const minIdx = Math.min(spring.p1, spring.p2);
      const maxIdx = Math.max(spring.p1, spring.p2);
      structuralPairs.add(`${minIdx},${maxIdx}`);
    }
    
    // find all triangles sharing a vertex
    const vertexFaces = new Map();
    if (indices) {
      for (let i = 0; i < indices.length; i += 3) {
        const a = indices[i];
        const b = indices[i + 1];
        const c = indices[i + 2];
        
        // add this triangle to each vertex's list
        for (const v of [a, b, c]) {
          if (!vertexFaces.has(v)) {
            vertexFaces.set(v, []);
          }
          vertexFaces.get(v).push(i / 3);
        }
      }
    }
    
    // create bending springs between vertices that share faces but aren't directly connected
    for (const [vertex, faces] of vertexFaces.entries()) {
      // find all vertices in these faces
      const connectedVertices = new Set();
      for (const faceIdx of faces) {
        const i = faceIdx * 3;
        connectedVertices.add(indices[i]);
        connectedVertices.add(indices[i + 1]);
        connectedVertices.add(indices[i + 2]);
      }
      
      // for each connected vertex that isn't directly connected, add a bending spring
      for (const otherVertex of connectedVertices) {
        if (vertex === otherVertex) continue;
        
        const minIdx = Math.min(vertex, otherVertex);
        const maxIdx = Math.max(vertex, otherVertex);
        const key = `${minIdx},${maxIdx}`;
        
        // if this isn't a structural spring, add it as a bending spring
        if (!structuralPairs.has(key)) {
          // map vertex indices to particle indices
          const p1 = particleMap.get(vertex);
          const p2 = particleMap.get(otherVertex);
          
          if (p1 !== undefined && p2 !== undefined) {
            // calculate rest length
            const restLength = particles[p1].position.distanceTo(particles[p2].position);
            
            // bending springs are weaker than structural springs
            bendingSprings.push({
              p1: p1,
              p2: p2,
              restLength: restLength,
              stiffness: this.params.stiffness * 5
            });
            
            // mark this pair as handled
            structuralPairs.add(key);
          }
        }
      }
    }
    
    // store particles and springs in the paper piece
    paperPiece.particles = particles;
    paperPiece.springs = springs;
    paperPiece.bendingSprings = bendingSprings;
    paperPiece.particleMap = particleMap;
  }
  
  // create anchor points to hold the main paper
  createAnchors() {
    // clear existing anchors
    this.anchors = [];
    
    if (!this.mainPaper || !this.mainPaper.mesh) return;
    
    const mesh = this.mainPaper.mesh;
    const geometry = mesh.geometry;
    
    // create two anchor points at the top corners of the paper
    const width = geometry.parameters.width;
    const height = geometry.parameters.height;
    
    // get the top-left and top-right vertices
    const topLeft = new THREE.Vector3(-width/2, height/2, 0);
    const topRight = new THREE.Vector3(width/2, height/2, 0);
    
    // transform to world space
    topLeft.applyMatrix4(mesh.matrixWorld);
    topRight.applyMatrix4(mesh.matrixWorld);
    
    // create anchors
    const leftAnchor = {
      position: topLeft.clone(),
      attachmentPoint: new THREE.Vector3(-width/2, height/2, 0),
      strength: 1.0
    };
    
    const rightAnchor = {
      position: topRight.clone(),
      attachmentPoint: new THREE.Vector3(width/2, height/2, 0),
      strength: 1.0
    };
    
    this.anchors.push(leftAnchor, rightAnchor);
    
    // fix the particles at anchor points
    if (this.mainPaper.particles) {
      const positions = geometry.getAttribute('position');
      const tolerance = 0.1;
      
      for (let i = 0; i < this.mainPaper.particles.length; i++) {
        const particle = this.mainPaper.particles[i];
        
        // get local position 
        const vertex = new THREE.Vector3().fromBufferAttribute(positions, i);
        
        // check if this vertex is at one of the anchor points
        if ((Math.abs(vertex.x - topLeft.x) < tolerance && 
             Math.abs(vertex.y - topLeft.y) < tolerance) ||
            (Math.abs(vertex.x - topRight.x) < tolerance && 
             Math.abs(vertex.y - topRight.y) < tolerance)) {
          // fix this particle
          particle.fixed = true;
        }
      }
    }
    
    // visualize anchors
    this.visualizeAnchors();
  }
  
  // create visual representation of anchors
  visualizeAnchors() {
    // remove existing visualizations
    for (let i = 0; i < this.anchors.length; i++) {
      if (this.anchors[i].visual) {
        this.scene.remove(this.anchors[i].visual);
      }
    }
    
    // create new visualizations
    for (let i = 0; i < this.anchors.length; i++) {
      const anchor = this.anchors[i];
      
      // create a small sphere
      const geometry = new THREE.SphereGeometry(0.5, 16, 16);
      const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
      const sphere = new THREE.Mesh(geometry, material);
      
      // position at anchor point
      sphere.position.copy(anchor.position);
      
      // add to scene
      this.scene.add(sphere);
      
      // store reference
      anchor.visual = sphere;
    }
  }
  
  // create a new cut piece of paper with mass-spring system
  createCutPiece(geometry, position, rotation) {
    // calculate approximate mass based on area
    const area = this.calculateGeometryArea(geometry);
    const fullArea = this.params.paperWidth * this.params.paperHeight;
    const mass = (area / fullArea) * 1.0; // 1.0 is base mass
    
    // create material matching main paper but slightly different color
    const material = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.2,
      metalness: 0.0,
      reflectivity: 0.1,
      clearcoat: 0.1,
      clearcoatRoughness: 0.4,
      side: THREE.DoubleSide
    });
    
    // create mesh
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.copy(position);
    mesh.rotation.copy(rotation);
    
    // add to scene
    this.scene.add(mesh);
    
    // calculate inertia tensor (approximation for an irregular shape)
    const inertia = this.calculateInertia(geometry, mass);
    
    // add small random starting velocities for natural movement
    const randomVelocityX = (Math.random() - 0.5) * 0.2;
    const randomVelocityZ = (Math.random() - 0.5) * 0.2;
    const randomAngVelX = (Math.random() - 0.5) * 0.3;
    const randomAngVelY = (Math.random() - 0.5) * 0.2;
    const randomAngVelZ = (Math.random() - 0.5) * 0.3;
    
    // create physics object
    const cutPiece = {
      mesh: mesh,
      velocity: new THREE.Vector3(randomVelocityX, 0, randomVelocityZ),
      angularVelocity: new THREE.Vector3(randomAngVelX, randomAngVelY, randomAngVelZ),
      mass: mass,
      inertia: inertia,
      isFixed: false,
      isFalling: true,
      age: 0, // track how long it's been falling
      particles: [],
      springs: [],
      bendingSprings: []
    };
    
    // create mass-spring system for bendable paper
    this.createMassSpringSystem(cutPiece);
    
    // add to cut pieces array
    this.cutPieces.push(cutPiece);
    
    return cutPiece;
  }
  
  // calculate the approximate area of a 3D geometry
  calculateGeometryArea(geometry) {
    let area = 0;
    const posAttr = geometry.getAttribute('position');
    
    // process triangles
    for (let i = 0; i < posAttr.count; i += 3) {
      const v1 = new THREE.Vector3().fromBufferAttribute(posAttr, i);
      const v2 = new THREE.Vector3().fromBufferAttribute(posAttr, i + 1);
      const v3 = new THREE.Vector3().fromBufferAttribute(posAttr, i + 2);
      
      // calculate triangle area using cross product
      const sideA = new THREE.Vector3().subVectors(v2, v1);
      const sideB = new THREE.Vector3().subVectors(v3, v1);
      const triangleArea = new THREE.Vector3().crossVectors(sideA, sideB).length() / 2;
      
      area += triangleArea;
    }
    
    return area;
  }
  
  // calculate approximate inertia tensor for the geometry
  calculateInertia(geometry, mass) {
    // get bounds of the geometry
    geometry.computeBoundingBox();
    const bounds = geometry.boundingBox;
    
    // calculate dimensions
    const width = bounds.max.x - bounds.min.x;
    const height = bounds.max.y - bounds.min.y;
    const depth = bounds.max.z - bounds.min.z;
    
    // approximate inertia for a rectangular prism
    const xx = (1/12) * mass * (height*height + depth*depth);
    const yy = (1/12) * mass * (width*width + depth*depth);
    const zz = (1/12) * mass * (width*width + height*height);
    
    // create inertia tensor matrix
    const inertia = new THREE.Matrix3().set(
      xx, 0, 0,
      0, yy, 0,
      0, 0, zz
    );
    
    return inertia;
  }
  
  // apply forces to a particle
  applyForces(particle, paperPiece, deltaTime, time) {
    // reset force
    particle.force.set(0, 0, 0);
    
    // apply gravity
    particle.force.y -= this.gravity * particle.mass;
    
    // apply air resistance (proportional to velocity squared)
    const velocity = particle.velocity.clone();
    const speed = velocity.length();
    
    if (speed > 0.001) {
      const dragDirection = velocity.clone().normalize().negate();
      const dragMagnitude = this.airResistance * speed * speed * 0.1;
      const dragForce = dragDirection.multiplyScalar(dragMagnitude);
      particle.force.add(dragForce);
    }
    
    // apply turbulence
    const turbulence = this.getTurbulence(particle.position, time);
    particle.force.add(turbulence);
  }
  
  // update springs for a paper piece
  updateSprings(paperPiece, deltaTime) {
    // structural springs
    for (const spring of paperPiece.springs) {
      const p1 = paperPiece.particles[spring.p1];
      const p2 = paperPiece.particles[spring.p2];
      
      // calculate current length
      const delta = new THREE.Vector3().subVectors(p2.position, p1.position);
      const currentLength = delta.length();
      
      // skip if length is zero
      if (currentLength === 0) continue;
      
      // calculate force magnitude
      const forceMagnitude = spring.stiffness * (currentLength - spring.restLength);
      
      // calculate force direction
      const forceDir = delta.normalize();
      
      // apply force to both particles
      if (!p1.fixed) {
        p1.force.addScaledVector(forceDir, forceMagnitude);
      }
      
      if (!p2.fixed) {
        p2.force.addScaledVector(forceDir, -forceMagnitude);
      }
    }
    
    // bending springs
    for (const spring of paperPiece.bendingSprings) {
      const p1 = paperPiece.particles[spring.p1];
      const p2 = paperPiece.particles[spring.p2];
      
      // calculate current length
      const delta = new THREE.Vector3().subVectors(p2.position, p1.position);
      const currentLength = delta.length();
      
      // skip if length is zero
      if (currentLength === 0) continue;
      
      // calculate force magnitude
      const forceMagnitude = spring.stiffness * (currentLength - spring.restLength);
      
      // calculate force direction
      const forceDir = delta.normalize();
      
      // apply force to both particles
      if (!p1.fixed) {
        p1.force.addScaledVector(forceDir, forceMagnitude);
      }
      
      if (!p2.fixed) {
        p2.force.addScaledVector(forceDir, -forceMagnitude);
      }
    }
  }
  
  // update a paper piece using mass-spring physics
  updatePaperPiece(paperPiece, deltaTime, time) {
    // apply forces to all particles
    for (const particle of paperPiece.particles) {
      this.applyForces(particle, paperPiece, deltaTime, time);
    }
    
    // update springs
    this.updateSprings(paperPiece, deltaTime);
    
    // integrate forces
    for (const particle of paperPiece.particles) {
      if (particle.fixed) continue;
      
      // calculate acceleration
      const acceleration = particle.force.clone().divideScalar(particle.mass);
      
      // save current position
      const oldPosition = particle.position.clone();
      
      // verlet integration
      const newPosition = particle.position.clone()
        .multiplyScalar(2)
        .sub(particle.lastPosition)
        .add(acceleration.multiplyScalar(deltaTime * deltaTime));
      
      // update positions
      particle.lastPosition = particle.position.clone();
      particle.position.copy(newPosition);
      
      // update velocity (for force calculations)
      particle.velocity.subVectors(particle.position, oldPosition).divideScalar(deltaTime);
    }
    
    // enforce a maximum velocity on particles
    const maxSpeed = 10;
    for (const particle of paperPiece.particles) {
      const speed = particle.velocity.length();
      if (speed > maxSpeed) {
        particle.velocity.multiplyScalar(maxSpeed / speed);
      }
    }
    
    // update mesh vertices to match particle positions
    this.updatePaperMesh(paperPiece);
  }
  
  // update mesh vertices based on particle positions
  updatePaperMesh(paperPiece) {
    const mesh = paperPiece.mesh;
    const geometry = mesh.geometry;
    const positions = geometry.getAttribute('position');
    
    // update vertex positions based on particles
    for (let i = 0; i < positions.count; i++) {
      const particleIndex = paperPiece.particleMap.get(i);
      
      if (particleIndex !== undefined) {
        const particle = paperPiece.particles[particleIndex];
        
        // convert world position to local
        const localPos = particle.position.clone().applyMatrix4(mesh.matrixWorld.clone().invert());
        
        // update vertex position
        positions.setXYZ(i, localPos.x, localPos.y, localPos.z);
      }
    }
    
    // mark geometry as needing update
    positions.needsUpdate = true;
    geometry.computeVertexNormals();
  }
  
  // update physics for all cut pieces
  update(deltaTime, elapsedTime) {
    // update each cut piece
    for (let i = this.cutPieces.length - 1; i >= 0; i--) {
      const piece = this.cutPieces[i];
      
      // skip non-falling pieces
      if (!piece.isFalling) continue;
      
      // increment age
      piece.age += deltaTime;
      
      // update using mass-spring system
      this.updatePaperPiece(piece, deltaTime, elapsedTime);
      
      // check if piece is below ground plane
      const lowestPoint = this.getLowestPoint(piece);
      
      if (lowestPoint < -40 || piece.age > 10) {
        piece.isFalling = false;
        
        // fade out and remove
        this.fadeOutAndRemove(piece, i);
      }
    }
  }
  
  // get the lowest Y coordinate of any particle in a paper piece
  getLowestPoint(paperPiece) {
    let lowestY = Infinity;
    
    for (const particle of paperPiece.particles) {
      if (particle.position.y < lowestY) {
        lowestY = particle.position.y;
      }
    }
    
    return lowestY;
  }
  
  // fade out and remove a cut piece
  fadeOutAndRemove(piece, index) {
    // animate opacity to fade out
    const fadeOut = () => {
      if (piece.mesh.material.opacity > 0.05) {
        piece.mesh.material.opacity -= 0.05;
        setTimeout(fadeOut, 100);
      } else {
        // remove mesh from scene
        this.scene.remove(piece.mesh);
        piece.mesh.geometry.dispose();
        piece.mesh.material.dispose();
        
        // remove from cut pieces array if still there
        const currentIndex = this.cutPieces.indexOf(piece);
        if (currentIndex >= 0) {
          this.cutPieces.splice(currentIndex, 1);
        }
      }
    };
    
    // make material transparent
    piece.mesh.material.transparent = true;
    
    // start fade out
    fadeOut();
  }
  
  // remove all cut pieces
  clearCutPieces() {
    for (let i = this.cutPieces.length - 1; i >= 0; i--) {
      const piece = this.cutPieces[i];
      
      // remove from scene
      this.scene.remove(piece.mesh);
      
      // dispose resources
      if (piece.mesh.geometry) piece.mesh.geometry.dispose();
      if (piece.mesh.material) piece.mesh.material.dispose();
    }
    
    // clear array
    this.cutPieces = [];
  }
  
  // update physics parameters
  updateParameters(params) {
    this.stiffness = params.stiffness;
    this.airResistance = params.airResistance;
    this.gravity = params.gravity;
    
    // update spring stiffness for all pieces
    const updateSpringsStiffness = (paperPiece) => {
      if (!paperPiece || !paperPiece.springs) return;
      
      for (const spring of paperPiece.springs) {
        spring.stiffness = this.stiffness * 10;
      }
      
      for (const spring of paperPiece.bendingSprings) {
        spring.stiffness = this.stiffness * 5;
      }
    };
    
    // update main paper
    updateSpringsStiffness(this.mainPaper);
    
    // update all cut pieces
    for (const piece of this.cutPieces) {
      updateSpringsStiffness(piece);
    }
  }
}