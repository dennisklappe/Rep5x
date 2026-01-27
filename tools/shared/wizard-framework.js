/**
 * WizardFramework - Reusable multi-step wizard navigation
 * Provides step management, progress indicators, and navigation controls
 */
class WizardFramework {
    /**
     * Create a wizard framework instance
     * @param {Object} config - Configuration object
     * @param {number} config.totalSteps - Total number of steps in the wizard
     * @param {string} [config.stepIdPrefix='step-'] - Prefix for step element IDs (e.g., 'step-' for step-0, step-1)
     * @param {boolean} [config.zeroIndexed=true] - Whether step IDs are 0-indexed
     * @param {string} [config.progressFillId='progressFill'] - ID of progress bar fill element
     * @param {string} [config.stepCounterId='stepCounter'] - ID of step counter element
     * @param {string} [config.prevBtnId='prevBtn'] - ID of previous button
     * @param {string} [config.nextBtnId='nextBtn'] - ID of next button
     * @param {string} [config.stepIndicatorClass='step-indicator'] - Class for step indicator circles
     * @param {string} [config.stepConnectorClass='step-connector'] - Class for connectors between indicators
     * @param {string} [config.wizardStepClass='wizard-step'] - Class for step content containers
     * @param {Function} [config.onStepChange] - Callback when step changes: (newStep, oldStep) => void
     * @param {Function} [config.getNextButtonText] - Function to get next button text: (stepIndex, totalSteps) => string
     * @param {Function} [config.shouldSkipStep] - Function to determine if step should be skipped: (stepIndex) => boolean
     */
    constructor(config) {
        this.totalSteps = config.totalSteps;
        this.stepIdPrefix = config.stepIdPrefix ?? 'step-';
        this.zeroIndexed = config.zeroIndexed ?? true;
        this.progressFillId = config.progressFillId ?? 'progressFill';
        this.stepCounterId = config.stepCounterId ?? 'stepCounter';
        this.prevBtnId = config.prevBtnId ?? 'prevBtn';
        this.nextBtnId = config.nextBtnId ?? 'nextBtn';
        this.stepIndicatorClass = config.stepIndicatorClass ?? 'step-indicator';
        this.stepConnectorClass = config.stepConnectorClass ?? 'step-connector';
        this.wizardStepClass = config.wizardStepClass ?? 'wizard-step';
        this.onStepChange = config.onStepChange ?? null;
        this.getNextButtonText = config.getNextButtonText ?? null;
        this.shouldSkipStep = config.shouldSkipStep ?? null;

        // Current step (always 0-indexed internally)
        this.currentStep = 0;

        // Step handlers: { enter, leave, canProceed }
        this.stepHandlers = {};

        // Cache DOM elements
        this.elements = {
            progressFill: null,
            stepCounter: null,
            prevBtn: null,
            nextBtn: null,
            stepIndicators: [],
            stepConnectors: [],
            wizardSteps: []
        };
    }

    /**
     * Initialise the wizard framework
     * Call this after DOM is ready
     */
    init() {
        this.cacheElements();
        this.setupNavigationListeners();
        this.showStep(0);
    }

    /**
     * Cache DOM elements for performance
     */
    cacheElements() {
        this.elements.progressFill = document.getElementById(this.progressFillId);
        this.elements.stepCounter = document.getElementById(this.stepCounterId);
        this.elements.prevBtn = document.getElementById(this.prevBtnId);
        this.elements.nextBtn = document.getElementById(this.nextBtnId);
        this.elements.stepIndicators = Array.from(
            document.querySelectorAll(`.${this.stepIndicatorClass}`)
        );
        this.elements.stepConnectors = Array.from(
            document.querySelectorAll(`.${this.stepConnectorClass}`)
        );
        this.elements.wizardSteps = Array.from(
            document.querySelectorAll(`.${this.wizardStepClass}`)
        );
    }

    /**
     * Set up click listeners for navigation buttons
     */
    setupNavigationListeners() {
        if (this.elements.prevBtn) {
            this.elements.prevBtn.addEventListener('click', () => this.prevStep());
        }
        if (this.elements.nextBtn) {
            this.elements.nextBtn.addEventListener('click', () => this.nextStep());
        }
    }

    /**
     * Register handlers for a specific step
     * @param {number} stepIndex - Step index (0-indexed)
     * @param {Object} handlers - Handler functions
     * @param {Function} [handlers.enter] - Called when entering the step
     * @param {Function} [handlers.leave] - Called when leaving the step (return false to prevent)
     * @param {Function} [handlers.canProceed] - Called to check if user can proceed (return false to prevent)
     */
    registerStep(stepIndex, handlers) {
        this.stepHandlers[stepIndex] = handlers;
    }

    /**
     * Get the step element ID for a given index
     * @param {number} stepIndex - Step index (0-indexed internally)
     * @returns {string} Element ID
     */
    getStepElementId(stepIndex) {
        const displayIndex = this.zeroIndexed ? stepIndex : stepIndex + 1;
        return `${this.stepIdPrefix}${displayIndex}`;
    }

    /**
     * Navigate to the next step
     * @returns {boolean} Whether navigation succeeded
     */
    async nextStep() {
        // Check if current step allows proceeding
        const handlers = this.stepHandlers[this.currentStep];
        if (handlers?.canProceed) {
            const canProceed = await handlers.canProceed();
            if (!canProceed) return false;
        }

        // Call leave handler
        if (handlers?.leave) {
            const canLeave = await handlers.leave();
            if (canLeave === false) return false;
        }

        // Find next valid step (skip if shouldSkipStep returns true)
        let nextIndex = this.currentStep + 1;
        while (nextIndex < this.totalSteps && this.shouldSkipStep?.(nextIndex)) {
            nextIndex++;
        }

        if (nextIndex < this.totalSteps) {
            this.showStep(nextIndex);
            return true;
        }
        return false;
    }

    /**
     * Navigate to the previous step
     * @returns {boolean} Whether navigation succeeded
     */
    async prevStep() {
        // Call leave handler
        const handlers = this.stepHandlers[this.currentStep];
        if (handlers?.leave) {
            const canLeave = await handlers.leave();
            if (canLeave === false) return false;
        }

        // Find previous valid step (skip if shouldSkipStep returns true)
        let prevIndex = this.currentStep - 1;
        while (prevIndex >= 0 && this.shouldSkipStep?.(prevIndex)) {
            prevIndex--;
        }

        if (prevIndex >= 0) {
            this.showStep(prevIndex);
            return true;
        }
        return false;
    }

    /**
     * Navigate directly to a specific step
     * @param {number} stepIndex - Target step index (0-indexed)
     * @returns {boolean} Whether navigation succeeded
     */
    async goToStep(stepIndex) {
        if (stepIndex < 0 || stepIndex >= this.totalSteps) {
            return false;
        }

        // Call leave handler on current step
        const handlers = this.stepHandlers[this.currentStep];
        if (handlers?.leave) {
            const canLeave = await handlers.leave();
            if (canLeave === false) return false;
        }

        this.showStep(stepIndex);
        return true;
    }

    /**
     * Show a specific step
     * @param {number} stepIndex - Step index to show (0-indexed)
     */
    showStep(stepIndex) {
        const oldStep = this.currentStep;
        this.currentStep = stepIndex;

        // Hide all steps
        this.elements.wizardSteps.forEach(step => {
            step.classList.remove('active');
        });

        // Show target step
        const stepEl = document.getElementById(this.getStepElementId(stepIndex));
        if (stepEl) {
            stepEl.classList.add('active');
        }

        // Update progress indicators
        this.updateStepIndicators();

        // Update progress bar
        this.updateProgressBar();

        // Update navigation buttons
        this.updateNavigationButtons();

        // Call enter handler
        const handlers = this.stepHandlers[stepIndex];
        if (handlers?.enter) {
            handlers.enter();
        }

        // Call onStepChange callback
        if (this.onStepChange) {
            this.onStepChange(stepIndex, oldStep);
        }
    }

    /**
     * Update step indicator circles
     */
    updateStepIndicators() {
        this.elements.stepIndicators.forEach((indicator, i) => {
            indicator.classList.toggle('active', i === this.currentStep);
            indicator.classList.toggle('completed', i < this.currentStep);

            // Update content for completed steps (show checkmark)
            if (i < this.currentStep) {
                // Check if indicator doesn't already have a checkmark
                if (!indicator.querySelector('svg')) {
                    indicator.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>';
                }
            } else if (indicator.querySelector('svg')) {
                // Restore step number if going backwards
                indicator.textContent = i + 1;
            }
        });

        // Update connectors
        this.elements.stepConnectors.forEach((connector, i) => {
            connector.classList.toggle('completed', i < this.currentStep);
        });
    }

    /**
     * Update progress bar fill
     */
    updateProgressBar() {
        if (!this.elements.progressFill) return;

        const progress = ((this.currentStep + 1) / this.totalSteps) * 100;
        this.elements.progressFill.style.width = `${progress}%`;
    }

    /**
     * Update step counter text
     */
    updateStepCounter() {
        if (!this.elements.stepCounter) return;

        const displayStep = this.currentStep + 1;
        this.elements.stepCounter.textContent = `Step ${displayStep} of ${this.totalSteps}`;
    }

    /**
     * Update navigation button visibility and text
     */
    updateNavigationButtons() {
        const { prevBtn, nextBtn } = this.elements;

        // Previous button: hidden on first step
        if (prevBtn) {
            prevBtn.style.visibility = this.currentStep > 0 ? 'visible' : 'hidden';
        }

        // Next button: hidden on last step, text changes
        if (nextBtn) {
            const isLastStep = this.currentStep === this.totalSteps - 1;

            if (isLastStep) {
                nextBtn.style.display = 'none';
            } else {
                nextBtn.style.display = 'flex';

                // Get button text from custom function or use default
                if (this.getNextButtonText) {
                    const text = this.getNextButtonText(this.currentStep, this.totalSteps);
                    // Check if button has SVG icon and preserve it
                    const svg = nextBtn.querySelector('svg');
                    if (svg) {
                        nextBtn.innerHTML = `${text} ${svg.outerHTML}`;
                    } else {
                        nextBtn.textContent = text;
                    }
                }
            }
        }

        // Update step counter
        this.updateStepCounter();
    }

    /**
     * Enable or disable the next button
     * @param {boolean} enabled - Whether the button should be enabled
     */
    setNextButtonEnabled(enabled) {
        if (this.elements.nextBtn) {
            this.elements.nextBtn.disabled = !enabled;
        }
    }

    /**
     * Show or hide the next button
     * @param {boolean} visible - Whether the button should be visible
     */
    setNextButtonVisible(visible) {
        if (this.elements.nextBtn) {
            this.elements.nextBtn.style.display = visible ? 'flex' : 'none';
        }
    }

    /**
     * Get the current step index
     * @returns {number} Current step index (0-indexed)
     */
    getCurrentStep() {
        return this.currentStep;
    }

    /**
     * Get the total number of steps
     * @returns {number} Total steps
     */
    getTotalSteps() {
        return this.totalSteps;
    }
}
