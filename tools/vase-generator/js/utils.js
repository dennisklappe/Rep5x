// Shared utility functions for Rep5x vase generator

/**
 * Calculate 3D distance between two points
 * @param {Object} p1 - First point with x, y, z properties
 * @param {Object} p2 - Second point with x, y, z properties
 * @returns {number} Distance between points
 */
function distance3D(p1, p2) {
    return Math.sqrt(
        Math.pow(p1.x - p2.x, 2) +
        Math.pow(p1.y - p2.y, 2) +
        Math.pow(p1.z - p2.z, 2)
    );
}

/**
 * Smoothstep interpolation function
 * @param {number} t - Input value (0-1)
 * @returns {number} Smoothed value
 */
function smoothstep(t) {
    return t * t * (3 - 2 * t);
}

/**
 * Convert degrees to radians
 * @param {number} degrees - Angle in degrees
 * @returns {number} Angle in radians
 */
function degToRad(degrees) {
    return degrees * Math.PI / 180;
}

/**
 * Convert radians to degrees
 * @param {number} radians - Angle in radians
 * @returns {number} Angle in degrees
 */
function radToDeg(radians) {
    return radians * 180 / Math.PI;
}
