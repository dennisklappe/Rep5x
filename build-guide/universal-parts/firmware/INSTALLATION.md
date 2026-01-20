# Rep5x - Firmware installation guide

Step-by-step instructions for installing Marlin firmware on your Rep5x 5-axis printer.

## Method 1: firmware builder (recommended)

The **Firmware Builder** is the easiest way to get your Rep5x firmware:

**[tools.rep5x.com/firmware-builder](https://tools.rep5x.com/firmware-builder)**

### Step 1: configure your firmware

1. Open the Firmware Builder
2. Select your control board (e.g., BTT Octopus V1.1)
3. Enter your printer dimensions
4. Configure motor settings (drivers, steps per unit, directions)
5. Configure inverse kinematics parameters (LC, LB)

### Step 2: build and download

1. Review your configuration on the final step
2. Click **"Build firmware.bin"**
3. Wait for cloud compilation (usually 1-2 minutes)
4. Your `firmware.bin` and config file download automatically

### Step 3: flash to your board

1. Copy `firmware.bin` to a FAT32-formatted SD card (root directory)
2. Power off your printer
3. Insert the SD card into your control board
4. Power on - the firmware will flash automatically
5. The file will be renamed to `firmware.CUR` when complete
6. Run `M502` then `M500` to load default settings

### Step 4: iterate if needed

Found something wrong? (motor direction, homing issue, etc.)

1. Open the Firmware Builder again
2. Click **"Load"** and select your saved `rep5x-firmware-config-*.json` file
3. Make your changes (e.g., flip a motor direction)
4. Build and flash again

Your config file is automatically saved every time you build, so you can always pick up where you left off.

**That's it!** Continue to [verifying your installation](#verifying-your-installation) below.

---

## Method 2: manual build (advanced)

For users who need full control over their firmware or want to customise beyond what the tool offers.

### Prerequisites

- **Git** for cloning repositories
- **VSCode** with **PlatformIO extension** (recommended) or Arduino IDE
- **USB cable** for your control board
- Basic familiarity with command line

### Step 1: clone Rep5x-Marlin

Rep5x uses a custom Marlin fork with 5-axis support:

```bash
git clone https://github.com/dennisklappe/Rep5x-Marlin.git
cd Rep5x-Marlin
git checkout Marlin2ForPipetBot
```

### Step 2: copy configuration files

The base configuration for Rep5x with BTT Octopus V1.1 is included:

```bash
# Copy the Rep5x configuration
cp config/examples/Rep5x/Ender3V3SE_OctopusV1.1/Configuration.h Marlin/
cp config/examples/Rep5x/Ender3V3SE_OctopusV1.1/Configuration_adv.h Marlin/
```

Or use the reference configs from this folder as a starting point.

### Step 3: customise for your printer

Edit `Marlin/Configuration.h` to match your setup:

```cpp
// Bed dimensions
#define X_BED_SIZE 200
#define Y_BED_SIZE 200
#define Z_MAX_POS 170

// Homing directions (1 = MAX, -1 = MIN)
#define X_HOME_DIR 1
#define Y_HOME_DIR -1
#define Z_HOME_DIR 1

// Steps per unit (X, Y, Z, C, B, E)
#define DEFAULT_AXIS_STEPS_PER_UNIT { 80, 80, 400, 26.666, 26.68, 415 }

// Motor directions
#define INVERT_X_DIR false
#define INVERT_Y_DIR true
#define INVERT_Z_DIR false
#define INVERT_I_DIR true   // C-axis (yaw)
#define INVERT_J_DIR false  // B-axis (tilt)

// IK parameters
#define DEFAULT_ROTATIONAL_JOINT_OFFSET_Y 0.0    // LC
#define DEFAULT_ROTATIONAL_JOINT_OFFSET_Z 47.9   // LB
#define DEFAULT_TOOL_CENTERPOINT_CONTROL true    // Enable IK by default
```

### Step 4: build with PlatformIO

```bash
# Install PlatformIO CLI if not already installed
pip install platformio

# Build for BTT Octopus V1.1
pio run -e STM32F446ZE_btt
```

The compiled firmware will be at `.pio/build/STM32F446ZE_btt/firmware.bin`

### Step 5: flash to your board

1. Copy `firmware.bin` to SD card
2. Insert into control board and power on
3. Run `M502` then `M500` to load defaults

---

## Verifying your installation

After flashing, verify everything works using the [Printer Control](https://tools.rep5x.com/printer-control) tool.

### Check axis movement

**Important**: Test directions before homing! Move each axis manually first.

| Axis | Command | Expected movement |
|------|---------|-------------------|
| X | `G91` then `G0 X10` | Carriage moves RIGHT |
| Y | `G91` then `G0 Y10` | Bed moves FORWARD |
| Z | `G91` then `G0 Z10` | Printhead moves UP |
| C (yaw) | `G91` then `G0 I10` | Build plate rotates CLOCKWISE (from above) |
| B (tilt) | `G91` then `G0 J10` | Nozzle tilts LEFT |

**Wrong direction?** Either:
- Change `INVERT_X_DIR` (etc.) in Configuration.h and rebuild
- Or swap two wires in the stepper motor connector

### Check endstops

Send `M119` to check endstop status:

```
Reporting endstop status
x_max: open
y_min: open
z_max: open
i_min: open
j_min: open
```

Manually trigger each endstop and verify it changes to `TRIGGERED`.

**Always triggered or never triggered?** Change `X_MIN_ENDSTOP_HIT_STATE` between `HIGH` and `LOW` in Configuration.h.

### Test homing

Once directions and endstops are correct:

1. `G28 X Y` - Home X and Y (watch carefully, be ready to power off)
2. `G28 Z` - Home Z
3. `G28 I` - Home C-axis (yaw)
4. `G28 J` - Home B-axis (tilt)
5. `G28` - Home all

### Check heaters

```gcode
M104 S200    ; Heat hotend to 200°C
M140 S60     ; Heat bed to 60°C
M105         ; Check temperatures
```

Verify temperatures rise steadily and reach target.

---

## Next steps

1. **Calibrate C and B axes**: Use [Printer Setup](https://tools.rep5x.com/printer-setup) to set zero positions
2. **Calibrate IK parameters**: Use [IK Calibration](https://tools.rep5x.com/calibration) to measure LC and LB
3. **Test 5-axis motion**: Try simple tilted prints to verify kinematics

---

## Troubleshooting

### Build errors

#### Version mismatch
```
error: "Your Configuration.h file is for a different version of Marlin."
```
Make sure you're using the Rep5x-Marlin fork, not the main Marlin repository.

#### Missing endstop pins
```
error: "I_MAX_PIN, I_STOP_PIN, or I_SPI_SENSORLESS is required for I axis homing."
```
The C and B axis endstop pins need to be defined. For BTT Octopus V1.1:
```cpp
#define I_MIN_PIN PG13   // C-axis endstop
#define J_MIN_PIN PG14   // B-axis endstop
```

#### PID constant errors
```
error: "DEFAULT_Kp... are now (uppercase) DEFAULT_KP..."
```
Use uppercase: `DEFAULT_KP`, `DEFAULT_KI`, `DEFAULT_KD`

### Runtime issues

#### Axis moves wrong direction
Change `INVERT_X_DIR` (or corresponding axis) in Configuration.h, or swap two wires in the motor connector.

#### Endstop always triggered
Change `X_MIN_ENDSTOP_HIT_STATE` between `HIGH` and `LOW`.

#### Homing crashes into wrong end
Check `X_HOME_DIR` setting: `1` = homes to MAX, `-1` = homes to MIN.

#### IK not working (moves are wrong)
- Verify `DEFAULT_TOOL_CENTERPOINT_CONTROL true` is set
- Check LC and LB values match your toolhead geometry
- Run IK calibration with the calibration tool

---

## Support

- **Discord**: [discord.gg/GNdah82VBg](https://discord.gg/GNdah82VBg)
