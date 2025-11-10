# Rep5x - Firmware guide

Firmware configuration and installation guide for Rep5x 5-axis printer conversions using Marlin 2.1.x.

## Overview

Rep5x uses **Marlin 2.1.x** with custom configurations to enable 5-axis printing capability. Firmware must be specifically configured for both your **control board** and **printer model**.

## Firmware structure

### Configuration matrix
Firmware depends on two variables, requiring specific configs:

| Printer Model | Control Board | Status | Location |
|---------------|---------------|--------|----------|
| **Ender 5 Pro** | BTT Octopus V1.1 | ✅ Working | [`../../printer-specific/ender-5-pro/firmware/octopus-v1.1/`](../../printer-specific/ender-5-pro/firmware/octopus-v1.1/) |
| **Ender 3 V3 SE** | BTT Octopus V1.1 | ✅ Working | [`../../printer-specific/ender-3-v3-se/firmware/octopus-v1.1/`](../../printer-specific/ender-3-v3-se/firmware/octopus-v1.1/) |

### File organization

#### Shared firmware resources (this folder)
- **[INSTALLATION.md](INSTALLATION.md)** - General firmware flashing instructions

#### Printer-specific configs
Complete, ready-to-use firmware configurations in printer folders:
- **Configuration.h** - Main Marlin configuration file
- **Configuration_adv.h** - Advanced features and settings  
- **README.md** - Installation and tuning instructions

## Control board support

### Currently supported

#### BTT Octopus V1.1 (STM32F446ZE)
- **Status**: ✅ Proven working configuration
- **Stepper drivers**: 8 sockets (6 needed for 5-axis + 2 spare)
- **Performance**: 180MHz ARM Cortex-M4, adequate for 5-axis calculations
- **Compatibility**: Ender 5 Pro (tested), Ender 3 V3 SE (tested)
- **Wiring**: [Complete wiring diagram](../electronics/control-boards/octopus-v1.1/wiring-diagram-octopus-v1.1.png)

### Requirements for any control board
- **Minimum 6 stepper drivers** (X, Y, Z, E, A, B)
- **32-bit processor** recommended for kinematics calculations
- **UART stepper drivers** for advanced features
- **Adequate flash/RAM** for Marlin 2.1.x + Rep5x features

## Support resources

### Documentation
- **Installation guide**: [INSTALLATION.md](INSTALLATION.md)
- **Wiring diagram**: [../electronics/control-boards/octopus-v1.1/wiring-diagram-octopus-v1.1.png](../electronics/control-boards/octopus-v1.1/wiring-diagram-octopus-v1.1.png)

---

**Ready to flash firmware?** Start with your printer-specific configuration and follow the step-by-step installation guide! Join our [Discord community](https://discord.gg/GNdah82VBg) for firmware support.