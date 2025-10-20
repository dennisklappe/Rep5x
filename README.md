# Rep5x - Open source 5-axis 3D printer

[![Early Alpha](https://img.shields.io/badge/status-early%20alpha-orange)](https://github.com/dennisklappe/Rep5x)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

![5-axis printing demonstration](5axis-printing-demo.gif)

*Rep5x enables complex geometries without support structures through 5-axis printing*

> **Early Alpha Notice**: This repository contains early development work. Detailed documentation, assembly instructions, and improved software will be added in the coming weeks.

## Overview

Rep5x democratises 5-axis 3D printing by creating an **affordable retrofit system** for consumer desktop 3D printers. The system adds two rotational axes (A and B) to standard XYZ printers, enabling:

- **Support-free printing** of complex overhangs
- **Improved surface quality** through optimal layer orientation  
- **Stronger parts** by aligning layer direction with stress patterns
- **Reduced material waste** by eliminating support structures

## Quick start

### 1. Check hardware support
Currently supported printers:
- **Ender 5 Pro** - Working prototype with full documentation

### 2. Get the files
- **STL files**: `printer-models/ender-5-pro/3d-printed-parts/`
- **Parts list**: `printer-models/ender-5-pro/BOM.md`
- **Firmware**: `firmware/marlin/configs/octopus-v1.1/`

### 3. Join the community
**Discord**: https://discord.gg/GNdah82VBg for build support and discussions

## Hardware support

| Printer model | Status | Documentation |
|---------------|--------|---------------|
| Ender 5 Pro | Working prototype | Basic |
| Ender 3 V3 SE | Planned | Coming soon |
| Generic | Guidelines only | Basic |

## Features

### Current capabilities
- **Continuous A-axis rotation** (unlimited yaw movement)
- **>90° B-axis tilt** for complex geometries
- **Slip ring integration** prevents cable tangling
- **Modular design** for different printer platforms


## Project structure

```
Rep5x/
├── printer-models/           # Hardware for specific printer models
│   ├── ender-5-pro/         # Ender 5 Pro retrofit (working prototype)
│   │   ├── 3d-printed-parts/ # STL files and CAD assembly
│   │   ├── BOM.md           # Complete parts list
│   │   └── README.md        # Build instructions
│   ├── ender-3-v3-se/       # Ender 3 V3 SE retrofit (planned)
│   └── generic/             # Common guidelines
└── firmware/                # Firmware configurations
    └── marlin/              # Marlin 2.1.x configurations
        └── configs/         # Board-specific configs
```

## Community & contributing

### Get help & share builds
**Discord**: https://discord.gg/GNdah82VBg
- Build support and troubleshooting
- Share your prints and modifications
- Development discussions

### Contributing
- Report issues and bugs
- Share your printer modifications  
- Submit pull requests for improvements
- Help with documentation
- Request support for new printer models

**Code of Conduct**: Be respectful and constructive in all interactions.


## Roadmap

### Phase 1 (current)
- [x] Ender 5 Pro working prototype
- [x] Basic documentation and STL files
- [x] Marlin firmware configuration
- [x] Setting up the Discord community
- [ ] Ender 3 V3 SE adaptation
- [ ] Detailed assembly instructions
- [ ] Web-based setup/calibration tool
- [ ] Community guidelines for new printer adaptations

### Community-driven development
The project's future depends on community involvement. We're focusing on enabling makers to:
- **Adapt to new printer models** with community support
- **Improve documentation** through collaborative contributions
- **Develop advanced slicing features** as open-source solutions
- **Share builds and modifications** to help others

Join our [Discord](https://discord.gg/GNdah82VBg) to help shape the project's direction and contribute to new printer model support!

## License

This project is licensed under the GPL v3 License - see the LICENSE file for details.

## Acknowledgments

This project builds upon the work of [Janis Andersons](https://purl.utwente.nl/essays/96771) at the University of Twente's research into multi-axis 3D printing systems.

---

**Questions?** Follow the repository or join our [Discord](https://discord.gg/GNdah82VBg) for updates as new documentation and features are added.