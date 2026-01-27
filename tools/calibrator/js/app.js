/**
 * Rep5x Calibrator - Main Application
 * Coordinates calibration workflow and step controllers
 */

class CalibratorApp {
    // Minimum safe Z height - never allow jogging below this
    static MIN_SAFE_Z = 10; // mm

    constructor() {
        this.selectedMethod = null; // 'camera' or 'cone'
        this.testMode = false;

        // Reference position set during prepare step
        this.referencePosition = null;

        // Step sizes for jog controls
        this.linearStepSize = 1; // mm

        // Jog lock to prevent overlapping commands
        this.jogInProgress = false;

        // Core components
        this.printer = new PrinterInterface({ logResponses: false });
        this.engine = new CalibrationEngine();
        this.camera = new CameraManager();

        // Step controllers
        this.stepMethod = new StepMethod(this);
        this.stepConnect = new StepConnect(this);
        this.stepPrepare = new StepPrepare(this);
        this.stepCalibrateXY = new StepCalibrateXY(this);
        this.stepCalibrateZ = new StepCalibrateZ(this);
        this.stepResults = new StepResults(this);

        // Step indices: 0=method, 1=connect, 2=prepare, 3=calibrateXY, 4=calibrateZ, 5=results
        this.steps = [
            this.stepMethod,
            this.stepConnect,
            this.stepPrepare,
            this.stepCalibrateXY,
            this.stepCalibrateZ,
            this.stepResults
        ];

        // Wizard framework for step navigation
        this.wizard = new WizardFramework({
            totalSteps: 6,
            stepIdPrefix: 'step-',
            zeroIndexed: true,
            getNextButtonText: (step, total) => step === total - 2 ? 'Finish →' : 'Next →',
            onStepChange: (newStep) => {
                this.syncStepSizeButtons(this.linearStepSize);
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
        this.printer.onLog = (msg) => console.log('[Printer]', msg);

        // Set up step event listeners
        this.steps.forEach(step => step.setup());

        // Set up shared event listeners
        this.setupEventListeners();

        // Load saved LC/LB values
        this.loadSavedLcLb();

        // Initialise wizard (handles initial step display)
        this.wizard.init();
    }

    /**
     * Load saved LC/LB values
     */
    loadSavedLcLb() {
        const results = StorageManager.loadCalibrationResults();
        const lc = results?.lc ?? 0;
        const lb = results?.lb ?? 54.67;
        this.engine.setLcLb(lc, lb);
    }

    /**
     * Set up shared event listeners
     */
    setupEventListeners() {
        // Note: Navigation buttons handled by WizardFramework

        // Jog buttons
        document.querySelectorAll('.jog-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleJogButton(e));
        });

        // Keyboard controls
        document.addEventListener('keydown', (e) => this.handleKeyboardJog(e));

        // Step size buttons
        document.querySelectorAll('.step-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleStepSizeButton(e));
        });
    }

    /**
     * Handle jog button click
     */
    async handleJogButton(e) {
        // Prevent overlapping jog commands
        if (this.jogInProgress) return;
        this.jogInProgress = true;

        try {
            const btn = e.currentTarget;
            const axis = btn.dataset.axis;
            let dir = parseInt(btn.dataset.dir);

            if (!axis) return;

            // Reverse X direction when using camera (looking from below)
            if (axis === 'X' && this.selectedMethod === 'camera') {
                dir = -dir;
            }

            const distance = this.linearStepSize * dir;

            if (['C', 'B'].includes(axis)) {
                await this.printer.sendCommand(`G91`);
                await this.printer.sendCommand(`G0 ${axis}${distance}`);
                await this.printer.sendCommand(`G90`);
                await this.printer.requestPosition();
            } else {
                const delta = {};
                if (axis === 'X') delta.x = distance;
                if (axis === 'Y') delta.y = distance;
                if (axis === 'Z') {
                    // Apply Z safety limit - never go below MIN_SAFE_Z
                    const pos = this.printer.getPosition();
                    const currentZ = pos?.z;
                    if (distance < 0 && currentZ === undefined) {
                        console.error('Z safety: Cannot jog Z down - position unknown. Requesting position update...');
                        await this.printer.requestPosition();
                        return;
                    }
                    if (currentZ !== undefined && distance < 0) {
                        const targetZ = currentZ + distance;
                        if (targetZ < CalibratorApp.MIN_SAFE_Z) {
                            // Limit move to stop at MIN_SAFE_Z
                            const limitedDistance = CalibratorApp.MIN_SAFE_Z - currentZ;
                            if (limitedDistance >= 0) {
                                console.log(`Z safety: Already at or below ${CalibratorApp.MIN_SAFE_Z}mm, blocking downward move`);
                                return;
                            }
                            console.log(`Z safety: Limiting move from ${distance}mm to ${limitedDistance.toFixed(2)}mm (would stop at Z=${CalibratorApp.MIN_SAFE_Z})`);
                            delta.z = limitedDistance;
                        } else {
                            delta.z = distance;
                        }
                    } else {
                        delta.z = distance;
                    }
                }
                await this.printer.moveRelative(delta);
            }

            // Update offset display if on calibration step
            if (this.currentStep === 3) {
                this.stepCalibrateXY.updateOffsetDisplay();
            } else if (this.currentStep === 4) {
                this.stepCalibrateZ.updateOffsetDisplay();
            }
        } finally {
            this.jogInProgress = false;
        }
    }

    /**
     * Handle keyboard jog controls
     */
    async handleKeyboardJog(e) {
        // Don't respond if user is typing in an input field
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        // Spacebar = emergency stop (single tap, consistent with other tools)
        // This works on ALL steps, regardless of current wizard state
        if (e.key === ' ') {
            e.preventDefault();
            this.printer.sendCommand('M112');
            this.showEmergencyStopFeedback();
            console.log('EMERGENCY STOP SENT (M112)');
            return;
        }

        // Only respond to jog keys during prepare and calibration steps (2=prepare, 3=calibrateXY, 4=calibrateZ)
        if (this.currentStep < 2 || this.currentStep > 4) return;

        // Handle Enter key for confirm position/reference
        if (e.key === 'Enter') {
            e.preventDefault();
            if (this.currentStep === 2 && this.stepPrepare.isReady && !this.stepPrepare.referenceConfirmed) {
                // Confirm reference point in prepare step
                this.stepPrepare.confirmReference();
            } else if (this.currentStep === 3 && !this.stepCalibrateXY.controlsLocked) {
                this.stepCalibrateXY.confirmCurrentPoint();
            } else if (this.currentStep === 4) {
                // Z calibration - check if we're in reference or calibration phase
                if (!this.stepCalibrateZ.zReferenceConfirmed) {
                    this.stepCalibrateZ.confirmZReference();
                } else if (!this.stepCalibrateZ.controlsLocked) {
                    this.stepCalibrateZ.confirmCurrentPoint();
                }
            }
            return;
        }

        // Handle 1/2/3 for step sizes
        if (e.key === '1' || e.key === '2' || e.key === '3') {
            e.preventDefault();
            const stepSizes = { '1': 0.1, '2': 1, '3': 10 };
            this.linearStepSize = stepSizes[e.key];

            // Update all step size button groups
            this.syncStepSizeButtons(this.linearStepSize);
            return;
        }

        // Block jogging if controls are locked (during movement)
        if (this.currentStep === 3 && this.stepCalibrateXY.controlsLocked) return;
        if (this.currentStep === 4 && this.stepCalibrateZ.controlsLocked) return;

        let axis = null;
        let dir = 0;

        switch (e.key) {
            case 'ArrowUp': axis = 'Y'; dir = 1; break;
            case 'ArrowDown': axis = 'Y'; dir = -1; break;
            case 'ArrowLeft': axis = 'X'; dir = -1; break;
            case 'ArrowRight': axis = 'X'; dir = 1; break;
            case 'PageUp': axis = 'Z'; dir = 1; break;
            case 'PageDown': axis = 'Z'; dir = -1; break;
            default: return;
        }

        e.preventDefault();

        // Block Z movement during X/Y calibration phase
        if (axis === 'Z' && this.currentStep === 3) {
            return;
        }

        // Block X/Y movement during Z calibration phase (only allow PageUp/PageDown for Z)
        if ((axis === 'X' || axis === 'Y') && this.currentStep === 4) {
            return;
        }

        // Reverse X direction when using camera (looking from below)
        if (axis === 'X' && this.selectedMethod === 'camera') {
            dir = -dir;
        }

        let distance = dir * this.linearStepSize;

        // Apply Z safety limit for keyboard jogs
        if (axis === 'Z' && distance < 0) {
            // Use getPosition() to get the latest cached position (not this.printer.position which may be stale)
            const pos = this.printer.getPosition();
            const currentZ = pos?.z;
            if (currentZ === undefined) {
                console.error('Z safety: Cannot jog Z down - position unknown. Requesting position update...');
                await this.printer.requestPosition();
                return;
            }
            const targetZ = currentZ + distance;
            if (targetZ < CalibratorApp.MIN_SAFE_Z) {
                const limitedDistance = CalibratorApp.MIN_SAFE_Z - currentZ;
                if (limitedDistance >= 0) {
                    console.log(`Z safety: Already at or below ${CalibratorApp.MIN_SAFE_Z}mm, blocking downward move`);
                    return;
                }
                console.log(`Z safety: Limiting move from ${distance}mm to ${limitedDistance.toFixed(2)}mm (would stop at Z=${CalibratorApp.MIN_SAFE_Z})`);
                distance = limitedDistance;
            }
        }

        const delta = { [axis.toLowerCase()]: distance };

        try {
            await this.printer.moveRelative(delta);

            if (this.currentStep === 3) {
                this.stepCalibrateXY.updateOffsetDisplay();
            } else if (this.currentStep === 4) {
                this.stepCalibrateZ.updateOffsetDisplay();
            }
        } catch (error) {
            console.error('Jog error:', error);
        }
    }

    /**
     * Handle step size button click
     */
    handleStepSizeButton(e) {
        const btn = e.currentTarget;
        const step = parseFloat(btn.dataset.step);

        this.linearStepSize = step;

        // Update ALL step size button groups across all steps
        this.syncStepSizeButtons(step);
    }

    /**
     * Sync all step size buttons to show the correct active state
     */
    syncStepSizeButtons(step) {
        document.querySelectorAll('.step-size-controls').forEach(group => {
            group.querySelectorAll('.step-btn, .step-size-btn').forEach(b => {
                b.classList.toggle('active', parseFloat(b.dataset.step) === step);
            });
        });
    }

    /**
     * Show visual feedback for emergency stop
     */
    showEmergencyStopFeedback() {
        // Remove any existing feedback
        const existing = document.getElementById('emergency-stop-toast');
        if (existing) existing.remove();

        // Create toast element
        const toast = document.createElement('div');
        toast.id = 'emergency-stop-toast';
        toast.className = 'fixed top-4 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-lg shadow-lg z-[100] text-white font-bold text-center bg-red-600';
        toast.innerHTML = '⚠️ EMERGENCY STOP SENT ⚠️<br><span class="text-sm font-normal">Printer halted - power cycle required</span>';

        document.body.appendChild(toast);

        // Auto-remove toast after 5 seconds
        setTimeout(() => {
            if (toast.parentNode) {
                toast.style.opacity = '0';
                toast.style.transition = 'opacity 0.3s';
                setTimeout(() => toast.remove(), 300);
            }
        }, 5000);
    }

    /**
     * Update position display
     */
    updatePositionDisplay(pos) {
        const formatPos = (val) => val !== undefined ? val.toFixed(2) : '---';

        const displayText = `X: ${formatPos(pos.x)} Y: ${formatPos(pos.y)} Z: ${formatPos(pos.z)} A: ${formatPos(pos.c)} B: ${formatPos(pos.b)}`;

        ['prepare-position-display', 'calibration-position'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = displayText;
        });

        const currentStep = this.wizard.getCurrentStep();
        if (currentStep === 3) {
            this.stepCalibrateXY.updateOffsetDisplay();
        } else if (currentStep === 4) {
            // Update Z reference display if not yet confirmed, otherwise update offset
            if (!this.stepCalibrateZ.zReferenceConfirmed) {
                this.stepCalibrateZ.updateZRefDisplay();
            } else {
                this.stepCalibrateZ.updateOffsetDisplay();
            }
        }
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
}

// Initialise app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new CalibratorApp();
    window.app.init();
});
