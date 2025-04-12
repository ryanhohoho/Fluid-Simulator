/**
 * cutting-system.js
 * handles the improved paper cutting functionality with visual feedback
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
    this.cutStartPoint = null;
    this.cutEndPoint = null;
    this.cutStartEdge = false;
    this.cutEndEdge = false;
    
    // visual elements
    this.cutLine = null;
    this.cutPlane = null;
    this.scissorLine = null;
    this.scissorIcon = null;
    
    // raycaster for intersection detection
    this.raycaster = new THREE.Raycaster();
    this.raycaster.params.Line = { threshold: 0.2 };
    
    // create visual elements for cutting
    this.createCutVisualizer();
  }
  
  // create visual elements for cutting
  createCutVisualizer() {
    // create cut line material (actual cut)
    const cutMaterial = new THREE.LineDashedMaterial({ 
      color: 0xff0000,
      linewidth: 2,
      scale: 1,
      dashSize: 0.5,
      gapSize: 0.25,
      opacity: 0.7,
      transparent: true
    });
    
    // create empty geometry for cut line
    const cutGeometry = new THREE.BufferGeometry();
    cutGeometry.setAttribute('position', new THREE.Float32BufferAttribute([], 3));
    
    // create line
    this.cutLine = new THREE.Line(cutGeometry, cutMaterial);
    this.cutLine.computeLineDistances(); // needed for dashed lines
    this.cutLine.visible = false;
    this.scene.add(this.cutLine);
    
    // create scissor line material (preview)
    const scissorMaterial = new THREE.LineDashedMaterial({ 
      color: 0x000000,
      linewidth: 2,
      scale: 1,
      dashSize: 0.5,
      gapSize: 0.25,
      opacity: 0.8,
      transparent: true
    });
    
    // create empty geometry for scissor line
    const scissorGeometry = new THREE.BufferGeometry();
    scissorGeometry.setAttribute('position', new THREE.Float32BufferAttribute([], 3));
    
    // create scissor line
    this.scissorLine = new THREE.Line(scissorGeometry, scissorMaterial);
    this.scissorLine.computeLineDistances(); // needed for dashed lines
    this.scissorLine.visible = false;
    this.scene.add(this.scissorLine);
    
    // create scissor icon (sprite)
    const scissorTexture = this.createScissorTexture();
    const scissorMat = new THREE.SpriteMaterial({ 
      map: scissorTexture,
      transparent: true,
      opacity: 0.9
    });
    
    this.scissorIcon = new THREE.Sprite(scissorMat);
    this.scissorIcon.scale.set(2, 2, 1);
    this.scissorIcon.visible = false;
    this.scene.add(this.scissorIcon);
    
    // create cut visualization plane
    const planeGeometry = new THREE.PlaneGeometry(1, 1);
    const planeMaterial = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      opacity: 0.15,
      transparent: true,
      side: THREE.DoubleSide
    });
    
    this.cutPlane = new THREE.Mesh(planeGeometry, planeMaterial);
    this.cutPlane.visible = false;
    this.scene.add(this.cutPlane);
  }
  
  // create a texture for the scissor icon
  createScissorTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    
    // clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // draw scissors icon
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.fillStyle = '#ffffff';
    
    // handle
    ctx.beginPath();
    ctx.ellipse(20, 44, 8, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    
    ctx.beginPath();
    ctx.ellipse(44, 44, 8, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    
    // blades
    ctx.beginPath();
    ctx.moveTo(20, 30);
    ctx.quadraticCurveTo(32, 25, 32, 10);
    ctx.lineTo(28, 10);
    ctx.quadraticCurveTo(28, 22, 20, 26);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(44, 30);
    ctx.quadraticCurveTo(32, 25, 32, 10);
    ctx.lineTo(36, 10);
    ctx.quadraticCurveTo(36, 22, 44, 26);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    // create texture from canvas
    const texture = new THREE.CanvasTexture(canvas);
    return texture;
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
      this.cutStartPoint = intersects[0].point.clone();
      this.cutPoints = [this.cutStartPoint];
      
      // check if this point is near an edge (for edge-to-edge cutting)
      this.cutStartEdge = this.isNearEdge(intersects[0].point, this.paperMesh.mesh);
      
      // update scissor line visualization
      this.updateScissorLine(this.cutStartPoint, this.cutStartPoint);
      
      console.log("Started cutting at", this.cutStartPoint, "Near edge:", this.cutStartEdge);
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
      // get current cut point
      const currentPoint = intersects[0].point.clone();
      this.cutEndPoint = currentPoint;
      
      // check if near edge
      this.cutEndEdge = this.isNearEdge(currentPoint, this.paperMesh.mesh);
      
      // update the preview line
      this.updateScissorLine(this.cutStartPoint, currentPoint);
      
      // can add points more frequently for detailed curves if needed
      if (this.cutPoints.length > 0) {
        const lastPoint = this.cutPoints[this.cutPoints.length - 1];
        
        // add new point if it's far enough from the last one
        if (currentPoint.distanceTo(lastPoint) > 0.5) {
          this.cutPoints.push(currentPoint.clone());
        }
      }
      
      // update cut plane preview based on start and current point
      this.updateCutPlanePreview(this.cutStartPoint, currentPoint);
    }
  }
  
  // check if a point is near the edge of the paper mesh
  isNearEdge(point, mesh) {
    // get mesh dimensions
    const geometry = mesh.geometry;
    geometry.computeBoundingBox();
    const boundingBox = geometry.boundingBox;
    
    // transform point to local space
    const localPoint = point.clone().applyMatrix4(mesh.matrixWorld.clone().invert());
    
    // get mesh width and height
    const width = boundingBox.max.x - boundingBox.min.x;
    const height = boundingBox.max.y - boundingBox.min.y;
    
    // calculate distance to each edge
    const distToLeft = Math.abs(localPoint.x - boundingBox.min.x);
    const distToRight = Math.abs(localPoint.x - boundingBox.max.x);
    const distToTop = Math.abs(localPoint.y - boundingBox.max.y);
    const distToBottom = Math.abs(localPoint.y - boundingBox.min.y);
    
    // threshold for "near edge" (as a percentage of dimension)
    const threshold = Math.min(width, height) * 0.1;
    
    return (distToLeft < threshold || 
            distToRight < threshold || 
            distToTop < threshold || 
            distToBottom < threshold);
  }
  
  // update the preview scissor line
  updateScissorLine(startPoint, endPoint) {
    if (!this.scissorLine || !this.scissorIcon) return;
    
    // create line geometry
    const positions = [
      startPoint.x, startPoint.y, startPoint.z,
      endPoint.x, endPoint.y, endPoint.z
    ];
    
    // update line geometry
    this.scissorLine.geometry.dispose();
    this.scissorLine.geometry = new THREE.BufferGeometry();
    this.scissorLine.geometry.setAttribute(
      'position', 
      new THREE.Float32BufferAttribute(positions, 3)
    );
    
    // compute line distances for dashed lines
    this.scissorLine.computeLineDistances();
    
    // position scissor icon near the end point
    const direction = new THREE.Vector3().subVectors(endPoint, startPoint).normalize();
    const iconPosition = endPoint.clone().addScaledVector(direction, -0.5);
    this.scissorIcon.position.copy(iconPosition);
    
    // make scissor icon face the camera
    this.scissorIcon.position.copy(iconPosition);
    
    // show line and icon
    this.scissorLine.visible = true;
    this.scissorIcon.visible = true;
  }
  
  // update cut plane preview
  updateCutPlanePreview(startPoint, endPoint) {
    if (!this.cutPlane || !this.paperMesh.mesh) return;
    
    // get normal of paper (assuming Z axis in local space)
    const paperNormal = new THREE.Vector3(0, 0, 1);
    paperNormal.applyQuaternion(this.paperMesh.mesh.quaternion);
    
    // get direction of cut line
    const cutDirection = new THREE.Vector3().subVectors(endPoint, startPoint).normalize();
    
    // calculate plane normal (perpendicular to both paper normal and cut direction)
    const planeNormal = new THREE.Vector3().crossVectors(cutDirection, paperNormal).normalize();
    
    // calculate center point of cut line
    const centerPoint = new THREE.Vector3().addVectors(startPoint, endPoint).multiplyScalar(0.5);
    
    // get dimensions of paper
    const geometry = this.paperMesh.mesh.geometry;
    const width = geometry.parameters.width * 1.2; // slightly larger than paper
    const height = geometry.parameters.height * 1.2;
    
    // update cut plane geometry
    this.cutPlane.geometry.dispose();
    this.cutPlane.geometry = new THREE.PlaneGeometry(width, height);
    
    // align with normal direction
    this.cutPlane.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      planeNormal
    );
    
    // position the plane at the center of the cut line
    this.cutPlane.position.copy(centerPoint);
    
    // calculate color based on cut validity
    if (this.cutStartEdge && this.cutEndEdge) {
      // valid cut - green tint
      this.cutPlane.material.color.set(0x00ff00);
    } else {
      // invalid cut - red tint
      this.cutPlane.material.color.set(0xff0000);
    }
    
    // show plane
    this.cutPlane.visible = true;
  }
  
  // end cutting and perform cut
  endCutting() {
    if (!this.isCutting) return;
    
    // check if we have valid start and end points and at least one is near an edge
    if (this.cutStartPoint && this.cutEndPoint && 
        (this.cutStartEdge && this.cutEndEdge) && 
        this.cutStartPoint.distanceTo(this.cutEndPoint) > 1.0) {
      
      // perform the cut
      this.performCut();
    } else {
      console.log("Invalid cut: both ends must be near edges and line must be long enough");
    }
    
    // reset cutting state
    this.isCutting = false;
    this.cutPoints = [];
    this.cutStartPoint = null;
    this.cutEndPoint = null;
    this.cutStartEdge = false;
    this.cutEndEdge = false;
    
    // hide visual elements
    this.hideVisualElements();
  }
  
  // hide all visual elements
  hideVisualElements() {
    if (this.cutLine) this.cutLine.visible = false;
    if (this.cutPlane) this.cutPlane.visible = false;
    if (this.scissorLine) this.scissorLine.visible = false;
    if (this.scissorIcon) this.scissorIcon.visible = false;
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
    if (!this.cutStartPoint || !this.cutEndPoint) {
      return null;
    }
    
    // for straight cuts, create a plane perpendicular to paper
    const start = this.cutStartPoint;
    const end = this.cutEndPoint;
    
    // paper normal (assuming z is normal to paper)
    const paperNormal = new THREE.Vector3(0, 0, 1);
    paperNormal.applyQuaternion(this.paperMesh.mesh.quaternion);
    
    // direction of cut
    const cutDirection = new THREE.Vector3().subVectors(end, start).normalize();
    
    // plane normal (perpendicular to both paper normal and cut direction)
    const planeNormal = new THREE.Vector3().crossVectors(cutDirection, paperNormal).normalize();
    
    // calculate plane constant (d in ax + by + cz + d = 0)
    const planeConstant = -planeNormal.dot(start);
    
    return { normal: planeNormal, constant: planeConstant };
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
    
    // if either part is empty, create a small triangle to avoid errors
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
    
    // check a sample of vertices
    const checkFrequency = Math.max(1, Math.floor(positions.count / 100)); // Don't check every vertex for large meshes
    
    for (let i = 0; i < positions.count; i += checkFrequency) {
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
    // create audio context
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // create oscillator for scissor sound (two frequencies for scissors opening/closing)
    const oscillator1 = audioContext.createOscillator();
    oscillator1.type = 'sawtooth';
    oscillator1.frequency.setValueAtTime(220, audioContext.currentTime);
    oscillator1.frequency.linearRampToValueAtTime(440, audioContext.currentTime + 0.1);
    
    const oscillator2 = audioContext.createOscillator();
    oscillator2.type = 'sawtooth';
    oscillator2.frequency.setValueAtTime(330, audioContext.currentTime);
    oscillator2.frequency.linearRampToValueAtTime(660, audioContext.currentTime + 0.15);
    
    // create filter for more realistic sound
    const filter = audioContext.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 800;
    filter.Q.value = 3;
    
    // create gain node for volume control
    const gainNode = audioContext.createGain();
    gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.3);
    
    // connect nodes
    oscillator1.connect(filter);
    oscillator2.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // add a bit of noise for more realistic scissor sound
    const bufferSize = 2 * audioContext.sampleRate;
    const noiseBuffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    
    const noise = audioContext.createBufferSource();
    noise.buffer = noiseBuffer;
    
    const noiseFilter = audioContext.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.value = 5000;
    
    const noiseGain = audioContext.createGain();
    noiseGain.gain.setValueAtTime(0.05, audioContext.currentTime);
    noiseGain.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.3);
    
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(audioContext.destination);
    
    // start sound
    oscillator1.start();
    oscillator2.start();
    noise.start();
    
    // stop after a short time
    oscillator1.stop(audioContext.currentTime + 0.3);
    oscillator2.stop(audioContext.currentTime + 0.3);
    noise.stop(audioContext.currentTime + 0.3);
  }
  
  // update method called each frame
  update() {
    // update cutting visualization if needed
    if (this.isCutting) {
      // Update the scissor icon rotation to face the camera
      if (this.scissorIcon && this.scissorIcon.visible) {
        // Make scissor icon face camera
        this.scissorIcon.material.rotation = 0;
      }
    }
  }
}