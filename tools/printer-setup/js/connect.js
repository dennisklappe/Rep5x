/**
 * Step 0: Connect - Printer connection handling
 */

class StepConnect {
    constructor(app) {
        this.app = app;
    }

    /**
     * Set up event listeners for this step
     */
    setup() {
        // Test mode toggle
        const testModeToggle = document.getElementById('testModeToggle');
        if (testModeToggle) {
            testModeToggle.addEventListener('change', (e) => {
                this.app.testMode = e.target.checked;
                this.app.printer.setTestMode(this.app.testMode);
                this.updateConnectionStatus(this.app.testMode);
            });
        }

        // Connection button
        document.getElementById('connectBtn').addEventListener('click', () => this.connect());
    }

    /**
     * Called when entering this step
     */
    enter() {
        document.getElementById('nextBtn').disabled = !this.app.printer.isConnected();

        // Try auto-reconnect if not already connected
        if (!this.app.printer.isConnected() && !this.app.testMode) {
            this.tryAutoReconnect();
        }
    }

    /**
     * Try to auto-reconnect to previously granted serial port
     */
    async tryAutoReconnect() {
        if ('serial' in navigator) {
            try {
                const ports = await navigator.serial.getPorts();
                if (ports.length > 0) {
                    const btn = document.getElementById('connectBtn');
                    btn.textContent = 'Auto-connecting...';

                    await this.app.printer.connectToPort(ports[0]);
                    btn.textContent = 'Connected';
                    document.getElementById('nextBtn').disabled = false;
                }
            } catch (error) {
            }
        }
    }

    /**
     * Connect to printer
     */
    async connect() {
        const btn = document.getElementById('connectBtn');
        btn.disabled = true;
        btn.textContent = 'Connecting...';

        try {
            await this.app.printer.connect();
            btn.textContent = 'Connected';
        } catch (error) {
            btn.textContent = 'Connect';
            alert(`Connection failed: ${error.message}`);
        }

        btn.disabled = false;
    }

    /**
     * Update connection status display
     */
    updateConnectionStatus(connected) {
        const statusDot = document.getElementById('serialStatus');
        const statusText = document.getElementById('serialStatusText');
        const nextBtn = document.getElementById('nextBtn');

        if (statusDot) {
            statusDot.classList.toggle('connected', connected);
            statusDot.classList.toggle('disconnected', !connected);
        }

        if (statusText) {
            statusText.textContent = connected
                ? (this.app.testMode ? 'Test mode active' : 'Connected')
                : 'Not connected';
        }

        // Enable next button when connected (only on step 0)
        if (this.app.currentStep === 0) {
            nextBtn.disabled = !connected;
        }
    }
}
