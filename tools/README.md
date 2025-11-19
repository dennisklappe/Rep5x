# Rep5x - Tools

Web-based tools for Rep5x 5-axis 3D printing.

## Available tools

### [`vase-generator/`](vase-generator/) - 5-axis vase mode generator
Generate sample vase mode G-code to test and demonstrate Rep5x 5-axis capabilities.

**Features:**
- Interactive 3D preview with real-time updates
- Configurable print parameters (diameter, height, layer height, speeds)
- Ready-to-print G-code output with proper 5-axis movements
- Educational tool showing 5-axis printing advantages

### [`gcode-previewer/`](gcode-previewer/) - 5-axis G-code visualization
Visualize and animate 5-axis G-code files with real-time nozzle orientation display.

**Features:**
- Load and parse G-code files
- 3D visualization of print paths with nozzle orientation
- Animation controls with progress tracking
- Inverse kinematics parameter detection and override
- Direct coordinate mapping for accurate visualization
- Support for Rep5x-specific metadata and formulas

### Calibrator tool
*In development - see `feature/calibrator-tool` branch for machine calibration utilities*

## Deployment

These tools are designed to be deployed to `tools.rep5x.com` as standalone web applications.

## Development

Each tool is self-contained with HTML, CSS, and JavaScript files for easy deployment and maintenance.