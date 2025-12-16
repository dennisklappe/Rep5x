/**
 * Step 4: Results
 * Display final LA/LB values and save/export options
 */

class StepResults {
    constructor(app) {
        this.app = app;
    }

    /**
     * Set up event listeners for this step
     */
    setup() {
        document.getElementById('saveToStorage').addEventListener('click', () => this.saveResults());
        document.getElementById('exportJson').addEventListener('click', () => StorageManager.downloadJSON());
        document.getElementById('copyValues').addEventListener('click', () => this.copyToClipboard());
    }

    /**
     * Called when entering this step
     */
    enter() {
        const results = this.app.calibration.getResults();

        // Display LA
        document.getElementById('finalLaValue').textContent =
            MeasurementEngine.formatValue(results.la);
        document.getElementById('finalLaConsistency').innerHTML =
            results.laConsistency !== null
                ? `Asymmetry: &plusmn;${MeasurementEngine.formatValue(results.laConsistency, 3)}mm`
                : '';

        // Display LB
        document.getElementById('finalLbValue').textContent =
            MeasurementEngine.formatValue(results.lb);
        document.getElementById('finalLbConsistency').innerHTML =
            results.lbAsymmetry !== null
                ? `Asymmetry: ${MeasurementEngine.formatValue(results.lbAsymmetry, 3)}mm`
                : '';

        // Hide next button on final step
        document.getElementById('nextBtn').style.display = 'none';
    }

    /**
     * Save results to browser storage
     */
    saveResults() {
        const results = this.app.calibration.getResults();

        StorageManager.saveCalibrationResults(results.la, results.lb, {
            laConsistency: results.laConsistency,
            lbAsymmetry: results.lbAsymmetry,
            method: this.app.selectedMethod,
            testMode: this.app.testMode
        });

        // Update footer display immediately
        const footerLaInput = document.getElementById('savedLaValue');
        const footerLbInput = document.getElementById('savedLbValue');
        if (footerLaInput && results.la !== null) footerLaInput.value = results.la.toFixed(2);
        if (footerLbInput && results.lb !== null) footerLbInput.value = results.lb.toFixed(2);

        // Visual feedback on save button
        const saveBtn = document.getElementById('saveToStorage');
        const originalText = saveBtn.textContent;
        saveBtn.textContent = 'Saved!';
        setTimeout(() => {
            saveBtn.textContent = originalText;
        }, 1500);
    }

    /**
     * Copy values to clipboard
     */
    async copyToClipboard() {
        const results = this.app.calibration.getResults();
        const text = `LA: ${MeasurementEngine.formatValue(results.la)}\nLB: ${MeasurementEngine.formatValue(results.lb)}`;

        try {
            await navigator.clipboard.writeText(text);
            alert('Values copied to clipboard!');
        } catch (error) {
            prompt('Copy these values:', text);
        }
    }
}
