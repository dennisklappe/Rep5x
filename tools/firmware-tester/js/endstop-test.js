/**
 * Endstop walk-through step.
 *
 * Two phases:
 *  1. Pre-flight read: with nothing pressing any endstop, the tester reads
 *     M119 once. Every axis is expected to show `open`. If an axis instead
 *     shows `TRIGGERED`, the firmware's logic-level setting (endstopX HIGH /
 *     LOW) is inverted and the user is offered a one-click fix to flip it
 *     in the corrected JSON.
 *  2. Walk-through: for each axis (X, Y, Z, B, C), prompt the user to
 *     manually press or block the endstop. Poll M119 in a tight loop and
 *     watch for the state to flip from the initial value to its opposite.
 *
 * The C "endstop" is actually an optical sensor on the rotating C-axis.
 * It's still polled with M119; the user just has to manually pass an
 * interrupter (paper, finger) through the slot.
 */

const ENDSTOP_AXES = [
    { axis: 'x', label: 'X endstop',          logicKey: 'endstopX', prompt: 'Press the X endstop microswitch by hand.' },
    { axis: 'y', label: 'Y endstop',          logicKey: 'endstopY', prompt: 'Press the Y endstop microswitch by hand.' },
    { axis: 'z', label: 'Z endstop',          logicKey: 'endstopZ', prompt: 'Press the Z endstop microswitch by hand (or block the optical sensor).' },
    { axis: 'b', label: 'B endstop',          logicKey: 'endstopB', prompt: 'Press the B-axis microswitch on the rotating B-arm by hand.' },
    { axis: 'c', label: 'C homing sensor',    logicKey: 'endstopC', prompt: 'Block or interrupt the C-axis optical homing sensor with a finger or piece of paper.' },
];

class StepEndstops {
    constructor(app) {
        this.app = app;
        this.currentIndex = -1;
        this.polling = false;
        this.pollTimer = null;
        this.completed = false;
        this.preflightDone = false;
        /** Initial M119 state per axis after the pre-flight read. */
        this.initialState = {};
    }

    register(stepIndex) {
        this.app.wizard.registerStep(stepIndex, {
            enter: () => this.enter(),
            leave: () => this.leave(),
        });

        const readBtn = document.getElementById('readInitialBtn');
        const rereadBtn = document.getElementById('rereadInitialBtn');
        const startBtn = document.getElementById('startEndstopBtn');
        const skipBtn = document.getElementById('skipEndstopBtn');

        if (readBtn) readBtn.addEventListener('click', () => this.runPreflight());
        if (rereadBtn) rereadBtn.addEventListener('click', () => this.runPreflight());
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

    /**
     * Read initial M119 state with nothing pressing any endstop. Anything that
     * reports TRIGGERED at this point has the firmware logic-level inverted.
     */
    async runPreflight() {
        const readBtn = document.getElementById('readInitialBtn');
        const rereadBtn = document.getElementById('rereadInitialBtn');
        if (readBtn) readBtn.disabled = true;

        let ends;
        try {
            ends = await this.app.printer.queryEndstops();
        } catch (err) {
            for (const cfg of ENDSTOP_AXES) this.setInitialState(cfg.axis, 'error');
            if (readBtn) readBtn.disabled = false;
            return;
        }

        for (const cfg of ENDSTOP_AXES) {
            const state = ends[cfg.axis];
            this.initialState[cfg.axis] = state;
            this.setInitialState(cfg.axis, state);
        }

        // Build the inverted-logic notice and per-axis fix buttons for any axis that read TRIGGERED.
        const inverted = ENDSTOP_AXES.filter(cfg => this.initialState[cfg.axis] === 'TRIGGERED');
        this.renderInversionNotice(inverted);

        this.preflightDone = true;
        const startBtn = document.getElementById('startEndstopBtn');
        if (startBtn) startBtn.disabled = false;

        if (readBtn) readBtn.classList.add('hidden');
        if (rereadBtn) rereadBtn.classList.remove('hidden');
        if (readBtn) readBtn.disabled = false;
    }

    setInitialState(axis, state) {
        const el = document.getElementById(`endstopInitial-${axis}`);
        if (!el) return;
        if (state === 'open') {
            el.textContent = '✓ open';
            el.className = 'endstop-initial text-xs pass';
        } else if (state === 'TRIGGERED') {
            el.textContent = '⚠ TRIGGERED (inverted?)';
            el.className = 'endstop-initial text-xs fail';
        } else if (state === 'unknown') {
            el.textContent = 'not reported by M119';
            el.className = 'endstop-initial text-xs fail';
        } else if (state === 'error') {
            el.textContent = 'error reading';
            el.className = 'endstop-initial text-xs fail';
        } else {
            el.textContent = 'unread';
            el.className = 'endstop-initial text-xs';
        }
    }

    renderInversionNotice(invertedAxes) {
        const notice = document.getElementById('endstopInversionNotice');
        const list = document.getElementById('endstopInversionList');
        if (!notice || !list) return;

        if (invertedAxes.length === 0) {
            notice.classList.add('hidden');
            list.innerHTML = '';
            return;
        }

        notice.classList.remove('hidden');
        list.innerHTML = '';
        for (const cfg of invertedAxes) {
            const row = document.createElement('div');
            row.className = 'flex items-center justify-between gap-2';
            const fbHas = this.app.fbConfig && this.app.fbConfig[cfg.logicKey];
            const fbCurrent = fbHas ? this.app.fbConfig[cfg.logicKey] : '(no JSON)';
            const detail = document.createElement('span');
            detail.textContent = `${cfg.label} (current: ${fbCurrent})`;
            const status = document.createElement('span');
            status.className = 'text-xs';
            const btn = document.createElement('button');
            btn.className = 'btn-secondary text-xs px-3 py-1 rounded';
            btn.textContent = 'Mark inverted in JSON';
            btn.disabled = !fbHas;
            btn.addEventListener('click', () => {
                this.app.results.endstopLogic = this.app.results.endstopLogic || {};
                this.app.results.endstopLogic[cfg.axis] = 'flip';
                btn.disabled = true;
                btn.textContent = '✓ Marked';
                status.textContent = 'will be flipped in corrected JSON';
                status.className = 'text-xs pass';
            });
            row.appendChild(detail);
            row.appendChild(status);
            row.appendChild(btn);
            list.appendChild(row);
        }
    }

    async start() {
        const startBtn = document.getElementById('startEndstopBtn');
        if (startBtn) startBtn.disabled = true;
        this.currentIndex = -1;
        await this.advance();
    }

    skipRemaining() {
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

        // Use the pre-flight reading as the baseline. If pre-flight didn't read this axis
        // (e.g., 'unknown'), do a fresh read so we still have a baseline for the change-watch.
        let baseline = this.initialState[axis];
        if (baseline !== 'open' && baseline !== 'TRIGGERED') {
            try {
                const ends = await this.app.printer.queryEndstops();
                baseline = ends[axis];
            } catch (err) {
                this.setResult(axis, 'error');
                this.app.results.endstopWalk[axis] = 'fail';
                setTimeout(() => this.advance(), 1500);
                return;
            }
        }
        if (baseline !== 'open' && baseline !== 'TRIGGERED') {
            this.setResult(axis, 'no-report');
            this.app.results.endstopWalk[axis] = 'no-report';
            setTimeout(() => this.advance(), 1500);
            return;
        }

        this.polling = true;
        const startTime = Date.now();
        const pollOnce = async () => {
            if (!this.polling) return;
            try {
                const ends = await this.app.printer.queryEndstops();
                if (ends[axis] !== baseline && ends[axis] !== 'unknown') {
                    this.setResult(axis, 'pass');
                    this.app.results.endstopWalk[axis] = 'pass';
                    this.advance();
                    return;
                }
            } catch (e) {
                // ignore single-poll errors
            }
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
            'pending':   { text: 'pending', cls: '' },
            'waiting':   { text: 'waiting for trigger...', cls: 'waiting' },
            'pass':      { text: '✓ trigger detected', cls: 'pass' },
            'timeout':   { text: 'timed out', cls: 'fail' },
            'error':     { text: 'error', cls: 'fail' },
            'no-report': { text: 'not reported by M119', cls: 'fail' },
            'skipped':   { text: 'skipped', cls: 'skipped' },
        };
        const v = map[state] || map['pending'];
        el.textContent = v.text;
        el.className = `endstop-result ${v.cls}`;
    }

    finish() {
        const promptEl = document.getElementById('endstopPrompt');
        const labelEl = document.getElementById('endstopAxisLabel');
        if (promptEl) promptEl.textContent = 'Endstop walk-through complete.';
        if (labelEl) labelEl.textContent = '–';
        const nextBtn = document.getElementById('nextBtn');
        if (nextBtn) nextBtn.disabled = false;
    }
}
