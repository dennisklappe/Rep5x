
/**
 * Measurement Engine for Rep5x LA/LB Measure Tool
 * Handles LA and LB parameter calculations from measured positions
 *
 * LA = A-axis offset (nozzle traces circle of radius LA when rotating)
 *      Measured at 4 points (A0°, A90°, A180°, A270°), averaged for accuracy
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
        // LA measurements: 4-point measurement for averaging
        this.laData = {
            a0: null,    // Position at A = 0°
            a90: null,   // Position at A = 90°
            a180: null,  // Position at A = 180°
            a270: null   // Position at A = 270°
        };

        // LB measurements: 3-point measurement for averaging
        this.lbData = {
            b0: null,    // Position at B = 0°
            bNeg90: null, // Position at B = -90°
            b90: null    // Position at B = +90°
        };

        // Calculated results
        this.results = {
            la: null,
            laConsistency: null,
            lb: null,
            lbAsymmetry: null
        };
    }

    /**
     * Reset only LA measurement data (for redo)
     */
    resetLa() {
        this.laData = {
            a0: null,
            a90: null,
            a180: null,
            a270: null
        };
        this.results.la = null;
        this.results.laConsistency = null;
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
        this.results.lbAsymmetry = null;
        this.lbResult = null;
    }

    /**
     * Record a position measurement for LA calibration
     * @param {number} angle - A-axis angle (0, 90, 180, or 270)
     * @param {object} position - Position object with x, y properties
     */
    recordLaPosition(angle, position) {
        const key = `a${angle}`;
        if (this.laData.hasOwnProperty(key)) {
            this.laData[key] = { x: position.x, y: position.y };
        } else {
            console.error(`Invalid LA angle: ${angle}. Expected 0, 90, 180, or 270.`);
        }
    }

    /**
     * Record a position measurement for LB calibration
     * @param {number} angle - B-axis angle (0, -90, or 90)
     * @param {object} position - Position object with x, y, z properties
     */
    recordLbPosition(bAngle, position, aAngle = 0) {
        let key;
        if (bAngle === 0) key = 'b0';
        else if (bAngle === -90) key = 'bNeg90';
        else if (bAngle === 90) key = 'b90';
        else {
            console.error(`Invalid LB angle: ${bAngle}. Expected 0, -90, or 90.`);
            return;
        }
        this.lbData[key] = { x: position.x, y: position.y, z: position.z, a: aAngle };
    }

    /**
     * Check if all LA measurements are complete
     * @returns {boolean}
     */
    isLaComplete() {
        return this.laData.a0 !== null &&
            this.laData.a90 !== null &&
            this.laData.a180 !== null &&
            this.laData.a270 !== null;
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
     * Calculate LA value from recorded positions
     *
     * Theory: LA is the distance from the A-axis rotation centre to the nozzle tip.
     * When rotating, the nozzle traces a circle of radius LA.
     * - X difference between A0 and A180 = 2*LA (so LA = |X0 - X180| / 2)
     * - Y difference between A90 and A270 = 2*LA (so LA = |Y90 - Y270| / 2)
     * Average these for final value, difference gives consistency.
     *
     * @returns {object} { value, consistency, estimates } or null if incomplete
     */
    calculateLa() {
        if (!this.isLaComplete()) {
            console.error('LA measurements incomplete');
            return null;
        }

        const a0 = this.laData.a0;
        const a90 = this.laData.a90;
        const a180 = this.laData.a180;
        const a270 = this.laData.a270;

        // LA from X difference between A0 and A180
        const laFromX = Math.abs(a0.x - a180.x) / 2;

        // LA from Y difference between A90 and A270
        const laFromY = Math.abs(a90.y - a270.y) / 2;

        // Average for final value
        const laAverage = (laFromX + laFromY) / 2;

        // Consistency check (difference between estimates)
        const consistency = Math.abs(laFromX - laFromY);

        this.results.la = laAverage;
        this.results.laConsistency = consistency;


        return {
            value: laAverage,
            consistency: consistency,
            estimates: {
                fromX: laFromX,
                fromY: laFromY
            }
        };
    }

    /**
     * Calculate LB value from recorded positions
     *
     * Theory: LB is the distance from the B-axis rotation centre to the nozzle tip.
     *
     * Measurement sequence:
     * - B0° at A=0° (reference)
     * - B-90° at A=0° → LB = X_ref - X_Bneg90
     * - B+90° at A=180° → LB = X_ref + 2·LA - X_B90
     *
     * Using A=180 for B+90 helps validate LA and provides cross-check.
     * IK formula: X = X' + LA·(1 - cos(A)) + cos(A)·sin(B)·LB
     * At A=180, B=90: X = X' + 2·LA - LB
     *
     * @returns {object} { value, asymmetry, estimates } or null if incomplete
     */
    calculateLb() {
        if (!this.isLbComplete()) {
            console.error('LB measurements incomplete');
            return null;
        }

        const b0 = this.lbData.b0;
        const bNeg90 = this.lbData.bNeg90;
        const b90 = this.lbData.b90;

        // Get LA value (from previous measurement or default to 0)
        const la = this.results.la ?? 0;

        // From B-90 at A=0: LB = X_ref - X_Bneg90
        const lbFromNeg90 = b0.x - bNeg90.x;

        // From B+90 at A=180: X = X_ref + 2·LA - LB, so LB = X_ref + 2·LA - X_B90
        // Check if B+90 was measured at A=180
        const b90_aAngle = b90.a ?? 0;
        let lbFromPos90;

        if (b90_aAngle === 180) {
            // B+90 measured at A=180: account for LA
            lbFromPos90 = b0.x + 2 * la - b90.x;
        } else {
            // B+90 measured at A=0 (legacy/fallback): simple X difference
            lbFromPos90 = b90.x - b0.x;
        }

        // Average both measurements
        const lbAverage = (lbFromPos90 + lbFromNeg90) / 2;

        // Consistency check - if LA is correct, both estimates should be similar
        const consistency = Math.abs(lbFromPos90 - lbFromNeg90);


        if (consistency > 1.0 && b90_aAngle === 180) {
            console.warn(`[LB Calc] High asymmetry (${consistency.toFixed(2)}mm) may indicate LA value (${la.toFixed(2)}) is incorrect`);
        }

        this.results.lb = lbAverage;
        this.results.lbAsymmetry = consistency;
        this.lbResult = { value: lbAverage, consistency: consistency };

        return {
            value: lbAverage,
            consistency: consistency,
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
     * @returns {object} { la, laConsistency, lb, lbAsymmetry }
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
     * @param {number} a - A-axis angle in degrees
     * @param {number} b - B-axis angle in degrees
     * @param {number} la - LA parameter (A-axis offset)
     * @param {number} lb - LB parameter (B-axis offset)
     * @returns {object} Machine position { x, y, z }
     */
    static applyInverseKinematics(tipX, tipY, tipZ, a, b, la = 0, lb = 47) {
        const aRad = a * Math.PI / 180;
        const bRad = b * Math.PI / 180;

        // X = X' + sin(A)·LA + cos(A)·sin(B)·LB
        const machineX = tipX + Math.sin(aRad) * la + Math.cos(aRad) * Math.sin(bRad) * lb;

        // Y = Y' + (cos(A) - 1)·LA - sin(A)·sin(B)·LB
        const machineY = tipY + (Math.cos(aRad) - 1) * la - Math.sin(aRad) * Math.sin(bRad) * lb;

        // Z = Z' + (cos(B) - 1)·LB
        const machineZ = tipZ + (Math.cos(bRad) - 1) * lb;

        return { x: machineX, y: machineY, z: machineZ };
    }

    /**
     * Calculate positions for all LB measurement angles
     * Given the reference position at B=0, calculates where to move for B=-90 and B=+90
     *
     * @param {object} refPosition - Reference position at B=0 { x, y, z }
     * @param {number} la - LA parameter (default 0)
     * @param {number} lb - LB parameter (default 47)
     * @param {number} zSafety - Z safety offset for travel moves (default 20)
     * @returns {object} Positions for each angle
     */
    static calculateLbPositions(refPosition, la = 0, lb = 47, zSafety = 20) {
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
                machine: MeasurementEngine.applyInverseKinematics(tipX, tipY, tipZ, 0, -90, la, lb),
                safeZ: tipZ + zSafety
            },
            b90: {
                angle: 90,
                machine: MeasurementEngine.applyInverseKinematics(tipX, tipY, tipZ, 0, 90, la, lb),
                safeZ: tipZ + zSafety
            }
        };
    }

    /**
     * Calculate positions for all LA measurement angles
     * Given the reference position at A=0, calculates where to move for other A angles
     *
     * @param {object} refPosition - Reference position at A=0 { x, y, z }
     * @param {number} la - LA parameter (default 0)
     * @param {number} lb - LB parameter (default 47)
     * @returns {object} Positions for each angle
     */
    static calculateLaPositions(refPosition, la = 0, lb = 47) {
        // At A=0, B=0, machine position = tip position
        const tipX = refPosition.x;
        const tipY = refPosition.y;
        const tipZ = refPosition.z;

        return {
            a0: {
                angle: 0,
                machine: { x: tipX, y: tipY, z: tipZ }
            },
            a90: {
                angle: 90,
                machine: MeasurementEngine.applyInverseKinematics(tipX, tipY, tipZ, 90, 0, la, lb)
            },
            a180: {
                angle: 180,
                machine: MeasurementEngine.applyInverseKinematics(tipX, tipY, tipZ, 180, 0, la, lb)
            },
            a270: {
                angle: 270,
                machine: MeasurementEngine.applyInverseKinematics(tipX, tipY, tipZ, 270, 0, la, lb)
            }
        };
    }
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MeasurementEngine;
}
