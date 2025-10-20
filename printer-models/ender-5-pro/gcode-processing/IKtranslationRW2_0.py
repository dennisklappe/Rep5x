# -*- coding: utf-8 -*-
"""
Created on Mon Apr  3 11:38:29 2023

@author: ander
@editor: dennisklappe
"""

import math
import os


def recalculate(line, func_x, func_y, func_z):
    """
    Transform X, Y, Z coordinates in a G-code line using inverse kinematics.
    Extracts A/B axis values and applies kinematic corrections to X/Y/Z positions.
    Returns the modified line, or unchanged if not a movement command.
    """
    if not line.startswith("G") and not line.startswith("M"):
        return line  # Not a valid G-code command, so return it unchanged

    parts = line.split()
    x_val = y_val = z_val = a_val = b_val = 0  # Initialize all values to 0
    
    x_indices = []
    y_indices = []
    z_indices = []

    for i in range(1, len(parts)):
        if parts[i].startswith("X"):
            x_val = float(parts[i][1:])
            x_indices.append(i)
        elif parts[i].startswith("Y"):
            y_val = float(parts[i][1:])
            y_indices.append(i)
        elif parts[i].startswith("Z"):
            z_val = float(parts[i][1:])
            z_indices.append(i)
        elif parts[i].startswith("A"):
            a_val = float(parts[i][1:])
        elif parts[i].startswith("B"):
            b_val = float(parts[i][1:])

    for i in x_indices:
        parts[i] = "X" + str(func_x(x_val, y_val, z_val, a_val, b_val))

    for i in y_indices:
        parts[i] = "Y" + str(func_y(x_val, y_val, z_val, a_val, b_val))
    
    for i in z_indices:
        parts[i] = "Z" + str(func_z(x_val, y_val, z_val, a_val, b_val))

    return " ".join(parts)


def main(input_file, output_file, func_x, func_y, func_z):
    """
    Apply inverse kinematics transformation to a G-code file.
    Reads input G-code, transforms X/Y/Z coordinates based on A/B axis positions,
    and writes the transformed G-code to the output file.
    """
    with open(input_file) as f:
        lines = f.readlines()

    with open(output_file, "w") as f:
        for line in lines:
            new_line = recalculate(line, func_x, func_y, func_z)
            f.write(new_line + "\n")


if __name__ == "__main__":
    # Kinematic parameters for RW2 print head
    La = 0      # A-axis offset (mm)
    Lb = 47.7   # B-axis offset (mm)
    
    def func_x(x_val, y_val, z_val, a_val, b_val):
        return x_val + math.sin(math.radians(a_val)) * La + math.cos(math.radians(a_val)) * math.sin(math.radians(b_val)) * Lb

    def func_y(x_val, y_val, z_val, a_val, b_val):
        return y_val - La + math.cos(math.radians(a_val)) * La - math.sin(math.radians(a_val)) * math.sin(math.radians(b_val)) * Lb

    def func_z(x_val, y_val, z_val, a_val, b_val):
        return z_val + math.cos(math.radians(b_val)) * Lb - Lb

    import sys
    
    if len(sys.argv) >= 3:
        input_file = sys.argv[1]
        output_file = sys.argv[2]
        
        # Check if input file exists
        if not os.path.exists(input_file):
            print(f"Error: Input file '{input_file}' not found")
            sys.exit(1)
            
    else:
        print("Usage: python IKtranslationRW2_0.py <input_file> <output_file>")
        print("Example: python IKtranslationRW2_0.py input.gcode output_IK.gcode")
        sys.exit(1)
    
    print(f"Processing: {input_file} -> {output_file}")
    main(input_file, output_file, func_x, func_y, func_z)
    print("Done!")
