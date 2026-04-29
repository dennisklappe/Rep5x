# Firmware Tester

Browser-based tool that verifies a freshly flashed Rep5x Marlin firmware against the hardware it's running on, and produces a corrected Firmware Builder JSON config if anything is wired backwards.

## What it checks

1. **Diagnostics** — `M115` (firmware ID), `M122` (TMC driver UART), `M119` (no endstop currently triggered), `M105` (thermistors read room temperature).
2. **Endstop walk-through** — for each endstop (X, Y, Z, B microswitch, C optical sensor), the user is prompted to manually trigger it; the tool polls `M119` until the state flips.
3. **Stepper directions** — sends a small relative move on each axis (X/Y/Z/C/B) and asks the user whether it moved as expected.
4. **Homing direction** — for axes whose endstops passed, sends `G28 X` etc. and asks whether the carriage moved *toward* the endstop.
5. **Extruder** — direction test, plus optional E-steps calibration via "extrude 100 mm, measure how much actually came out".

## Output

If a Firmware Builder JSON config was uploaded at the start, the tester produces a `*-corrected.json` with the discovered fixes applied:

- Stepper direction reversed → `invert<axis>` flipped
- Homing direction reversed → `<axis>HomeDir` sign flipped
- Extruder reversed → `invertE` flipped
- E-steps calibrated → `stepsE` updated

Re-import the corrected JSON into the Firmware Builder, regenerate, re-flash, and run the tester again to confirm.

## Where it sits in the workflow

1. **Firmware Builder** → configure → download `firmware.bin` (and the JSON config alongside)
2. **Firmware Tester** ← *(this tool)* — verify the flash worked, fix any reversals
3. **Printer Setup** → kinematic calibration

## Files

- `index.html` — wizard skeleton (7 steps, Tailwind-based)
- `js/app.js` — entry point, wizard init, results aggregation
- `js/connect.js` — connection step (uses `StepConnectBase` from shared/)
- `js/diagnostics.js` — M115 / M122 / M119 / M105 checks
- `js/endstop-test.js` — manual endstop trigger walk-through
- `js/stepper-test.js` — stepper direction prompts
- `js/homing-test.js` — homing direction prompts
- `js/extruder-test.js` — extruder direction + optional E-steps calibration
- `js/results.js` — summary view + corrected JSON output
- `styles.css` — small tool-specific overrides on top of shared/styles.css

Shared dependencies:
- `shared/printer-interface.js` (now extended with `queryEndstops`, `queryDriverStatus`, `queryFirmwareInfo`)
- `shared/wizard-framework.js`
- `shared/step-connect-base.js`
- `shared/storage-manager.js`
