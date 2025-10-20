# G-code processing tools

Tools for processing and optimizing G-code for the Ender 5 Pro 5-axis retrofit.

## Files

### `IKtranslationRW2_0.py`
Inverse kinematics transformation script for the RW2 print head.

**Purpose**: Applies kinematic transformations to G-code coordinates based on A and B axis positions.

**Usage**:
```bash
python IKtranslationRW2_0.py input.gcode output.gcode
```

**Function**: Transforms X, Y, Z coordinates considering the 5-axis geometry with La=0mm and Lb=47.7mm offset parameters.

### `aAxisTakeShortRoute.py`
A-axis rotation optimization for continuous rotation.

**Purpose**: Optimizes A-axis movements by taking the shortest rotational path, enabling continuous rotation without long movements.

**Usage**:
```bash
python aAxisTakeShortRoute.py input.gcode
```

**Function**: Detects rotations >180° and inserts G92 commands to reset position, creating `*_shortroute.gcode` output.

### `start.gcode`
5-axis specific start G-code for Ender 5 Pro.

**Purpose**: Properly initializes the printer for 5-axis operation.

**Features**:
- Sets motion parameters for all 5 axes
- Homes and initializes rotational axes (A0 B0)
- Disables software endstops for 5-axis movement
- Proper heating and priming sequence

## Workflow

1. Generate 5-axis G-code from slicer
2. Apply inverse kinematics: `python IKtranslationRW2_0.py input.gcode transformed.gcode`
3. Optimize A-axis: `python aAxisTakeShortRoute.py transformed.gcode`
4. Use `start.gcode` as start script in slicer or prepend to final G-code

## Notes

These scripts are specific to this mod of the Ender 5 Pro RW2 configuration. Different printer models may require different parameters or approaches.