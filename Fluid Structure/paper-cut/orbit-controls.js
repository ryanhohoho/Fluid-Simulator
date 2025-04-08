/**
 * custom implementation of orbit controls
 * provides smooth camera manipulation with damping and constraints
 */
class OrbitControls {
    constructor(camera, domElement) {
        this.camera = camera;
        this.domElement = domElement;
        this.target = new THREE.Vector3(0, 0, 0);
        
        // control parameters
        this.enabled = true;
        this.enableDamping = true;
        this.dampingFactor = 0.1;
        this.rotateSpeed = 0.7;
        this.zoomSpeed = 1.0;
        this.panSpeed = 0.8;
        this.minDistance = 1;
        this.maxDistance = 10;
        this.minPolarAngle = 0; // radians
        this.maxPolarAngle = Math.PI; // radians
        
        // internal state
        this.spherical = new THREE.Spherical();
        this.sphericalDelta = new THREE.Spherical();
        this.scale = 1;
        this.panOffset = new THREE.Vector3();
        this.zoomChanged = false;
        
        // interaction states
        this.isRotating = false;
        this.isPanning = false;
        this.isZooming = false;
        
        // mouse positions
        this.rotateStart = new THREE.Vector2();
        this.panStart = new THREE.Vector2();
        
        // event listeners
        this.domElement.addEventListener('mousedown', this.onMouseDown.bind(this));
        document.addEventListener('mousemove', this.onMouseMove.bind(this));
        document.addEventListener('mouseup', this.onMouseUp.bind(this));
        this.domElement.addEventListener('wheel', this.onMouseWheel.bind(this));
        
        // touch support
        this.domElement.addEventListener('touchstart', this.onTouchStart.bind(this));
        this.domElement.addEventListener('touchmove', this.onTouchMove.bind(this));
        this.domElement.addEventListener('touchend', this.onTouchEnd.bind(this));
        
        // initialize spherical coordinates from current camera position
        this.updateSpherical();
    }
    
    /**
     * update spherical coordinates from camera position
     */
    updateSpherical() {
        const offset = new THREE.Vector3();
        offset.copy(this.camera.position).sub(this.target);
        this.spherical.setFromVector3(offset);
    }
    
    /**
     * handle mouse down event
     */
    onMouseDown(event) {
        if (!this.enabled) return;
        
        event.preventDefault();
        
        if (event.button === 0) { // left mouse button
            if (event.ctrlKey || event.metaKey || event.shiftKey) {
                this.isPanning = true;
                this.panStart.set(event.clientX, event.clientY);
            } else {
                this.isRotating = true;
                this.rotateStart.set(event.clientX, event.clientY);
            }
        } else if (event.button === 2) { // right mouse button
            this.isPanning = true;
            this.panStart.set(event.clientX, event.clientY);
        }
        
        this.domElement.style.cursor = 'grabbing';
    }
    
    /**
     * handle mouse move event
     */
    onMouseMove(event) {
        if (!this.enabled) return;
        
        event.preventDefault();
        
        if (this.isRotating) {
            this.handleRotation(event);
        } else if (this.isPanning) {
            this.handlePanning(event);
        }
    }
    
    /**
     * handle rotation logic
     */
    handleRotation(event) {
        const element = this.domElement;
        const elementWidth = element.clientWidth;
        const elementHeight = element.clientHeight;
        
        // calculate how much we moved in screen space
        const rotateEnd = new THREE.Vector2(event.clientX, event.clientY);
        const rotateDelta = new THREE.Vector2()
            .subVectors(rotateEnd, this.rotateStart)
            .multiplyScalar(this.rotateSpeed);
        
        // rotating up and down along whole screen attempts to go 360, but limited to 180
        this.sphericalDelta.phi -= 2 * Math.PI * rotateDelta.y / elementHeight;
        
        // rotating left and right along whole screen
        this.sphericalDelta.theta -= 2 * Math.PI * rotateDelta.x / elementWidth;
        
        this.rotateStart.copy(rotateEnd);
    }
    
    /**
     * handle panning logic
     */
    handlePanning(event) {
        const element = this.domElement;
        const elementWidth = element.clientWidth;
        const elementHeight = element.clientHeight;
        
        // calculate how much we moved in screen space
        const panEnd = new THREE.Vector2(event.clientX, event.clientY);
        const panDelta = new THREE.Vector2()
            .subVectors(panEnd, this.panStart)
            .multiplyScalar(this.panSpeed);
        
        this.pan(panDelta.x, panDelta.y);
        
        this.panStart.copy(panEnd);
    }
    
    /**
     * handle panning in 3D space
     */
    pan(deltaX, deltaY) {
        const camera = this.camera;
        const targetDistance = this.camera.position.distanceTo(this.target);
        
        // adjust delta for FOV and distance from target
        deltaX *= targetDistance * 0.001;
        deltaY *= targetDistance * 0.001;
        
        const offset = new THREE.Vector3();
        
        // create offset in world space
        if (camera.isPerspectiveCamera) {
            const position = camera.position;
            offset.copy(position).sub(this.target);
            let targetDistance = offset.length();
            
            // adjust zoom distance for panning speed
            targetDistance *= Math.tan((camera.fov / 2) * Math.PI / 180.0);
            
            // calculate offset for panning
            const panLeftVector = new THREE.Vector3();
            const panUpVector = new THREE.Vector3();
            const objectUp = new THREE.Vector3(0, 1, 0);
            
            panLeftVector.setFromMatrixColumn(camera.matrix, 0);
            panUpVector.crossVectors(panLeftVector, objectUp);
            panLeftVector.multiplyScalar(-deltaX * 2);
            panUpVector.multiplyScalar(deltaY * 2);
            
            this.panOffset.add(panLeftVector);
            this.panOffset.add(panUpVector);
        }
    }
    
    /**
     * handle mouse up event
     */
    onMouseUp() {
        this.isRotating = false;
        this.isPanning = false;
        this.domElement.style.cursor = 'grab';
    }
    
    /**
     * handle mouse wheel event for zooming
     */
    onMouseWheel(event) {
        if (!this.enabled || !this.enableZoom) return;
        
        event.preventDefault();
        
        // calculate zoom scale
        if (event.deltaY < 0) {
            this.scale /= Math.pow(0.95, this.zoomSpeed);
        } else {
            this.scale *= Math.pow(0.95, this.zoomSpeed);
        }
        
        this.zoomChanged = true;
    }
    
    /**
     * handle touch start event
     */
    onTouchStart(event) {
        if (!this.enabled) return;
        
        switch (event.touches.length) {
            case 1: // one-finger touch: rotate
                this.isRotating = true;
                this.rotateStart.set(event.touches[0].pageX, event.touches[0].pageY);
                break;
                
            case 2: // two-finger touch: dolly-pan
                const dx = event.touches[0].pageX - event.touches[1].pageX;
                const dy = event.touches[0].pageY - event.touches[1].pageY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                this.isZooming = true;
                this.zoomStart = distance;
                
                // calculate center point of touch points for panning
                const x = 0.5 * (event.touches[0].pageX + event.touches[1].pageX);
                const y = 0.5 * (event.touches[0].pageY + event.touches[1].pageY);
                this.isPanning = true;
                this.panStart.set(x, y);
                break;
        }
    }
    
    /**
     * handle touch move event
     */
    onTouchMove(event) {
        if (!this.enabled) return;
        
        event.preventDefault();
        
        switch (event.touches.length) {
            case 1: // one-finger touch: rotate
                if (this.isRotating) {
                    const rotateEnd = new THREE.Vector2(event.touches[0].pageX, event.touches[0].pageY);
                    const rotateDelta = new THREE.Vector2()
                        .subVectors(rotateEnd, this.rotateStart)
                        .multiplyScalar(this.rotateSpeed * 0.5); // reduced sensitivity for touch
                    
                    this.sphericalDelta.theta -= 2 * Math.PI * rotateDelta.x / this.domElement.clientWidth;
                    this.sphericalDelta.phi -= 2 * Math.PI * rotateDelta.y / this.domElement.clientHeight;
                    
                    this.rotateStart.copy(rotateEnd);
                }
                break;
                
            case 2: // two-finger touch: dolly-pan
                // handle zooming
                if (this.isZooming) {
                    const dx = event.touches[0].pageX - event.touches[1].pageX;
                    const dy = event.touches[0].pageY - event.touches[1].pageY;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    const delta = this.zoomStart / distance;
                    this.zoomStart = distance;
                    
                    this.scale *= delta;
                    this.zoomChanged = true;
                }
                
                // handle panning
                if (this.isPanning) {
                    const x = 0.5 * (event.touches[0].pageX + event.touches[1].pageX);
                    const y = 0.5 * (event.touches[0].pageY + event.touches[1].pageY);
                    const panEnd = new THREE.Vector2(x, y);
                    const panDelta = new THREE.Vector2()
                        .subVectors(panEnd, this.panStart)
                        .multiplyScalar(this.panSpeed * 0.5); // reduced sensitivity
                    
                    this.pan(panDelta.x, panDelta.y);
                    this.panStart.copy(panEnd);
                }
                break;
        }
    }
    
    /**
     * handle touch end event
     */
    onTouchEnd() {
        this.isRotating = false;
        this.isZooming = false;
        this.isPanning = false;
    }
    
    /**
     * update control state
     */
    update() {
        if (!this.enabled) return false;
        
        const offset = new THREE.Vector3();
        const quat = new THREE.Quaternion().setFromUnitVectors(this.camera.up, new THREE.Vector3(0, 1, 0));
        const quatInverse = quat.clone().invert();
        
        // update camera position based on spherical coordinates
        offset.copy(this.camera.position).sub(this.target);
        offset.applyQuaternion(quat); // move to rotated space
        
        // update spherical coordinates
        this.spherical.setFromVector3(offset);
        
        // apply rotation
        this.spherical.theta += this.sphericalDelta.theta;
        this.spherical.phi += this.sphericalDelta.phi;
        
        // restrict phi to be between min and max
        this.spherical.phi = Math.max(this.minPolarAngle, Math.min(this.maxPolarAngle, this.spherical.phi));
        this.spherical.makeSafe();
        
        // apply zoom
        if (this.zoomChanged) {
            this.spherical.radius *= this.scale;
            this.spherical.radius = Math.max(this.minDistance, Math.min(this.maxDistance, this.spherical.radius));
            this.zoomChanged = false;
        }
        
        // apply damping
        if (this.enableDamping) {
            this.sphericalDelta.theta *= (1 - this.dampingFactor);
            this.sphericalDelta.phi *= (1 - this.dampingFactor);
            this.scale = 1 + (this.scale - 1) * (1 - this.dampingFactor);
        } else {
            this.sphericalDelta.set(0, 0, 0);
            this.scale = 1;
        }
        
        // convert back to cartesian coordinates
        offset.setFromSpherical(this.spherical);
        offset.applyQuaternion(quatInverse); // move back to original space
        
        // apply panning
        this.target.add(this.panOffset);
        
        // apply damping to pan offset
        if (this.enableDamping) {
            this.panOffset.multiplyScalar(1 - this.dampingFactor);
        } else {
            this.panOffset.set(0, 0, 0);
        }
        
        // update camera position
        this.camera.position.copy(this.target).add(offset);
        this.camera.lookAt(this.target);
        
        return true;
    }
}