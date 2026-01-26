/**
 * Calibration Reverser for Rep5x G-code Viewer
 * Reverses calibration corrections to display original tool-tip positions
 * Works by reading Fourier coefficients from G-code headers
 */

class CalibrationReverser {
    constructor() {
        // Fourier coefficients for C-axis
        this.cCoeffs = null;  // { x: [...], y: [...], z: [...] }
        this.cHarmonics = 0;

        // Fourier coefficients for B-axis
        this.bCoeffs = null;  // { x: [...], y: [...], z: [...] }
        this.bHarmonics = 0;

        this.enabled = false;
    }

    /**
     * Parse calibration coefficients from G-code header comments
     * @param {string} gcode - Full G-code string
     * @returns {boolean} True if coefficients were found and loaded
     */
    parseFromGcode(gcode) {
        // Only check first 100 lines for headers
        const lines = gcode.split('\n').slice(0, 100);

        let foundCalibration = false;
        this.cCoeffs = { x: null, y: null, z: null };
        this.bCoeffs = { x: null, y: null, z: null };

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith(';')) continue;

            // Check for calibration enabled
            if (trimmed.includes('Calibration Correction: enabled')) {
                foundCalibration = true;
            }

            // Parse C-axis harmonics count
            const cHarmonicsMatch = trimmed.match(/C-axis coefficients.*?(\d+)\s*harmonics/i);
            if (cHarmonicsMatch) {
                this.cHarmonics = parseInt(cHarmonicsMatch[1]);
            }

            // Parse B-axis harmonics count
            const bHarmonicsMatch = trimmed.match(/B-axis coefficients.*?(\d+)\s*harmonics/i);
            if (bHarmonicsMatch) {
                this.bHarmonics = parseInt(bHarmonicsMatch[1]);
            }

            // Parse coefficient arrays
            const calibCXMatch = trimmed.match(/;\s*CalibCX:\s*([\d.,\-+e]+)/i);
            if (calibCXMatch) {
                this.cCoeffs.x = calibCXMatch[1].split(',').map(parseFloat);
            }

            const calibCYMatch = trimmed.match(/;\s*CalibCY:\s*([\d.,\-+e]+)/i);
            if (calibCYMatch) {
                this.cCoeffs.y = calibCYMatch[1].split(',').map(parseFloat);
            }

            const calibCZMatch = trimmed.match(/;\s*CalibCZ:\s*([\d.,\-+e]+)/i);
            if (calibCZMatch) {
                this.cCoeffs.z = calibCZMatch[1].split(',').map(parseFloat);
            }

            const calibBXMatch = trimmed.match(/;\s*CalibBX:\s*([\d.,\-+e]+)/i);
            if (calibBXMatch) {
                this.bCoeffs.x = calibBXMatch[1].split(',').map(parseFloat);
            }

            const calibBYMatch = trimmed.match(/;\s*CalibBY:\s*([\d.,\-+e]+)/i);
            if (calibBYMatch) {
                this.bCoeffs.y = calibBYMatch[1].split(',').map(parseFloat);
            }

            const calibBZMatch = trimmed.match(/;\s*CalibBZ:\s*([\d.,\-+e]+)/i);
            if (calibBZMatch) {
                this.bCoeffs.z = calibBZMatch[1].split(',').map(parseFloat);
            }
        }

        // Validate we have valid coefficients
        const hasCCoeffs = this.cCoeffs.x && this.cCoeffs.y && this.cCoeffs.z;
        const hasBCoeffs = this.bCoeffs.x && this.bCoeffs.y && this.bCoeffs.z;

        this.enabled = foundCalibration && (hasCCoeffs || hasBCoeffs);

        if (this.enabled) {
            console.log('Calibration reverser loaded:', {
                cHarmonics: this.cHarmonics,
                bHarmonics: this.bHarmonics,
                hasCCoeffs,
                hasBCoeffs
            });
        }

        return this.enabled;
    }

    /**
     * Evaluate Fourier series at a given angle
     * @param {Array} coeffs - Coefficients [a0, a1, b1, a2, b2, ...]
     * @param {number} angleDeg - Angle in degrees
     * @returns {number} Evaluated value
     */
    evaluateFourier(coeffs, angleDeg) {
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
     * Get calibration correction for given C/B angles
     * @param {number} c - C angle in degrees
     * @param {number} b - B angle in degrees
     * @returns {Object} {x, y, z} corrections
     */
    getCorrection(c, b) {
        if (!this.enabled) {
            return { x: 0, y: 0, z: 0 };
        }

        // Normalize C to 0-360
        c = ((c % 360) + 360) % 360;

        // Get C-axis correction
        const cCorr = {
            x: this.cCoeffs.x ? this.evaluateFourier(this.cCoeffs.x, c) : 0,
            y: this.cCoeffs.y ? this.evaluateFourier(this.cCoeffs.y, c) : 0,
            z: this.cCoeffs.z ? this.evaluateFourier(this.cCoeffs.z, c) : 0
        };

        // Get B-axis correction
        const bCorr = {
            x: this.bCoeffs.x ? this.evaluateFourier(this.bCoeffs.x, b) : 0,
            y: this.bCoeffs.y ? this.evaluateFourier(this.bCoeffs.y, b) : 0,
            z: this.bCoeffs.z ? this.evaluateFourier(this.bCoeffs.z, b) : 0
        };

        // Get baseline (C=0, B=0)
        const baseline = {
            x: this.cCoeffs.x ? this.evaluateFourier(this.cCoeffs.x, 0) : 0,
            y: this.cCoeffs.y ? this.evaluateFourier(this.cCoeffs.y, 0) : 0,
            z: this.cCoeffs.z ? this.evaluateFourier(this.cCoeffs.z, 0) : 0
        };

        // Combine using additive model
        return {
            x: cCorr.x + bCorr.x - baseline.x,
            y: cCorr.y + bCorr.y - baseline.y,
            z: cCorr.z + bCorr.z - baseline.z
        };
    }

    /**
     * Reverse calibration correction from a position
     * (Adds back the error that was subtracted during correction)
     * @param {number} x - X position (calibration-corrected)
     * @param {number} y - Y position (calibration-corrected)
     * @param {number} z - Z position (calibration-corrected)
     * @param {number} c - C angle
     * @param {number} b - B angle
     * @returns {Object} {x, y, z} original positions
     */
    reverseCalibration(x, y, z, c, b) {
        const correction = this.getCorrection(c, b);

        // The corrector SUBTRACTED the error, so we ADD it back
        return {
            x: x + correction.x,
            y: y + correction.y,
            z: z + correction.z,
            c: c,
            b: b
        };
    }

    /**
     * Process entire command array to reverse calibration
     * @param {Array} commands - Parsed G-code commands
     * @returns {Array} Commands with calibration reversed
     */
    reverseCommandArray(commands) {
        if (!this.enabled) return commands;

        const result = [];
        const chunkSize = 1000;

        // Track modal values
        let currentC = 0;
        let currentB = 0;
        let currentX = 0;
        let currentY = 0;
        let currentZ = 0;

        for (let i = 0; i < commands.length; i += chunkSize) {
            const chunk = commands.slice(i, i + chunkSize);
            const processedChunk = chunk.map(command => {
                // Handle G92 reset commands
                if (command.type === 'reset') {
                    if (command.c !== null) currentC = command.c;
                    return command;
                }

                if (command.hasMovement) {
                    // Update modal values
                    if (command.c !== null) currentC = command.c;
                    if (command.b !== null) currentB = command.b;
                    if (command.x !== null) currentX = command.x;
                    if (command.y !== null) currentY = command.y;
                    if (command.z !== null) currentZ = command.z;

                    const reversed = this.reverseCalibration(
                        currentX, currentY, currentZ,
                        currentC, currentB
                    );

                    return {
                        ...command,
                        x: command.x !== null ? reversed.x : null,
                        y: command.y !== null ? reversed.y : null,
                        z: command.z !== null ? reversed.z : null,
                        originalCalibrated: {
                            x: command.x,
                            y: command.y,
                            z: command.z
                        }
                    };
                }

                return command;
            });

            result.push(...processedChunk);
        }

        return result;
    }

    /**
     * Check if calibration reversal is available
     */
    isEnabled() {
        return this.enabled;
    }

    /**
     * Get summary of loaded calibration
     */
    getSummary() {
        if (!this.enabled) {
            return { enabled: false };
        }

        return {
            enabled: true,
            cHarmonics: this.cHarmonics,
            bHarmonics: this.bHarmonics,
            hasCCoeffs: !!(this.cCoeffs.x && this.cCoeffs.y && this.cCoeffs.z),
            hasBCoeffs: !!(this.bCoeffs.x && this.bCoeffs.y && this.bCoeffs.z)
        };
    }
}
