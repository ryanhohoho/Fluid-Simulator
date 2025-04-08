/**
 * PaperCutter class
 * handles the cutting mechanics for the paper simulation with a blade object
 */
class PaperCutter {
    constructor(simulation) {
        this.simulation = simulation;
        this.scene = simulation.sceneManager.scene;
        
        // cutting tool properties
        this.cutWidth = 0.02; // width of the cut
        this.cutColor = '#ff3b30'; // default red
        
        // blade properties
        this.bladeLength = 0.4;
        this.bladeWidth = 0.05;
        this.bladeThickness = 0.01;
        
        // cutting state
        this.isCutting = false;
        this.cutStartPosition = null;
        this.cutEndPosition = null;
        this.cutPoints = [];
        
        // blade movement
        this.lastBladePosition = new THREE.Vector3();
        this.bladeMoveDirection = new THREE.Vector3();
        
        // create blade object
        this.createBladeObject();
        
        // create cut indicator line
        this.createCutLine();
    }
    
    /**
     * create the blade object
     */
    createBladeObject() {
        // Create blade group
        const bladeGroup = new THREE.Group();
        
        // Create blade body
        const bladeGeometry = new THREE.BoxGeometry(
            this.bladeWidth,
            this.bladeLength,
            this.bladeThickness
        );
        
        const bladeMaterial = new THREE.MeshStandardMaterial({
            color: 0xcccccc,
            metalness: 0.8,
            roughness: 0.2
        });
        
        const blade = new THREE.Mesh(bladeGeometry, bladeMaterial);
        
        // Move blade origin to base
        blade.position.y = -this.bladeLength / 2;
        
        // Create blade edge (sharp part)
        const edgeGeometry = new THREE.BoxGeometry(
            this.bladeWidth + 0.001,
            0.02,
            this.bladeThickness + 0.001
        );
        
        const edgeMaterial = new THREE.MeshStandardMaterial({
            color: new THREE.Color(this.cutColor),
            metalness: 0.5,
            roughness: 0.3,
            emissive: new THREE.Color(this.cutColor),
            emissiveIntensity: 0.5
        });
        
        const bladeEdge = new THREE.Mesh(edgeGeometry, edgeMaterial);
        bladeEdge.position.y = -this.bladeLength + 0.01;
        
        // Create handle
        const handleGeometry = new THREE.CylinderGeometry(0.03, 0.02, 0.15, 8);
        const handleMaterial = new THREE.MeshStandardMaterial({
            color: 0x333333,
            metalness: 0.3,
            roughness: 0.8
        });
        
        const handle = new THREE.Mesh(handleGeometry, handleMaterial);
        handle.rotation.x = Math.PI / 2;
        handle.position.y = 0.075;
        
        // Add all parts to the blade group
        bladeGroup.add(blade);
        bladeGroup.add(bladeEdge);
        bladeGroup.add(handle);
        
        // Rotate blade to cutting position
        bladeGroup.rotation.x = -Math.PI / 4;
        
        // Initially hide blade
        bladeGroup.visible = false;
        
        // Add to scene
        this.scene.add(bladeGroup);
        this.bladeObject = bladeGroup;
    }
    
    /**
     * create the cut line indicator
     */
    createCutLine() {
        // Create a line to show the cut path
        const lineGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, 0, 0)
        ]);
        
        const lineMaterial = new THREE.LineBasicMaterial({
            color: new THREE.Color(this.cutColor),
            linewidth: 3
        });
        
        this.cutLine = new THREE.Line(lineGeometry, lineMaterial);
        this.cutLine.visible = false;
        this.scene.add(this.cutLine);
    }
    
    /**
     * set the cut color
     */
    setCutColor(color) {
        this.cutColor = color;
        
        // Update blade edge color
        if (this.bladeObject) {
            const bladeEdge = this.bladeObject.children[1];
            if (bladeEdge && bladeEdge.material) {
                bladeEdge.material.color.set(color);
                bladeEdge.material.emissive.set(color);
                bladeEdge.material.needsUpdate = true;
            }
        }
        
        // Update cut line color
        if (this.cutLine && this.cutLine.material) {
            this.cutLine.material.color.set(color);
            this.cutLine.material.needsUpdate = true;
        }
    }
    
    /**
     * set the cut width
     */
    setCutWidth(width) {
        this.cutWidth = width;
    }
    
    /**
     * update the blade position
     */
    updateBladePosition(position, normal) {
        if (!this.bladeObject) return;
        
        // Make blade visible
        this.bladeObject.visible = true;
        
        // Calculate movement direction if we have a previous position
        if (this.lastBladePosition.lengthSq() > 0) {
            this.bladeMoveDirection.subVectors(position, this.lastBladePosition).normalize();
        }
        
        // Update last position
        this.lastBladePosition.copy(position);
        
        // Update blade position
        this.bladeObject.position.copy(position);
        
        // Orient the blade based on the paper normal and movement direction
        if (normal) {
            // Get paper normal and movement direction
            const paperNormal = normal.clone();
            
            // Create rotation quaternion to align blade with paper
            const upVector = new THREE.Vector3(0, 1, 0);
            const quaternion = new THREE.Quaternion().setFromUnitVectors(upVector, paperNormal);
            
            // Apply quaternion to blade
            this.bladeObject.quaternion.copy(quaternion);
            
            // Additional rotation to angle blade for cutting
            const additionalRotation = new THREE.Quaternion().setFromAxisAngle(
                new THREE.Vector3(1, 0, 0),
                -Math.PI / 4
            );
            
            this.bladeObject.quaternion.multiply(additionalRotation);
            
            // If we have a movement direction, align blade to it
            if (this.bladeMoveDirection.lengthSq() > 0.01) {
                // Project movement direction onto paper plane
                const projectedDirection = this.bladeMoveDirection.clone()
                    .sub(paperNormal.clone().multiplyScalar(this.bladeMoveDirection.dot(paperNormal)))
                    .normalize();
                
                // Get angle between projectedDirection and the blade's current forward direction
                const bladeForward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.bladeObject.quaternion);
                const alignmentAngle = Math.atan2(
                    projectedDirection.x * bladeForward.z - projectedDirection.z * bladeForward.x,
                    projectedDirection.x * bladeForward.x + projectedDirection.z * bladeForward.z
                );
                
                // Apply rotation around normal to align with movement
                const alignmentRotation = new THREE.Quaternion().setFromAxisAngle(
                    paperNormal,
                    alignmentAngle
                );
                
                this.bladeObject.quaternion.multiply(alignmentRotation);
            }
        }
        
        // Update cut line if we're cutting
        if (this.isCutting) {
            this.updateCutLine();
        }
    }
    
    /**
     * update the cut line visualization
     */
    updateCutLine() {
        if (!this.cutLine || !this.cutStartPosition || !this.lastBladePosition) return;
        
        // Update line position
        const positions = this.cutLine.geometry.attributes.position;
        positions.setXYZ(0, this.cutStartPosition.x, this.cutStartPosition.y, this.cutStartPosition.z);
        positions.setXYZ(1, this.lastBladePosition.x, this.lastBladePosition.y, this.lastBladePosition.z);
        positions.needsUpdate = true;
        
        // Make line visible
        this.cutLine.visible = true;
        
        // Store this point in cut points
        this.cutPoints.push(this.lastBladePosition.clone());
    }
    
    /**
     * start cutting at a position
     */
    startCutting(position) {
        this.isCutting = true;
        this.cutStartPosition = position.clone();
        this.cutPoints = [position.clone()];
        
        // Show cut line
        this.cutLine.visible = true;
    }
    
    /**
     * finish cutting
     */
    finishCutting() {
        if (!this.isCutting || this.cutPoints.length < 2) {
            this.isCutting = false;
            this.cutLine.visible = false;
            return;
        }
        
        // Get start and end points
        const startPoint = this.cutPoints[0];
        const endPoint = this.cutPoints[this.cutPoints.length - 1];
        
        // Apply cut to paper
        this.simulation.paperManager.applyCut(startPoint, endPoint);
        
        // Reset cutting state
        this.isCutting = false;
        this.cutStartPosition = null;
        this.cutPoints = [];
        
        // Hide cut line
        this.cutLine.visible = false;
    }
    
    /**
     * hide blade and indicators
     */
    hideBlade() {
        if (this.bladeObject) {
            this.bladeObject.visible = false;
        }
        
        if (this.cutLine) {
            this.cutLine.visible = false;
        }
    }
    
    /**
     * update blade animation and physics
     */
    update() {
        if (!this.bladeObject) return;
        
        // Add subtle floating motion if blade is visible
        if (this.bladeObject.visible) {
            const time = Date.now() * 0.001;
            const floatOffset = Math.sin(time * 2) * 0.002;
            
            // Apply subtle floating motion
            this.bladeObject.position.y += floatOffset;
            
            // Small rotation wobble
            const rotationOffset = Math.sin(time * 3) * 0.005;
            this.bladeObject.rotation.z += rotationOffset;
        }
    }
    
    /**
     * reset the cutter
     */
    reset() {
        this.isCutting = false;
        this.cutStartPosition = null;
        this.cutPoints = [];
        this.hideBlade();
    }
}