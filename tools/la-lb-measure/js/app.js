/**
 * LA/LB Measure Tool for Rep5x
 * Main application controller
 */

class LaLbMeasureApp {
    constructor() {
        this.currentStep = 0;
        this.totalSteps = 6;
        this.selectedMethod = null; // 'camera' or 'cone'
        this.testMode = false;

        // Measurement selection (can skip LA or LB)
        this.measureLa = true;
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
        this.stepLa = new StepLaMeasure(this);
        this.stepLb = new StepLbMeasure(this);
        this.stepResults = new StepResults(this);

        // Step indices: 0=method, 1=connect, 2=prepare, 3=LA, 4=LB, 5=results
        this.steps = [
            this.stepMethod,
            this.stepConnect,
            this.stepPrepare,
            this.stepLa,
            this.stepLb,
            this.stepResults
        ];
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

        // Show initial step
        this.showStep(0);
    }

    /**
     * Set up shared event listeners
     */
    setupEventListeners() {
        // Navigation buttons
        document.getElementById('nextBtn').addEventListener('click', () => this.nextStep());
        document.getElementById('prevBtn').addEventListener('click', () => this.previousStep());

        // Measurement selection toggles
        const laToggle = document.getElementById('measureLaToggle');
        const lbToggle = document.getElementById('measureLbToggle');

        if (laToggle) {
            laToggle.addEventListener('change', (e) => {
                this.measureLa = e.target.checked;
                // Ensure at least one is selected
                if (!this.measureLa && !this.measureLb) {
                    this.measureLb = true;
                    lbToggle.checked = true;
                }
            });
        }

        if (lbToggle) {
            lbToggle.addEventListener('change', (e) => {
                this.measureLb = e.target.checked;
                // Ensure at least one is selected
                if (!this.measureLa && !this.measureLb) {
                    this.measureLa = true;
                    laToggle.checked = true;
                }
            });
        }

        // Jog buttons (shared between LA and LB steps)
        document.querySelectorAll('.jog-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleJogButton(e));
        });

        // Keyboard controls for arrow keys and emergency stop
        document.addEventListener('keydown', (e) => this.handleKeyboardJog(e));

        // Step size buttons
        document.querySelectorAll('.step-size-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleStepSizeButton(e));
        });
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

        const isRotation = axis === 'A' || axis === 'B';
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

        // Only respond to other keys during measurement steps (3=LA, 4=LB) or prepare step (2)
        if (this.currentStep < 2 || this.currentStep > 4) return;

        // Handle Enter key for confirm position
        if (e.key === 'Enter') {
            e.preventDefault();
            if (this.currentStep === 2) {
                // Prepare step - confirm reference
                const btn = document.getElementById('confirmReferenceBtn');
                if (btn && !btn.disabled) btn.click();
            } else if (this.currentStep === 3) {
                // LA measurement - confirm position
                const btn = document.getElementById('laConfirmBtn');
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
        // Update all position displays (LA step, LB step, and prepare step)
        ['', '2', '-prep'].forEach(suffix => {
            const xEl = document.getElementById(`pos-x${suffix}`);
            const yEl = document.getElementById(`pos-y${suffix}`);
            const zEl = document.getElementById(`pos-z${suffix}`);
            const aEl = document.getElementById(`pos-a${suffix}`);
            const bEl = document.getElementById(`pos-b${suffix}`);

            if (xEl) xEl.textContent = pos.x.toFixed(2);
            if (yEl) yEl.textContent = pos.y.toFixed(2);
            if (zEl) zEl.textContent = pos.z.toFixed(2);
            if (aEl) aEl.textContent = pos.a.toFixed(1);
            if (bEl) bEl.textContent = pos.b.toFixed(1);
        });
    }

    /**
     * Check if a step should be skipped
     * @param {number} stepIndex
     * @returns {boolean}
     */
    shouldSkipStep(stepIndex) {
        // Step 3 = LA measurement
        if (stepIndex === 3 && !this.measureLa) return true;
        // Step 4 = LB measurement
        if (stepIndex === 4 && !this.measureLb) return true;
        return false;
    }

    /**
     * Navigate to next step (skipping unselected measurements)
     */
    nextStep() {
        // Check if this is a "Save & Next" action
        const nextBtn = document.getElementById('nextBtn');
        const saveAndNext = nextBtn.dataset.saveAndNext;

        if (saveAndNext === 'la') {
            this.stepLa.saveToStorage();
            delete nextBtn.dataset.saveAndNext;
        } else if (saveAndNext === 'lb') {
            this.stepLb.saveToStorage();
            delete nextBtn.dataset.saveAndNext;
        }

        let nextIndex = this.currentStep + 1;

        // Skip unselected measurement steps
        while (nextIndex < this.totalSteps && this.shouldSkipStep(nextIndex)) {
            nextIndex++;
        }

        if (nextIndex < this.totalSteps) {
            this.currentStep = nextIndex;
            this.showStep(this.currentStep);
        }
    }

    /**
     * Navigate to previous step (skipping unselected measurements)
     */
    previousStep() {
        let prevIndex = this.currentStep - 1;

        // Skip unselected measurement steps
        while (prevIndex >= 0 && this.shouldSkipStep(prevIndex)) {
            prevIndex--;
        }

        if (prevIndex >= 0) {
            this.currentStep = prevIndex;
            this.showStep(this.currentStep);
        }
    }

    /**
     * Show specific wizard step
     */
    showStep(stepIndex) {
        // Hide all steps
        document.querySelectorAll('.wizard-step').forEach(step => {
            step.classList.remove('active');
        });

        // Show current step
        const stepEl = document.getElementById(`step-${stepIndex}`);
        if (stepEl) stepEl.classList.add('active');

        // Update progress bar
        this.updateProgressBar(stepIndex);

        // Update navigation buttons
        this.updateNavigationButtons(stepIndex);

        // Call step's enter method
        this.steps[stepIndex].enter();
    }

    /**
     * Update progress bar
     */
    updateProgressBar(stepIndex) {
        document.querySelectorAll('.progress-step').forEach((step, i) => {
            step.classList.toggle('active', i === stepIndex);
            step.classList.toggle('completed', i < stepIndex);
        });

        document.querySelectorAll('.progress-connector').forEach((connector, i) => {
            connector.classList.toggle('completed', i < stepIndex);
        });
    }

    /**
     * Update navigation buttons
     */
    updateNavigationButtons(stepIndex) {
        const prevBtn = document.getElementById('prevBtn');
        const nextBtn = document.getElementById('nextBtn');

        prevBtn.style.visibility = stepIndex > 0 ? 'visible' : 'hidden';

        if (stepIndex === this.totalSteps - 1) {
            nextBtn.style.display = 'none';
        } else {
            nextBtn.style.display = 'block';
            nextBtn.textContent = stepIndex === this.totalSteps - 2 ? 'Finish →' : 'Next →';
        }
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
    window.app = new LaLbMeasureApp();
    window.app.init();
});
