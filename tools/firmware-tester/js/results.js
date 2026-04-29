/**
 * Results step.
 *
 * Renders a summary of every test, computes a corrected Firmware Builder JSON
 * config based on the test results, and offers download / clipboard copy.
 */

class StepResults {
    constructor(app) {
        this.app = app;
        this.correctedConfig = null;
    }

    register(stepIndex) {
        this.app.wizard.registerStep(stepIndex, {
            enter: () => this.enter(),
        });

        const downloadBtn = document.getElementById('downloadConfigBtn');
        const copyBtn = document.getElementById('copyConfigBtn');
        if (downloadBtn) downloadBtn.addEventListener('click', () => this.download());
        if (copyBtn) copyBtn.addEventListener('click', () => this.copy());
    }

    enter() {
        this.renderSummary();
        this.computeCorrections();
    }

    renderSummary() {
        const list = document.getElementById('resultsSummary');
        if (!list) return;
        list.innerHTML = '';

        const r = this.app.results;
        const rows = [
            { label: 'Firmware ID (M115)',           state: r.firmware },
            { label: 'TMC drivers (M122)',           state: r.drivers },
            { label: 'Endstops untriggered (M119)',  state: r.endstopsInitial },
            { label: 'Thermistors (M105)',           state: r.thermistors },
            { label: 'X endstop trigger',            state: r.endstopWalk.x },
            { label: 'Y endstop trigger',            state: r.endstopWalk.y },
            { label: 'Z endstop trigger',            state: r.endstopWalk.z },
            { label: 'B endstop trigger',            state: r.endstopWalk.b },
            { label: 'C homing sensor',              state: r.endstopWalk.c },
            { label: 'X stepper direction',          state: r.stepperDir.x },
            { label: 'Y stepper direction',          state: r.stepperDir.y },
            { label: 'Z stepper direction',          state: r.stepperDir.z },
            { label: 'C stepper direction',          state: r.stepperDir.c },
            { label: 'B stepper direction',          state: r.stepperDir.b },
            { label: 'X homing direction',           state: r.homing.x },
            { label: 'Y homing direction',           state: r.homing.y },
            { label: 'Z homing direction',           state: r.homing.z },
            { label: 'B homing direction',           state: r.homing.b },
            { label: 'Extruder direction',           state: r.extruderDir },
            { label: 'E-steps calibration',          state: r.extruderStepsPerMm !== null ? `→ ${r.extruderStepsPerMm.toFixed(2)} steps/mm` : 'skipped' },
        ];

        for (const row of rows) {
            const div = document.createElement('div');
            div.className = 'flex items-center justify-between py-1 border-b border-gray-100 last:border-b-0';
            const labelSpan = document.createElement('span');
            labelSpan.textContent = row.label;
            const valueSpan = document.createElement('span');
            valueSpan.className = `text-xs font-medium ${this.summaryClass(row.state)}`;
            valueSpan.textContent = this.summaryText(row.state);
            div.appendChild(labelSpan);
            div.appendChild(valueSpan);
            list.appendChild(div);
        }
    }

    summaryText(state) {
        if (state === null || state === undefined) return 'not run';
        if (state === 'pass') return '✓ pass';
        if (state === 'fail') return '✗ fail';
        if (state === 'reversed') return '✗ reversed';
        if (state === 'skipped') return 'skipped';
        if (state === 'skipped-no-endstop') return 'skipped (no endstop)';
        if (state === 'timeout') return 'timed out';
        if (state === 'no-report') return 'not reported';
        return String(state);
    }

    summaryClass(state) {
        if (state === 'pass') return 'text-green-600';
        if (state === 'fail' || state === 'reversed' || state === 'timeout' || state === 'no-report') return 'text-red-600';
        if (state === null || state === undefined) return 'text-gray-400';
        if (typeof state === 'string' && state.startsWith('→')) return 'text-blue-600';
        return 'text-gray-500';
    }

    /**
     * Walk through the test results and produce a corrected Firmware Builder config.
     * - Stepper direction reversed → flip invertX/Y/Z/C/B/E
     * - Homing direction reversed → flip xHomeDir/yHomeDir/zHomeDir (B is symmetric, leave untouched)
     * - E-steps calibrated → update stepsE
     *
     * If no FB config was uploaded, we just list the corrections in human-readable form.
     */
    computeCorrections() {
        const panel = document.getElementById('correctionsPanel');
        const list = document.getElementById('correctionsList');
        const actions = document.getElementById('configActions');
        const noConfigNotice = document.getElementById('noConfigNotice');
        if (!panel || !list) return;

        const corrections = [];
        const r = this.app.results;

        const flipMap = {
            x: { invertKey: 'invertX', homeKey: 'xHomeDir', label: 'X' },
            y: { invertKey: 'invertY', homeKey: 'yHomeDir', label: 'Y' },
            z: { invertKey: 'invertZ', homeKey: 'zHomeDir', label: 'Z' },
            c: { invertKey: 'invertC', homeKey: null,        label: 'C' },
            b: { invertKey: 'invertB', homeKey: null,        label: 'B' },
        };

        for (const [axis, m] of Object.entries(flipMap)) {
            if (r.stepperDir[axis] === 'reversed') {
                corrections.push({ key: m.invertKey, kind: 'flip-bool', label: `${m.label} stepper direction` });
            }
        }
        for (const axis of ['x', 'y', 'z']) {
            if (r.homing[axis] === 'reversed') {
                corrections.push({ key: flipMap[axis].homeKey, kind: 'flip-sign', label: `${flipMap[axis].label} home direction` });
            }
        }
        if (r.extruderDir === 'reversed') {
            corrections.push({ key: 'invertE', kind: 'flip-bool', label: 'Extruder direction' });
        }
        if (r.extruderStepsPerMm !== null) {
            corrections.push({ key: 'stepsE', kind: 'set-value', value: r.extruderStepsPerMm, label: 'Extruder steps/mm' });
        }

        if (corrections.length === 0) {
            panel.classList.remove('hidden');
            list.innerHTML = '<div class="text-sm text-green-600">No corrections needed. The flashed firmware matches your hardware.</div>';
            if (actions) actions.classList.add('hidden');
            if (noConfigNotice) noConfigNotice.classList.add('hidden');
            this.correctedConfig = null;
            return;
        }

        panel.classList.remove('hidden');
        list.innerHTML = '';
        for (const c of corrections) {
            const line = document.createElement('div');
            if (c.kind === 'flip-bool')      line.textContent = `${c.label}: flip ${c.key}`;
            else if (c.kind === 'flip-sign') line.textContent = `${c.label}: flip sign of ${c.key}`;
            else if (c.kind === 'set-value') line.textContent = `${c.label}: ${c.key} = ${c.value.toFixed(2)}`;
            list.appendChild(line);
        }

        if (this.app.fbConfig) {
            this.correctedConfig = this.applyCorrections(this.app.fbConfig, corrections);
            if (actions) actions.classList.remove('hidden');
            if (noConfigNotice) noConfigNotice.classList.add('hidden');
        } else {
            this.correctedConfig = null;
            if (actions) actions.classList.add('hidden');
            if (noConfigNotice) noConfigNotice.classList.remove('hidden');
        }
    }

    /** Apply the discovered corrections to a deep copy of the original config. */
    applyCorrections(config, corrections) {
        const out = JSON.parse(JSON.stringify(config));
        for (const c of corrections) {
            if (!c.key) continue;
            if (c.kind === 'flip-bool') {
                out[c.key] = !out[c.key];
            } else if (c.kind === 'flip-sign') {
                const current = parseFloat(out[c.key]);
                if (!Number.isNaN(current)) out[c.key] = -current;
            } else if (c.kind === 'set-value') {
                out[c.key] = c.value;
            }
        }
        return out;
    }

    download() {
        if (!this.correctedConfig) return;
        const json = JSON.stringify(this.correctedConfig, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const original = this.app.fbConfigFilename || 'firmware-builder-config.json';
        a.download = original.replace(/(\.json)?$/i, '-corrected.json');
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    async copy() {
        if (!this.correctedConfig) return;
        const json = JSON.stringify(this.correctedConfig, null, 2);
        try {
            await navigator.clipboard.writeText(json);
            const btn = document.getElementById('copyConfigBtn');
            if (btn) {
                const original = btn.textContent;
                btn.textContent = 'Copied!';
                setTimeout(() => { btn.textContent = original; }, 1500);
            }
        } catch (err) {
            alert(`Copy failed: ${err.message}`);
        }
    }
}
