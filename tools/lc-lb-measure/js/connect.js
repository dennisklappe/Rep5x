/**
 * Step 1: Connection
 * Handle printer and camera connections for the LC/LB measurement tool
 * Extends StepConnectBase for shared connection functionality
 */

class StepConnect extends StepConnectBase {
    constructor(app) {
        super(app, {
            hasCamera: true,
            initializePrinter: true,
            onPrinterInitialize: async function() {
                await this.queryAndDisplayIkParams();
            }
        });
    }

    /**
     * Query LC and LB values from printer firmware via M665 and update footer displays
     */
    async queryAndDisplayIkParams() {
        try {
            const params = await this.app.printer.queryM665();
            console.log(`[Connect] Read from printer: LC=${params.lc}, LB=${params.lb}`);

            // Update footer displays
            const footerLcInput = document.getElementById('savedLcValue');
            const footerLbInput = document.getElementById('savedLbValue');
            if (footerLcInput) footerLcInput.value = params.lc.toFixed(2);
            if (footerLbInput) footerLbInput.value = params.lb.toFixed(2);
        } catch (e) {
            console.warn('[Connect] Failed to query M665:', e);
        }
    }
}
