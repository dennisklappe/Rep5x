# Bill of Materials - Ender 5 Pro Rep5x Conversion

Complete parts list for converting an Ender 5 Pro to 5-axis printing capability.

## Complete bill of materials

| Item | Qty | Part Number | Type | Description | Notes |
|------|-----|-------------|------|-------------|-------|
| 1 | 1 | Nema17 pancake stepper motor | COTS | Compact stepper for A-axis rotation | ~20-25mm body length |
| 2 | 1 | GT2 20T 5mm bore | COTS | Drive pulley for A-axis | 20 teeth, 5mm bore |
| 3 | 1 | B-driven-pulley | Print | Custom pulley for B-axis drive | PLA/PETG recommended |
| 4 | 1 | Hot-end-assem | Assembly | Complete hotend assembly | E3D V6 compatible |
| 5 | 2 | 608 2RS bearing DIN625 | COTS | Ball bearings for rotation axes | Standard skateboard bearings |
| 6 | 1 | GT2 timing belt 6x158mm | COTS | Drive belt for A-axis | 6mm wide, 158mm length |
| 7 | 1 | B_arm | Print | Rotational arm for B-axis | PLA/PETG recommended |
| 8 | 1 | Nema17 stepper motor | COTS | Standard stepper for B-axis | Standard 42mm body |
| 9 | 1 | Carriage-mount | Print | Mounting bracket for carriage | ABS/PETG for heat resistance |
| 10 | 1 | Microswitch | COTS | Endstop switch for one axis | 3-pin micro limit switch |
| 28 | 1 | Hall effect sensor | COTS | Magnetic endstop sensor | 3-pin hall sensor (A3144 or similar) |
| 11 | 1 | B_switch_cover | Print | Protection cover for switch | PLA/PETG recommended |
| 12 | 1 | Fan-mount | Print | Mounting bracket for cooling fan | Heat resistant material |
| 13 | 1 | Hot-end-fan | COTS | Cooling fan for hotend | 30mm or 40mm axial fan |
| 14 | 8 | DIN912 M3x6mm | Fastener | Socket head cap bolt | Stainless steel preferred |
| 15 | 8 | DIN912 M3x10mm | Fastener | Socket head cap bolt | Stainless steel preferred |
| 16 | 3 | M3 heat-set insert | Fastener | Threaded insert for plastic | Brass, M3 thread |
| 17 | 1 | Hotend_spacer | Print | Spacer for hotend mounting | Heat resistant material |
| 18 | 2 | DIN912 M2.5x10mm | Fastener | Socket head cap bolt | For fine adjustments |
| 19 | 1 | MST-005-12A | COTS | Slip ring assembly | 12 channels, 2A each, 5mm bore |
| 20 | 1 | BTT Octopus V1.1 | COTS | Main control board | STM32F446ZE, 8 stepper drivers |
| 21 | 6 | TMC2208 stepper driver | COTS | UART stepper drivers | For all 6 axes (X,Y,Z,E,A,B) |

## Component notes

### Slip ring (Item 19)
- **Channels**: 12 electrical channels
- **Current rating**: 2A per channel
- **Through-bore**: 5mm diameter
- **Purpose**: Allows continuous rotation while maintaining electrical connections

### Control board (Item 20)
- **Processor**: STM32F446ZE ARM Cortex-M4 @ 180MHz
- **Stepper drivers**: 8 sockets (6 needed for 5-axis)
- **Communication**: USB, UART
- **Power**: 24V DC input

## Base printer requirements

### Ender 5 Pro specifications
- **Build volume**: 220 x 220 x 300mm
- **Hotend**: Stock or E3D V6 compatible
- **Extruder**: Bowden

### Required modifications
- Replace control board with new board (6+ stepper drivers)
- Add stepper drivers for A and B axes
- Modify X-carriage for rotational assembly mounting
- Route wiring through slip ring

## Control electronics

Separate control board upgrade required - see [firmware documentation](../../firmware/README.md).

### Tested board
- **[BTT Octopus V1.1 (STM32F446ZE)](../../firmware/marlin/configs/octopus-v1.1/)** - Click for firmware configuration

### Stepper drivers
- **All 6 axes**: 6x TMC2208 (UART)
  - X, Y, Z, Extruder, A-axis, B-axis
  - Unified driver type simplifies wiring and configuration

