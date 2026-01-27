/**
 * Printer Setup Tool for Rep5x
 * Main application controller
 */

class PrinterSetupApp {
    constructor() {
        this.testMode = false;
        this.position = { c: 0, b: 0, z: 0 };

        // Step sizes for keyboard control (1-4 keys select these)
        this.zStepSizes = [0.05, 0.1, 1, 10];      // mm
        this.rotationStepSizes = [0.1, 1, 10];     // degrees
        this.currentZStepIndex = 1;                // Default: 0.1mm
        this.currentRotationStepIndex = 1;         // Default: 1°

        // Printer interface (reused from lc-lb-measure)
        this.printer = new PrinterInterface();

        // Step controllers
        this.stepConnect = new StepConnect(this);
        this.stepPrepare = new StepPrepare(this);
        this.stepDirectionCheck = new StepDirectionCheck(this);
        this.stepCAxis = new StepCAxis(this);
        this.stepBAxis = new StepBAxis(this);
        this.stepZAxis = new StepZAxis(this);
        this.stepApply = new StepApply(this);

        // Order: Connect -> Prepare -> Direction Check -> C-axis -> B-axis -> Z-axis -> Apply
        this.steps = [this.stepConnect, this.stepPrepare, this.stepDirectionCheck, this.stepCAxis, this.stepBAxis, this.stepZAxis, this.stepApply];

        // Wizard framework for step navigation
        this.wizard = new WizardFramework({
            totalSteps: 7,
            stepIdPrefix: 'step-',
            zeroIndexed: true,
            getNextButtonText: () => 'Next',
            onStepChange: (newStep) => {
                this.steps[newStep].enter();
                this.updateStepSizeIndicator();
                this.updateSkipToEndButton();
            }
        });
    }

    /**
     * Initialise the application
     */
    init() {
        // Set up printer callbacks
        this.printer.onPositionUpdate = (pos) => this.updatePositionDisplay(pos);
        this.printer.onConnectionChange = (connected) => this.stepConnect.updateConnectionStatus(connected);
        this.printer.onLog = (msg) => console.log(msg);

        // Set up step event listeners
        this.steps.forEach(step => step.setup());

        // Set up shared event listeners
        this.setupEventListeners();

        // Initialise wizard (handles initial step display)
        this.wizard.init();
    }

    /**
     * Set up shared event listeners
     */
    setupEventListeners() {
        // Note: Navigation buttons handled by WizardFramework
        document.getElementById('skipToEndBtn').addEventListener('click', () => this.skipToEnd());

        // Jog buttons (shared between B and C axis steps)
        document.querySelectorAll('.jog-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleJogButton(e));
        });

        // Keyboard controls for arrow keys and emergency stop
        document.addEventListener('keydown', (e) => this.handleKeyboardJog(e));
    }

    /**
     * Skip to end (Apply step) - skips remaining axis calibrations
     */
    skipToEnd() {
        // Mark remaining axes as skipped with dummy values
        if (this.currentStep <= 3) {
            // Skipping from C-axis or earlier
            this.stepCAxis.measurements.recorded = { 0: 0, 360: 360 };
        }
        if (this.currentStep <= 4) {
            // Skipping from B-axis or earlier
            this.stepBAxis.measurements.recorded = { 0: 0, 90: 90 };
        }
        if (this.currentStep <= 5) {
            // Skipping from Z-axis or earlier
            this.stepZAxis.skipped = true;
        }
        // Go to Apply step (step 6)
        this.goToStep(6);
    }

    /**
     * Emergency stop - immediately halt all movement
     */
    async emergencyStop() {
        try {
            await this.printer.sendCommand('M410');
            await this.printer.sendCommand('M112');
            console.error('EMERGENCY STOP SENT');
        } catch (error) {
            console.error('Emergency stop error:', error.message);
        }
    }

    /**
     * Handle keyboard controls
     * Spacebar: Emergency stop (always active)
     * Enter: Confirm position (during calibration steps)
     * C-axis (step 3): Left/Right arrows for movement, 1-3 for step size
     * B-axis (step 4): Left/Right arrows for movement (left=+, right=-), 1-3 for step size
     * Z-axis (step 5): Page Up/Down for movement, 1-4 for step size
     */
    async handleKeyboardJog(e) {
        // Don't respond if user is typing in an input field
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        // Spacebar = emergency stop (always active, even outside calibration steps)
        if (e.key === ' ') {
            e.preventDefault();
            this.emergencyStop();
            return;
        }

        // Enter = confirm position (during calibration steps)
        if (e.key === 'Enter') {
            e.preventDefault();
            if (this.currentStep === 3) {
                // C-axis: click confirm button
                document.getElementById('confirmCPosition')?.click();
            } else if (this.currentStep === 4) {
                // B-axis: click confirm button
                document.getElementById('confirmBPosition')?.click();
            } else if (this.currentStep === 5) {
                // Z-axis: click confirm button
                document.getElementById('confirmZPosition')?.click();
            }
            return;
        }

        // Only respond to other keys during calibration steps (3=C-axis, 4=B-axis, 5=Z-axis)
        if (this.currentStep < 3 || this.currentStep > 5) return;

        const isZAxis = this.currentStep === 5;

        // Handle number keys for step size selection
        if (e.key >= '1' && e.key <= '4') {
            e.preventDefault();
            const index = parseInt(e.key) - 1;

            if (isZAxis) {
                // Z-axis: 1=0.05mm, 2=0.1mm, 3=1mm, 4=10mm
                if (index < this.zStepSizes.length) {
                    this.currentZStepIndex = index;
                    this.showStepSizeIndicator('z', this.zStepSizes[index]);
                }
            } else {
                // B/C-axis: 1=0.1°, 2=1°, 3=10°
                if (index < this.rotationStepSizes.length) {
                    this.currentRotationStepIndex = index;
                    this.showStepSizeIndicator('rotation', this.rotationStepSizes[index]);
                }
            }
            return;
        }

        // Determine axis and movement direction
        let axis;
        let direction = 0;

        if (isZAxis) {
            // Z-axis: Page Up/Down
            axis = 'z';
            if (e.key === 'PageUp') direction = 1;
            else if (e.key === 'PageDown') direction = -1;
            else return;
        } else if (this.currentStep === 3) {
            // C-axis: Left/Right arrows
            axis = 'c';
            if (e.key === 'ArrowLeft') direction = 1;
            else if (e.key === 'ArrowRight') direction = -1;
            else return;
        } else {
            // B-axis (step 4): Left/Right arrows
            axis = 'b';
            if (e.key === 'ArrowRight') direction = 1;
            else if (e.key === 'ArrowLeft') direction = -1;
            else return;
        }

        e.preventDefault();

        // Get step size based on current selection
        const stepSize = isZAxis
            ? this.zStepSizes[this.currentZStepIndex]
            : this.rotationStepSizes[this.currentRotationStepIndex];

        const amount = direction * stepSize;

        try {
            // Use slower speed for fine Z movements
            const speed = (axis === 'z' && stepSize <= 0.1) ? 300 : 1800;
            await this.printer.moveRelative({ [axis]: amount }, speed);
        } catch (error) {
            console.error('Keyboard move error:', error);
        }
    }

    /**
     * Show indicator of the selected step size and update UI
     */
    showStepSizeIndicator(type, size) {
        const unit = type === 'z' ? 'mm' : '°';
        console.log(`Step size: ${size}${unit}`);

        // Update visual indicator in UI based on current step
        let indicatorId;
        if (type === 'z') {
            indicatorId = 'zStepIndicator';
        } else if (this.currentStep === 3) {
            indicatorId = 'cStepIndicator';
        } else {
            indicatorId = 'rotationStepIndicator';
        }

        const indicator = document.getElementById(indicatorId);
        if (indicator) {
            indicator.textContent = `Step: ${size}${unit}`;
        }

        // Highlight the selected jog button
        this.highlightSelectedJogButton(type, size);
    }

    /**
     * Highlight the jog button matching the selected step size
     */
    highlightSelectedJogButton(type, size) {
        // Determine which buttons to check based on current step
        let selector;
        if (this.currentStep === 5) {
            selector = '.z-jog';
        } else if (this.currentStep === 3) {
            selector = '#step-3 .jog-btn';
        } else if (this.currentStep === 4) {
            selector = '#step-4 .jog-btn';
        } else {
            return;
        }

        // Remove selected class from all buttons in this step
        document.querySelectorAll(selector).forEach(btn => {
            btn.classList.remove('selected');
        });

        // Add selected class to buttons matching the step size
        document.querySelectorAll(selector).forEach(btn => {
            const amount = Math.abs(parseFloat(btn.dataset.amount));
            if (Math.abs(amount - size) < 0.001) {
                btn.classList.add('selected');
            }
        });
    }

    /**
     * Update step size indicator for current step
     */
    updateStepSizeIndicator() {
        if (this.currentStep === 5) {
            // Z-axis
            const size = this.zStepSizes[this.currentZStepIndex];
            this.showStepSizeIndicator('z', size);
        } else if (this.currentStep === 3) {
            // C-axis
            const size = this.rotationStepSizes[this.currentRotationStepIndex];
            this.showStepSizeIndicator('c', size);
        } else if (this.currentStep === 4) {
            // B-axis
            const size = this.rotationStepSizes[this.currentRotationStepIndex];
            this.showStepSizeIndicator('rotation', size);
        }
    }

    /**
     * Handle jog button click
     */
    async handleJogButton(e) {
        const btn = e.currentTarget;
        const axis = btn.dataset.axis;
        const amount = parseFloat(btn.dataset.amount);

        if (!axis || isNaN(amount)) return;

        // Update the selected step size based on the clicked button
        const absAmount = Math.abs(amount);
        if (axis.toLowerCase() === 'z') {
            const index = this.zStepSizes.indexOf(absAmount);
            if (index !== -1) {
                this.currentZStepIndex = index;
                this.showStepSizeIndicator('z', absAmount);
            }
        } else {
            const index = this.rotationStepSizes.indexOf(absAmount);
            if (index !== -1) {
                this.currentRotationStepIndex = index;
                const type = this.currentStep === 3 ? 'c' : 'rotation';
                this.showStepSizeIndicator(type, absAmount);
            }
        }

        btn.disabled = true;
        try {
            await this.printer.moveRelative({ [axis.toLowerCase()]: amount }, 1800);
        } catch (error) {
            console.error('Move error:', error);
        }
        btn.disabled = false;
    }

    /**
     * Update position display
     */
    updatePositionDisplay(pos) {
        this.position = { c: pos.c, b: pos.b, z: pos.z };

        const zDisplay = document.getElementById('zAxisDisplay');
        if (zDisplay) zDisplay.textContent = pos.z.toFixed(2);

        const bDisplay = document.getElementById('bAxisDisplay');
        if (bDisplay) bDisplay.textContent = pos.b.toFixed(1);

        const cDisplay = document.getElementById('cAxisDisplay');
        if (cDisplay) cDisplay.textContent = pos.c.toFixed(1);
    }

    /**
     * Get current step index (delegate to wizard)
     * @returns {number} Current step index
     */
    get currentStep() {
        return this.wizard.getCurrentStep();
    }

    /**
     * Get total steps (delegate to wizard)
     * @returns {number} Total steps
     */
    get totalSteps() {
        return this.wizard.getTotalSteps();
    }

    /**
     * Navigate to next step (delegate to wizard)
     */
    nextStep() {
        this.wizard.nextStep();
    }

    /**
     * Navigate to previous step (delegate to wizard)
     */
    previousStep() {
        this.wizard.prevStep();
    }

    /**
     * Go directly to a specific step (delegate to wizard)
     * @param {number} stepIndex - Target step index
     */
    goToStep(stepIndex) {
        this.wizard.goToStep(stepIndex);
    }

    /**
     * Enable or disable the next button
     * @param {boolean} enabled - Whether to enable the button
     */
    setNextButtonEnabled(enabled) {
        this.wizard.setNextButtonEnabled(enabled);
    }

    /**
     * Show or hide the next button
     * @param {boolean} visible - Whether to show the button
     */
    setNextButtonVisible(visible) {
        this.wizard.setNextButtonVisible(visible);
    }

    /**
     * Update skip to end button visibility (tool-specific)
     */
    updateSkipToEndButton() {
        const skipToEndBtn = document.getElementById('skipToEndBtn');
        const currentStep = this.wizard.getCurrentStep();
        // Show "Skip to end" button on C-axis, B-axis and Z-axis steps (3, 4, 5)
        if (currentStep >= 3 && currentStep <= 5) {
            skipToEndBtn.classList.remove('hidden');
        } else {
            skipToEndBtn.classList.add('hidden');
        }
    }
}

// Initialise on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new PrinterSetupApp();
    window.app.init();
});
