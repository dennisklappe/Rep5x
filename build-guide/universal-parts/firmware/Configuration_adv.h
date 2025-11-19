/**
 * Rep5x Universal Configuration_adv.h
 *
 * Advanced Marlin configuration for Rep5x 5-axis printer conversions.
 *
 * IMPORTANT: This file contains the essential Rep5x-specific advanced settings.
 * You must merge these settings with your printer's existing Configuration_adv.h
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
//======================== Rep5x Homing Settings ============================
//===========================================================================

/**
 * Homing bump settings
 * After hitting the endstop, back off and re-approach for accuracy
 *
 * Format: { X, Y, Z, I(A), J(B) }
 * linear = mm, rotational = degrees
 */
#define HOMING_BUMP_MM      { 5, 5, 3, 5, 2 }      // Backoff distance after first bump
#define HOMING_BUMP_DIVISOR { 2, 2, 4, 2, 4 }      // Re-bump speed divisor

/**
 * Homing feedrates (speeds)
 * Format: { X, Y, Z, I(A), J(B) }
 * Units: mm/min for linear, degrees/min for rotational
 *
 * These values work well for Rep5x:
 *   A-axis: 90°/min = 1.5°/s (conservative for rotation)
 *   B-axis: 45°/min = 0.75°/s (slow for tilt to prevent issues)
 *
 * [PRINTER-SPECIFIC] X, Y, Z values depend on your printer
 */
#define HOMING_FEEDRATE_MM_M { (50*60), (50*60), (15*60), (90*60), (45*60) }
//                             X        Y        Z        A        B

//===========================================================================
//======================== Rep5x Home Offset ================================
//===========================================================================

/**
 * Home offset - allows adjusting the home position
 * This is used by the Printer Setup tool to calibrate A and B zero positions
 *
 * Initial values are 0, but will be set via M206 during calibration
 * Values are saved to EEPROM with M500
 */
#define HOME_OFFSET_MENU    // Enable M206 home offset command

//===========================================================================
//====================== Rep5x Movement Settings ============================
//===========================================================================

/**
 * Junction deviation for motion planning
 * Affects cornering smoothness - lower values = slower but smoother corners
 */
#define CLASSIC_JERK
#if ENABLED(CLASSIC_JERK)
  #define DEFAULT_XJERK 10.0
  #define DEFAULT_YJERK 10.0
  #define DEFAULT_ZJERK  0.3
  #define DEFAULT_IJERK  5.0   // A-axis jerk (degrees/s)
  #define DEFAULT_JJERK  2.0   // B-axis jerk (degrees/s) - lower for tilt stability
  #define DEFAULT_EJERK  5.0
#endif

/**
 * Arc support for G2/G3 commands
 * Important for 5-axis toolpaths
 */
#define ARC_SUPPORT
#if ENABLED(ARC_SUPPORT)
  #define MIN_ARC_SEGMENT_MM      0.1
  #define MAX_ARC_SEGMENT_MM      1.0
  #define MIN_CIRCLE_SEGMENTS    72
  #define N_ARC_CORRECTION       25
  #define ARC_P_CIRCLES              // Enable P parameter for complete circles
#endif

//===========================================================================
//======================= Stepper Driver Settings ===========================
//===========================================================================

/**
 * Minimum stepper pulse timing
 * [BOARD-SPECIFIC] Adjust based on your stepper drivers
 *
 * Recommended values:
 *   TMC2208/TMC2209: 20
 *   TMC2130/TMC5160: 20
 *   A4988/DRV8825:   1
 */
#define MINIMUM_STEPPER_PULSE 20

/**
 * Maximum stepping rate
 * [BOARD-SPECIFIC] Depends on your MCU and drivers
 *
 * Typical values:
 *   STM32F4 with TMC: 400000
 *   LPC1768 with TMC: 200000
 */
//#define MAXIMUM_STEPPER_RATE 400000

//===========================================================================
//========================= TMC Driver Settings =============================
//===========================================================================

/**
 * TMC stepper driver configuration
 * Only needed if using TMC drivers (TMC2208, TMC2209, TMC2130, etc.)
 *
 * [BOARD-SPECIFIC] Adjust current values based on your motors
 */
#if HAS_TRINAMIC_CONFIG

  /**
   * Motor current settings (mA RMS)
   * [BOARD-SPECIFIC] Adjust based on your stepper motors
   *
   * Typical values for NEMA17:
   *   X/Y: 800-1200mA
   *   Z:   800-1000mA
   *   E:   600-900mA
   *   A/B: 600-1000mA (depends on your rotation motors)
   */
  #define X_CURRENT       800
  #define Y_CURRENT       800
  #define Z_CURRENT       800
  #define E0_CURRENT      650
  #define I_CURRENT       800   // A-axis motor current
  #define J_CURRENT       800   // B-axis motor current

  /**
   * Hybrid threshold for automatic switching between stealthChop and spreadCycle
   * Set to 0 to disable hybrid threshold
   */
  #define X_HYBRID_THRESHOLD     100
  #define Y_HYBRID_THRESHOLD     100
  #define Z_HYBRID_THRESHOLD       3
  #define E0_HYBRID_THRESHOLD     30
  #define I_HYBRID_THRESHOLD      30   // A-axis
  #define J_HYBRID_THRESHOLD      30   // B-axis

  /**
   * TMC debugging
   * Uncomment to enable M122 diagnostic command
   */
  //#define TMC_DEBUG

#endif // HAS_TRINAMIC_CONFIG

//===========================================================================
//========================== Safety Settings ================================
//===========================================================================

/**
 * Software endstops - prevent movement beyond axis limits
 * Important for Rep5x to prevent rotation axis damage
 */
#define MIN_SOFTWARE_ENDSTOPS
#define MAX_SOFTWARE_ENDSTOPS

/**
 * Abort on endstop hit during homing
 */
//#define ABORT_ON_ENDSTOP_HIT_FEATURE_ENABLED

//===========================================================================
//========================= SD Card Settings ================================
//===========================================================================

/**
 * SD Card support settings
 * [BOARD-SPECIFIC] Enable if your board has SD card
 */
#if ENABLED(SDSUPPORT)
  //#define SD_CHECK_AND_RETRY            // Read verification and retry
  //#define SDCARD_SORT_ALPHA             // Sort files alphabetically
#endif

//===========================================================================
//========================= LCD/Controller ==================================
//===========================================================================

/**
 * LCD settings
 * [BOARD-SPECIFIC] Configure for your display
 */
//#define LCD_INFO_SCREEN_STYLE 0
//#define SHOW_CUSTOM_BOOTSCREEN
//#define CUSTOM_STATUS_SCREEN_IMAGE

//===========================================================================
//====================== End of Rep5x Configuration =========================
//===========================================================================

/**
 * NEXT STEPS:
 *
 * 1. Merge these settings with your printer's base Configuration_adv.h
 *    OR use a complete printer-specific configuration from:
 *    build-guide/printer-specific/[your-printer]/firmware/
 *
 * 2. Also configure Configuration.h (see universal Configuration.h)
 *
 * 3. Compile and upload firmware
 *
 * 4. Use the Printer Setup tool to calibrate A and B axes:
 *    https://tools.rep5x.com/printer-setup
 *
 * For help, join our Discord: https://discord.gg/GNdah82VBg
 */
