/**
 * Step 5: Z-axis calibration
 * Determines Z0 (nozzle touching bed) using paper test method
 *
 * Since the printer homes to Z_MAX, we need to find where Z=0 actually is.
 * The user jogs down until the paper test passes, then we calculate the
 * new Z_MAX value and save it to EEPROM.
 */

class StepZAxis {
    constructor(app) {
        this.app = app;
        this.zAtHome = null;        // Z position after homing (the current Z_MAX)
        this.zAtBed = null;         // Z position when user confirms Z0
        this.skipped = false;
        this.needsHoming = false;   // Set true when restarting calibration
    }

    /**
     * Set up event listeners for this step
     */
    setup() {
        document.getElementById('confirmZPosition').addEventListener('click', () => this.confirmPosition());
        document.getElementById('skipZAxis').addEventListener('click', () => this.skip());

        // Set up Z jog buttons
        document.querySelectorAll('.z-jog').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleZJog(e));
        });
    }

    /**
     * Handle Z jog button click
     */
    async handleZJog(e) {
        const btn = e.currentTarget;
        const amount = parseFloat(btn.dataset.amount);

        if (isNaN(amount)) return;

        btn.disabled = true;
        try {
            // Use slower speed for fine movements
            const speed = Math.abs(amount) <= 0.1 ? 300 : 1800;
            await this.app.printer.moveRelative({ z: amount }, speed);
        } catch (error) {
            console.error('Z move error:', error);
        }
        btn.disabled = false;
    }

    /**
     * Called when entering this step
     */
    async enter() {
        // Reset state
        this.skipped = false;
        this.zAtBed = null;
        document.getElementById('zAxisStatus').classList.add('hidden');

        try {
            // Only home if restarting calibration (not on first pass after prepare)
            if (this.needsHoming) {
                document.getElementById('confirmZPosition').disabled = true;
                document.getElementById('confirmZPosition').textContent = 'Homing Z...';
                await this.app.printer.sendCommandAndWait('G28 Z', 60000);
                // Ensure IK is disabled after homing
                await this.app.printer.sendCommandAndWait('G49', 3000);

                document.getElementById('confirmZPosition').textContent = 'Moving down...';
                await this.app.printer.sendCommandAndWait('G91', 5000); // Relative mode
                await this.app.printer.sendCommandAndWait('G0 Z-50 F1800', 30000);
                await this.app.printer.sendCommandAndWait('G90', 5000); // Back to absolute

                this.needsHoming = false; // Reset flag
            }

            // Get fresh position
            const pos = await this.app.printer.requestPosition();
            this.zAtHome = pos.z;
            this.updateZDisplay(pos.z);

            document.getElementById('confirmZPosition').textContent = 'Confirm Z0';
            document.getElementById('confirmZPosition').disabled = false;
        } catch (error) {
            console.error('Z homing error:', error);
            document.getElementById('confirmZPosition').textContent = 'Confirm Z0';
            document.getElementById('confirmZPosition').disabled = false;
            this.needsHoming = false;
            this.updateZDisplay(0);
        }
    }

    /**
     * Update the Z position display
     */
    updateZDisplay(z) {
        const display = document.getElementById('zAxisDisplay');
        if (display) {
            display.textContent = z.toFixed(2);
        }
    }

    /**
     * Confirm current position as Z0
     */
    async confirmPosition() {
        // Prevent double-confirm
        if (this.zAtBed !== null) return;

        try {
            // Get the current Z position
            const pos = await this.app.printer.requestPosition();
            this.zAtBed = pos.z;

            // Show success status
            document.getElementById('zRecordedValue').textContent = this.zAtBed.toFixed(2);
            document.getElementById('zAxisStatus').classList.remove('hidden');

            // Move Z up 50mm for safety (away from bed)
            await this.app.printer.moveRelative({ z: 50 }, 1800);

            // Enable next button and auto-advance to next step
            document.getElementById('nextBtn').disabled = false;
            this.app.nextStep();

        } catch (error) {
            console.error('Error confirming Z position:', error);
            alert('Error reading position. Please try again.');
        }
    }

    /**
     * Skip Z calibration
     */
    skip() {
        this.skipped = true;
        this.zAtBed = null;
        this.app.nextStep();
    }

    /**
     * Get the recorded Z position at bed
     * @returns {number|null} Z position or null if skipped
     */
    getZAtBed() {
        return this.skipped ? null : this.zAtBed;
    }

    /**
     * Check if this step was skipped
     * @returns {boolean}
     */
    wasSkipped() {
        return this.skipped;
    }
}
