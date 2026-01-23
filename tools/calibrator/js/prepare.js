/**
 * Step 2: Prepare - Home axes, move to starting position, set reference point
 * Similar to printer-setup prepare but with reference point confirmation
 */

class StepPrepare {
    constructor(app) {
        this.app = app;
        this.isReady = false;
        this.referenceConfirmed = false;
    }

    /**
     * Set up event listeners for this step
     */
    setup() {
        document.getElementById('prepareBtn').addEventListener('click', () => this.prepare());
        document.getElementById('confirmReferenceBtn').addEventListener('click', () => this.confirmReference());
        document.getElementById('skipPrepareBtn').addEventListener('click', () => this.skip());
        document.getElementById('skipToZFromPrepBtn')?.addEventListener('click', () => this.skipToZ());

        // Camera reconnect button
        const reconnectBtn = document.getElementById('reconnect-camera-btn-prep');
        if (reconnectBtn) {
            reconnectBtn.addEventListener('click', () => this.reconnectCamera());
        }
    }

    /**
     * Skip XY calibration entirely, go straight to Z calibration
     */
    skipToZ() {
        // Skip steps 2 (prepare) and 3 (XY calibration), go to step 4 (Z calibration)
        this.app.currentStep = 4;
        this.app.showStep(4);
    }

    /**
     * Called when entering this step
     */
    enter() {
        this.isReady = false;
        this.referenceConfirmed = false;
        document.getElementById('nextBtn').disabled = true;
        document.getElementById('prepareStatus').classList.add('hidden');
        document.getElementById('referencePanel').classList.add('hidden');
        document.getElementById('prepareBtn').disabled = false;
        document.getElementById('prepareBtn').textContent = 'Start preparation';
        this.resetAllItems();

        // Show correct camera/cone panel for reference positioning
        const cameraRefPanel = document.getElementById('prepCameraPanel');
        const coneRefPanel = document.getElementById('prepConePanel');
        if (cameraRefPanel) cameraRefPanel.style.display = this.app.selectedMethod === 'camera' ? 'block' : 'none';
        if (coneRefPanel) coneRefPanel.style.display = this.app.selectedMethod === 'cone' ? 'block' : 'none';

        // Pre-attach camera if available (so it's ready when reference panel is shown)
        if (this.app.selectedMethod === 'camera') {
            // Attach stream to video element (even though panel is hidden, stream is ready)
            setTimeout(async () => {
                await this.app.camera.attachToElement('prepCamera', 'prepCrosshair');
            }, 100);
        }
    }

    /**
     * Run the preparation sequence
     */
    async prepare() {
        const btn = document.getElementById('prepareBtn');
        btn.disabled = true;

        try {
            // Step 1: Disable stepper timeout
            this.setItemActive('stepper');
            btn.textContent = 'Disabling stepper timeout...';
            await this.app.printer.sendCommandAndWait('M18 S0', 5000);
            this.setItemComplete('stepper');

            // Step 2: Disable software endstops
            this.setItemActive('endstops');
            btn.textContent = 'Disabling software endstops...';
            await this.app.printer.sendCommandAndWait('M211 S0', 5000);
            this.setItemComplete('endstops');

            // Step 3: Disable IK (so rotations don't move XYZ)
            this.setItemActive('ik');
            btn.textContent = 'Disabling inverse kinematics...';
            await this.app.printer.sendCommandAndWait('G49', 5000);
            this.setItemComplete('ik');

            // Step 4: Home all axes
            this.setItemActive('homing');
            btn.textContent = 'Homing all axes...';
            await this.app.printer.sendCommandAndWait('G28', 120000); // 2 min timeout for homing
            this.setItemComplete('homing');

            // Step 5: Move to starting position
            this.setItemActive('position');
            btn.textContent = 'Moving to starting position...';
            await this.app.printer.sendCommandAndWait('G0 X100 Y100 Z50 C0 B0 F3000', 30000);
            await this.app.printer.sendCommandAndWait('M400', 30000); // Wait for move to complete
            await this.app.printer.requestPosition(); // Update position display
            this.setItemComplete('position');

            // Done with auto-preparation
            btn.textContent = 'Preparation complete';
            document.getElementById('prepareStatus').classList.remove('hidden');
            this.isReady = true;

            // Show reference positioning panel
            document.getElementById('referencePanel').classList.remove('hidden');

            // Attach camera if using camera method (with delay to ensure panel is rendered)
            if (this.app.selectedMethod === 'camera') {
                setTimeout(async () => {
                    try {
                        // Force fresh camera stream after long prep sequence
                        // Browser may have throttled the old stream
                        if (!this.app.camera.isActive()) {
                            console.log('Camera not active after prep, requesting fresh stream');
                            await this.app.camera.requestAccess();
                        }
                        this.app.camera.setMode('crosshair');
                        await this.app.camera.attachToElement('prepCamera', 'prepCrosshair');
                        // Force video to play after panel is visible
                        const video = document.getElementById('prepCamera');
                        if (video) {
                            video.style.transform = 'scale(2)';  // 2x zoom for reference
                            video.play().catch(() => {});
                        }
                    } catch (e) {
                        console.warn('Failed to attach camera:', e);
                        if (this.app.testMode) {
                            this.renderTestModePlaceholder();
                        }
                    }
                }, 100);
            }

        } catch (error) {
            btn.textContent = 'Start preparation';
            btn.disabled = false;
            this.resetAllItems();
            alert(`Preparation failed: ${error.message}`);
        }
    }

    /**
     * Confirm the reference position (camera focus point / cone tip position)
     * After confirmation, IK is enabled so firmware handles all position compensation
     */
    async confirmReference() {
        const position = this.app.printer.getPosition();

        // Safety check: don't allow reference Z below MIN_SAFE_Z
        const MIN_SAFE_Z = CalibratorApp.MIN_SAFE_Z || 10;
        if (position.z < MIN_SAFE_Z) {
            alert(`Reference Z (${position.z.toFixed(2)}mm) is below minimum safe height (${MIN_SAFE_Z}mm).\n\nPlease raise the nozzle before confirming.`);
            return;
        }

        // Store reference position for use in calibration
        this.app.referencePosition = {
            x: position.x,
            y: position.y,
            z: position.z,
            c: position.c,
            b: position.b
        };

        // Set reference position in calibration engine
        this.app.engine.setReferencePosition(position.x, position.y, position.z);

        // Enable IK - firmware will now handle position compensation for all C/B rotations
        // This means we can just send G0 Xref Yref Zref Cangle Bangle and firmware does the rest
        try {
            await this.app.printer.sendCommandAndWait('G43.4', 5000);
            console.log('[Prepare] IK enabled (G43.4) - firmware will handle position compensation');
        } catch (error) {
            console.warn('[Prepare] Failed to enable IK:', error);
        }

        // Update UI
        document.getElementById('refPosDisplay').textContent =
            `X: ${position.x.toFixed(2)}, Y: ${position.y.toFixed(2)}, Z: ${position.z.toFixed(2)}`;
        document.getElementById('refPosDisplay').classList.remove('text-gray-500');
        document.getElementById('refPosDisplay').classList.add('text-primary', 'font-medium');

        document.getElementById('confirmReferenceBtn').textContent = 'Reference confirmed ✓';
        document.getElementById('confirmReferenceBtn').disabled = true;
        document.getElementById('confirmReferenceBtn').classList.remove('btn-primary');
        document.getElementById('confirmReferenceBtn').classList.add('status-success', 'cursor-not-allowed');

        this.referenceConfirmed = true;
        document.getElementById('nextBtn').disabled = false;

        // Auto-advance to next step
        this.app.nextStep();
    }

    /**
     * Skip the automatic preparation (homing etc) but still allow setting reference point
     */
    async skip() {
        // Mark preparation steps as skipped
        document.getElementById('prepareBtn').textContent = 'Skipped';
        document.getElementById('prepareBtn').disabled = true;
        document.getElementById('skipPrepareBtn').disabled = true;

        // Show reference positioning panel so user can set reference point
        document.getElementById('referencePanel').classList.remove('hidden');
        this.isReady = true;

        // Request current position
        await this.app.printer.requestPosition();

        // Attach camera if using camera method
        if (this.app.selectedMethod === 'camera') {
            setTimeout(async () => {
                try {
                    // Ensure camera is active
                    if (!this.app.camera.isActive()) {
                        console.log('Camera not active, requesting fresh stream');
                        await this.app.camera.requestAccess();
                    }
                    this.app.camera.setMode('crosshair');
                    await this.app.camera.attachToElement('prepCamera', 'prepCrosshair');
                    const video = document.getElementById('prepCamera');
                    if (video) {
                        video.style.transform = 'scale(2)';  // 2x zoom for reference
                        video.play().catch(() => {});
                    }
                } catch (e) {
                    console.warn('Failed to attach camera:', e);
                    if (this.app.testMode) {
                        this.renderTestModePlaceholder();
                    }
                }
            }, 100);
        }
    }

    /**
     * Set an item as active (in progress)
     */
    setItemActive(id) {
        const el = document.getElementById(`prep-${id}`);
        if (!el) return;
        el.classList.remove('text-gray-400');
        el.classList.add('text-primary', 'font-medium');
    }

    /**
     * Set an item as complete (green with checkmark)
     */
    setItemComplete(id) {
        const el = document.getElementById(`prep-${id}`);
        if (!el) return;
        el.classList.remove('font-medium');
        el.classList.add('text-primary');
        const icon = el.querySelector('.prep-icon');
        if (icon) {
            icon.classList.remove('opacity-0');
            icon.classList.add('opacity-100');
        }
    }

    /**
     * Reset all items to initial state
     */
    resetAllItems() {
        ['stepper', 'endstops', 'ik', 'homing', 'position'].forEach(id => {
            const el = document.getElementById(`prep-${id}`);
            if (!el) return;
            el.classList.remove('text-primary', 'font-medium');
            el.classList.add('text-gray-400');
            const icon = el.querySelector('.prep-icon');
            if (icon) {
                icon.classList.remove('opacity-100');
                icon.classList.add('opacity-0');
            }
        });
    }

    /**
     * Render test mode placeholder with crosshair on canvas
     */
    renderTestModePlaceholder() {
        const canvas = document.getElementById('prepCrosshair');
        if (!canvas) return;

        const container = canvas.parentElement;
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;

        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;

        // Dark background
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, width, height);

        // Test mode label
        ctx.fillStyle = '#666';
        ctx.font = '14px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('TEST MODE - No camera', width / 2, height / 2 - 40);

        // Draw crosshair
        const centerX = width / 2;
        const centerY = height / 2;
        const size = Math.min(width, height) * 0.15;
        const circleRadius = size * 0.6;
        const gap = circleRadius * 0.4;

        ctx.strokeStyle = '#32D74B';
        ctx.lineWidth = 2;

        // Horizontal line
        ctx.beginPath();
        ctx.moveTo(centerX - size, centerY);
        ctx.lineTo(centerX - gap, centerY);
        ctx.moveTo(centerX + gap, centerY);
        ctx.lineTo(centerX + size, centerY);
        ctx.stroke();

        // Vertical line
        ctx.beginPath();
        ctx.moveTo(centerX, centerY - size);
        ctx.lineTo(centerX, centerY - gap);
        ctx.moveTo(centerX, centerY + gap);
        ctx.lineTo(centerX, centerY + size);
        ctx.stroke();

        // Circle
        ctx.beginPath();
        ctx.arc(centerX, centerY, circleRadius, 0, Math.PI * 2);
        ctx.stroke();

        // Centre dot
        ctx.fillStyle = '#32D74B';
        ctx.beginPath();
        ctx.arc(centerX, centerY, 3, 0, Math.PI * 2);
        ctx.fill();
    }

    /**
     * Reconnect camera if it becomes disconnected or shows black
     */
    async reconnectCamera() {
        const btn = document.getElementById('reconnect-camera-btn-prep');
        if (btn) btn.textContent = '...';

        try {
            // Stop current stream and request new one
            this.app.camera.stop();
            await this.app.camera.requestAccess();
            this.app.camera.setMode('crosshair');
            await this.app.camera.attachToElement('prepCamera', 'prepCrosshair');

            // Force video to play with zoom
            const video = document.getElementById('prepCamera');
            if (video) {
                video.style.transform = 'scale(2)';  // 2x zoom for reference
                video.play().catch(() => {});
            }

            if (btn) btn.textContent = '↻ Camera';
        } catch (e) {
            console.error('Failed to reconnect camera:', e);
            if (btn) btn.textContent = '✗ Failed';
            setTimeout(() => { if (btn) btn.textContent = '↻ Camera'; }, 2000);
        }
    }
}
