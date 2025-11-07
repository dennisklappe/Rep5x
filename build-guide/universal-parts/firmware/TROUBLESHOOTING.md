# Troubleshooting FAQ

Common issues and solutions for Marlin firmware.

⚠️ **Early development**: This is a basic FAQ based on initial testing. Many issues may not be covered yet. Join our [Discord](https://discord.gg/GNdah82VBg) for real-time help!

## Build Issues

**Q: "Your Configuration.h file is for an old version of Marlin"**  
A: Update version numbers in both config files:
```cpp
#define CONFIGURATION_H_VERSION 02010205
#define CONFIGURATION_ADV_H_VERSION 02010205
```

**Q: Build fails with array size errors**  
A: Array sizes must match your enabled axes. For 4 axes (XYZE), use 4 values:
```cpp
#define DEFAULT_AXIS_STEPS_PER_UNIT { 40, 40, 400, 4.45 }
```
For 6 axes (XYZE + yaw/tilt), use 6 values:
```cpp
#define DEFAULT_AXIS_STEPS_PER_UNIT { 40, 40, 400, 4.45, 45, 45 }
```

**Q: "TMC on I requires I_CS_PIN"**  
A: Add CS pin definitions for SPI drivers:
```cpp
#define I_CS_PIN PC13
#define J_CS_PIN PE4
```

**Q: Wrong board selected error**  
A: Use correct motherboard definition:
```cpp
// H723 boards
#define MOTHERBOARD BOARD_BTT_OCTOPUS_MAX_EZ_V1_0

// F446 boards  
#define MOTHERBOARD BOARD_BTT_OCTOPUS_V1_1
```

## Upload Issues

**Q: SD card flash doesn't work**  
A: Check these requirements:
- File must be named exactly `firmware.bin`
- SD card format: FAT32
- Place file in root directory
- Power cycle after inserting card

## Runtime Issues

**Q: No serial connection**  
A: Try these solutions:
- Use 115200 baud rate
- Try different USB cable
- Install STM32 drivers
- Check port permissions: `sudo chmod 666 /dev/ttyACM0`

**Q: Motors don't move**  
A: Run diagnostics:
```gcode
M119  ; Check endstops
M122  ; Check TMC drivers  
M503  ; Verify settings
```

**Q: TMC driver errors**  
A: Check `M122` output:
- `OT` = Overtemperature (reduce current)
- `OLA/OLB` = Check motor connections
- `UV_CP` = Check power supply voltage

**Q: Wrong homing direction**  
A: Check endstop status with `M119`, then adjust endstop logic in firmware if needed.

## Getting Help

**Include this info when asking for help:**
- Exact board model (H723 vs F446)
- Error messages (copy/paste exactly)
- Output from: `M115`, `M119`, `M122`

**Where to get help:**
- [Discord community](https://discord.gg/GNdah82VBg) (fastest response)
- GitHub issues (for confirmed bugs)

## Emergency

**Stop everything immediately:**
```gcode
M112  ; Emergency stop
```

**If printer acts dangerously:**
1. Power off immediately
2. Check all wiring
3. Flash known-good firmware
4. Test basic movements first

---

💡 **Tip**: Start with 3-axis configuration first, get that working, then enable rotational axes step by step.