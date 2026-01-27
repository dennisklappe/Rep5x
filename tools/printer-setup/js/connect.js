/**
 * Step 0: Connect - Printer connection handling for the printer setup tool
 * Extends StepConnectBase for shared connection functionality
 */

class StepConnect extends StepConnectBase {
    constructor(app) {
        super(app, {
            hasCamera: false,
            initializePrinter: true,
            canProceed: function() {
                return this.app.testMode || this.app.printer.isConnected();
            }
        });
    }

    /**
     * Override enter to handle step-specific next button logic
     */
    enter() {
        // Update next button for step 0
        const nextBtn = document.getElementById('nextBtn');
        if (nextBtn) {
            nextBtn.disabled = !this.app.printer.isConnected() && !this.app.testMode;
        }

        // Try auto-reconnect if not already connected
        if (!this.app.printer.isConnected() && !this.app.testMode) {
            this.tryAutoReconnect();
        }
    }

    /**
     * Override updateConnectionStatus to handle step-specific logic
     */
    updateConnectionStatus(connected) {
        // Call base implementation
        super.updateConnectionStatus(connected);

        // Enable next button when connected (only on step 0)
        if (this.app.currentStep === 0) {
            const nextBtn = document.getElementById('nextBtn');
            if (nextBtn) {
                nextBtn.disabled = !connected;
            }
        }
    }
}
