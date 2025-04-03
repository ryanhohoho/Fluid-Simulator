/**
 * ParticleManager class
 * Handles creating, updating, and rendering fluid particles
 */
class ParticleManager {
    constructor(simulation) {
        this.simulation = simulation;
        this.particles = [];
        this.velocities = [];
        this.radii = [];
        this.masses = [];
    }
    
    /**
     * Creates particles inside the container
     */
    createParticles() {

        console.log("Creating particles...");
        const container = this.simulation.sceneManager.container;
        if (!container) {
            console.error("Container is undefined!");
            return;
        }
        
        // Check for scene and camera
        if (!this.simulation.sceneManager.scene) {
            console.error("Scene is undefined!");
            return;
        }
        
        if (!this.simulation.sceneManager.camera) {
            console.error("Camera is undefined!");
            return;
        }
        
        console.log("Container, scene, and camera OK. Creating particles...");
        
        const baseSize = this.simulation.params.particleSize;
        const variation = 0.2; // size variation (20%)
        
        // make water-like material
        const waterMaterial = new THREE.MeshPhysicalMaterial({
            color: 0x0070f3, // vercel blue
            metalness: 0.2,
            roughness: 0.1,
            transparent: true,
            opacity: 0.7,
            clearcoat: 0.5,
            clearcoatRoughness: 0.2,
            transmission: 0.1,
            depthWrite: true
        });
        
        // calculate dimensions for particle distribution
        const halfSize = this.simulation.params.containerSize / 2;
        const boxVolume = this.simulation.params.containerSize * this.simulation.params.containerSize * this.simulation.params.containerSize;
        const targetVolume = boxVolume * 0.5; // fill about half the container
        
        // calculate the spacing based on particle size
        const minSpacing = baseSize * 2.1; // slightly more than 2x radius to prevent initial overlaps
        
        // calculate particles per dimension to create a rectangular prism
        const fillHeight = halfSize * 0.95; // fill slightly less than half the height
        const particlesY = Math.floor(fillHeight / minSpacing);
        const particlesXZ = Math.ceil(Math.sqrt(this.simulation.params.particleCount / particlesY));
        
        // calculate starting position to center the particles
        const startX = -halfSize + minSpacing/2;
        const startY = -halfSize + minSpacing/2; // start from bottom
        const startZ = -halfSize + minSpacing/2;
        
        // create particles with slight size variations
        let particleIndex = 0;
        for (let y = 0; y < particlesY && particleIndex < this.simulation.params.particleCount; y++) {
            for (let x = 0; x < particlesXZ && particleIndex < this.simulation.params.particleCount; x++) {
                for (let z = 0; z < particlesXZ && particleIndex < this.simulation.params.particleCount; z++) {
                    // add random variation to size
                    const sizeVariation = 1.0 - variation/2 + Math.random() * variation;
                    const radius = baseSize * sizeVariation;
                    
                    // calculate position with small random offset
                    const xPos = startX + x * minSpacing + (Math.random() * 0.2 - 0.1) * minSpacing;
                    const yPos = startY + y * minSpacing + (Math.random() * 0.2 - 0.1) * minSpacing;
                    const zPos = startZ + z * minSpacing + (Math.random() * 0.2 - 0.1) * minSpacing;
                    
                    // skip particles outside the container bounds
                    if (xPos > halfSize || yPos > halfSize || zPos > halfSize ||
                        xPos < -halfSize || yPos < -halfSize || zPos < -halfSize) {
                        continue;
                    }
                    
                    // create geometry with the specific radius
                    const geometry = new THREE.SphereGeometry(radius, 12, 8);
                    
                    // create particle mesh with the material
                    const particle = new THREE.Mesh(geometry, waterMaterial.clone());
                    particle.position.set(xPos, yPos, zPos);
                    particle.castShadow = true;
                    particle.receiveShadow = true;
                    this.simulation.sceneManager.container.add(particle);
                    
                    // store particle data
                    this.particles.push(particle.position);
                    this.velocities.push(new THREE.Vector3(0, 0, 0));
                    this.radii.push(radius);
                    this.masses.push(Math.pow(radius, 3)); // mass proportional to volume
                    
                    particleIndex++;
                    
                    // stop if we've created enough particles
                    if (particleIndex >= this.simulation.params.particleCount) break;
                }
                if (particleIndex >= this.simulation.params.particleCount) break;
            }
            if (particleIndex >= this.simulation.params.particleCount) break;
        }
        
        // Make the arrays accessible to the physics engine
        this.simulation.physicsEngine.setParticleData(this.particles, this.velocities, this.radii, this.masses);
        
        // log the actual number of particles created
        this.simulation.updateStatus(`Created ${particleIndex} particles`);
    }
    
    /**
     * Clear all particles and reset data arrays
     */
    clearParticles() {
        // reset particle arrays
        this.particles = [];
        this.velocities = [];
        this.radii = [];
        this.masses = [];
        
        // remove particles from scene
        const container = this.simulation.sceneManager.container;
        if (container) {
            // keep the first 6 children (container box and panels)
            while (container.children.length > 6) {
                const particle = container.children[6];
                container.remove(particle);
                if (particle.geometry) particle.geometry.dispose();
                if (particle.material) particle.material.dispose();
            }
        }
    }
    
    /**
     * Reset particles by clearing and recreating them
     */
    resetParticles() {
        this.clearParticles();
        this.createParticles();
    }
    
    /**
     * Update particle visualization based on velocity
     */
    updateParticleVisuals() {
        // start from index 6 to skip container box and panels
        const container = this.simulation.sceneManager.container;
        
        for (let i = 0; i < this.particles.length; i++) {
            const speed = this.velocities[i].length();
            const particle = container.children[i + 6]; 
            
            if (particle && particle.material) {
                // calculate intensity based on speed
                const intensity = Math.min(speed * 2, 1);
                
                // use the updated color calculation
                const r = 0.1 + intensity * 0.6;
                const g = 0.7 + intensity * 0.8;
                const b = 0.9;
                
                particle.material.color.setRGB(r, g, b);
                
                // maintain a high opacity regardless of speed
                particle.material.opacity = intensity/5 + 0.3;
            }
        }
    }
    
    /**
     * Update particle positions based on velocities
     */
    updateParticlePositions() {
        for (let i = 0; i < this.particles.length; i++) {
            this.particles[i].x += this.velocities[i].x;
            this.particles[i].y += this.velocities[i].y;
            this.particles[i].z += this.velocities[i].z;
        }
    }
}
