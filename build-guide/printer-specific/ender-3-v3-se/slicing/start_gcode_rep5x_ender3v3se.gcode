; =====================================================================
; Rep5x start G-code for Ender 3 V3 SE
; =====================================================================
;
; OPTION 1: Pre-processed IK (recommended)
; M668 processes all moves through inverse kinematics before printing,
; eliminating real-time IK jitter. It also begins preheating (B=bed,
; H=hotend) so heatup overlaps with processing time. Requires firmware
; with IK_PREPROCESS enabled.
;
; OPTION 2: Live IK (commented out below)
; Uses G43.4 to enable real-time inverse kinematics during printing.
; Simpler but may cause jittery motion on complex prints due to CPU load.
; To use: comment out the M668 line and uncomment the G43.4/M667 lines.
;
; =====================================================================

; --- Option 1: Pre-processed IK (active) ---
G49 ;Disable IK
M667 S0 ;Disable calibration
M668 B[bed_temperature_initial_layer_single] H[nozzle_temperature_initial_layer] ;Pre-process IK + start heating

; --- Option 2: Live IK (uncomment to use instead of M668) ---
; M104 S[nozzle_temperature_initial_layer] ;Set final nozzle temp
; M190 S[bed_temperature_initial_layer_single] ;Set and wait for bed temp

M220 S100 ;Reset Feedrate
M221 S100 ;Reset Flowrate

G28 X ;Home X to prevent cable blocking Z homing
G28 ;Home all axes
G91 ;Relative positioning
G0 Z-20 F3000 ;Move Z down 20mm from top for bowden tube alignment
G90 ;Absolute positioning
G0 C0 B0 F3000 ;Move rotational axes to 0

; Purge line
G92 E0 ;Reset Extruder
G1 Z2.0 F3000 ;Move Z Axis up
G1 X-2 Y20 Z0.28 F600 ;Move to start position slowly
M109 S[nozzle_temperature_initial_layer] ;Wait for nozzle temp to stabilise
G1 X-2 Y145.0 Z0.28 F1500.0 E15 ;Draw the first line
G1 X-1.7 Y145.0 Z0.28 F5000.0 ;Move to side a little
G1 X-1.7 Y20 Z0.28 F1500.0 E30 ;Draw the second line
G92 E0 ;Reset Extruder
G1 E-1.0000 F1800 ;Retract a bit
G1 Z2.0 F3000 ;Move Z Axis up
G1 E0.0000 F1800

; Post-homing positioning
G0 X[bed_center_x] Y[bed_center_y] F2400 ;Move to centre
G92 X0 Y0 C0 B0 ;Set bed centre as origin and reset rotation axes
M211 S0 ;Disable software endstops

; --- Option 2: Live IK (uncomment to use instead of M668) ---
; G43.4 ;Enable IK
; M667 S1 ;Enable calibration
