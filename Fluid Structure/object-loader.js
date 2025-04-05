/**
 * ObjectLoader class
 * Handles loading, managing and processing 3D objects in the simulation
 */
class ObjectLoader {
    constructor(simulation) {
        this.simulation = simulation;
        this.objects = [];
        this.objectsList = document.getElementById('object-list');
        this.selectedObjectId = null;
        this.objectIdCounter = 0;
        
        // dragging state
        this.isDraggingObject = false;
        this.draggedObject = null;
        this.dragOffset = new THREE.Vector3();
        
        this.setupObjectLoading();
    }
    
    setupObjectLoading() {
        const fileInput = document.getElementById('file-input');
        const fileDropArea = document.getElementById('file-drop-area');
        
        // trigger file input when clicking on the drop area
        fileDropArea.addEventListener('click', () => {
            fileInput.click();
        });
        
        // handle file selection
        fileInput.addEventListener('change', (event) => {
            if (event.target.files.length > 0) {
                this.loadOBJFile(event.target.files[0]);
            }
        });
        
        // handle drag and drop
        fileDropArea.addEventListener('dragover', (event) => {
            event.preventDefault();
            fileDropArea.classList.add('drag-over');
        });
        
        fileDropArea.addEventListener('dragleave', () => {
            fileDropArea.classList.remove('drag-over');
        });
        
        fileDropArea.addEventListener('drop', (event) => {
            event.preventDefault();
            fileDropArea.classList.remove('drag-over');
            
            if (event.dataTransfer.files.length > 0) {
                const file = event.dataTransfer.files[0];
                if (file.name.toLowerCase().endsWith('.obj')) {
                    this.loadOBJFile(file);
                } else {
                    this.simulation.updateStatus("Error: Only .obj files are supported");
                }
            }
        });
        
        // delete selected object
        const deleteSelectedBtn = document.getElementById('delete-selected-object');
        deleteSelectedBtn.addEventListener('click', () => {
            if (this.selectedObjectId !== null) {
                this.deleteObject(this.selectedObjectId);
            }
        });

        // delete all objects
        const deleteAllBtn = document.getElementById('delete-all-objects');
        deleteAllBtn.addEventListener('click', () => {
            this.deleteAllObjects();
        });
        
        // setup object density control
        const objectDensity = document.getElementById('object-density');
        const objectDensityValue = document.getElementById('object-density-value');

        if (objectDensity && objectDensityValue) {
            objectDensity.addEventListener('input', () => {
                const newValue = parseFloat(objectDensity.value);
                objectDensityValue.textContent = newValue.toFixed(1);
                
                // update density of selected object if any
                if (this.selectedObjectId !== null) {
                    const selectedObject = this.objects.find(obj => obj.id === this.selectedObjectId);
                    if (selectedObject) {
                        // calculate new mass based on density and approximated volume
                        const bbox = new THREE.Box3().setFromObject(selectedObject.mesh);
                        const size = new THREE.Vector3();
                        bbox.getSize(size);
                        const volume = size.x * size.y * size.z;
                        
                        // update physics properties
                        selectedObject.physics.density = newValue;
                        selectedObject.physics.mass = newValue * (volume > 0 ? volume : 1);
                    }
                }
            });
        }
        
        // setup use textures toggle
        const useTextures = document.getElementById('use-textures');
        if (useTextures) {
            useTextures.addEventListener('change', () => {
                // Update materials for all objects based on texture toggle
                this.objects.forEach(object => {
                    this.updateObjectMaterials(object, useTextures.checked);
                });
            });
        }
    }
    
    updateObjectMaterials(object, useTextures) {
        if (!object || !object.mesh) return;
        
        object.mesh.traverse((node) => {
            if (node instanceof THREE.Mesh) {
                if (useTextures) {
                    // If the node already has a material with texture, keep it
                    if (!node.material || !node.material.map) {
                        // Otherwise create a default material if textures are enabled
                        node.material = new THREE.MeshStandardMaterial({
                            color: 0x1E88E5,
                            metalness: 0.2,
                            roughness: 0.5
                        });
                    }
                } else {
                    // Create a simple material if textures are disabled
                    node.material = new THREE.MeshLambertMaterial({
                        color: 0x1E88E5
                    });
                }
                
                // Make sure materials are updated and visible
                if (node.material) {
                    node.material.needsUpdate = true;
                    node.material.transparent = false; // Ensure visibility
                    node.material.opacity = 1.0;
                }
                
                // Enable shadows
                node.castShadow = true;
                node.receiveShadow = true;
                node.visible = true; // Explicitly set visibility
            }
        });
    }
    
    loadOBJFile(file) {
        this.simulation.updateStatus("Loading OBJ file...");
        
        const reader = new FileReader();
        
        reader.onload = (event) => {
            const objContent = event.target.result;
            
            try {
                // use Three.js OBJLoader to parse the file
                const loader = new THREE.OBJLoader();
                const object = loader.parse(objContent);
                this.addImportedObject(object, file.name);
            } catch (error) {
                console.error("Error parsing OBJ file:", error);
                this.simulation.updateStatus("Error loading OBJ: " + error.message);
            }
        };
        
        reader.onerror = () => {
            this.simulation.updateStatus("Error reading file");
        };
        
        reader.readAsText(file);
    }
    
    addImportedObject(object, filename) {
        console.log("Adding imported object:", filename);
        
        // get object dimensions
        const bbox = new THREE.Box3().setFromObject(object);
        const size = new THREE.Vector3();
        bbox.getSize(size);
        
        // find the maximum dimension
        const maxDimension = Math.max(size.x, size.y, size.z);
        
        // scale object to be 1/4 of the container size
        const targetSize = this.simulation.params.containerSize / 4;
        const scale = targetSize / maxDimension;
        
        object.scale.set(scale, scale, scale);
        
        // get current density setting
        const densityControl = document.getElementById('object-density');
        const density = densityControl ? parseFloat(densityControl.value) : 10.0;
        
        // calculate volume approximation from bounding box
        bbox.setFromObject(object); // update after scaling
        const volume = size.x * size.y * size.z;
        
        // create a physics body for the object
        const physicsProperties = {
            position: new THREE.Vector3(0, 0, 0),
            velocity: new THREE.Vector3(0, 0, 0),
            rotation: new THREE.Euler(0, 0, 0),
            angularVelocity: new THREE.Vector3(0, 0, 0),
            mass: density * (volume > 0 ? volume : 1), // mass based on density and volume
            density: density, // store original density
            isFixed: false,
            bbox: new THREE.Box3()
        };
        
        // position the object in a central position above the fluid
        const halfSize = this.simulation.params.containerSize / 2;
        physicsProperties.position.set(0, halfSize * 0.5, 0);
        object.position.copy(physicsProperties.position);
        
        // update bounding box
        physicsProperties.bbox.setFromObject(object);
        
        // Check if textures should be used
        const useTextures = document.getElementById('use-textures')?.checked ?? true;
        
        // Apply materials to the object
        object.traverse((node) => {
            if (node instanceof THREE.Mesh) {
                // Create a default material if none exists
                if (!node.material) {
                    if (useTextures) {
                        node.material = new THREE.MeshStandardMaterial({
                            color: 0x1E88E5,
                            metalness: 0.2,
                            roughness: 0.5
                        });
                    } else {
                        node.material = new THREE.MeshLambertMaterial({
                            color: 0x1E88E5
                        });
                    }
                }
                
                // Ensure material is visible
                node.material.transparent = false;
                node.material.opacity = 1.0;
                node.material.needsUpdate = true;
                
                // Enable shadows
                node.castShadow = true;
                node.receiveShadow = true;
                node.visible = true;
            }
        });
        
        // Debug visibility
        console.log("Object visible:", object.visible);
        console.log("Object children count:", object.children.length);
        object.traverse(child => {
            if (child instanceof THREE.Mesh) {
                console.log("Mesh visible:", child.visible);
                console.log("Material:", child.material);
            }
        });
        
        // add the object to our objects array with a unique id
        const objectId = this.objectIdCounter++;
        this.objects.push({
            id: objectId,
            mesh: object,
            physics: physicsProperties,
            name: filename,
            isSelected: false
        });
        
        // add the object to the scene
        this.simulation.sceneManager.container.add(object);
        
        // add entry to the object list UI
        this.addObjectToUI(objectId, filename);
        
        // update buttons state
        this.updateObjectButtonsState();
        
        this.simulation.updateStatus(`Added object: ${filename}`);
    }

    addObjectToUI(id, name) {
        const objectItem = document.createElement('div');
        objectItem.className = 'object-item';
        objectItem.setAttribute('data-id', id);
        
        // truncate filename if needed
        const shortName = name.length > 20 ? name.substring(0, 17) + '...' : name;
        
        objectItem.innerHTML = `
            <div class="object-name" title="${name}">${shortName}</div>
            <div class="object-actions">
                <button class="object-action material" title="Add Material">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                        <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                        <line x1="12" y1="22.08" x2="12" y2="12"></line>
                    </svg>
                </button>
                <button class="object-action delete" title="Delete">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
            </div>
        `;
        
        // add click event to select the object
        objectItem.addEventListener('click', (event) => {
            // ignore if clicking one of the action buttons
            if (event.target.closest('.material') || event.target.closest('.delete')) return;
            
            this.selectObject(id);
        });
        
        // add material button functionality
        const materialBtn = objectItem.querySelector('.material');
        materialBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            this.loadMaterialForObject(id);
        });
        
        // add delete button functionality
        const deleteBtn = objectItem.querySelector('.delete');
        deleteBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            this.deleteObject(id);
        });
        
        this.objectsList.appendChild(objectItem);
    }

    loadMaterialForObject(objectId) {
        const object = this.objects.find(obj => obj.id === objectId);
        if (!object) return;
        
        this.simulation.updateStatus(`Select material file for ${object.name}`);
        
        // create a file input element
        const mtlInput = document.createElement('input');
        mtlInput.type = 'file';
        mtlInput.accept = '.mtl';
        
        mtlInput.onchange = (e) => {
            if (e.target.files.length > 0) {
                const mtlFile = e.target.files[0];
                this.loadMaterialForObjectFromFile(object, mtlFile);
            }
        };
        
        // trigger file dialog
        mtlInput.click();
    }

    loadMaterialForObjectFromFile(object, mtlFile) {
        this.simulation.updateStatus(`Loading material: ${mtlFile.name}`);
        
        const reader = new FileReader();
        
        reader.onload = (event) => {
            const mtlContent = event.target.result;
            
            try {
                // use MTLLoader to parse material
                const mtlLoader = new THREE.MTLLoader();
                // set baseUrl to empty since we're loading from memory
                mtlLoader.manager.setURLModifier(url => url);
                
                const materials = mtlLoader.parse(mtlContent);
                materials.preload();
                
                // store original object
                const originalMesh = object.mesh;
                const originalPosition = originalMesh.position.clone();
                const originalRotation = originalMesh.rotation.clone();
                const originalScale = originalMesh.scale.clone();
                
                // export object to OBJ format for parsing
                const objExporter = new THREE.OBJExporter();
                const objString = objExporter.parse(originalMesh);
                
                // then parse with materials
                const objLoader = new THREE.OBJLoader();
                objLoader.setMaterials(materials);
                
                const newMesh = objLoader.parse(objString);
                
                // transfer original transforms
                newMesh.position.copy(originalPosition);
                newMesh.rotation.copy(originalRotation);
                newMesh.scale.copy(originalScale);
                
                // ensure visibility
                newMesh.visible = true;
                newMesh.traverse(child => {
                    if (child instanceof THREE.Mesh) {
                        child.visible = true;
                        child.castShadow = true;
                        child.receiveShadow = true;
                        
                        if (child.material) {
                            child.material.transparent = false;
                            child.material.opacity = 1.0;
                            child.material.needsUpdate = true;
                        }
                    }
                });
                
                // replace in scene
                this.simulation.sceneManager.container.remove(originalMesh);
                this.simulation.sceneManager.container.add(newMesh);
                
                // update object reference
                object.mesh = newMesh;
                
                this.simulation.updateStatus(`Material applied to ${object.name}`);
                
            } catch (error) {
                console.error("Error applying material:", error);
                this.simulation.updateStatus(`Error with material: ${error.message}`);
            }
        };
        
        reader.onerror = () => {
            this.simulation.updateStatus("Error reading material file");
        };
        
        reader.readAsText(mtlFile);
    }

    selectObject(id) {
        // deselect any previously selected object
        if (this.selectedObjectId !== null) {
            const prevSelectedObject = this.objects.find(obj => obj.id === this.selectedObjectId);
            if (prevSelectedObject) 
                prevSelectedObject.isSelected = false;
            
            // remove selected class from UI
            const prevSelectedItem = this.objectsList.querySelector(`.object-item.selected`);
            if (prevSelectedItem) {
                prevSelectedItem.classList.remove('selected');
            }
        }
        
        // select the new object
        this.selectedObjectId = id;
        const selectedObject = this.objects.find(obj => obj.id === id);
        
        if (selectedObject) {
            selectedObject.isSelected = true;
            
            // add selected class to UI
            const selectedItem = this.objectsList.querySelector(`.object-item[data-id="${id}"]`);
            if (selectedItem) {
                selectedItem.classList.add('selected');
            }
        }
        
        // update buttons state
        this.updateObjectButtonsState();
    }

    deleteObject(id) {
        // find the object
        const objectIndex = this.objects.findIndex(obj => obj.id === id);
        
        if (objectIndex !== -1) {
            const object = this.objects[objectIndex];
            
            // remove from scene
            this.simulation.sceneManager.container.remove(object.mesh);
            
            // remove from objects array
            this.objects.splice(objectIndex, 1);
            
            // remove from UI
            const objectItem = this.objectsList.querySelector(`.object-item[data-id="${id}"]`);
            if (objectItem) {
                objectItem.remove();
            }
            
            // reset selected object if this was the selected one
            if (this.selectedObjectId === id) {
                this.selectedObjectId = null;
            }
            
            // reset dragging state if this was the dragged object
            if (this.isDraggingObject && this.draggedObject && this.draggedObject.id === id) {
                this.isDraggingObject = false;
                this.draggedObject = null;
            }
            
            // update buttons state
            this.updateObjectButtonsState();
            
            this.simulation.updateStatus("Object deleted");
        }
    }

    deleteAllObjects() {
        // remove all objects from the scene
        this.objects.forEach(object => {
            this.simulation.sceneManager.container.remove(object.mesh);
        });
        
        // clear the objects array
        this.objects = [];
        
        // clear the UI list
        this.objectsList.innerHTML = '';
        
        // reset selected object
        this.selectedObjectId = null;
        
        // reset dragging state
        this.isDraggingObject = false;
        this.draggedObject = null;
        
        // update buttons state
        this.updateObjectButtonsState();
        
        this.simulation.updateStatus("All objects deleted");
    }

    updateObjectButtonsState() {
        const deleteSelectedBtn = document.getElementById('delete-selected-object');
        const deleteAllBtn = document.getElementById('delete-all-objects');
        
        // enable/disable delete selected button
        if (deleteSelectedBtn) {
            deleteSelectedBtn.disabled = this.selectedObjectId === null;
        }
        
        // enable/disable delete all button
        if (deleteAllBtn) {
            deleteAllBtn.disabled = this.objects.length === 0;
        }
    }

    startDragging(object, mousePosition3D) {
        this.isDraggingObject = true;
        this.draggedObject = object;
        
        // calculate offset from mouse to object center
        this.dragOffset = new THREE.Vector3().subVectors(
            object.physics.position, 
            mousePosition3D
        );
        
        // zero out velocity when starting drag
        object.physics.velocity.set(0, 0, 0);
        object.physics.angularVelocity.set(0, 0, 0);
    }

    updateDragging(mousePosition3D) {
        if (!this.isDraggingObject || !this.draggedObject) return;
        
        // update object position
        const newPosition = mousePosition3D.clone().add(this.dragOffset);
        
        // Update object position
        this.draggedObject.physics.position.copy(newPosition);
        this.draggedObject.mesh.position.copy(newPosition);
        
        // Update bounding box
        this.draggedObject.physics.bbox.setFromObject(this.draggedObject.mesh);
    }

    endDragging(mouseVelocity) {
        if (!this.isDraggingObject || !this.draggedObject) return;
        
        // apply current mouse velocity to the object
        this.draggedObject.physics.velocity.copy(mouseVelocity.clone().multiplyScalar(2));
        
        // reset dragging state
        this.isDraggingObject = false;
        this.draggedObject = null;
    }

    updateObjects() {
        for (const object of this.objects) {
            if (object.physics.isFixed || (this.isDraggingObject && object.id === this.draggedObject?.id)) continue;
            
            // update position
            object.physics.position.x += object.physics.velocity.x;
            object.physics.position.y += object.physics.velocity.y;
            object.physics.position.z += object.physics.velocity.z;
            
            // apply angular velocity to quaternion rotation for more realistic 3D rotation
            const rotationQuat = new THREE.Quaternion();
            rotationQuat.setFromEuler(object.mesh.rotation);
            
            // create a quaternion from the angular velocity
            const angVelQuat = new THREE.Quaternion(
                object.physics.angularVelocity.x * 0.5,
                object.physics.angularVelocity.y * 0.5,
                object.physics.angularVelocity.z * 0.5,
                0
            );
            
            // apply the angular velocity to the rotation quaternion
            angVelQuat.multiply(rotationQuat);
            rotationQuat.x += angVelQuat.x;
            rotationQuat.y += angVelQuat.y;
            rotationQuat.z += angVelQuat.z;
            rotationQuat.w += angVelQuat.w;
            rotationQuat.normalize();
            
            // convert back to Euler angles
            const newRotation = new THREE.Euler();
            newRotation.setFromQuaternion(rotationQuat);
            
            // update object rotation
            object.physics.rotation.copy(newRotation);
            object.mesh.rotation.copy(newRotation);
            
            // update mesh position
            object.mesh.position.copy(object.physics.position);
        }
    }

    applyForcesToObjects(gravity, speedLimit) {
        for (const object of this.objects) {
            if (object.physics.isFixed) continue; // skip fixed objects
            
            // apply gravity to object (reduced effect for objects)
            object.physics.velocity.y -= gravity * 0.5;
            
            // apply speed limit
            const speedSq = object.physics.velocity.lengthSq();
            const maxSpeed = speedLimit * 1.2; // slightly higher limit for objects
            
            if (speedSq > maxSpeed * maxSpeed) {
                object.physics.velocity.normalize().multiplyScalar(maxSpeed);
            }
            
            // apply angular velocity limit
            const angularSpeedSq = object.physics.angularVelocity.lengthSq();
            const maxAngularSpeed = 0.1; // maximum rotation speed
            
            if (angularSpeedSq > maxAngularSpeed * maxAngularSpeed) {
                object.physics.angularVelocity.normalize().multiplyScalar(maxAngularSpeed);
            }
            
            // apply damping to angular velocity
            object.physics.angularVelocity.multiplyScalar(0.98);
        }
    }

    updateObjectMaterials(object, useTextures) {
        if (!object || !object.mesh) return;
        
        // Force the mesh and all children to be visible
        object.mesh.visible = true;
        
        object.mesh.traverse((node) => {
            if (node instanceof THREE.Mesh) {
                node.visible = true;
                
                if (useTextures) {
                    // If the node already has a material with texture, keep it
                    if (!node.material || !node.material.map) {
                        // Otherwise create a default material if textures are enabled
                        node.material = new THREE.MeshStandardMaterial({
                            color: 0x1E88E5,
                            metalness: 0.2,
                            roughness: 0.5
                        });
                    }
                } else {
                    // Create a simple material if textures are disabled
                    node.material = new THREE.MeshLambertMaterial({
                        color: 0x1E88E5
                    });
                }
                
                // Make sure materials are updated and visible
                if (node.material) {
                    if (Array.isArray(node.material)) {
                        node.material.forEach(mat => {
                            if (mat) {
                                mat.transparent = false;
                                mat.opacity = 1.0;
                                mat.needsUpdate = true;
                            }
                        });
                    } else {
                        node.material.transparent = false;
                        node.material.opacity = 1.0;
                        node.material.needsUpdate = true;
                    }
                }
                
                // Enable shadows
                node.castShadow = true;
                node.receiveShadow = true;
            }
        });
        
        // Force object matrix update
        object.mesh.updateMatrix();
        object.mesh.updateMatrixWorld(true);
    }

    
}
