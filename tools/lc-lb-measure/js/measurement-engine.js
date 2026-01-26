
/**
 * Measurement Engine for Rep5x LC/LB Measure Tool
 * Handles LC and LB parameter calculations from measured positions
 *
 * LC = C-axis offset (nozzle traces circle of radius LC when rotating)
 *      Measured at 4 points (C0°, C90°, C180°, C270°), averaged for accuracy
 * LB = B-axis offset (nozzle moves by LB when tilting 90°)
 *      Measured at 3 points (B0°, B-90°, B+90°), averaged for accuracy
 */

class MeasurementEngine {
    constructor() {
        this.reset();
    }

    /**
     * Reset all measurement data
     */
    reset() {
        // LC measurements: 4-point measurement for averaging
        this.lcData = {
            c0: null,    // Position at C = 0°
            c90: null,   // Position at C = 90°
            c180: null,  // Position at C = 180°
            c270: null   // Position at C = 270°
        };

        // LB measurements: 3-point measurement for averaging
        this.lbData = {
            b0: null,    // Position at B = 0°
            bNeg90: null, // Position at B = -90°
            b90: null    // Position at B = +90°
        };

        // Calculated results
        this.results = {
            lc: null,
            lcUncertainty: null,
            lb: null,
            lbUncertainty: null
        };
    }

    /**
     * Reset only LC measurement data (for redo)
     */
    resetLc() {
        this.lcData = {
            c0: null,
            c90: null,
            c180: null,
            c270: null
        };
        this.results.lc = null;
        this.results.lcUncertainty = null;
        this.lcResult = null;
    }

    /**
     * Reset only LB measurement data (for redo)
     */
    resetLb() {
        this.lbData = {
            b0: null,
            bNeg90: null,
            b90: null
        };
        this.results.lb = null;
        this.results.lbUncertainty = null;
        this.lbResult = null;
    }

    /**
     * Record a position measurement for LC calibration
     * @param {number} angle - C-axis angle (0, 90, 180, or 270)
     * @param {object} position - Position object with x, y properties
     */
    recordLcPosition(angle, position) {
        const key = `c${angle}`;
        if (this.lcData.hasOwnProperty(key)) {
            this.lcData[key] = { x: position.x, y: position.y };
        } else {
            console.error(`Invalid LC angle: ${angle}. Expected 0, 90, 180, or 270.`);
        }
    }

    /**
     * Record a position measurement for LB calibration
     * @param {number} angle - B-axis angle (0, -90, or 90)
     * @param {object} position - Position object with x, y, z properties
     */
    recordLbPosition(bAngle, position, cAngle = 0) {
        let key;
        if (bAngle === 0) key = 'b0';
        else if (bAngle === -90) key = 'bNeg90';
        else if (bAngle === 90) key = 'b90';
        else {
            console.error(`Invalid LB angle: ${bAngle}. Expected 0, -90, or 90.`);
            return;
        }
        this.lbData[key] = { x: position.x, y: position.y, z: position.z, c: cAngle };
    }

    /**
     * Check if all LC measurements are complete
     * @returns {boolean}
     */
    isLcComplete() {
        return this.lcData.c0 !== null &&
            this.lcData.c90 !== null &&
            this.lcData.c180 !== null &&
            this.lcData.c270 !== null;
    }

    /**
     * Check if all LB measurements are complete
     * @returns {boolean}
     */
    isLbComplete() {
        return this.lbData.b0 !== null &&
            this.lbData.bNeg90 !== null &&
            this.lbData.b90 !== null;
    }

    /**
     * Calculate LC value from recorded positions
     *
     * Theory: LC is the distance from the C-axis rotation centre to the nozzle tip.
     * When rotating, the nozzle traces a circle of radius LC.
     * - X difference between C0 and C180 = 2*LC (so LC = |X0 - X180| / 2)
     * - Y difference between C90 and C270 = 2*LC (so LC = |Y90 - Y270| / 2)
     * Average these for final value, difference gives consistency.
     *
     * @returns {object} { value, consistency, estimates } or null if incomplete
     */
    calculateLc() {
        if (!this.isLcComplete()) {
            console.error('LC measurements incomplete');
            return null;
        }

        const c0 = this.lcData.c0;
        const c90 = this.lcData.c90;
        const c180 = this.lcData.c180;
        const c270 = this.lcData.c270;

        // LC from X difference between C0 and C180
        const lcFromX = Math.abs(c0.x - c180.x) / 2;

        // LC from Y difference between C90 and C270
        const lcFromY = Math.abs(c90.y - c270.y) / 2;

        // Average for final value
        const lcAverage = (lcFromX + lcFromY) / 2;

        // Uncertainty is half the difference between estimates
        const uncertainty = Math.abs(lcFromX - lcFromY) / 2;

        this.results.lc = lcAverage;
        this.results.lcUncertainty = uncertainty;
        this.lcResult = { value: lcAverage, uncertainty: uncertainty };

        return {
            value: lcAverage,
            uncertainty: uncertainty,
            estimates: {
                fromX: lcFromX,
                fromY: lcFromY
            }
        };
    }

    /**
     * Calculate LB value from recorded positions
     *
     * Theory: LB is the distance from the B-axis rotation centre to the nozzle tip.
     *
     * Measurement sequence:
     * - B0° at C=0° (reference)
     * - B-90° at C=0° → LB = X_ref - X_Bneg90
     * - B+90° at C=180° → LB = X_ref - X_B90
     *
     * IK formula for X: X = X' - sin(C)·LC + cos(C)·sin(B)·LB
     * At C=0, B=-90:  X = X' - LB  → LB = X_ref - X
     * At C=180, B=+90: X = X' - LB  → LB = X_ref - X (sin(180)=0, so no LC term)
     *
     * Both measurements should give the same LB. Difference indicates mechanical error.
     *
     * @returns {object} { value, uncertainty, estimates } or null if incomplete
     */
    calculateLb() {
        if (!this.isLbComplete()) {
            console.error('LB measurements incomplete');
            return null;
        }

        const b0 = this.lbData.b0;
        const bNeg90 = this.lbData.bNeg90;
        const b90 = this.lbData.b90;

        // From B-90 at C=0: X = X' - LB, so LB = X_ref - X_Bneg90
        const lbFromNeg90 = b0.x - bNeg90.x;

        // From B+90: formula depends on C angle
        // At C=0:   X = X' + LB, so LB = X_B90 - X_ref
        // At C=180: X = X' - LB, so LB = X_ref - X_B90 (cos flips sign, sin(180)=0 so no LC)
        const b90_cAngle = b90.c ?? 0;
        let lbFromPos90;

        if (b90_cAngle === 180) {
            // B+90 measured at C=180: same formula as B-90 (cos(180)=-1 flips the sign)
            lbFromPos90 = b0.x - b90.x;
        } else {
            // B+90 measured at C=0: opposite sign
            lbFromPos90 = b90.x - b0.x;
        }

        // Average both measurements
        const lbAverage = (lbFromPos90 + lbFromNeg90) / 2;

        // Uncertainty is half the difference between estimates
        const uncertainty = Math.abs(lbFromPos90 - lbFromNeg90) / 2;

        if (uncertainty > 0.5) {
            console.warn(`[LB Calc] High uncertainty (±${uncertainty.toFixed(2)}mm) indicates mechanical error or measurement issue`);
        }

        this.results.lb = lbAverage;
        this.results.lbUncertainty = uncertainty;
        this.lbResult = { value: lbAverage, uncertainty: uncertainty };

        return {
            value: lbAverage,
            uncertainty: uncertainty,
            estimates: {
                fromBNeg90: lbFromNeg90,
                fromB90: lbFromPos90
            }
        };
    }

    /**
     * Calculate 2D distance between two points
     * @param {object} p1 - First point {x, y}
     * @param {object} p2 - Second point {x, y}
     * @returns {number} Distance
     */
    distance(p1, p2) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Calculate 3D distance between two points
     * @param {object} p1 - First point {x, y, z}
     * @param {object} p2 - Second point {x, y, z}
     * @returns {number} Distance
     */
    distance3D(p1, p2) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dz = (p2.z || 0) - (p1.z || 0);
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    /**
     * Get final results
     * @returns {object} { lc, lcUncertainty, lb, lbUncertainty }
     */
    getResults() {
        return { ...this.results };
    }

    /**
     * Format a result value for display
     * @param {number} value - Value to format
     * @param {number} decimals - Number of decimal places
     * @returns {string} Formatted value
     */
    static formatValue(value, decimals = 2) {
        if (value === null || value === undefined || isNaN(value)) {
            return '--';
        }
        return value.toFixed(decimals);
    }

    /**
     * Apply inverse kinematics to calculate machine position
     * Given a desired tool tip position and angles, calculates the machine XYZ
     *
     * @param {number} tipX - Desired tip X position
     * @param {number} tipY - Desired tip Y position
     * @param {number} tipZ - Desired tip Z position
     * @param {number} c - C-axis angle in degrees
     * @param {number} b - B-axis angle in degrees
     * @param {number} lc - LC parameter (C-axis offset)
     * @param {number} lb - LB parameter (B-axis offset)
     * @returns {object} Machine position { x, y, z }
     */
    static applyInverseKinematics(tipX, tipY, tipZ, c, b, lc = 0, lb = 54.67) {
        const cRad = c * Math.PI / 180;
        const bRad = b * Math.PI / 180;

        // Formulas match firmware penta_axis_head_head.cpp native_to_joint()
        // X = X' - sin(C)·LC + cos(C)·sin(B)·LB
        const machineX = tipX - Math.sin(cRad) * lc + Math.cos(cRad) * Math.sin(bRad) * lb;

        // Y = Y' + (cos(C) - 1)·LC + sin(C)·sin(B)·LB
        const machineY = tipY + (Math.cos(cRad) - 1) * lc + Math.sin(cRad) * Math.sin(bRad) * lb;

        // Z = Z' + (cos(B) - 1)·LB
        const machineZ = tipZ + (Math.cos(bRad) - 1) * lb;

        return { x: machineX, y: machineY, z: machineZ };
    }

    /**
     * Calculate positions for all LB measurement angles
     * Given the reference position at B=0, calculates where to move for B=-90 and B=+90
     *
     * @param {object} refPosition - Reference position at B=0 { x, y, z }
     * @param {number} lc - LC parameter (default 0)
     * @param {number} lb - LB parameter (default 47)
     * @param {number} zSafety - Z safety offset for travel moves (default 20)
     * @returns {object} Positions for each angle
     */
    static calculateLbPositions(refPosition, lc = 0, lb = 54.67, zSafety = 20) {
        // At B=0, machine position = tip position (no correction)
        const tipX = refPosition.x;
        const tipY = refPosition.y;
        const tipZ = refPosition.z;

        return {
            b0: {
                angle: 0,
                machine: { x: tipX, y: tipY, z: tipZ },
                safeZ: tipZ + zSafety
            },
            bNeg90: {
                angle: -90,
                machine: MeasurementEngine.applyInverseKinematics(tipX, tipY, tipZ, 0, -90, lc, lb),
                safeZ: tipZ + zSafety
            },
            b90: {
                angle: 90,
                machine: MeasurementEngine.applyInverseKinematics(tipX, tipY, tipZ, 0, 90, lc, lb),
                safeZ: tipZ + zSafety
            }
        };
    }

    /**
     * Calculate positions for all LC measurement angles
     * Given the reference position at C=0, calculates where to move for other C angles
     *
     * @param {object} refPosition - Reference position at C=0 { x, y, z }
     * @param {number} lc - LC parameter (default 0)
     * @param {number} lb - LB parameter (default 47)
     * @returns {object} Positions for each angle
     */
    static calculateLcPositions(refPosition, lc = 0, lb = 54.67) {
        // At C=0, B=0, machine position = tip position
        const tipX = refPosition.x;
        const tipY = refPosition.y;
        const tipZ = refPosition.z;

        return {
            c0: {
                angle: 0,
                machine: { x: tipX, y: tipY, z: tipZ }
            },
            c90: {
                angle: 90,
                machine: MeasurementEngine.applyInverseKinematics(tipX, tipY, tipZ, 90, 0, lc, lb)
            },
            c180: {
                angle: 180,
                machine: MeasurementEngine.applyInverseKinematics(tipX, tipY, tipZ, 180, 0, lc, lb)
            },
            c270: {
                angle: 270,
                machine: MeasurementEngine.applyInverseKinematics(tipX, tipY, tipZ, 270, 0, lc, lb)
            }
        };
    }
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MeasurementEngine;
}
