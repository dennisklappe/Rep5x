/**
 * Step 4: Results
 * Display final LC/LB values and send to printer
 */

class StepResults {
    constructor(app) {
        this.app = app;
    }

    /**
     * Set up event listeners for this step
     */
    setup() {
        document.getElementById('sendToPrinter').addEventListener('click', () => this.sendToPrinter());
        document.getElementById('copyValues').addEventListener('click', () => this.copyToClipboard());
    }

    /**
     * Called when entering this step
     */
    async enter() {
        // Re-enable IK now that measurements are complete
        if (this.app.printer && this.app.printer.isConnected()) {
            try {
                await this.app.printer.sendCommandAndWait('G43.4', 5000);
            } catch (e) {
                console.warn('Could not re-enable IK:', e);
            }
        }

        const results = this.app.calibration.getResults();

        // Display LC
        document.getElementById('finalLcValue').textContent =
            MeasurementEngine.formatValue(results.lc);
        document.getElementById('finalLcConsistency').innerHTML =
            results.lcUncertainty !== null
                ? `Uncertainty: &plusmn;${MeasurementEngine.formatValue(results.lcUncertainty, 3)}mm`
                : '';

        // Display LB
        document.getElementById('finalLbValue').textContent =
            MeasurementEngine.formatValue(results.lb);
        document.getElementById('finalLbConsistency').innerHTML =
            results.lbUncertainty !== null
                ? `Uncertainty: &plusmn;${MeasurementEngine.formatValue(results.lbUncertainty, 3)}mm`
                : '';

        // Hide next button on final step
        document.getElementById('nextBtn').style.display = 'none';
    }

    /**
     * Copy values to clipboard
     */
    async copyToClipboard() {
        const results = this.app.calibration.getResults();
        const text = `LC: ${MeasurementEngine.formatValue(results.lc)}\nLB: ${MeasurementEngine.formatValue(results.lb)}`;

        try {
            await navigator.clipboard.writeText(text);
            const btn = document.getElementById('copyValues');
            const originalText = btn.textContent;
            btn.textContent = 'Copied!';
            setTimeout(() => {
                btn.textContent = originalText;
            }, 1500);
        } catch (error) {
            prompt('Copy these values:', text);
        }
    }

    /**
     * Send LC/LB values to printer firmware EEPROM
     * Only sends values that were actually measured
     */
    async sendToPrinter() {
        const results = this.app.calibration.getResults();
        const btn = document.getElementById('sendToPrinter');
        const originalText = btn.textContent;

        // Check if printer is connected
        if (!this.app.printer || !this.app.printer.isConnected()) {
            alert('Printer not connected. Please reconnect to send values.');
            return;
        }

        // Check if we have any values to send
        if (results.lc === null && results.lb === null) {
            alert('No measurements to send. Please complete at least one measurement.');
            return;
        }

        try {
            btn.disabled = true;
            btn.textContent = 'Sending...';

            // Build M665 command with only measured values
            // J = rotational_offset_y (LC), K = rotational_offset_z (LB)
            let m665Params = [];
            if (results.lc !== null) {
                m665Params.push(`J${results.lc.toFixed(2)}`);
                console.log(`[Results] Sending LC=${results.lc.toFixed(2)}`);
            }
            if (results.lb !== null) {
                m665Params.push(`K${results.lb.toFixed(2)}`);
                console.log(`[Results] Sending LB=${results.lb.toFixed(2)}`);
            }

            await this.app.printer.sendCommandAndWait(`M665 ${m665Params.join(' ')}`, 5000);

            // Save to EEPROM
            await this.app.printer.sendCommandAndWait('M500', 5000);
            console.log('[Results] Saved to EEPROM');

            // Re-enable IK with new values
            await this.app.printer.sendCommandAndWait('G43.4', 5000);

            btn.textContent = 'Sent!';
            setTimeout(() => {
                btn.textContent = originalText;
                btn.disabled = false;
            }, 2000);

        } catch (error) {
            alert(`Failed to send values: ${error.message}`);
            btn.textContent = originalText;
            btn.disabled = false;
        }
    }
}
