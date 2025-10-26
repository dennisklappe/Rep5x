# Rep5x - Firmware - Marlin

Marlin 2.1.x configurations for Rep5x 5-axis printing systems.

⚠️ **Note**: The configurations in these folders are examples of setups that have been used. Other parts, sensors, printers, etc. can be used - this is all still in active development. Join our [Discord](https://discord.gg/GNdah82VBg) for discussions and updates.

## Supported Boards

### BTT Octopus Pro V1.0.1 (STM32H723ZE)
- **Processor**: STM32H723ZET6 ARM Cortex-M7 @ 550MHz
- **Flash**: 512KB
- **RAM**: 564KB
- **Stepper Drivers**: 8 slots (XYZE + 4 additional)
- **Driver config**: TMC2209 (UART) for XYZ+E, TMC5160 (SPI) for yaw/tilt

### BTT Octopus V1.1 (STM32F446ZE)
- **Processor**: STM32F446ZET6 ARM Cortex-M4 @ 180MHz
- **Flash**: 512KB
- **RAM**: 128KB
- **Driver config**: TMC2208 (UART) for all 6 axes - Proven working prototype

## Quick start

### 1. Hardware setup
1. Install compatible control board
2. Wire stepper drivers and motors
3. Connect endstops and temperature sensors

### 2. Firmware installation
See [INSTALLATION.md](INSTALLATION.md) for detailed steps.

#### Option A: Pre-built firmware (recommended)
1. Download pre-built firmware.bin
2. Flash via SD card or DFU mode

#### Option B: Build from source
1. Install PlatformIO
2. Clone Marlin 2.1.x
3. Copy configuration files from `configs/` folder
4. Build and flash

### 3. Basic testing
1. Connect via serial terminal (115200 baud)
2. Send `M119` - check all endstops
3. Send `M122` - verify TMC driver status
4. Test basic movement: `G1 X10`, `G1 Y10`, etc.

## Configuration files

### Board-based organization
Firmware is organized by **control board**, not base printer, since:
- Board determines 95% of firmware configuration (motherboard, drivers, pins)
- Base printer only affects minor settings (bed size, thermistors, endstops)
- Same board works across multiple printer models with minimal changes

### Included configurations
- `configs/octopus-pro-h723/` - BTT Octopus Pro H723 configs (latest recommended)
- `configs/octopus-v1.1/` - BTT Octopus V1.1 configs (original prototype, proven working)

## Status

⚠️ **Pre-alpha**: Configurations are in active development.

For questions and updates, join our [Discord community](https://discord.gg/GNdah82VBg).