/**
 * new-paper-physics.js
 * completely rebuilt paper physics system for realistic paper cutting and falling
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
    this.gravity = params.gravity || 9.8;
    this.stiffness = params.stiffness || 0.5;
    this.airResistance = params.airResistance || 0.7;
    
    // ground plane for collision detection
    this.groundY = -50;
    this.createGroundPlane();
    
    // debug visualization
    this.debugObjects = [];
    this.debugMode = false;

    console.log("PaperPhysics initialized");
  }
  
  createGroundPlane() {
    // invisible ground plane
    const groundGeometry = new THREE.PlaneGeometry(500, 500);
    const groundMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff, 
      transparent: true,
      opacity: 0.0,
      side: THREE.DoubleSide
    });
    
    this.groundPlane = new THREE.Mesh(groundGeometry, groundMaterial);
    this.groundPlane.rotation.x = -Math.PI / 2;
    this.groundPlane.position.y = this.groundY;
    this.groundPlane.receiveShadow = true;
    this.scene.add(this.groundPlane);
  }
  
  // Initialize the main paper
  initializeMainPaper(paperMesh) {
    if (!paperMesh || !paperMesh.geometry) {
      console.error("Cannot initialize main paper: paperMesh is undefined or has no geometry");
      return;
    }
    
    console.log("Initializing main paper with geometry:", paperMesh.geometry);
    
    // Store reference to the main paper
    this.mainPaper = {
      mesh: paperMesh,
      fixedPoints: [], // Points that don't move (top corners)
      isFixed: true    // Main paper is fixed/hanging
    };
    
    // Create anchors
    this.createAnchors();
  }
  
  // Create anchor points for the main paper
  createAnchors() {
    try {
      if (!this.mainPaper || !this.mainPaper.mesh) {
        console.warn("Cannot create anchors: main paper is undefined");
        return;
      }
      
      const mesh = this.mainPaper.mesh;
      
      // Clear existing fixed points
      this.mainPaper.fixedPoints = [];
      
      // Get paper dimensions
      let width = 0, height = 0;
      
      if (mesh.geometry.parameters) {
        // For PlaneGeometry
        width = mesh.geometry.parameters.width;
        height = mesh.geometry.parameters.height;
      } else if (mesh.geometry.boundingBox) {
        // For other geometries
        width = mesh.geometry.boundingBox.max.x - mesh.geometry.boundingBox.min.x;
        height = mesh.geometry.boundingBox.max.y - mesh.geometry.boundingBox.min.y;
      } else {
        // Compute bounding box if needed
        mesh.geometry.computeBoundingBox();
        if (mesh.geometry.boundingBox) {
          width = mesh.geometry.boundingBox.max.x - mesh.geometry.boundingBox.min.x;
          height = mesh.geometry.boundingBox.max.y - mesh.geometry.boundingBox.min.y;
        } else {
          // Fallback to params
          width = this.params.paperWidth;
          height = this.params.paperHeight;
          console.warn("Using fallback paper dimensions:", width, height);
        }
      }
      
      // Create two anchor points at the top corners in local space
      const topLeft = new THREE.Vector3(-width/2, height/2, 0);
      const topRight = new THREE.Vector3(width/2, height/2, 0);
      
      // Store these as fixed points
      this.mainPaper.fixedPoints = [topLeft, topRight];
      
      console.log("Created anchors at", topLeft, topRight);
      
      // Visualize anchors in debug mode
      if (this.debugMode) {
        this.visualizeAnchors();
      }
    } catch (e) {
      console.error("Error in createAnchors:", e);
    }
  }
  
  // Visualize anchors for debugging
  visualizeAnchors() {
    // Remove existing visualizations
    this.debugObjects = this.debugObjects.filter(obj => {
      if (obj.isAnchor) {
        this.scene.remove(obj);
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) obj.material.dispose();
        return false;
      }
      return true;
    });
    
    // Create visual representations of anchors
    if (this.mainPaper && this.mainPaper.fixedPoints) {
      this.mainPaper.fixedPoints.forEach(point => {
        // Convert to world coordinates
        const worldPoint = point.clone();
        if (this.mainPaper.mesh) {
          worldPoint.applyMatrix4(this.mainPaper.mesh.matrixWorld);
        }
        
        // Create a small sphere
        const geometry = new THREE.SphereGeometry(0.5, 8, 8);
        const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        const sphere = new THREE.Mesh(geometry, material);
        sphere.position.copy(worldPoint);
        sphere.isAnchor = true; // Mark for later identification
        
        this.scene.add(sphere);
        this.debugObjects.push(sphere);
      });
    }
  }
  
  // Create a new cut piece of paper
  createCutPiece(geometry, position, rotation, material) {
    if (!geometry) {
      console.error("Cannot create cut piece: geometry is undefined");
      return null;
    }
    
    try {
      console.log("Creating cut piece from geometry");
      
      // Clone the geometry to make sure it's independent
      const clonedGeometry = geometry.clone();
      
      // Ensure geometry has valid properties
      this.validateGeometry(clonedGeometry);
      
      // Calculate approximate mass based on number of vertices
      const vertexCount = clonedGeometry.getAttribute('position').count;
      const mass = vertexCount / 500; // Simple approximation
      
      // Create a physics representation
      const cutPiece = {
        // Basic properties
        mesh: null,
        geometry: clonedGeometry,
        mass: Math.max(0.1, Math.min(2.0, mass)), // Clamp mass to reasonable values
        
        // Physics state
        position: position.clone(),
        rotation: new THREE.Euler().copy(rotation),
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 2,  // Random initial velocity
          0,
          (Math.random() - 0.5) * 2
        ),
        angularVelocity: new THREE.Vector3(
          (Math.random() - 0.5) * 0.5,  // Random initial rotation
          (Math.random() - 0.5) * 0.5,
          (Math.random() - 0.5) * 0.5
        ),
        
        // Status flags
        isFixed: false,
        isFalling: true,
        age: 0,
        
        // Visual properties for fadeout
        opacity: 1.0
      };
      
      // Create material if not provided
      let meshMaterial;
      if (material) {
        meshMaterial = material.clone();
      } else {
        meshMaterial = new THREE.MeshStandardMaterial({
          color: 0xffffff,
          side: THREE.DoubleSide,
          roughness: 0.7,
          metalness: 0.1
        });
      }
      
      // Create mesh
      const mesh = new THREE.Mesh(clonedGeometry, meshMaterial);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      
      // Set position and rotation
      mesh.position.copy(position);
      mesh.rotation.copy(rotation);
      
      // Store mesh reference
      cutPiece.mesh = mesh;
      
      // Add to scene
      this.scene.add(mesh);
      
      // Add to cut pieces array
      this.cutPieces.push(cutPiece);
      
      console.log("Created cut piece with", vertexCount, "vertices");
      return cutPiece;
      
    } catch (e) {
      console.error("Error creating cut piece:", e);
      return null;
    }
  }
  
  // Validate and fix geometry if needed
  validateGeometry(geometry) {
    if (!geometry) return;
    
    try {
      // Ensure position attribute exists
      if (!geometry.getAttribute('position')) {
        console.error("Geometry missing position attribute");
        return;
      }
      
      // Ensure normals
      if (!geometry.getAttribute('normal')) {
        geometry.computeVertexNormals();
      }
      
      // Ensure UVs (create basic ones if missing)
      if (!geometry.getAttribute('uv')) {
        const positions = geometry.getAttribute('position');
        const uvs = new Float32Array(positions.count * 2);
        
        // Create basic UVs based on position
        for (let i = 0; i < positions.count; i++) {
          const x = positions.getX(i);
          const y = positions.getY(i);
          
          // Simple UV mapping based on position
          uvs[i * 2] = (x + 15) / 30; // Assuming paper width is 30
          uvs[i * 2 + 1] = (y + 20) / 40; // Assuming paper height is 40
        }
        
        geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
      }
      
      // Ensure bounding box and sphere for proper rendering and picking
      geometry.computeBoundingBox();
      
      // Safely compute bounding sphere
      try {
        geometry.computeBoundingSphere();
      } catch (e) {
        console.warn("Error computing bounding sphere, creating fallback", e);
        
        // Create fallback bounding sphere
        if (geometry.boundingBox) {
          const center = new THREE.Vector3();
          geometry.boundingBox.getCenter(center);
          
          const radius = center.distanceTo(geometry.boundingBox.max);
          geometry.boundingSphere = new THREE.Sphere(center, radius);
        } else {
          // Very generic fallback
          geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 10);
        }
      }
      
      // Fix any NaN values in positions
      const positions = geometry.getAttribute('position');
      let hasNaN = false;
      
      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const y = positions.getY(i);
        const z = positions.getZ(i);
        
        if (isNaN(x) || isNaN(y) || isNaN(z)) {
          hasNaN = true;
          positions.setXYZ(i, 0, 0, 0);
        }
      }
      
      if (hasNaN) {
        console.warn("Fixed NaN values in geometry");
        positions.needsUpdate = true;
      }
    } catch (e) {
      console.error("Error validating geometry:", e);
    }
  }
  
  // Update physics for a single falling paper piece
  updatePiece(piece, deltaTime) {
    if (!piece || !piece.mesh || !piece.isFalling) return;
    
    // Apply forces
    const gravity = new THREE.Vector3(0, -this.gravity, 0);
    
    // Calculate air resistance based on orientation
    const velocity = piece.velocity.clone();
    const speed = velocity.length();
    
    // Apply gravity
    piece.velocity.addScaledVector(gravity, deltaTime);
    
    // Air resistance
    if (speed > 0.01) {
      // Get the current up vector of the paper
      const normal = new THREE.Vector3(0, 0, 1);
      normal.applyQuaternion(piece.mesh.quaternion);
      
      // Calculate drag coefficient based on angle between velocity and normal
      const dot = Math.abs(normal.dot(velocity.clone().normalize()));
      
      // More drag when paper faces into airflow (higher coefficient when perpendicular)
      const dragCoeff = this.airResistance * (0.2 + 0.8 * dot * dot);
      
      // Apply quadratic drag
      const drag = velocity.clone().normalize().negate();
      drag.multiplyScalar(dragCoeff * speed * speed * deltaTime);
      
      piece.velocity.add(drag);
    }
    
    // Add random turbulence
    const turbulence = new THREE.Vector3(
      (Math.random() - 0.5) * 0.5,
      (Math.random() - 0.5) * 0.2,
      (Math.random() - 0.5) * 0.5
    );
    turbulence.multiplyScalar(deltaTime * 2);
    piece.velocity.add(turbulence);
    
    // Apply torque for rotation
    const torque = new THREE.Vector3(
      (Math.random() - 0.5) * 0.5,
      (Math.random() - 0.5) * 0.3,
      (Math.random() - 0.5) * 0.5
    );
    torque.multiplyScalar(deltaTime);
    piece.angularVelocity.add(torque);
    
    // Damping on angular velocity
    piece.angularVelocity.multiplyScalar(0.98);
    
    // Update position
    piece.mesh.position.addScaledVector(piece.velocity, deltaTime);
    
    // Update rotation
    const rotationIncrement = piece.angularVelocity.clone().multiplyScalar(deltaTime);
    piece.mesh.rotation.x += rotationIncrement.x;
    piece.mesh.rotation.y += rotationIncrement.y;
    piece.mesh.rotation.z += rotationIncrement.z;
    
    // Check if piece has fallen below ground
    if (piece.mesh.position.y < this.groundY) {
      piece.isFalling = false;
      this.startFadeOut(piece);
    }
    
    // Update age
    piece.age += deltaTime;
    
    // Remove pieces that have been falling too long
    if (piece.age > 15) {
      piece.isFalling = false;
      this.startFadeOut(piece);
    }
  }
  
  // Start fading out a piece
  startFadeOut(piece) {
    if (!piece || !piece.mesh) return;
    
    // Make sure material is set to transparent
    if (piece.mesh.material) {
      piece.mesh.material.transparent = true;
    }
  }
  
  // Main update function called each frame
  update(deltaTime, elapsedTime) {
    // Safety-check deltaTime
    if (isNaN(deltaTime) || deltaTime <= 0) {
      deltaTime = 1/60;
    }
    
    // Cap deltaTime to avoid instability
    deltaTime = Math.min(deltaTime, 1/30);
    
    // Update each cut piece
    for (let i = this.cutPieces.length - 1; i >= 0; i--) {
      const piece = this.cutPieces[i];
      
      if (piece.isFalling) {
        // Update physics
        this.updatePiece(piece, deltaTime);
      } else {
        // Handle fadeout
        if (piece.mesh && piece.mesh.material) {
          piece.mesh.material.opacity -= 0.02;
          
          // Remove when fully transparent
          if (piece.mesh.material.opacity <= 0) {
            this.scene.remove(piece.mesh);
            
            // Clean up resources
            if (piece.mesh.geometry) piece.mesh.geometry.dispose();
            if (piece.mesh.material) piece.mesh.material.dispose();
            
            // Remove from array
            this.cutPieces.splice(i, 1);
          }
        } else {
          // If no mesh or material, remove directly
          if (piece.mesh) this.scene.remove(piece.mesh);
          this.cutPieces.splice(i, 1);
        }
      }
    }
    
    // Update debug visualizations if enabled
    if (this.debugMode) {
      this.updateDebugVisuals();
    }
  }
  
  // Update debug visualizations
  updateDebugVisuals() {
    // Update anchor visualizations
    if (this.mainPaper && this.mainPaper.mesh && this.mainPaper.fixedPoints) {
      const anchors = this.debugObjects.filter(obj => obj.isAnchor);
      
      for (let i = 0; i < Math.min(anchors.length, this.mainPaper.fixedPoints.length); i++) {
        const worldPoint = this.mainPaper.fixedPoints[i].clone()
          .applyMatrix4(this.mainPaper.mesh.matrixWorld);
        
        anchors[i].position.copy(worldPoint);
      }
    }
  }
  
  // Clear all cut pieces
  clearCutPieces() {
    for (const piece of this.cutPieces) {
      if (piece.mesh) {
        this.scene.remove(piece.mesh);
        
        // Clean up resources
        if (piece.mesh.geometry) piece.mesh.geometry.dispose();
        if (piece.mesh.material) piece.mesh.material.dispose();
      }
    }
    
    this.cutPieces = [];
    console.log("Cleared all cut pieces");
  }
  
  // Update physics parameters
  updateParameters(params) {
    this.stiffness = params.stiffness || 0.5;
    this.airResistance = params.airResistance || 0.7;
    this.gravity = params.gravity || 9.8;
    
    console.log("Updated physics parameters:", 
      "stiffness =", this.stiffness,
      "airResistance =", this.airResistance,
      "gravity =", this.gravity);
  }
  
  // Toggle debug visualizations
  toggleDebugVisualization() {
    this.debugMode = !this.debugMode;
    
    // Clean up existing debug objects that aren't anchors
    this.debugObjects = this.debugObjects.filter(obj => {
      if (!obj.isAnchor) {
        this.scene.remove(obj);
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) obj.material.dispose();
        return false;
      }
      return true;
    });
    
    if (this.debugMode) {
      this.visualizeAnchors();
    }
    
    return this.debugMode;
  }
}