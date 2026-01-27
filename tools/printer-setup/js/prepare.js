/**
 * Step 1: Prepare - Home axes and move to starting position
 */

class StepPrepare {
    constructor(app) {
        this.app = app;
        this.isReady = false;
    }

    /**
     * Set up event listeners for this step
     */
    setup() {
        document.getElementById('prepareBtn').addEventListener('click', () => this.prepare());
        document.getElementById('skipPrepareBtn').addEventListener('click', () => this.skip());
    }

    /**
     * Skip the prepare step (for when printer is already prepared)
     */
    skip() {
        this.isReady = true;
        this.app.nextStep();
    }

    /**
     * Called when entering this step
     */
    enter() {
        this.isReady = false;
        document.getElementById('nextBtn').disabled = true;
        document.getElementById('prepareStatus').classList.add('hidden');
        document.getElementById('prepareBtn').disabled = false;
        document.getElementById('prepareBtn').textContent = 'Start preparation';
        this.resetAllItems();
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

            // Step 4: Disable IK (so rotations don't move XYZ)
            this.setItemActive('ik');
            btn.textContent = 'Disabling IK...';
            await this.app.printer.sendCommandAndWait('G49', 3000);
            this.setItemComplete('ik');

            // Step 5: Move to starting position
            // Move X/Y/A/B to absolute positions, but Z moves down 50mm relative (safer since Z max varies)
            this.setItemActive('position');
            btn.textContent = 'Moving to starting position...';
            await this.app.printer.sendCommandAndWait('G0 X100 Y100 C0 B0 F3000', 30000);
            await this.app.printer.sendCommandAndWait('G91', 5000); // Relative mode
            await this.app.printer.sendCommandAndWait('G0 Z-50 F1800', 30000); // Move down 50mm
            await this.app.printer.sendCommandAndWait('G90', 5000); // Back to absolute mode
            await this.app.printer.sendCommandAndWait('M400', 30000); // Wait for move to complete
            await this.app.printer.requestPosition(); // Update position display
            this.setItemComplete('position');

            // Done
            btn.textContent = 'Preparation complete';
            document.getElementById('prepareStatus').classList.remove('hidden');
            document.getElementById('nextBtn').disabled = false;
            this.isReady = true;

        } catch (error) {
            btn.textContent = 'Start preparation';
            btn.disabled = false;
            this.resetAllItems();
            alert(`Preparation failed: ${error.message}`);
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
        ['stepper', 'endstops', 'homing', 'ik', 'position'].forEach(id => {
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
