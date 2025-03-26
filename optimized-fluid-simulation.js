/**
 * Core Fluid Simulation Implementation 
 * Based on PIC/FLIP method as used in the reference project
 */

class FluidSimulator {
    constructor(params) {
        // Simulation parameters
        this.params = params;
        
        // Grid dimensions
        this.gridWidth = params.gridWidth;
        this.gridHeight = params.gridHeight;
        this.gridDepth = params.gridDepth;
        
        // Grid resolution
        this.gridResX = params.gridResolutionX;
        this.gridResY = params.gridResolutionY;
        this.gridResZ = params.gridResolutionZ;
        
        // Cell size
        this.cellSizeX = this.gridWidth / this.gridResX;
        this.cellSizeY = this.gridHeight / this.gridResY;
        this.cellSizeZ = this.gridDepth / this.gridResZ;
        
        // Grid origin (center of simulation domain)
        this.originX = -this.gridWidth / 2;
        this.originY = -this.gridHeight / 2;
        this.originZ = -this.gridDepth / 2;
        
        // Create grid arrays - we use staggered MAC grid like the reference
        this.velocityGrid = new Float32Array((this.gridResX + 1) * (this.gridResY + 1) * (this.gridResZ + 1) * 3);
        this.tempVelocityGrid = new Float32Array((this.gridResX + 1) * (this.gridResY + 1) * (this.gridResZ + 1) * 3);
        this.originalVelocityGrid = new Float32Array((this.gridResX + 1) * (this.gridResY + 1) * (this.gridResZ + 1) * 3);
        
        // Weight grid for particle to grid transfer
        this.weightGrid = new Float32Array((this.gridResX + 1) * (this.gridResY + 1) * (this.gridResZ + 1) * 3);
        
        // Scalar grids (at cell centers)
        this.markerGrid = new Uint8Array(this.gridResX * this.gridResY * this.gridResZ);
        this.pressureGrid = new Float32Array(this.gridResX * this.gridResY * this.gridResZ);
        this.divergenceGrid = new Float32Array(this.gridResX * this.gridResY * this.gridResZ);
        this.tempScalarGrid = new Float32Array(this.gridResX * this.gridResY * this.gridResZ);
        
        // Particle data
        this.particlePositions = new Float32Array(params.particleCount * 4);
        this.particleVelocities = new Float32Array(params.particleCount * 4);
        this.particleRandoms = new Float32Array(params.particleCount * 4);
        
        // Initialize random directions for turbulence
        this.initializeRandomDirections();
    }
    
    // Initialize random directions for particles (for turbulence)
    initializeRandomDirections() {
        for (let i = 0; i < this.params.particleCount; i++) {
            // Generate random direction on unit sphere
            const theta = Math.random() * 2.0 * Math.PI;
            const u = Math.random() * 2.0 - 1.0;
            
            this.particleRandoms[i * 4] = Math.sqrt(1.0 - u * u) * Math.cos(theta);
            this.particleRandoms[i * 4 + 1] = Math.sqrt(1.0 - u * u) * Math.sin(theta);
            this.particleRandoms[i * 4 + 2] = u;
            this.particleRandoms[i * 4 + 3] = 0.0;
        }
    }
    
    // Set particle positions in a cube configuration
    initializeParticlesInCube() {
        const halfWidth = this.gridWidth / 2;
        const halfHeight = this.gridHeight / 2;
        const halfDepth = this.gridDepth / 2;
        
        // Size of the block of particles (70% of grid size)
        const blockWidth = this.gridWidth * 0.7;
        const blockHeight = this.gridHeight * 0.7;
        const blockDepth = this.gridDepth * 0.7;
        
        // Calculate number of particles per dimension for even distribution
        const particlesPerDimension = Math.cbrt(this.params.particleCount);
        const spacingX = blockWidth / particlesPerDimension;
        const spacingY = blockHeight / particlesPerDimension;
        const spacingZ = blockDepth / particlesPerDimension;
        
        let particleIndex = 0;
        for (let x = 0; x < particlesPerDimension && particleIndex < this.params.particleCount; x++) {
            for (let y = 0; y < particlesPerDimension && particleIndex < this.params.particleCount; y++) {
                for (let z = 0; z < particlesPerDimension && particleIndex < this.params.particleCount; z++) {
                    // Calculate position with slight jitter
                    const posX = -halfWidth + (x * spacingX) + (blockWidth - particlesPerDimension * spacingX) / 2 + (Math.random() * 0.1 - 0.05);
                    const posY = -halfHeight + (y * spacingY) + (blockHeight - particlesPerDimension * spacingY) / 2 + (Math.random() * 0.1 - 0.05);
                    const posZ = -halfDepth + (z * spacingZ) + (blockDepth - particlesPerDimension * spacingZ) / 2 + (Math.random() * 0.1 - 0.05);
                    
                    // Set position
                    this.particlePositions[particleIndex * 4] = posX;
                    this.particlePositions[particleIndex * 4 + 1] = posY;
                    this.particlePositions[particleIndex * 4 + 2] = posZ;
                    this.particlePositions[particleIndex * 4 + 3] = 0.0; // Not used
                    
                    // Initialize velocity
                    this.particleVelocities[particleIndex * 4] = 0.0;
                    this.particleVelocities[particleIndex * 4 + 1] = 0.0;
                    this.particleVelocities[particleIndex * 4 + 2] = 0.0;
                    this.particleVelocities[particleIndex * 4 + 3] = 0.0; // Not used
                    
                    particleIndex++;
                }
            }
        }
    }
    
    // Initialize dam break scenario (water starting from one side)
    initializeDamBreakScenario() {
        const halfWidth = this.gridWidth / 2;
        const halfHeight = this.gridHeight / 2;
        const halfDepth = this.gridDepth / 2;
        
        // Fill left 1/3 of the domain with particles
        const fillWidth = this.gridWidth * 0.33;
        
        // Calculate number of particles for even distribution
        const totalVolume = fillWidth * this.gridHeight * this.gridDepth;
        const particleVolume = totalVolume / this.params.particleCount;
        const particleSpacing = Math.pow(particleVolume, 1/3) * 0.95; // 0.95 factor for slight compression
        
        let particleIndex = 0;
        
        // Calculate how many particles can fit in each dimension
        const countX = Math.floor(fillWidth / particleSpacing);
        const countY = Math.floor(this.gridHeight / particleSpacing);
        const countZ = Math.floor(this.gridDepth / particleSpacing);
        
        for (let x = 0; x < countX && particleIndex < this.params.particleCount; x++) {
            for (let y = 0; y < countY && particleIndex < this.params.particleCount; y++) {
                for (let z = 0; z < countZ && particleIndex < this.params.particleCount; z++) {
                    // Calculate position with a small random offset
                    const posX = -halfWidth + x * particleSpacing + (Math.random() * 0.1 - 0.05) * particleSpacing;
                    const posY = -halfHeight + y * particleSpacing + (Math.random() * 0.1 - 0.05) * particleSpacing;
                    const posZ = -halfDepth + z * particleSpacing + (Math.random() * 0.1 - 0.05) * particleSpacing;
                    
                    // Set position
                    this.particlePositions[particleIndex * 4] = posX;
                    this.particlePositions[particleIndex * 4 + 1] = posY;
                    this.particlePositions[particleIndex * 4 + 2] = posZ;
                    this.particlePositions[particleIndex * 4 + 3] = 0.0; // Not used
                    
                    // Initialize velocity
                    this.particleVelocities[particleIndex * 4] = 0.0;
                    this.particleVelocities[particleIndex * 4 + 1] = 0.0;
                    this.particleVelocities[particleIndex * 4 + 2] = 0.0;
                    this.particleVelocities[particleIndex * 4 + 3] = 0.0; // Not used
                    
                    particleIndex++;
                }
            }
        }
    }
    
    // Index for the staggered grid
    getStaggeredIndex(x, y, z, component) {
        const xIndex = component === 0 ? x : x + 0.5;
        const yIndex = component === 1 ? y : y + 0.5;
        const zIndex = component === 2 ? z : z + 0.5;
        
        return ((Math.floor(zIndex) * (this.gridResY + 1) + Math.floor(yIndex)) * (this.gridResX + 1) + Math.floor(xIndex)) * 3 + component;
    }
    
    // Index for the regular grid (cell centers)
    getCellIndex(x, y, z) {
        return (z * this.gridResY + y) * this.gridResX + x;
    }
    
    // Reset the marker grid
    resetMarkerGrid() {
        for (let i = 0; i < this.markerGrid.length; i++) {
            this.markerGrid[i] = 0;
        }
    }
    
    // Mark cells containing fluid
    markFluidCells() {
        this.resetMarkerGrid();
        
        for (let i = 0; i < this.params.particleCount; i++) {
            const px = this.particlePositions[i * 4];
            const py = this.particlePositions[i * 4 + 1];
            const pz = this.particlePositions[i * 4 + 2];
            
            // Convert world position to grid cell
            const gx = Math.floor((px - this.originX) / this.cellSizeX);
            const gy = Math.floor((py - this.originY) / this.cellSizeY);
            const gz = Math.floor((pz - this.originZ) / this.cellSizeZ);
            
            // Bounds check
            if (gx >= 0 && gx < this.gridResX && 
                gy >= 0 && gy < this.gridResY &&
                gz >= 0 && gz < this.gridResZ) {
                this.markerGrid[this.getCellIndex(gx, gy, gz)] = 1;
            }
        }
    }
    
    // Kernel function for particle to grid transfer (quadratic B-spline)
    kernel(r) {
        const q = Math.abs(r);
        if (q < 0.5) {
            return 0.75 - q * q;
        } else if (q < 1.5) {
            return 0.5 * Math.pow(1.5 - q, 2);
        }
        return 0;
    }
    
    // Trilinear interpolation weight
    trilinearWeight(px, py, pz, gx, gy, gz) {
        const dx = Math.abs(px - gx);
        const dy = Math.abs(py - gy);
        const dz = Math.abs(pz - gz);
        
        return this.kernel(dx) * this.kernel(dy) * this.kernel(dz);
    }
    
    // Transfer particle velocities to grid (PIC step)
    transferParticlesToGrid() {
        // Reset grid velocities and weights
        for (let i = 0; i < this.velocityGrid.length; i++) {
            this.velocityGrid[i] = 0;
            this.weightGrid[i] = 0;
        }
        
        // Transfer each particle to grid
        for (let i = 0; i < this.params.particleCount; i++) {
            const px = this.particlePositions[i * 4];
            const py = this.particlePositions[i * 4 + 1];
            const pz = this.particlePositions[i * 4 + 2];
            
            const vx = this.particleVelocities[i * 4];
            const vy = this.particleVelocities[i * 4 + 1];
            const vz = this.particleVelocities[i * 4 + 2];
            
            // Convert world position to grid space
            const gridX = (px - this.originX) / this.cellSizeX;
            const gridY = (py - this.originY) / this.cellSizeY;
            const gridZ = (pz - this.originZ) / this.cellSizeZ;
            
            // Grid cell indices (integer part)
            const ix = Math.floor(gridX);
            const iy = Math.floor(gridY);
            const iz = Math.floor(gridZ);
            
            // Apply to 2x2x2 neighborhood
            for (let dx = 0; dx <= 1; dx++) {
                for (let dy = 0; dy <= 1; dy++) {
                    for (let dz = 0; dz <= 1; dz++) {
                        const cellX = ix + dx;
                        const cellY = iy + dy;
                        const cellZ = iz + dz;
                        
                        // Skip cells outside grid
                        if (cellX < 0 || cellX >= this.gridResX || 
                            cellY < 0 || cellY >= this.gridResY || 
                            cellZ < 0 || cellZ >= this.gridResZ) {
                            continue;
                        }
                        
                        // Calculate weight using kernel function
                        const weight = this.trilinearWeight(
                            gridX, gridY, gridZ, 
                            cellX + 0.5, cellY + 0.5, cellZ + 0.5
                        );
                        
                        if (weight > 0) {
                            // X velocity (staggered at x faces)
                            const xIndex = this.getStaggeredIndex(cellX, cellY, cellZ, 0);
                            this.velocityGrid[xIndex] += vx * weight;
                            this.weightGrid[xIndex] += weight;
                            
                            // Y velocity (staggered at y faces)
                            const yIndex = this.getStaggeredIndex(cellX, cellY, cellZ, 1);
                            this.velocityGrid[yIndex] += vy * weight;
                            this.weightGrid[yIndex] += weight;
                            
                            // Z velocity (staggered at z faces)
                            const zIndex = this.getStaggeredIndex(cellX, cellY, cellZ, 2);
                            this.velocityGrid[zIndex] += vz * weight;
                            this.weightGrid[zIndex] += weight;
                        }
                    }
                }
            }
        }
        
        // Normalize grid velocities
        for (let i = 0; i < this.velocityGrid.length; i++) {
            if (this.weightGrid[i] > 0.0001) {
                this.velocityGrid[i] /= this.weightGrid[i];
            }
        }
        
        // Save a copy of the original velocity field for FLIP
        this.originalVelocityGrid.set(this.velocityGrid);
    }
    
    // Apply external forces to grid velocities
    applyExternalForces(timeStep) {
        // Apply gravity
        for (let x = 0; x <= this.gridResX; x++) {
            for (let y = 0; y <= this.gridResY; y++) {
                for (let z = 0; z <= this.gridResZ; z++) {
                    const yIndex = this.getStaggeredIndex(x, y, z, 1);
                    
                    if (this.weightGrid[yIndex] > 0.0001) {
                        // Apply gravity in the Y direction
                        this.velocityGrid[yIndex] -= 9.8 * timeStep;
                    }
                }
            }
        }
    }
    
    // Apply boundary conditions to the velocity grid
    enforceBoundaries() {
        for (let x = 0; x <= this.gridResX; x++) {
            for (let y = 0; y <= this.gridResY; y++) {
                for (let z = 0; z <= this.gridResZ; z++) {
                    // X velocities at boundaries
                    if (x === 0 || x === this.gridResX) {
                        const xIndex = this.getStaggeredIndex(x, y, z, 0);
                        this.velocityGrid[xIndex] = 0;
                    }
                    
                    // Y velocities at boundaries
                    if (y === 0 || y === this.gridResY) {
                        const yIndex = this.getStaggeredIndex(x, y, z, 1);
                        this.velocityGrid[yIndex] = 0;
                    }
                    
                    // Z velocities at boundaries
                    if (z === 0 || z === this.gridResZ) {
                        const zIndex = this.getStaggeredIndex(x, y, z, 2);
                        this.velocityGrid[zIndex] = 0;
                    }
                }
            }
        }
    }
    
    // Calculate divergence of the velocity field
    calculateDivergence() {
        for (let i = 0; i < this.divergenceGrid.length; i++) {
            this.divergenceGrid[i] = 0;
        }
        
        for (let x = 0; x < this.gridResX; x++) {
            for (let y = 0; y < this.gridResY; y++) {
                for (let z = 0; z < this.gridResZ; z++) {
                    // Only calculate divergence for fluid cells
                    if (this.markerGrid[this.getCellIndex(x, y, z)] === 0) {
                        continue;
                    }
                    
                    // Get velocities at the faces of the cell
                    const vxLeft = this.velocityGrid[this.getStaggeredIndex(x, y, z, 0)];
                    const vxRight = this.velocityGrid[this.getStaggeredIndex(x + 1, y, z, 0)];
                    
                    const vyBottom = this.velocityGrid[this.getStaggeredIndex(x, y, z, 1)];
                    const vyTop = this.velocityGrid[this.getStaggeredIndex(x, y + 1, z, 1)];
                    
                    const vzBack = this.velocityGrid[this.getStaggeredIndex(x, y, z, 2)];
                    const vzFront = this.velocityGrid[this.getStaggeredIndex(x, y, z + 1, 2)];
                    
                    // Calculate divergence
                    const div = (vxRight - vxLeft) + (vyTop - vyBottom) + (vzFront - vzBack);
                    
                    this.divergenceGrid[this.getCellIndex(x, y, z)] = div;
                }
            }
        }
    }
    
    // Solve pressure using Jacobi iteration
    solvePressure(iterations) {
        // Reset pressure
        for (let i = 0; i < this.pressureGrid.length; i++) {
            this.pressureGrid[i] = 0;
        }
        
        // Jacobi iteration
        for (let iter = 0; iter < iterations; iter++) {
            // Copy pressure to temp grid
            this.tempScalarGrid.set(this.pressureGrid);
            
            for (let x = 0; x < this.gridResX; x++) {
                for (let y = 0; y < this.gridResY; y++) {
                    for (let z = 0; z < this.gridResZ; z++) {
                        // Skip non-fluid cells
                        if (this.markerGrid[this.getCellIndex(x, y, z)] === 0) {
                            continue;
                        }
                        
                        // Count solid or air neighbors
                        let validNeighbors = 6;
                        
                        // Gather pressures from neighbors
                        let pLeft = x > 0 ? this.tempScalarGrid[this.getCellIndex(x - 1, y, z)] : 0;
                        let pRight = x < this.gridResX - 1 ? this.tempScalarGrid[this.getCellIndex(x + 1, y, z)] : 0;
                        let pBottom = y > 0 ? this.tempScalarGrid[this.getCellIndex(x, y - 1, z)] : 0;
                        let pTop = y < this.gridResY - 1 ? this.tempScalarGrid[this.getCellIndex(x, y + 1, z)] : 0;
                        let pBack = z > 0 ? this.tempScalarGrid[this.getCellIndex(x, y, z - 1)] : 0;
                        let pFront = z < this.gridResZ - 1 ? this.tempScalarGrid[this.getCellIndex(x, y, z + 1)] : 0;
                        
                        // Adjust for boundaries or non-fluid neighbors
                        if (x === 0 || (x > 0 && this.markerGrid[this.getCellIndex(x - 1, y, z)] === 0)) {
                            validNeighbors--;
                        }
                        if (x === this.gridResX - 1 || (x < this.gridResX - 1 && this.markerGrid[this.getCellIndex(x + 1, y, z)] === 0)) {
                            validNeighbors--;
                        }
                        if (y === 0 || (y > 0 && this.markerGrid[this.getCellIndex(x, y - 1, z)] === 0)) {
                            validNeighbors--;
                        }
                        if (y === this.gridResY - 1 || (y < this.gridResY - 1 && this.markerGrid[this.getCellIndex(x, y + 1, z)] === 0)) {
                            validNeighbors--;
                        }
                        if (z === 0 || (z > 0 && this.markerGrid[this.getCellIndex(x, y, z - 1)] === 0)) {
                            validNeighbors--;
                        }
                        if (z === this.gridResZ - 1 || (z < this.gridResZ - 1 && this.markerGrid[this.getCellIndex(x, y, z + 1)] === 0)) {
                            validNeighbors--;
                        }
                        
                        // Skip isolated fluid cells
                        if (validNeighbors === 0) continue;
                        
                        // Jacobi iteration for pressure
                        const divergence = this.divergenceGrid[this.getCellIndex(x, y, z)];
                        const newPressure = (pLeft + pRight + pBottom + pTop + pBack + pFront - divergence) / validNeighbors;
                        
                        this.pressureGrid[this.getCellIndex(x, y, z)] = newPressure;
                    }
                }
            }
        }
    }
    
    // Apply pressure gradient to velocity field
    applyPressureGradient() {
        for (let x = 0; x <= this.gridResX; x++) {
            for (let y = 0; y <= this.gridResY; y++) {
                for (let z = 0; z <= this.gridResZ; z++) {
                    // X velocity component
                    if (x > 0 && x < this.gridResX) {
                        const leftCell = this.getCellIndex(x - 1, y, z);
                        const rightCell = this.getCellIndex(x, y, z);
                        
                        let leftPressure = 0;
                        let rightPressure = 0;
                        
                        if (x > 0 && this.markerGrid[leftCell] !== 0) {
                            leftPressure = this.pressureGrid[leftCell];
                        }
                        
                        if (x < this.gridResX && this.markerGrid[rightCell] !== 0) {
                            rightPressure = this.pressureGrid[rightCell];
                        }
                        
                        const xIndex = this.getStaggeredIndex(x, y, z, 0);
                        if (this.weightGrid[xIndex] > 0.0001) {
                            this.velocityGrid[xIndex] -= (rightPressure - leftPressure);
                        }
                    }
                    
                    // Y velocity component
                    if (y > 0 && y < this.gridResY) {
                        const bottomCell = this.getCellIndex(x, y - 1, z);
                        const topCell = this.getCellIndex(x, y, z);
                        
                        let bottomPressure = 0;
                        let topPressure = 0;
                        
                        if (y > 0 && this.markerGrid[bottomCell] !== 0) {
                            bottomPressure = this.pressureGrid[bottomCell];
                        }
                        
                        if (y < this.gridResY && this.markerGrid[topCell] !== 0) {
                            topPressure = this.pressureGrid[topCell];
                        }
                        
                        const yIndex = this.getStaggeredIndex(x, y, z, 1);
                        if (this.weightGrid[yIndex] > 0.0001) {
                            this.velocityGrid[yIndex] -= (topPressure - bottomPressure);
                        }
                    }
                    
                    // Z velocity component
                    if (z > 0 && z < this.gridResZ) {
                        const backCell = this.getCellIndex(x, y, z - 1);
                        const frontCell = this.getCellIndex(x, y, z);
                        
                        let backPressure = 0;
                        let frontPressure = 0;
                        
                        if (z > 0 && this.markerGrid[backCell] !== 0) {
                            backPressure = this.pressureGrid[backCell];
                        }
                        
                        if (z < this.gridResZ && this.markerGrid[frontCell] !== 0) {
                            frontPressure = this.pressureGrid[frontCell];
                        }
                        
                        const zIndex = this.getStaggeredIndex(x, y, z, 2);
                        if (this.weightGrid[zIndex] > 0.0001) {
                            this.velocityGrid[zIndex] -= (frontPressure - backPressure);
                        }
                    }
                }
            }
        }
    }
    
    // Sample velocity at a position using trilinear interpolation
    sampleVelocity(x, y, z) {
        // Convert world position to grid space
        const gridX = (x - this.originX) / this.cellSizeX;
        const gridY = (y - this.originY) / this.cellSizeY;
        const gridZ = (z - this.originZ) / this.cellSizeZ;
        
        // Grid cell indices
        const ix = Math.floor(gridX);
        const iy = Math.floor(gridY);
        const iz = Math.floor(gridZ);
        
        // Staggered positions for velocity components
        const vx = this.trilinearSampleComponent(gridX, gridY, gridZ, 0);
        const vy = this.trilinearSampleComponent(gridX, gridY, gridZ, 1);
        const vz = this.trilinearSampleComponent(gridX, gridY, gridZ, 2);
        
        return [vx, vy, vz];
    }
    
    // Sample a velocity component with trilinear interpolation
    trilinearSampleComponent(gridX, gridY, gridZ, component) {
        // Adjust position for staggered grid
        const x = component === 0 ? gridX : gridX - 0.5;
        const y = component === 1 ? gridY : gridY - 0.5;
        const z = component === 2 ? gridZ : gridZ - 0.5;
        
        // Grid indices
        const ix = Math.floor(x);
        const iy = Math.floor(y);
        const iz = Math.floor(z);
        
        // Interpolation factors
        const fx = x - ix;
        const fy = y - iy;
        const fz = z - iz;
        
        // Fetch values at 8 corners
        const v000 = this.getSafeVelocityComponent(ix, iy, iz, component);
        const v001 = this.getSafeVelocityComponent(ix, iy, iz + 1, component);
        const v010 = this.getSafeVelocityComponent(ix, iy + 1, iz, component);
        const v011 = this.getSafeVelocityComponent(ix, iy + 1, iz + 1, component);
        const v100 = this.getSafeVelocityComponent(ix + 1, iy, iz, component);
        const v101 = this.getSafeVelocityComponent(ix + 1, iy, iz + 1, component);
        const v110 = this.getSafeVelocityComponent(ix + 1, iy + 1, iz, component);
        const v111 = this.getSafeVelocityComponent(ix + 1, iy + 1, iz + 1, component);
        
        // Trilinear interpolation
        const v00 = v000 * (1 - fx) + v100 * fx;
        const v01 = v001 * (1 - fx) + v101 * fx;
        const v10 = v010 * (1 - fx) + v110 * fx;
        const v11 = v011 * (1 - fx) + v111 * fx;
        
        const v0 = v00 * (1 - fy) + v10 * fy;
        const v1 = v01 * (1 - fy) + v11 * fy;
        
        return v0 * (1 - fz) + v1 * fz;
    }
    
    // Get velocity with bounds checking
    getSafeVelocityComponent(x, y, z, component) {
        // Clamp to boundaries
        const cx = Math.max(0, Math.min(x, component === 0 ? this.gridResX : this.gridResX - 1));
        const cy = Math.max(0, Math.min(y, component === 1 ? this.gridResY : this.gridResY - 1));
        const cz = Math.max(0, Math.min(z, component === 2 ? this.gridResZ : this.gridResZ - 1));
        
        const index = this.getStaggeredIndex(cx, cy, cz, component);
        return this.velocityGrid[index];
    }
    
    // Transfer velocities back to particles (FLIP)
    transferVelocitiesToParticles() {
        for (let i = 0; i < this.params.particleCount; i++) {
            const px = this.particlePositions[i * 4];
            const py = this.particlePositions[i * 4 + 1];
            const pz = this.particlePositions[i * 4 + 2];
            
            // Sample velocities at particle position
            const [gridVx, gridVy, gridVz] = this.sampleVelocity(px, py, pz);
            const [origGridVx, origGridVy, origGridVz] = this.sampleOriginalVelocity(px, py, pz);
            
            // PIC velocity
            const picVx = gridVx;
            const picVy = gridVy;
            const picVz = gridVz;
            
            // FLIP velocity (keep the difference)
            const oldVx = this.particleVelocities[i * 4];
            const oldVy = this.particleVelocities[i * 4 + 1];
            const oldVz = this.particleVelocities[i * 4 + 2];
            
            const flipVx = oldVx + (gridVx - origGridVx);
            const flipVy = oldVy + (gridVy - origGridVy);
            const flipVz = oldVz + (gridVz - origGridVz);
            
            // Mix PIC and FLIP based on flipness parameter
            this.particleVelocities[i * 4] = picVx * (1 - this.params.flipness) + flipVx * this.params.flipness;
            this.particleVelocities[i * 4 + 1] = picVy * (1 - this.params.flipness) + flipVy * this.params.flipness;
            this.particleVelocities[i * 4 + 2] = picVz * (1 - this.params.flipness) + flipVz * this.params.flipness;
        }
    }
    
    // Sample original velocity at a position
    sampleOriginalVelocity(x, y, z) {
        // Store the current velocity grid
        const tempGrid = this.velocityGrid;
        
        // Set the original velocity grid for sampling
        this.velocityGrid = this.originalVelocityGrid;
        
        // Sample the velocity
        const velocity = this.sampleVelocity(x, y, z);
        
        // Restore the velocity grid
        this.velocityGrid = tempGrid;
        
        return velocity;
    }
    
    // Update particle positions using RK2 (midpoint method)
    advectParticles(timeStep) {
        // Spatial hash for particle-particle collisions
        const spatialHash = this.buildSpatialHash();
        
        for (let i = 0; i < this.params.particleCount; i++) {
            const px = this.particlePositions[i * 4];
            const py = this.particlePositions[i * 4 + 1];
            const pz = this.particlePositions[i * 4 + 2];
            
            const vx = this.particleVelocities[i * 4];
            const vy = this.particleVelocities[i * 4 + 1];
            const vz = this.particleVelocities[i * 4 + 2];
            
            // Midpoint method (RK2)
            // 1. Compute half-step position
            const halfX = px + vx * timeStep * 0.5;
            const halfY = py + vy * timeStep * 0.5;
            const halfZ = pz + vz * timeStep * 0.5;
            
            // 2. Sample velocity at half-step position
            const [halfVx, halfVy, halfVz] = this.sampleVelocity(halfX, halfY, halfZ);
            
            // 3. Full step with half-step velocity
            let newX = px + halfVx * timeStep;
            let newY = py + halfVy * timeStep;
            let newZ = pz + halfVz * timeStep;
            
            // Add a small random offset for turbulence (scaled by velocity magnitude)
            const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);
            const turbulenceScale = 0.05 * speed * timeStep;
            
            newX += this.particleRandoms[i * 4] * turbulenceScale;
            newY += this.particleRandoms[i * 4 + 1] * turbulenceScale;
            newZ += this.particleRandoms[i * 4 + 2] * turbulenceScale;
            
            // Handle particle-particle collisions
            this.handleParticleCollisions(i, px, py, pz, newX, newY, newZ, spatialHash);
            
            // Enforce boundary conditions
            this.enforceParticleBoundaries(i, newX, newY, newZ);
            
            // Update particle position
            this.particlePositions[i * 4] = newX;
            this.particlePositions[i * 4 + 1] = newY;
            this.particlePositions[i * 4 + 2] = newZ;
        }
    }
    
    // Create a spatial hash for particle-particle collision
    buildSpatialHash() {
        const radius = this.params.sphereRadius * 2;
        const hash = {};
        
        // Hash function to get grid cell coordinates
        function getHashKey(x, y, z, radius) {
            const ix = Math.floor(x / radius);
            const iy = Math.floor(y / radius);
            const iz = Math.floor(z / radius);
            return `${ix},${iy},${iz}`;
        }
        
        // Insert all particles into hash
        for (let i = 0; i < this.params.particleCount; i++) {
            const px = this.particlePositions[i * 4];
            const py = this.particlePositions[i * 4 + 1];
            const pz = this.particlePositions[i * 4 + 2];
            
            const key = getHashKey(px, py, pz, radius);
            
            if (!hash[key]) {
                hash[key] = [];
            }
            
            hash[key].push(i);
        }
        
        return { hash, getKey: (x, y, z) => getHashKey(x, y, z, radius) };
    }
    
    // Handle particle-particle collisions
    handleParticleCollisions(index, oldX, oldY, oldZ, newX, newY, newZ, spatialHash) {
        const particleRadius = this.params.sphereRadius;
        const minDistSq = (particleRadius * 2) * (particleRadius * 2);
        
        // Get neighboring cells
        const key = spatialHash.getKey(newX, newY, newZ);
        const ix = Math.floor(newX / (particleRadius * 2));
        const iy = Math.floor(newY / (particleRadius * 2));
        const iz = Math.floor(newZ / (particleRadius * 2));
        
        // Check surrounding grid cells
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                for (let dz = -1; dz <= 1; dz++) {
                    const neighborKey = `${ix + dx},${iy + dy},${iz + dz}`;
                    const neighbors = spatialHash.hash[neighborKey];
                    
                    if (!neighbors) continue;
                    
                    // Check each particle in this cell
                    for (let j = 0; j < neighbors.length; j++) {
                        const otherIndex = neighbors[j];
                        
                        // Skip self
                        if (otherIndex === index) continue;
                        
                        const ox = this.particlePositions[otherIndex * 4];
                        const oy = this.particlePositions[otherIndex * 4 + 1];
                        const oz = this.particlePositions[otherIndex * 4 + 2];
                        
                        // Compute square distance
                        const dx = newX - ox;
                        const dy = newY - oy;
                        const dz = newZ - oz;
                        const distSq = dx * dx + dy * dy + dz * dz;
                        
                        // Collision response
                        if (distSq < minDistSq && distSq > 0.0001) {
                            const dist = Math.sqrt(distSq);
                            const overlap = (particleRadius * 2) - dist;
                            
                            if (overlap > 0) {
                                // Normalize direction vector
                                const nx = dx / dist;
                                const ny = dy / dist;
                                const nz = dz / dist;
                                
                                // Push particles apart
                                const pushFactor = overlap * 0.5;
                                
                                // Update planned position
                                newX += nx * pushFactor;
                                newY += ny * pushFactor;
                                newZ += nz * pushFactor;
                                
                                // Reflect velocity component along collision normal
                                const vx = this.particleVelocities[index * 4];
                                const vy = this.particleVelocities[index * 4 + 1];
                                const vz = this.particleVelocities[index * 4 + 2];
                                
                                const dot = vx * nx + vy * ny + vz * nz;
                                
                                // Only reflect if moving toward the other particle
                                if (dot < 0) {
                                    const damping = 0.5; // Collision damping
                                    
                                    this.particleVelocities[index * 4] = (vx - 2 * dot * nx) * damping;
                                    this.particleVelocities[index * 4 + 1] = (vy - 2 * dot * ny) * damping;
                                    this.particleVelocities[index * 4 + 2] = (vz - 2 * dot * nz) * damping;
                                }
                            }
                        }
                    }
                }
            }
        }
        
        return [newX, newY, newZ];
    }
    
    // Enforce boundary conditions for particles
    enforceParticleBoundaries(index, x, y, z) {
        const halfWidth = this.gridWidth / 2;
        const halfHeight = this.gridHeight / 2;
        const halfDepth = this.gridDepth / 2;
        
        // Boundary damping factor
        const damping = 0.3;
        
        // X boundaries
        if (x < -halfWidth) {
            this.particlePositions[index * 4] = -halfWidth;
            this.particleVelocities[index * 4] *= -damping;
        } else if (x > halfWidth) {
            this.particlePositions[index * 4] = halfWidth;
            this.particleVelocities[index * 4] *= -damping;
        } else {
            this.particlePositions[index * 4] = x;
        }
        
        // Y boundaries
        if (y < -halfHeight) {
            this.particlePositions[index * 4 + 1] = -halfHeight;
            this.particleVelocities[index * 4 + 1] *= -damping;
        } else if (y > halfHeight) {
            this.particlePositions[index * 4 + 1] = halfHeight;
            this.particleVelocities[index * 4 + 1] *= -damping;
        } else {
            this.particlePositions[index * 4 + 1] = y;
        }
        
        // Z boundaries
        if (z < -halfDepth) {
            this.particlePositions[index * 4 + 2] = -halfDepth;
            this.particleVelocities[index * 4 + 2] *= -damping;
        } else if (z > halfDepth) {
            this.particlePositions[index * 4 + 2] = halfDepth;
            this.particleVelocities[index * 4 + 2] *= -damping;
        } else {
            this.particlePositions[index * 4 + 2] = z;
        }
    }
    
    // Main simulation step
    simulate(timeStep) {
        // Enforce a maximum time step for stability
        const dt = Math.min(timeStep, 1/30);
        
        // Clear the grid
        for (let i = 0; i < this.velocityGrid.length; i++) {
            this.velocityGrid[i] = 0;
            this.weightGrid[i] = 0;
            this.originalVelocityGrid[i] = 0;
        }
        
        // 1. Mark fluid cells
        this.markFluidCells();
        
        // 2. Transfer particle velocities to grid
        this.transferParticlesToGrid();
        
        // 3. Apply external forces
        this.applyExternalForces(dt);
        
        // 4. Enforce boundary conditions
        this.enforceBoundaries();
        
        // 5. Calculate divergence
        this.calculateDivergence();
        
        // 6. Solve pressure
        this.solvePressure(50); // 50 iterations like the reference code
        
        // 7. Apply pressure forces
        this.applyPressureGradient();
        
        // 8. Enforce boundary conditions again
        this.enforceBoundaries();
        
        // 9. Transfer velocities back to particles
        this.transferVelocitiesToParticles();
        
        // 10. Advect particles
        this.advectParticles(dt);
        
        return {
            positions: this.particlePositions,
            velocities: this.particleVelocities
        };
    }
}