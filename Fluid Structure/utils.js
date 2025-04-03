/**
 * Utility functions for the fluid simulation
 */
const Utils = {
    /**
     * Clamp a value between min and max
     * @param {number} value - The value to clamp
     * @param {number} min - The minimum allowed value
     * @param {number} max - The maximum allowed value
     * @returns {number} - The clamped value
     */
    clamp: function(value, min, max) {
        return Math.max(min, Math.min(max, value));
    },
    
    /**
     * Linear interpolation between two values
     * @param {number} a - Start value
     * @param {number} b - End value
     * @param {number} t - Interpolation factor (0-1)
     * @returns {number} - The interpolated value
     */
    lerp: function(a, b, t) {
        return a + (b - a) * t;
    },
    
    /**
     * Calculate distance between two 3D points
     * @param {THREE.Vector3} p1 - First point
     * @param {THREE.Vector3} p2 - Second point
     * @returns {number} - The distance between points
     */
    distance: function(p1, p2) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dz = p2.z - p1.z;
        return Math.sqrt(dx*dx + dy*dy + dz*dz);
    },
    
    /**
     * Calculate squared distance between two 3D points (more efficient)
     * @param {THREE.Vector3} p1 - First point
     * @param {THREE.Vector3} p2 - Second point
     * @returns {number} - The squared distance between points
     */
    distanceSquared: function(p1, p2) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dz = p2.z - p1.z;
        return dx*dx + dy*dy + dz*dz;
    },
    
    /**
     * Generate a random value between min and max
     * @param {number} min - Minimum value
     * @param {number} max - Maximum value
     * @returns {number} - A random value between min and max
     */
    random: function(min, max) {
        return min + Math.random() * (max - min);
    },
    
    /**
     * Generate a random integer between min and max (inclusive)
     * @param {number} min - Minimum value
     * @param {number} max - Maximum value
     * @returns {number} - A random integer between min and max
     */
    randomInt: function(min, max) {
        return Math.floor(min + Math.random() * (max - min + 1));
    },
    
    /**
     * Dispose of Three.js objects properly to avoid memory leaks
     * @param {THREE.Object3D} object - The object to dispose
     */
    disposeObject: function(object) {
        if (!object) return;
        
        // Dispose geometries and materials recursively
        if (object.geometry) {
            object.geometry.dispose();
        }
        
        if (object.material) {
            if (Array.isArray(object.material)) {
                object.material.forEach(material => material.dispose());
            } else {
                object.material.dispose();
            }
        }
        
        // Recursively dispose children
        if (object.children && object.children.length > 0) {
            for (let i = object.children.length - 1; i >= 0; i--) {
                this.disposeObject(object.children[i]);
            }
        }
    },
    
    /**
     * Format a number with fixed decimal places
     * @param {number} value - The value to format
     * @param {number} decimals - Number of decimal places
     * @returns {string} - The formatted value as a string
     */
    formatNumber: function(value, decimals = 2) {
        return value.toFixed(decimals);
    },
    
    /**
     * Check if an element is visible in the viewport
     * @param {HTMLElement} element - The element to check
     * @returns {boolean} - True if element is at least partially visible
     */
    isElementVisible: function(element) {
        if (!element) return false;
        
        const rect = element.getBoundingClientRect();
        return (
            rect.top <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.left <= (window.innerWidth || document.documentElement.clientWidth) &&
            rect.bottom >= 0 &&
            rect.right >= 0
        );
    },
    
    /**
     * Check if a point is inside a bounding box
     * @param {THREE.Vector3} point - The point to check
     * @param {THREE.Box3} box - The bounding box
     * @returns {boolean} - True if the point is inside the box
     */
    isPointInBox: function(point, box) {
        return (
            point.x >= box.min.x && point.x <= box.max.x &&
            point.y >= box.min.y && point.y <= box.max.y &&
            point.z >= box.min.z && point.z <= box.max.z
        );
    },
    
    /**
     * Create a unique ID
     * @returns {string} - A unique ID
     */
    generateUUID: function() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    },
    
    /**
     * Debounce a function call
     * @param {Function} func - The function to debounce
     * @param {number} wait - Wait time in milliseconds
     * @returns {Function} - The debounced function
     */
    debounce: function(func, wait) {
        let timeout;
        return function(...args) {
            const context = this;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), wait);
        };
    },
    
    /**
     * Throttle a function call
     * @param {Function} func - The function to throttle
     * @param {number} limit - Throttle time in milliseconds
     * @returns {Function} - The throttled function
     */
    throttle: function(func, limit) {
        let inThrottle;
        return function(...args) {
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
};
