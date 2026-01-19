/**
 * Calibration Corrector
 * Applies calibration corrections to XYZ based on A/B angles
 * Uses Fourier/trigonometric curve fitting for smooth, physically-motivated corrections
 *
 * Used by: Calibrator, G-code Corrector, G-code Viewer
 */

class CalibrationCorrector {
    constructor() {
        // Raw calibration data storage
        this.aSweepData = [];  // {a, errorX, errorY, errorZ} at B=0
        this.bSweepData = [];  // {b, errorX, errorY, errorZ} at A=0

        // Fourier coefficients for A-axis (periodic, 0-360°)
        // Format: { x: [a0, a1, b1, a2, b2, ...], y: [...], z: [...] }
        this.aCoeffs = null;
        this.aHarmonics = 3;  // Number of harmonics to fit

        // Trigonometric coefficients for B-axis (-90° to 90°)
        // Format: { x: [c0, c1, s1, c2, s2], y: [...], z: [...] }
        this.bCoeffs = null;
        this.bHarmonics = 2;  // Number of harmonics for B-axis

        // Metadata
        this.la = 0;
        this.lb = 47;
        this.loaded = false;

        // Fitting method: 'fourier' or 'linear' (fallback)
        this.fittingMethod = 'fourier';
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
        this.aCoeffs = null;
        this.bCoeffs = null;

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
                this.aSweepData.push(point);
            }
            if (m.a === 0) {
                this.bSweepData.push(point);
            }
        }

        // Sort by angle
        this.aSweepData.sort((a, b) => a.a - b.a);
        this.bSweepData.sort((a, b) => a.b - b.b);

        // Fit curves
        this.fitCurves();

        this.loaded = true;

        return {
            aSweepPoints: this.aSweepData.length,
            bSweepPoints: this.bSweepData.length
        };
    }

    /**
     * Fit Fourier/trigonometric curves to the calibration data
     */
    fitCurves() {
        // Fit A-axis (Fourier series, periodic)
        if (this.aSweepData.length >= 3) {
            this.aCoeffs = {
                x: this.fitFourierSeries(this.aSweepData, 'a', 'errorX', this.aHarmonics, true),
                y: this.fitFourierSeries(this.aSweepData, 'a', 'errorY', this.aHarmonics, true),
                z: this.fitFourierSeries(this.aSweepData, 'a', 'errorZ', this.aHarmonics, true)
            };
        }

        // Fit B-axis (trigonometric, non-periodic)
        if (this.bSweepData.length >= 3) {
            this.bCoeffs = {
                x: this.fitFourierSeries(this.bSweepData, 'b', 'errorX', this.bHarmonics, false),
                y: this.fitFourierSeries(this.bSweepData, 'b', 'errorY', this.bHarmonics, false),
                z: this.fitFourierSeries(this.bSweepData, 'b', 'errorZ', this.bHarmonics, false)
            };
        }
    }

    /**
     * Fit a Fourier/trigonometric series using least squares
     * @param {Array} data - Array of data points
     * @param {string} angleKey - Key for angle ('a' or 'b')
     * @param {string} errorKey - Key for error value ('errorX', 'errorY', 'errorZ')
     * @param {number} harmonics - Number of harmonics to fit
     * @param {boolean} periodic - If true, treat as periodic (0-360°)
     * @returns {Array} Coefficients [a0, a1, b1, a2, b2, ...]
     */
    fitFourierSeries(data, angleKey, errorKey, harmonics, periodic) {
        const n = data.length;
        const numCoeffs = 1 + 2 * harmonics;  // a0 + (an, bn) for each harmonic

        // Build design matrix Φ
        // Each row: [1, cos(θ), sin(θ), cos(2θ), sin(2θ), ...]
        const Phi = [];
        const y = [];

        for (const point of data) {
            let angle = point[angleKey];
            // Convert to radians
            const theta = periodic
                ? (angle * Math.PI / 180)  // A-axis: degrees directly
                : (angle * Math.PI / 180); // B-axis: degrees to radians

            const row = [1];  // a0 (constant term)
            for (let k = 1; k <= harmonics; k++) {
                row.push(Math.cos(k * theta));  // ak
                row.push(Math.sin(k * theta));  // bk
            }
            Phi.push(row);
            y.push(point[errorKey]);
        }

        // Solve least squares: coeffs = (Φᵀ * Φ)⁻¹ * Φᵀ * y
        const PhiT = this.transpose(Phi);
        const PhiTxPhi = this.matMul(PhiT, Phi);
        const PhiTxy = this.matVecMul(PhiT, y);

        // Solve the normal equations
        const coeffs = this.solveLinearSystem(PhiTxPhi, PhiTxy);

        return coeffs;
    }

    /**
     * Evaluate Fourier series at a given angle
     * @param {Array} coeffs - Coefficients [a0, a1, b1, a2, b2, ...]
     * @param {number} angleDeg - Angle in degrees
     * @param {boolean} periodic - Whether this is periodic (affects angle handling)
     * @returns {number} Evaluated value
     */
    evaluateFourier(coeffs, angleDeg, periodic) {
        if (!coeffs || coeffs.length === 0) return 0;

        const theta = angleDeg * Math.PI / 180;
        let result = coeffs[0];  // a0

        const harmonics = (coeffs.length - 1) / 2;
        for (let k = 1; k <= harmonics; k++) {
            const ak = coeffs[1 + 2 * (k - 1)];
            const bk = coeffs[2 + 2 * (k - 1)];
            result += ak * Math.cos(k * theta) + bk * Math.sin(k * theta);
        }

        return result;
    }

    /**
     * Get correction for given A/B angles
     * Uses fitted curves and additive model
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

        // Get corrections from fitted curves
        const aCorrection = this.getACorrectionFitted(a);
        const bCorrection = this.getBCorrectionFitted(b);

        // Get baseline (correction at A=0, B=0) to avoid double-counting
        const baseline = this.getBaselineFitted();

        return {
            x: aCorrection.x + bCorrection.x - baseline.x,
            y: aCorrection.y + bCorrection.y - baseline.y,
            z: aCorrection.z + bCorrection.z - baseline.z
        };
    }

    /**
     * Get A-axis correction using fitted Fourier curve
     */
    getACorrectionFitted(a) {
        if (!this.aCoeffs) {
            return this.interpolateASweep(a);  // Fallback to linear
        }

        return {
            x: this.evaluateFourier(this.aCoeffs.x, a, true),
            y: this.evaluateFourier(this.aCoeffs.y, a, true),
            z: this.evaluateFourier(this.aCoeffs.z, a, true)
        };
    }

    /**
     * Get B-axis correction using fitted trigonometric curve
     */
    getBCorrectionFitted(b) {
        if (!this.bCoeffs) {
            return this.interpolateBSweep(b);  // Fallback to linear
        }

        return {
            x: this.evaluateFourier(this.bCoeffs.x, b, false),
            y: this.evaluateFourier(this.bCoeffs.y, b, false),
            z: this.evaluateFourier(this.bCoeffs.z, b, false)
        };
    }

    /**
     * Get baseline correction at A=0, B=0 using fitted curves
     */
    getBaselineFitted() {
        if (!this.aCoeffs || !this.bCoeffs) {
            return this.getBaseline();  // Fallback
        }

        // Evaluate both curves at 0°
        return {
            x: this.evaluateFourier(this.aCoeffs.x, 0, true),
            y: this.evaluateFourier(this.aCoeffs.y, 0, true),
            z: this.evaluateFourier(this.aCoeffs.z, 0, true)
        };
    }

    // ========== Linear Algebra Helpers ==========

    /**
     * Transpose a matrix
     */
    transpose(matrix) {
        const rows = matrix.length;
        const cols = matrix[0].length;
        const result = [];
        for (let j = 0; j < cols; j++) {
            result[j] = [];
            for (let i = 0; i < rows; i++) {
                result[j][i] = matrix[i][j];
            }
        }
        return result;
    }

    /**
     * Matrix multiplication
     */
    matMul(A, B) {
        const rowsA = A.length;
        const colsA = A[0].length;
        const colsB = B[0].length;
        const result = [];

        for (let i = 0; i < rowsA; i++) {
            result[i] = [];
            for (let j = 0; j < colsB; j++) {
                let sum = 0;
                for (let k = 0; k < colsA; k++) {
                    sum += A[i][k] * B[k][j];
                }
                result[i][j] = sum;
            }
        }
        return result;
    }

    /**
     * Matrix-vector multiplication
     */
    matVecMul(A, v) {
        const result = [];
        for (let i = 0; i < A.length; i++) {
            let sum = 0;
            for (let j = 0; j < v.length; j++) {
                sum += A[i][j] * v[j];
            }
            result[i] = sum;
        }
        return result;
    }

    /**
     * Solve linear system Ax = b using Gaussian elimination with partial pivoting
     */
    solveLinearSystem(A, b) {
        const n = A.length;

        // Create augmented matrix [A|b]
        const aug = A.map((row, i) => [...row, b[i]]);

        // Forward elimination with partial pivoting
        for (let col = 0; col < n; col++) {
            // Find pivot
            let maxRow = col;
            for (let row = col + 1; row < n; row++) {
                if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) {
                    maxRow = row;
                }
            }

            // Swap rows
            [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];

            // Check for singular matrix
            if (Math.abs(aug[col][col]) < 1e-10) {
                console.warn('Near-singular matrix in curve fitting, using fallback');
                return new Array(n).fill(0);
            }

            // Eliminate below
            for (let row = col + 1; row < n; row++) {
                const factor = aug[row][col] / aug[col][col];
                for (let j = col; j <= n; j++) {
                    aug[row][j] -= factor * aug[col][j];
                }
            }
        }

        // Back substitution
        const x = new Array(n).fill(0);
        for (let i = n - 1; i >= 0; i--) {
            let sum = aug[i][n];
            for (let j = i + 1; j < n; j++) {
                sum -= aug[i][j] * x[j];
            }
            x[i] = sum / aug[i][i];
        }

        return x;
    }

    // ========== Fallback Linear Interpolation Methods ==========

    /**
     * Get baseline correction at A=0, B=0 (fallback)
     */
    getBaseline() {
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
     * Interpolate A sweep data (fallback)
     */
    interpolateASweep(a) {
        if (this.aSweepData.length === 0) {
            return { x: 0, y: 0, z: 0 };
        }

        const extended = [...this.aSweepData];
        const first = this.aSweepData[0];
        if (first.a === 0) {
            extended.push({ ...first, a: 360 });
        }

        return this.interpolateArray(extended, a, 'a');
    }

    /**
     * Interpolate B sweep data (fallback)
     */
    interpolateBSweep(b) {
        if (this.bSweepData.length === 0) {
            return { x: 0, y: 0, z: 0 };
        }
        return this.interpolateArray(this.bSweepData, b, 'b');
    }

    /**
     * Linear interpolation in sorted array (fallback)
     */
    interpolateArray(data, value, key) {
        if (data.length === 0) {
            return { x: 0, y: 0, z: 0 };
        }

        let lower = null;
        let upper = null;

        for (let i = 0; i < data.length; i++) {
            if (data[i][key] <= value) lower = data[i];
            if (data[i][key] >= value && upper === null) upper = data[i];
        }

        if (!lower) lower = data[0];
        if (!upper) upper = data[data.length - 1];

        if (lower === upper || Math.abs(upper[key] - lower[key]) < 0.001) {
            return { x: lower.errorX, y: lower.errorY, z: lower.errorZ };
        }

        const t = (value - lower[key]) / (upper[key] - lower[key]);
        return {
            x: lower.errorX + t * (upper.errorX - lower.errorX),
            y: lower.errorY + t * (upper.errorY - lower.errorY),
            z: lower.errorZ + t * (upper.errorZ - lower.errorZ)
        };
    }

    // ========== Residual Calculation ==========

    /**
     * Get residual error (measured - fitted) at given A/B angles
     * This shows how much error remains after calibration correction
     * @param {number} a - A angle in degrees
     * @param {number} b - B angle in degrees
     * @returns {Object} {x, y, z} residual errors
     */
    getResidual(a, b) {
        if (!this.loaded) {
            return { x: 0, y: 0, z: 0 };
        }

        // Normalize A to 0-360 range
        a = ((a % 360) + 360) % 360;

        // Get fitted correction at this point
        const fitted = this.getCorrection(a, b);

        // Get interpolated raw measurement at this point
        const raw = this.getRawInterpolated(a, b);

        // Residual = raw - fitted (what remains after correction)
        return {
            x: raw.x - fitted.x,
            y: raw.y - fitted.y,
            z: raw.z - fitted.z
        };
    }

    /**
     * Get raw measurement interpolated for given A/B angles
     * Uses linear interpolation between measured points
     */
    getRawInterpolated(a, b) {
        // Get A correction from raw data (linear interpolation)
        const aRaw = this.interpolateASweep(a);
        const bRaw = this.interpolateBSweep(b);
        const baseline = this.getBaseline();

        // Additive model for raw data
        return {
            x: aRaw.x + bRaw.x - baseline.x,
            y: aRaw.y + bRaw.y - baseline.y,
            z: aRaw.z + bRaw.z - baseline.z
        };
    }

    // ========== Statistics and Data Access ==========

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
     * Get A sweep data for visualisation (raw measured points)
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
     * Get B sweep data for visualisation (raw measured points)
     */
    getBSweepData() {
        return this.bSweepData.map(p => ({
            angle: p.b,
            errorX: p.errorX,
            errorY: p.errorY,
            errorZ: p.errorZ
        }));
    }

    /**
     * Get fitted A sweep curve for visualisation
     * Returns points at regular intervals for smooth curve display
     */
    getASweepFitted(step = 5) {
        if (!this.aCoeffs) return this.getASweepData();

        const points = [];
        for (let a = 0; a <= 360; a += step) {
            points.push({
                angle: a,
                errorX: this.evaluateFourier(this.aCoeffs.x, a, true),
                errorY: this.evaluateFourier(this.aCoeffs.y, a, true),
                errorZ: this.evaluateFourier(this.aCoeffs.z, a, true)
            });
        }
        return points;
    }

    /**
     * Get fitted B sweep curve for visualisation
     * Returns points at regular intervals for smooth curve display
     */
    getBSweepFitted(step = 5) {
        if (!this.bCoeffs) return this.getBSweepData();

        const points = [];
        for (let b = -90; b <= 90; b += step) {
            points.push({
                angle: b,
                errorX: this.evaluateFourier(this.bCoeffs.x, b, false),
                errorY: this.evaluateFourier(this.bCoeffs.y, b, false),
                errorZ: this.evaluateFourier(this.bCoeffs.z, b, false)
            });
        }
        return points;
    }

    /**
     * Get Fourier coefficients for analysis/debugging
     */
    getCoefficients() {
        return {
            a: this.aCoeffs,
            b: this.bCoeffs,
            aHarmonics: this.aHarmonics,
            bHarmonics: this.bHarmonics
        };
    }
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CalibrationCorrector };
}
