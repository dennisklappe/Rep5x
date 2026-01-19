/**
 * Calibration Corrector
 * Applies calibration corrections to XYZ based on C/B angles
 * Uses Fourier/trigonometric curve fitting for smooth, physically-motivated corrections
 *
 * Used by: Calibrator, G-code Corrector, G-code Viewer
 */

class CalibrationCorrector {
    constructor() {
        // Raw calibration data storage
        this.cSweepData = [];  // {c, errorX, errorY, errorZ} at B=0
        this.bSweepData = [];  // {b, errorX, errorY, errorZ} at C=0

        // Fourier coefficients for C-axis (periodic, 0-360°)
        // Format: { x: [a0, a1, b1, a2, b2, ...], y: [...], z: [...] }
        this.cCoeffs = null;
        this.cHarmonics = 3;  // Number of harmonics to fit

        // Trigonometric coefficients for B-axis (-90° to 90°)
        // Format: { x: [c0, c1, s1, c2, s2], y: [...], z: [...] }
        this.bCoeffs = null;
        this.bHarmonics = 2;  // Number of harmonics for B-axis

        // Metadata
        this.lc = 0;
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
        this.cSweepData = [];
        this.bSweepData = [];
        this.cCoeffs = null;
        this.bCoeffs = null;

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
                this.cSweepData.push(point);
            }
            if (m.c === 0) {
                this.bSweepData.push(point);
            }
        }

        // Sort by angle
        this.cSweepData.sort((a, b) => a.c - b.c);
        this.bSweepData.sort((a, b) => a.b - b.b);

        // Fit curves
        this.fitCurves();

        this.loaded = true;

        return {
            cSweepPoints: this.cSweepData.length,
            bSweepPoints: this.bSweepData.length
        };
    }

    /**
     * Fit Fourier/trigonometric curves to the calibration data
     */
    fitCurves() {
        // Fit C-axis (Fourier series, periodic)
        if (this.cSweepData.length >= 3) {
            this.cCoeffs = {
                x: this.fitFourierSeries(this.cSweepData, 'c', 'errorX', this.cHarmonics, true),
                y: this.fitFourierSeries(this.cSweepData, 'c', 'errorY', this.cHarmonics, true),
                z: this.fitFourierSeries(this.cSweepData, 'c', 'errorZ', this.cHarmonics, true)
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
     * @param {string} angleKey - Key for angle ('c' or 'b')
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
                ? (angle * Math.PI / 180)  // C-axis: degrees directly
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
     * Get correction for given C/B angles
     * Uses fitted curves and additive model
     * @param {number} c - C angle in degrees
     * @param {number} b - B angle in degrees
     * @returns {Object} {x, y, z} corrections to ADD to coordinates
     */
    getCorrection(c, b) {
        if (!this.loaded) {
            return { x: 0, y: 0, z: 0 };
        }

        // Normalize C to 0-360 range
        c = ((c % 360) + 360) % 360;

        // Get corrections from fitted curves
        const cCorrection = this.getCCorrectionFitted(c);
        const bCorrection = this.getBCorrectionFitted(b);

        // Get baseline (correction at C=0, B=0) to avoid double-counting
        const baseline = this.getBaselineFitted();

        return {
            x: cCorrection.x + bCorrection.x - baseline.x,
            y: cCorrection.y + bCorrection.y - baseline.y,
            z: cCorrection.z + bCorrection.z - baseline.z
        };
    }

    /**
     * Get C-axis correction using fitted Fourier curve
     */
    getCCorrectionFitted(c) {
        if (!this.cCoeffs) {
            return this.interpolateCSweep(c);  // Fallback to linear
        }

        return {
            x: this.evaluateFourier(this.cCoeffs.x, c, true),
            y: this.evaluateFourier(this.cCoeffs.y, c, true),
            z: this.evaluateFourier(this.cCoeffs.z, c, true)
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
     * Get baseline correction at C=0, B=0 using fitted curves
     */
    getBaselineFitted() {
        if (!this.cCoeffs || !this.bCoeffs) {
            return this.getBaseline();  // Fallback
        }

        // Evaluate both curves at 0°
        return {
            x: this.evaluateFourier(this.cCoeffs.x, 0, true),
            y: this.evaluateFourier(this.cCoeffs.y, 0, true),
            z: this.evaluateFourier(this.cCoeffs.z, 0, true)
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
     * Get baseline correction at C=0, B=0 (fallback)
     */
    getBaseline() {
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
     * Interpolate C sweep data (fallback)
     */
    interpolateCSweep(c) {
        if (this.cSweepData.length === 0) {
            return { x: 0, y: 0, z: 0 };
        }

        const extended = [...this.cSweepData];
        const first = this.cSweepData[0];
        if (first.c === 0) {
            extended.push({ ...first, c: 360 });
        }

        return this.interpolateArray(extended, c, 'c');
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
     * Get residual error (measured - fitted) at given C/B angles
     * This shows how much error remains after calibration correction
     * @param {number} c - C angle in degrees
     * @param {number} b - B angle in degrees
     * @returns {Object} {x, y, z} residual errors
     */
    getResidual(c, b) {
        if (!this.loaded) {
            return { x: 0, y: 0, z: 0 };
        }

        // Normalize C to 0-360 range
        c = ((c % 360) + 360) % 360;

        // Get fitted correction at this point
        const fitted = this.getCorrection(c, b);

        // Get interpolated raw measurement at this point
        const raw = this.getRawInterpolated(c, b);

        // Residual = raw - fitted (what remains after correction)
        return {
            x: raw.x - fitted.x,
            y: raw.y - fitted.y,
            z: raw.z - fitted.z
        };
    }

    /**
     * Get raw measurement interpolated for given C/B angles
     * Uses linear interpolation between measured points
     */
    getRawInterpolated(c, b) {
        // Get C correction from raw data (linear interpolation)
        const cRaw = this.interpolateCSweep(c);
        const bRaw = this.interpolateBSweep(b);
        const baseline = this.getBaseline();

        // Additive model for raw data
        return {
            x: cRaw.x + bRaw.x - baseline.x,
            y: cRaw.y + bRaw.y - baseline.y,
            z: cRaw.z + bRaw.z - baseline.z
        };
    }

    // ========== Statistics and Data Access ==========

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
     * Get C sweep data for visualisation (raw measured points)
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
     * Get fitted C sweep curve for visualisation
     * Returns points at regular intervals for smooth curve display
     */
    getCSweepFitted(step = 5) {
        if (!this.cCoeffs) return this.getCSweepData();

        const points = [];
        for (let c = 0; c <= 360; c += step) {
            points.push({
                angle: c,
                errorX: this.evaluateFourier(this.cCoeffs.x, c, true),
                errorY: this.evaluateFourier(this.cCoeffs.y, c, true),
                errorZ: this.evaluateFourier(this.cCoeffs.z, c, true)
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
            c: this.cCoeffs,
            b: this.bCoeffs,
            cHarmonics: this.cHarmonics,
            bHarmonics: this.bHarmonics
        };
    }
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CalibrationCorrector };
}
