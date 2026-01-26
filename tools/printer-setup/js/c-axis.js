/**
 * Step 3: C-axis calibration
 * Measures two reference positions (0°, 360°) to calculate offset and steps/degree
 */

class StepCAxis {
    constructor(app) {
        this.app = app;
        this.measurements = {
            targets: [0, 360],
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
        document.getElementById('confirmCPosition').addEventListener('click', () => this.confirmPosition());
        document.getElementById('skipCAxis').addEventListener('click', () => this.skip());
    }

    /**
     * Skip C-axis calibration (use current values)
     */
    skip() {
        // Record dummy values that result in no correction
        // c0 = 0, c360 = 360 means: no offset needed, no steps correction needed
        this.measurements.recorded = { 0: 0, 360: 360 };
        this.app.nextStep();
    }

    /**
     * Called when entering this step
     */
    async enter() {
        document.getElementById('nextBtn').disabled = true;
        document.getElementById('confirmCPosition').disabled = true;
        this.measurements.currentIndex = 0;
        this.measurements.recorded = {};

        try {
            // Only home if restarting calibration (not on first pass after prepare)
            if (this.needsHoming) {
                document.getElementById('confirmCPosition').textContent = 'Homing C...';
                await this.app.printer.sendCommandAndWait('G28 C', 60000);
                // Ensure IK is disabled after homing
                await this.app.printer.sendCommandAndWait('G49', 3000);
                this.needsHoming = false;
            }

            // Request current position to update display
            await this.app.printer.requestPosition();

            // Start calibration directly (direction check is now a separate step)
            await this.startCalibration();
        } catch (e) {
            console.error('C-axis enter error:', e);
            document.getElementById('confirmCPosition').textContent = 'Confirm position';
            document.getElementById('confirmCPosition').disabled = false;
            this.needsHoming = false;
        }
    }

    /**
     * Start calibration phase
     */
    async startCalibration() {
        // Move to first target position (A0)
        await this.moveToTarget(0);
        this.updateUI();

        document.getElementById('confirmCPosition').textContent = 'Confirm position';
        document.getElementById('confirmCPosition').disabled = false;
    }

    /**
     * Pre-move platform to target A position
     */
    async moveToTarget(target) {
        const btn = document.getElementById('confirmCPosition');
        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = `Moving to C${target}°...`;

        try {
            await this.app.printer.sendCommandAndWait(`G0 C${target} F1800`, 30000);
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
            0: 'Nozzle facing forwards',
            360: 'Nozzle facing forwards again'
        };
        document.getElementById('cTargetDescription').textContent = descriptions[target] || '';
        document.getElementById('cTargetAngle').textContent = `Target: C = ${target}°`;

        // Update measurement items
        document.querySelectorAll('#cMeasurements .measurement-item').forEach(item => {
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
        const guide = document.getElementById('cVisualGuide');
        const rotation = target;

        const svg = `<svg class="w-24 h-24 mx-auto" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="35" fill="none" stroke="#ddd" stroke-width="2"/>
            <g transform="rotate(${rotation} 50 50)">
                <line x1="50" y1="50" x2="50" y2="15" stroke="#32D74B" stroke-width="4" stroke-linecap="round"/>
                <circle cx="50" cy="12" r="4" fill="#EF4444"/>
            </g>
            <circle cx="50" cy="50" r="6" fill="#32D74B"/>
            ${target === 0 ? '<text x="50" y="8" text-anchor="middle" font-size="8" fill="#666">MARK</text>' : ''}
        </svg>`;

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
        this.measurements.recorded[target] = pos.c;

        // Update display
        const displayEl = document.getElementById(`c-recorded-${target}`);
        if (displayEl) {
            displayEl.textContent = `${pos.c.toFixed(1)}°`;
        }

        // Mark as completed
        const item = document.querySelector(`#cMeasurements [data-target="${target}"]`);
        if (item) {
            item.classList.remove('current');
            item.classList.add('completed');
        }

        // Move to next
        this.measurements.currentIndex++;

        if (this.measurements.currentIndex >= targets.length) {
            // All C measurements done
            // After C360 confirmation, we're physically at C0 again, so reset coordinate
            await this.app.printer.sendCommandAndWait('G92 C0', 5000);
            await this.app.printer.requestPosition();

            // Calibration complete, proceed to next step
            this.app.nextStep();
        } else {
            // Pre-move to next target position
            // For C360, move to expected physical 360° based on c0 measurement
            const nextTarget = targets[this.measurements.currentIndex];
            let moveTarget = nextTarget;
            if (nextTarget === 360 && this.measurements.recorded[0] !== undefined) {
                // Move to a0 + 360 so we're at expected physical 360°
                moveTarget = this.measurements.recorded[0] + 360;
            }
            await this.moveToTarget(moveTarget);
            this.updateUI();
        }
    }
}
