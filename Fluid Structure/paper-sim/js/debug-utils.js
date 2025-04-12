/**
 * debug-utils.js
 * enhanced debugging utilities for paper cutting simulation
 */

// Create a global debug object
window.Debug = {
  // Enable or disable debugging
  enabled: false,
  
  // Debug messages container
  messages: [],
  
  // Maximum number of messages to store
  maxMessages: 100,
  
  // Initialization
  init: function() {
    // Create debug DOM elements if they don't exist
    if (!document.getElementById('debug-panel')) {
      this.createDebugPanel();
    }
    
    // Override console methods to capture in our debug panel
    this.overrideConsole();
    
    // Add keyboard shortcut to toggle debug panel
    document.addEventListener('keydown', function(e) {
      if (e.ctrlKey && e.key === 'F1') {
        Debug.toggle();
      }
    });
    
    console.log("Debug utilities initialized");
  },
  
  // Create debug panel in the DOM
  createDebugPanel: function() {
    const panel = document.createElement('div');
    panel.id = 'debug-panel';
    panel.className = 'debug-panel';
    
    const title = document.createElement('div');
    title.className = 'debug-title';
    title.textContent = 'Debug Information';
    panel.appendChild(title);
    
    const info = document.createElement('div');
    info.id = 'debug-info';
    info.className = 'debug-info';
    info.textContent = 'Debug initialized...';
    panel.appendChild(info);
    
    // Add controls
    const controls = document.createElement('div');
    controls.className = 'debug-controls';
    
    const clearBtn = document.createElement('button');
    clearBtn.textContent = 'Clear';
    clearBtn.style.marginRight = '5px';
    clearBtn.onclick = function() {
      Debug.clear();
    };
    controls.appendChild(clearBtn);
    
    panel.appendChild(controls);
    
    document.body.appendChild(panel);
  },
  
  // Override console methods
  overrideConsole: function() {
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;
    
    // Override console.log
    console.log = function() {
      // Call original method
      originalLog.apply(console, arguments);
      
      // Add to debug
      Debug.log('LOG', Array.from(arguments).join(' '));
    };
    
    // Override console.warn
    console.warn = function() {
      // Call original method
      originalWarn.apply(console, arguments);
      
      // Add to debug
      Debug.log('WARN', Array.from(arguments).join(' '), '#ff9900');
    };
    
    // Override console.error
    console.error = function() {
      // Call original method
      originalError.apply(console, arguments);
      
      // Add to debug
      Debug.log('ERROR', Array.from(arguments).join(' '), '#ff0000');
    };
  },
  
  // Log a message
  log: function(level, message, color = '#ffffff') {
    // Create message object
    const msg = {
      time: new Date(),
      level: level,
      message: message,
      color: color
    };
    
    // Add to messages array
    this.messages.unshift(msg);
    
    // Trim if too many
    if (this.messages.length > this.maxMessages) {
      this.messages.length = this.maxMessages;
    }
    
    // Update UI if debug is enabled
    this.updateUI();
  },
  
  // Update debug panel UI
  updateUI: function() {
    const panel = document.getElementById('debug-panel');
    const info = document.getElementById('debug-info');
    
    if (!panel || !info) return;
    
    // Clear current content
    info.innerHTML = '';
    
    // Add messages
    for (let i = 0; i < this.messages.length; i++) {
      const msg = this.messages[i];
      
      // Format time
      const time = msg.time.toLocaleTimeString() + '.' + 
                  msg.time.getMilliseconds().toString().padStart(3, '0');
      
      // Create message element
      const div = document.createElement('div');
      div.style.marginBottom = '3px';
      div.style.wordWrap = 'break-word';
      
      // Create time span
      const timeSpan = document.createElement('span');
      timeSpan.style.color = '#bbbbbb';
      timeSpan.textContent = `[${time}] `;
      div.appendChild(timeSpan);
      
      // Create level span
      const levelSpan = document.createElement('span');
      levelSpan.style.color = msg.color;
      levelSpan.style.fontWeight = 'bold';
      levelSpan.textContent = `${msg.level}: `;
      div.appendChild(levelSpan);
      
      // Add message text
      const messageSpan = document.createElement('span');
      messageSpan.style.color = msg.color;
      messageSpan.textContent = msg.message;
      div.appendChild(messageSpan);
      
      // Add to panel
      info.appendChild(div);
    }
  },
  
  // Clear all messages
  clear: function() {
    this.messages = [];
    this.updateUI();
  },
  
  // Toggle debug panel visibility
  toggle: function() {
    const panel = document.getElementById('debug-panel');
    if (panel) {
      this.enabled = !this.enabled;
      panel.style.display = this.enabled ? 'block' : 'none';
      console.log("Debug panel " + (this.enabled ? "enabled" : "disabled"));
    }
  },
  
  // Log object properties
  logObject: function(obj, name = 'Object') {
    if (!obj) {
      console.warn(`Cannot log ${name}: object is null or undefined`);
      return;
    }
    
    console.log(`--- ${name} Properties ---`);
    
    // Function to safely get property value
    const safeGet = (obj, prop) => {
      try {
        return obj[prop];
      } catch (e) {
        return `[Error: ${e.message}]`;
      }
    };
    
    // Get all properties
    let props = [];
    try {
      // Try to get all properties including non-enumerable ones
      props = Object.getOwnPropertyNames(obj);
    } catch (e) {
      // Fallback to for...in
      props = [];
      for (let prop in obj) {
        props.push(prop);
      }
    }
    
    // Log each property
    for (let prop of props) {
      try {
        const value = safeGet(obj, prop);
        const type = typeof value;
        
        // Skip functions and large objects for brevity
        if (type === 'function') {
          console.log(`${prop}: [Function]`);
        } else if (type === 'object' && value !== null) {
          if (value instanceof Array) {
            console.log(`${prop}: Array(${value.length})`);
          } else if (value instanceof THREE.Vector3) {
            console.log(`${prop}: Vector3(${value.x}, ${value.y}, ${value.z})`);
          } else if (value instanceof THREE.Matrix4 || value instanceof THREE.Matrix3) {
            console.log(`${prop}: ${value.constructor.name}`);
          } else {
            console.log(`${prop}: ${value.constructor.name || 'Object'}`);
          }
        } else {
          console.log(`${prop}: ${value}`);
        }
      } catch (e) {
        console.log(`${prop}: [Error: ${e.message}]`);
      }
    }
    
    console.log("------------------------");
  }
};

// Initialize debug on load
window.addEventListener('DOMContentLoaded', function() {
  window.Debug.init();
});

// Additional utility functions for THREE.js debugging
window.Debug.THREE = {
  // Check if a geometry is valid
  checkGeometry: function(geometry) {
    if (!geometry) {
      console.error("Invalid geometry: null or undefined");
      return false;
    }
    
    let valid = true;
    const issues = [];
    
    // Check for position attribute
    const position = geometry.getAttribute('position');
    if (!position) {
      issues.push("Missing position attribute");
      valid = false;
    } else {
      // Check for NaN values
      for (let i = 0; i < position.count * 3; i++) {
        if (isNaN(position.array[i])) {
          issues.push(`Position contains NaN values at index ${i}`);
          valid = false;
          break;
        }
      }
    }
    
    // Check if indices are valid (if present)
    if (geometry.index) {
      const indices = geometry.index.array;
      
      // Check if any index is out of range
      if (position) {
        for (let i = 0; i < indices.length; i++) {
          if (indices[i] >= position.count) {
            issues.push(`Index out of range: ${indices[i]} >= ${position.count}`);
            valid = false;
            break;
          }
        }
      }
    }
    
    // Check if bounding sphere is valid
    if (geometry.boundingSphere) {
      const sphere = geometry.boundingSphere;
      if (isNaN(sphere.radius) || 
          isNaN(sphere.center.x) || 
          isNaN(sphere.center.y) || 
          isNaN(sphere.center.z)) {
        issues.push("Bounding sphere contains NaN values");
        valid = false;
      }
    }
    
    // Report issues
    if (!valid) {
      console.error("Geometry validation failed:", issues);
    }
    
    return valid;
  },
  
  // Visualize normals of a mesh
  visualizeNormals: function(mesh, scene, length = 1, color = 0x00ff00) {
    if (!mesh || !mesh.geometry) {
      console.error("Cannot visualize normals: mesh or geometry is missing");
      return null;
    }
    
    try {
      // Check if Three.js VertexNormalsHelper is available
      if (THREE.VertexNormalsHelper) {
        const helper = new THREE.VertexNormalsHelper(mesh, length, color);
        scene.add(helper);
        return helper;
      } else {
        // Manual implementation if helper isn't available
        const geometry = mesh.geometry;
        const position = geometry.getAttribute('position');
        const normal = geometry.getAttribute('normal');
        
        if (!position || !normal) {
          console.error("Cannot visualize normals: position or normal attribute missing");
          return null;
        }
        
        const material = new THREE.LineBasicMaterial({ color: color });
        const geo = new THREE.BufferGeometry();
        const vertices = [];
        
        // Sample every 10th normal for cleaner visualization
        const stride = Math.max(1, Math.floor(position.count / 100));
        
        for (let i = 0; i < position.count; i += stride) {
          const x = position.getX(i);
          const y = position.getY(i);
          const z = position.getZ(i);
          
          const nx = normal.getX(i);
          const ny = normal.getY(i);
          const nz = normal.getZ(i);
          
          // Start point
          vertices.push(x, y, z);
          
          // End point
          vertices.push(
            x + nx * length,
            y + ny * length,
            z + nz * length
          );
        }
        
        geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        const lines = new THREE.LineSegments(geo, material);
        
        scene.add(lines);
        return lines;
      }
    } catch (e) {
      console.error("Error visualizing normals:", e);
      return null;
    }
  },
  
  // Create a debug point at a specific location
  createPoint: function(position, scene, color = 0xff0000, size = 0.2) {
    const geometry = new THREE.SphereGeometry(size);
    const material = new THREE.MeshBasicMaterial({ color: color });
    const point = new THREE.Mesh(geometry, material);
    
    point.position.copy(position);
    scene.add(point);
    
    return point;
  },
  
  // Create a debug line between two points
  createLine: function(start, end, scene, color = 0xff0000) {
    const material = new THREE.LineBasicMaterial({ color: color });
    const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
    const line = new THREE.Line(geometry, material);
    
    scene.add(line);
    
    return line;
  },
  
  // Create a debug plane to visualize a cutting plane
  createPlane: function(normal, constant, scene, size = 10, color = 0xff0000) {
    // Create plane geometry
    const geometry = new THREE.PlaneGeometry(size, size);
    const material = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide
    });
    
    const plane = new THREE.Mesh(geometry, material);
    
    // Calculate a point on the plane
    const point = normal.clone().multiplyScalar(-constant);
    
    // Orient plane to match normal
    plane.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      normal
    );
    
    // Position at point on plane
    plane.position.copy(point);
    
    scene.add(plane);
    
    return plane;
  }
};
