/**
 * paper-physics.js
 * manages the physics simulation for the paper cutting system
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
    
    // anchors for hanging paper
    this.anchors = [];
    
    // create ground plane for detecting when to stop simulation
    this.createGroundPlane();
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
      isFixed: true  // main paper is fixed/hanging
    };
    
    // create anchors for the main paper
    this.createAnchors();
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
  
  // create a new cut piece of paper
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
    
    // create physics object
    const cutPiece = {
      mesh: mesh,
      velocity: new THREE.Vector3(0, 0, 0),
      angularVelocity: new THREE.Vector3(0, -0.2, 0), // slight initial spin
      mass: mass,
      inertia: inertia,
      isFixed: false,
      isFalling: true,
      age: 0 // track how long it's been falling
    };
    
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
  
  // update physics for all cut pieces
  update(deltaTime) {
    // update each cut piece
    for (let i = this.cutPieces.length - 1; i >= 0; i--) {
      const piece = this.cutPieces[i];
      
      // skip non-falling pieces
      if (!piece.isFalling) continue;
      
      // increment age
      piece.age += deltaTime;
      
      // apply gravity
      piece.velocity.y -= this.gravity * deltaTime;
      
      // apply air resistance
      const dragFactor = this.airResistance * 0.1; // scale to reasonable values
      const velocityMagnitude = piece.velocity.length();
      
      if (velocityMagnitude > 0.001) {
        // drag is proportional to velocity squared in the opposite direction
        const dragForce = piece.velocity.clone().normalize();
        dragForce.multiplyScalar(-dragFactor * velocityMagnitude * velocityMagnitude);
        
        // apply drag force (F = ma, so a = F/m)
        const acceleration = dragForce.divideScalar(piece.mass);
        piece.velocity.addScaledVector(acceleration, deltaTime);
      }
      
      // apply air resistance to angular velocity
      const angularDrag = this.airResistance * 2.0; // stronger for rotation
      const angularSpeed = piece.angularVelocity.length();
      
      if (angularSpeed > 0.001) {
        // reduce angular velocity
        piece.angularVelocity.multiplyScalar(1.0 - (angularDrag * deltaTime));
      }
      
      // calculate lift effect based on orientation and velocity
      this.applyLiftForce(piece, deltaTime);
      
      // update position
      piece.mesh.position.addScaledVector(piece.velocity, deltaTime);
      
      // update rotation using quaternions (more stable for 3D rotation)
      const rotationDelta = piece.angularVelocity.clone().multiplyScalar(deltaTime);
      const quaternion = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(rotationDelta.x, rotationDelta.y, rotationDelta.z)
      );
      piece.mesh.quaternion.premultiply(quaternion);
      
      // check if piece has hit the ground plane or is too old
      if (piece.mesh.position.y < -40 || piece.age > 10) {
        piece.isFalling = false;
        
        // fade out and remove
        this.fadeOutAndRemove(piece, i);
      }
    }
  }
  
  // apply lift force to simulate paper aerodynamics
  applyLiftForce(piece, deltaTime) {
    // get the normal of the paper (assuming Z-axis is normal when flat)
    const normal = new THREE.Vector3(0, 0, 1);
    normal.applyQuaternion(piece.mesh.quaternion);
    normal.normalize();
    
    // get current velocity direction
    const velocityDir = piece.velocity.clone().normalize();
    
    // calculate the alignment of paper normal with velocity
    // (dot product near 0 means perpendicular = maximum lift)
    const alignment = Math.abs(normal.dot(velocityDir));
    const liftCoefficient = (1 - alignment) * 0.5; // max lift when perpendicular
    
    // calculate lift force perpendicular to velocity and paper normal
    const liftDir = new THREE.Vector3().crossVectors(velocityDir, normal);
    liftDir.cross(velocityDir); // make perpendicular to velocity
    liftDir.normalize();
    
    // lift force proportional to velocity squared
    const velocityMagnitude = piece.velocity.length();
    const liftMagnitude = liftCoefficient * velocityMagnitude * velocityMagnitude * 0.2;
    
    // apply lift force
    const liftForce = liftDir.multiplyScalar(liftMagnitude);
    
    // add to velocity (F = ma, so a = F/m)
    piece.velocity.addScaledVector(liftForce.divideScalar(piece.mass), deltaTime);
    
    // calculate torque caused by lift (creating rotations)
    // assuming lift is applied at center of mass for simplicity
    const torque = new THREE.Vector3().crossVectors(
      new THREE.Vector3(0, 0, 0), // force arm (from center)
      liftForce
    );
    
    // apply torque to angular velocity
    const inertiaInv = new THREE.Matrix3().copy(piece.inertia).invert();
    const angularAcceleration = new THREE.Vector3()
      .applyMatrix3(inertiaInv)
      .multiply(torque);
      
    piece.angularVelocity.addScaledVector(angularAcceleration, deltaTime);
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
  }
}