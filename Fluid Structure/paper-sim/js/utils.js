/**
 * utils.js
 * general utility functions for the paper cutting simulation
 */

// utility namespace
const Utils = {
  /**
   * Generate a random value within a range
   * @param {number} min - Minimum value
   * @param {number} max - Maximum value
   * @returns {number} Random value between min and max
   */
  random: function(min, max) {
    return min + Math.random() * (max - min);
  },
  
  /**
   * Generate a random integer within a range (inclusive)
   * @param {number} min - Minimum value
   * @param {number} max - Maximum value
   * @returns {number} Random integer between min and max (inclusive)
   */
  randomInt: function(min, max) {
    return Math.floor(this.random(min, max + 1));
  },
  
  /**
   * Clamp a value between a minimum and maximum
   * @param {number} value - Value to clamp
   * @param {number} min - Minimum allowed value
   * @param {number} max - Maximum allowed value
   * @returns {number} Clamped value
   */
  clamp: function(value, min, max) {
    return Math.max(min, Math.min(max, value));
  },
  
  /**
   * Linear interpolation between two values
   * @param {number} a - Start value
   * @param {number} b - End value
   * @param {number} t - Interpolation factor (0-1)
   * @returns {number} Interpolated value
   */
  lerp: function(a, b, t) {
    return a + (b - a) * t;
  },
  
  /**
   * Check if a point is inside a polygon (2D)
   * Uses ray casting algorithm
   * @param {THREE.Vector2} point - Point to check
   * @param {Array<THREE.Vector2>} polygon - Array of polygon vertices
   * @returns {boolean} True if point is inside polygon
   */
  pointInPolygon: function(point, polygon) {
    let inside = false;
    
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x;
      const yi = polygon[i].y;
      const xj = polygon[j].x;
      const yj = polygon[j].y;
      
      const intersect = ((yi > point.y) !== (yj > point.y)) &&
        (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
        
      if (intersect) inside = !inside;
    }
    
    return inside;
  },
  
  /**
   * Check if a ray intersects a triangle
   * Uses Möller–Trumbore algorithm
   * @param {THREE.Vector3} rayOrigin - Ray origin
   * @param {THREE.Vector3} rayDirection - Ray direction (normalized)
   * @param {THREE.Vector3} v0 - First vertex of triangle
   * @param {THREE.Vector3} v1 - Second vertex of triangle
   * @param {THREE.Vector3} v2 - Third vertex of triangle
   * @returns {Object|null} Intersection data or null if no intersection
   */
  rayTriangleIntersection: function(rayOrigin, rayDirection, v0, v1, v2) {
    const EPSILON = 0.000001;
    
    // find vectors for two edges sharing v0
    const edge1 = new THREE.Vector3().subVectors(v1, v0);
    const edge2 = new THREE.Vector3().subVectors(v2, v0);
    
    // calculate determinant
    const h = new THREE.Vector3().crossVectors(rayDirection, edge2);
    const a = edge1.dot(h);
    
    // check if ray is parallel to triangle
    if (a > -EPSILON && a < EPSILON) return null;
    
    const f = 1/a;
    const s = new THREE.Vector3().subVectors(rayOrigin, v0);
    const u = f * s.dot(h);
    
    // check if intersection is outside triangle
    if (u < 0 || u > 1) return null;
    
    const q = new THREE.Vector3().crossVectors(s, edge1);
    const v = f * rayDirection.dot(q);
    
    // check if intersection is outside triangle
    if (v < 0 || u + v > 1) return null;
    
    // at this stage we can compute t to find out where the intersection is
    const t = f * edge2.dot(q);
    
    // if t > 0, ray intersects triangle
    if (t > EPSILON) {
      const intersectionPoint = new THREE.Vector3().copy(rayOrigin)
        .addScaledVector(rayDirection, t);
        
      return {
        t: t,
        point: intersectionPoint,
        barycentric: { u: u, v: v, w: 1 - u - v }
      };
    }
    
    // no hit
    return null;
  },
  
  /**
   * Calculate barycentric coordinates for a point in a triangle
   * @param {THREE.Vector3} point - Point to get coordinates for
   * @param {THREE.Vector3} a - First vertex of triangle
   * @param {THREE.Vector3} b - Second vertex of triangle
   * @param {THREE.Vector3} c - Third vertex of triangle
   * @returns {Object} Barycentric coordinates (u,v,w)
   */
  barycentricCoordinates: function(point, a, b, c) {
    const v0 = new THREE.Vector3().subVectors(b, a);
    const v1 = new THREE.Vector3().subVectors(c, a);
    const v2 = new THREE.Vector3().subVectors(point, a);
    
    const d00 = v0.dot(v0);
    const d01 = v0.dot(v1);
    const d11 = v1.dot(v1);
    const d20 = v2.dot(v0);
    const d21 = v2.dot(v1);
    
    const denom = d00 * d11 - d01 * d01;
    
    const v = (d11 * d20 - d01 * d21) / denom;
    const w = (d00 * d21 - d01 * d20) / denom;
    const u = 1.0 - v - w;
    
    return { u, v, w };
  },
  
  /**
   * Calculate the area of a triangle
   * @param {THREE.Vector3} a - First vertex
   * @param {THREE.Vector3} b - Second vertex
   * @param {THREE.Vector3} c - Third vertex
   * @returns {number} Area of triangle
   */
  triangleArea: function(a, b, c) {
    const ab = new THREE.Vector3().subVectors(b, a);
    const ac = new THREE.Vector3().subVectors(c, a);
    
    // Calculate the cross product and divide by 2
    return new THREE.Vector3().crossVectors(ab, ac).length() / 2;
  },
  
  /**
   * Dispose a Three.js Object3D and all its children
   * Properly disposes of geometries and materials to free memory
   * @param {THREE.Object3D} object - Object to dispose
   */
  disposeObject: function(object) {
    if (!object) return;
    
    if (object.geometry) {
      object.geometry.dispose();
    }
    
    if (object.material) {
      if (Array.isArray(object.material)) {
        for (const material of object.material) {
          this.disposeMaterial(material);
        }
      } else {
        this.disposeMaterial(object.material);
      }
    }
    
    // recursively dispose all children
    if (object.children) {
      for (let i = object.children.length - 1; i >= 0; i--) {
        this.disposeObject(object.children[i]);
      }
    }
  },
  
  /**
   * Dispose a Three.js Material and its textures
   * @param {THREE.Material} material - Material to dispose
   */
  disposeMaterial: function(material) {
    if (!material) return;
    
    // dispose textures
    for (const prop in material) {
      const value = material[prop];
      if (value && typeof value === 'object' && 'isTexture' in value) {
        value.dispose();
      }
    }
    
    material.dispose();
  },
  
  /**
   * Create a debounced version of a function
   * @param {Function} func - Function to debounce
   * @param {number} wait - Delay in milliseconds
   * @returns {Function} Debounced function
   */
  debounce: function(func, wait) {
    let timeout;
    
    return function(...args) {
      const later = () => {
        timeout = null;
        func.apply(this, args);
      };
      
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },
  
  /**
   * Create a throttled version of a function
   * @param {Function} func - Function to throttle
   * @param {number} limit - Minimum time between calls in milliseconds
   * @returns {Function} Throttled function
   */
  throttle: function(func, limit) {
    let inThrottle;
    
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        
        setTimeout(() => {
          inThrottle = false;
        }, limit);
      }
    };
  }
};