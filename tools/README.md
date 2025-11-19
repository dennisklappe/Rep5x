# Rep5x - Tools

Web-based tools for Rep5x 5-axis 3D printing.

**Live tools:** https://tools.rep5x.com/

## Available tools

### [Printer Control](https://tools.rep5x.com/printer-control/) - 5-axis printer control panel
Control your printer directly from the browser, similar to Pronterface but designed for 5-axis operation.

**Features:**
- Jog controls for all 5 axes (X, Y, Z, A, B)
- Configurable step sizes for linear and angular movement
- G-code console for sending commands and viewing responses
- Quick command buttons for common operations (M114, M503, etc.)
- Temperature controls for hotend and bed

### [Printer Setup](https://tools.rep5x.com/printer-setup/) - Z/A/B axis calibration
Calibrate Z height and the zero positions and steps/degree of your A and B axes before kinematic calibration.

**Features:**
- Direction check for A and B axes (verifies motor rotation direction)
- Two-point measurement for A-axis (0°, 360°) and B-axis (0°, 90°)
- Z-axis calibration using paper test method
- Calculates home offset (M206) and steps/degree (M92) corrections
- Saves settings to printer EEPROM

### [LA/LB Measure](https://tools.rep5x.com/la-lb-measure/) - LA/LB parameter measurement
Determine your printer's kinematic parameters (LA and LB) with step-by-step wizard guidance.

**Features:**
- Two calibration methods: camera-based and cone-based
- Built-in movement controls for precise nozzle positioning
- Web Serial API for direct printer communication
- Results saved to browser storage and exportable as JSON
- Camera method requires USB camera with 3D printed mount
- Cone method requires (printed) calibration cone

### [Vase Generator](https://tools.rep5x.com/vase-generator/) - 5-axis vase mode generator
Generate sample vase mode G-code to test and demonstrate Rep5x 5-axis capabilities.

**Features:**
- Interactive 3D preview with real-time updates
- Configurable print parameters (diameter, height, layer height, speeds)
- Ready-to-print G-code output with proper 5-axis movements
- Educational tool showing 5-axis printing advantages

### [G-code Viewer](https://tools.rep5x.com/gcode-viewer/) - 5-axis G-code visualisation
Visualise and animate 5-axis G-code files with real-time nozzle orientation display.

**Features:**
- Load and parse G-code files
- 3D visualisation of print paths with nozzle orientation
- Animation controls with progress tracking
- Inverse kinematics parameter detection and override
- Direct coordinate mapping for accurate visualisation
- Support for Rep5x-specific metadata and formulas

## Deployment

These tools are designed to be deployed to `tools.rep5x.com` as standalone web applications.

## Development

Each tool is self-contained with HTML, CSS, and JavaScript files. Shared components are located in the `shared/` folder.

### File structure

```
tools/
├── index.html              # Main tools landing page
├── README.md               # This file
├── shared/                 # Shared components
│   ├── styles.css          # Common CSS styles
│   ├── theme.js            # Theme configuration
│   ├── storage-manager.js  # Browser storage utilities
│   ├── printer-interface.js # Serial communication
│   ├── header.js           # Common header component
│   └── footer.js           # Common footer component
├── printer-control/        # Printer control panel
├── printer-setup/          # Z/A/B axis calibration
├── la-lb-measure/          # LA/LB measurement wizard
├── vase-generator/         # 5-axis vase generator
└── gcode-viewer/           # G-code visualisation
```
