/**
 * Calibration Corrector
 * Applies calibration corrections to XYZ based on A/B angles
 * Uses linear interpolation between measured calibration points
 */

class CalibrationCorrector {
    constructor() {
        // Calibration data storage
        this.cSweepData = [];  // {c, errorX, errorY, errorZ} at B=0
        this.bSweepData = [];  // {b, errorX, errorY, errorZ} at C=0

        // Metadata
        this.lc = 0;
        this.lb = 47;
        this.loaded = false;
    }

    /**
     * Load calibration data from JSON
     * @param {Object} data - Calibration JSON data
     */
    loadFromJSON(data) {
        if (!data || !data.measurements) {
            throw new Error('Invalid calibration data: missing measurements');
        }

        // Clear existing data
        this.cSweepData = [];
        this.bSweepData = [];

        // Load metadata
        if (data.metadata) {
            this.lc = data.metadata.lc || 0;
            this.lb = data.metadata.lb || 47;
        }

        // Separate C sweep (B=0) and B sweep (C=0)
        for (const m of data.measurements) {
            if (m.skipped) continue;

            const point = {
                c: m.c,
                b: m.b,
                errorX: m.error?.x || 0,
                errorY: m.error?.y || 0,
                errorZ: m.error?.z || 0
            };

            if (m.b === 0) {
                // C sweep point
                this.cSweepData.push(point);
            }
            if (m.c === 0) {
                // B sweep point
                this.bSweepData.push(point);
            }
        }

        // Sort by angle for interpolation
        this.cSweepData.sort((a, b) => a.c - b.c);
        this.bSweepData.sort((a, b) => a.b - b.b);

        this.loaded = true;

        console.log('Calibration data loaded:', {
            cSweepPoints: this.cSweepData.length,
            bSweepPoints: this.bSweepData.length,
            lc: this.lc,
            lb: this.lb
        });

        return {
            cSweepPoints: this.cSweepData.length,
            bSweepPoints: this.bSweepData.length
        };
    }

    /**
     * Get correction for given C/B angles
     * Uses linear interpolation and additive model
     * @param {number} a - C angle in degrees (parameter name 'a' kept for backward compatibility)
     * @param {number} b - B angle in degrees
     * @returns {Object} {x, y, z} corrections to ADD to coordinates
     */
    getCorrection(a, b) {
        if (!this.loaded) {
            return { x: 0, y: 0, z: 0 };
        }

        // Normalize C to 0-360 range
        a = ((a % 360) + 360) % 360;

        // Get C-based correction (at B=0)
        const cCorrection = this.interpolateCSweep(a);

        // Get B-based correction (at C=0)
        const bCorrection = this.interpolateBSweep(b);

        // Combine corrections (additive model)
        // Subtract C=0,B=0 baseline to avoid double-counting
        const baseline = this.getBaseline();

        return {
            x: cCorrection.x + bCorrection.x - baseline.x,
            y: cCorrection.y + bCorrection.y - baseline.y,
            z: cCorrection.z + bCorrection.z - baseline.z
        };
    }

    /**
     * Get baseline correction at C=0, B=0
     */
    getBaseline() {
        // Find the C=0, B=0 point
        const c0Point = this.cSweepData.find(p => p.c === 0);
        if (c0Point) {
            return {
                x: c0Point.errorX,
                y: c0Point.errorY,
                z: c0Point.errorZ
            };
        }
        return { x: 0, y: 0, z: 0 };
    }

    /**
     * Interpolate C sweep data
     * @param {number} c - C angle (0-360)
     */
    interpolateCSweep(c) {
        if (this.cSweepData.length === 0) {
            return { x: 0, y: 0, z: 0 };
        }

        // Handle wrap-around for C axis (360° = 0°)
        // Create extended data with wrap-around points
        const extended = [...this.cSweepData];

        // Add wrap-around point if needed (360° = 0°)
        const first = this.cSweepData[0];
        if (first.c === 0) {
            extended.push({ ...first, c: 360 });
        }

        return this.interpolateArray(extended, c, 'c');
    }

    /**
     * Interpolate B sweep data
     * @param {number} b - B angle
     */
    interpolateBSweep(b) {
        if (this.bSweepData.length === 0) {
            return { x: 0, y: 0, z: 0 };
        }

        return this.interpolateArray(this.bSweepData, b, 'b');
    }

    /**
     * Linear interpolation in sorted array
     * @param {Array} data - Sorted array of points
     * @param {number} value - Value to interpolate at
     * @param {string} key - Key to use for lookup ('c' or 'b')
     */
    interpolateArray(data, value, key) {
        if (data.length === 0) {
            return { x: 0, y: 0, z: 0 };
        }

        // Find bracketing points
        let lower = null;
        let upper = null;

        for (let i = 0; i < data.length; i++) {
            if (data[i][key] <= value) {
                lower = data[i];
            }
            if (data[i][key] >= value && upper === null) {
                upper = data[i];
            }
        }

        // Handle edge cases
        if (!lower) lower = data[0];
        if (!upper) upper = data[data.length - 1];

        // If same point or very close
        if (lower === upper || Math.abs(upper[key] - lower[key]) < 0.001) {
            return {
                x: lower.errorX,
                y: lower.errorY,
                z: lower.errorZ
            };
        }

        // Linear interpolation
        const t = (value - lower[key]) / (upper[key] - lower[key]);

        return {
            x: lower.errorX + t * (upper.errorX - lower.errorX),
            y: lower.errorY + t * (upper.errorY - lower.errorY),
            z: lower.errorZ + t * (upper.errorZ - lower.errorZ)
        };
    }

    /**
     * Get statistics about loaded calibration
     */
    getStatistics() {
        if (!this.loaded) return null;

        const allErrors = [...this.cSweepData, ...this.bSweepData];

        const xErrors = allErrors.map(p => p.errorX);
        const yErrors = allErrors.map(p => p.errorY);
        const zErrors = allErrors.map(p => p.errorZ);

        const calcStats = (arr) => ({
            min: Math.min(...arr),
            max: Math.max(...arr),
            absMax: Math.max(...arr.map(Math.abs)),
            avg: arr.reduce((a, b) => a + b, 0) / arr.length
        });

        return {
            x: calcStats(xErrors),
            y: calcStats(yErrors),
            z: calcStats(zErrors),
            cSweepPoints: this.cSweepData.length,
            bSweepPoints: this.bSweepData.length
        };
    }

    /**
     * Get C sweep data for visualization
     */
    getCSweepData() {
        return this.cSweepData.map(p => ({
            angle: p.c,
            errorX: p.errorX,
            errorY: p.errorY,
            errorZ: p.errorZ
        }));
    }

    /**
     * Get B sweep data for visualization
     */
    getBSweepData() {
        return this.bSweepData.map(p => ({
            angle: p.b,
            errorX: p.errorX,
            errorY: p.errorY,
            errorZ: p.errorZ
        }));
    }
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CalibrationCorrector };
}
