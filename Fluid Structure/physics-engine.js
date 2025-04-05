/**
 * PhysicsEngine class
 * Handles all physics calculations including collisions, forces, and boundaries
 */
class PhysicsEngine {
    constructor(simulation) {
        this.simulation = simulation;
        
        // references to particle data
        this.particles = null;
        this.velocities = null;
        this.radii = null;
        this.masses = null;
        
        // spatial partitioning for efficient collision detection
        this.gridCellSize = this.simulation.params.particleSize * 4;
        this.spatialGrid = {};
    }
    
    /**
     * Set references to particle data arrays
     */
    setParticleData(particles, velocities, radii, masses) {
        this.particles = particles;
        this.velocities = velocities;
        this.radii = radii;
        this.masses = masses;
    }
    
    updateSpatialGrid() {
        // clear the grid
        this.spatialGrid = {};
        
        // add particles to spatial grid
        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            const cellX = Math.floor(p.x / this.gridCellSize);
            const cellY = Math.floor(p.y / this.gridCellSize);
            const cellZ = Math.floor(p.z / this.gridCellSize);
            
            // create a unique key for this cell
            const key = `${cellX},${cellY},${cellZ}`;
            
            if (!this.spatialGrid[key]) {
                this.spatialGrid[key] = [];
            }
            
            this.spatialGrid[key].push(i);
        }
    }
    
    getNeighbors(particleIndex) {
        const neighbors = [];
        const p = this.particles[particleIndex];
        
        // calculate grid cell
        const cellX = Math.floor(p.x / this.gridCellSize);
        const cellY = Math.floor(p.y / this.gridCellSize);
        const cellZ = Math.floor(p.z / this.gridCellSize);
        
        // check current cell and all adjacent cells (27 cells total)
        for (let x = cellX - 1; x <= cellX + 1; x++) {
            for (let y = cellY - 1; y <= cellY + 1; y++) {
                for (let z = cellZ - 1; z <= cellZ + 1; z++) {
                    const key = `${x},${y},${z}`;
                    
                    if (this.spatialGrid[key]) {
                        for (const neighborIdx of this.spatialGrid[key]) {
                            if (neighborIdx !== particleIndex) {
                                neighbors.push(neighborIdx);
                            }
                        }
                    }
                }
            }
        }
        
        return neighbors;
    }
    
    applyForces() {
        const { gravity, mouseRadius, mouseStrength, speedLimit } = this.simulation.params;
        const { interactionMode, isMouseDown, mousePosition3D, mouseVelocity } = this.simulation;
        
        // apply gravity and mouse forces to particles
        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            const v = this.velocities[i];
            
            // apply gravity
            v.y -= gravity;
            
            // apply mouse force if in interaction mode and dragging
            if (interactionMode === 'interaction' && isMouseDown) {
                const dist = p.distanceTo(mousePosition3D);
                
                if (dist < mouseRadius) {
                    const strength = (1 - dist / mouseRadius) * mouseStrength;
                    v.x += mouseVelocity.x * strength;
                    v.y += mouseVelocity.y * strength;
                    v.z += mouseVelocity.z * strength;
                }
            }
            
            // apply speed limit to prevent instability
            const speedSq = v.x*v.x + v.y*v.y + v.z*v.z;
            const maxSpeed = speedLimit;
            
            if (speedSq > maxSpeed * maxSpeed) {
                const speed = Math.sqrt(speedSq);
                v.x = (v.x / speed) * maxSpeed;
                v.y = (v.y / speed) * maxSpeed;
                v.z = (v.z / speed) * maxSpeed;
            }
        }
        
        // apply forces to objects through the object loader
        this.simulation.objectLoader.applyForcesToObjects(gravity, speedLimit);
    }
    
    handleParticleCollisions() {
        const { energyLoss, friction } = this.simulation.params;
        
        // update spatial grid for efficient collision detection
        this.updateSpatialGrid();
        
        // check for collisions between nearby particles
        for (let i = 0; i < this.particles.length; i++) {
            const p1 = this.particles[i];
            const v1 = this.velocities[i];
            const r1 = this.radii[i];
            const m1 = this.masses[i];
            
            // get potential collision candidates
            const neighbors = this.getNeighbors(i);
            
            for (const j of neighbors) {
                const p2 = this.particles[j];
                const v2 = this.velocities[j];
                const r2 = this.radii[j];
                const m2 = this.masses[j];
                
                // calculate distance between particles
                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const dz = p2.z - p1.z;
                const distSq = dx*dx + dy*dy + dz*dz;
                const minDist = r1 + r2;
                
                // check if collision occurred
                if (distSq < minDist * minDist) {
                    const dist = Math.sqrt(distSq);
                    
                    // calculate penetration depth
                    const penetration = minDist - dist;
                    
                    if (penetration > 0) {
                        // calculate normal vector (direction from p1 to p2)
                        const nx = dx / dist;
                        const ny = dy / dist;
                        const nz = dz / dist;
                        
                        // calculate relative velocity along normal
                        const vrx = v2.x - v1.x;
                        const vry = v2.y - v1.y;
                        const vrz = v2.z - v1.z;
                        const vDotN = vrx * nx + vry * ny + vrz * nz;
                        
                        // if particles are moving toward each other
                        if (vDotN < 0) {
                            // calculate impulse scalar - with energy loss
                            const restitution = 1.0 - energyLoss; // 0 = all energy lost, 1 = no energy lost
                            const j = -(1 + restitution) * vDotN / (1/m1 + 1/m2);
                            
                            // apply impulse along normal direction
                            const impulseX = j * nx;
                            const impulseY = j * ny;
                            const impulseZ = j * nz;
                            
                            // update velocities based on impulse and mass
                            v1.x -= impulseX / m1;
                            v1.y -= impulseY / m1;
                            v1.z -= impulseZ / m1;
                            
                            v2.x += impulseX / m2;
                            v2.y += impulseY / m2;
                            v2.z += impulseZ / m2;
                            
                            // apply friction - tangential impulse
                            if (friction > 0) {
                                // calculate relative velocity tangent
                                const tx = vrx - vDotN * nx;
                                const ty = vry - vDotN * ny;
                                const tz = vrz - vDotN * nz;
                                
                                const tLength = Math.sqrt(tx*tx + ty*ty + tz*tz);
                                
                                if (tLength > 0.001) {
                                    // normalized tangent vector
                                    const tnx = tx / tLength;
                                    const tny = ty / tLength;
                                    const tnz = tz / tLength;
                                    
                                    // tangential impulse
                                    const jt = -friction * j;
                                    
                                    // apply tangential impulse
                                    v1.x -= jt * tnx / m1;
                                    v1.y -= jt * tny / m1;
                                    v1.z -= jt * tnz / m1;
                                    
                                    v2.x += jt * tnx / m2;
                                    v2.y += jt * tny / m2;
                                    v2.z += jt * tnz / m2;
                                }
                            }
                        }
                        
                        // prevent overlap by separating particles
                        const totalMass = m1 + m2;
                        const ratio1 = m2 / totalMass;
                        const ratio2 = m1 / totalMass;
                        
                        // adjust positions to prevent overlap
                        p1.x -= nx * penetration * ratio1 * 0.5;
                        p1.y -= ny * penetration * ratio1 * 0.5;
                        p1.z -= nz * penetration * ratio1 * 0.5;
                        
                        p2.x += nx * penetration * ratio2 * 0.5;
                        p2.y += ny * penetration * ratio2 * 0.5;
                        p2.z += nz * penetration * ratio2 * 0.5;
                    }
                }
            }
        }
    }
    
    handleBoundaryCollisions() {
        const { containerSize, energyLoss, friction } = this.simulation.params;
        const halfSize = containerSize / 2;
        
        // handle particle-boundary collisions
        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            const v = this.velocities[i];
            const r = this.radii[i];
            
            // bottom boundary
            if (p.y - r < -halfSize) {
                p.y = -halfSize + r;
                if (v.y < 0) {
                    v.y = -v.y * (1 - energyLoss);
                    // apply friction with floor
                    v.x *= (1 - friction);
                    v.z *= (1 - friction);
                }
            }
            
            // top boundary
            if (p.y + r > halfSize) {
                p.y = halfSize - r;
                if (v.y > 0) {
                    v.y = -v.y * (1 - energyLoss);
                }
            }
            
            // left boundary
            if (p.x - r < -halfSize) {
                p.x = -halfSize + r;
                if (v.x < 0) {
                    v.x = -v.x * (1 - energyLoss);
                }
            }
            
            // right boundary
            if (p.x + r > halfSize) {
                p.x = halfSize - r;
                if (v.x > 0) {
                    v.x = -v.x * (1 - energyLoss);
                }
            }
            
            // back boundary
            if (p.z - r < -halfSize) {
                p.z = -halfSize + r;
                if (v.z < 0) {
                    v.z = -v.z * (1 - energyLoss);
                }
            }
            
            // front boundary
            if (p.z + r > halfSize) {
                p.z = halfSize - r;
                if (v.z > 0) {
                    v.z = -v.z * (1 - energyLoss);
                }
            }
        }

        this.handleObjectBoundaryCollisions(halfSize);
    }
    
    handleObjectBoundaryCollisions(halfSize) {

        const { objects } = this.simulation.objectLoader;
        const { energyLoss, friction, speedLimit } = this.simulation.params;
        
        // handle object-boundary collisions
        for (const object of objects) {
            // Skip light-related objects and fixed objects
            if (object.physics.isFixed) continue;
            
            // Skip if this is a light component
            if (object.mesh && object.mesh.userData && object.mesh.userData.isLightComponent) {
                continue;
            }
            
            // update bounding box
            object.physics.bbox.setFromObject(object.mesh);
            const bbox = object.physics.bbox;
            
            // get bounding box dimensions
            const size = new THREE.Vector3();
            bbox.getSize(size);
            const halfWidth = size.x / 2;
            const halfHeight = size.y / 2;
            const halfDepth = size.z / 2;
            
            // get bounding box center
            const center = new THREE.Vector3();
            bbox.getCenter(center);
            
            const bounceStrength = 1.0 - energyLoss;
            const buffer = 0.1; // small buffer to prevent getting stuck in walls
            
            // bottom boundary
            if (center.y - halfHeight < -halfSize) {
                // calculate penetration depth
                const penetration = -halfSize - (center.y - halfHeight) + buffer;
                // move object out of boundary
                object.physics.position.y += penetration;
                
                if (object.physics.velocity.y < 0) {
                    // reflect velocity with energy loss
                    object.physics.velocity.y = -object.physics.velocity.y * bounceStrength;
                    // apply friction
                    object.physics.velocity.x *= (1 - friction * 2);
                    object.physics.velocity.z *= (1 - friction * 2);
                    // dampen angular velocity more aggressively on floor contacts
                    object.physics.angularVelocity.multiplyScalar(0.7);
                }
                
                // if the object's largest dimension is much longer than it is tall,
                // apply rotational impulse when hitting the floor to encourage tipping over
                if (size.x > size.y * 1.5 || size.z > size.y * 1.5) {
                    // calculate a random rotational impulse around X or Z axis
                    const axis = Math.random() > 0.5 ? 'x' : 'z';
                    const sign = Math.random() > 0.5 ? 1 : -1;
                    const impulseStrength = 0.03 * sign; // small random impulse
                    
                    if (axis === 'x') {
                        object.physics.angularVelocity.x += impulseStrength;
                    } else {
                        object.physics.angularVelocity.z += impulseStrength;
                    }
                }
            }
            
            // top boundary
            if (center.y + halfHeight > halfSize) {
                const penetration = (center.y + halfHeight) - halfSize + buffer;
                object.physics.position.y -= penetration;
                
                if (object.physics.velocity.y > 0) {
                    object.physics.velocity.y = -object.physics.velocity.y * bounceStrength;
                }
            }
            
            // left boundary
            if (center.x - halfWidth < -halfSize) {
                const penetration = -halfSize - (center.x - halfWidth) + buffer;
                object.physics.position.x += penetration;
                
                if (object.physics.velocity.x < 0) {
                    object.physics.velocity.x = -object.physics.velocity.x * bounceStrength;
                }
            }
            
            // right boundary
            if (center.x + halfWidth > halfSize) {
                const penetration = (center.x + halfWidth) - halfSize + buffer;
                object.physics.position.x -= penetration;
                
                if (object.physics.velocity.x > 0) {
                    object.physics.velocity.x = -object.physics.velocity.x * bounceStrength;
                }
            }
            
            // back boundary
            if (center.z - halfDepth < -halfSize) {
                const penetration = -halfSize - (center.z - halfDepth) + buffer;
                object.physics.position.z += penetration;
                
                if (object.physics.velocity.z < 0) {
                    object.physics.velocity.z = -object.physics.velocity.z * bounceStrength;
                }
            }
            
            // front boundary
            if (center.z + halfDepth > halfSize) {
                const penetration = (center.z + halfDepth) - halfSize + buffer;
                object.physics.position.z -= penetration;
                
                if (object.physics.velocity.z > 0) {
                    object.physics.velocity.z = -object.physics.velocity.z * bounceStrength;
                }
            }
            
            // apply a velocity damping if object is moving too fast
            const speedSq = object.physics.velocity.lengthSq();
            const maxSpeed = speedLimit * 1.5;
            
            if (speedSq > maxSpeed * maxSpeed) {
                object.physics.velocity.multiplyScalar(0.9); // reduce velocity if too high
            }
            
            // update mesh position
            object.mesh.position.copy(object.physics.position);
        }
        
    }
    
    handleParticleObjectCollisions() {
        const { objects } = this.simulation.objectLoader;
        const { energyLoss } = this.simulation.params;
        
        // for each object
        for (const object of objects) {
            if (object.physics.isFixed) continue; // skip fixed objects
            
            // update object's bounding box
            object.physics.bbox.setFromObject(object.mesh);
            
            // for each particle
            for (let i = 0; i < this.particles.length; i++) {
                const p = this.particles[i];
                const v = this.velocities[i];
                const r = this.radii[i];
                const m1 = this.masses[i];
                
                // create a sphere for the particle
                const particleSphere = new THREE.Sphere(p.clone(), r);
                
                // check if particle intersects with object bounding box
                if (object.physics.bbox.intersectsSphere(particleSphere)) {
                    // simple collision response - treat the object as a heavier mass
                    const m2 = object.physics.mass;
                    
                    // calculate closest point on bbox to particle center
                    const closestPoint = new THREE.Vector3();
                    object.physics.bbox.clampPoint(p, closestPoint);
                    
                    // calculate direction and distance
                    const direction = new THREE.Vector3().subVectors(p, closestPoint).normalize();
                    const distance = p.distanceTo(closestPoint);
                    
                    // if there's penetration (distance less than radius)
                    if (distance < r) {
                        const penetration = r - distance;
                        
                        // calculate relative velocity
                        const relativeVelocity = new THREE.Vector3(
                            v.x - object.physics.velocity.x,
                            v.y - object.physics.velocity.y,
                            v.z - object.physics.velocity.z
                        );
                        
                        // calculate velocity along normal
                        const velAlongNormal = relativeVelocity.dot(direction);
                        
                        // only resolve if objects are moving toward each other
                        if (velAlongNormal < 0) {
                            // calculate impulse scalar - with energy loss
                            const restitution = 1.0 - energyLoss;
                            const j = -(1 + restitution) * velAlongNormal / (1/m1 + 1/m2);
                            
                            // calculate impulse vector
                            const impulse = direction.clone().multiplyScalar(j);
                            
                            // apply impulse to particle velocity
                            v.x -= impulse.x / m1;
                            v.y -= impulse.y / m1;
                            v.z -= impulse.z / m1;
                            
                            // apply impulse to object velocity (reduced effect due to mass)
                            object.physics.velocity.x += impulse.x / m2;
                            object.physics.velocity.y += impulse.y / m2;
                            object.physics.velocity.z += impulse.z / m2;
                            
                            // calculate torque for more realistic rotations
                            // vector from object center to collision point
                            const contactVector = new THREE.Vector3().subVectors(
                                closestPoint,
                                object.physics.position
                            );
                            
                            // calculate torque = r × F (cross product)
                            const torque = new THREE.Vector3().crossVectors(
                                contactVector,
                                impulse
                            );
                            
                            // scale torque based on object mass - larger effect for better rotation
                            const torqueScale = 0.2 / Math.cbrt(m2); // cube root for more balanced scaling
                            
                            // apply torque to angular velocity
                            object.physics.angularVelocity.x += torque.x * torqueScale;
                            object.physics.angularVelocity.y += torque.y * torqueScale;
                            object.physics.angularVelocity.z += torque.z * torqueScale;
                        }
                        
                        // move particle to prevent overlap
                        p.x += direction.x * penetration * 0.5;
                        p.y += direction.y * penetration * 0.5;
                        p.z += direction.z * penetration * 0.5;
                    }
                }
            }
        }
    }
    
    update() {
        // apply forces (gravity, mouse interaction)
        this.applyForces();
        
        // update particle positions
        this.simulation.particleManager.updateParticlePositions();

        // update object positions
        this.simulation.objectLoader.updateObjects();
        
        // handle collisions between particles and objects
        this.handleParticleObjectCollisions();
        
        // handle collisions between particles
        this.handleParticleCollisions();
        
        // handle boundary collisions for both particles and objects
        this.handleBoundaryCollisions();
    }
}
