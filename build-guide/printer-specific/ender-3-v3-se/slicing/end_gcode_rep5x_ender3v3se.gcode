G91 ;Relative positioning
G1 E-2 F2700 ;Retract a bit
G1 E-2 Z0.2 F2400 ;Retract and raise Z
G1 X5 Y5 F3000 ;Wipe out
G90 ;Absolute positioning
G28 Z ;Home Z to max height
G4 P1000 ;Wait for Z axis to settle

G0 X110 Y200 ;Move bed to back for easy part removal
G0 A0 B0 ;Return A and B to 0 degrees

M106 S0 ;Turn-off fan
M104 S0 ;Turn-off hotend
M140 S0 ;Turn-off bed

M84 X Y E A B ;Disable all steppers except Z
