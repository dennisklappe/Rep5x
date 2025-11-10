# Rep5x - Printer-specific adaptations

Custom components and documentation for adapting Rep5x to specific 3D printer models.

## Overview

Each printer model requires specific adaptation components to interface with the universal Rep5x system. This folder contains printer-specific files that supplement the universal components in [`../universal-parts/`](../universal-parts/).

## Supported printer models

### [Ender 5 Pro](ender-5-pro/) - Working prototype
- **Status**: Fully functional
- **Components**: Custom carriage mount
- **Testing**: Proven design with working prototype
- **Community**: Active builders and support available

### [Ender 3 V3 SE](ender-3-v3-se/) - Working prototype  
- **Status**: Fully functional and documented
- **Components**: Carriage mount, X and Z endstop modifications
- **Testing**: Proven design with working prototype
- **Community**: Active builders and support available

## Printer-specific components

### What varies by printer model
While the core Rep5x components in [`universal-parts/`](../universal-parts/) are universal, these elements require printer-specific design:

#### Carriage mount (Required for all printers)
- **Purpose**: Interface between printer's X-carriage and Rep5x rotation assembly
- **Variations**: Mounting hole patterns, carriage dimensions, clearances
- **Files provided**: Both 3MF (printing) and STEP (modification) formats

#### Frame modifications (Varies by printer)
- **Endstop relocations**: Some printers need endstop position changes
- **Cable routing**: Printer-specific wire management solutions  

---

**Want to add support for your printer?** Start a discussion in our [Discord community](https://discord.gg/GNdah82VBg)!