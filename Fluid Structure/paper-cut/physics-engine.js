/**
 * PhysicsEngine class
 * handles physics calculations for paper pieces including gravity and air resistance
 */
class PhysicsEngine {
    constructor(simulation) {
        this.simulation = simulation;
        
        // physics constants
        this.gravity = 9.8; // default gravity
        this.airResistance = 0.05; // default air resistance
        this.turbulenceFactor = 0.002; // random turbulence factor
    }
    
    /**
     * update physics for all paper pieces
     */
    update() {
        // update physics for paper pieces through the paper manager
        this.updatePaperPhysics();
    }
    
    /**
     * update physics for paper pieces
     */
    updatePaperPhysics() {
        // delegate to paper manager
        if (this.simulation.paperManager) {
            // update physics parameters
            this.simulation.paperManager.update();
        }
    }
    
    /**
     * apply forces to a paper piece
     */
    applyForces(piece) {
        // apply gravity
        piece.velocity.y -= this.gravity * 0.01; // scale for reasonable falling speed
        
        // apply air resistance
        this.applyAirResistance(piece);
        
        // apply random turbulence for realism
        this.applyTurbulence(piece);
    }
    
    /**
     * apply air resistance to a paper piece
     */
    applyAirResistance(piece) {
        // calculate air resistance force (proportional to velocity squared)
        const speed = piece.velocity.length();
        
        if (speed > 0) {
            // get the drag coefficient
            const dragCoef = piece.airResistance || this.airResistance;
            
            // calculate drag force magnitude (F = 0.5 * p * v^2 * A * Cd)
            // simplified as F = v^2 * dragCoef
            const dragForce = speed * speed * dragCoef;
            
            // create drag force vector (opposite to velocity)
            const dragDirection = piece.velocity.clone().normalize().negate();
            const drag = dragDirection.multiplyScalar(dragForce);
            
            // apply the drag force
            piece.velocity.add(drag);
        }
    }
    
    /**
     * apply random turbulence for more realistic motion
     */
    applyTurbulence(piece) {
        // add small random forces to simulate air turbulence
        piece.velocity.x += (Math.random() - 0.5) * this.turbulenceFactor;
        piece.velocity.z += (Math.random() - 0.5) * this.turbulenceFactor;
        
        // more turbulence for lighter pieces
        const massFactor = 1.0 / Math.max(0.1, piece.mass);
        
        // add random angular velocity changes
        piece.angularVelocity.x += (Math.random() - 0.5) * this.turbulenceFactor * 0.5 * massFactor;
        piece.angularVelocity.y += (Math.random() - 0.5) * this.turbulenceFactor * 0.5 * massFactor;
        piece.angularVelocity.z += (Math.random() - 0.5) * this.turbulenceFactor * 0.2 * massFactor;
    }
    
    /**
     * update physics parameters
     */
    updateParameters(params) {
        if (params.gravity !== undefined) {
            this.gravity = params.gravity;
        }
        
        if (params.airResistance !== undefined) {
            this.airResistance = params.airResistance;
        }
    }
}