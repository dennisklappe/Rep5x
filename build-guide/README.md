# Rep5x - Build guide

Complete build documentation for converting 3D printers to 5-axis capability using the Rep5x open-source system.

## Quick start

1. **Check compatibility** - Verify your printer model in [`printer-specific/`](printer-specific/) (if not available, most printers need only minimal adaptations)
2. **Review requirements** - Universal components in [`universal-parts/`](universal-parts/)
3. **Follow assembly guide** - Complete instructions in [`assembly-guide.md`](assembly-guide.md)
4. **Join community** - Get support on [Discord](https://discord.gg/GNdah82VBg)

## Folder structure

### [`assembly-guide.md`](assembly-guide.md) - Main build instructions
Complete step-by-step assembly guide for converting any compatible printer to 5-axis capability.

### [`universal-parts/`](universal-parts/) - Universal build components
Contains components that work across all supported printer models:

- **[`3d-printed-parts/`](universal-parts/3d-printed-parts/)** - Universal STL, STEP, and Fusion 360 files
- **[`bill-of-materials/`](universal-parts/bill-of-materials/)** - Universal component list
- **[`electronics/`](universal-parts/electronics/)** - Control board and wiring guides

### [`printer-specific/`](printer-specific/) - Printer adaptations
Contains files specific to individual printer models:

- **[`ender-5-pro/`](printer-specific/ender-5-pro/)** - Ender 5 Pro specific files (Working)
- **[`ender-3-v3-se/`](printer-specific/ender-3-v3-se/)** - Ender 3 V3 SE files (In development)

## Supported printers

| Printer Model | Status | Carriage Mount | Notes |
|---------------|--------|----------------|-------|
| **Ender 5 Pro** | Working prototype | Available | Minimal notes |
| **Ender 3 V3 SE** | Working prototype | Available | Extensive build notes |
| **Generic adaptation** | Guidelines available | Custom required | See adaptation guide |

## Build overview

### Build requirements
- **Time**: ~24 hours (spread over several days)
- **Skills**: Basic 3D printing, electronics, and firmware knowledge (community happy to help if you lack some knowledge)
- **Tools**: 3D printer, soldering iron, hex keys, computer
- **Cost**: ~$150 in additional components

### Key components added
- **2x stepper motors** - A-axis (yaw) and B-axis (tilt) rotation
- **Control board upgrade** - 6+ stepper driver capability required  
- **Slip ring** - Continuous rotation without cable tangling
- **3D printed parts** - Custom mounting and drive components

## Getting started

### Step 1: Compatibility check
1. Find your printer in [`printer-specific/`](printer-specific/)
2. Review printer-specific requirements and limitations
3. Verify you have access to required tools and workspace

**Don't see your printer?** If your printer isn't listed, it can probably be adapted quite easily! Most printers only need a custom carriage mount bracket to work with Rep5x. If you don't have time to create the bracket yourself, feel free to ask in our Discord - many community members are happy to help. Adapting a bracket from one printer to fit another is usually straightforward work.

### Step 2: Order/source components
1. Review universal BOM in [`universal-parts/bill-of-materials/`](universal-parts/bill-of-materials/)
2. Add printer-specific components from your printer folder
3. Order/source electronics and hardware components (many can be sourced from old printers)

### Step 3: Print the parts
Print all required components using provided files

### Step 4: Begin build
1. Follow the complete guide in [`assembly-guide.md`](assembly-guide.md)
2. Assemble mechanical components following step-by-step instructions
3. Install and configure electronics and firmware

## Versioning system

Rep5x uses semantic versioning for hardware compatibility. See [VERSIONING.md](VERSIONING.md) for complete details.