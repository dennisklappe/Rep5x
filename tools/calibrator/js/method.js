/**
 * Step 0: Method selection
 * Choose between camera-based or cone-based calibration
 */

class StepMethod {
    constructor(app) {
        this.app = app;
    }

    /**
     * Set up event listeners for this step
     */
    setup() {
        document.querySelectorAll('.method-card').forEach(card => {
            card.addEventListener('click', () => {
                this.selectMethod(card.dataset.method);
            });
        });
    }

    /**
     * Called when entering this step
     */
    enter() {
        document.getElementById('nextBtn').disabled = !this.app.selectedMethod;
    }

    /**
     * Select calibration method
     */
    selectMethod(method) {
        this.app.selectedMethod = method;

        // Update card styling
        document.querySelectorAll('.method-card').forEach(card => {
            if (card.dataset.method === method) {
                card.classList.add('selected');
            } else {
                card.classList.remove('selected');
            }
        });

        // Show/hide hardware link for camera method
        const hardwareLink = document.getElementById('hardwareLink');
        if (hardwareLink) {
            hardwareLink.style.display = method === 'camera' ? 'block' : 'none';
        }

        // Enable next button
        document.getElementById('nextBtn').disabled = false;
    }
}
