/**
 * StepConnectBase - Shared base class for connection step across tools
 * Handles printer serial connection, test mode, and optional camera connection
 */

class StepConnectBase {
    /**
     * @param {Object} app - The main application instance
     * @param {Object} options - Configuration options
     * @param {boolean} options.hasCamera - Whether this tool supports camera connection
     * @param {boolean} options.initializePrinter - Whether to run printer initialization after connect
     * @param {Function} options.onPrinterInitialize - Custom initialization callback (async)
     * @param {Function} options.canProceed - Custom function to determine if user can proceed to next step
     */
    constructor(app, options = {}) {
        this.app = app;
        this.options = {
            hasCamera: false,
            initializePrinter: true,
            onPrinterInitialize: null,
            canProceed: null,
            ...options
        };
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

        // Connection button
        const connectBtn = document.getElementById('connectBtn');
        if (connectBtn) {
            connectBtn.addEventListener('click', () => this.connectPrinter());
        }

        // Camera connection button (if applicable)
        if (this.options.hasCamera) {
            const cameraConnectBtn = document.getElementById('cameraConnectBtn');
            if (cameraConnectBtn) {
                cameraConnectBtn.addEventListener('click', () => this.connectCamera());
            }
        }
    }

    /**
     * Called when entering this step
     */
    enter() {
        // Show/hide camera panel based on method selection
        if (this.options.hasCamera) {
            const cameraPanel = document.getElementById('cameraConnectionPanel');
            if (cameraPanel) {
                cameraPanel.style.display = this.app.selectedMethod === 'camera' ? 'block' : 'none';
            }
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
                    if (btn) btn.textContent = 'Auto-connecting...';

                    await this.app.printer.connectToPort(ports[0]);
                    if (btn) btn.textContent = 'Connected';

                    // Run printer initialization if configured
                    if (this.options.initializePrinter) {
                        await this.initializePrinter();
                    }

                    this.updateNextButton();
                }
            } catch (error) {
                // Silent fail for auto-reconnect
            }
        }

        // Try camera auto-reconnect if camera method selected
        if (this.options.hasCamera && this.app.selectedMethod === 'camera' && this.app.camera && !this.app.camera.isActive()) {
            try {
                const permission = await navigator.permissions.query({ name: 'camera' });
                if (permission.state === 'granted') {
                    const btn = document.getElementById('cameraConnectBtn');
                    if (btn) btn.textContent = 'Auto-connecting...';

                    await this.app.camera.requestAccess();

                    const previewContainer = document.getElementById('cameraPreviewContainer');
                    if (previewContainer) previewContainer.style.display = 'block';

                    await this.app.camera.attachToElement('cameraPreview', 'crosshairPreview');

                    const statusDot = document.getElementById('cameraStatus');
                    const statusText = document.getElementById('cameraStatusText');
                    if (statusDot) statusDot.classList.replace('disconnected', 'connected');
                    if (statusText) statusText.textContent = 'Connected';
                    if (btn) btn.textContent = 'Connected';

                    this.updateNextButton();
                }
            } catch (error) {
                console.warn('Failed to auto-connect camera:', error);
            }
        }
    }

    /**
     * Connect to printer
     */
    async connectPrinter() {
        const btn = document.getElementById('connectBtn');
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Connecting...';
        }

        try {
            await this.app.printer.connect();
            if (btn) btn.textContent = 'Connected';

            // Run printer initialization if configured
            if (this.options.initializePrinter) {
                await this.initializePrinter();
            }
        } catch (error) {
            if (btn) btn.textContent = 'Connect';
            alert(`Connection failed: ${error.message}`);
        }

        if (btn) btn.disabled = false;
        this.updateNextButton();
    }

    /**
     * Initialize printer after connection
     * Override onPrinterInitialize in options for custom behaviour
     */
    async initializePrinter() {
        try {
            // Disable IK corrections - we want raw machine positions
            await this.app.printer.sendCommandAndWait('G49', 3000);
            console.log('[Connect] Disabled IK corrections (G49)');

            // Disable calibration correction
            await this.app.printer.sendCommandAndWait('M667 S0', 3000);
            console.log('[Connect] Disabled calibration correction (M667 S0)');

            // Call custom initialization if provided
            if (this.options.onPrinterInitialize) {
                await this.options.onPrinterInitialize.call(this);
            }
        } catch (error) {
            console.warn('[Connect] Error initializing printer:', error);
        }
    }

    /**
     * Connect camera (for tools with camera support)
     */
    async connectCamera() {
        if (!this.options.hasCamera || !this.app.camera) return;

        const btn = document.getElementById('cameraConnectBtn');
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Connecting...';
        }

        try {
            await this.app.camera.requestAccess();

            // Show preview
            const previewContainer = document.getElementById('cameraPreviewContainer');
            if (previewContainer) {
                previewContainer.style.display = 'block';
            }

            await this.app.camera.attachToElement('cameraPreview', 'crosshairPreview');

            // Update status
            const statusDot = document.getElementById('cameraStatus');
            const statusText = document.getElementById('cameraStatusText');
            if (statusDot) statusDot.classList.replace('disconnected', 'connected');
            if (statusText) statusText.textContent = 'Connected';

            if (btn) btn.textContent = 'Connected';
        } catch (error) {
            if (btn) btn.textContent = 'Enable Camera';
            alert(`Camera access failed: ${error.message}`);
        }

        if (btn) btn.disabled = false;
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
        this.updateConnectionStatus(this.app.testMode || this.app.printer.isConnected());
        this.updateNextButton();
    }

    /**
     * Update next button state based on connections
     * Override canProceed in options for custom logic
     */
    updateNextButton() {
        let canProceed;

        if (this.options.canProceed) {
            canProceed = this.options.canProceed.call(this);
        } else {
            // Default logic: test mode OR (printer connected AND (no camera OR camera active))
            canProceed = this.app.testMode ||
                (this.app.printer.isConnected() &&
                 (!this.options.hasCamera || this.app.selectedMethod !== 'camera' || (this.app.camera && this.app.camera.isActive())));
        }

        const nextBtn = document.getElementById('nextBtn');
        if (nextBtn) {
            nextBtn.disabled = !canProceed;
        }
    }
}
