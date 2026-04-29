/**
 * Homing direction test.
 *
 * For each axis with a confirmed-working endstop, run G28 on that axis only and
 * ask the user whether the carriage moved toward the endstop. If it moved away,
 * the home_dir setting in the firmware is the wrong sign for the physical
 * endstop placement.
 *
 * We skip axes where the previous endstop step reported failure or skip — there's
 * no point homing if the endstop itself doesn't work, and the user has been warned
 * about this already.
 */

const HOMING_AXES = [
    { axis: 'x', cmd: 'G28 X', label: 'X' },
    { axis: 'y', cmd: 'G28 Y', label: 'Y' },
    { axis: 'z', cmd: 'G28 Z', label: 'Z' },
    { axis: 'b', cmd: 'G28 B', label: 'B' },
];

class StepHoming {
    constructor(app) {
        this.app = app;
        this.currentIndex = -1;
        this.completed = false;
    }

    register(stepIndex) {
        this.app.wizard.registerStep(stepIndex, {
            enter: () => this.enter(),
        });

        const startBtn = document.getElementById('startHomingBtn');
        const skipBtn = document.getElementById('skipHomingBtn');
        const moveBtn = document.getElementById('homingMoveBtn');
        const yesBtn = document.getElementById('homingYesBtn');
        const noBtn = document.getElementById('homingNoBtn');

        if (startBtn) startBtn.addEventListener('click', () => this.start());
        if (skipBtn) skipBtn.addEventListener('click', () => this.skip());
        if (moveBtn) moveBtn.addEventListener('click', () => this.sendHome());
        if (yesBtn) yesBtn.addEventListener('click', () => this.recordResult('pass'));
        if (noBtn) noBtn.addEventListener('click', () => this.recordResult('reversed'));
    }

    enter() {
        const nextBtn = document.getElementById('nextBtn');
        if (nextBtn) nextBtn.disabled = !this.completed;
    }

    async start() {
        const startBtn = document.getElementById('startHomingBtn');
        if (startBtn) startBtn.disabled = true;
        this.currentIndex = -1;
        await this.advance();
    }

    skip() {
        for (let i = Math.max(this.currentIndex, 0); i < HOMING_AXES.length; i++) {
            const axis = HOMING_AXES[i].axis;
            if (this.app.results.homing[axis] === null) {
                this.app.results.homing[axis] = 'skipped';
                this.setResult(axis, 'skipped');
            }
        }
        this.finish();
    }

    async advance() {
        this.currentIndex++;
        if (this.currentIndex >= HOMING_AXES.length) {
            this.finish();
            return;
        }

        const cfg = HOMING_AXES[this.currentIndex];
        // Auto-skip if the endstop step didn't pass for this axis.
        const endstopOk = this.app.results.endstopWalk[cfg.axis] === 'pass';
        if (!endstopOk) {
            this.app.results.homing[cfg.axis] = 'skipped-no-endstop';
            this.setResult(cfg.axis, 'skipped-no-endstop');
            this.advance();
            return;
        }

        const labelEl = document.getElementById('homingAxisLabel');
        const promptEl = document.getElementById('homingPrompt');
        const buttonsEl = document.getElementById('homingButtons');
        if (labelEl) labelEl.textContent = `${cfg.label} axis`;
        if (promptEl) promptEl.textContent = `Click "Send G28 for this axis" — the carriage should move toward the ${cfg.label} endstop.`;
        if (buttonsEl) buttonsEl.classList.remove('hidden');

        this.setResult(cfg.axis, 'ready');
        this.setButtonState({ moveEnabled: true, yesEnabled: false, noEnabled: false });
    }

    async sendHome() {
        const cfg = HOMING_AXES[this.currentIndex];
        if (!cfg) return;
        this.setButtonState({ moveEnabled: false, yesEnabled: false, noEnabled: false });
        try {
            await this.app.printer.sendCommandAndWait(cfg.cmd, 60000);
            this.setButtonState({ moveEnabled: false, yesEnabled: true, noEnabled: true });
        } catch (err) {
            this.setResult(cfg.axis, 'error');
            this.app.results.homing[cfg.axis] = 'fail';
            setTimeout(() => this.advance(), 1000);
        }
    }

    recordResult(verdict) {
        const cfg = HOMING_AXES[this.currentIndex];
        if (!cfg) return;
        this.app.results.homing[cfg.axis] = verdict;
        this.setResult(cfg.axis, verdict);
        this.advance();
    }

    setButtonState({ moveEnabled, yesEnabled, noEnabled }) {
        const moveBtn = document.getElementById('homingMoveBtn');
        const yesBtn = document.getElementById('homingYesBtn');
        const noBtn = document.getElementById('homingNoBtn');
        if (moveBtn) moveBtn.disabled = !moveEnabled;
        if (yesBtn) yesBtn.disabled = !yesEnabled;
        if (noBtn) noBtn.disabled = !noEnabled;
    }

    setResult(axis, state) {
        const el = document.getElementById(`homingResult-${axis}`);
        if (!el) return;
        const map = {
            'pending':            { text: 'pending', cls: '' },
            'ready':              { text: 'in progress', cls: 'waiting' },
            'pass':               { text: '✓ moved toward endstop', cls: 'pass' },
            'reversed':           { text: '✗ moved away (home dir reversed)', cls: 'fail' },
            'error':              { text: 'error', cls: 'fail' },
            'skipped':            { text: 'skipped', cls: 'skipped' },
            'skipped-no-endstop': { text: 'skipped (endstop didn\'t pass)', cls: 'skipped' },
        };
        const v = map[state] || map['pending'];
        el.textContent = v.text;
        el.className = `homing-result ${v.cls}`;
    }

    finish() {
        this.completed = true;
        const promptEl = document.getElementById('homingPrompt');
        const labelEl = document.getElementById('homingAxisLabel');
        const buttonsEl = document.getElementById('homingButtons');
        if (promptEl) promptEl.textContent = 'Homing direction tests complete.';
        if (labelEl) labelEl.textContent = '—';
        if (buttonsEl) buttonsEl.classList.add('hidden');

        const nextBtn = document.getElementById('nextBtn');
        if (nextBtn) nextBtn.disabled = false;
    }
}
