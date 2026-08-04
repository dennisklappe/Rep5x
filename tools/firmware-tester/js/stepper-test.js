/**
 * Stepper direction test.
 *
 * For each axis, send a small relative move and ask the user whether the axis
 * moved in the expected (positive) direction. A "no" flips the corresponding
 * invert flag in the corrected configuration.
 *
 * Note: this only verifies that the user-visible coordinate frame matches what
 * +X / +Y / +Z / +C / +B mean physically. It doesn't yet check homing direction
 * (that's the next step).
 */

const STEPPER_AXES = [
    { axis: 'x', invertKey: 'invertX', moveCmd: 'G1 X10 F600',  prompt: 'Sending +10 mm on X. The X carriage should move toward what you consider +X (right by convention).' },
    { axis: 'y', invertKey: 'invertY', moveCmd: 'G1 Y10 F600',  prompt: 'Sending +10 mm on Y. The Y carriage / bed should move toward what you consider +Y (away from you by convention).' },
    { axis: 'z', invertKey: 'invertZ', moveCmd: 'G1 Z5 F300',   prompt: 'Sending +5 mm on Z. Z should move toward Z-max (up for bed-down, down for bed-up systems; match your home direction).' },
    { axis: 'c', invertKey: 'invertC', moveCmd: 'G1 C30 F1500', prompt: 'Sending +30° on C. The build plate should rotate counter-clockwise viewed from above.' },
    { axis: 'b', invertKey: 'invertB', moveCmd: 'G1 B15 F1500', prompt: 'Sending +15° on B. The B-arm should tilt to the +B direction defined for your build (typically left when viewed from front).' },
];

class StepSteppers {
    constructor(app) {
        this.app = app;
        this.currentIndex = -1;
        this.completed = false;
    }

    register(stepIndex) {
        this.app.wizard.registerStep(stepIndex, {
            enter: () => this.enter(),
        });

        const startBtn = document.getElementById('startStepperBtn');
        const skipBtn = document.getElementById('skipStepperBtn');
        const moveBtn = document.getElementById('stepperMoveBtn');
        const yesBtn = document.getElementById('stepperYesBtn');
        const noBtn = document.getElementById('stepperNoBtn');

        if (startBtn) startBtn.addEventListener('click', () => this.start());
        if (skipBtn) skipBtn.addEventListener('click', () => this.skipRemaining());
        if (moveBtn) moveBtn.addEventListener('click', () => this.sendMove());
        if (yesBtn) yesBtn.addEventListener('click', () => this.recordResult('pass'));
        if (noBtn) noBtn.addEventListener('click', () => this.recordResult('reversed'));
    }

    enter() {
        const nextBtn = document.getElementById('nextBtn');
        if (nextBtn) nextBtn.disabled = !this.completed;
    }

    async start() {
        const startBtn = document.getElementById('startStepperBtn');
        if (startBtn) startBtn.disabled = true;

        // Make sure software endstops aren't blocking small relative moves.
        try {
            await this.app.printer.sendCommandAndWait('M211 S0', 3000);
        } catch (e) { /* non-fatal */ }

        this.currentIndex = -1;
        await this.advance();
    }

    async advance() {
        this.currentIndex++;
        if (this.currentIndex >= STEPPER_AXES.length) {
            this.finish();
            return;
        }

        const cfg = STEPPER_AXES[this.currentIndex];
        const labelEl = document.getElementById('stepperAxisLabel');
        const promptEl = document.getElementById('stepperPrompt');
        const buttonsEl = document.getElementById('stepperButtons');
        if (labelEl) labelEl.textContent = `${cfg.axis.toUpperCase()} axis`;
        if (promptEl) promptEl.textContent = cfg.prompt;
        if (buttonsEl) buttonsEl.classList.remove('hidden');

        this.setResult(cfg.axis, 'ready');
        this.setButtonState({ moveEnabled: true, yesEnabled: false, noEnabled: false });
    }

    async sendMove() {
        const cfg = STEPPER_AXES[this.currentIndex];
        if (!cfg) return;
        this.setButtonState({ moveEnabled: false, yesEnabled: false, noEnabled: false });

        try {
            await this.app.printer.sendCommandAndWait('G91', 3000);
            await this.app.printer.sendCommandAndWait(cfg.moveCmd, 30000);
            await this.app.printer.sendCommandAndWait('G90', 3000);
            this.setButtonState({ moveEnabled: false, yesEnabled: true, noEnabled: true });
        } catch (err) {
            this.setResult(cfg.axis, 'error');
            this.app.results.stepperDir[cfg.axis] = 'fail';
            setTimeout(() => this.advance(), 1000);
        }
    }

    recordResult(verdict) {
        const cfg = STEPPER_AXES[this.currentIndex];
        if (!cfg) return;
        this.app.results.stepperDir[cfg.axis] = verdict;
        this.setResult(cfg.axis, verdict);
        this.advance();
    }

    skipRemaining() {
        for (let i = Math.max(this.currentIndex, 0); i < STEPPER_AXES.length; i++) {
            const axis = STEPPER_AXES[i].axis;
            if (this.app.results.stepperDir[axis] === null) {
                this.app.results.stepperDir[axis] = 'skipped';
                this.setResult(axis, 'skipped');
            }
        }
        this.finish();
    }

    setButtonState({ moveEnabled, yesEnabled, noEnabled }) {
        const moveBtn = document.getElementById('stepperMoveBtn');
        const yesBtn = document.getElementById('stepperYesBtn');
        const noBtn = document.getElementById('stepperNoBtn');
        if (moveBtn) moveBtn.disabled = !moveEnabled;
        if (yesBtn) yesBtn.disabled = !yesEnabled;
        if (noBtn) noBtn.disabled = !noEnabled;
    }

    setResult(axis, state) {
        const el = document.getElementById(`stepperResult-${axis}`);
        if (!el) return;
        const map = {
            'pending':  { text: 'pending', cls: '' },
            'ready':    { text: 'in progress', cls: 'waiting' },
            'pass':     { text: '✓ correct', cls: 'pass' },
            'reversed': { text: '✗ reversed (will be flipped in corrected config)', cls: 'fail' },
            'error':    { text: 'error', cls: 'fail' },
            'skipped':  { text: 'skipped', cls: 'skipped' },
        };
        const v = map[state] || map['pending'];
        el.textContent = v.text;
        el.className = `stepper-result ${v.cls}`;
    }

    finish() {
        this.completed = true;
        const promptEl = document.getElementById('stepperPrompt');
        const labelEl = document.getElementById('stepperAxisLabel');
        const buttonsEl = document.getElementById('stepperButtons');
        if (promptEl) promptEl.textContent = 'Stepper direction tests complete.';
        if (labelEl) labelEl.textContent = '–';
        if (buttonsEl) buttonsEl.classList.add('hidden');

        const nextBtn = document.getElementById('nextBtn');
        if (nextBtn) nextBtn.disabled = false;
    }
}
