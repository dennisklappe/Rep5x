# Rep5x - Calibrator

A web-based calibration tool for Rep5x 5-axis 3D printers to determine kinematic parameters and XYZ offset corrections.

## Quick start

### Online version
Visit [http://calibrator.rep5x.com/](http://calibrator.rep5x.com/)

### Local usage
1. Open `index.html` in a modern browser (Chrome/Edge recommended)
2. Connect your printer via USB
3. Grant camera and serial port permissions when prompted
4. Follow the guided calibration process

## Features

### Camera calibration mode
- Real-time camera feed with crosshair overlay
- Error plotting and visualisation
- Manual alignment process at different angles

### Cone calibration mode
- Step-by-step guidance for physical cone alignment
- Error plotting and visualisation
- Works without any equipment

## Requirements

### Software
- Modern browser with Web Serial API support (Chrome/Edge)
- USB connection to printer

### Hardware

**Two calibration methods available:**

1. **Cone-based calibration** (recommended for beginners)
   - Just print a calibration cone (~€0.10)
   - No additional equipment needed
   - Simple and reliable

2. **Camera-based calibration** (advanced)
   - USB camera mounted on print bed looking upward (~€10.50)
   - Includes LEDs for consistent lighting
   - Magnetic mount for easy positioning

See [hardware/README.md](hardware/README.md) for complete hardware setup instructions, bill of materials, assembly guides, and 3D printable files.

## Project structure

```
calibrator/
├── README.md              # This file
├── index.html            # Main landing page
├── styles.css            # Main stylesheet
├── html/                 # HTML interfaces
│   ├── setup.html        # Initial setup and connection
│   ├── camera.html       # Camera calibration interface
│   ├── cone.html         # Cone calibration interface  
│   ├── la-lb-camera.html # Kinematic parameter calibration (camera)
│   └── la-lb-cone.html   # Kinematic parameter calibration (cone)
├── js/                   # JavaScript modules
│   ├── README.md         # Developer notes about code quality
│   ├── landing.js        # Landing page logic
│   ├── setup.js          # Setup and connection handling
│   ├── camera.js         # Camera interface logic
│   ├── cone.js           # Cone interface logic
│   ├── la-lb-camera.js   # Camera kinematic calibration
│   ├── la-lb-cone.js     # Cone kinematic calibration
│   └── printer-interface.js # Serial communication
└── hardware/             # Hardware setup documentation
    ├── README.md         # Complete hardware guide (cone & camera)
    ├── *.jpg, *.png      # Assembly photos and technical drawings
    └── *.3mf, *.f3d      # 3D printable files (camera mount)
```

## How it works

### Calibration process

#### Camera method
1. **Stage 1: kinematic parameters**
   - **Recommended**: Enter la and lb values from your CAD model if known (most accurate)
   - **Alternative**: Measure using the tool:
     - Mount camera on print bed facing up
     - Home all axes
     - Align nozzle at specific angles to determine la and lb values

2. **Stage 2: XYZ offset table (optional)**
   - Set reference at A=0°, B=0°
   - Measure offsets at various angle combinations
   - Generate lookup table for error compensation

#### Cone method
1. **Recommended**: Enter la and lb values from your CAD model if known (most accurate)
2. **Alternative**: Measure using the tool:
   - Place calibration cone on bed
   - Align nozzle with cone tip
   - Apply test angles and measure offsets
   - Confirm position for each angle
   - View calculated parameters

### Output

The calibration provides:

- **Kinematic parameters (la, lb)** - Saved to browser for use across calibration sessions
- **Calibration data export** - JSON file download with all measured offset data for integration with other tools
- **Real-time results display** - Live calculations and error visualisation during calibration

## Technical details

The calibration determines:
- `la`: Length of the A-axis kinematic link (yaw)
- `lb`: Length of the B-axis kinematic link (pitch)  
- XYZ offset table: Error corrections for various angle combinations

### Important notes
- Camera alignment is manual - user must move printer to centre nozzle in crosshair
- Z compensation is automatic during B-axis movements
- Typical calibration takes 15-30 minutes

## Development

### Local development setup
1. Clone or download the repository
2. Open `index.html` in a modern browser
3. No build process required - pure HTML/CSS/JavaScript

### Browser compatibility
- Chrome/Chromium (recommended)
- Microsoft Edge
- Other browsers with Web Serial API support

## Roadmap

### End of Q4 2025
- [x] Basic camera and cone calibration modes
- [x] Kinematic parameter determination
- [x] XYZ offset table generation
- [x] Camera hardware design and testing
- [x] Hardware documentation and build guide
- [ ] Detailed usage instructions and documentation
- [ ] Automatic Python script generation for G-code post-processing

### Not planned (future considerations)
- Configuration.h automatic configuration tool
- Slicer integration
- Automatic calibration using computer vision

## Contributing

This is an open-source project. Contributions are welcome for:
- Bug fixes and improvements
- Documentation enhancements
- Hardware compatibility testing

## License

This project is licensed under the GPL v3 License - see the LICENSE file for details.

## Support

For issues and questions:
- **Discord**: https://discord.gg/GNdah82VBg for build support and discussions
- Create an issue in the repository