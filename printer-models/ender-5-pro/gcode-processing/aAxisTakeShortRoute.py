# -*- coding: utf-8 -*-
"""
A-axis short route optimization for continuous rotation 5-axis printing.
Optimizes A-axis movements by taking the shortest rotational path.

@author: J.L. Meijerman
@editor: dennisklappe
"""

import sys
import os


def extract_a_value(line):
    """
    Extract A-axis value from a G-code line.
    Returns the A value as float, or None if not found.
    """
    if 'A' in line:
        try: 
            a_part = line.split('A')[1]
            for sep in [' ', 'B', 'E', 'X', 'Y', 'Z', 'F']:
                a_part = a_part.split(sep)[0]
            return float(a_part) 
        except (IndexError, ValueError): 
            return None
    return None


def optimize_a_axis(input_file, output_file):
    """
    Optimize A-axis rotations by inserting G92 commands for shorter paths.
    Processes G-code to avoid long rotational movements (>180°).
    """
    with open(input_file, 'r') as infile:
        lines = infile.readlines()

    with open(output_file, 'w') as outfile:
        i = 0
        while i < len(lines) - 1:
            line1 = lines[i]
            line2 = lines[i + 1]
            outfile.write(line1)
            
            if line1.strip().startswith(('G1', 'G0')) and line2.strip().startswith(('G1', 'G0')):
                a1 = extract_a_value(line1)
                a2 = extract_a_value(line2)
                
                if a1 is not None and a2 is not None: 
                    if (a1 - a2) > 180:
                        outfile.write(f'G92 A{(a1-360):.3f} ;Short route optimization\n')
                    elif (a1 - a2) < -180:
                        outfile.write(f'G92 A{(a1+360):.3f} ;Short route optimization\n')
            i += 1
            
        # Write the last line
        if len(lines) > 0:
            outfile.write(lines[-1])


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python aAxisTakeShortRoute.py <input_file>")
        print("Example: python aAxisTakeShortRoute.py input.gcode")
        print("Output: input_shortroute.gcode")
        sys.exit(1)

    input_file_name = sys.argv[1]
    
    # Check if input file exists
    if not os.path.exists(input_file_name):
        print(f"Error: Input file '{input_file_name}' not found")
        sys.exit(1)
        
    output_file_name = input_file_name.replace('.gcode', '_shortroute.gcode')
    
    print(f"Optimizing A-axis: {input_file_name} -> {output_file_name}")
    optimize_a_axis(input_file_name, output_file_name)
    print("Done!")