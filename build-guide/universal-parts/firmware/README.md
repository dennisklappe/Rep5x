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
| **Ender 3 V3 SE** | BTT Octopus V1.1 | ⚠️ In development | Future release |

### File organization

#### Shared firmware resources (this folder)
- **[INSTALLATION.md](INSTALLATION.md)** - General firmware flashing instructions
- **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)** - Common firmware issues and solutions

#### Printer-specific configs
Complete, ready-to-use firmware configurations in printer folders:
- **Configuration.h** - Main Marlin configuration file
- **Configuration_adv.h** - Advanced features and settings  
- **README.md** - Installation and tuning instructions

## Quick start guide

### 1. Choose your configuration
Navigate to your printer's firmware folder:
```
../../printer-specific/[your-printer]/firmware/[your-control-board]/
```

### 2. Download Marlin 2.1.x
```bash
git clone https://github.com/MarlinFirmware/Marlin.git
cd Marlin
git checkout 2.1.x
```

### 3. Install Rep5x configuration
Copy the Configuration.h and Configuration_adv.h files from your printer's folder to replace the default Marlin files.

### 4. Compile and flash
Use Arduino IDE or PlatformIO to compile and upload to your control board.

### 5. Verify and calibrate
Test all axes and use the [Rep5x calibration tool](https://calibrator.rep5x.com/) for precise setup.

## Control board support

### Currently supported

#### BTT Octopus V1.1 (STM32F446ZE)
- **Status**: ✅ Proven working configuration
- **Stepper drivers**: 8 sockets (6 needed for 5-axis + 2 spare)
- **Performance**: 180MHz ARM Cortex-M4, adequate for 5-axis calculations
- **Compatibility**: Ender 5 Pro (tested), other printers (TBD)
- **Wiring**: [Complete wiring diagram](../electronics/control-boards/octopus-v1.1/wiring-diagram-octopus-v1.1.png)

### Requirements for any control board
- **Minimum 6 stepper drivers** (X, Y, Z, E, A, B)
- **32-bit processor** recommended for kinematics calculations
- **UART stepper drivers** for advanced features
- **Adequate flash/RAM** for Marlin 2.1.x + Rep5x features

## 5-axis firmware features

### Additional axes configuration
Rep5x adds two rotation axes to standard 3D printer control:

#### A-axis (I in Marlin) - Yaw rotation
- **Range**: Continuous 360° rotation
- **Motor**: NEMA17 pancake stepper
- **Drive**: GT2 belt and pulley system
- **Endstop**: Hall effect sensor or microswitch

#### B-axis (J in Marlin) - Tilt rotation  
- **Range**: ±90° minimum (typically more)
- **Motor**: Standard NEMA17 stepper
- **Drive**: Direct connection to B-driven-pulley
- **Endstop**: Microswitch with mechanical limit

## Support resources

### Documentation
- **Installation guide**: [INSTALLATION.md](INSTALLATION.md)
- **Troubleshooting**: [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
- **Wiring diagram**: [../electronics/control-boards/octopus-v1.1/wiring-diagram-octopus-v1.1.png](../electronics/control-boards/octopus-v1.1/wiring-diagram-octopus-v1.1.png)

### Community support
- **Discord**: Real-time firmware support and discussion
- **GitHub**: Bug reports and feature requests
- **Build logs**: Community experiences and solutions

### External resources
- **Marlin documentation**: [marlinfw.org](https://marlinfw.org/)
- **Rep5x calibrator**: [calibrator.rep5x.com](https://calibrator.rep5x.com/)
- **Control board vendors**: BTT documentation and support

---

**Ready to flash firmware?** Start with your printer-specific configuration and follow the step-by-step installation guide!