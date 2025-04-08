/**
 * PaperManager class
 * handles creation, subdivision, and rendering of the paper
 */
class PaperManager {
    constructor(simulation) {
        this.simulation = simulation;
        this.scene = simulation.sceneManager.scene;
        
        // paper properties
        this.paperSize = 1.0; // base scale factor
        this.paperWidth = 8.5 * this.paperSize; // standard letter width
        this.paperHeight = 11 * this.paperSize; // standard letter height
        this.paperThickness = 0.01; // thickness of the paper
        this.paperSegments = { x: 40, y: 50 }; // segments for the paper mesh
        this.paperColor = 0xffffff; // default white paper
        
        // paper texture type
        this.paperTexture = 'white'; // default texture
        
        // paper mesh and pieces
        this.paperMesh = null;
        this.paperPieces = [];
        
        // hanging points (pins)
        this.hangingPoints = [];
        
        // create the initial paper
        this.createPaper();
    }
    
    /**
     * create the paper mesh
     */
    createPaper() {
        // calculate aspect ratio-correct dimensions
        const aspectRatio = this.paperWidth / this.paperHeight;
        
        // create plane with higher segment density for clean cutting
        this.paperSegments = { 
            x: 60, // Higher resolution for cleaner cuts 
            y: 80  // Higher resolution for cleaner cuts
        };
        
        const geometry = new THREE.PlaneGeometry(
            2.0 * aspectRatio, 
            2.0, 
            this.paperSegments.x, 
            this.paperSegments.y
        );
        
        // load texture based on current paper texture type
        const texture = this.loadPaperTexture(this.paperTexture);
        
        // create paper material with subtle effects
        const material = new THREE.MeshPhysicalMaterial({
            color: this.paperColor,
            roughness: 0.7,
            metalness: 0.1,
            side: THREE.DoubleSide,
            map: texture,
            transparent: true,
            opacity: 0.95,
            flatShading: false
        });
        
        // create the mesh
        this.paperMesh = new THREE.Mesh(geometry, material);
        this.paperMesh.castShadow = true;
        this.paperMesh.receiveShadow = true;
        
        // position the paper VERTICALLY (fixed orientation)
        this.paperMesh.rotation.x = 0; // reset any rotation
        // Position it so it hangs down
        this.paperMesh.position.set(0, 0, 0);
        
        // add subtle waviness to the paper
        this.addPaperWaviness();
        
        // create a hint of thickness
        this.createPaperEdges();
        
        // add the paper to the scene
        this.scene.add(this.paperMesh);
        
        // create the "hanging" effect with pins
        this.createHangingEffect();
    }
    
    /**
     * add subtle waviness to the paper
     */
    addPaperWaviness() {
        const position = this.paperMesh.geometry.attributes.position;
        const count = position.count;
        
        // add subtle random waviness to make the paper look more natural
        for (let i = 0; i < count; i++) {
            const x = position.getX(i);
            const y = position.getY(i);
            const z = position.getZ(i);
            
            // add very subtle random variation to z
            const distFromCenter = Math.sqrt(x*x + y*y);
            const edgeFactor = Math.min(1, distFromCenter / 1.0);
            
            // more waviness near edges
            const wavinessFactor = 0.01 * edgeFactor;
            const waviness = (Math.random() - 0.5) * wavinessFactor;
            
            position.setZ(i, z + waviness);
        }
        
        position.needsUpdate = true;
        this.paperMesh.geometry.computeVertexNormals();
    }
    
    /**
     * create a hanging effect for the paper
     */
    createHangingEffect() {
        // Initialize the hangingPoints array
        this.hangingPoints = [];
        
        // Create pins at the top of the paper to hold it
        const topY = 1.0; // Top of the paper
        
        // Add pins along the top edge
        const pinCount = 3; // number of pins
        
        for (let i = 0; i < pinCount; i++) {
            const xPos = (i / (pinCount - 1) - 0.5) * 1.8; // Spread across top edge
            const pinPosition = new THREE.Vector3(xPos, topY, 0);
            
            // Create visual pin
            this.createPin(pinPosition);
            
            // Store pin position
            this.hangingPoints.push(pinPosition);
        }
        
        // Add subtle animation for the hanging paper
        this.addHangingAnimation();
    }
    
    /**
     * create a visual pin
     */
    createPin(position) {
        // Create a pin to visually show where the paper is held
        const pinGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.15, 12);
        const pinMaterial = new THREE.MeshStandardMaterial({
            color: 0xdddddd,
            metalness: 0.8,
            roughness: 0.2
        });
        
        // create pin head
        const pinHeadGeometry = new THREE.SphereGeometry(0.04, 16, 16);
        const pinHeadMaterial = new THREE.MeshStandardMaterial({
            color: 0x4285f4, // Google blue
            metalness: 0.5,
            roughness: 0.3
        });
        
        const pin = new THREE.Mesh(pinGeometry, pinMaterial);
        const pinHead = new THREE.Mesh(pinHeadGeometry, pinHeadMaterial);
        
        // position pin and pin head
        pin.position.copy(position);
        pinHead.position.copy(position);
        pinHead.position.z += 0.075; // Move pin head forward
        
        // Rotate pin to point out from paper
        pin.rotation.x = Math.PI / 2;
        
        // add to scene
        this.scene.add(pin);
        this.scene.add(pinHead);
    }
    
    /**
     * add subtle hanging animation
     */
    addHangingAnimation() {
        // Setup physics-based animation properties
        this.animationTime = 0;
        this.paperPhysicsVertices = [];
        this.originalVertexPositions = [];
        
        // Store original vertex positions if geometry exists
        if (this.paperMesh && this.paperMesh.geometry && this.paperMesh.geometry.attributes && 
            this.paperMesh.geometry.attributes.position) {
            const position = this.paperMesh.geometry.attributes.position;
            for (let i = 0; i < position.count; i++) {
                const vertex = new THREE.Vector3(
                    position.getX(i),
                    position.getY(i),
                    position.getZ(i)
                );
                this.originalVertexPositions.push(vertex.clone());
                this.paperPhysicsVertices.push(vertex.clone());
            }
        }
    }
    
    /**
     * update the hanging paper animation
     */
    updateHangingAnimation() {
        // Skip if no paper mesh or no original vertices
        if (!this.paperMesh || !this.originalVertexPositions || 
            !this.paperMesh.geometry || !this.paperMesh.geometry.attributes || 
            !this.paperMesh.geometry.attributes.position) {
            return;
        }
        
        // Increase animation time
        this.animationTime += 0.01;
        
        // Create subtle swaying motion based on gravity
        const gravity = this.simulation.params.gravity * 0.001;
        const stiffness = this.simulation.params.stiffness;
        
        // Get position attribute
        const position = this.paperMesh.geometry.attributes.position;
        
        // Apply simple cloth physics to make paper hang naturally
        for (let i = 0; i < position.count; i++) {
            // Make sure we have valid data for this vertex
            if (i >= this.originalVertexPositions.length) continue;
            
            // Get original vertex position
            const originalVertex = this.originalVertexPositions[i];
            if (!originalVertex) continue;
            
            // Get Y coordinate (vertical position in paper)
            const vertexY = originalVertex.y;
            
            // Skip vertices at or near pins
            let isPinned = false;
            for (const pin of this.hangingPoints) {
                // Check if vertex is close to pin position
                if (pin && Math.abs(originalVertex.x - pin.x) < 0.1 && 
                    Math.abs(vertexY - pin.y) < 0.1) {
                    isPinned = true;
                    break;
                }
            }
            
            if (isPinned) {
                // Keep pinned vertices in place
                position.setXYZ(
                    i,
                    originalVertex.x,
                    originalVertex.y,
                    originalVertex.z
                );
                continue;
            }
            
            // Calculate sag based on distance from top
            const sagFactor = Math.max(0, 1.0 - vertexY) * 1.0;
            
            // More sag at bottom of paper
            const sagAmount = sagFactor * gravity * 100;
            
            // Add time-based swaying
            const swayX = Math.sin(this.animationTime * 0.5 + vertexY * 2) * 0.02 * sagFactor;
            const swayZ = Math.cos(this.animationTime * 0.7 + vertexY * 3) * 0.01 * sagFactor;
            
            // Set new position with sag and sway
            position.setXYZ(
                i,
                originalVertex.x + swayX,
                originalVertex.y - sagAmount * (1 - stiffness),
                originalVertex.z + swayZ
            );
        }
        
        // Update geometry
        position.needsUpdate = true;
        this.paperMesh.geometry.computeVertexNormals();
    }
    
    /**
     * create visual edges for paper to give illusion of thickness
     */
    createPaperEdges() {
        // Create edges geometry from paper geometry
        const edgesGeometry = new THREE.EdgesGeometry(this.paperMesh.geometry, 30); // 30° threshold
        
        // Create edge material
        const edgesMaterial = new THREE.LineBasicMaterial({ 
            color: 0xdddddd,
            transparent: true,
            opacity: 0.5
        });
        
        // Create edges
        this.paperEdges = new THREE.LineSegments(edgesGeometry, edgesMaterial);
        
        // Add edges to paper mesh
        this.paperMesh.add(this.paperEdges);
    }
    
    /**
     * load the paper texture based on the selected type
     */
    loadPaperTexture(textureType) {
        // create canvas for the texture
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 1024;
        canvas.height = 1024;
        
        // fill with base color
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        switch (textureType) {
            case 'parchment':
                this.createParchmentTexture(ctx, canvas.width, canvas.height);
                break;
            case 'notebook':
                this.createNotebookTexture(ctx, canvas.width, canvas.height);
                break;
            case 'white':
            default:
                this.createWhitePaperTexture(ctx, canvas.width, canvas.height);
                break;
        }
        
        // create three.js texture from canvas
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        
        return texture;
    }
    
    /**
     * create a white paper texture with subtle noise
     */
    createWhitePaperTexture(ctx, width, height) {
        // add subtle noise to the texture
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        
        for (let i = 0; i < data.length; i += 4) {
            // subtle noise (very slight variation in white)
            const noise = Math.random() * 10 - 5;
            data[i] = Math.min(255, Math.max(245, 250 + noise)); // r
            data[i+1] = Math.min(255, Math.max(245, 250 + noise)); // g
            data[i+2] = Math.min(255, Math.max(245, 250 + noise)); // b
        }
        
        ctx.putImageData(imageData, 0, 0);
    }
    
    /**
     * create a parchment paper texture
     */
    createParchmentTexture(ctx, width, height) {
        // base color
        ctx.fillStyle = '#f5e9d0';
        ctx.fillRect(0, 0, width, height);
        
        // add subtle noise and variances
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        
        for (let i = 0; i < data.length; i += 4) {
            // more visible noise for parchment
            const noise = Math.random() * 20 - 10;
            data[i] = Math.min(255, Math.max(200, 245 + noise)); // r
            data[i+1] = Math.min(255, Math.max(200, 233 + noise)); // g
            data[i+2] = Math.min(255, Math.max(180, 208 + noise)); // b
        }
        
        ctx.putImageData(imageData, 0, 0);
        
        // add some parchment-like marks
        ctx.strokeStyle = 'rgba(139, 69, 19, 0.1)';
        ctx.lineWidth = 1;
        
        for (let i = 0; i < 20; i++) {
            ctx.beginPath();
            ctx.moveTo(Math.random() * width, 0);
            ctx.bezierCurveTo(
                Math.random() * width, Math.random() * height,
                Math.random() * width, Math.random() * height,
                Math.random() * width, height
            );
            ctx.stroke();
        }
    }
    
    /**
     * create a notebook paper texture with lines
     */
    createNotebookTexture(ctx, width, height) {
        // base white
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        
        // horizontal lines
        ctx.strokeStyle = 'rgba(51, 102, 204, 0.2)';
        ctx.lineWidth = 1;
        
        const lineSpacing = Math.floor(height / 30);
        
        for (let y = lineSpacing; y < height; y += lineSpacing) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
        
        // vertical line (margin)
        ctx.strokeStyle = 'rgba(221, 51, 51, 0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(width * 0.1, 0);
        ctx.lineTo(width * 0.1, height);
        ctx.stroke();
        
        // add subtle noise texture
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        
        for (let i = 0; i < data.length; i += 4) {
            // subtle noise
            const noise = Math.random() * 8 - 4;
            data[i] = Math.min(255, Math.max(240, 250 + noise)); // r
            data[i+1] = Math.min(255, Math.max(240, 250 + noise)); // g
            data[i+2] = Math.min(255, Math.max(240, 250 + noise)); // b
        }
        
        ctx.putImageData(imageData, 0, 0);
    }
    
    /**
     * update the paper texture based on selected type
     */
    updatePaperTexture(textureType) {
        this.paperTexture = textureType;
        
        // Update texture if paper mesh exists
        if (this.paperMesh && this.paperMesh.material) {
            const texture = this.loadPaperTexture(textureType);
            this.paperMesh.material.map = texture;
            this.paperMesh.material.needsUpdate = true;
        }
    }
    
    /**
     * create a paper piece from a section of the paper
     */
    createPaperPiece(geometry, material, position, rotation) {
        // Clone material to ensure independent properties
        const pieceMaterial = material.clone();
        
        // Create the paper piece mesh
        const piece = new THREE.Mesh(geometry, pieceMaterial);
        piece.castShadow = true;
        piece.receiveShadow = true;
        
        // Apply position and rotation
        if (position) piece.position.copy(position);
        if (rotation) piece.rotation.copy(rotation);
        
        // Add edges to show thickness
        const edgesGeometry = new THREE.EdgesGeometry(geometry, 30);
        const edgesMaterial = new THREE.LineBasicMaterial({ 
            color: 0xdddddd,
            transparent: true,
            opacity: 0.5
        });
        const edges = new THREE.LineSegments(edgesGeometry, edgesMaterial);
        piece.add(edges);
        
        // Add to scene
        this.scene.add(piece);
        
        // Add to paper pieces array with physics properties
        this.paperPieces.push({
            mesh: piece,
            velocity: new THREE.Vector3(0, -0.01, 0), // start with slight downward velocity
            angularVelocity: new THREE.Vector3(
                (Math.random() - 0.5) * 0.02,
                (Math.random() - 0.5) * 0.02,
                (Math.random() - 0.5) * 0.01
            ),
            mass: geometry.attributes.position.count / 100, // Mass based on size
            airResistance: this.simulation.params.airResistance
        });
        
        return piece;
    }
    
    /**
     * apply a cut to the paper
     */
    applyCut(start, end) {
        // Skip if no paper mesh
        if (!this.paperMesh) return;
        
        // Check if start or end are outside paper bounds
        const paperBounds = new THREE.Box3().setFromObject(this.paperMesh);
        
        // Project from start toward end to find intersection if outside paper
        const direction = new THREE.Vector3().subVectors(end, start).normalize();
        const ray = new THREE.Ray(start, direction);
        
        // Calculate plane for the cut
        const paperNormal = new THREE.Vector3(0, 0, 1).applyQuaternion(this.paperMesh.quaternion);
        const planeNormal = new THREE.Vector3().crossVectors(direction, paperNormal).normalize();
        const cutPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(planeNormal, start);
        
        // Extend the cut line far beyond the paper edges to ensure full cutting
        const extensionFactor = 10; // Extend cut line 10x beyond paper size
        const paperSize = paperBounds.getSize(new THREE.Vector3());
        const maxDimension = Math.max(paperSize.x, paperSize.y, paperSize.z);
        
        // Create extended cut points
        const extendedStart = start.clone().sub(direction.clone().multiplyScalar(maxDimension * extensionFactor));
        const extendedEnd = end.clone().add(direction.clone().multiplyScalar(maxDimension * extensionFactor));
        
        // Split the mesh along the cutting plane with extended line
        this.splitMeshByPlane(this.paperMesh, cutPlane, extendedStart, extendedEnd);
    }
    
    /**
     * split a mesh by a plane with clean edges
     */
    splitMeshByPlane(mesh, plane, startPoint, endPoint) {
        if (!mesh || !mesh.geometry) return;
        
        // Get the mesh world matrix
        const matrix = mesh.matrixWorld.clone();
        const invMatrix = new THREE.Matrix4().copy(matrix).invert();
        
        // Transform cut points to local space
        const localStart = startPoint.clone().applyMatrix4(invMatrix);
        const localEnd = endPoint.clone().applyMatrix4(invMatrix);
        
        // Get mesh geometry
        const geometry = mesh.geometry;
        const position = geometry.attributes.position;
        const normal = geometry.attributes.normal;
        const uv = geometry.attributes.uv;
        const indices = geometry.index ? geometry.index.array : null;
        
        // Define arrays for new geometries
        const aboveVertices = [];
        const aboveNormals = [];
        const aboveUvs = [];
        const aboveIndices = [];
        
        const belowVertices = [];
        const belowNormals = [];
        const belowUvs = [];
        const belowIndices = [];
        
        // Define arrays for cut edge vertices (for clean edge creation)
        const aboveCutEdgeVertices = [];
        const belowCutEdgeVertices = [];
        
        // Maps for tracking processed vertices
        const processedVertices = new Set();
        const vertexSideMap = new Map(); // 1 for above, -1 for below, 0 for on plane
        const originalToNewAbove = new Map();
        const originalToNewBelow = new Map();
        
        // Determine which side each vertex is on
        for (let i = 0; i < position.count; i++) {
            const vertex = new THREE.Vector3(
                position.getX(i),
                position.getY(i),
                position.getZ(i)
            );
            
            // Transform to world space for plane test
            const worldVertex = vertex.clone().applyMatrix4(matrix);
            
            // Get distance from cutting plane
            const distance = plane.distanceToPoint(worldVertex);
            
            // Determine which side (with small epsilon for numerical stability)
            const epsilon = 0.0001;
            if (distance > epsilon) {
                vertexSideMap.set(i, 1); // above
            } else if (distance < -epsilon) {
                vertexSideMap.set(i, -1); // below
            } else {
                vertexSideMap.set(i, 0); // on plane
            }
        }
        
        // Process triangles to create new meshes with clean cut edges
        const triangleCount = indices ? indices.length / 3 : position.count / 3;
        
        for (let t = 0; t < triangleCount; t++) {
            // Get vertex indices for this triangle
            let i0, i1, i2;
            if (indices) {
                i0 = indices[t * 3];
                i1 = indices[t * 3 + 1];
                i2 = indices[t * 3 + 2];
            } else {
                i0 = t * 3;
                i1 = t * 3 + 1;
                i2 = t * 3 + 2;
            }
            
            // Get vertex positions
            const v0 = new THREE.Vector3(position.getX(i0), position.getY(i0), position.getZ(i0));
            const v1 = new THREE.Vector3(position.getX(i1), position.getY(i1), position.getZ(i1));
            const v2 = new THREE.Vector3(position.getX(i2), position.getY(i2), position.getZ(i2));
            
            // Get the side of each vertex
            const side0 = vertexSideMap.get(i0);
            const side1 = vertexSideMap.get(i1);
            const side2 = vertexSideMap.get(i2);
            
            // Count vertices on each side
            const aboveCount = (side0 > 0 ? 1 : 0) + (side1 > 0 ? 1 : 0) + (side2 > 0 ? 1 : 0);
            const belowCount = (side0 < 0 ? 1 : 0) + (side1 < 0 ? 1 : 0) + (side2 < 0 ? 1 : 0);
            const onPlaneCount = (side0 === 0 ? 1 : 0) + (side1 === 0 ? 1 : 0) + (side2 === 0 ? 1 : 0);
            
            // Helper function to get UV at a point
            const getUVAtPoint = (point, v0, v1, v2, uv0, uv1, uv2) => {
                // Calculate barycentric coordinates
                const area = new THREE.Vector3().crossVectors(
                    new THREE.Vector3().subVectors(v1, v0),
                    new THREE.Vector3().subVectors(v2, v0)
                ).length() * 0.5;
                
                const area0 = new THREE.Vector3().crossVectors(
                    new THREE.Vector3().subVectors(v1, point),
                    new THREE.Vector3().subVectors(v2, point)
                ).length() * 0.5;
                
                const area1 = new THREE.Vector3().crossVectors(
                    new THREE.Vector3().subVectors(v2, point),
                    new THREE.Vector3().subVectors(v0, point)
                ).length() * 0.5;
                
                const area2 = new THREE.Vector3().crossVectors(
                    new THREE.Vector3().subVectors(v0, point),
                    new THREE.Vector3().subVectors(v1, point)
                ).length() * 0.5;
                
                const w0 = area0 / area;
                const w1 = area1 / area;
                const w2 = 1 - w0 - w1;
                
                // Interpolate UV
                return new THREE.Vector2(
                    w0 * uv0.x + w1 * uv1.x + w2 * uv2.x,
                    w0 * uv0.y + w1 * uv1.y + w2 * uv2.y
                );
            };
            
            // Helper function to get normal at a point
            const getNormalAtPoint = (point, v0, v1, v2, n0, n1, n2) => {
                // Calculate barycentric coordinates
                const area = new THREE.Vector3().crossVectors(
                    new THREE.Vector3().subVectors(v1, v0),
                    new THREE.Vector3().subVectors(v2, v0)
                ).length() * 0.5;
                
                const area0 = new THREE.Vector3().crossVectors(
                    new THREE.Vector3().subVectors(v1, point),
                    new THREE.Vector3().subVectors(v2, point)
                ).length() * 0.5;
                
                const area1 = new THREE.Vector3().crossVectors(
                    new THREE.Vector3().subVectors(v2, point),
                    new THREE.Vector3().subVectors(v0, point)
                ).length() * 0.5;
                
                const area2 = new THREE.Vector3().crossVectors(
                    new THREE.Vector3().subVectors(v0, point),
                    new THREE.Vector3().subVectors(v1, point)
                ).length() * 0.5;
                
                const w0 = area0 / area;
                const w1 = area1 / area;
                const w2 = 1 - w0 - w1;
                
                // Interpolate normal
                const normal = new THREE.Vector3(
                    w0 * n0.x + w1 * n1.x + w2 * n2.x,
                    w0 * n0.y + w1 * n1.y + w2 * n2.y,
                    w0 * n0.z + w1 * n1.z + w2 * n2.z
                );
                
                return normal.normalize();
            };
            
            // Helper function to find intersection point of an edge with the cutting plane
            const findIntersection = (v1, v2, side1, side2) => {
                // Convert vertices to world space
                const worldV1 = v1.clone().applyMatrix4(matrix);
                const worldV2 = v2.clone().applyMatrix4(matrix);
                
                // Create a line segment
                const line = new THREE.Line3(worldV1, worldV2);
                
                // Find intersection point
                const intersection = new THREE.Vector3();
                plane.intersectLine(line, intersection);
                
                // Convert back to local space
                return intersection.applyMatrix4(invMatrix);
            };
            
            // Helper to add vertex to the correct new mesh
            const addVertexToMesh = (vertex, n, uv, side) => {
                if (side >= 0) {
                    // Add to above mesh
                    const index = aboveVertices.length / 3;
                    aboveVertices.push(vertex.x, vertex.y, vertex.z);
                    aboveNormals.push(n.x, n.y, n.z);
                    aboveUvs.push(uv.x, uv.y);
                    return { side: 'above', index: index };
                } else {
                    // Add to below mesh
                    const index = belowVertices.length / 3;
                    belowVertices.push(vertex.x, vertex.y, vertex.z);
                    belowNormals.push(n.x, n.y, n.z);
                    belowUvs.push(uv.x, uv.y);
                    return { side: 'below', index: index };
                }
            };
            
            // Get normals and UVs for the triangle
            const n0 = new THREE.Vector3(normal.getX(i0), normal.getY(i0), normal.getZ(i0));
            const n1 = new THREE.Vector3(normal.getX(i1), normal.getY(i1), normal.getZ(i1));
            const n2 = new THREE.Vector3(normal.getX(i2), normal.getY(i2), normal.getZ(i2));
            
            const uv0 = new THREE.Vector2(uv.getX(i0), uv.getY(i0));
            const uv1 = new THREE.Vector2(uv.getX(i1), uv.getY(i1));
            const uv2 = new THREE.Vector2(uv.getX(i2), uv.getY(i2));
            
            // Case 1: All vertices on same side or on plane
            if (onPlaneCount === 3 || aboveCount + onPlaneCount === 3 || belowCount + onPlaneCount === 3) {
                // Add the whole triangle to appropriate mesh
                const targetSide = aboveCount > 0 || (onPlaneCount === 3) ? 1 : -1;
                
                let newI0, newI1, newI2;
                
                if (targetSide >= 0) {
                    // Add to above mesh
                    newI0 = aboveVertices.length / 3;
                    aboveVertices.push(v0.x, v0.y, v0.z);
                    aboveNormals.push(n0.x, n0.y, n0.z);
                    aboveUvs.push(uv0.x, uv0.y);
                    
                    newI1 = aboveVertices.length / 3;
                    aboveVertices.push(v1.x, v1.y, v1.z);
                    aboveNormals.push(n1.x, n1.y, n1.z);
                    aboveUvs.push(uv1.x, uv1.y);
                    
                    newI2 = aboveVertices.length / 3;
                    aboveVertices.push(v2.x, v2.y, v2.z);
                    aboveNormals.push(n2.x, n2.y, n2.z);
                    aboveUvs.push(uv2.x, uv2.y);
                    
                    aboveIndices.push(newI0, newI1, newI2);
                } else {
                    // Add to below mesh
                    newI0 = belowVertices.length / 3;
                    belowVertices.push(v0.x, v0.y, v0.z);
                    belowNormals.push(n0.x, n0.y, n0.z);
                    belowUvs.push(uv0.x, uv0.y);
                    
                    newI1 = belowVertices.length / 3;
                    belowVertices.push(v1.x, v1.y, v1.z);
                    belowNormals.push(n1.x, n1.y, n1.z);
                    belowUvs.push(uv1.x, uv1.y);
                    
                    newI2 = belowVertices.length / 3;
                    belowVertices.push(v2.x, v2.y, v2.z);
                    belowNormals.push(n2.x, n2.y, n2.z);
                    belowUvs.push(uv2.x, uv2.y);
                    
                    belowIndices.push(newI0, newI1, newI2);
                }
                
                continue;
            }
            
            // Case 2: Triangle is split by the plane
            // We need to split the triangle into parts above and below the plane
            
            // Find which vertex is alone on its side
            let loneIdx, otherIdx1, otherIdx2;
            let loneVertex, otherVertex1, otherVertex2;
            let loneNormal, otherNormal1, otherNormal2;
            let loneUv, otherUv1, otherUv2;
            let loneSide;
            
            if ((side0 > 0 && side1 <= 0 && side2 <= 0) || (side0 < 0 && side1 >= 0 && side2 >= 0)) {
                loneIdx = i0; otherIdx1 = i1; otherIdx2 = i2;
                loneVertex = v0; otherVertex1 = v1; otherVertex2 = v2;
                loneNormal = n0; otherNormal1 = n1; otherNormal2 = n2;
                loneUv = uv0; otherUv1 = uv1; otherUv2 = uv2;
                loneSide = side0;
            } else if ((side1 > 0 && side0 <= 0 && side2 <= 0) || (side1 < 0 && side0 >= 0 && side2 >= 0)) {
                loneIdx = i1; otherIdx1 = i0; otherIdx2 = i2;
                loneVertex = v1; otherVertex1 = v0; otherVertex2 = v2;
                loneNormal = n1; otherNormal1 = n0; otherNormal2 = n2;
                loneUv = uv1; otherUv1 = uv0; otherUv2 = uv2;
                loneSide = side1;
            } else {
                loneIdx = i2; otherIdx1 = i0; otherIdx2 = i1;
                loneVertex = v2; otherVertex1 = v0; otherVertex2 = v1;
                loneNormal = n2; otherNormal1 = n0; otherNormal2 = n1;
                loneUv = uv2; otherUv1 = uv0; otherUv2 = uv1;
                loneSide = side2;
            }
            
            // Find intersection points
            const intersection1 = findIntersection(loneVertex, otherVertex1, loneSide, vertexSideMap.get(otherIdx1));
            const intersection2 = findIntersection(loneVertex, otherVertex2, loneSide, vertexSideMap.get(otherIdx2));
            
            // Calculate interpolated UVs and normals at intersection points
            const distance1 = loneVertex.distanceTo(otherVertex1);
            const distance2 = loneVertex.distanceTo(otherVertex2);
            
            const t1 = loneVertex.distanceTo(intersection1) / distance1;
            const t2 = loneVertex.distanceTo(intersection2) / distance2;
            
            const uvIntersection1 = new THREE.Vector2(
                loneUv.x + t1 * (otherUv1.x - loneUv.x),
                loneUv.y + t1 * (otherUv1.y - loneUv.y)
            );
            
            const uvIntersection2 = new THREE.Vector2(
                loneUv.x + t2 * (otherUv2.x - loneUv.x),
                loneUv.y + t2 * (otherUv2.y - loneUv.y)
            );
            
            const normalIntersection1 = new THREE.Vector3(
                loneNormal.x + t1 * (otherNormal1.x - loneNormal.x),
                loneNormal.y + t1 * (otherNormal1.y - loneNormal.y),
                loneNormal.z + t1 * (otherNormal1.z - loneNormal.z)
            ).normalize();
            
            const normalIntersection2 = new THREE.Vector3(
                loneNormal.x + t2 * (otherNormal2.x - loneNormal.x),
                loneNormal.y + t2 * (otherNormal2.y - loneNormal.y),
                loneNormal.z + t2 * (otherNormal2.z - loneNormal.z)
            ).normalize();
            
            // Add vertices to meshes
            let loneVertexIndex, int1Index, int2Index;
            
            // Create a triangle on the lone vertex side
            if (loneSide > 0) {
                // Lone vertex is above
                loneVertexIndex = aboveVertices.length / 3;
                aboveVertices.push(loneVertex.x, loneVertex.y, loneVertex.z);
                aboveNormals.push(loneNormal.x, loneNormal.y, loneNormal.z);
                aboveUvs.push(loneUv.x, loneUv.y);
                
                int1Index = aboveVertices.length / 3;
                aboveVertices.push(intersection1.x, intersection1.y, intersection1.z);
                aboveNormals.push(normalIntersection1.x, normalIntersection1.y, normalIntersection1.z);
                aboveUvs.push(uvIntersection1.x, uvIntersection1.y);
                
                int2Index = aboveVertices.length / 3;
                aboveVertices.push(intersection2.x, intersection2.y, intersection2.z);
                aboveNormals.push(normalIntersection2.x, normalIntersection2.y, normalIntersection2.z);
                aboveUvs.push(uvIntersection2.x, uvIntersection2.y);
                
                // Create triangle
                aboveIndices.push(loneVertexIndex, int1Index, int2Index);
                
                // Track cut edge vertices for clean edge appearance
                aboveCutEdgeVertices.push(int1Index, int2Index);
            } else {
                // Lone vertex is below
                loneVertexIndex = belowVertices.length / 3;
                belowVertices.push(loneVertex.x, loneVertex.y, loneVertex.z);
                belowNormals.push(loneNormal.x, loneNormal.y, loneNormal.z);
                belowUvs.push(loneUv.x, loneUv.y);
                
                int1Index = belowVertices.length / 3;
                belowVertices.push(intersection1.x, intersection1.y, intersection1.z);
                belowNormals.push(normalIntersection1.x, normalIntersection1.y, normalIntersection1.z);
                belowUvs.push(uvIntersection1.x, uvIntersection1.y);
                
                int2Index = belowVertices.length / 3;
                belowVertices.push(intersection2.x, intersection2.y, intersection2.z);
                belowNormals.push(normalIntersection2.x, normalIntersection2.y, normalIntersection2.z);
                belowUvs.push(uvIntersection2.x, uvIntersection2.y);
                
                // Create triangle
                belowIndices.push(loneVertexIndex, int1Index, int2Index);
                
                // Track cut edge vertices for clean edge appearance
                belowCutEdgeVertices.push(int1Index, int2Index);
            }
            
            // Create a quad (two triangles) on the opposite side
            const otherSide = loneSide > 0 ? -1 : 1;
            let other1Index, other2Index, int1IndexQuad, int2IndexQuad;
            
            if (otherSide > 0) {
                // Other vertices are above
                other1Index = aboveVertices.length / 3;
                aboveVertices.push(otherVertex1.x, otherVertex1.y, otherVertex1.z);
                aboveNormals.push(otherNormal1.x, otherNormal1.y, otherNormal1.z);
                aboveUvs.push(otherUv1.x, otherUv1.y);
                
                other2Index = aboveVertices.length / 3;
                aboveVertices.push(otherVertex2.x, otherVertex2.y, otherVertex2.z);
                aboveNormals.push(otherNormal2.x, otherNormal2.y, otherNormal2.z);
                aboveUvs.push(otherUv2.x, otherUv2.y);
                
                int1IndexQuad = aboveVertices.length / 3;
                aboveVertices.push(intersection1.x, intersection1.y, intersection1.z);
                aboveNormals.push(normalIntersection1.x, normalIntersection1.y, normalIntersection1.z);
                aboveUvs.push(uvIntersection1.x, uvIntersection1.y);
                
                int2IndexQuad = aboveVertices.length / 3;
                aboveVertices.push(intersection2.x, intersection2.y, intersection2.z);
                aboveNormals.push(normalIntersection2.x, normalIntersection2.y, normalIntersection2.z);
                aboveUvs.push(uvIntersection2.x, uvIntersection2.y);
                
                // Create triangles for quad
                aboveIndices.push(other1Index, other2Index, int2IndexQuad);
                aboveIndices.push(other1Index, int2IndexQuad, int1IndexQuad);
                
                // Track cut edge vertices for clean edge appearance
                aboveCutEdgeVertices.push(int1IndexQuad, int2IndexQuad);
            } else {
                // Other vertices are below
                other1Index = belowVertices.length / 3;
                belowVertices.push(otherVertex1.x, otherVertex1.y, otherVertex1.z);
                belowNormals.push(otherNormal1.x, otherNormal1.y, otherNormal1.z);
                belowUvs.push(otherUv1.x, otherUv1.y);
                
                other2Index = belowVertices.length / 3;
                belowVertices.push(otherVertex2.x, otherVertex2.y, otherVertex2.z);
                belowNormals.push(otherNormal2.x, otherNormal2.y, otherNormal2.z);
                belowUvs.push(otherUv2.x, otherUv2.y);
                
                int1IndexQuad = belowVertices.length / 3;
                belowVertices.push(intersection1.x, intersection1.y, intersection1.z);
                belowNormals.push(normalIntersection1.x, normalIntersection1.y, normalIntersection1.z);
                belowUvs.push(uvIntersection1.x, uvIntersection1.y);
                
                int2IndexQuad = belowVertices.length / 3;
                belowVertices.push(intersection2.x, intersection2.y, intersection2.z);
                belowNormals.push(normalIntersection2.x, normalIntersection2.y, normalIntersection2.z);
                belowUvs.push(uvIntersection2.x, uvIntersection2.y);
                
                // Create triangles for quad
                belowIndices.push(other1Index, other2Index, int2IndexQuad);
                belowIndices.push(other1Index, int2IndexQuad, int1IndexQuad);
                
                // Track cut edge vertices for clean edge appearance
                belowCutEdgeVertices.push(int1IndexQuad, int2IndexQuad);
            }
        }
        
        // Skip if the cut doesn't divide the mesh significantly
        if (aboveVertices.length === 0 || belowVertices.length === 0) {
            return;
        }
        
        // Create new geometries
        const createGeometry = (vertices, normals, uvs, indices) => {
            const geometry = new THREE.BufferGeometry();
            
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
            geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
            geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
            
            if (indices.length > 0) {
                geometry.setIndex(indices);
            }
            
            geometry.computeBoundingSphere();
            return geometry;
        };
        
        const aboveGeometry = createGeometry(aboveVertices, aboveNormals, aboveUvs, aboveIndices);
        const belowGeometry = createGeometry(belowVertices, belowNormals, belowUvs, belowIndices);
        
        // Create pieces from the split geometries
        // Keep the above piece as the main paper
        if (aboveGeometry && aboveGeometry.attributes.position.count > 0) {
            // Replace main paper geometry with above geometry
            mesh.geometry.dispose();
            mesh.geometry = aboveGeometry;
            
            // Create new edges for clean appearance
            if (this.paperEdges) {
                mesh.remove(this.paperEdges);
                this.paperEdges.geometry.dispose();
                this.paperEdges.material.dispose();
            }
            
            this.createPaperEdges();
        }
        
        // Create a falling piece from the below geometry with improved physics
        if (belowGeometry && belowGeometry.attributes.position.count > 0) {
            const fallingPiece = this.createPaperPiece(
                belowGeometry,
                mesh.material.clone(),
                mesh.position.clone(),
                mesh.rotation.clone()
            );
            
            // Apply advanced paper physics to the falling piece
            this.applyPaperPhysicsToFallingPiece(belowGeometry, fallingPiece);
        }
    }
    
    /**
     * apply realistic paper physics to a falling piece
     */
    applyPaperPhysicsToFallingPiece(geometry, fallingPiece) {
        // Get the newest paper piece
        const piece = this.paperPieces[this.paperPieces.length - 1];
        
        // Calculate size and mass based on vertex count
        const vertexCount = geometry.attributes.position.count;
        const relativeSize = vertexCount / (this.paperSegments.x * this.paperSegments.y);
        
        // Extremely light mass for paper-like behavior
        piece.mass = relativeSize * 0.001;
        
        // Increase air resistance significantly for realistic paper behavior
        piece.airResistance = this.simulation.params.airResistance * 5;
        
        // Calculate center of mass and apply initial forces
        const bbox = new THREE.Box3().setFromObject(fallingPiece);
        const centerOfMass = new THREE.Vector3();
        bbox.getCenter(centerOfMass);
        
        // Initial velocity - make paper flutter as it separates
        piece.velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 0.02,
            -0.001, // Very slight initial downward velocity
            (Math.random() - 0.5) * 0.02
        );
        
        // Random initial spin/tumble with bias based on cut direction
        piece.angularVelocity = new THREE.Vector3(
            (Math.random() - 0.5) * 0.01,
            (Math.random() - 0.5) * 0.01,
            (Math.random() - 0.5) * 0.015
        );
        
        // Store additional physics properties for more realistic behavior
        piece.centerOfMass = centerOfMass;
        piece.dragCoefficient = 2.0; // High drag coefficient for paper
        piece.liftCoefficient = 0.8; // Lift coefficient for paper-like flutter
        piece.flutterFrequency = 2 + Math.random() * 2; // Random flutter frequency
        piece.flutterPhase = Math.random() * Math.PI * 2; // Random starting phase
        piece.flutterAmplitude = 0.005 + Math.random() * 0.01; // Random flutter amount
        piece.deformationFactor = 0.1; // How much the paper can bend while falling
        
        // Make geometry slightly wavy for natural deformation
        this.addNaturalDeformationToFallingPiece(fallingPiece);
    }
    
    /**
     * add natural deformation to a falling piece of paper
     */
    addNaturalDeformationToFallingPiece(mesh) {
        const geometry = mesh.geometry;
        const positions = geometry.attributes.position;
        
        // Add slight random bends and curves
        for (let i = 0; i < positions.count; i++) {
            const x = positions.getX(i);
            const y = positions.getY(i);
            let z = positions.getZ(i);
            
            // Distance from center creates more bend at edges
            const dist = Math.sqrt(x*x + y*y);
            const edgeFactor = Math.min(1.0, dist / 0.8);
            
            // Random waviness based on position (consistent pattern, not random per vertex)
            const waveFactor = 0.01 * edgeFactor;
            const wave = Math.sin(x * 10 + y * 8) * waveFactor;
            
            z += wave;
            positions.setZ(i, z);
        }
        
        positions.needsUpdate = true;
        geometry.computeVertexNormals();
    }
    
    /**
     * update the paper and paper pieces
     */
    update() {
        // Update hanging paper animation
        this.updateHangingAnimation();
        
        // Update all paper pieces with physics
        this.updatePaperPieces();
    }
    
    /**
     * update all paper pieces with physics
     */
    updatePaperPieces() {
        const gravity = this.simulation.params.gravity;
        const airResistance = this.simulation.params.airResistance;
        const floor = -3; // floor height
        const time = Date.now() * 0.001; // current time for animations
        
        for (let i = this.paperPieces.length - 1; i >= 0; i--) {
            const piece = this.paperPieces[i];
            const mesh = piece.mesh;
            
            if (!mesh) continue;
            
            // Calculate adaptive time step based on velocity for stability
            const speed = piece.velocity.length();
            const dt = Math.min(0.016, 0.005 / (speed + 0.001));
            
            // Calculate paper orientation relative to air flow
            const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(mesh.quaternion);
            
            // Paper has extremely low terminal velocity due to its shape
            // Apply gravity force scaled by mass (which is very small for paper)
            const gravityForce = new THREE.Vector3(0, -gravity * piece.mass * 0.0001, 0);
            
            // Apply more accurate aerodynamic forces
            
            // 1. Drag force - highest when perpendicular to air flow
            const verticalAlignment = Math.abs(normal.dot(new THREE.Vector3(0, 1, 0)));
            
            // Flat paper has much higher drag than edge-on paper
            const dragCoefficient = piece.dragCoefficient || 2.0;
            const dragFactor = (dragCoefficient * verticalAlignment + 0.1) * airResistance;
            
            // Calculate drag force proportional to velocity squared and orientation
            // We use verticalAlignment to simulate the paper's different drag profiles 
            // based on its orientation to the airflow
            const dragForce = piece.velocity.clone().normalize().negate()
                .multiplyScalar(piece.velocity.lengthSq() * dragFactor);
                
            // 2. Lift force - causes horizontal movement and fluttering
            // Lift is perpendicular to velocity and in plane of paper
            const liftCoefficient = piece.liftCoefficient || 0.8;
            const liftFactor = liftCoefficient * airResistance * (1 - verticalAlignment);
            
            // Lift direction: cross product of velocity and paper normal
            const liftDirection = new THREE.Vector3().crossVectors(
                piece.velocity.clone().normalize(), 
                normal
            ).normalize();
            
            // Calculate lift force with some randomness for fluttering behavior
            const flutterFactor = piece.flutterFrequency ? 
                Math.sin(time * piece.flutterFrequency + piece.flutterPhase) * piece.flutterAmplitude : 
                Math.sin(time * 3) * 0.005;
                
            const liftForce = liftDirection.multiplyScalar(
                piece.velocity.lengthSq() * liftFactor * (1 + flutterFactor)
            );
            
            // 3. Apply additional random air currents (more for smaller pieces)
            const airCurrentStrength = 0.0002 * airResistance * Math.max(0.1, 1 - piece.mass * 1000);
            const airCurrent = new THREE.Vector3(
                (Math.random() - 0.5) * airCurrentStrength,
                (Math.random() - 0.5) * airCurrentStrength * 0.5, // less vertical randomness
                (Math.random() - 0.5) * airCurrentStrength
            );
            
            // 4. Add occasional upward drafts for realistic paper floating
            if (Math.random() < 0.08) {
                const upwardDraft = new THREE.Vector3(0, Math.random() * 0.001 * airResistance, 0);
                airCurrent.add(upwardDraft);
            }
            
            // Sum all forces
            const totalForce = new THREE.Vector3()
                .add(gravityForce)
                .add(dragForce)
                .add(liftForce)
                .add(airCurrent);
            
            // Apply force to velocity (F = ma, so a = F/m)
            const acceleration = totalForce.clone().divideScalar(piece.mass);
            piece.velocity.add(acceleration.multiplyScalar(dt));
            
            // Apply velocity to position
            mesh.position.add(piece.velocity.clone().multiplyScalar(dt));
            
            // Calculate aerodynamic torque (tendency to align with air flow)
            const torque = new THREE.Vector3();
            
            // 1. Weathervane effect - paper tends to align with airflow direction
            if (piece.velocity.lengthSq() > 0.000001) {
                // Project velocity onto paper plane to find misalignment
                const velocityDir = piece.velocity.clone().normalize();
                const projectedVelocity = velocityDir.clone().sub(
                    normal.clone().multiplyScalar(normal.dot(velocityDir))
                ).normalize();
                
                // Calculate torque to align the paper with airflow direction
                // This creates the behavior where paper tends to fall flat side down
                const alignmentTorque = new THREE.Vector3().crossVectors(
                    normal,
                    new THREE.Vector3(0, 1, 0)
                ).normalize();
                
                // Scale torque by velocity and misalignment
                const torqueMagnitude = piece.velocity.lengthSq() * 0.001 * 
                    (1 - Math.abs(normal.dot(new THREE.Vector3(0, 1, 0))));
                    
                torque.add(alignmentTorque.multiplyScalar(torqueMagnitude));
            }
            
            // 2. Flutter torque - creates oscillating motion
            const flutterTorque = new THREE.Vector3(
                Math.sin(time * 2.5 + piece.flutterPhase) * 0.0001,
                0,
                Math.cos(time * 3.0 + piece.flutterPhase * 2) * 0.0001
            );
            
            torque.add(flutterTorque);
            
            // 3. Random torque for natural chaotic motion
            const randomTorque = new THREE.Vector3(
                (Math.random() - 0.5) * 0.0001,
                (Math.random() - 0.5) * 0.0001,
                (Math.random() - 0.5) * 0.0001
            );
            
            torque.add(randomTorque);
            
            // Apply torque to angular velocity
            piece.angularVelocity.add(torque.multiplyScalar(1 / (piece.mass * 10)));
            
            // Apply angular velocity to rotation
            mesh.rotation.x += piece.angularVelocity.x;
            mesh.rotation.y += piece.angularVelocity.y;
            mesh.rotation.z += piece.angularVelocity.z;
            
            // Apply angular drag (paper spins less in air than rigid objects)
            piece.angularVelocity.multiplyScalar(0.99);
            
            // Apply paper deformation while falling (make it bend and flex)
            this.applyPaperDeformation(mesh, piece, time);
            
            // Check for floor collision
            if (mesh.position.y < floor) {
                mesh.position.y = floor;
                
                // Paper bounce is very minimal
                if (piece.velocity.y < 0) {
                    // Almost no bounce for paper
                    piece.velocity.y = -piece.velocity.y * 0.1;
                    
                    // Significant loss of horizontal motion due to friction
                    piece.velocity.x *= 0.7;
                    piece.velocity.z *= 0.7;
                    
                    // Minimal rotation after landing
                    piece.angularVelocity.multiplyScalar(0.7);
                }
                
                // If nearly stopped, come to rest completely
                if (piece.velocity.lengthSq() < 0.00001) {
                    piece.velocity.set(0, 0, 0);
                    piece.angularVelocity.multiplyScalar(0.5);
                }
            }
            
            // Remove pieces that are far away
            if (mesh.position.y < floor - 5 || 
                mesh.position.z < -10 || 
                mesh.position.z > 10) {
                
                // Remove from scene
                this.scene.remove(mesh);
                
                // Dispose of geometry and material
                if (mesh.geometry) mesh.geometry.dispose();
                if (mesh.material) {
                    if (Array.isArray(mesh.material)) {
                        mesh.material.forEach(m => m.dispose());
                    } else {
                        mesh.material.dispose();
                    }
                }
                
                // Remove from array
                this.paperPieces.splice(i, 1);
            }
        }
    }
    
    /**
     * apply realistic paper deformation during falling
     */
    applyPaperDeformation(mesh, piece, time) {
        // Skip if no deformation factor or very small piece
        if (!piece || !piece.deformationFactor || !mesh || !mesh.geometry || 
            !mesh.geometry.attributes || !mesh.geometry.attributes.position) return;
        
        // Only apply deformation if moving fast enough
        if (!piece.velocity || piece.velocity.lengthSq() < 0.00001) return;
        
        const geometry = mesh.geometry;
        const positions = geometry.attributes.position;
        
        // Calculate deformation parameters based on velocity and orientation
        const velocity = piece.velocity.clone();
        const speed = velocity.length();
        
        // Skip if speed is too low
        if (speed < 0.001) return;
        
        // Calculate paper normal
        const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(mesh.quaternion);
        
        // Calculate airflow pressure (perpendicular to paper face)
        const airflowAlignment = Math.abs(normal.dot(velocity.clone().normalize()));
        const pressure = airflowAlignment * speed;
        
        // Skip if pressure is too low
        if (pressure < 0.01) return;
        
        // Calculate flexible deformation based on airflow
        const deformationAmount = piece.deformationFactor * pressure;
        
        // Apply deformation with time-based motion
        for (let i = 0; i < positions.count; i++) {
            const x = positions.getX(i);
            const y = positions.getY(i);
            const originalZ = positions.getZ(i);
            
            // Calculate distance from center
            const distFromCenter = Math.sqrt(x*x + y*y);
            
            // More deformation at edges
            const edgeFactor = Math.min(1.0, distFromCenter / 0.8);
            
            // Wave deformation based on position and time
            const waveFrequency = 5 + distFromCenter * 10;
            const waveAmplitude = deformationAmount * edgeFactor;
            const wave = Math.sin(x * 8 + y * 6 + time * 3) * waveAmplitude;
            
            // Apply deformation
            positions.setZ(i, originalZ + wave);
        }
        
        positions.needsUpdate = true;
        
        // Only recompute normals occasionally for performance
        if (Math.random() < 0.1) {
            geometry.computeVertexNormals();
        }
    }
    
    /**
     * clear all paper pieces
     */
    clearPaperPieces() {
        // Remove all paper pieces from the scene
        for (const piece of this.paperPieces) {
            this.scene.remove(piece.mesh);
            
            // Dispose of geometry and material
            if (piece.mesh.geometry) piece.mesh.geometry.dispose();
            if (piece.mesh.material) {
                if (Array.isArray(piece.mesh.material)) {
                    piece.mesh.material.forEach(m => m.dispose());
                } else {
                    piece.mesh.material.dispose();
                }
            }
        }
        
        this.paperPieces = [];
    }
    
    /**
     * reset the paper simulation
     */
    reset() {
        // Remove the old paper mesh
        if (this.paperMesh) {
            this.scene.remove(this.paperMesh);
            
            // Dispose of geometry and material
            if (this.paperMesh.geometry) this.paperMesh.geometry.dispose();
            if (this.paperMesh.material) {
                if (Array.isArray(this.paperMesh.material)) {
                    this.paperMesh.material.forEach(m => m.dispose());
                } else {
                    this.paperMesh.material.dispose();
                }
            }
        }
        
        // Clear all paper pieces
        this.clearPaperPieces();
        
        // Clear old pins (hanging points visuals)
        const allObjects = [...this.scene.children];
        for (const obj of allObjects) {
            // Find pins by their geometry type and size
            if (obj instanceof THREE.Mesh && 
                ((obj.geometry instanceof THREE.CylinderGeometry && obj.geometry.parameters.radiusTop === 0.02) ||
                 (obj.geometry instanceof THREE.SphereGeometry && obj.geometry.parameters.radius === 0.04))) {
                this.scene.remove(obj);
                obj.geometry.dispose();
                obj.material.dispose();
            }
        }
        
        // Create a new paper
        this.createPaper();
    }
}