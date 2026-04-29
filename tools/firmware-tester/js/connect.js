/**
 * Connect step — wraps StepConnectBase with the Firmware Tester's specifics:
 * - Optional JSON config upload from the Firmware Builder
 * - Doesn't run G49/M667 (the firmware tester wants to see raw firmware behaviour)
 */

class StepConnect {
    constructor(app) {
        this.app = app;
        this.base = new StepConnectBase(app, {
            hasCamera: false,
            initializePrinter: false,    // don't issue G49/M667 — we want raw firmware behaviour
            canProceed: () => app.testMode || app.printer.isConnected(),
        });
    }

    register(stepIndex) {
        this.app.wizard.registerStep(stepIndex, {
            enter: () => this.enter(),
        });
        this.base.setup();
        this.setupConfigUpload();
    }

    enter() {
        this.base.enter();
    }

    updateConnectionStatus(connected) {
        this.base.updateConnectionStatus(connected);
        this.base.updateNextButton();
    }

    /**
     * Hook up the optional JSON-config file picker. The user can either upload the JSON
     * exported from the Firmware Builder, or skip and run the tests without a baseline
     * (they just won't get a corrected JSON at the end).
     */
    setupConfigUpload() {
        const fileInput = document.getElementById('configUpload');
        const fileBtn = document.getElementById('configUploadBtn');
        const filenameEl = document.getElementById('configFilename');
        if (!fileInput || !fileBtn) return;

        fileBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;

            try {
                const text = await file.text();
                const parsed = JSON.parse(text);
                if (!parsed || typeof parsed !== 'object') {
                    throw new Error('JSON must be an object');
                }
                this.app.fbConfig = parsed.config ? parsed.config : parsed;
                this.app.fbConfigFilename = file.name;
                if (filenameEl) filenameEl.textContent = file.name;
            } catch (err) {
                alert(`Could not load config: ${err.message}`);
                if (filenameEl) filenameEl.textContent = 'No file selected';
            }
        });
    }
}
