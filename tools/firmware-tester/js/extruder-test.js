/**
 * Extruder direction and (optional) E-steps calibration.
 *
 * Direction test: extrude 5 mm of filament (or just turn the motor with no filament loaded).
 * The user reports forward / reversed.
 *
 * E-steps calibration: extrude 100 mm at slow feedrate, ask the user to measure how much
 * filament was actually pulled in, compute corrected steps/mm =
 *     stepsE_current * (commanded / measured).
 */

class StepExtruder {
    constructor(app) {
        this.app = app;
        this.completed = false;
        this.lastCommandedExtrusion = 0;
    }

    register(stepIndex) {
        this.app.wizard.registerStep(stepIndex, {
            enter: () => this.enter(),
        });

        const dirBtn = document.getElementById('extruderDirBtn');
        const dirYes = document.getElementById('extruderDirYesBtn');
        const dirNo = document.getElementById('extruderDirNoBtn');
        const calBtn = document.getElementById('extrudeCalBtn');
        const measuredInput = document.getElementById('extrudeMeasured');
        const calculateBtn = document.getElementById('extrudeCalculateBtn');
        const skipBtn = document.getElementById('skipExtruderBtn');

        if (dirBtn) dirBtn.addEventListener('click', () => this.runDirectionTest());
        if (dirYes) dirYes.addEventListener('click', () => this.recordDirection('pass'));
        if (dirNo) dirNo.addEventListener('click', () => this.recordDirection('reversed'));
        if (calBtn) calBtn.addEventListener('click', () => this.runCalibration());
        if (measuredInput) measuredInput.addEventListener('input', () => this.updateCalculateButton());
        if (calculateBtn) calculateBtn.addEventListener('click', () => this.computeSteps());
        if (skipBtn) skipBtn.addEventListener('click', () => this.skipAll());
    }

    enter() {
        // Allow proceeding any time on this step. Extruder tests are optional.
        const nextBtn = document.getElementById('nextBtn');
        if (nextBtn) nextBtn.disabled = false;
    }

    async runDirectionTest() {
        const dirBtn = document.getElementById('extruderDirBtn');
        const dirYes = document.getElementById('extruderDirYesBtn');
        const dirNo = document.getElementById('extruderDirNoBtn');
        if (dirBtn) dirBtn.disabled = true;

        try {
            await this.app.printer.sendCommandAndWait('G91', 3000);
            await this.app.printer.sendCommandAndWait('G1 E5 F100', 30000);
            await this.app.printer.sendCommandAndWait('G90', 3000);
            if (dirYes) dirYes.disabled = false;
            if (dirNo) dirNo.disabled = false;
        } catch (err) {
            this.setDirResult('error', err.message);
            if (dirBtn) dirBtn.disabled = false;
        }
    }

    recordDirection(verdict) {
        this.app.results.extruderDir = verdict;
        this.setDirResult(verdict);
        const dirYes = document.getElementById('extruderDirYesBtn');
        const dirNo = document.getElementById('extruderDirNoBtn');
        if (dirYes) dirYes.disabled = true;
        if (dirNo) dirNo.disabled = true;
    }

    async runCalibration() {
        const calBtn = document.getElementById('extrudeCalBtn');
        if (calBtn) calBtn.disabled = true;
        this.lastCommandedExtrusion = 100;

        try {
            await this.app.printer.sendCommandAndWait('G91', 3000);
            // 100 mm at 1 mm/s, slow enough to avoid skipping if the steps/mm is very off.
            await this.app.printer.sendCommandAndWait('G1 E100 F60', 240000);
            await this.app.printer.sendCommandAndWait('G90', 3000);
            this.updateCalculateButton();
        } catch (err) {
            alert(`Extrude failed: ${err.message}`);
        }
        if (calBtn) calBtn.disabled = false;
    }

    updateCalculateButton() {
        const measuredInput = document.getElementById('extrudeMeasured');
        const calculateBtn = document.getElementById('extrudeCalculateBtn');
        if (!measuredInput || !calculateBtn) return;
        const measured = parseFloat(measuredInput.value);
        calculateBtn.disabled = !(measured > 0 && this.lastCommandedExtrusion > 0);
    }

    async computeSteps() {
        const measuredInput = document.getElementById('extrudeMeasured');
        const measured = parseFloat(measuredInput.value);
        if (!(measured > 0)) return;

        // Pull the current steps/mm from the firmware (M503 reports M92 lines).
        let currentSteps = null;
        try {
            const captured = await this.app.printer.sendCommandAndCapture('M503', 5000);
            const match = captured.match(/M92[^\n]*?E([\d.]+)/i);
            if (match) currentSteps = parseFloat(match[1]);
        } catch (e) { /* fall through */ }

        // Fallback: use the value from the uploaded FB config if the live query failed.
        if (currentSteps === null && this.app.fbConfig?.stepsE) {
            currentSteps = parseFloat(this.app.fbConfig.stepsE);
        }
        if (currentSteps === null || !(currentSteps > 0)) {
            alert('Could not read current E-steps from M503 and no Firmware Builder config was loaded.');
            return;
        }

        const corrected = currentSteps * (this.lastCommandedExtrusion / measured);
        this.app.results.extruderStepsPerMm = corrected;

        const calResult = document.getElementById('extrudeCalResult');
        const calValue = document.getElementById('extrudeCalValue');
        if (calResult) calResult.classList.remove('hidden');
        if (calValue) calValue.textContent = corrected.toFixed(2);
    }

    setDirResult(state, detail) {
        const el = document.getElementById('extruderDirResult');
        if (!el) return;
        const map = {
            'pending':  { text: 'pending', cls: '' },
            'pass':     { text: '✓ forward', cls: 'pass' },
            'reversed': { text: '✗ reversed', cls: 'fail' },
            'error':    { text: detail || 'error', cls: 'fail' },
        };
        const v = map[state] || map['pending'];
        el.textContent = v.text;
        el.className = `extruder-result ${v.cls}`;
    }

    skipAll() {
        if (this.app.results.extruderDir === null) this.app.results.extruderDir = 'skipped';
    }
}
