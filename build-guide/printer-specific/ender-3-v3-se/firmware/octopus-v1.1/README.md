# Ender 3 V3 SE - Rep5x Firmware Configuration

Marlin 2.1.x firmware configuration for Ender 3 V3 SE with Rep5x 5-axis retrofit using BTT Octopus V1.1 board.

## Files

- `Configuration.h` - Main Marlin configuration
- `Configuration_adv.h` - Advanced Marlin features
- `firmware_rep5x_ender3v3se.bin` - Compiled firmware binary

## Hardware configuration

### Board: BTT Octopus V1.1
- **Stepper drivers**: TMC2209 (UART mode)
- **Display**: BigTreeTech Mini 12864 Display
- **Build volume**: 220 x 220 x 86mm (Z reduced due to 5-axis carriage)

### Stepper motor mapping
- **X-axis**: Motor 0 (X endstop: microswitch)
- **Y-axis**: Motor 1 (Y endstop: microswitch)
- **Z-axis**: Motor 2 (Z endstop: microswitch on X gantry)
- **E0 (Extruder)**: Motor 3
- **A-axis**: Motor 4 (yaw rotation, no endstop)
- **B-axis**: Motor 5 (tilt rotation, no endstop)

### Temperature sensors
- **Hotend**: TEMP_0 (thermistor type 1)
- **Heated bed**: TB (thermistor type 1)

### Heaters
- **Hotend**: HEATER_0 (max 270°C)
- **Heated bed**: HEATER_BED (max 70°C)

### Fans
- **Part cooling**: FAN0
- **Hotend cooling**: FAN1 (always on)
- **Controller fan**: FAN2 (auto-control)

## Key features

- **5-axis kinematics**: A-axis (yaw) and B-axis (tilt) enabled
- **Endstops**: Microswitch endstops for X, Y, and Z axes
- **Manual bed leveling**: 3x3 mesh with LCD control
- **S-curve acceleration**: Enabled for smoother motion
- **Classic Jerk**: Disabled (uses Junction Deviation)

## Installation

1. Copy `firmware_rep5x_ender3v3se.bin` to SD card root directory
2. Rename to `firmware.bin` (if required by your bootloader)
3. Insert SD card into Octopus board
4. Power on - firmware flashes automatically
5. Verify installation via LCD display or serial connection

## Important notes

- **Original V3 SE screen**: Not compatible with Marlin (this configuration uses BTT Mini 12864 Display)
- **Endstops**: Z endstop must be installed on X gantry (original was in hotend)
- **Bowden setup**: Configuration assumes external extruder with Bowden tube
- **Z-height**: Reduced from 250mm to 86mm due to 5-axis carriage clearance

## Start/End G-code

Located in parent repository:
- `/temp/start.gcode` - Pre-print routine with bed/nozzle heating and purge line
- `/temp/end.gcode` - Post-print routine with safe positioning

## Customization

To modify configuration:
1. Edit `Configuration.h` and `Configuration_adv.h`
2. Compile using PlatformIO with environment `STM32F446ZE_btt`
3. Flash resulting `.bin` file to board

## Getting help

**Discord**: https://discord.gg/GNdah82VBg for firmware support and troubleshooting
