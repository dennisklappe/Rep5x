# Rep5x - LC/LB Measure

A web-based tool for measuring the LC and LB kinematic parameters of your Rep5x 5-axis 3D printer.

**Live tool:** https://tools.rep5x.com/lc-lb-measure/

## What are LC and LB?

- **LC (C-axis offset)**: The distance from the C-axis (yaw) rotation centre to the nozzle tip. For the current Rep5x design, this should be **0**.
- **LB (B-axis offset)**: The distance from the B-axis (pitch) rotation centre to the nozzle tip. This varies based on your build (typically ~40-60mm).

These parameters are essential for accurate inverse kinematics calculations, which ensure the nozzle stays at the correct position when rotating.

## Quick start

1. Open `index.html` in Chrome or Edge
2. Select your calibration method (camera or cone)
3. Connect to your printer
4. Follow the step-by-step wizard
5. Save your results

## Calibration methods

### Camera method

Use a USB camera mounted on the print bed facing upward. Align the nozzle with a crosshair overlay for precise measurements.

**Requirements:**
- USB camera (see [Rep5x camera documentation](../hardware/rep5x-camera/))
- 3D printed camera mount

### Cone method

Use a 3D printed calibration cone placed on the bed. Touch the nozzle tip to the cone tip at various angles.

**Requirements:**
- Calibration cone print (see [assets/calibration-cone.stl](assets/calibration-cone.stl))
- No additional hardware needed

## Browser requirements

This tool requires:
- **Chrome 89+** or **Microsoft Edge 89+** (Web Serial API support)
- Camera permissions (for camera method)

Firefox and Safari are not supported due to Web Serial API limitations.

## File structure

```
lc-lb-measure/
├── index.html              # Main application
├── README.md               # This file
├── js/
│   ├── app.js              # Main wizard controller
│   ├── camera-manager.js   # Camera access and crosshair
│   ├── measurement-engine.js # LC/LB calculations
│   ├── connect.js          # Connection step
│   ├── prepare.js          # Preparation step
│   ├── lc-measure.js       # LC measurement step
│   ├── lb-measure.js       # LB measurement step
│   ├── method.js           # Method selection step
│   └── results.js          # Results step
└── assets/
    └── calibration-cone.stl # Printable calibration cone
```

## Support

- **Discord**: [Join our community](https://discord.gg/GNdah82VBg)
