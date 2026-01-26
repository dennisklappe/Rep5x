# Rep5x - Tools

Web-based tools for Rep5x 5-axis 3D printing.

**Live tools:** https://tools.rep5x.com/

## Available tools

### [Firmware Builder](https://tools.rep5x.com/firmware-builder/)
Configure and build custom Rep5x Marlin firmware with cloud compilation. No local toolchain required.

### [Printer Control](https://tools.rep5x.com/printer-control/)
Control your printer directly from the browser. Jog all 5 axes, send G-code commands, and monitor position.

### [Printer Setup](https://tools.rep5x.com/printer-setup/)
Calibrate Z height and C/B axis zero positions before kinematic calibration.

### [LC/LB Measure](https://tools.rep5x.com/lc-lb-measure/)
Measure your printer's LC and LB kinematic parameters with step-by-step guidance.

### [Vase Generator](https://tools.rep5x.com/vase-generator/)
Generate sample 5-axis vase mode G-code to test and demonstrate Rep5x capabilities.

### [G-code Viewer](https://tools.rep5x.com/gcode-viewer/)
Visualise and animate 5-axis G-code files with collision detection.

### [Calibrator](https://tools.rep5x.com/calibrator/)
Find error curves for your 5-axis system across all C and B angles.

### [G-code Corrector](https://tools.rep5x.com/gcode-corrector/)
Apply calibration corrections and inverse kinematics to 5-axis G-code files.

## File structure

```
tools/
├── index.html           # Tools landing page
├── README.md
├── shared/              # Shared components
│   ├── styles.css
│   ├── theme.js
│   ├── storage-manager.js
│   ├── printer-interface.js
│   ├── camera-manager.js
│   ├── header.js
│   ├── footer.js
│   ├── inverse-kinematics.js
│   ├── c-axis-optimizer.js
│   ├── calibration-corrector.js
│   ├── calibration-visualizer.js
│   ├── calibration-visualizer-3d.js
│   └── correction-graph-renderer.js
├── firmware-builder/
├── printer-control/
├── printer-setup/
├── lc-lb-measure/
├── vase-generator/
├── gcode-viewer/
├── calibrator/
└── gcode-corrector/
```

## Support

- **Discord**: [Join our community](https://discord.gg/GNdah82VBg)
