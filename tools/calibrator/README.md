# Rep5x - Calibrator

A calibration tool for finding the error curves of your 5-axis printer across different A and B axis positions. This tool helps identify systematic errors in your printer's kinematic system by measuring the actual nozzle position versus the expected position at multiple points.

## Overview

The calibrator measures position errors at a grid of A and B axis angles:
- **B axis**: 90° to -90° in 15° steps (13 values)
- **A axis**: 0° to 315° in 45° steps (8 values)
- **Total**: 104 measurement points

For each point, the tool:
1. Moves the nozzle to the expected position using inverse kinematics
2. User manually aligns the nozzle with the reference point
3. Records the offset between expected and actual positions
4. Displays the error data in real-time on a graph

## Calibration methods

### Camera method (preferred)

The camera method uses a webcam to visually align the nozzle. For best results, use the [Rep5x camera mount](https://github.com/dennisklappe/Rep5x/tree/main/tools/hardware/rep5x-camera) which provides precise positioning and easy switching between top and side views.

**X/Y calibration (Phase 1)**
- Camera positioned above the bed, looking down
- Crosshair overlay on the camera feed
- User aligns the nozzle tip with the crosshair centre
- Only X and Y offsets are recorded

**Z calibration (Phase 2)**
- Camera repositioned to a side view
- Horizontal line overlay on the camera feed
- User aligns the nozzle tip with the line
- Z offset is recorded

### Cone method (experimental - not yet tested)

The cone method uses a physical calibration cone:
- Position the nozzle at the apex of the cone
- All three axes (X, Y, Z) are calibrated simultaneously
- Faster but may be less precise than the camera method

**Note:** This method has not been extensively tested. The camera method is recommended for reliable results.

## Usage

1. **Select method**: Choose camera or cone calibration
2. **Connect**: Connect to your printer via USB serial
3. **Prepare**:
   - Home all axes
   - Start the camera feed
   - Position the nozzle at the centre of the bed (this becomes the reference point)
4. **Calibrate**:
   - The printer moves to each A/B position
   - Use jog controls to align the nozzle with the reference
   - Press Enter or click "Confirm" when aligned
   - Press Escape or click "Skip" to skip a point
5. **Results**:
   - View error graphs and statistics
   - Export data as CSV or JSON
   - Save results to browser storage

## Keyboard shortcuts (during calibration)

| Key | Action |
|-----|--------|
| Arrow keys | Jog X/Y |
| Page Up/Down | Jog Z |
| Enter | Confirm current point |
| Escape | Skip current point |
| Space | Emergency stop |

## Live error graph

The graph displays error curves in real-time as you calibrate:
- **Red line**: X axis error
- **Cyan line**: Y axis error
- **Yellow line**: Z axis error

You can switch between viewing errors by B angle or by A angle using the buttons below the graph.

## Data export

The calibration data can be exported in two formats:

**CSV format**
```
A,B,Expected_X,Expected_Y,Expected_Z,Actual_X,Actual_Y,Actual_Z,Error_X,Error_Y,Error_Z
0,90,100.000,100.000,50.000,100.123,99.987,50.045,0.123,-0.013,0.045
...
```

**JSON format**
```json
{
  "metadata": {
    "timestamp": "2024-01-15T10:30:00.000Z",
    "la": 0.5,
    "lb": 47.2,
    "referencePosition": {"x": 100, "y": 100, "z": 50}
  },
  "measurements": [...],
  "statistics": {
    "x": {"min": -0.5, "max": 0.8, "avg": 0.1},
    "y": {"min": -0.3, "max": 0.4, "avg": 0.05},
    "z": {"min": -0.2, "max": 0.3, "avg": 0.02}
  }
}
```

## Understanding the results

The error data shows how your printer's kinematic model differs from reality. Common patterns include:

- **Consistent offset**: May indicate LA/LB values need adjustment
- **Sinusoidal pattern on A**: May indicate axis misalignment
- **Progressive error on B**: May indicate LB inaccuracy
- **Random scatter**: Mechanical backlash or measurement error

Use this data to:
1. Refine your LA and LB parameters
2. Identify mechanical issues
3. Create error compensation tables for your slicer

## File structure

```
calibrator/
├── index.html              # Main application
├── README.md               # This file
├── js/
│   ├── app.js              # Main application controller
│   ├── calibration-engine.js  # Data management and IK
│   ├── graph-renderer.js   # Canvas-based error graphs
│   └── camera-overlay.js   # Crosshair and line overlays
└── assets/
    └── (calibration-cone.stl)  # Optional cone model
```

## Requirements

- Modern web browser with WebSerial API support (Chrome, Edge)
- USB connection to printer
- Webcam (for camera method)
- Calibration cone (for cone method)

## Tips

- Run the LA/LB Measure tool first to get accurate LA and LB values
- Ensure the printer is warmed up and stable before calibrating
- Use a small step size (0.1mm) for final adjustments
- Take your time - accuracy is more important than speed
- If a point seems wrong, you can click on the grid to jump back and redo it
