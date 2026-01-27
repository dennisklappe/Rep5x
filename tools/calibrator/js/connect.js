/**
 * Step 1: Connection
 * Handle printer and camera connections for the calibrator tool
 * Extends StepConnectBase for shared connection functionality
 */

class StepConnect extends StepConnectBase {
    constructor(app) {
        super(app, {
            hasCamera: true,
            initializePrinter: false
        });
    }
}
