M201 X500 Y500 Z100 E1000 A500 B500 ; max acceleration, mm/s² or deg/s²
M203 X500 Y500 Z20 E60 A7200 B7200 ; max feedrates, mm/s or deg/min
M204 P500 R1000 T500 ; printing, retract, travel acceleration
M205 X8.00 Y8.00 Z0.40 E5.00 A10.00 B10.00 ; jerk settings
M205 S0 T0 ; min feedrates
M107 ; fan off
 
;TYPE:Custom
G90 ; absolute positioning
M83 ; relative extrusion
G28 ; home all
G92 A0 B-4 ; reset rotational axes
G1 A0 B0 F3000 ; ensure they're initialized
 
M104 S150 ; prevent oozing
M140 S60 ; bed temp
G4 S30 ; warmup pause
G1 Z50 F240 ; move Z up
G1 X2.0 Y10 F3000 ; park
M104 S220 ; nozzle temp
M190 S60 ; wait for bed
M109 S220 ; wait for nozzle
G1 Z0.3 F240 ; move to first layer height
G92 E0
G1 X2.0 Y140 E10 F1500 ; prime line
G1 X2.3 Y140 F5000
G92 E0
G1 X2.3 Y10 E10 F1200 ; second prime
G92 E0
G21 ; mm units
G90 ; absolute positioning
M83 ; relative extrusion
G92 E0
 
G1 X100 Y100
G92 X0 Y0 Z0
M211 S0 ; disable software endstops