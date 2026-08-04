/**
 * Rep5x Firmware Tester
 * Verifies a freshly flashed firmware: drivers, endstops, stepper directions, homing, extruder.
 * Optionally consumes a JSON config from the Firmware Builder and produces a corrected JSON
 * if the hardware reports anything reversed.
 */

const STORAGE_KEY = 'rep5x_firmware_tester_state';
const FB_CONFIG_KEY = 'rep5x_firmware_builder_config';

const app = {
    printer: null,
    wizard: null,
    testMode: false,

    /** Configuration loaded from the Firmware Builder (or null). */
    fbConfig: null,
    /** Filename of the uploaded JSON, if any. Used in the corrected file's name. */
    fbConfigFilename: null,

    /** Per-axis results across the wizard, used by the Results step. */
    results: {
        firmware: null,           // 'pass' | 'fail' | null
        drivers: null,
        endstopsInitial: null,
        thermistors: null,
        endstopWalk:  { x: null, y: null, z: null, b: null, c: null },
        endstopLogic: {}, // axis => 'flip' if pre-flight read showed the logic-level inverted
        stepperDir:   { x: null, y: null, z: null, c: null, b: null }, // 'pass'|'reversed'|null
        homing:       { x: null, y: null, z: null },
        extruderDir: null,
        extruderStepsPerMm: null, // null if skipped, number if calibrated
    },

    /** Step modules, assigned during init(). */
    steps: {},
};

function initApp() {
    app.printer = new PrinterInterface({ logResponses: false });

    app.printer.onLog = (msg) => console.log('[printer]', msg);
    app.printer.onConnectionChange = () => {
        if (app.steps.connect) app.steps.connect.updateConnectionStatus(app.printer.isConnected());
    };

    // Wizard framework
    app.wizard = new WizardFramework({
        totalSteps: 7,
        onStepChange: (newStep) => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        },
    });
    app.wizard.init();

    // Build the step modules. They register their own canProceed/enter/leave handlers.
    app.steps.connect    = new StepConnect(app);
    app.steps.diag       = new StepDiagnostics(app);
    app.steps.endstop    = new StepEndstops(app);
    app.steps.stepper    = new StepSteppers(app);
    app.steps.homing     = new StepHoming(app);
    app.steps.extruder   = new StepExtruder(app);
    app.steps.results    = new StepResults(app);

    app.steps.connect.register(0);
    app.steps.diag.register(1);
    app.steps.endstop.register(2);
    app.steps.stepper.register(3);
    app.steps.homing.register(4);
    app.steps.extruder.register(5);
    app.steps.results.register(6);

    // Try auto-load Firmware Builder config from localStorage if it was saved there.
    tryAutoLoadFbConfig();
}

/**
 * If the Firmware Builder has saved its wizardState.config to localStorage, pull it in
 * so the user doesn't have to upload the JSON manually.
 */
function tryAutoLoadFbConfig() {
    try {
        const raw = localStorage.getItem(FB_CONFIG_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return;
        // Firmware Builder exports as { _meta, config }; accept either shape.
        app.fbConfig = parsed.config ? parsed.config : parsed;
        app.fbConfigFilename = 'firmware-builder-config.json';
        const filenameEl = document.getElementById('configFilename');
        if (filenameEl) filenameEl.textContent = '(auto-loaded from Firmware Builder)';
    } catch (e) {
        console.warn('Failed to auto-load Firmware Builder config:', e);
    }
}

document.addEventListener('DOMContentLoaded', initApp);
