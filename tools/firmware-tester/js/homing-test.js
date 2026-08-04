/**
 * Homing direction step.
 *
 * Asks the user where each linear endstop physically sits (MIN side or MAX
 * side) and compares that to the firmware's home-direction setting from the
 * uploaded Firmware Builder JSON. A mismatch means the configured xHomeDir /
 * yHomeDir / zHomeDir is reversed and would drive the carriage away from the
 * endstop on G28; the corrected JSON will flip the sign.
 *
 * Important: this step intentionally sends NO motor commands. Running G28
 * with a reversed home direction will keep moving until something physically
 * stops it (frame, belt skip, motor mount). The check here is config-vs-
 * physical-reality only.
 *
 * B is centred-home (the microswitch sits at B=0, with travel either side),
 * so MIN/MAX doesn't apply; the endstop walk-through in step 3 covers it.
 */

const HOMING_AXES = [
    { axis: 'x', dirKey: 'xHomeDir' },
    { axis: 'y', dirKey: 'yHomeDir' },
    { axis: 'z', dirKey: 'zHomeDir' },
];

class StepHoming {
    constructor(app) {
        this.app = app;
    }

    register(stepIndex) {
        this.app.wizard.registerStep(stepIndex, {
            enter: () => this.enter(),
        });

        const skipBtn = document.getElementById('skipHomingBtn');
        if (skipBtn) skipBtn.addEventListener('click', () => this.skipRemaining());

        document.querySelectorAll('.homing-side-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const axis = btn.dataset.axis;
                const side = btn.dataset.side;
                this.recordSide(axis, side);
            });
        });
    }

    enter() {
        const noticeEl = document.getElementById('homingNoConfigNotice');
        const fbConfigPresent = !!this.app.fbConfig;
        if (noticeEl) noticeEl.classList.toggle('hidden', fbConfigPresent);

        // Render the firmware's expected side as a hint per axis (read from FB config).
        for (const cfg of HOMING_AXES) {
            const hint = document.getElementById(`homingHint-${cfg.axis}`);
            if (!hint) continue;
            if (!fbConfigPresent) {
                hint.textContent = '(needs uploaded JSON to evaluate)';
                continue;
            }
            const fbDir = parseInt(this.app.fbConfig[cfg.dirKey], 10);
            if (fbDir === 1)        hint.textContent = `Firmware homes toward MAX (${cfg.dirKey} = +1)`;
            else if (fbDir === -1)  hint.textContent = `Firmware homes toward MIN (${cfg.dirKey} = -1)`;
            else                    hint.textContent = `Firmware ${cfg.dirKey} not set in JSON`;
        }

        // Allow proceeding any time on this step; it's purely informational.
        const nextBtn = document.getElementById('nextBtn');
        if (nextBtn) nextBtn.disabled = false;
    }

    recordSide(axis, side) {
        const cfg = HOMING_AXES.find(a => a.axis === axis);
        if (!cfg) return;

        const fbDir = this.app.fbConfig ? parseInt(this.app.fbConfig[cfg.dirKey], 10) : null;
        let verdict;
        if (fbDir !== 1 && fbDir !== -1) {
            verdict = 'no-config';
        } else {
            const expectedSide = fbDir === 1 ? 'max' : 'min';
            verdict = side === expectedSide ? 'pass' : 'reversed';
        }

        this.app.results.homing[axis] = verdict;
        this.app.results.homingUserSide = this.app.results.homingUserSide || {};
        this.app.results.homingUserSide[axis] = side;

        this.setResult(axis, verdict);
    }

    skipRemaining() {
        for (const cfg of HOMING_AXES) {
            if (this.app.results.homing[cfg.axis] === null) {
                this.app.results.homing[cfg.axis] = 'skipped';
                this.setResult(cfg.axis, 'skipped');
            }
        }
    }

    setResult(axis, state) {
        const el = document.getElementById(`homingResult-${axis}`);
        if (!el) return;
        const map = {
            'pending':   { text: 'pending', cls: '' },
            'pass':      { text: '✓ matches firmware', cls: 'pass' },
            'reversed':  { text: '✗ reversed (will be flipped in JSON)', cls: 'fail' },
            'no-config': { text: 'no JSON loaded', cls: 'skipped' },
            'skipped':   { text: 'skipped', cls: 'skipped' },
        };
        const v = map[state] || map['pending'];
        el.textContent = v.text;
        el.className = `homing-result text-xs ${v.cls}`;
    }
}
