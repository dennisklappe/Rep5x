/**
 * Step 2: Direction Check
 * Verifies A and B axis motor directions before calibration
 */

class StepDirectionCheck {
    constructor(app) {
        this.app = app;
        this.aChecked = false;
        this.bChecked = false;
        this.currentAxis = null;  // 'a' or 'b'
    }

    /**
     * Set up event listeners for this step
     */
    setup() {
        // A-axis direction buttons
        document.getElementById('aDirectionStart')?.addEventListener('click', () => this.runDirectionTest('a'));
        document.getElementById('aDirectionSkip')?.addEventListener('click', () => this.skipAxis('a'));
        document.getElementById('aDirectionCorrect')?.addEventListener('click', () => this.directionConfirmed('a', true));
        document.getElementById('aDirectionWrong')?.addEventListener('click', () => this.directionConfirmed('a', false));
        document.getElementById('aDirectionRetry')?.addEventListener('click', () => this.retryDirectionCheck('a'));

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
        this.aChecked = false;
        this.bChecked = false;
        this.currentAxis = null;

        // Show A-axis prompt first
        this.showAxisPrompt('a');
    }

    /**
     * Show the prompt for an axis direction check
     */
    showAxisPrompt(axis) {
        this.currentAxis = axis;

        // Show/hide axis sections
        document.getElementById('aDirectionSection').classList.toggle('hidden', axis !== 'a');
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
        if (axis === 'a') {
            this.aChecked = true;
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
        this.aChecked = true;
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

            if (axis === 'a') {
                // A-axis: rotate full turn
                document.getElementById('aDirectionStatus').textContent = 'Rotating A0 → A360...';
                await this.app.printer.sendCommandAndWait('G0 A360 F1800', 60000);
            } else {
                // B-axis: tilt 90 degrees
                document.getElementById('bDirectionStatus').textContent = 'Tilting B0 → B90...';
                await this.app.printer.sendCommandAndWait('G0 B90 F1800', 30000);
            }
            await this.app.printer.sendCommandAndWait('M400', 30000);

            // Ask user about direction
            if (axis === 'a') {
                document.getElementById('aDirectionStatus').textContent = 'Did it rotate clockwise (viewed from above)?';
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
            if (axis === 'a') {
                this.aChecked = true;
            } else {
                this.bChecked = true;
            }

            // Show loading state
            const btn = document.getElementById(`${axis}DirectionCorrect`);
            btn.disabled = true;
            btn.textContent = 'Continuing...';
            document.getElementById(`${axis}DirectionWrong`).disabled = true;

            // Reset position coordinate (we're physically back at start after A360 full rotation)
            // For A-axis: platform did a full rotation, so it's back at physical start
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
            if (axis === 'a') {
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
        this.app.stepAAxis.directionChecked = true;
        this.app.stepBAxis.directionChecked = true;

        this.app.nextStep();
    }

    /**
     * Update status indicators showing which axes are checked
     */
    updateStatusIndicators() {
        const aStatus = document.getElementById('aCheckStatus');
        const bStatus = document.getElementById('bCheckStatus');

        if (aStatus) {
            aStatus.textContent = this.aChecked ? '✓' : '○';
            aStatus.classList.toggle('text-green-500', this.aChecked);
        }
        if (bStatus) {
            bStatus.textContent = this.bChecked ? '✓' : '○';
            bStatus.classList.toggle('text-green-500', this.bChecked);
        }
    }
}
