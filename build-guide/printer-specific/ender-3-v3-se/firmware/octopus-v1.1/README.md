# Rep5x - Ender 3 V3 SE + BTT Octopus V1.1

Marlin firmware configuration for Ender 3 V3 SE with Rep5x 5-axis retrofit using BTT Octopus V1.1 board.

For general firmware installation instructions, building from source, and troubleshooting, see the [universal firmware installation guide](../../../../universal-parts/firmware/INSTALLATION.md).

## Files

| File | Description |
|------|-------------|
| `configuration_rep5x_ender3v3se_octopus_v1.1.h` | Marlin Configuration.h |
| `configuration_adv_rep5x_ender3v3se_octopus_v1.1.h` | Marlin Configuration_adv.h |
| `firmware_rep5x_ender3v3se_octopus_v1.1.bin` | Pre-compiled firmware binary |

## Quick install (pre-compiled)

1. Copy `firmware_rep5x_ender3v3se_octopus_v1.1.bin` to SD card
2. Rename to `firmware.bin`
3. Insert SD card into Octopus board and power on
4. After flashing, run `M502` then `M500` to load defaults

## Build from source

```bash
git clone https://github.com/MarlinFirmware/Marlin.git
cd Marlin
git checkout 2.1.3-b3

# Copy configurations
cp path/to/configuration_rep5x_ender3v3se_octopus_v1.1.h Marlin/Configuration.h
cp path/to/configuration_adv_rep5x_ender3v3se_octopus_v1.1.h Marlin/Configuration_adv.h

# Set build environment in platformio.ini
# default_envs = STM32F446ZE_btt

pio run
```

## Hardware specifics

### Stepper motor mapping

| Axis | Motor slot | Endstop | Notes |
|------|------------|---------|-------|
| X | Motor 0 | X_MAX | Homes to max |
| Y | Motor 1 | Y_MIN | Homes to min (-40mm) |
| Z | Motor 2 | Z_MAX | Homes to max |
| A (I) | Motor 3 | J30 (PG13) | Yaw rotation, homes to min |
| B (J) | Motor 4 | J32 (PG14) | Tilt rotation, homes to min |
| E0 | Motor 5 | - | Extruder |

### Key settings

| Setting | Value |
|---------|-------|
| Build volume | 200 × 200 × 174.6 mm |
| Steps/unit (X, Y, Z, E, A, B) | 80, 80, 400, 415, 26.666, 26.68 |
| Stepper drivers | TMC2208 (UART) |
| Display | BTT Mini 12864 |
| Hotend max temp | 270°C |
| Bed max temp | 70°C |

### Axis limits

| Axis | Min | Max | Home direction |
|------|-----|-----|----------------|
| X | 0 | 200 mm | MAX |
| Y | -40 | 200 mm | MIN |
| Z | 0 | 174.6 mm | MAX |
| A (I) | -360° | 360° | MIN |
| B (J) | -135° | 135° | MIN |

## After installation

Follow the [installation guide](../../../../universal-parts/firmware/INSTALLATION.md) for:
- Verifying hardware with Printer Control tool
- Calibrating A and B axes with Printer Setup tool
- Troubleshooting common build errors

## Support

- [Discord](https://discord.gg/GNdah82VBg)
