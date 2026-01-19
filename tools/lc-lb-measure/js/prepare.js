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

            // Step 3: Home all axes
            this.setItemActive('homing');
            btn.textContent = 'Homing all axes...';
            await this.app.printer.sendCommandAndWait('G28', 120000); // 2 min timeout for homing
            this.setItemComplete('homing');

            // Step 4: Move to starting position
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

            // Attach camera if using camera method
            if (this.app.selectedMethod === 'camera' && this.app.camera.isActive()) {
                this.app.camera.attachToElement('prepCamera', 'prepCrosshair');
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
     */
    confirmReference() {
        const position = this.app.printer.getPosition();

        // Store reference position for use in LC/LB measurements
        this.app.referencePosition = {
            x: position.x,
            y: position.y,
            z: position.z,
            c: position.c,
            b: position.b
        };


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
     * Skip the prepare step (for when printer is already prepared)
     */
    skip() {

        // Mark as ready without setting a reference position
        // Reference will be set during LC measurement at C=0 confirmation
        this.isReady = true;
        this.referenceConfirmed = true;

        // Enable next and advance
        document.getElementById('nextBtn').disabled = false;
        this.app.nextStep();
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
        ['stepper', 'endstops', 'homing', 'position'].forEach(id => {
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
}
