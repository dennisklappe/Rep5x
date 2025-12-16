# Rep5x - Vase generator

Generate demonstration G-code files to showcase Rep5x 5-axis printing capabilities with various shapes.

**Live tool:** https://tools.rep5x.com/vase-generator/

## Features

- **Multiple shapes**: Elbow pipe, mushroom
- **Interactive 3D preview**: Real-time visualisation of generated models
- **Configurable parameters**: Diameter, height, layer settings, speeds
- **5-axis toolpaths**: Each shape demonstrates different 5-axis printing techniques
- **Ready-to-print output**: Complete G-code files with inverse kinematics

## Usage

1. **Select shape**: Choose from available shapes in the sidebar
2. **Adjust parameters**: Modify size, layer height, and print speeds
3. **Preview model**: View real-time 3D preview
4. **Generate G-code**: Click generate to create printer-ready G-code
5. **Download file**: Save for printing on your Rep5x printer

## File structure

```
vase-generator/
├── index.html
├── README.md
└── js/
    ├── app.js
    ├── inverse-kinematics.js
    ├── a-axis-optimizer.js
    └── shapes/
        ├── elbow-pipe.js
        └── mushroom.js
```

## Support

- **Discord**: [Join our community](https://discord.gg/GNdah82VBg)
