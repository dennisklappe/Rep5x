/**
 * Step 6: Apply settings
 * Calculates corrections and generates G-code
 */

class StepApply {
    constructor(app) {
        this.app = app;
        this.currentM92 = { c: 17.778, b: 17.778 }; // Default values
        this.currentM206 = { z: 0, c: 0, b: 0 }; // Default values (no offset)
        this.results = {
            zOffset: null,        // New Z home offset
            bOffset: null,
            bOffsetChange: null,
            bStepsCorrection: null,
            bNewSteps: null,
            cOffset: null,
            cOffsetChange: null,
            cStepsCorrection: null,
            cNewSteps: null
        };
    }

    /**
     * Set up event listeners for this step
     */
    setup() {
        document.getElementById('sendGcode').addEventListener('click', () => this.sendToprinter());
        document.getElementById('copyGcode').addEventListener('click', () => this.copyToClipboard());
        document.getElementById('restartZAxis').addEventListener('click', () => this.restartCalibration('z'));
        document.getElementById('restartBAxis').addEventListener('click', () => this.restartCalibration('b'));
        document.getElementById('restartCAxis').addEventListener('click', () => this.restartCalibration('c'));
    }

    /**
     * Restart calibration at Z, B or C axis step (skipping prepare)
     */
    async restartCalibration(axis) {
        // Hide the success status
        document.getElementById('applyStatus').classList.add('hidden');

        // Clear previous measurements based on axis
        if (axis === 'z') {
            this.app.stepZAxis.zAtBed = null;
            this.app.stepZAxis.skipped = false;
            document.getElementById('zAxisStatus').classList.add('hidden');
        }

        // Clear rotation measurements - they're invalid after saving new firmware values
        this.app.stepBAxis.measurements.recorded = {};
        this.app.stepBAxis.measurements.currentIndex = 0;
        this.app.stepCAxis.measurements.recorded = {};
        this.app.stepCAxis.measurements.currentIndex = 0;

        // Clear displayed values in UI
        document.getElementById('b-recorded-0').textContent = '--';
        document.getElementById('b-recorded-90').textContent = '--';
        document.getElementById('c-recorded-0').textContent = '--';
        document.getElementById('c-recorded-360').textContent = '--';

        // Set needsHoming flag - when restarting, all subsequent axes also need to re-home
        // because the coordinate system changes after applying new offsets
        // Step order: 3=C-axis, 4=B-axis, 5=Z-axis
        if (axis === 'c') {
            this.app.stepCAxis.needsHoming = true;
            this.app.stepBAxis.needsHoming = true;
            this.app.stepZAxis.needsHoming = true;
            this.app.goToStep(3);
        } else if (axis === 'b') {
            this.app.stepBAxis.needsHoming = true;
            this.app.stepZAxis.needsHoming = true;
            this.app.goToStep(4);
        } else {
            this.app.stepZAxis.needsHoming = true;
            this.app.goToStep(5);
        }
    }

    /**
     * Called when entering this step
     */
    async enter() {
        document.getElementById('nextBtn').style.display = 'none';
        document.getElementById('applyStatus').classList.add('hidden');

        // Query current M92 and M206 values from printer
        try {
            this.currentM92 = await this.app.printer.queryM92();
        } catch (e) {
            console.warn('Could not query M92, using defaults:', e);
        }

        try {
            this.currentM206 = await this.app.printer.queryM206();
        } catch (e) {
            console.warn('Could not query M206, using defaults:', e);
        }

        this.calculateResults();
        this.updateDisplay();
        this.updateGcodeOutput();
    }

    /**
     * Calculate offset and steps/degree corrections from measurements
     */
    calculateResults() {
        // Z-axis calculation
        // zAtBed is the Z position when nozzle touches bed
        // The correct offset formula accounts for existing offset:
        // new_offset = current_offset - zAtBed
        // This ensures bed is at Z=0 regardless of previous calibration state
        const zAtBed = this.app.stepZAxis.getZAtBed();
        if (zAtBed !== null) {
            const currentZOffset = this.currentM206.z || 0;
            const newZOffset = currentZOffset - zAtBed;
            // Only set if there's an actual change (more than 0.1mm difference)
            if (Math.abs(newZOffset - currentZOffset) > 0.1) {
                this.results.zOffset = newZOffset;
            } else {
                this.results.zOffset = null; // No change needed
            }
        } else {
            this.results.zOffset = null;
        }

        const bRecorded = this.app.stepBAxis.getRecorded();
        const cRecorded = this.app.stepCAxis.getRecorded();

        // B-axis calculations
        // b0 = firmware value when nozzle physically pointing straight down
        // b90 = firmware value when nozzle physically at 90° (horizontal left)
        const b0 = bRecorded[0];
        const b90 = bRecorded[90];

        // B steps/degree check: firmware moved (b90-b0) for 90 physical degrees
        const bFirmwareRange = b90 - b0;

        // If firmware shows 87° for 90° physical: each firmware degree = 90/87 physical degrees
        // This means M92 is too HIGH (too many steps = more physical movement per degree)
        // To fix: multiply M92 by 87/90 to REDUCE steps
        const bStepsCorrection = bFirmwareRange / 90;

        // For offset: convert b0 from old firmware degrees to physical degrees
        // 1 old firmware degree = 90/bFirmwareRange physical degrees
        const bOffsetCorrection = 90 / bFirmwareRange;

        if (Math.abs(bFirmwareRange - 90) > 0.5) {
            // Correction factor to multiply current steps/degree
            this.results.bStepsCorrection = bStepsCorrection;
            this.results.bNewSteps = this.currentM92.b * bStepsCorrection;
        } else {
            this.results.bStepsCorrection = null;
            this.results.bNewSteps = null;
        }

        // B offset: calculate the CHANGE needed from current offset
        // The correction is simply -b0 converted to physical degrees
        // (b0 is how far off the current zero position is)
        const currentBOffset = this.currentM206.b || 0;
        const bOffsetChange = -b0 * bOffsetCorrection;


        if (Math.abs(bOffsetChange) > 0.01) {
            // Store the change amount for display, and absolute value for G-code
            this.results.bOffsetChange = bOffsetChange;
            this.results.bOffset = currentBOffset + bOffsetChange;
        } else {
            this.results.bOffsetChange = null;
            this.results.bOffset = null;
        }

        // C-axis calculations
        // c0 = firmware value when nozzle physically facing forwards
        // c360 = firmware value after one full physical rotation
        const c0 = cRecorded[0];
        const c360 = cRecorded[360];

        // C steps/degree check: firmware moved (c360-c0) for 360 physical degrees
        const cFirmwareRange = c360 - c0;

        // Steps correction: if range > 360, M92 is too high, need to reduce
        const cStepsCorrection = cFirmwareRange / 360;

        // Offset correction: convert from old firmware degrees to physical
        const cOffsetCorrection = 360 / cFirmwareRange;

        if (Math.abs(cFirmwareRange - 360) > 1) {
            // Correction factor to multiply current steps/degree
            this.results.cStepsCorrection = cStepsCorrection;
            this.results.cNewSteps = this.currentM92.c * cStepsCorrection;
        } else {
            this.results.cStepsCorrection = null;
            this.results.cNewSteps = null;
        }

        // C offset: calculate the CHANGE needed from current offset
        const currentCOffset = this.currentM206.c || 0;
        const cOffsetChange = -c0 * cOffsetCorrection;


        if (Math.abs(cOffsetChange) > 0.01) {
            this.results.cOffsetChange = cOffsetChange;
            this.results.cOffset = currentCOffset + cOffsetChange;
        } else {
            this.results.cOffsetChange = null;
            this.results.cOffset = null;
        }

    }

    /**
     * Update the summary display
     */
    updateDisplay() {
        // Z-axis display - show the M206 Z offset value or "none needed"
        const zAtBed = this.app.stepZAxis.getZAtBed();
        let zDisplay = 'skipped';
        if (zAtBed !== null) {
            zDisplay = this.results.zOffset !== null
                ? `M206 Z${this.results.zOffset.toFixed(2)}`
                : 'none needed';
        }
        document.getElementById('calcZMax').textContent = zDisplay;

        // Show the CHANGE amount, not the absolute offset
        document.getElementById('calcBOffset').textContent = this.results.bOffsetChange !== null
            ? `${this.results.bOffsetChange > 0 ? '+' : ''}${this.results.bOffsetChange.toFixed(1)}°`
            : 'none needed';
        document.getElementById('calcBSteps').textContent = this.results.bNewSteps
            ? `${this.results.bNewSteps.toFixed(3)} steps/°`
            : 'none needed';

        document.getElementById('calcCOffset').textContent = this.results.cOffsetChange !== null
            ? `${this.results.cOffsetChange > 0 ? '+' : ''}${this.results.cOffsetChange.toFixed(1)}°`
            : 'none needed';
        document.getElementById('calcCSteps').textContent = this.results.cNewSteps
            ? `${this.results.cNewSteps.toFixed(3)} steps/°`
            : 'none needed';
    }

    /**
     * Generate and display G-code commands
     */
    updateGcodeOutput() {
        const lines = ['; Rep5x Printer Setup'];

        // Z-axis home offset
        if (this.results.zOffset !== null) {
            lines.push(`M206 Z${this.results.zOffset.toFixed(2)}    ; Z home offset`);
        }

        // B-axis offset
        if (this.results.bOffset !== null && Math.abs(this.results.bOffset) > 0.01) {
            lines.push(`M206 B${this.results.bOffset.toFixed(2)}    ; B-axis home offset`);
        }

        // C-axis offset
        if (this.results.cOffset !== null && Math.abs(this.results.cOffset) > 0.01) {
            lines.push(`M206 C${this.results.cOffset.toFixed(2)}    ; C-axis home offset`);
        }

        // Steps/degree corrections (M92)
        if (this.results.bNewSteps) {
            lines.push(`M92 B${this.results.bNewSteps.toFixed(3)}    ; B-axis steps/degree`);
        }

        if (this.results.cNewSteps) {
            lines.push(`M92 C${this.results.cNewSteps.toFixed(3)}    ; C-axis steps/degree`);
        }

        // Only add M500 if there are actual changes
        if (lines.length > 1) {
            lines.push('M500         ; Save to EEPROM');
        } else {
            lines.push('; No corrections needed!');
        }

        document.getElementById('gcodeOutput').textContent = lines.join('\n');
    }

    /**
     * Send G-code to printer
     */
    async sendToprinter() {
        try {
            let hasChanges = false;

            // Z-axis offset
            if (this.results.zOffset !== null) {
                await this.app.printer.sendCommandAndWait(`M206 Z${this.results.zOffset.toFixed(2)}`, 5000);
                hasChanges = true;
            }

            if (this.results.bOffset !== null && Math.abs(this.results.bOffset) > 0.01) {
                await this.app.printer.sendCommandAndWait(`M206 B${this.results.bOffset.toFixed(2)}`, 5000);
                hasChanges = true;
            }
            if (this.results.cOffset !== null && Math.abs(this.results.cOffset) > 0.01) {
                await this.app.printer.sendCommandAndWait(`M206 C${this.results.cOffset.toFixed(2)}`, 5000);
                hasChanges = true;
            }
            if (this.results.bNewSteps) {
                await this.app.printer.sendCommandAndWait(`M92 B${this.results.bNewSteps.toFixed(3)}`, 5000);
                hasChanges = true;
            }
            if (this.results.cNewSteps) {
                await this.app.printer.sendCommandAndWait(`M92 C${this.results.cNewSteps.toFixed(3)}`, 5000);
                hasChanges = true;
            }

            if (hasChanges) {
                await this.app.printer.sendCommandAndWait('M500', 5000);
            }

            document.getElementById('applyStatus').classList.remove('hidden');
        } catch (error) {
            alert(`Error sending commands: ${error.message}`);
        }
    }

    /**
     * Copy G-code to clipboard
     */
    async copyToClipboard() {
        const gcode = document.getElementById('gcodeOutput').textContent;

        try {
            await navigator.clipboard.writeText(gcode);
            alert('G-code copied to clipboard!');
        } catch (error) {
            prompt('Copy this G-code:', gcode);
        }
    }
}
