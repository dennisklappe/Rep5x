# Rep5x - Ender 3 V3 SE firmware configuration

Marlin 2.1.x firmware configuration for Ender 3 V3 SE with Rep5x 5-axis retrofit using BTT Octopus V1.1 board.

## Files

- `configuration_rep5x_ender3v3se_octopus_v1.1.h` - Main Marlin configuration
- `configuration_adv_rep5x_ender3v3se_octopus_v1.1.h` - Advanced Marlin features
- `firmware_rep5x_ender3v3se_octopus_v1.1.bin` - Compiled firmware binary
- `start_gcode_rep5x_ender3v3se_octopus_v1.1.gcode` - Start G-code for slicer
- `end_gcode_rep5x_ender3v3se_octopus_v1.1.gcode` - End G-code for slicer
- `orcaslicer_profile_rep5x_ender3v3se.json` - OrcaSlicer printer profile

## Hardware configuration

### Board: BTT Octopus V1.1
- **Stepper drivers**: TMC2208 (UART mode)
- **Display**: BigTreeTech Mini 12864 Display
- **Build volume**: 200 x 200 x 174.6mm
- **Bowden length**: 600mm (extruder gear to nozzle tip)

### Stepper motor mapping (Marlin automatic pin assignment)
- **X-axis**: Motor 0 (X endstop: microswitch)
- **Y-axis**: Motor 1 (Y endstop: microswitch)
- **Z-axis**: Motor 2 (Z endstop: microswitch on X gantry)
- **A-axis (I)**: Motor 3 (yaw rotation, endstop on E0DET)
- **B-axis (J)**: Motor 4 (tilt rotation, endstop on E1DET)
- **E0 (Extruder)**: Motor 5

### Temperature sensors
- **Hotend**: TEMP_0 (thermistor type 1)
- **Heated bed**: TB (thermistor type 1)

### Heaters
- **Hotend**: HEATER_0 (max 270°C)
- **Heated bed**: HEATER_BED (max 70°C)

### Fans
- **Hotend cooling**: FAN1 (always on)
- **Controller fan**: FAN2 (auto-control)

## Key Configuration Settings

### Motion & Steps
- **Steps per unit**: X=80, Y=80, Z=400, A=26.666, B=26.68, E=415
- **Max acceleration**: X=3000, Y=3000, Z=500, A=1000, B=1000, E=10000 mm/s²
- **Homing feedrate**: X=50mm/s, Y=50mm/s, Z=15mm/s, A=90mm/s, B=45mm/s
- **Microstepping**: 16 microsteps (TMC2208 UART mode default)

### Axis Limits
- **X-axis**: 0 to 200mm (homes at X_MAX)
- **Y-axis**: -40 to 200mm (homes at Y_MIN, endstop at -40mm, bed 0-200mm)
- **Z-axis**: 0 to 174.6mm (homes at Z_MAX)
- **A-axis (I)**: -360° to 360° (homes at 177°)
- **B-axis (J)**: -146° to 146° (homes at J_MIN)

### Temperatures
- **Hotend max**: 270°C
- **Bed max**: 70°C
- **Extrude min**: 170°C

### Advanced Features
- **Babystepping**: Enabled (adjust Z offset during print)
- **Filament load/unload**: M701/M702 G-codes (600mm length)
- **Custom LCD menu**: "Filament" menu with Load/Unload shortcuts
- **Nozzle park**: Enabled (parks at X=10, Y=10, Z=20mm)

## Installation

### Option 1: Use pre-compiled firmware (recommended for exact same configuration)

If you want the exact same configuration as documented above:

1. Copy `firmware_rep5x_ender3v3se_octopus_v1.1.bin` to SD card root directory
2. Rename to `firmware.bin` (if required by your bootloader)
3. Insert SD card into Octopus board
4. Power on - firmware flashes automatically
5. Verify installation via LCD display or serial connection
6. Run `M502` then `M500` to load and save default settings

### Option 2: Customize and build yourself

If you need to modify settings for your specific setup:

1. Copy `configuration_rep5x_ender3v3se_octopus_v1.1.h` to Marlin source as `Configuration.h`
2. Copy `configuration_adv_rep5x_ender3v3se_octopus_v1.1.h` to Marlin source as `Configuration_adv.h`
3. Compile using PlatformIO with environment `STM32F446ZE_btt`
4. Flash resulting `.bin` file to board

## Getting help

**Discord**: https://discord.gg/GNdah82VBg for firmware support and troubleshooting
