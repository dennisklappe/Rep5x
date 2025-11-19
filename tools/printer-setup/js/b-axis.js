/**
 * Step 4: B-axis calibration
 * Measures two reference positions (0°, 90°) to calculate offset and steps/degree
 */

class StepBAxis {
    constructor(app) {
        this.app = app;
        this.measurements = {
            targets: [0, 90],
            currentIndex: 0,
            recorded: {}
        };
        this.needsHoming = false;   // Set true when restarting calibration
        this.directionChecked = false;   // Set by direction check step
    }

    /**
     * Set up event listeners for this step
     */
    setup() {
        document.getElementById('confirmBPosition').addEventListener('click', () => this.confirmPosition());
        document.getElementById('skipBAxis').addEventListener('click', () => this.skip());
    }

    /**
     * Skip B-axis calibration (use current values)
     */
    skip() {
        // Record dummy values that result in no correction
        // b0 = 0, b90 = 90 means: no offset needed, no steps correction needed
        this.measurements.recorded = { 0: 0, 90: 90 };
        this.app.nextStep();
    }

    /**
     * Called when entering this step
     */
    async enter() {
        document.getElementById('nextBtn').disabled = true;
        document.getElementById('confirmBPosition').disabled = true;
        this.measurements.currentIndex = 0;
        this.measurements.recorded = {};

        try {
            // Only home if restarting calibration (not on first pass after prepare)
            if (this.needsHoming) {
                document.getElementById('confirmBPosition').textContent = 'Homing B...';
                await this.app.printer.sendCommandAndWait('G28 B', 60000);
                this.needsHoming = false;
            }

            // Request current position to update display
            await this.app.printer.requestPosition();

            // Start calibration directly (direction check is now a separate step)
            await this.startCalibration();
        } catch (e) {
            console.error('B-axis enter error:', e);
            document.getElementById('confirmBPosition').textContent = 'Confirm position';
            document.getElementById('confirmBPosition').disabled = false;
            this.needsHoming = false;
        }
    }

    /**
     * Start calibration phase
     */
    async startCalibration() {
        // Move to first target position (B0)
        await this.moveToTarget(0);
        this.updateUI();

        document.getElementById('confirmBPosition').textContent = 'Confirm position';
        document.getElementById('confirmBPosition').disabled = false;
    }

    /**
     * Pre-move nozzle to target B position
     */
    async moveToTarget(target) {
        const btn = document.getElementById('confirmBPosition');
        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = `Moving to B${target}°...`;

        try {
            await this.app.printer.sendCommandAndWait(`G0 B${target} F1800`, 30000);
            await this.app.printer.sendCommandAndWait('M400', 30000);
            await this.app.printer.requestPosition();
        } catch (error) {
            console.error('Move error:', error);
        }

        btn.disabled = false;
        btn.textContent = originalText;
    }

    /**
     * Get recorded measurements for calculations
     */
    getRecorded() {
        return this.measurements.recorded;
    }

    /**
     * Update UI for current target
     */
    updateUI() {
        const targets = this.measurements.targets;
        const index = this.measurements.currentIndex;

        if (index >= targets.length) return;

        const target = targets[index];

        // Update visual guide
        this.updateVisualGuide(target);

        // Update target description
        const descriptions = {
            0: 'Nozzle pointing straight down',
            90: 'Nozzle pointing horizontal (left)'
        };
        document.getElementById('bTargetDescription').textContent = descriptions[target] || '';
        document.getElementById('bTargetAngle').textContent = `Target: B = ${target}°`;

        // Update measurement items
        document.querySelectorAll('#bMeasurements .measurement-item').forEach(item => {
            const itemTarget = parseInt(item.dataset.target);
            item.classList.remove('current', 'completed');

            if (this.measurements.recorded[itemTarget] !== undefined) {
                item.classList.add('completed');
            } else if (itemTarget === target) {
                item.classList.add('current');
            }
        });
    }

    /**
     * Update visual guide SVG
     */
    updateVisualGuide(target) {
        const guide = document.getElementById('bVisualGuide');
        let svg = '';

        if (target === 0) {
            // Pointing down
            svg = `<svg class="w-24 h-24 mx-auto" viewBox="0 0 100 100">
                <line x1="50" y1="20" x2="50" y2="70" stroke="#32D74B" stroke-width="4" stroke-linecap="round"/>
                <polygon points="50,80 42,65 58,65" fill="#32D74B"/>
                <line x1="20" y1="90" x2="80" y2="90" stroke="#666" stroke-width="2"/>
                <rect x="46" y="82" width="8" height="8" fill="none" stroke="#666" stroke-width="1"/>
            </svg>`;
        } else if (target === 90) {
            // Pointing left (B90 = counter-clockwise)
            svg = `<svg class="w-24 h-24 mx-auto" viewBox="0 0 100 100">
                <line x1="25" y1="50" x2="75" y2="50" stroke="#32D74B" stroke-width="4" stroke-linecap="round"/>
                <polygon points="15,50 30,42 30,58" fill="#32D74B"/>
                <line x1="20" y1="90" x2="80" y2="90" stroke="#666" stroke-width="2"/>
            </svg>`;
        }

        guide.innerHTML = svg;
    }

    /**
     * Confirm position for current target
     */
    async confirmPosition() {
        const targets = this.measurements.targets;
        const index = this.measurements.currentIndex;
        const target = targets[index];

        // Query fresh position from printer (M114) before recording
        const pos = await this.app.printer.requestPosition();

        // Record current firmware position for this physical target
        this.measurements.recorded[target] = pos.b;

        // Update display
        const displayEl = document.getElementById(`b-recorded-${target}`);
        if (displayEl) {
            displayEl.textContent = `${pos.b.toFixed(1)}°`;
        }

        // Mark as completed
        const item = document.querySelector(`#bMeasurements [data-target="${target}"]`);
        if (item) {
            item.classList.remove('current');
            item.classList.add('completed');
        }

        // Move to next
        this.measurements.currentIndex++;

        if (this.measurements.currentIndex >= targets.length) {
            // All B measurements done - move to physical B0 and reset coordinate
            const physicalZero = this.measurements.recorded[0];
            await this.moveToTarget(physicalZero);
            await this.app.printer.sendCommandAndWait('G92 B0', 5000);
            await this.app.printer.requestPosition();

            // Calibration complete, proceed to next step
            this.app.nextStep();
        } else {
            // Pre-move to next target position
            // For B90, move to expected physical 90° based on b0 measurement
            const nextTarget = targets[this.measurements.currentIndex];
            let moveTarget = nextTarget;
            if (nextTarget === 90 && this.measurements.recorded[0] !== undefined) {
                // Move to b0 + 90 so we're at expected physical 90°
                moveTarget = this.measurements.recorded[0] + 90;
            }
            await this.moveToTarget(moveTarget);
            this.updateUI();
        }
    }
}
