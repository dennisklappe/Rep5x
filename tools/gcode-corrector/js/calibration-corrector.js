/**
 * Calibration Corrector
 * Applies calibration corrections to XYZ based on A/B angles
 * Uses linear interpolation between measured calibration points
 */

class CalibrationCorrector {
    constructor() {
        // Calibration data storage
        this.aSweepData = [];  // {a, errorX, errorY, errorZ} at B=0
        this.bSweepData = [];  // {b, errorX, errorY, errorZ} at A=0

        // Metadata
        this.la = 0;
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
        this.aSweepData = [];
        this.bSweepData = [];

        // Load metadata
        if (data.metadata) {
            this.la = data.metadata.la || 0;
            this.lb = data.metadata.lb || 47;
        }

        // Separate A sweep (B=0) and B sweep (A=0)
        for (const m of data.measurements) {
            if (m.skipped) continue;

            const point = {
                a: m.a,
                b: m.b,
                errorX: m.error?.x || 0,
                errorY: m.error?.y || 0,
                errorZ: m.error?.z || 0
            };

            if (m.b === 0) {
                // A sweep point
                this.aSweepData.push(point);
            }
            if (m.a === 0) {
                // B sweep point
                this.bSweepData.push(point);
            }
        }

        // Sort by angle for interpolation
        this.aSweepData.sort((a, b) => a.a - b.a);
        this.bSweepData.sort((a, b) => a.b - b.b);

        this.loaded = true;

        console.log('Calibration data loaded:', {
            aSweepPoints: this.aSweepData.length,
            bSweepPoints: this.bSweepData.length,
            la: this.la,
            lb: this.lb
        });

        return {
            aSweepPoints: this.aSweepData.length,
            bSweepPoints: this.bSweepData.length
        };
    }

    /**
     * Get correction for given A/B angles
     * Uses linear interpolation and additive model
     * @param {number} a - A angle in degrees
     * @param {number} b - B angle in degrees
     * @returns {Object} {x, y, z} corrections to ADD to coordinates
     */
    getCorrection(a, b) {
        if (!this.loaded) {
            return { x: 0, y: 0, z: 0 };
        }

        // Normalize A to 0-360 range
        a = ((a % 360) + 360) % 360;

        // Get A-based correction (at B=0)
        const aCorrection = this.interpolateASweep(a);

        // Get B-based correction (at A=0)
        const bCorrection = this.interpolateBSweep(b);

        // Combine corrections (additive model)
        // Subtract A=0,B=0 baseline to avoid double-counting
        const baseline = this.getBaseline();

        return {
            x: aCorrection.x + bCorrection.x - baseline.x,
            y: aCorrection.y + bCorrection.y - baseline.y,
            z: aCorrection.z + bCorrection.z - baseline.z
        };
    }

    /**
     * Get baseline correction at A=0, B=0
     */
    getBaseline() {
        // Find the A=0, B=0 point
        const a0Point = this.aSweepData.find(p => p.a === 0);
        if (a0Point) {
            return {
                x: a0Point.errorX,
                y: a0Point.errorY,
                z: a0Point.errorZ
            };
        }
        return { x: 0, y: 0, z: 0 };
    }

    /**
     * Interpolate A sweep data
     * @param {number} a - A angle (0-360)
     */
    interpolateASweep(a) {
        if (this.aSweepData.length === 0) {
            return { x: 0, y: 0, z: 0 };
        }

        // Handle wrap-around for A axis (360° = 0°)
        // Create extended data with wrap-around points
        const extended = [...this.aSweepData];

        // Add wrap-around point if needed (360° = 0°)
        const first = this.aSweepData[0];
        if (first.a === 0) {
            extended.push({ ...first, a: 360 });
        }

        return this.interpolateArray(extended, a, 'a');
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
     * @param {string} key - Key to use for lookup ('a' or 'b')
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

        const allErrors = [...this.aSweepData, ...this.bSweepData];

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
            aSweepPoints: this.aSweepData.length,
            bSweepPoints: this.bSweepData.length
        };
    }

    /**
     * Get A sweep data for visualization
     */
    getASweepData() {
        return this.aSweepData.map(p => ({
            angle: p.a,
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
