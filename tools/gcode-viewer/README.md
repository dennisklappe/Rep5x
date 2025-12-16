# Rep5x - G-code viewer

Visualise and animate 5-axis G-code files with real-time printhead orientation display.

**Live tool:** https://tools.rep5x.com/gcode-viewer/

## Features

- **5-axis visualisation**: Full support for A-axis (yaw) and B-axis (pitch) movements
- **Inverse kinematics**: Automatically detects and reverses IK corrections to show original path
- **Animation controls**: Play, pause, speed control, and progress scrubbing
- **Collision detection**: Warns when printhead would collide with printed path or bed
- **Interactive 3D view**: Mouse controls for rotating and zooming

## Usage

1. **Load G-code**: Upload a Rep5x G-code file
2. **Review info**: Check file information and IK parameters
3. **Control animation**: Use play/pause and speed slider
4. **Adjust view**: Toggle visibility of path, printhead, and axes

## File structure

```
gcode-viewer/
├── index.html
├── README.md
└── js/
    ├── app.js
    ├── gcode-parser.js
    ├── inverse-kinematics-reverser.js
    ├── animation-engine.js
    ├── collision-detector.js
    ├── scene-objects.js
    ├── camera-controls.js
    ├── ui-controller.js
    ├── file-handler.js
    └── printheads/
        ├── printhead-base.js
        └── ender3-v3-se.js
```

## Support

- **Discord**: [Join our community](https://discord.gg/GNdah82VBg)
