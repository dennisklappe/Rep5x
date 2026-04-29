/**
 * Diagnostics step — runs M115, M122, M119, M105 and reports pass/fail per check.
 * Doesn't move any motor. Safe to run before the mechanism is even fully assembled.
 */

class StepDiagnostics {
    constructor(app) {
        this.app = app;
        this.runBtn = null;
        this.rerunBtn = null;
        this.rawOutput = null;
        this.completed = false;
    }

    register(stepIndex) {
        this.app.wizard.registerStep(stepIndex, {
            enter: () => this.enter(),
            canProceed: () => this.canProceed(),
        });

        this.runBtn = document.getElementById('runDiagBtn');
        this.rerunBtn = document.getElementById('rerunDiagBtn');
        this.rawOutput = document.getElementById('diagRawOutput');

        if (this.runBtn) this.runBtn.addEventListener('click', () => this.runChecks());
        if (this.rerunBtn) this.rerunBtn.addEventListener('click', () => this.runChecks());
    }

    enter() {
        // Allow proceeding only after the user has at least seen the diagnostics result.
        const nextBtn = document.getElementById('nextBtn');
        if (nextBtn) nextBtn.disabled = !this.completed;
    }

    canProceed() {
        return this.completed;
    }

    setStatus(checkId, statusChar, detailText, klass) {
        const statusEl = document.getElementById(`diag-${checkId}-status`);
        const detailEl = document.getElementById(`diag-${checkId}-detail`);
        if (statusEl) {
            statusEl.textContent = statusChar;
            statusEl.className = `diag-status ${klass || ''}`;
        }
        if (detailEl && detailText !== undefined) {
            detailEl.textContent = detailText;
        }
    }

    async runChecks() {
        if (this.runBtn) this.runBtn.disabled = true;

        const printer = this.app.printer;
        const allRaw = [];

        // 1. Firmware identifier
        try {
            this.setStatus('firmware', '⋯', 'Querying...', '');
            const info = await printer.queryFirmwareInfo();
            allRaw.push(`--- M115 ---\n${info.raw}`);
            const ok = !!info.firmware;
            this.setStatus('firmware', ok ? '✓' : '✗', info.firmware || 'No FIRMWARE_NAME line in response', ok ? 'pass' : 'fail');
            this.app.results.firmware = ok ? 'pass' : 'fail';
        } catch (err) {
            this.setStatus('firmware', '✗', `Error: ${err.message}`, 'fail');
            this.app.results.firmware = 'fail';
        }

        // 2. TMC drivers
        try {
            this.setStatus('drivers', '⋯', 'Querying...', '');
            const drv = await printer.queryDriverStatus();
            allRaw.push(`--- M122 ---\n${drv.raw}`);
            if (drv.ok) {
                this.setStatus('drivers', '✓', 'All drivers responded on UART', 'pass');
                this.app.results.drivers = 'pass';
            } else {
                this.setStatus('drivers', '✗', `UART issue: ${drv.brokenAxes.join(', ')}`, 'fail');
                this.app.results.drivers = 'fail';
            }
        } catch (err) {
            this.setStatus('drivers', '✗', `Error: ${err.message}`, 'fail');
            this.app.results.drivers = 'fail';
        }

        // 3. Endstop initial state — none should be triggered
        try {
            this.setStatus('endstops', '⋯', 'Querying...', '');
            const ends = await printer.queryEndstops();
            allRaw.push(`--- M119 ---\n${ends.raw}`);
            const triggered = ['x', 'y', 'z', 'b', 'c'].filter(a => ends[a] === 'TRIGGERED');
            if (triggered.length === 0) {
                this.setStatus('endstops', '✓', 'No endstop is currently triggered', 'pass');
                this.app.results.endstopsInitial = 'pass';
            } else {
                this.setStatus('endstops', '✗', `Triggered (should be open): ${triggered.join(', ')}`, 'fail');
                this.app.results.endstopsInitial = 'fail';
            }
        } catch (err) {
            this.setStatus('endstops', '✗', `Error: ${err.message}`, 'fail');
            this.app.results.endstopsInitial = 'fail';
        }

        // 4. Thermistors should read near room temperature
        try {
            this.setStatus('thermistors', '⋯', 'Querying...', '');
            const captured = await printer.sendCommandAndCapture('M105', 5000);
            allRaw.push(`--- M105 ---\n${captured}`);
            // M105 line: "ok T:23.4 /0.0 B:24.1 /0.0"
            const tMatch = captured.match(/T:([-\d.]+)/i);
            const bMatch = captured.match(/(?:^|\s)B:([-\d.]+)/i);
            const t = tMatch ? parseFloat(tMatch[1]) : null;
            const b = bMatch ? parseFloat(bMatch[1]) : null;

            const sane = (v) => v !== null && v >= 5 && v <= 50;
            if (sane(t) && sane(b)) {
                this.setStatus('thermistors', '✓', `Hot-end ${t.toFixed(1)}°C, bed ${b.toFixed(1)}°C`, 'pass');
                this.app.results.thermistors = 'pass';
            } else {
                const detail = `Hot-end ${t === null ? '?' : t}°C, bed ${b === null ? '?' : b}°C — expected 5–50°C`;
                this.setStatus('thermistors', '✗', detail, 'fail');
                this.app.results.thermistors = 'fail';
            }
        } catch (err) {
            this.setStatus('thermistors', '✗', `Error: ${err.message}`, 'fail');
            this.app.results.thermistors = 'fail';
        }

        if (this.rawOutput) this.rawOutput.textContent = allRaw.join('\n\n');

        if (this.runBtn) this.runBtn.classList.add('hidden');
        if (this.rerunBtn) this.rerunBtn.classList.remove('hidden');
        this.completed = true;

        const nextBtn = document.getElementById('nextBtn');
        if (nextBtn) nextBtn.disabled = false;
    }
}
