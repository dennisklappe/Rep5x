/**
 * Step 1: Connection
 * Handle printer and camera connections
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
                this.updateTestModeUI();
            });
        }

        // Connection buttons
        document.getElementById('connectBtn').addEventListener('click', () => this.connectPrinter());

        const cameraConnectBtn = document.getElementById('cameraConnectBtn');
        if (cameraConnectBtn) {
            cameraConnectBtn.addEventListener('click', () => this.connectCamera());
        }
    }

    /**
     * Called when entering this step
     */
    enter() {
        // Show/hide camera panel
        const cameraPanel = document.getElementById('cameraConnectionPanel');
        if (cameraPanel) {
            cameraPanel.style.display = this.app.selectedMethod === 'camera' ? 'block' : 'none';
        }

        // Show test mode notice
        const testNotice = document.getElementById('testModeNotice');
        if (testNotice) {
            testNotice.style.display = this.app.testMode ? 'block' : 'none';
        }

        // Update connection status
        this.updateConnectionStatus(this.app.printer.isConnected());

        // Try auto-reconnect if not already connected
        if (!this.app.printer.isConnected() && !this.app.testMode) {
            this.tryAutoReconnect();
        }

        // Check if we can proceed
        this.updateNextButton();
    }

    /**
     * Try to auto-reconnect to previously granted serial port and camera
     */
    async tryAutoReconnect() {
        // Try serial auto-reconnect
        if ('serial' in navigator) {
            try {
                const ports = await navigator.serial.getPorts();
                if (ports.length > 0) {
                    const btn = document.getElementById('connectBtn');
                    btn.textContent = 'Auto-connecting...';

                    await this.app.printer.connectToPort(ports[0]);
                    btn.textContent = 'Connected';

                    // Initialize printer for LC/LB measurement
                    await this.initializePrinterForMeasurement();

                    this.updateNextButton();
                }
            } catch (error) {
            }
        }

        // Try camera auto-reconnect if camera method selected
        if (this.app.selectedMethod === 'camera' && !this.app.camera.isActive()) {
            try {
                // Check if camera permission was previously granted
                const permission = await navigator.permissions.query({ name: 'camera' });
                if (permission.state === 'granted') {
                    const btn = document.getElementById('cameraConnectBtn');
                    if (btn) btn.textContent = 'Auto-connecting...';

                    await this.app.camera.requestAccess();

                    const previewContainer = document.getElementById('cameraPreviewContainer');
                    if (previewContainer) previewContainer.style.display = 'block';

                    this.app.camera.attachToElement('cameraPreview', 'crosshairPreview');

                    const statusDot = document.getElementById('cameraStatus');
                    const statusText = document.getElementById('cameraStatusText');
                    if (statusDot) statusDot.classList.replace('disconnected', 'connected');
                    if (statusText) statusText.textContent = 'Connected';
                    if (btn) btn.textContent = 'Connected';

                    this.updateNextButton();
                }
            } catch (error) {
            }
        }
    }

    /**
     * Connect to printer
     */
    async connectPrinter() {
        const btn = document.getElementById('connectBtn');
        btn.disabled = true;
        btn.textContent = 'Connecting...';

        try {
            await this.app.printer.connect();
            btn.textContent = 'Connected';

            // Initialize printer for LC/LB measurement
            await this.initializePrinterForMeasurement();
        } catch (error) {
            btn.textContent = 'Connect';
            alert(`Connection failed: ${error.message}`);
        }

        btn.disabled = false;
        this.updateNextButton();
    }

    /**
     * Initialize printer settings for LC/LB measurement
     * Disables IK and calibration correction, queries current LC/LB values
     */
    async initializePrinterForMeasurement() {
        try {
            // Disable IK corrections - we want raw machine positions
            await this.app.printer.sendCommandAndWait('G49', 3000);
            console.log('[Connect] Disabled IK corrections (G49)');

            // Disable calibration correction
            await this.app.printer.sendCommandAndWait('M667 S0', 3000);
            console.log('[Connect] Disabled calibration correction (M667 S0)');

            // Query current LC/LB values from firmware
            const { lc, lb } = await this.queryIkParamsFromPrinter();

            // Update footer displays
            const footerLcInput = document.getElementById('savedLcValue');
            const footerLbInput = document.getElementById('savedLbValue');
            if (footerLcInput) footerLcInput.value = lc.toFixed(2);
            if (footerLbInput) footerLbInput.value = lb.toFixed(2);

        } catch (error) {
            console.warn('[Connect] Error initializing printer:', error);
        }
    }

    /**
     * Query LC and LB values from printer firmware via M665
     * @returns {Promise<{lc: number, lb: number}>}
     */
    async queryIkParamsFromPrinter() {
        try {
            const params = await this.app.printer.queryM665();
            console.log(`[Connect] Read from printer: LC=${params.lc}, LB=${params.lb}`);
            return { lc: params.lc, lb: params.lb };
        } catch (e) {
            console.warn('[Connect] Failed to query M665:', e);
            return { lc: 0, lb: 54.67 };
        }
    }

    /**
     * Connect camera
     */
    async connectCamera() {
        const btn = document.getElementById('cameraConnectBtn');
        btn.disabled = true;
        btn.textContent = 'Connecting...';

        try {
            await this.app.camera.requestAccess();

            // Show preview
            const previewContainer = document.getElementById('cameraPreviewContainer');
            if (previewContainer) {
                previewContainer.style.display = 'block';
            }

            this.app.camera.attachToElement('cameraPreview', 'crosshairPreview');

            // Update status
            const statusDot = document.getElementById('cameraStatus');
            const statusText = document.getElementById('cameraStatusText');
            if (statusDot) statusDot.classList.replace('disconnected', 'connected');
            if (statusText) statusText.textContent = 'Connected';

            btn.textContent = 'Connected';
        } catch (error) {
            btn.textContent = 'Enable Camera';
            alert(`Camera access failed: ${error.message}`);
        }

        btn.disabled = false;
        this.updateNextButton();
    }

    /**
     * Update connection status display
     */
    updateConnectionStatus(connected) {
        const statusDot = document.getElementById('serialStatus');
        const statusText = document.getElementById('serialStatusText');

        if (statusDot) {
            statusDot.classList.toggle('connected', connected);
            statusDot.classList.toggle('disconnected', !connected);
        }

        if (statusText) {
            statusText.textContent = connected
                ? (this.app.testMode ? 'Test mode active' : 'Connected')
                : 'Not connected';
        }

        const btn = document.getElementById('connectBtn');
        if (btn) {
            btn.textContent = connected ? 'Connected' : 'Connect';
        }
    }

    /**
     * Update test mode UI elements
     */
    updateTestModeUI() {
        const testNotice = document.getElementById('testModeNotice');
        if (testNotice) {
            testNotice.style.display = this.app.testMode ? 'block' : 'none';
        }
        this.updateNextButton();
    }

    /**
     * Update next button state based on connections
     */
    updateNextButton() {
        const canProceed = this.app.testMode ||
            (this.app.printer.isConnected() &&
             (this.app.selectedMethod !== 'camera' || this.app.camera.isActive()));

        document.getElementById('nextBtn').disabled = !canProceed;
    }
}
