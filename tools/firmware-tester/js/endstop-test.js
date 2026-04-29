/**
 * Endstop walk-through step.
 *
 * For each axis with an endstop (X, Y, Z, B, C), prompt the user to manually
 * press/trigger it. Poll M119 in a tight loop and watch for the state to flip
 * from `open` to `TRIGGERED` (or vice-versa, if the firmware logic level is
 * inverted — we record whichever state the axis sat in initially and look for
 * the opposite).
 *
 * The C "endstop" is actually an optical sensor on the rotating C-axis. We can
 * still verify it via M119 — the user just has to manually pass an interrupter
 * through the slot.
 */

const ENDSTOP_AXES = [
    { axis: 'x', label: 'X endstop', prompt: 'Press the X endstop microswitch by hand.' },
    { axis: 'y', label: 'Y endstop', prompt: 'Press the Y endstop microswitch by hand.' },
    { axis: 'z', label: 'Z endstop', prompt: 'Press the Z endstop microswitch by hand (or block the optical sensor).' },
    { axis: 'b', label: 'B endstop',  prompt: 'Press the B-axis microswitch on the rotating B-arm by hand.' },
    { axis: 'c', label: 'C homing sensor', prompt: 'Block or interrupt the C-axis optical homing sensor with a finger or piece of paper.' },
];

class StepEndstops {
    constructor(app) {
        this.app = app;
        this.currentIndex = -1;
        this.polling = false;
        this.pollTimer = null;
        this.completed = false;
    }

    register(stepIndex) {
        this.app.wizard.registerStep(stepIndex, {
            enter: () => this.enter(),
            leave: () => this.leave(),
        });

        const startBtn = document.getElementById('startEndstopBtn');
        const skipBtn = document.getElementById('skipEndstopBtn');
        if (startBtn) startBtn.addEventListener('click', () => this.start());
        if (skipBtn) skipBtn.addEventListener('click', () => this.skipRemaining());
    }

    enter() {
        const nextBtn = document.getElementById('nextBtn');
        if (nextBtn) nextBtn.disabled = !this.completed;
    }

    leave() {
        this.stopPolling();
        return true;
    }

    async start() {
        const startBtn = document.getElementById('startEndstopBtn');
        if (startBtn) startBtn.disabled = true;
        this.currentIndex = -1;
        await this.advance();
    }

    skipRemaining() {
        // Mark all remaining as skipped.
        for (let i = Math.max(this.currentIndex, 0); i < ENDSTOP_AXES.length; i++) {
            const axis = ENDSTOP_AXES[i].axis;
            if (this.app.results.endstopWalk[axis] === null) {
                this.app.results.endstopWalk[axis] = 'skipped';
                this.setResult(axis, 'skipped');
            }
        }
        this.completed = true;
        this.finish();
    }

    async advance() {
        this.stopPolling();
        this.currentIndex++;
        if (this.currentIndex >= ENDSTOP_AXES.length) {
            this.completed = true;
            this.finish();
            return;
        }

        const { axis, label, prompt } = ENDSTOP_AXES[this.currentIndex];
        const labelEl = document.getElementById('endstopAxisLabel');
        const promptEl = document.getElementById('endstopPrompt');
        if (labelEl) labelEl.textContent = label;
        if (promptEl) promptEl.textContent = `${prompt} The tester polls every second and advances when the state flips.`;

        this.setResult(axis, 'waiting');

        // Read initial state, then poll for change.
        let initialState;
        try {
            const ends = await this.app.printer.queryEndstops();
            initialState = ends[axis];
            if (initialState === 'unknown') {
                this.setResult(axis, 'no-report');
                this.app.results.endstopWalk[axis] = 'no-report';
                setTimeout(() => this.advance(), 1500);
                return;
            }
        } catch (err) {
            this.setResult(axis, 'error');
            this.app.results.endstopWalk[axis] = 'fail';
            setTimeout(() => this.advance(), 1500);
            return;
        }

        this.polling = true;
        const startTime = Date.now();
        const pollOnce = async () => {
            if (!this.polling) return;
            try {
                const ends = await this.app.printer.queryEndstops();
                if (ends[axis] !== initialState && ends[axis] !== 'unknown') {
                    this.setResult(axis, 'pass');
                    this.app.results.endstopWalk[axis] = 'pass';
                    this.advance();
                    return;
                }
            } catch (e) {
                // ignore single-poll errors
            }
            // Time out after 60 seconds.
            if (Date.now() - startTime > 60000) {
                this.setResult(axis, 'timeout');
                this.app.results.endstopWalk[axis] = 'timeout';
                this.advance();
                return;
            }
            this.pollTimer = setTimeout(pollOnce, 1000);
        };
        pollOnce();
    }

    stopPolling() {
        this.polling = false;
        if (this.pollTimer) {
            clearTimeout(this.pollTimer);
            this.pollTimer = null;
        }
    }

    setResult(axis, state) {
        const el = document.getElementById(`endstopResult-${axis}`);
        if (!el) return;
        const map = {
            'pending': { text: 'pending', cls: '' },
            'waiting': { text: 'waiting for trigger...', cls: 'waiting' },
            'pass':    { text: '✓ trigger detected', cls: 'pass' },
            'timeout': { text: 'timed out', cls: 'fail' },
            'error':   { text: 'error', cls: 'fail' },
            'no-report': { text: 'not reported by M119', cls: 'fail' },
            'skipped': { text: 'skipped', cls: 'skipped' },
        };
        const v = map[state] || map['pending'];
        el.textContent = v.text;
        el.className = `endstop-result ${v.cls}`;
    }

    finish() {
        const promptEl = document.getElementById('endstopPrompt');
        const labelEl = document.getElementById('endstopAxisLabel');
        if (promptEl) promptEl.textContent = 'Endstop walk-through complete.';
        if (labelEl) labelEl.textContent = '—';
        const nextBtn = document.getElementById('nextBtn');
        if (nextBtn) nextBtn.disabled = false;
    }
}
