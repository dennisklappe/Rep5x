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
- **[Assembly instructions](../assembly-instructions-universal.md)** - Complete build instructions
- Phase-by-phase approach from planning to testing

### Bill of materials - Component specifications
Universal component requirements:
- **[Universal BOM](bom-universal.md)** - Complete parts list with specifications
- Electronics, fasteners, and mechanical components
- Vendor suggestions and sourcing

### [`electronics/`](electronics/) - Electrical documentation
Control board and wiring information:
- **[Wiring diagrams](electronics/control-boards/)** - Complete wiring documentation
- Tested control board configurations

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

Current version: **v1.1**

### Version tracking
- All components marked with compatible version numbers
- **v1.x** - Backward compatible updates (improvements, bug fixes)
- **v2.x** - Breaking changes requiring new parts or major modifications

### Upgrade path
- **v1.0 → v1.1** - Direct replacement, full compatibility
- **v1.x → v2.0** - Migration guide provided for major changes

## Support and resources

### Documentation hierarchy
1. **Start here** - [Assembly instructions](../assembly-instructions-universal.md)
2. **Components** - [Universal BOM](bom-universal.md) for parts specifications
3. **Electronics** - [Wiring diagrams](electronics/control-boards/) for control board setup
4. **Printer-specific** - [`../printer-specific/`](../printer-specific/) for adaptations

---

**Ready to build?** Start with the [assembly instructions](../assembly-instructions-universal.md) for complete step-by-step instructions. Join our [Discord community](https://discord.gg/GNdah82VBg) for support.