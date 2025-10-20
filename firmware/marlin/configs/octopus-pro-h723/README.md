# BTT Octopus Pro V1.0.1 (STM32H723ZE) configuration

Configuration for BigTreeTech Octopus Pro V1.0.1 board with STM32H723ZE processor.

**Current status**: In development for [Ender 3 V3 SE](../../printer-models/ender-3-v3-se/) conversion. Configuration files will be updated soon - join our [Discord](https://discord.gg/GNdah82VBg) for latest updates!

## Stepper driver layout

| Position | Axis | Driver Type | Interface | Notes |
|----------|------|-------------|-----------|-------|
| 0 | X | TMC2209 | UART | |
| 1 | Y | TMC2209 | UART | |
| 2 | Z | TMC2209 | UART | |
| 3 | E0 | TMC2209 | UART | Extruder |
| 4 | I (Yaw) | TMC5160 | SPI | Rotational axis |
| 5 | J (Tilt) | TMC5160 | SPI | Rotational axis |
| 6 | - | - | - | Available |
| 7 | - | - | - | Available |

## Wiring diagrams

![Rep5x Wiring Diagram](wiring-diagram-rep5x.png)

*Rep5x specific connections for BTT Octopus Pro H723*

- **[wiring-diagram-rep5x.png](wiring-diagram-rep5x.png)** - Rep5x specific connections (PNG format)
- **[wiring-diagram-5axis.svg](wiring-diagram-5axis.svg)** - Complete 5-axis wiring schematic (editable in draw.io)

## Configuration details

### Key settings
```cpp
// Board definition
#define MOTHERBOARD BOARD_BTT_OCTOPUS_MAX_EZ_V1_0

// Driver types
#define X_DRIVER_TYPE  TMC2209
#define Y_DRIVER_TYPE  TMC2209
#define Z_DRIVER_TYPE  TMC2209
#define E0_DRIVER_TYPE TMC2209

// Rotational axes
#define I_DRIVER_TYPE  TMC5160  // Yaw axis
#define J_DRIVER_TYPE  TMC5160  // Tilt axis
```

### Build environment
Use PlatformIO environment: `STM32H723ZE_btt`

```bash
pio run -e STM32H723ZE_btt
```

## Status

⚠️ **Pre-alpha**: Configuration files are in development and not fully tested yet.

For questions and updates, join our [Discord community](https://discord.gg/GNdah82VBg).