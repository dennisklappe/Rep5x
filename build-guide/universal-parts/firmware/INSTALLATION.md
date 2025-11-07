# Rep5x - Firmware installation guide

Step-by-step instructions for installing and configuring Marlin firmware for Rep5x 5-axis printer conversions.

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

```bash
git clone https://github.com/MarlinFirmware/Marlin.git
cd Marlin
git checkout 2.1.x  # Use stable 2.1.x branch
```

### Step 2: Get Rep5x configuration files

Download the configuration files specific to your printer and control board:
- **Configuration.h** - Main Marlin configuration with Rep5x settings
- **Configuration_adv.h** - Advanced features and Rep5x kinematics

**Location**: `printer-specific/[your-printer]/firmware/[control-board]/`

### Step 3: Replace configuration files

```bash
# Backup original configurations (optional)
cp Marlin/Configuration.h Marlin/Configuration.h.backup
cp Marlin/Configuration_adv.h Marlin/Configuration_adv.h.backup

# Copy Rep5x configurations
cp /path/to/rep5x/Configuration.h Marlin/Configuration.h
cp /path/to/rep5x/Configuration_adv.h Marlin/Configuration_adv.h
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

### Step 5: Verify installation

1. **Connect** via serial terminal (115200 baud)
2. **Send commands**:
   ```gcode
   M115        ; Show firmware version - should show Marlin with Rep5x build
   M119        ; Check endstop status
   G28         ; Test homing (careful - test X, Y, Z first)
   ```

## Base configuration settings

The Rep5x firmware configurations include these key modifications:

### Axis definitions
```cpp
#define I_DRIVER_TYPE  TMC2208    // A-axis (yaw rotation)
#define J_DRIVER_TYPE  TMC2208    // B-axis (tilt rotation)
#define DISTINCT_E_FACTORS        // Separate settings for rotation axes
```

### Motion settings (typical values)
```cpp
#define DEFAULT_AXIS_STEPS_PER_UNIT   { 80, 80, 400, 93, 80, 80 }
#define DEFAULT_MAX_FEEDRATE          { 500, 500, 5, 25, 30, 30 }
#define DEFAULT_MAX_ACCELERATION      { 500, 500, 100, 10000, 500, 500 }
```

### Rep5x kinematics
```cpp
#define KINEMATICS_5AXIS              // Enable 5-axis inverse kinematics
#define A_MIN_POS 0                   // A-axis limits (degrees)
#define A_MAX_POS 360
#define B_MIN_POS -90                 // B-axis limits (degrees)
#define B_MAX_POS 90
```

### Safety features
- **Thermal protection** for all heaters
- **Software endstops** for rotation axes
- **Emergency stop** functionality
- **Rotation limit protection**

## Troubleshooting

### Compilation errors
- **Missing board definition**: Ensure correct board selected
- **Library conflicts**: Update PlatformIO or Arduino IDE
- **Configuration errors**: Check for typos in configuration files

### Upload errors
- **Port selection**: Verify correct USB port selected
- **Driver issues**: Install control board USB drivers
- **Cable problems**: Try different USB cable

### Runtime issues
- **Axis not moving**: Check stepper driver installation and current settings
- **Homing failures**: Verify endstop connections and configuration
- **Communication errors**: Check baud rate (115200) and USB connection

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for detailed troubleshooting steps.

## Customization

### Motor current settings
Adjust based on your specific stepper motors:
```cpp
#define X_CURRENT       800    // X-axis motor current (mA)
#define Y_CURRENT       800    // Y-axis motor current  
#define Z_CURRENT       800    // Z-axis motor current
#define E0_CURRENT      800    // Extruder motor current
#define I_CURRENT       600    // A-axis motor current
#define J_CURRENT      1000    // B-axis motor current
```

### Bed and hotend settings
Update for your specific hardware:
```cpp
#define X_BED_SIZE 220         // Your bed X size
#define Y_BED_SIZE 220         // Your bed Y size
#define Z_MAX_POS 300          // Your Z height
#define TEMP_SENSOR_0 1        // Your hotend thermistor type
```

## Support

- **Assembly guide**: [assembly-guide.md](../../assembly-guide.md)
- **Troubleshooting**: [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
- **Community support**: [Discord](https://discord.gg/GNdah82VBg)