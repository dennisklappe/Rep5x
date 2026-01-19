/**
 * Shared Inverse Kinematics for Rep5x 5-axis printer
 * Converts tool-tip coordinates to machine coordinates based on A/B axis rotations
 * Used by: Calibrator, Vase Generator, G-code Viewer
 */

class InverseKinematics {
    /**
     * Create an IK instance with specified parameters
     * @param {number} la - LA parameter (A-axis offset, default 0)
     * @param {number} lb - LB parameter (B-axis offset, default 47.9)
     */
    constructor(la = 0, lb = 47.9) {
        this.la = la;
        this.lb = lb;
    }

    /**
     * Set LA/LB parameters
     * @param {number} la - A-axis offset
     * @param {number} lb - B-axis offset
     */
    setParameters(la, lb) {
        this.la = la;
        this.lb = lb;
    }

    /**
     * Apply inverse kinematics to convert tool-tip to machine coordinates
     * @param {number} x - X coordinate (tool tip)
     * @param {number} y - Y coordinate (tool tip)
     * @param {number} z - Z coordinate (tool tip)
     * @param {number} a - A axis rotation in degrees
     * @param {number} b - B axis rotation in degrees
     * @returns {Object} Corrected machine coordinates {x, y, z}
     */
    apply(x, y, z, a, b) {
        const aRad = a * Math.PI / 180;
        const bRad = b * Math.PI / 180;

        // X = X' + sin(A)·LA + cos(A)·sin(B)·LB
        const machineX = x + Math.sin(aRad) * this.la + Math.cos(aRad) * Math.sin(bRad) * this.lb;

        // Y = Y' + (cos(A) - 1)·LA - sin(A)·sin(B)·LB
        const machineY = y + (Math.cos(aRad) - 1) * this.la - Math.sin(aRad) * Math.sin(bRad) * this.lb;

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
     * @param {number} a - A axis rotation in degrees
     * @param {number} b - B axis rotation in degrees
     * @returns {Object} Tool-tip coordinates {x, y, z}
     */
    forward(x, y, z, a, b) {
        const aRad = a * Math.PI / 180;
        const bRad = b * Math.PI / 180;

        // Inverse of the IK formulas
        const tipX = x - Math.sin(aRad) * this.la - Math.cos(aRad) * Math.sin(bRad) * this.lb;
        const tipY = y - (Math.cos(aRad) - 1) * this.la + Math.sin(aRad) * Math.sin(bRad) * this.lb;
        const tipZ = z - (Math.cos(bRad) - 1) * this.lb;

        return { x: tipX, y: tipY, z: tipZ };
    }
}

/**
 * Standalone function for applying IK (for backwards compatibility)
 * @param {number} x - X coordinate (tool tip)
 * @param {number} y - Y coordinate (tool tip)
 * @param {number} z - Z coordinate (tool tip)
 * @param {number} a - A axis rotation in degrees
 * @param {number} b - B axis rotation in degrees
 * @param {number} la - LA parameter (default 0)
 * @param {number} lb - LB parameter (default 47.9)
 * @returns {Object} Corrected coordinates {x, y, z, a, b}
 */
function applyInverseKinematics(x, y, z, a, b, la = 0, lb = 47.9) {
    const aRad = a * Math.PI / 180;
    const bRad = b * Math.PI / 180;

    const correctedX = x + Math.sin(aRad) * la + Math.cos(aRad) * Math.sin(bRad) * lb;
    const correctedY = y + (Math.cos(aRad) - 1) * la - Math.sin(aRad) * Math.sin(bRad) * lb;
    const correctedZ = z + (Math.cos(bRad) - 1) * lb;

    return {
        x: correctedX,
        y: correctedY,
        z: correctedZ,
        a: a,
        b: b
    };
}

/**
 * Process raw G-code and apply inverse kinematics corrections
 * @param {string} rawGcode - Raw G-code string
 * @param {boolean} enableKinematics - Whether to apply corrections
 * @param {number} la - LA parameter
 * @param {number} lb - LB parameter
 * @returns {string} Processed G-code
 */
function processGcodeWithIK(rawGcode, enableKinematics = true, la = 0, lb = 47.9) {
    if (!enableKinematics) {
        return rawGcode;
    }

    const lines = rawGcode.split('\n');
    const processedLines = [];

    for (let line of lines) {
        if (line.startsWith('G1') && (line.includes(' A') || line.includes(' B'))) {
            const processedLine = applyKinematicCorrectionsToLine(line, la, lb);
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
 * @param {number} la - LA parameter
 * @param {number} lb - LB parameter
 * @returns {string} Corrected G-code line
 */
function applyKinematicCorrectionsToLine(gcodeLine, la, lb) {
    const coords = parseGcodeLine(gcodeLine);

    if (!coords) {
        return gcodeLine;
    }

    const corrected = applyInverseKinematics(
        coords.x, coords.y, coords.z,
        coords.a, coords.b,
        la, lb
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
        x: 0, y: 0, z: 0, a: 0, b: 0,
        e: null, f: null,
        hasA: false, hasB: false
    };

    const patterns = {
        x: /X([-+]?\d*\.?\d+)/i,
        y: /Y([-+]?\d*\.?\d+)/i,
        z: /Z([-+]?\d*\.?\d+)/i,
        a: /A([-+]?\d*\.?\d+)/i,
        b: /B([-+]?\d*\.?\d+)/i,
        e: /E([-+]?\d*\.?\d+)/i,
        f: /F([-+]?\d*\.?\d+)/i
    };

    for (const [axis, pattern] of Object.entries(patterns)) {
        const match = line.match(pattern);
        if (match) {
            if (axis === 'a') coords.hasA = true;
            if (axis === 'b') coords.hasB = true;
            coords[axis] = parseFloat(match[1]);
        }
    }

    if (!coords.hasA && !coords.hasB) {
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
    line += ` A${correctedCoords.a.toFixed(3)}`;
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
