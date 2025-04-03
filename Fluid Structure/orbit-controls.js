/**
 * Custom implementation of OrbitControls for camera manipulation
 * Provides smooth orbit, pan, and zoom functionality for the 3D scene
 */
class OrbitControls {
    constructor(camera, domElement) {
        this.camera = camera;
        this.domElement = domElement;
        this.target = new THREE.Vector3();
        
        this.enabled = true;
        this.enableDamping = true;
        this.dampingFactor = 0.05;
        this.rotateSpeed = 1.0;
        this.zoomSpeed = 1.0;
        this.maxDistance = 100;
        this.minDistance = 5;
        this.maxPolarAngle = Math.PI * 0.9;
        this.minPolarAngle = 0.1;
        
        // internal state
        this.spherical = new THREE.Spherical();
        this.sphericalDelta = new THREE.Spherical();
        this.scale = 1;
        this.zoomFrag = 0;
        this.isRotating = false;
        this.isZooming = false;
        
        // initial position
        const position = this.camera.position.clone();
        this.spherical.setFromVector3(position.sub(this.target));
        
        // event listeners
        this.domElement.addEventListener('mousedown', this.onMouseDown.bind(this));
        document.addEventListener('mouseup', this.onMouseUp.bind(this));
        document.addEventListener('mousemove', this.onMouseMove.bind(this));
        this.domElement.addEventListener('wheel', this.onMouseWheel.bind(this));
    }
    
    onMouseDown(event) {
        if (!this.enabled) return;
        
        if (event.button === 0) { // left click
            this.isRotating = true;
            this.rotateStart = {
                x: event.clientX,
                y: event.clientY
            };
        }
    }
    
    onMouseUp() {
        this.isRotating = false;
    }
    
    onMouseMove(event) {
        if (!this.enabled || !this.isRotating) return;
        
        const deltaX = event.clientX - this.rotateStart.x;
        const deltaY = event.clientY - this.rotateStart.y;
        
        // update rotation
        this.sphericalDelta.theta -= 2 * Math.PI * deltaX / this.domElement.clientWidth * this.rotateSpeed;
        this.sphericalDelta.phi -= 2 * Math.PI * deltaY / this.domElement.clientHeight * this.rotateSpeed;
        
        this.rotateStart.x = event.clientX;
        this.rotateStart.y = event.clientY;
    }
    
    onMouseWheel(event) {
        if (!this.enabled) return;
        
        event.preventDefault();
        
        if (event.deltaY < 0) {
            this.scale *= 0.9; // zoom in
        } else {
            this.scale *= 1.1; // zoom out
        }
    }
    
    update() {
        if (!this.enabled) return false;
        
        // apply rotation
        this.spherical.theta += this.sphericalDelta.theta * this.dampingFactor;
        this.spherical.phi += this.sphericalDelta.phi * this.dampingFactor;
        
        // apply damping
        this.sphericalDelta.theta *= (1 - this.dampingFactor);
        this.sphericalDelta.phi *= (1 - this.dampingFactor);
        
        // restrict phi within bounds
        this.spherical.phi = Math.max(this.minPolarAngle, Math.min(this.maxPolarAngle, this.spherical.phi));
        
        // apply scale (zoom)
        this.spherical.radius *= this.scale;
        this.spherical.radius = Math.max(this.minDistance, Math.min(this.maxDistance, this.spherical.radius));
        this.scale = 1;
        
        // update camera position
        const offset = new THREE.Vector3();
        offset.setFromSpherical(this.spherical);
        offset.add(this.target);
        
        this.camera.position.copy(offset);
        this.camera.lookAt(this.target);
        
        return true;
    }
}
