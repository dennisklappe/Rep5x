// Base class for vase generator shapes

class ShapeBase {
    constructor(name, description, info) {
        this.name = name;
        this.description = description;
        this.info = info;
    }

    /**
     * Create Three.js geometry for preview
     * @param {Object} params - Shape parameters
     * @returns {THREE.BufferGeometry} The geometry
     */
    createGeometry(params) {
        throw new Error('createGeometry must be implemented by subclass');
    }

    /**
     * Create path points for print visualization
     * @param {Object} params - Shape parameters
     * @returns {THREE.Vector3[]} Array of path points
     */
    createPath(params) {
        throw new Error('createPath must be implemented by subclass');
    }

    /**
     * Generate G-code for the shape
     * @param {Object} params - Shape parameters
     * @param {number} layerHeight - Layer height in mm
     * @param {number} speed - Print speed in mm/min
     * @returns {string[]} Array of G-code lines
     */
    generateGcode(params, layerHeight, speed) {
        throw new Error('generateGcode must be implemented by subclass');
    }

    /**
     * Get default parameters for this shape
     * @returns {Object} Default parameters
     */
    getDefaultParams() {
        throw new Error('getDefaultParams must be implemented by subclass');
    }

    /**
     * Generate filename for G-code download
     * @param {Object} params - Shape parameters
     * @returns {string} Filename
     */
    getFilename(params) {
        throw new Error('getFilename must be implemented by subclass');
    }

    /**
     * Calculate total height of the shape
     * @param {Object} params - Shape parameters
     * @returns {number} Total height in mm
     */
    getTotalHeight(params) {
        throw new Error('getTotalHeight must be implemented by subclass');
    }
}
