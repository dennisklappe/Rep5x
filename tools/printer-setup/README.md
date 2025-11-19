# Rep5x - Printer setup

A web-based tool for calibrating Z height, A-axis and B-axis zero positions, and steps/degree of your Rep5x 5-axis 3D printer.

**Live tool:** https://tools.rep5x.com/printer-setup/

## Why is this needed?

Before you can accurately measure kinematic parameters (LA/LB), your printer needs to be calibrated:

- **Z-axis**: Z0 should be where the nozzle touches the bed (paper test method)
- **B-axis (pitch)**: B0 should point the nozzle straight down, perpendicular to the bed
- **A-axis (yaw)**: A360 should complete exactly one full rotation

If these aren't calibrated, your kinematic measurements and prints will be inaccurate.

## Quick start

1. Go to https://tools.rep5x.com/printer-setup/ (or open `index.html` locally in Chrome or Edge)
2. Connect to your printer via USB
3. Check A and B axis directions (first time only)
4. Set A-axis reference positions (A0, A360)
5. Set B-axis reference positions (B0, B90)
6. Set Z0 using paper test method
7. Review calculated corrections
8. Apply settings to printer

## What it does

### Direction check (first time only)

Verifies that A and B axis motors rotate in the correct direction. This is only needed once after building or making motor changes.

- **A-axis**: Should rotate clockwise when viewed from above
- **B-axis**: Nozzle should tilt left when B increases

If direction is wrong, you'll need to either swap two wires within one coil pair on the motor connector, or change `INVERT_I_DIR` / `INVERT_J_DIR` in firmware.

### A-axis calibration

Two-point measurement for rotation accuracy:

1. Set a reference mark at A0 → record firmware position
2. Rotate to where mark returns to start (physical A360) → record firmware position
3. Tool calculates offset and steps/degree corrections

### B-axis calibration

Two-point measurement for tilt accuracy:

1. Jog B-axis until nozzle points straight down (physical B0) → record firmware position
2. Jog B-axis until nozzle points horizontal left (physical B90) → record firmware position
3. Tool calculates:
   - **Home offset (M206 B)**: Correction to make firmware B0 match physical B0
   - **Steps/degree (M92 B)**: Correction if 90° firmware movement ≠ 90° physical rotation

### Z-axis calibration

Uses the paper test method to determine the correct Z height:

1. Home Z to Z_MAX (top)
2. Lower Z slowly until paper drags between nozzle and bed
3. Confirm position - tool calculates M206 Z offset
4. After saving, Z will show correct height after homing

### Firmware commands

The tool generates G-code to configure your printer:

```gcode
M206 Z-172.30 ; Z home offset (sets Z_MAX)
M206 B-2.0    ; B-axis home offset
M206 A0.5     ; A-axis home offset
M92 B17.85    ; B-axis steps/degree (if adjustment needed)
M500          ; Save to EEPROM
```

You can send these directly to the printer or copy them for manual entry.

## Browser requirements

- **Chrome 89+** or **Microsoft Edge 89+** (Web Serial API support)
- Firefox and Safari are not supported

## Next steps

After printer setup, continue to [LA/LB Measure](https://tools.rep5x.com/la-lb-measure/) to determine your LA and LB parameters.

## File structure

```
printer-setup/
├── index.html           # Main application
├── README.md            # This file
└── js/
    ├── app.js           # Main application controller
    ├── connect.js       # Connection step
    ├── prepare.js       # Preparation step
    ├── direction-check.js # Direction check step
    ├── a-axis.js        # A-axis calibration step
    ├── b-axis.js        # B-axis calibration step
    ├── z-axis.js        # Z-axis calibration step
    └── apply.js         # Apply settings step
```

## Support

- **Discord**: [Join our community](https://discord.gg/GNdah82VBg)
