# Rep5x - Open source 5-axis 3D printer

[![Beta](https://img.shields.io/badge/status-beta-yellow)](https://github.com/dennisklappe/Rep5x)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Website](https://img.shields.io/badge/Website-Rep5x.com-green)](https://rep5x.com)

![5-axis printing demonstration](5axis-printing-demo.gif)

*Rep5x enables complex geometries without support structures through 5-axis printing*

## Overview

Rep5x democratises 5-axis 3D printing by creating an **affordable retrofit system** for consumer desktop 3D printers. The system adds two rotational axes (A and B) to standard XYZ printers, enabling:

- **Support-free printing** of complex overhangs
- **Improved surface quality** through optimal layer orientation  
- **Stronger parts** by aligning layer direction with stress patterns
- **Reduced material waste** by eliminating support structures

## Quick start

**For easier navigation, visit [Rep5x.com](https://rep5x.com) for the same guides in a more user-friendly format.**

### 1. Check hardware support
Currently supported printers:
- **Ender 5 Pro** - Working prototype
- **Ender 3 V3 SE** - Working prototype with full documentation

### 2. Get the files
- **3D printed parts**: `build-guide/printer-specific/[your-printer]/3d-printed-parts/`
- **Parts list**: `build-guide/universal-parts/bill-of-materials/bom-shared.md`
- **Assembly guide**: `build-guide/assembly-instructions-universal.md`
- **Firmware**: `build-guide/printer-specific/[your-printer]/firmware/`

### 3. Join the community
**Discord**: https://discord.gg/GNdah82VBg for build support and discussions

⭐ **Star this repo** to support open-source 5-axis printing development!

## Hardware support

| Printer model | Status | Documentation |
|---------------|--------|---------------|
| Ender 5 Pro | ✅ Working prototype | Minimal |
| Ender 3 V3 SE | ✅ Working prototype | Complete |
| Generic | Guidelines only | Complete |

## Features

### Current capabilities
- **Continuous A-axis rotation** (unlimited yaw movement)
- **>90° B-axis tilt** for complex geometries
- **Slip ring integration** prevents cable tangling
- **Modular design** for different printer platforms


## Project structure

```
Rep5x/
├── build-guide/             # Complete build documentation
│   ├── assembly-guide.md    # Step-by-step assembly instructions
│   ├── universal-parts/     # Components shared across all printers
│   │   ├── 3d-printed-parts/ # Universal STL files and CAD assembly
│   │   ├── bill-of-materials/ # Complete shared parts list
│   │   ├── electronics/     # Wiring diagrams and control boards
│   │   └── firmware/        # General firmware installation guide
│   └── printer-specific/    # Printer-specific adaptations
│       ├── ender-5-pro/     # Ender 5 Pro retrofit (working)
│       └── ender-3-v3-se/   # Ender 3 V3 SE retrofit (working)
├── website/                 # Official Rep5x website (rep5x.com)
└── README.md               # This file
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

### Phase 1 (completed)
- [x] Ender 5 Pro working prototype
- [x] Ender 3 V3 SE adaptation
- [x] Complete documentation and assembly guide
- [x] Marlin firmware configuration
- [x] Setting up the Discord community
- [x] Community guidelines for new printer adaptations

### Phase 2 (current)
- [ ] Community testing and documentation feedback
- [ ] Support users building their first Rep5x systems
- [ ] Identify and fill documentation gaps
- [ ] Accelerate development through user contributions
- [ ] Additional printer model support based on community demand

### Community-driven development
The project's future depends on community involvement. We're focusing on enabling makers to:
- **Adapt to new printer models** with community support
- **Improve documentation** through collaborative contributions
- **Develop slicing features** as open-source solutions
- **Share builds and modifications** to help others

Join our [Discord](https://discord.gg/GNdah82VBg) to help shape the project's direction and contribute to new printer model support!

## License

This project is licensed under the GPL v3 License - see the LICENSE file for details.

## Acknowledgments

This project builds upon the work of [Janis Andersons](https://purl.utwente.nl/essays/96771) at the University of Twente's research into multi-axis 3D printing systems.

---

**Questions?** Follow the repository or join our [Discord](https://discord.gg/GNdah82VBg) for updates as new documentation and features are added.