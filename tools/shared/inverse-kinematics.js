/**
 * Shared Inverse Kinematics for Rep5x 5-axis printer
 * Converts tool-tip coordinates to machine coordinates based on C/B axis rotations
 * Used by: Calibrator, Vase Generator, G-code Viewer
 */

class InverseKinematics {
    /**
     * Create an IK instance with specified parameters
     * @param {number} lc - LC parameter (C-axis offset, default 0)
     * @param {number} lb - LB parameter (B-axis offset, default 47.9)
     */
    constructor(lc = 0, lb = 47.9) {
        this.lc = lc;
        this.lb = lb;
    }

    /**
     * Set LC/LB parameters
     * @param {number} lc - C-axis offset
     * @param {number} lb - B-axis offset
     */
    setParameters(lc, lb) {
        this.lc = lc;
        this.lb = lb;
    }

    /**
     * Apply inverse kinematics to convert tool-tip to machine coordinates
     * @param {number} x - X coordinate (tool tip)
     * @param {number} y - Y coordinate (tool tip)
     * @param {number} z - Z coordinate (tool tip)
     * @param {number} c - C axis rotation in degrees
     * @param {number} b - B axis rotation in degrees
     * @returns {Object} Corrected machine coordinates {x, y, z}
     */
    apply(x, y, z, c, b) {
        const cRad = c * Math.PI / 180;
        const bRad = b * Math.PI / 180;

        // X = X' + sin(C)·LC + cos(C)·sin(B)·LB
        const machineX = x + Math.sin(cRad) * this.lc + Math.cos(cRad) * Math.sin(bRad) * this.lb;

        // Y = Y' + (cos(C) - 1)·LC - sin(C)·sin(B)·LB
        const machineY = y + (Math.cos(cRad) - 1) * this.lc - Math.sin(cRad) * Math.sin(bRad) * this.lb;

        // Z = Z' + (cos(B) - 1)·LB
        const machineZ = z + (Math.cos(bRad) - 1) * this.lb;

        return { x: machineX, y: machineY, z: machineZ };
    }

    /**
     * Apply forward kinematics to convert machine to tool-tip coordinates
     * (Inverse of apply())
     * @param {number} x - X coordinate (machine)
     * @param {number} y - Y coordinate (machine)
     * @param {number} z - Z coordinate (machine)
     * @param {number} c - C axis rotation in degrees
     * @param {number} b - B axis rotation in degrees
     * @returns {Object} Tool-tip coordinates {x, y, z}
     */
    forward(x, y, z, c, b) {
        const cRad = c * Math.PI / 180;
        const bRad = b * Math.PI / 180;

        // Inverse of the IK formulas
        const tipX = x - Math.sin(cRad) * this.lc - Math.cos(cRad) * Math.sin(bRad) * this.lb;
        const tipY = y - (Math.cos(cRad) - 1) * this.lc + Math.sin(cRad) * Math.sin(bRad) * this.lb;
        const tipZ = z - (Math.cos(bRad) - 1) * this.lb;

        return { x: tipX, y: tipY, z: tipZ };
    }
}

/**
 * Standalone function for applying IK (for backwards compatibility)
 * @param {number} x - X coordinate (tool tip)
 * @param {number} y - Y coordinate (tool tip)
 * @param {number} z - Z coordinate (tool tip)
 * @param {number} c - C axis rotation in degrees
 * @param {number} b - B axis rotation in degrees
 * @param {number} lc - LC parameter (default 0)
 * @param {number} lb - LB parameter (default 47.9)
 * @returns {Object} Corrected coordinates {x, y, z, c, b}
 */
function applyInverseKinematics(x, y, z, c, b, lc = 0, lb = 47.9) {
    const cRad = c * Math.PI / 180;
    const bRad = b * Math.PI / 180;

    const correctedX = x + Math.sin(cRad) * lc + Math.cos(cRad) * Math.sin(bRad) * lb;
    const correctedY = y + (Math.cos(cRad) - 1) * lc - Math.sin(cRad) * Math.sin(bRad) * lb;
    const correctedZ = z + (Math.cos(bRad) - 1) * lb;

    return {
        x: correctedX,
        y: correctedY,
        z: correctedZ,
        c: c,
        b: b
    };
}

/**
 * Process raw G-code and apply inverse kinematics corrections
 * @param {string} rawGcode - Raw G-code string
 * @param {boolean} enableKinematics - Whether to apply corrections
 * @param {number} lc - LC parameter
 * @param {number} lb - LB parameter
 * @returns {string} Processed G-code
 */
function processGcodeWithIK(rawGcode, enableKinematics = true, lc = 0, lb = 47.9) {
    if (!enableKinematics) {
        return rawGcode;
    }

    const lines = rawGcode.split('\n');
    const processedLines = [];

    for (let line of lines) {
        if (line.startsWith('G1') && (line.includes(' C') || line.includes(' B'))) {
            const processedLine = applyKinematicCorrectionsToLine(line, lc, lb);
            processedLines.push(processedLine);
        } else {
            processedLines.push(line);
        }
    }

    return processedLines.join('\n');
}

/**
 * Apply IK corrections to a single G-code line
 * @param {string} gcodeLine - G-code line
 * @param {number} lc - LC parameter
 * @param {number} lb - LB parameter
 * @returns {string} Corrected G-code line
 */
function applyKinematicCorrectionsToLine(gcodeLine, lc, lb) {
    const coords = parseGcodeLine(gcodeLine);

    if (!coords) {
        return gcodeLine;
    }

    const corrected = applyInverseKinematics(
        coords.x, coords.y, coords.z,
        coords.c, coords.b,
        lc, lb
    );

    return buildGcodeLine(coords, corrected);
}

/**
 * Parse G-code line to extract coordinates
 * @param {string} line - G-code line
 * @returns {Object|null} Parsed coordinates or null
 */
function parseGcodeLine(line) {
    const coords = {
        x: 0, y: 0, z: 0, c: 0, b: 0,
        e: null, f: null,
        hasC: false, hasB: false
    };

    const patterns = {
        x: /X([-+]?\d*\.?\d+)/i,
        y: /Y([-+]?\d*\.?\d+)/i,
        z: /Z([-+]?\d*\.?\d+)/i,
        c: /C([-+]?\d*\.?\d+)/i,
        b: /B([-+]?\d*\.?\d+)/i,
        e: /E([-+]?\d*\.?\d+)/i,
        f: /F([-+]?\d*\.?\d+)/i
    };

    for (const [axis, pattern] of Object.entries(patterns)) {
        const match = line.match(pattern);
        if (match) {
            if (axis === 'c') coords.hasC = true;
            if (axis === 'b') coords.hasB = true;
            coords[axis] = parseFloat(match[1]);
        }
    }

    if (!coords.hasC && !coords.hasB) {
        return null;
    }

    return coords;
}

/**
 * Build G-code line from coordinates
 * @param {Object} originalCoords - Original parsed coordinates
 * @param {Object} correctedCoords - IK-corrected coordinates
 * @returns {string} G-code line
 */
function buildGcodeLine(originalCoords, correctedCoords) {
    let line = 'G1';

    line += ` X${correctedCoords.x.toFixed(3)}`;
    line += ` Y${correctedCoords.y.toFixed(3)}`;
    line += ` Z${correctedCoords.z.toFixed(3)}`;
    line += ` C${correctedCoords.c.toFixed(3)}`;
    line += ` B${correctedCoords.b.toFixed(3)}`;

    if (originalCoords.e !== null) {
        line += ` E${originalCoords.e.toFixed(4)}`;
    }
    if (originalCoords.f !== null) {
        line += ` F${Math.round(originalCoords.f)}`;
    }

    return line;
}

// Backwards compatibility alias
const processInverseKinematics = processGcodeWithIK;

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        InverseKinematics,
        applyInverseKinematics,
        processGcodeWithIK,
        processInverseKinematics,
        parseGcodeLine,
        buildGcodeLine
    };
} else {
    // Make available globally if loaded via script tag
    window.InverseKinematics = InverseKinematics;
    window.applyInverseKinematics = applyInverseKinematics;
    window.processGcodeWithIK = processGcodeWithIK;
    window.processInverseKinematics = processInverseKinematics;
}
