# Rep5x - G-code corrector

Apply calibration corrections and inverse kinematics to 5-axis G-code files.

**Live tool:** https://tools.rep5x.com/gcode-corrector/

## Features

- **Calibration correction**: Apply error compensation from calibration data to improve print accuracy
- **Inverse kinematics**: Add software IK to convert tool-tip coordinates to machine coordinates
- **Firmware IK support**: Apply calibration corrections to G-code already processed with firmware IK (firmware IK in the working, will update woon)
- **Visual preview**: 3D visualisation showing uncalibrated vs calibrated nozzle paths
- **Demo generation**: Create calibration test files to verify corrections

## Use cases

### 1. Apply calibration to uncalibrated files
For G-code generated without calibration:
1. Load your calibration data (from [calibrator tool](https://tools.rep5x.com/calibrator/))
2. Upload uncalibrated G-code
3. Enable "Apply calibration corrections"
4. Process and download corrected file

### 2. Add software IK to raw files
For G-code with tool-tip coordinates only:
1. Enter your LA and LB parameters
2. Upload G-code file
3. Enable "Apply inverse kinematics"
4. Process and download with IK applied

### 3. Calibrate firmware IK files (hopefully soon firmware IK will be available!)
For G-code already processed with firmware IK:
1. Load your calibration data
2. Upload firmware IK G-code
3. Enable "Apply calibration corrections"
4. The corrector automatically detects firmware IK and applies calibration in the correct mode
5. Download corrected file

## Quick start

1. Go to https://tools.rep5x.com/gcode-corrector/
2. **Load calibration** (optional): Click "Load calibration data" and select your `.json` file from the [calibrator tool](https://tools.rep5x.com/calibrator/)
3. **Upload G-code**: Drag and drop or click to select your G-code file
4. **Configure options**:
   - Check "Apply inverse kinematics" if your file needs IK (enter LA/LB values)
   - Check "Apply calibration corrections" if you loaded calibration data
5. **Process**: Click "Process G-code"
6. **Download**: Click "Download corrected G-code"

## Processing modes

The corrector supports three processing modes:

### Software IK + Calibration
- Input: Tool-tip coordinates (XYZ at various A/B angles)
- Output: Machine coordinates with IK applied, then calibration corrections applied
- Use for: Raw G-code that needs both IK and calibration

### Calibration only (firmware IK mode)
- Input: G-code already processed with firmware IK
- Output: Calibration corrections applied to existing machine coordinates
- Use for: Files from slicers that apply firmware IK

### IK only
- Input: Tool-tip coordinates
- Output: Machine coordinates with IK applied
- Use for: Testing IK without calibration, or when no calibration data available

## Understanding the visualisation

The 3D preview shows nozzle error patterns with two colored spheres:
- **Red sphere/trail**: A sweep errors (A rotating 0-360° at B=0)
- **Orange sphere/trail**: B sweep errors (B tilting -90 to +90° at A=0)

**Mode toggle** (above the visualizer):
- **Uncalibrated**: Shows full error pattern without calibration applied
- **Calibrated**: Shows residual error after calibration corrections are applied

**What good calibration looks like**: In calibrated mode, both spheres should barely move from the white center marker. If the movement looks similar in both modes, your calibration isn't working well.

**Preview controls** (below the visualizer): The sweep mode buttons (Both, A only, B only, Combined) only change what you see in the animation. Downloaded demo G-code always tests both A and B axes.

## Demo G-code generation

Generate test files to verify your calibration on the actual printer:

1. **Load calibration data**
2. **Set centre position**: Enter XYZ coordinates where the nozzle should stay fixed
3. **Generate**: Click "Uncalibrated" or "Calibrated" to download demo G-code

**What the demo does**: The printer performs a combined A+B sweep (A rotates 360° while B oscillates sinusoidally), testing both axes simultaneously. The nozzle tip should remain at the specified centre position throughout the entire movement.

**Expected results**:
- **Uncalibrated demo**: Nozzle will drift away from centre, showing your printer's error pattern
- **Calibrated demo**: Nozzle should stay at centre (if calibration is working correctly)

Use these demos to:
- Verify calibration accuracy visually on the printer
- Test before applying corrections to real prints
- Compare uncalibrated vs calibrated performance side-by-side

## File structure

```
gcode-corrector/
├── index.html              # Main application
├── README.md               # This file
└── js/
    ├── app.js              # Application controller
    ├── gcode-processor.js  # G-code parsing and correction engine
    └── calibration-corrector.js  # (in /shared) Calibration data handler
```

## G-code header detection

The corrector automatically detects Rep5x G-code headers to determine:
- Whether IK is already applied (software or firmware)
- LA and LB parameters used
- Whether calibration corrections are present
- Which tool generated the file

This helps prevent double-applying corrections.

## Tips

- Always test corrected G-code with demo files first
- Keep your original uncalibrated files as backups
- Recalibrate periodically as your printer's mechanical state changes
- The corrector preserves all comments and metadata from the original file

## Support

- **Discord**: [Join our community](https://discord.gg/GNdah82VBg)
