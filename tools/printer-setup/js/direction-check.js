/**
 * Step 2: Direction Check
 * Verifies C and B axis motor directions before calibration
 */

class StepDirectionCheck {
    constructor(app) {
        this.app = app;
        this.cChecked = false;
        this.bChecked = false;
        this.currentAxis = null;  // 'c' or 'b'
    }

    /**
     * Set up event listeners for this step
     */
    setup() {
        // C-axis direction buttons
        document.getElementById('cDirectionStart')?.addEventListener('click', () => this.runDirectionTest('c'));
        document.getElementById('cDirectionSkip')?.addEventListener('click', () => this.skipAxis('c'));
        document.getElementById('cDirectionCorrect')?.addEventListener('click', () => this.directionConfirmed('c', true));
        document.getElementById('cDirectionWrong')?.addEventListener('click', () => this.directionConfirmed('c', false));
        document.getElementById('cDirectionRetry')?.addEventListener('click', () => this.retryDirectionCheck('c'));

        // B-axis direction buttons
        document.getElementById('bDirectionStart')?.addEventListener('click', () => this.runDirectionTest('b'));
        document.getElementById('bDirectionSkip')?.addEventListener('click', () => this.skipAxis('b'));
        document.getElementById('bDirectionCorrect')?.addEventListener('click', () => this.directionConfirmed('b', true));
        document.getElementById('bDirectionWrong')?.addEventListener('click', () => this.directionConfirmed('b', false));
        document.getElementById('bDirectionRetry')?.addEventListener('click', () => this.retryDirectionCheck('b'));

        // Skip all button
        document.getElementById('skipDirectionCheck')?.addEventListener('click', () => this.skipAll());
    }

    /**
     * Called when entering this step
     */
    async enter() {
        document.getElementById('nextBtn').disabled = true;

        // Reset state
        this.cChecked = false;
        this.bChecked = false;
        this.currentAxis = null;

        // Show C-axis prompt first
        this.showAxisPrompt('c');
    }

    /**
     * Show the prompt for an axis direction check
     */
    showAxisPrompt(axis) {
        this.currentAxis = axis;

        // Show/hide axis sections
        document.getElementById('cDirectionSection').classList.toggle('hidden', axis !== 'c');
        document.getElementById('bDirectionSection').classList.toggle('hidden', axis !== 'b');

        // Reset UI for this axis
        document.getElementById(`${axis}DirectionPrompt`).classList.remove('hidden');
        document.getElementById(`${axis}DirectionTest`).classList.add('hidden');
        document.getElementById(`${axis}DirectionFix`).classList.add('hidden');

        // Update status indicator
        this.updateStatusIndicators();
    }

    /**
     * Skip direction check for a single axis
     */
    async skipAxis(axis) {
        if (axis === 'c') {
            this.cChecked = true;
            // Move to B-axis check
            this.showAxisPrompt('b');
        } else {
            this.bChecked = true;
            // Both done, proceed
            this.finishDirectionCheck();
        }
    }

    /**
     * Skip all direction checks
     */
    skipAll() {
        this.cChecked = true;
        this.bChecked = true;
        this.app.nextStep();
    }

    /**
     * Run the direction test for an axis
     */
    async runDirectionTest(axis) {
        this.currentAxis = axis;
        const Axis = axis.toUpperCase();

        // Hide prompt, show test UI
        document.getElementById(`${axis}DirectionPrompt`).classList.add('hidden');
        document.getElementById(`${axis}DirectionTest`).classList.remove('hidden');

        // Disable buttons during movement
        document.getElementById(`${axis}DirectionCorrect`).disabled = true;
        document.getElementById(`${axis}DirectionWrong`).disabled = true;

        try {
            // Set current position as reference
            document.getElementById(`${axis}DirectionStatus`).textContent = 'Starting direction test...';
            await this.app.printer.sendCommandAndWait(`G92 ${Axis}0`, 5000);

            if (axis === 'c') {
                // C-axis: rotate full turn
                document.getElementById('cDirectionStatus').textContent = 'Rotating C0 → C360...';
                await this.app.printer.sendCommandAndWait('G0 C360 F1800', 60000);
            } else {
                // B-axis: tilt 90 degrees
                document.getElementById('bDirectionStatus').textContent = 'Tilting B0 → B90...';
                await this.app.printer.sendCommandAndWait('G0 B90 F1800', 30000);
            }
            await this.app.printer.sendCommandAndWait('M400', 30000);

            // Ask user about direction
            if (axis === 'c') {
                document.getElementById('cDirectionStatus').textContent = 'Did it rotate counter-clockwise (viewed from above)?';
            } else {
                document.getElementById('bDirectionStatus').textContent = 'Did the nozzle tilt to the LEFT?';
            }
            document.getElementById(`${axis}DirectionCorrect`).disabled = false;
            document.getElementById(`${axis}DirectionWrong`).disabled = false;

        } catch (error) {
            console.error('Direction test error:', error);
            document.getElementById(`${axis}DirectionStatus`).textContent = 'Error: ' + error.message;
        }
    }

    /**
     * Handle direction confirmation
     */
    async directionConfirmed(axis, isCorrect) {
        const Axis = axis.toUpperCase();

        if (isCorrect) {
            // Direction is correct
            if (axis === 'c') {
                this.cChecked = true;
            } else {
                this.bChecked = true;
            }

            // Show loading state
            const btn = document.getElementById(`${axis}DirectionCorrect`);
            btn.disabled = true;
            btn.textContent = 'Continuing...';
            document.getElementById(`${axis}DirectionWrong`).disabled = true;

            // Reset position coordinate (we're physically back at start after C360 full rotation)
            // For C-axis: platform did a full rotation, so it's back at physical start
            // For B-axis: we need to move back to B0 first
            if (axis === 'b') {
                // Move B back to 0 before resetting coordinate
                document.getElementById('bDirectionStatus').textContent = 'Moving back to B0...';
                await this.app.printer.sendCommandAndWait('G0 B0 F1800', 30000);
                await this.app.printer.sendCommandAndWait('M400', 30000);
            }

            // Reset coordinate to 0
            await this.app.printer.sendCommandAndWait(`G92 ${Axis}0`, 5000);

            // Move to next axis or finish
            if (axis === 'c') {
                // Move to B-axis check
                this.showAxisPrompt('b');
            } else {
                // Both done
                this.finishDirectionCheck();
            }
        } else {
            // Direction is wrong, show fix instructions
            document.getElementById(`${axis}DirectionTest`).classList.add('hidden');
            document.getElementById(`${axis}DirectionFix`).classList.remove('hidden');
        }
    }

    /**
     * Retry direction check after fix
     */
    async retryDirectionCheck(axis) {
        const Axis = axis.toUpperCase();

        // Hide fix instructions
        document.getElementById(`${axis}DirectionFix`).classList.add('hidden');
        document.getElementById(`${axis}DirectionTest`).classList.remove('hidden');

        // Reset position and redo test
        document.getElementById(`${axis}DirectionStatus`).textContent = 'Preparing to retest...';
        await this.app.printer.sendCommandAndWait(`G92 ${Axis}0`, 5000);

        await this.runDirectionTest(axis);
    }

    /**
     * Finish direction check and proceed to next step
     */
    async finishDirectionCheck() {
        // Mark direction checks as done in the axis step controllers
        this.app.stepCAxis.directionChecked = true;
        this.app.stepBAxis.directionChecked = true;

        this.app.nextStep();
    }

    /**
     * Update status indicators showing which axes are checked
     */
    updateStatusIndicators() {
        const cStatus = document.getElementById('cCheckStatus');
        const bStatus = document.getElementById('bCheckStatus');

        if (cStatus) {
            cStatus.textContent = this.cChecked ? '✓' : '○';
            cStatus.classList.toggle('text-green-500', this.cChecked);
        }
        if (bStatus) {
            bStatus.textContent = this.bChecked ? '✓' : '○';
            bStatus.classList.toggle('text-green-500', this.bChecked);
        }
    }
}
