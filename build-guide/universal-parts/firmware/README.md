# Rep5x - Firmware guide

Firmware configuration and installation guide for Rep5x 5-axis printer conversions using Marlin.

## Quick start: use the firmware builder

The easiest way to get your Rep5x firmware is to use the **Firmware Builder** tool:

**[tools.rep5x.com/firmware-builder](https://tools.rep5x.com/firmware-builder)**

The tool lets you:
- Select your control board and printer model
- Configure dimensions, motor settings, and display options
- Set up inverse kinematics parameters
- Build firmware directly in the cloud (no local setup required)
- Download ready-to-flash `firmware.bin`

Your configuration is automatically saved when you build, so you can load it later to make adjustments.

## Supported hardware

### Control boards

| Board | Status | Notes |
|-------|--------|-------|
| **BTT Octopus V1.1** | Fully supported | 8 stepper drivers, recommended choice |

### Printers

The firmware builder includes presets for common printers. Any printer can work with Rep5x as long as you know your:
- Bed dimensions (X, Y)
- Z height
- Homing directions
- Steps per mm for each axis

**Need a different board or printer?** [Ask on Discord](https://discord.gg/GNdah82VBg) and we'll add support.

## Manual installation

If you prefer to build firmware manually or need to customise beyond what the tool offers, see the detailed **[installation guide](INSTALLATION.md)**.

The manual process involves:
1. Cloning the Rep5x-Marlin repository
2. Copying configuration files
3. Building with PlatformIO
4. Flashing via SD card

Reference configuration files are provided in this folder:
- **Configuration.h** - Main Marlin configuration with Rep5x settings
- **Configuration_adv.h** - Advanced features and kinematics

## After flashing

Once your firmware is installed:

1. **Verify hardware** using [Printer Control](https://tools.rep5x.com/printer-control)
   - Check axis directions
   - Test endstops with M119
   - Verify heaters work

2. **Calibrate axes** using [Printer Setup](https://tools.rep5x.com/printer-setup)
   - Set C-axis (yaw) zero position
   - Set B-axis (tilt) zero position
   - Calibrate steps per degree

3. **Calibrate IK parameters** using [IK Calibration](https://tools.rep5x.com/calibration)
   - Measure LC and LB offsets
   - Fine-tune for accurate 5-axis motion

## Support

- **Discord community**: [discord.gg/GNdah82VBg](https://discord.gg/GNdah82VBg)
- **Detailed instructions**: [INSTALLATION.md](INSTALLATION.md)
