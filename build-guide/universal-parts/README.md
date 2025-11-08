# Rep5x - Shared components

Universal components and instructions that work across all supported Rep5x printer models.

## Overview

This folder contains everything you need to build a Rep5x 5-axis conversion that's common across all printer types. Printer-specific adaptations are in the [`../printer-specific/`](../printer-specific/) folder.

## Contents

### [`3d-printed-parts/`](3d-printed-parts/) - Printable components
Universal 3D printed components compatible with all printer models:
- **3MF files** - Ready-to-print models with optimized settings  
- **STEP files** - CAD files for modification and custom manufacturing
- **Assembly file** - Complete Fusion 360 assembly (FullAssem.f3z)

### Assembly documentation  
Complete step-by-step assembly guide:
- **[Assembly guide](../assembly-guide.md)** - Complete build instructions
- Phase-by-phase approach from planning to testing
- Safety considerations and troubleshooting

### [`bill-of-materials/`](bill-of-materials/) - Component specifications
Universal component requirements:
- **[Shared BOM](bill-of-materials/bom-shared.md)** - Complete parts list with specifications
- Electronics, fasteners, and mechanical components
- Vendor suggestions and sourcing guidance

### [`electronics/`](electronics/) - Electrical documentation
Control board and wiring information:
- **[Wiring diagrams](electronics/control-boards/)** - Complete wiring documentation
- Tested control board configurations

## Universal components overview

### 3D printed parts (7 components)
All parts designed for PLA/PETG printing with standard settings:
- **Drive components**: A-driven-pulley, b-driven-pulley, B_arm
- **Mounting parts**: slip-ring-holder, spacer-3mm, B_switch_cover  
- **Hotend interface**: hotend-spacer

### Electronics requirements
- **Control board** with 6+ stepper drivers (BTT Octopus series recommended)
- **6x TMC2208 drivers** for unified configuration
- **2x NEMA17 stepper motors** (1 pancake, 1 standard)
- **MST-005-12A slip ring** for continuous rotation

### Mechanical hardware
- **2x 608 2RS bearings** for rotation axes
- **GT2 timing belt** and pulleys for drive system
- **Standard metric fasteners** (M3, M2.5 bolts and heat-set inserts)
- **Endstops and sensors** for position feedback

## Getting started

### Prerequisites
1. **Compatible 3D printer** - Check [`../printer-specific/`](../printer-specific/) for your model
2. **Basic tools** - 3D printer, hex keys, soldering iron, computer
3. **Electronics skills** - Basic wiring and firmware flashing
4. **Time commitment** - 24-34 hours total project time

### Build sequence  
1. **Plan** - Review all documentation and source components
2. **Print** - All universal 3D printed parts (~12-16 hours)
3. **Assemble** - Mechanical assembly following guide (~6-8 hours)
4. **Electronics** - Wiring and control board setup (~4-6 hours)
5. **Firmware** - Configuration and upload (~2-3 hours)
6. **Calibrate** - Setup and testing using web tool (~2-4 hours)

### Quality requirements
- **Print quality** - 0.2mm layers, 20% infill, proper support removal
- **Assembly precision** - Smooth rotation, minimal backlash
- **Electrical safety** - Proper connections, thermal protection
- **Calibration accuracy** - Precise kinematic parameter determination

## Compatibility notes

### Universal design principles
- **Modular approach** - Printer-specific parts isolated to carriage mount
- **Standard interfaces** - Common fasteners and component sizes
- **Scalable electronics** - Works with various control board options
- **Open design** - All files available for modification

### Printer-specific requirements
While these components are universal, each printer requires:
- **Custom carriage mount** - Specific to X-carriage design
- **Mounting adaptations** - Frame attachment points and clearances
- **Wiring modifications** - Cable routing and lengths
- **Firmware adaptations** - Bed size and sensor configurations

## Version compatibility

Current version: **v1.0**

### Version tracking
- All components marked with compatible version numbers
- **v1.x** - Backward compatible updates (improvements, bug fixes)
- **v2.x** - Breaking changes requiring new parts or major modifications

### Upgrade path
- **v1.0 → v1.1** - Direct replacement, full compatibility
- **v1.x → v2.0** - Migration guide provided for major changes

## Community contributions

### Ways to help
- **Test on new printers** - Verify compatibility and document adaptations
- **Improve documentation** - Clearer instructions and troubleshooting
- **Design enhancements** - Better parts, easier assembly, improved performance
- **Share experiences** - Build logs, tips, and lessons learned

### Quality standards
- **Documentation** - Clear, illustrated, step-by-step instructions
- **Design files** - Properly formatted with version information
- **Testing** - Verified functionality before submission
- **Compatibility** - Maintains universal design principles

## Support and resources

### Documentation hierarchy
1. **Start here** - [Assembly guide](../assembly-guide.md)
2. **Components** - [Shared BOM](bill-of-materials/bom-shared.md) for parts specifications
3. **Electronics** - [Wiring diagrams](electronics/control-boards/) for control board setup
4. **Printer-specific** - [`../printer-specific/`](../printer-specific/) for adaptations

### Getting help
- **Discord community** - Real-time support and discussions
- **GitHub issues** - Bug reports and feature requests
- **Build documentation** - Comprehensive guides and troubleshooting

### External resources
- **Rep5x calibrator** - [calibrator.rep5x.com](https://calibrator.rep5x.com/)
- **Firmware repository** - Latest Marlin configurations
- **Community Discord** - [discord.gg/GNdah82VBg](https://discord.gg/GNdah82VBg)

---

**Ready to build?** Start with the [assembly guide](../assembly-guide.md) for complete step-by-step instructions.