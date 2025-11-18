M220 S100 ;Reset Feedrate
M221 S100 ;Reset Flowrate

M104 S[nozzle_temperature_initial_layer] ;Set final nozzle temp
M190 S[bed_temperature_initial_layer_single] ;Set and wait for bed temp to stabilize

G28 X ;Home X to prevent cable blocking Z homing
G28 ;Home all axes
G91 ;Relative positioning
G0 Z-20 F3000 ;Move Z down 20mm from top for bowden tube alignment
G90 ;Absolute positioning
G0 A0 B0 F3000

; Post-homing positioning
G0 X110 Y110 F2400 ;Move to center

G92 E0 ;Reset Extruder
G1 Z2.0 F3000 ;Move Z Axis up
G1 X-2 Y20 Z0.28 F5000.0 ;Move to start position
M109 S[nozzle_temperature_initial_layer] ;Wait for nozzle temp to stabilize
G1 X-2 Y145.0 Z0.28 F1500.0 E15 ;Draw the first line
G1 X-1.7 Y145.0 Z0.28 F5000.0 ;Move to side a little
G1 X-1.7 Y20 Z0.28 F1500.0 E30 ;Draw the second line
G92 E0 ;Reset Extruder
G1 E-1.0000 F1800 ;Retract a bit
G1 Z2.0 F3000 ;Move Z Axis up
G1 E0.0000 F1800
