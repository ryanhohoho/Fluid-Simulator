/**
 * cutting-system.js
 * handles the paper cutting functionality
 */

class CuttingSystem {
  constructor(scene, camera, paperMesh, physicsSystem, params) {
    this.scene = scene;
    this.camera = camera;
    this.paperMesh = paperMesh;
    this.physicsSystem = physicsSystem;
    this.params = params;
    
    // cutting state
    this.isCutting = false;
    this.cutPoints = [];
    this.cutLine = null;
    
    // raycaster for intersection detection
    this.raycaster = new THREE.Raycaster();
    this.raycaster.params.Line = { threshold: 0.2 };
    
    // visual elements
    this.createCutVisualizer();
  }
  
  // create visual elements for cutting
  createCutVisualizer() {
    // create cut line material
    const material = new THREE.LineBasicMaterial({ 
      color: 0xff0000,
      linewidth: 2,
      opacity: 0.7,
      transparent: true
    });
    
    // create empty geometry
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([], 3));
    
    // create line
    this.cutLine = new THREE.Line(geometry, material);
    this.scene.add(this.cutLine);
    
    // create cut visualization plane
    const planeGeometry = new THREE.PlaneGeometry(1, 1);
    const planeMaterial = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      opacity: 0.2,
      transparent: true,
      side: THREE.DoubleSide
    });
    
    this.cutPlane = new THREE.Mesh(planeGeometry, planeMaterial);
    this.cutPlane.visible = false;
    this.scene.add(this.cutPlane);
  }
  
  // start cutting with first point
  startCutting(mouseX, mouseY) {
    if (this.isCutting) return;
    
    // convert mouse coordinates to normalized device coordinates
    const mouse = new THREE.Vector2(
      (mouseX / window.innerWidth) * 2 - 1,
      -(mouseY / window.innerHeight) * 2 + 1
    );
    
    // update raycaster
    this.raycaster.setFromCamera(mouse, this.camera);
    
    // intersect with main paper
    if (!this.paperMesh.mesh) return;
    
    const intersects = this.raycaster.intersectObject(this.paperMesh.mesh);
    
    if (intersects.length > 0) {
      this.isCutting = true;
      this.cutPoints = [intersects[0].point.clone()];
      
      // update cut line visualization
      this.updateCutLine();
      
      console.log("Started cutting at", this.cutPoints[0]);
    }
  }
  
  // update cutting with new point
  updateCutting(mouseX, mouseY) {
    if (!this.isCutting) return;
    
    // convert mouse coordinates to normalized device coordinates
    const mouse = new THREE.Vector2(
      (mouseX / window.innerWidth) * 2 - 1,
      -(mouseY / window.innerHeight) * 2 + 1
    );
    
    // update raycaster
    this.raycaster.setFromCamera(mouse, this.camera);
    
    // intersect with main paper
    if (!this.paperMesh.mesh) return;
    
    const intersects = this.raycaster.intersectObject(this.paperMesh.mesh);
    
    if (intersects.length > 0) {
      // check if point is different enough from last point
      const lastPoint = this.cutPoints[this.cutPoints.length - 1];
      const newPoint = intersects[0].point.clone();
      
      if (newPoint.distanceTo(lastPoint) > 0.2) {
        this.cutPoints.push(newPoint);
        
        // update cut line visualization
        this.updateCutLine();
      }
    }
  }
  
  // end cutting and perform cut
  endCutting() {
    if (!this.isCutting) return;
    
    // need at least 2 points for a cut
    if (this.cutPoints.length >= 2) {
      // perform the cut
      this.performCut();
    }
    
    // reset cutting state
    this.isCutting = false;
    this.cutPoints = [];
    
    // clear cut line visualization
    this.updateCutLine();
  }
  
  // update cut line visualization
  updateCutLine() {
    if (!this.cutLine) return;
    
    // if no points or not cutting, hide line
    if (this.cutPoints.length === 0 || !this.isCutting) {
      this.cutLine.visible = false;
      return;
    }
    
    // extract positions for line geometry
    const positions = [];
    for (const point of this.cutPoints) {
      positions.push(point.x, point.y, point.z);
    }
    
    // update line geometry
    this.cutLine.geometry.dispose();
    this.cutLine.geometry = new THREE.BufferGeometry();
    this.cutLine.geometry.setAttribute(
      'position', 
      new THREE.Float32BufferAttribute(positions, 3)
    );
    
    // show line
    this.cutLine.visible = true;
  }
  
  // perform the cut operation
  performCut() {
    if (!this.paperMesh.mesh) return;
    
    console.log("Performing cut with", this.cutPoints.length, "points");
    
    // save original paper geometry and transform
    const originalGeometry = this.paperMesh.mesh.geometry;
    const originalPosition = this.paperMesh.mesh.position.clone();
    const originalRotation = this.paperMesh.mesh.rotation.clone();
    const originalScale = this.paperMesh.mesh.scale.clone();
    
    // create a cut plane from the cut points
    const cutPlane = this.createCutPlane();
    if (!cutPlane) {
      console.error("Failed to create cut plane");
      return;
    }
    
    // split the mesh along the cut plane
    const { aboveMesh, belowMesh } = this.splitMeshByPlane(
      originalGeometry, 
      cutPlane.normal, 
      cutPlane.constant
    );
    
    if (!aboveMesh || !belowMesh) {
      console.error("Mesh splitting failed");
      return;
    }
    
    // determine which piece is above and which is below
    // (in this case, "above" will stay fixed to the top)
    let fallingGeometry, stayingGeometry;
    
    // determine if cut piece should fall or stay
    // based on whether the cut piece contains top corners
    const staysAbove = this.doesGeometryContainTopCorners(aboveMesh);
    
    if (staysAbove) {
      stayingGeometry = aboveMesh;
      fallingGeometry = belowMesh;
    } else {
      stayingGeometry = belowMesh;
      fallingGeometry = aboveMesh;
    }
    
    // replace main paper mesh with new geometry
    this.paperMesh.mesh.geometry.dispose();
    this.paperMesh.mesh.geometry = stayingGeometry;
    
    // create physics for the falling piece
    this.physicsSystem.createCutPiece(
      fallingGeometry,
      originalPosition.clone(),
      originalRotation.clone()
    );
    
    // update anchors for the main paper
    this.physicsSystem.createAnchors();
    
    console.log("Cut complete");
    
    // play a cutting sound effect
    this.playCuttingSound();
  }
  
  // create a plane from the cut points
  createCutPlane() {
    if (this.cutPoints.length < 3) {
      // for straight cuts (2 points), create a plane perpendicular to paper
      if (this.cutPoints.length === 2) {
        const start = this.cutPoints[0];
        const end = this.cutPoints[1];
        
        // paper normal (assuming z is normal to paper)
        const paperNormal = new THREE.Vector3(0, 0, 1);
        paperNormal.applyQuaternion(this.paperMesh.mesh.quaternion);
        
        // direction of cut
        const cutDirection = new THREE.Vector3().subVectors(end, start).normalize();
        
        // plane normal (perpendicular to both paper normal and cut direction)
        const planeNormal = new THREE.Vector3().crossVectors(cutDirection, paperNormal).normalize();
        
        // calculate plane constant (d in ax + by + cz + d = 0)
        const planeConstant = -planeNormal.dot(start);
        
        // visualize cut plane
        this.visualizeCutPlane(planeNormal, planeConstant);
        
        return { normal: planeNormal, constant: planeConstant };
      }
      
      return null;
    }
    
    // for curved cuts (more than 2 points), fit a plane to the points
    // using least squares method
    
    // first, calculate the centroid of the points
    const centroid = new THREE.Vector3();
    for (const point of this.cutPoints) {
      centroid.add(point);
    }
    centroid.divideScalar(this.cutPoints.length);
    
    // build the covariance matrix
    let xx = 0, xy = 0, xz = 0, yy = 0, yz = 0, zz = 0;
    
    for (const point of this.cutPoints) {
      const dx = point.x - centroid.x;
      const dy = point.y - centroid.y;
      const dz = point.z - centroid.z;
      
      xx += dx * dx;
      xy += dx * dy;
      xz += dx * dz;
      yy += dy * dy;
      yz += dy * dz;
      zz += dz * dz;
    }
    
    // create the covariance matrix
    const covMatrix = [
      [xx, xy, xz],
      [xy, yy, yz],
      [xz, yz, zz]
    ];
    
    // find the eigenvector with the smallest eigenvalue
    // (this is a simplified approach - for real applications, use a linear algebra library)
    const planeNormal = this.findSmallestEigenvector(covMatrix);
    
    // calculate plane constant (d in ax + by + cz + d = 0)
    const planeConstant = -planeNormal.dot(centroid);
    
    // visualize cut plane
    this.visualizeCutPlane(planeNormal, planeConstant);
    
    return { normal: planeNormal, constant: planeConstant };
  }
  
  // visualize the cut plane (for debugging)
  visualizeCutPlane(normal, constant) {
    if (!this.cutPlane) return;
    
    // make a large square plane
    const size = 50;
    this.cutPlane.geometry.dispose();
    this.cutPlane.geometry = new THREE.PlaneGeometry(size, size);
    
    // align with normal direction
    this.cutPlane.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      normal
    );
    
    // position the plane at the correct distance from origin
    const dist = -constant;
    this.cutPlane.position.copy(normal.clone().multiplyScalar(dist));
    
    // show briefly, then hide
    this.cutPlane.visible = true;
    setTimeout(() => {
      this.cutPlane.visible = false;
    }, 500);
  }
  
  // find eigenvector with smallest eigenvalue (simplified)
  findSmallestEigenvector(matrix) {
    // this is a simplified approach - for real applications, use a linear algebra library
    // we use the power iteration method to find eigenvector with smallest eigenvalue
    
    // create a 3D identity matrix
    const identity = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1]
    ];
    
    // find the trace (sum of diagonal elements)
    const trace = matrix[0][0] + matrix[1][1] + matrix[2][2];
    
    // create B = trace(A)I - A (to convert max eigenvalue problem to min eigenvalue)
    const B = [
      [trace - matrix[0][0], -matrix[0][1], -matrix[0][2]],
      [-matrix[1][0], trace - matrix[1][1], -matrix[1][2]],
      [-matrix[2][0], -matrix[2][1], trace - matrix[2][2]]
    ];
    
    // start with a random vector
    let v = new THREE.Vector3(Math.random(), Math.random(), Math.random()).normalize();
    
    // power iteration (5 iterations should be enough for our purpose)
    for (let i = 0; i < 5; i++) {
      // multiply B * v
      const x = B[0][0] * v.x + B[0][1] * v.y + B[0][2] * v.z;
      const y = B[1][0] * v.x + B[1][1] * v.y + B[1][2] * v.z;
      const z = B[2][0] * v.x + B[2][1] * v.y + B[2][2] * v.z;
      
      // update v and normalize
      v.set(x, y, z).normalize();
    }
    
    return v;
  }
  
  // split a mesh by a plane
  splitMeshByPlane(geometry, planeNormal, planeConstant) {
    // create temp arrays for vertices that end up in each half
    const abovePositions = [];
    const aboveNormals = [];
    const aboveUvs = [];
    
    const belowPositions = [];
    const belowNormals = [];
    const belowUvs = [];
    
    // get attributes from original geometry
    const positions = geometry.getAttribute('position');
    const normals = geometry.getAttribute('normal');
    const uvs = geometry.getAttribute('uv');
    
    // get indices if indexed geometry
    const indices = geometry.index ? geometry.index.array : null;
    
    // process triangles
    const processTriangle = (vA, vB, vC, nA, nB, nC, uvA, uvB, uvC) => {
      // determine which side of the plane each vertex is on
      const sideA = planeNormal.dot(vA) + planeConstant > 0;
      const sideB = planeNormal.dot(vB) + planeConstant > 0;
      const sideC = planeNormal.dot(vC) + planeConstant > 0;
      
      // count vertices above plane
      const numAbove = (sideA ? 1 : 0) + (sideB ? 1 : 0) + (sideC ? 1 : 0);
      
      // if all vertices are on the same side, add triangle to that side
      if (numAbove === 0) {
        // all below
        belowPositions.push(vA.x, vA.y, vA.z, vB.x, vB.y, vB.z, vC.x, vC.y, vC.z);
        belowNormals.push(nA.x, nA.y, nA.z, nB.x, nB.y, nB.z, nC.x, nC.y, nC.z);
        belowUvs.push(uvA.x, uvA.y, uvB.x, uvB.y, uvC.x, uvC.y);
        return;
      } else if (numAbove === 3) {
        // all above
        abovePositions.push(vA.x, vA.y, vA.z, vB.x, vB.y, vB.z, vC.x, vC.y, vC.z);
        aboveNormals.push(nA.x, nA.y, nA.z, nB.x, nB.y, nB.z, nC.x, nC.y, nC.z);
        aboveUvs.push(uvA.x, uvA.y, uvB.x, uvB.y, uvC.x, uvC.y);
        return;
      }
      
      // handle case where triangle crosses the plane
      // we need to split it into smaller triangles
      
      // reorder points so that v0 is on the opposite side from v1 and v2
      let v0, v1, v2, n0, n1, n2, uv0, uv1, uv2;
      let side0, side1, side2;
      
      if (numAbove === 1) {
        // one vertex above, two below
        if (sideA) {
          v0 = vA; v1 = vB; v2 = vC;
          n0 = nA; n1 = nB; n2 = nC;
          uv0 = uvA; uv1 = uvB; uv2 = uvC;
          side0 = sideA; side1 = sideB; side2 = sideC;
        } else if (sideB) {
          v0 = vB; v1 = vC; v2 = vA;
          n0 = nB; n1 = nC; n2 = nA;
          uv0 = uvB; uv1 = uvC; uv2 = uvA;
          side0 = sideB; side1 = sideC; side2 = sideA;
        } else { // sideC
          v0 = vC; v1 = vA; v2 = vB;
          n0 = nC; n1 = nA; n2 = nB;
          uv0 = uvC; uv1 = uvA; uv2 = uvB;
          side0 = sideC; side1 = sideA; side2 = sideB;
        }
      } else { // numAbove === 2
        // two vertices above, one below
        if (!sideA) {
          v0 = vA; v1 = vB; v2 = vC;
          n0 = nA; n1 = nB; n2 = nC;
          uv0 = uvA; uv1 = uvB; uv2 = uvC;
          side0 = sideA; side1 = sideB; side2 = sideC;
        } else if (!sideB) {
          v0 = vB; v1 = vC; v2 = vA;
          n0 = nB; n1 = nC; n2 = nA;
          uv0 = uvB; uv1 = uvC; uv2 = uvA;
          side0 = sideB; side1 = sideC; side2 = sideA;
        } else { // !sideC
          v0 = vC; v1 = vA; v2 = vB;
          n0 = nC; n1 = nA; n2 = nB;
          uv0 = uvC; uv1 = uvA; uv2 = uvB;
          side0 = sideC; side1 = sideA; side2 = sideB;
        }
      }
      
      // Intersection points
      // calculate t value for parametric equation of line
      const t1 = this.getIntersectionT(v0, v1, planeNormal, planeConstant);
      const t2 = this.getIntersectionT(v0, v2, planeNormal, planeConstant);
      
      // intersection points
      const i1 = new THREE.Vector3().lerpVectors(v0, v1, t1);
      const i2 = new THREE.Vector3().lerpVectors(v0, v2, t2);
      
      // interpolate normals at intersection points
      const ni1 = new THREE.Vector3().lerpVectors(n0, n1, t1).normalize();
      const ni2 = new THREE.Vector3().lerpVectors(n0, n2, t2).normalize();
      
      // interpolate UVs at intersection points
      const uvi1 = {
        x: uvs ? (1 - t1) * uv0.x + t1 * uv1.x : 0,
        y: uvs ? (1 - t1) * uv0.y + t1 * uv1.y : 0
      };
      
      const uvi2 = {
        x: uvs ? (1 - t2) * uv0.x + t2 * uv2.x : 0,
        y: uvs ? (1 - t2) * uv0.y + t2 * uv2.y : 0
      };
      
      // create triangles on appropriate sides
      if (side0) {
        // v0 is above
        abovePositions.push(
          v0.x, v0.y, v0.z,
          i1.x, i1.y, i1.z,
          i2.x, i2.y, i2.z
        );
        aboveNormals.push(
          n0.x, n0.y, n0.z,
          ni1.x, ni1.y, ni1.z,
          ni2.x, ni2.y, ni2.z
        );
        aboveUvs.push(
          uv0.x, uv0.y,
          uvi1.x, uvi1.y,
          uvi2.x, uvi2.y
        );
        
        // triangle below plane (two triangles)
        belowPositions.push(
          i1.x, i1.y, i1.z,
          v1.x, v1.y, v1.z,
          v2.x, v2.y, v2.z
        );
        belowNormals.push(
          ni1.x, ni1.y, ni1.z,
          n1.x, n1.y, n1.z,
          n2.x, n2.y, n2.z
        );
        belowUvs.push(
          uvi1.x, uvi1.y,
          uv1.x, uv1.y,
          uv2.x, uv2.y
        );
        
        belowPositions.push(
          i1.x, i1.y, i1.z,
          v2.x, v2.y, v2.z,
          i2.x, i2.y, i2.z
        );
        belowNormals.push(
          ni1.x, ni1.y, ni1.z,
          n2.x, n2.y, n2.z,
          ni2.x, ni2.y, ni2.z
        );
        belowUvs.push(
          uvi1.x, uvi1.y,
          uv2.x, uv2.y,
          uvi2.x, uvi2.y
        );
      } else {
        // v0 is below
        belowPositions.push(
          v0.x, v0.y, v0.z,
          i1.x, i1.y, i1.z,
          i2.x, i2.y, i2.z
        );
        belowNormals.push(
          n0.x, n0.y, n0.z,
          ni1.x, ni1.y, ni1.z,
          ni2.x, ni2.y, ni2.z
        );
        belowUvs.push(
          uv0.x, uv0.y,
          uvi1.x, uvi1.y,
          uvi2.x, uvi2.y
        );
        
        // triangles above plane (two triangles)
        abovePositions.push(
          i1.x, i1.y, i1.z,
          v1.x, v1.y, v1.z,
          v2.x, v2.y, v2.z
        );
        aboveNormals.push(
          ni1.x, ni1.y, ni1.z,
          n1.x, n1.y, n1.z,
          n2.x, n2.y, n2.z
        );
        aboveUvs.push(
          uvi1.x, uvi1.y,
          uv1.x, uv1.y,
          uv2.x, uv2.y
        );
        
        abovePositions.push(
          i1.x, i1.y, i1.z,
          v2.x, v2.y, v2.z,
          i2.x, i2.y, i2.z
        );
        aboveNormals.push(
          ni1.x, ni1.y, ni1.z,
          n2.x, n2.y, n2.z,
          ni2.x, ni2.y, ni2.z
        );
        aboveUvs.push(
          uvi1.x, uvi1.y,
          uv2.x, uv2.y,
          uvi2.x, uvi2.y
        );
      }
    };
    
    // process all triangles in the geometry
    if (indices) {
      // indexed geometry
      for (let i = 0; i < indices.length; i += 3) {
        const indexA = indices[i];
        const indexB = indices[i + 1];
        const indexC = indices[i + 2];
        
        const vA = new THREE.Vector3().fromBufferAttribute(positions, indexA);
        const vB = new THREE.Vector3().fromBufferAttribute(positions, indexB);
        const vC = new THREE.Vector3().fromBufferAttribute(positions, indexC);
        
        const nA = new THREE.Vector3().fromBufferAttribute(normals, indexA);
        const nB = new THREE.Vector3().fromBufferAttribute(normals, indexB);
        const nC = new THREE.Vector3().fromBufferAttribute(normals, indexC);
        
        const uvA = { x: uvs.getX(indexA), y: uvs.getY(indexA) };
        const uvB = { x: uvs.getX(indexB), y: uvs.getY(indexB) };
        const uvC = { x: uvs.getX(indexC), y: uvs.getY(indexC) };
        
        processTriangle(vA, vB, vC, nA, nB, nC, uvA, uvB, uvC);
      }
    } else {
      // non-indexed geometry
      for (let i = 0; i < positions.count; i += 3) {
        const vA = new THREE.Vector3().fromBufferAttribute(positions, i);
        const vB = new THREE.Vector3().fromBufferAttribute(positions, i + 1);
        const vC = new THREE.Vector3().fromBufferAttribute(positions, i + 2);
        
        const nA = new THREE.Vector3().fromBufferAttribute(normals, i);
        const nB = new THREE.Vector3().fromBufferAttribute(normals, i + 1);
        const nC = new THREE.Vector3().fromBufferAttribute(normals, i + 2);
        
        const uvA = { x: uvs.getX(i), y: uvs.getY(i) };
        const uvB = { x: uvs.getX(i + 1), y: uvs.getY(i + 1) };
        const uvC = { x: uvs.getX(i + 2), y: uvs.getY(i + 2) };
        
        processTriangle(vA, vB, vC, nA, nB, nC, uvA, uvB, uvC);
      }
    }
    
    // create geometries for above and below parts if they exist
    let aboveMesh = null;
    if (abovePositions.length > 0) {
      const aboveGeometry = new THREE.BufferGeometry();
      aboveGeometry.setAttribute('position', new THREE.Float32BufferAttribute(abovePositions, 3));
      aboveGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(aboveNormals, 3));
      aboveGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(aboveUvs, 2));
      aboveGeometry.computeBoundingSphere();
      aboveMesh = aboveGeometry;
    }
    
    let belowMesh = null;
    if (belowPositions.length > 0) {
      const belowGeometry = new THREE.BufferGeometry();
      belowGeometry.setAttribute('position', new THREE.Float32BufferAttribute(belowPositions, 3));
      belowGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(belowNormals, 3));
      belowGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(belowUvs, 2));
      belowGeometry.computeBoundingSphere();
      belowMesh = belowGeometry;
    }
    
    // if either part is empty, return a small triangle to avoid errors
    if (!aboveMesh) {
      // create a small triangle above the plane
      const smallGeo = new THREE.BufferGeometry();
      const point = planeNormal.clone().multiplyScalar(-planeConstant + 0.1);
      smallGeo.setAttribute('position', new THREE.Float32BufferAttribute([
        point.x + 0.01, point.y, point.z,
        point.x - 0.005, point.y + 0.0087, point.z,
        point.x - 0.005, point.y - 0.0087, point.z
      ], 3));
      smallGeo.setAttribute('normal', new THREE.Float32BufferAttribute([
        0, 0, 1,
        0, 0, 1,
        0, 0, 1
      ], 3));
      smallGeo.setAttribute('uv', new THREE.Float32BufferAttribute([
        0, 0,
        1, 0,
        0, 1
      ], 2));
      aboveMesh = smallGeo;
    }
    
    if (!belowMesh) {
      // create a small triangle below the plane
      const smallGeo = new THREE.BufferGeometry();
      const point = planeNormal.clone().multiplyScalar(-planeConstant - 0.1);
      smallGeo.setAttribute('position', new THREE.Float32BufferAttribute([
        point.x + 0.01, point.y, point.z,
        point.x - 0.005, point.y + 0.0087, point.z,
        point.x - 0.005, point.y - 0.0087, point.z
      ], 3));
      smallGeo.setAttribute('normal', new THREE.Float32BufferAttribute([
        0, 0, 1,
        0, 0, 1,
        0, 0, 1
      ], 3));
      smallGeo.setAttribute('uv', new THREE.Float32BufferAttribute([
        0, 0,
        1, 0,
        0, 1
      ], 2));
      belowMesh = smallGeo;
    }
    
    return { aboveMesh, belowMesh };
  }
  
  // get intersection parameter t (where the line from v0 to v1 intersects the plane)
  getIntersectionT(v0, v1, planeNormal, planeConstant) {
    const d0 = planeNormal.dot(v0) + planeConstant;
    const d1 = planeNormal.dot(v1) + planeConstant;
    
    // t is where the distance becomes 0
    // d0 + t(d1-d0) = 0 => t = -d0/(d1-d0)
    const t = -d0 / (d1 - d0);
    
    // clamp t to avoid numerical issues
    return Math.max(0.001, Math.min(0.999, t));
  }
  
  // determine if geometry contains top corners of original paper
  doesGeometryContainTopCorners(geometry) {
    if (!this.paperMesh.mesh) return false;
    
    // get paper dimensions
    const width = this.params.paperWidth;
    const height = this.params.paperHeight;
    
    // get top corners in local space
    const topLeft = new THREE.Vector3(-width/2, height/2, 0);
    const topRight = new THREE.Vector3(width/2, height/2, 0);
    
    // check if either corner is in the geometry
    const positions = geometry.getAttribute('position');
    const epsilon = 0.1; // threshold for considering a point "close enough"
    
    let containsTopCorner = false;
    
    for (let i = 0; i < positions.count; i++) {
      const point = new THREE.Vector3().fromBufferAttribute(positions, i);
      
      // check distance to top left corner
      if (point.distanceTo(topLeft) < epsilon) {
        containsTopCorner = true;
        break;
      }
      
      // check distance to top right corner
      if (point.distanceTo(topRight) < epsilon) {
        containsTopCorner = true;
        break;
      }
    }
    
    return containsTopCorner;
  }
  
  // play a cutting sound effect
  playCuttingSound() {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // create oscillator for cutting sound
    const oscillator = audioContext.createOscillator();
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(220, audioContext.currentTime);
    oscillator.frequency.linearRampToValueAtTime(440, audioContext.currentTime + 0.1);
    
    // create gain node for volume control
    const gainNode = audioContext.createGain();
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.2);
    
    // connect nodes
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // start and stop oscillator
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.2);
  }
  
  // update method called each frame
  update() {
    // update cutting line if needed
    if (this.isCutting) {
      // could add animation or effects here
    }
  }
}