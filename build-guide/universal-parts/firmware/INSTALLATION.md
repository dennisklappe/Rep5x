# Rep5x - Firmware installation guide

Step-by-step instructions for installing and configuring Marlin firmware for Rep5x 5-axis printer conversions.

## Base configuration settings

The Rep5x firmware configurations include these key modifications:

### Axis definitions
```cpp
#define I_DRIVER_TYPE  TMC2208    // A-axis (yaw rotation)
#define J_DRIVER_TYPE  TMC2208    // B-axis (tilt rotation)
#define DISTINCT_E_FACTORS        // Separate settings for rotation axes
```

### Motion settings (actual Rep5x values)
```cpp
#define DEFAULT_AXIS_STEPS_PER_UNIT   { 40, 40, 400, 13.333, 13.34, 202.5 }
#define DEFAULT_MAX_FEEDRATE          { 500, 500, 20, 360, 90, 45 }
#define DEFAULT_MAX_ACCELERATION      { 3000, 3000, 100, 1000, 1000, 10000 }
```

### Rep5x kinematics
```cpp
#define I_MIN_POS -360                // A-axis limits (degrees)
#define I_MAX_POS 360
#define J_MIN_POS -135                // B-axis limits (degrees)
#define J_MAX_POS 135

#define I_HOME_DIR -1                 // A-axis homes to min
#define J_HOME_DIR -1                 // B-axis homes to min
```

## Prerequisites

### Required software
- **Arduino IDE 2.x** or **VSCode with PlatformIO extension**
- **USB cable** for control board connection
- **Rep5x firmware configuration** files from your printer-specific folder

### Control board requirements
- **6+ stepper drivers** (X, Y, Z, E, A, B)
- **32-bit processor** recommended (STM32F446ZE or similar)
- **Marlin 2.1.x compatible** control board

## Installation steps

### Step 1: Download Marlin firmware

Rep5x configurations are built for **Marlin 2.1.3**. Use the matching version:

```bash
git clone https://github.com/MarlinFirmware/Marlin.git
cd Marlin
git checkout 2.1.3-b3  # Use version matching Rep5x configs
```

> **Note**: The configuration files specify their Marlin version via `CONFIGURATION_H_VERSION`. Using a mismatched Marlin version will cause build errors. Check the version in your config file and checkout the matching Marlin tag.

### Step 2: Get Rep5x configuration files

Rep5x provides configuration files at two levels:

**Option A: Printer-specific configurations (recommended)**
Complete, tested configurations for specific printer + control board combinations:
```
build-guide/printer-specific/[your-printer]/firmware/[control-board]/
```

**Option B: Universal configurations (reference)**
Template configurations showing all Rep5x-specific settings. Use these as a reference when adapting your own configuration or if no printer-specific config exists:
```
build-guide/universal-parts/firmware/Configuration.h
build-guide/universal-parts/firmware/Configuration_adv.h
```

### Step 3: Replace configuration files

```bash
# Backup original configurations (recommended)
cp Marlin/Configuration.h Marlin/Configuration.h.backup
cp Marlin/Configuration_adv.h Marlin/Configuration_adv.h.backup

# Option A: Use printer-specific configs (if available)
cp build-guide/printer-specific/[your-printer]/firmware/[control-board]/Configuration.h Marlin/
cp build-guide/printer-specific/[your-printer]/firmware/[control-board]/Configuration_adv.h Marlin/

# Option B: Use universal configs as starting point
cp build-guide/universal-parts/firmware/Configuration.h Marlin/
cp build-guide/universal-parts/firmware/Configuration_adv.h Marlin/
# Then edit the [PRINTER-SPECIFIC] and [BOARD-SPECIFIC] settings for your setup
```

### Step 4: Compile and upload firmware

#### Using Arduino IDE:
1. **Open** `Marlin.ino` in Arduino IDE
2. **Select board**: Choose your control board (e.g., "STM32F446ZE BigTree Tech BTT002")
3. **Select port**: Choose the USB port your control board is connected to
4. **Compile**: Click the checkmark to compile
5. **Upload**: Click the arrow to upload firmware

#### Using VSCode with PlatformIO:
1. **Open** Marlin folder in VSCode
2. **Select environment**: Choose your control board environment in `platformio.ini`
3. **Build**: Use PlatformIO build button or `Ctrl+Alt+B`
4. **Upload**: Use PlatformIO upload button or `Ctrl+Alt+U`

### Step 5: Verify hardware with printer control

Before calibration, verify all hardware is working correctly using the **Printer Control** tool:

1. **Open** the Printer Control tool: [tools.rep5x.com/printer-control](https://tools.rep5x.com/printer-control)
2. **Connect** to your printer via USB serial

#### Check axis movement
Test each axis moves in the correct direction (do this before homing!):

1. **X-axis**: Jog +10mm - carriage should move RIGHT
2. **Y-axis**: Jog +10mm - bed should move FORWARD (towards you)
3. **Z-axis**: Jog +10mm - printhead should move UP
4. **A-axis**: Jog +10° - build plate should rotate CLOCKWISE (viewed from above)
5. **B-axis**: Jog +10° - nozzle should tilt LEFT

> **Wrong direction?** You must fix this before homing will work correctly. Either:
> - **Firmware**: Change `#define INVERT_X_DIR false` to `true` (or vice versa) in Configuration.h for the affected axis. For A-axis use `INVERT_I_DIR`, for B-axis use `INVERT_J_DIR`. Recompile and upload.
> - **Hardware**: Swap any two wires in the stepper motor connector (e.g., swap the two middle wires).
>
> **Important**: Motor direction must be correct before homing. The direction cannot be changed at runtime via G-code - it requires a firmware change or physical wire swap.

#### Check endstops
Send `M119` to check endstop status. Manually trigger each endstop and verify:
- Status should change from `open` to `TRIGGERED` when pressed
- All endstops should show `open` when not pressed

> **Endstop always triggered or never triggered?** This is usually an endstop hit state mismatch. In Marlin 2.1.x, use `X_MIN_ENDSTOP_HIT_STATE` instead of `X_MIN_ENDSTOP_INVERTING`:
> - `HIGH` = triggered when pin reads HIGH (typical for mechanical switches)
> - `LOW` = triggered when pin reads LOW (typical for optical sensors)
>
> For A and B axes, use `I_MIN_ENDSTOP_HIT_STATE` and `J_MIN_ENDSTOP_HIT_STATE`.

#### Check homing
Once axis directions and endstops are correct, test homing:

1. **Home X and Y first**: Send `G28 X Y` - watch carefully, be ready to power off if wrong direction
2. **Home Z**: Send `G28 Z` (ensure X and Y are homed first if using probe)
3. **Home A**: Send `G28 A` - rotation axis should move to endstop
4. **Home B**: Send `G28 B` - tilt axis should move to endstop

#### Check heaters
1. **Hotend**: Set temperature with `M104 S200`, monitor with `M105`
2. **Bed**: Set temperature with `M140 S60`, monitor with `M105`
3. **Verify** temperatures rise steadily and reach target

> **Note**: Don't worry about the exact A and B axis home positions yet. The precise zero positions and steps/degree calibration will be done in the next step.

### Step 6: Calibrate A and B axis

After firmware installation, you need to calibrate the A-axis (yaw) and B-axis (tilt) zero positions and steps per degree. Use the **Printer Setup** tool for this:

1. **Open** the Printer Setup tool: [tools.rep5x.com/printer-setup](https://tools.rep5x.com/printer-setup)
2. **Connect** to your printer via USB serial
3. **Follow the wizard**:
   - **Prepare**: Homes all axes and moves to starting position
   - **A-axis**: Align hotend assembly facing forwards (A0) and after full rotation (A360)
   - **B-axis**: Align nozzle straight down (B0) and horizontal left (B90)
   - **Z-axis**: Set nozzle height using paper test method
4. **Apply settings**: The tool calculates and sends the correct offsets to your printer

The tool will send these G-code commands:
```gcode
M206 B{offset}    ; B-axis home offset (nozzle points down at B0)
M206 A{offset}    ; A-axis home offset (hotend faces forwards at A0)
M92 B{steps}      ; B-axis steps/degree correction (if needed)
M92 A{steps}      ; A-axis steps/degree correction (if needed)
M500              ; Save to EEPROM
```

> **Note**: Run this calibration before proceeding to LA/LB measuring.

## Troubleshooting build errors

### Version mismatch errors

```
error: "Your Configuration.h file is for a newer version of Marlin."
```

**Cause**: The Marlin source code version doesn't match the configuration file version.

**Solution**: Check `CONFIGURATION_H_VERSION` in your Configuration.h (e.g., `02010300` = 2.1.3.0) and checkout the matching Marlin version:
```bash
git checkout 2.1.3-b3  # For version 02010300
```

### Missing endstop pin errors

```
error: "I_MAX_PIN, I_STOP_PIN, or I_SPI_SENSORLESS is required for I axis homing."
```

**Cause**: The A-axis (I) or B-axis (J) endstop pins are not defined. Rep5x uses non-standard pins for these axes.

**Solution**: Add pin definitions after the `MOTHERBOARD` definition in Configuration.h. Use `I_MIN_PIN` or `I_MAX_PIN` depending on your homing direction (`I_HOME_DIR`):

```cpp
#define MOTHERBOARD BOARD_BTT_OCTOPUS_V1_1
#endif

// Rep5x custom pin assignments for A-axis (I) and B-axis (J) endstops
// Use I_MIN_PIN/J_MIN_PIN when homing to MIN (I_HOME_DIR -1)
// Use I_MAX_PIN/J_MAX_PIN when homing to MAX (I_HOME_DIR 1)
#define I_MIN_PIN PG13   // A-axis endstop (adjust pin for your board)
#define J_MIN_PIN PG14   // B-axis endstop (adjust pin for your board)
```

**BTT Octopus V1.1 common pins:**
- J30 connector: PG13
- J31 connector: PG13
- J32 connector: PG14

The exact pins depend on your control board and wiring. Check which connector your endstops are plugged into.

### Endstop status inverted (triggered shows open)

**Symptom**: When you trigger an endstop, `M119` shows `open`, and when released it shows `TRIGGERED`.

**Cause**: The endstop hit state doesn't match your sensor type.

**Solution**: Change the `ENDSTOP_HIT_STATE` for the affected axis in Configuration.h:

```cpp
// For mechanical switches (normally open), typically use HIGH
#define I_MIN_ENDSTOP_HIT_STATE HIGH

// For optical sensors, often use LOW
#define J_MIN_ENDSTOP_HIT_STATE LOW
```

If changing from `HIGH` to `LOW` (or vice versa) fixes the inversion, the setting is correct.

### DGUS_UI_IS macro errors

```
error: missing binary operator before token "("
 #if DGUS_UI_IS(MKS)
```

**Cause**: Old configuration file syntax not compatible with newer Marlin versions.

**Solution**: Comment out the DGUS section in Configuration.h:
```cpp
//#define DGUS_LCD_UI ORIGIN
//#if DGUS_UI_IS(MKS)
//  #define USE_MKS_GREEN_UI
//#elif DGUS_UI_IS(IA_CREALITY)
//  ...
//#endif
```

### PID constant naming errors

```
error: "DEFAULT_Kp, DEFAULT_Ki, DEFAULT_Kd are now (uppercase) DEFAULT_KP, DEFAULT_KI, DEFAULT_KD."
```

**Cause**: Newer Marlin versions use uppercase PID constants.

**Solution**: Replace in Configuration.h:
```cpp
// Old (lowercase)
#define DEFAULT_Kp  22.20
#define DEFAULT_Ki   1.08
#define DEFAULT_Kd 114.00

// New (uppercase)
#define DEFAULT_KP  22.20
#define DEFAULT_KI   1.08
#define DEFAULT_KD 114.00
```

## Support

- **Assembly guide**: [assembly-guide.md](../../assembly-instructions-universal.md)
- **Community support**: [Discord](https://discord.gg/GNdah82VBg)