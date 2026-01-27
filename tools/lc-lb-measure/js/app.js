/**
 * LC/LB Measure Tool for Rep5x
 * Main application controller
 */

class LcLbMeasureApp {
    constructor() {
        this.selectedMethod = null; // 'camera' or 'cone'
        this.testMode = false;

        // Measurement selection (can skip LC or LB)
        this.measureLc = true;
        this.measureLb = true;

        // Reference position set during prepare step
        this.referencePosition = null;

        // Step sizes for jog controls
        this.linearStepSize = 1; // mm
        this.angularStepSize = 10; // degrees

        // Module instances
        this.printer = new PrinterInterface({ logResponses: false });
        this.camera = new CameraManager();
        this.calibration = new MeasurementEngine();

        // Step controllers
        this.stepMethod = new StepMethod(this);
        this.stepConnect = new StepConnect(this);
        this.stepPrepare = new StepPrepare(this);
        this.stepLc = new StepLcMeasure(this);
        this.stepLb = new StepLbMeasure(this);
        this.stepResults = new StepResults(this);

        // Step indices: 0=method, 1=connect, 2=prepare, 3=LC, 4=LB, 5=results
        this.steps = [
            this.stepMethod,
            this.stepConnect,
            this.stepPrepare,
            this.stepLc,
            this.stepLb,
            this.stepResults
        ];

        // Wizard framework for step navigation
        this.wizard = new WizardFramework({
            totalSteps: 6,
            stepIdPrefix: 'step-',
            zeroIndexed: true,
            shouldSkipStep: (stepIndex) => this.shouldSkipStep(stepIndex),
            getNextButtonText: (step, total) => step === total - 2 ? 'Finish' : 'Next',
            onStepChange: (newStep) => {
                this.steps[newStep].enter();
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

        // Load any saved results
        this.loadSavedResults();

        // Initialise wizard (handles initial step display)
        this.wizard.init();
    }

    /**
     * Set up shared event listeners
     */
    setupEventListeners() {
        // Note: Navigation buttons handled by WizardFramework

        // Measurement selection toggles
        const lcToggle = document.getElementById('measureLcToggle');
        const lbToggle = document.getElementById('measureLbToggle');

        if (lcToggle) {
            lcToggle.addEventListener('change', (e) => {
                this.measureLc = e.target.checked;
                // Ensure at least one is selected
                if (!this.measureLc && !this.measureLb) {
                    this.measureLb = true;
                    lbToggle.checked = true;
                }
            });
        }

        if (lbToggle) {
            lbToggle.addEventListener('change', (e) => {
                this.measureLb = e.target.checked;
                // Ensure at least one is selected
                if (!this.measureLc && !this.measureLb) {
                    this.measureLc = true;
                    lcToggle.checked = true;
                }
            });
        }

        // Jog buttons (shared between LC and LB steps)
        document.querySelectorAll('.jog-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleJogButton(e));
        });

        // Keyboard controls for arrow keys and emergency stop
        document.addEventListener('keydown', (e) => this.handleKeyboardJog(e));

        // Step size buttons
        document.querySelectorAll('.step-size-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleStepSizeButton(e));
        });

        // Camera reconnect buttons
        ['prepCameraReconnect', 'lcCameraReconnect', 'lbCameraReconnect'].forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.addEventListener('click', () => this.reconnectCamera());
            }
        });
    }

    /**
     * Reconnect camera after disconnection
     */
    async reconnectCamera() {
        try {
            // Stop existing stream if any
            this.camera.stop();

            // Request new camera access
            await this.camera.requestAccess();

            // Re-attach to all video elements
            this.camera.attachToElement('cameraPreview', 'crosshairPreview');
            this.camera.attachToElement('prepCamera', 'prepCrosshair');
            this.camera.attachToElement('lcCamera', 'lcCrosshair');
            this.camera.attachToElement('lbCamera', 'lbCrosshair');

            console.log('[Camera] Reconnected successfully');
        } catch (error) {
            console.error('[Camera] Reconnect failed:', error);
            alert(`Camera reconnect failed: ${error.message}`);
        }
    }

    /**
     * Handle jog button click
     */
    async handleJogButton(e) {
        const btn = e.currentTarget;
        const axis = btn.dataset.axis;
        let dir = parseInt(btn.dataset.dir);

        if (!axis) return;

        // Reverse X direction when using camera (looking from below)
        if (axis === 'X' && this.selectedMethod === 'camera') {
            dir = -dir;
        }

        const isRotation = axis === 'C' || axis === 'B';
        const step = isRotation ? this.angularStepSize : this.linearStepSize;
        const delta = { [axis.toLowerCase()]: dir * step };

        btn.disabled = true;
        try {
            await this.printer.moveRelative(delta, isRotation ? 1800 : 3000);
        } catch (error) {
            console.error('Move error:', error);
        }
        btn.disabled = false;
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
     * Handle keyboard jog controls
     * Arrow keys for XY, PageUp/PageDown for Z
     * Enter to confirm position, 1/2/3 for step sizes
     * Spacebar for emergency stop
     */
    async handleKeyboardJog(e) {
        // Don't respond if user is typing in an input field
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        // Spacebar = emergency stop (always active when connected)
        if (e.key === ' ') {
            e.preventDefault();
            this.emergencyStop();
            return;
        }

        // Only respond to other keys during measurement steps (3=LC, 4=LB) or prepare step (2)
        if (this.currentStep < 2 || this.currentStep > 4) return;

        // Handle Enter key for confirm position
        if (e.key === 'Enter') {
            e.preventDefault();
            if (this.currentStep === 2) {
                // Prepare step - confirm reference
                const btn = document.getElementById('confirmReferenceBtn');
                if (btn && !btn.disabled) btn.click();
            } else if (this.currentStep === 3) {
                // LC measurement - confirm position
                const btn = document.getElementById('lcConfirmBtn');
                if (btn && !btn.disabled) btn.click();
            } else if (this.currentStep === 4) {
                // LB measurement - confirm position
                const btn = document.getElementById('lbConfirmBtn');
                if (btn && !btn.disabled) btn.click();
            }
            return;
        }

        // Handle 1/2/3 for step sizes
        if (e.key === '1' || e.key === '2' || e.key === '3') {
            e.preventDefault();
            const stepSizes = { '1': 0.1, '2': 1, '3': 10 };
            this.linearStepSize = stepSizes[e.key];

            // Update button styling - toggle btn-step class and border styling
            document.querySelectorAll('.step-size-btn').forEach(btn => {
                if (btn.dataset.type !== 'angle') {
                    const btnStep = parseFloat(btn.dataset.step);
                    if (btnStep === this.linearStepSize) {
                        btn.classList.add('btn-step', 'active', 'border-primary', 'text-primary');
                        btn.classList.remove('border-gray-300');
                    } else {
                        btn.classList.remove('btn-step', 'active', 'border-primary', 'text-primary');
                        btn.classList.add('border-gray-300');
                    }
                }
            });
            return;
        }

        let axis = null;
        let dir = 0;

        switch (e.key) {
            case 'ArrowUp':
                axis = 'Y';
                dir = 1;
                break;
            case 'ArrowDown':
                axis = 'Y';
                dir = -1;
                break;
            case 'ArrowLeft':
                axis = 'X';
                dir = -1;
                break;
            case 'ArrowRight':
                axis = 'X';
                dir = 1;
                break;
            case 'PageUp':
                axis = 'Z';
                dir = 1;
                break;
            case 'PageDown':
                axis = 'Z';
                dir = -1;
                break;
            default:
                return; // Not a jog key
        }

        // Prevent default scrolling behaviour
        e.preventDefault();

        // Reverse X direction when using camera (looking from below)
        if (axis === 'X' && this.selectedMethod === 'camera') {
            dir = -dir;
        }

        const delta = { [axis.toLowerCase()]: dir * this.linearStepSize };

        try {
            await this.printer.moveRelative(delta, 3000);
        } catch (error) {
            console.error('Keyboard move error:', error);
        }
    }

    /**
     * Handle step size button click
     */
    handleStepSizeButton(e) {
        const btn = e.currentTarget;
        const step = parseFloat(btn.dataset.step);
        const isAngle = btn.dataset.type === 'angle';

        if (isAngle) {
            this.angularStepSize = step;
        } else {
            this.linearStepSize = step;
        }

        // Update button styling - toggle btn-step class and border styling
        document.querySelectorAll('.step-size-btn').forEach(b => {
            const bIsAngle = b.dataset.type === 'angle';
            const bStep = parseFloat(b.dataset.step);

            if (bIsAngle === isAngle) {
                if (bStep === step) {
                    b.classList.add('btn-step', 'active', 'border-primary', 'text-primary');
                    b.classList.remove('border-gray-300');
                } else {
                    b.classList.remove('btn-step', 'active', 'border-primary', 'text-primary');
                    b.classList.add('border-gray-300');
                }
            }
        });
    }

    /**
     * Update position display
     */
    updatePositionDisplay(pos) {
        // Update all position displays (LC step, LB step, and prepare step)
        ['', '2', '-prep'].forEach(suffix => {
            const xEl = document.getElementById(`pos-x${suffix}`);
            const yEl = document.getElementById(`pos-y${suffix}`);
            const zEl = document.getElementById(`pos-z${suffix}`);
            const cEl = document.getElementById(`pos-c${suffix}`);
            const bEl = document.getElementById(`pos-b${suffix}`);

            if (xEl) xEl.textContent = pos.x.toFixed(2);
            if (yEl) yEl.textContent = pos.y.toFixed(2);
            if (zEl) zEl.textContent = pos.z.toFixed(2);
            if (cEl) cEl.textContent = pos.c.toFixed(1);
            if (bEl) bEl.textContent = pos.b.toFixed(1);
        });
    }

    /**
     * Check if a step should be skipped
     * @param {number} stepIndex
     * @returns {boolean}
     */
    shouldSkipStep(stepIndex) {
        // Step 3 = LC measurement
        if (stepIndex === 3 && !this.measureLc) return true;
        // Step 4 = LB measurement
        if (stepIndex === 4 && !this.measureLb) return true;
        return false;
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
     * Handles save actions before proceeding
     */
    nextStep() {
        // Check if this is a "Save & Next" action
        const nextBtn = document.getElementById('nextBtn');
        const saveAndNext = nextBtn.dataset.saveAndNext;

        if (saveAndNext === 'lc') {
            this.stepLc.saveToStorage();
            delete nextBtn.dataset.saveAndNext;
        } else if (saveAndNext === 'lb') {
            this.stepLb.saveToStorage();
            delete nextBtn.dataset.saveAndNext;
        }

        this.wizard.nextStep();
    }

    /**
     * Navigate to previous step (delegate to wizard)
     */
    previousStep() {
        this.wizard.prevStep();
    }

    /**
     * Navigate to a specific step (delegate to wizard)
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
     * Load saved results from storage
     */
    loadSavedResults() {
        const saved = StorageManager.loadCalibrationResults();
        if (saved) {
        }
    }
}

// Initialise on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new LcLbMeasureApp();
    window.app.init();
});
