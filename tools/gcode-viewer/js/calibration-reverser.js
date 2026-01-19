/**
 * Calibration Reverser for Rep5x G-code Viewer
 * Reverses calibration corrections to display original tool-tip positions
 * Works by reading Fourier coefficients from G-code headers
 */

class CalibrationReverser {
    constructor() {
        // Fourier coefficients for A-axis
        this.aCoeffs = null;  // { x: [...], y: [...], z: [...] }
        this.aHarmonics = 0;

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
        this.aCoeffs = { x: null, y: null, z: null };
        this.bCoeffs = { x: null, y: null, z: null };

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith(';')) continue;

            // Check for calibration enabled
            if (trimmed.includes('Calibration Correction: enabled')) {
                foundCalibration = true;
            }

            // Parse A-axis harmonics count
            const aHarmonicsMatch = trimmed.match(/A-axis coefficients.*?(\d+)\s*harmonics/i);
            if (aHarmonicsMatch) {
                this.aHarmonics = parseInt(aHarmonicsMatch[1]);
            }

            // Parse B-axis harmonics count
            const bHarmonicsMatch = trimmed.match(/B-axis coefficients.*?(\d+)\s*harmonics/i);
            if (bHarmonicsMatch) {
                this.bHarmonics = parseInt(bHarmonicsMatch[1]);
            }

            // Parse coefficient arrays
            const calibAXMatch = trimmed.match(/;\s*CalibAX:\s*([\d.,\-+e]+)/i);
            if (calibAXMatch) {
                this.aCoeffs.x = calibAXMatch[1].split(',').map(parseFloat);
            }

            const calibAYMatch = trimmed.match(/;\s*CalibAY:\s*([\d.,\-+e]+)/i);
            if (calibAYMatch) {
                this.aCoeffs.y = calibAYMatch[1].split(',').map(parseFloat);
            }

            const calibAZMatch = trimmed.match(/;\s*CalibAZ:\s*([\d.,\-+e]+)/i);
            if (calibAZMatch) {
                this.aCoeffs.z = calibAZMatch[1].split(',').map(parseFloat);
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
        const hasACoeffs = this.aCoeffs.x && this.aCoeffs.y && this.aCoeffs.z;
        const hasBCoeffs = this.bCoeffs.x && this.bCoeffs.y && this.bCoeffs.z;

        this.enabled = foundCalibration && (hasACoeffs || hasBCoeffs);

        if (this.enabled) {
            console.log('Calibration reverser loaded:', {
                aHarmonics: this.aHarmonics,
                bHarmonics: this.bHarmonics,
                hasACoeffs,
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
     * Get calibration correction for given A/B angles
     * @param {number} a - A angle in degrees
     * @param {number} b - B angle in degrees
     * @returns {Object} {x, y, z} corrections
     */
    getCorrection(a, b) {
        if (!this.enabled) {
            return { x: 0, y: 0, z: 0 };
        }

        // Normalize A to 0-360
        a = ((a % 360) + 360) % 360;

        // Get A-axis correction
        const aCorr = {
            x: this.aCoeffs.x ? this.evaluateFourier(this.aCoeffs.x, a) : 0,
            y: this.aCoeffs.y ? this.evaluateFourier(this.aCoeffs.y, a) : 0,
            z: this.aCoeffs.z ? this.evaluateFourier(this.aCoeffs.z, a) : 0
        };

        // Get B-axis correction
        const bCorr = {
            x: this.bCoeffs.x ? this.evaluateFourier(this.bCoeffs.x, b) : 0,
            y: this.bCoeffs.y ? this.evaluateFourier(this.bCoeffs.y, b) : 0,
            z: this.bCoeffs.z ? this.evaluateFourier(this.bCoeffs.z, b) : 0
        };

        // Get baseline (A=0, B=0)
        const baseline = {
            x: this.aCoeffs.x ? this.evaluateFourier(this.aCoeffs.x, 0) : 0,
            y: this.aCoeffs.y ? this.evaluateFourier(this.aCoeffs.y, 0) : 0,
            z: this.aCoeffs.z ? this.evaluateFourier(this.aCoeffs.z, 0) : 0
        };

        // Combine using additive model
        return {
            x: aCorr.x + bCorr.x - baseline.x,
            y: aCorr.y + bCorr.y - baseline.y,
            z: aCorr.z + bCorr.z - baseline.z
        };
    }

    /**
     * Reverse calibration correction from a position
     * (Adds back the error that was subtracted during correction)
     * @param {number} x - X position (calibration-corrected)
     * @param {number} y - Y position (calibration-corrected)
     * @param {number} z - Z position (calibration-corrected)
     * @param {number} a - A angle
     * @param {number} b - B angle
     * @returns {Object} {x, y, z} original positions
     */
    reverseCalibration(x, y, z, a, b) {
        const correction = this.getCorrection(a, b);

        // The corrector SUBTRACTED the error, so we ADD it back
        return {
            x: x + correction.x,
            y: y + correction.y,
            z: z + correction.z,
            a: a,
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
        let currentA = 0;
        let currentB = 0;
        let currentX = 0;
        let currentY = 0;
        let currentZ = 0;

        for (let i = 0; i < commands.length; i += chunkSize) {
            const chunk = commands.slice(i, i + chunkSize);
            const processedChunk = chunk.map(command => {
                // Handle G92 reset commands
                if (command.type === 'reset') {
                    if (command.a !== null) currentA = command.a;
                    return command;
                }

                if (command.hasMovement) {
                    // Update modal values
                    if (command.a !== null) currentA = command.a;
                    if (command.b !== null) currentB = command.b;
                    if (command.x !== null) currentX = command.x;
                    if (command.y !== null) currentY = command.y;
                    if (command.z !== null) currentZ = command.z;

                    const reversed = this.reverseCalibration(
                        currentX, currentY, currentZ,
                        currentA, currentB
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
            aHarmonics: this.aHarmonics,
            bHarmonics: this.bHarmonics,
            hasACoeffs: !!(this.aCoeffs.x && this.aCoeffs.y && this.aCoeffs.z),
            hasBCoeffs: !!(this.bCoeffs.x && this.bCoeffs.y && this.bCoeffs.z)
        };
    }
}
