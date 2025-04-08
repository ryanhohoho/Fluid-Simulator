/**
 * utility functions for the paper cutting simulation
 */
const Utils = {
    /**
     * clamp a value between min and max
     */
    clamp: function(value, min, max) {
        return Math.max(min, Math.min(max, value));
    },
    
    /**
     * linear interpolation between two values
     */
    lerp: function(a, b, t) {
        return a + (b - a) * t;
    },
    
    /**
     * generate a random value between min and max
     */
    random: function(min, max) {
        return min + Math.random() * (max - min);
    },
    
    /**
     * generate a random integer between min and max (inclusive)
     */
    randomInt: function(min, max) {
        return Math.floor(min + Math.random() * (max - min + 1));
    },
    
    /**
     * dispose three.js objects properly
     */
    dispose: function(object) {
        if (!object) return;
        
        // dispose geometries and materials recursively
        if (object.geometry) {
            object.geometry.dispose();
        }
        
        if (object.material) {
            if (Array.isArray(object.material)) {
                object.material.forEach(material => {
                    if (material.map) material.map.dispose();
                    material.dispose();
                });
            } else {
                if (object.material.map) object.material.map.dispose();
                object.material.dispose();
            }
        }
        
        // recursively dispose children
        if (object.children && object.children.length > 0) {
            // clone the array to avoid issues during iteration
            const children = object.children.slice();
            for (const child of children) {
                Utils.dispose(child);
            }
        }
    },
    
    /**
     * check if two line segments intersect
     */
    lineSegmentsIntersect: function(p1, p2, p3, p4) {
        // convert lines to parametric form
        const a1 = p2.y - p1.y;
        const b1 = p1.x - p2.x;
        const c1 = a1 * p1.x + b1 * p1.y;
        
        const a2 = p4.y - p3.y;
        const b2 = p3.x - p4.x;
        const c2 = a2 * p3.x + b2 * p3.y;
        
        const determinant = a1 * b2 - a2 * b1;
        
        // if lines are parallel
        if (Math.abs(determinant) < 0.001) {
            return null;
        }
        
        // calculate intersection point
        const x = (b2 * c1 - b1 * c2) / determinant;
        const y = (a1 * c2 - a2 * c1) / determinant;
        
        // check if intersection is within both line segments
        const onSegment1 = (
            Math.min(p1.x, p2.x) <= x && x <= Math.max(p1.x, p2.x) &&
            Math.min(p1.y, p2.y) <= y && y <= Math.max(p1.y, p2.y)
        );
        
        const onSegment2 = (
            Math.min(p3.x, p4.x) <= x && x <= Math.max(p3.x, p4.x) &&
            Math.min(p3.y, p4.y) <= y && y <= Math.max(p3.y, p4.y)
        );
        
        if (onSegment1 && onSegment2) {
            return new THREE.Vector2(x, y);
        }
        
        return null;
    },
    
    /**
     * check if a point is inside a polygon
     */
    isPointInPolygon: function(point, polygon) {
        // ray casting algorithm
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
     * calculate the area of a polygon
     */
    polygonArea: function(polygon) {
        let area = 0;
        
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            area += (polygon[j].x + polygon[i].x) * (polygon[j].y - polygon[i].y);
        }
        
        return Math.abs(area / 2);
    },
    
    /**
     * check if a triangle is clockwise or counterclockwise
     */
    isTriangleClockwise: function(a, b, c) {
        return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x) > 0;
    },
    
    /**
     * calculate the centroid of a polygon
     */
    polygonCentroid: function(polygon) {
        let centroidX = 0;
        let centroidY = 0;
        let centroidZ = 0;
        
        for (const point of polygon) {
            centroidX += point.x;
            centroidY += point.y;
            if (point.z !== undefined) centroidZ += point.z;
        }
        
        centroidX /= polygon.length;
        centroidY /= polygon.length;
        centroidZ /= polygon.length;
        
        return new THREE.Vector3(centroidX, centroidY, centroidZ);
    },
    
    /**
     * convert colors between formats
     */
    color: {
        /**
         * convert hex color string to three.js color
         */
        hexToThree: function(hex) {
            return new THREE.Color(hex);
        },
        
        /**
         * convert hex color string to RGB values
         */
        hexToRgb: function(hex) {
            // remove # if present
            hex = hex.replace('#', '');
            
            // parse hex to rgb
            const r = parseInt(hex.substring(0, 2), 16);
            const g = parseInt(hex.substring(2, 4), 16);
            const b = parseInt(hex.substring(4, 6), 16);
            
            return { r, g, b };
        },
        
        /**
         * convert RGB values to hex color string
         */
        rgbToHex: function(r, g, b) {
            return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
        }
    },
    
    /**
     * check if a point is over a DOM element
     */
    isPointOverElement: function(x, y, element) {
        if (!element) return false;
        
        const rect = element.getBoundingClientRect();
        return (
            x >= rect.left && 
            x <= rect.right && 
            y >= rect.top && 
            y <= rect.bottom
        );
    },
    
    /**
     * check if a point is over any of the UI elements
     */
    isPointOverUI: function(x, y) {
        const elements = [
            document.querySelector('.navbar'),
            document.querySelector('.info-panel'),
            document.querySelector('.settings-panel'),
            document.querySelector('.footer'),
            document.querySelector('.modal.active'),
            // Additional UI elements
            document.querySelector('.cut-indicator')
        ];
        
        for (const element of elements) {
            if (element && Utils.isPointOverElement(x, y, element)) {
                return true;
            }
        }
        
        return false;
    },
    
    /**
     * debounce a function (limit how often it can be called)
     */
    debounce: function(func, wait) {
        let timeout;
        
        return function(...args) {
            const context = this;
            clearTimeout(timeout);
            
            timeout = setTimeout(() => {
                func.apply(context, args);
            }, wait);
        };
    },
    
    /**
     * throttle a function (limit rate of calls)
     */
    throttle: function(func, limit) {
        let inThrottle;
        
        return function(...args) {
            const context = this;
            
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                
                setTimeout(() => {
                    inThrottle = false;
                }, limit);
            }
        };
    }
};