/**
 * Rep5x Universal Configuration.h
 *
 * Base Marlin configuration for Rep5x 5-axis printer conversions.
 *
 * IMPORTANT: This file contains the essential Rep5x-specific settings.
 * You must merge these settings with your printer's existing Configuration.h
 * or use this as a reference when modifying your own configuration.
 *
 * Settings marked with [PRINTER-SPECIFIC] need to be adjusted for your printer.
 * Settings marked with [BOARD-SPECIFIC] need to be adjusted for your control board.
 *
 * For complete working configurations, see the printer-specific folder:
 *   build-guide/printer-specific/[your-printer]/firmware/
 */

#pragma once

//===========================================================================
//============================= Rep5x Identity ==============================
//===========================================================================

#define STRING_CONFIG_H_AUTHOR "Rep5x"

//===========================================================================
//========================== [BOARD-SPECIFIC] ===============================
//===========================================================================

/**
 * Select your control board from boards.h
 * Common boards for Rep5x builds:
 *   BOARD_BTT_OCTOPUS_V1_1     - BigTreeTech Octopus V1.1
 *   BOARD_BTT_OCTOPUS_PRO_V1_0 - BigTreeTech Octopus Pro
 *   BOARD_BTT_SKR_V1_4_TURBO   - BigTreeTech SKR 1.4 Turbo
 *   BOARD_MKS_ROBIN_NANO_V3    - MKS Robin Nano V3
 */
#ifndef MOTHERBOARD
  #define MOTHERBOARD BOARD_BTT_OCTOPUS_V1_1  // [BOARD-SPECIFIC] Change to your board
#endif

//===========================================================================
//========================= Rep5x Stepper Drivers ===========================
//===========================================================================

/**
 * Stepper driver types for A-axis (yaw/rotation) and B-axis (tilt).
 * These use Marlin's I and J axis slots.
 *
 * Common driver types: A4988, DRV8825, TMC2208, TMC2209, TMC2130, TMC5160
 * [BOARD-SPECIFIC] Adjust to match your stepper drivers
 */
#define I_DRIVER_TYPE  TMC2208    // A-axis (yaw rotation) driver
#define J_DRIVER_TYPE  TMC2208    // B-axis (tilt) driver

/**
 * Axis naming for Rep5x
 * I = A-axis (yaw/rotation around Z)
 * J = B-axis (tilt/nod)
 */
#ifdef I_DRIVER_TYPE
  #define AXIS4_NAME 'A'  // A-axis for yaw rotation
#endif
#ifdef J_DRIVER_TYPE
  #define AXIS5_NAME 'B'  // B-axis for tilt
#endif

//===========================================================================
//======================== [PRINTER-SPECIFIC] ===============================
//===========================================================================

/**
 * Printer bed size - adjust for your printer
 * [PRINTER-SPECIFIC]
 */
#define X_BED_SIZE 200    // mm - adjust for your printer
#define Y_BED_SIZE 200    // mm - adjust for your printer

/**
 * Travel limits after homing
 * [PRINTER-SPECIFIC] Adjust Z_MAX_POS for your printer's height
 */
#define X_MIN_POS 0
#define Y_MIN_POS 0
#define Z_MIN_POS 0
#define X_MAX_POS X_BED_SIZE
#define Y_MAX_POS Y_BED_SIZE
#define Z_MAX_POS 175     // [PRINTER-SPECIFIC] Adjust for your printer

/**
 * Rep5x rotation axis limits (degrees)
 * These are typically the same for all Rep5x builds
 */
#define I_MIN_POS -360    // A-axis minimum (degrees)
#define I_MAX_POS 360     // A-axis maximum (degrees)
#define J_MIN_POS -135    // B-axis minimum (degrees) - limited by physical design
#define J_MAX_POS 135     // B-axis maximum (degrees)

//===========================================================================
//======================= Rep5x Motor Directions ============================
//===========================================================================

/**
 * Motor direction inversion
 * Change these if a motor moves the wrong way during jogging.
 *
 * Expected directions (when jogging positive):
 *   X: Carriage moves RIGHT
 *   Y: Bed moves FORWARD (towards you)
 *   Z: Printhead moves UP
 *   A (I): Build plate rotates CLOCKWISE (viewed from above)
 *   B (J): Nozzle tilts LEFT
 *
 * [PRINTER-SPECIFIC] These depend on your motor wiring and stepper drivers.
 * Test BEFORE homing - wrong direction will cause crashes!
 */
#define INVERT_X_DIR false    // [PRINTER-SPECIFIC]
#define INVERT_Y_DIR false    // [PRINTER-SPECIFIC]
#define INVERT_Z_DIR false    // [PRINTER-SPECIFIC]
#define INVERT_I_DIR false    // A-axis - adjust if direction is wrong
#define INVERT_J_DIR false    // B-axis - adjust if direction is wrong
#define INVERT_E0_DIR false   // [PRINTER-SPECIFIC]

//===========================================================================
//========================= Rep5x Motion Settings ===========================
//===========================================================================

/**
 * Default Axis Steps Per Unit (linear=steps/mm, rotational=steps/degree)
 *
 * Format: { X, Y, Z, E, A(I), B(J) }
 *
 * Rep5x rotation axes (typical values):
 *   A-axis: ~17.778 steps/degree (with 16:1 gear ratio, 200 step motor, 16 microsteps)
 *   B-axis: ~17.778 steps/degree (varies based on your gear ratio)
 *
 * [PRINTER-SPECIFIC] X, Y, Z, E values depend on your printer
 * A and B values will be calibrated using the printer setup tool
 */
#define DEFAULT_AXIS_STEPS_PER_UNIT   { 80, 80, 400, 415, 17.778, 17.778 }
//                                      X   Y    Z    E    A       B

/**
 * Default Max Feed Rates (linear=mm/s, rotational=degrees/s)
 *
 * Format: { X, Y, Z, E, A(I), B(J) }
 *
 * Rep5x rotation axes (recommended):
 *   A-axis: 60°/s (one full rotation in 6 seconds)
 *   B-axis: 45°/s (conservative for tilt axis)
 *
 * [PRINTER-SPECIFIC] X, Y, Z, E values depend on your printer
 */
#define DEFAULT_MAX_FEEDRATE          { 500, 500, 20, 45, 60, 45 }
//                                      X    Y    Z   E   A   B

/**
 * Default Max Acceleration (linear=mm/s², rotational=degrees/s²)
 *
 * Format: { X, Y, Z, E, A(I), B(J) }
 *
 * [PRINTER-SPECIFIC] X, Y, Z, E values depend on your printer
 */
#define DEFAULT_MAX_ACCELERATION      { 3000, 3000, 100, 10000, 1000, 1000 }
//                                      X     Y     Z    E      A     B

//===========================================================================
//========================== Rep5x Homing Settings ==========================
//===========================================================================

/**
 * Homing direction for each axis
 * -1 = towards MIN endstop, 1 = towards MAX endstop
 *
 * Rep5x typical setup:
 *   A-axis (I): homes to MIN
 *   B-axis (J): homes to MIN
 *
 * [PRINTER-SPECIFIC] X, Y, Z depend on your printer's endstop positions
 */
#define X_HOME_DIR -1     // [PRINTER-SPECIFIC]
#define Y_HOME_DIR -1     // [PRINTER-SPECIFIC]
#define Z_HOME_DIR  1     // [PRINTER-SPECIFIC] 1 for max endstop, -1 for min
#define I_HOME_DIR -1     // A-axis homes to min
#define J_HOME_DIR -1     // B-axis homes to min

//===========================================================================
//=========================== Rep5x Endstops ================================
//===========================================================================

/**
 * Endstop pin assignments for A-axis (I) and B-axis (J)
 *
 * Rep5x uses non-standard pins for the rotation axis endstops.
 * You MUST define these pins for your board. Common locations:
 *
 * BTT Octopus V1.1:
 *   - J30 connector: PG13
 *   - J31 connector: PG13 (E1DET)
 *   - J32 connector: PG14 (E2DET)
 *
 * [BOARD-SPECIFIC] Adjust pins for your control board and wiring
 */
#define I_MIN_PIN PG13   // A-axis endstop pin - adjust for your board/wiring
#define J_MIN_PIN PG14   // B-axis endstop pin - adjust for your board/wiring

/**
 * Endstop pullups - enable for most configurations
 */
#define ENDSTOPPULLUPS

/**
 * Endstop hit state - the pin state when the endstop is triggered
 * HIGH = triggered when pin reads HIGH (typical for mechanical switches with pullup)
 * LOW  = triggered when pin reads LOW (typical for optical sensors)
 *
 * [BOARD-SPECIFIC] Adjust based on your endstop type and wiring
 */
#define X_MIN_ENDSTOP_HIT_STATE HIGH
#define X_MAX_ENDSTOP_HIT_STATE HIGH
#define Y_MIN_ENDSTOP_HIT_STATE HIGH
#define Y_MAX_ENDSTOP_HIT_STATE HIGH
#define Z_MIN_ENDSTOP_HIT_STATE HIGH
#define Z_MAX_ENDSTOP_HIT_STATE HIGH
#define I_MIN_ENDSTOP_HIT_STATE HIGH   // A-axis endstop
#define I_MAX_ENDSTOP_HIT_STATE HIGH
#define J_MIN_ENDSTOP_HIT_STATE LOW    // B-axis endstop (often inverted for optical)
#define J_MAX_ENDSTOP_HIT_STATE HIGH

//===========================================================================
//========================= Standard Settings ===============================
//===========================================================================

/**
 * Number of extruders
 */
#define EXTRUDERS 1

/**
 * Filament diameter (1.75mm is standard)
 */
#define DEFAULT_NOMINAL_FILAMENT_DIA 1.75

/**
 * Temperature sensor types
 * [PRINTER-SPECIFIC] Adjust for your thermistors
 * Common values: 1 = 100k thermistor, 5 = 100K thermistor (ATC Semitec 104GT-2)
 */
#define TEMP_SENSOR_0 1       // Hotend thermistor
#define TEMP_SENSOR_BED 1     // Bed thermistor

/**
 * PID Settings
 * [PRINTER-SPECIFIC] Run M303 to auto-tune for your printer
 */
#define PIDTEMP
#define DEFAULT_Kp  22.20
#define DEFAULT_Ki   1.08
#define DEFAULT_Kd 114.00

//===========================================================================
//=========================== EEPROM Settings ===============================
//===========================================================================

/**
 * EEPROM for storing calibration values
 * Required for Rep5x to save M206 offsets and M92 steps/degree
 */
#define EEPROM_SETTINGS
#define EEPROM_AUTO_INIT

//===========================================================================
//========================= Additional Features =============================
//===========================================================================

/**
 * SD Card support (if your board has one)
 */
//#define SDSUPPORT

/**
 * LCD/Controller
 * [BOARD-SPECIFIC] Uncomment and configure for your display
 */
//#define REPRAP_DISCOUNT_FULL_GRAPHIC_SMART_CONTROLLER
//#define CR10_STOCKDISPLAY
//#define BTT_TFT35_V3_0

/**
 * Host communication
 */
#define BAUDRATE 115200

//===========================================================================
//====================== End of Rep5x Configuration =========================
//===========================================================================

/**
 * NEXT STEPS:
 *
 * 1. Merge these settings with your printer's base Configuration.h
 *    OR use a complete printer-specific configuration from:
 *    build-guide/printer-specific/[your-printer]/firmware/
 *
 * 2. Also configure Configuration_adv.h (see universal Configuration_adv.h)
 *
 * 3. Compile and upload firmware
 *
 * 4. Use the Printer Setup tool to calibrate A and B axes:
 *    https://tools.rep5x.com/printer-setup
 *
 * For help, join our Discord: https://discord.gg/GNdah82VBg
 */
