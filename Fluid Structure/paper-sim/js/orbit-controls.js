/**
 * orbit-controls.js
 * custom implementation of orbit controls adapted from THREE.OrbitControls
 */

class OrbitControls {
  constructor(camera, domElement) {
    // maintain compatibility with THREE.OrbitControls
    this.camera = camera;
    this.domElement = domElement;
    this.enabled = true;
    this.target = new THREE.Vector3();
    
    // control parameters
    this.enableDamping = true;
    this.dampingFactor = 0.05;
    this.rotateSpeed = 1.0;
    this.zoomSpeed = 1.0;
    this.panSpeed = 1.0;
    this.minDistance = 5;
    this.maxDistance = 100;
    this.minPolarAngle = 0;
    this.maxPolarAngle = Math.PI;
    this.enablePan = true;
    
    // internal state
    this.spherical = new THREE.Spherical();
    this.sphericalDelta = new THREE.Spherical();
    this.scale = 1;
    this.panOffset = new THREE.Vector3();
    this.isRotating = false;
    this.isPanning = false;
    
    // initialize
    this.updateSpherical();
    this.setupEventListeners();
  }
  
  updateSpherical() {
    const offset = new THREE.Vector3().subVectors(this.camera.position, this.target);
    this.spherical.setFromVector3(offset);
  }
  
  setupEventListeners() {
    // mouse events
    this.domElement.addEventListener('mousedown', this.onMouseDown.bind(this));
    this.domElement.addEventListener('wheel', this.onMouseWheel.bind(this));
    document.addEventListener('mousemove', this.onMouseMove.bind(this));
    document.addEventListener('mouseup', this.onMouseUp.bind(this));
    
    // prevent text selection while dragging
    this.domElement.addEventListener('selectstart', (e) => {
      e.preventDefault();
      return false;
    });
  }
  
  onMouseDown(event) {
    if (!this.enabled) return;
    
    event.preventDefault();
    
    if (event.button === 0) { // left click
      if (event.ctrlKey || event.metaKey || event.shiftKey) {
        this.isPanning = true;
      } else {
        this.isRotating = true;
      }
    } else if (event.button === 2) { // right click
      this.isPanning = true;
    }
    
    this.mousePosition = {
      x: event.clientX,
      y: event.clientY
    };
  }
  
  onMouseMove(event) {
    if (!this.enabled) return;
    
    const deltaX = event.clientX - this.mousePosition.x;
    const deltaY = event.clientY - this.mousePosition.y;
    
    this.mousePosition.x = event.clientX;
    this.mousePosition.y = event.clientY;
    
    if (this.isRotating) {
      this.handleRotation(deltaX, deltaY);
    } else if (this.isPanning && this.enablePan) {
      this.handlePan(deltaX, deltaY);
    }
  }
  
  onMouseUp() {
    this.isRotating = false;
    this.isPanning = false;
  }
  
  onMouseWheel(event) {
    if (!this.enabled) return;
    
    event.preventDefault();
    
    if (event.deltaY < 0) {
      this.scale /= Math.pow(0.95, this.zoomSpeed);
    } else {
      this.scale *= Math.pow(0.95, this.zoomSpeed);
    }
  }
  
  handleRotation(deltaX, deltaY) {
    const element = this.domElement;
    
    // rotate horizontally
    this.sphericalDelta.theta -= 2 * Math.PI * deltaX / element.clientWidth * this.rotateSpeed;
    
    // rotate vertically
    this.sphericalDelta.phi -= 2 * Math.PI * deltaY / element.clientHeight * this.rotateSpeed;
  }
  
  handlePan(deltaX, deltaY) {
    const camera = this.camera;
    const element = this.domElement;
    
    // calculate pan offset in screen space
    const offset = new THREE.Vector3();
    const position = camera.position;
    offset.copy(position).sub(this.target);
    
    // scale pan speed by distance to target
    let targetDistance = offset.length();
    
    // adjust for FOV in perspective camera
    targetDistance *= Math.tan((camera.fov / 2) * Math.PI / 180.0);
    
    // calculate pan offset
    const panX = 2 * deltaX * targetDistance / element.clientHeight;
    const panY = 2 * deltaY * targetDistance / element.clientHeight;
    
    // apply pan to camera position
    const panOffset = new THREE.Vector3();
    panOffset.copy(pan(panX, panY));
    this.panOffset.add(panOffset);
  }
  
  update() {
    if (!this.enabled) return false;
    
    const offset = new THREE.Vector3();
    
    // apply rotation
    if (this.enableDamping) {
      this.spherical.theta += this.sphericalDelta.theta * this.dampingFactor;
      this.spherical.phi += this.sphericalDelta.phi * this.dampingFactor;
      
      // damp the deltas
      this.sphericalDelta.theta *= (1 - this.dampingFactor);
      this.sphericalDelta.phi *= (1 - this.dampingFactor);
    } else {
      this.spherical.theta += this.sphericalDelta.theta;
      this.spherical.phi += this.sphericalDelta.phi;
      
      // reset the deltas
      this.sphericalDelta.set(0, 0, 0);
    }
    
    // restrict phi within bounds
    this.spherical.phi = Math.max(this.minPolarAngle, Math.min(this.maxPolarAngle, this.spherical.phi));
    this.spherical.makeSafe();
    
    // apply zoom (scale)
    this.spherical.radius *= this.scale;
    this.spherical.radius = Math.max(this.minDistance, Math.min(this.maxDistance, this.spherical.radius));
    
    // reset scale
    this.scale = 1;
    
    // apply pan offset (damped)
    if (this.enableDamping) {
      this.target.addScaledVector(this.panOffset, this.dampingFactor);
      this.panOffset.multiplyScalar(1 - this.dampingFactor);
    } else {
      this.target.add(this.panOffset);
      this.panOffset.set(0, 0, 0);
    }
    
    // convert spherical to cartesian
    offset.setFromSpherical(this.spherical);
    
    // update camera position
    this.camera.position.copy(this.target).add(offset);
    this.camera.lookAt(this.target);
    
    return true;
  }
  
  // helper function to pan camera
  pan(deltaX, deltaY) {
    const camera = this.camera;
    
    // calculate pan directions in camera space
    const panUp = new THREE.Vector3(0, 1, 0);
    const panLeft = new THREE.Vector3();
    const eye = new THREE.Vector3().subVectors(camera.position, this.target);
    
    // upVector is the "up" vector for the camera
    panLeft.crossVectors(camera.up, eye).normalize();
    
    // adjust pan speed based on camera position
    panLeft.multiplyScalar(-deltaX);
    panUp.multiplyScalar(deltaY);
    
    // combine pan directions
    return panLeft.add(panUp);
  }
}