G91 ;Relative positioning
G1 E-2 F2700 ;Retract a bit
G1 E-2 Z0.2 F2400 ;Retract and raise Z
G1 X5 Y5 F3000 ;Wipe out
G1 Z10 ;Raise Z more
G90 ;Absolute positioning

G0 Z66 ;Move Z to safe position
G0 X110 Y0 ;Move bed to front for easy part removal
G0 A0 B0 ;Return A and B to 0 degrees

M106 S0 ;Turn-off fan
M104 S0 ;Turn-off hotend
M140 S0 ;Turn-off bed

M84 X Y E ;Disable X, Y, E steppers (keep Z and A/B energized)
