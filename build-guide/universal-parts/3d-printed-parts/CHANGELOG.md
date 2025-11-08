# Rep5x - 3D printed parts changelog

Version history and changes for Rep5x 3D printed components. This log helps builders understand what changed between versions and decide whether to reprint parts.

---

## Version 1.1.0 (November 2025)

### A-driven-pulley v1.1.0
- **Updated**: Shaft diameter slightly reduced for better bearing fit
- **Reason**: Improved fit tolerance with 61804 bearings
- **Compatibility**: Direct replacement for v1.0.0

### b-driven-pulley v1.1.0
- **Removed**: Fan mount holes
- **Reason**: Hotend fan is now directly mounted to hotend assembly, eliminating need for additional mounting points
- **Compatibility**: Direct replacement for v1.0.0

### carriage-mount v1.1.0 (Ender 3 V3 SE)
- **New**: Carriage mount designed for Ender 3 V3 SE printer
- **Updated**: Uses optical sensor mount instead of hall effect sensor
- **Updated**: Includes integrated slipring mount design
- **Reason**: Different X-carriage design, optical sensor simplicity (easier positioning, more common in printer community, likely already owned by builders), and better slipring mounting
- **Compatibility**: Printer-specific design, not compatible with Ender 5 Pro

### y-endstop v1.1.0 (Ender 3 V3 SE)
- **New**: Y-axis endstop mount designed for Ender 3 V3 SE
- **Purpose**: Microswitch mount to replace original Y endstop (removed with hotend assembly)
- **Compatibility**: Ender 3 V3 SE specific

### z-endstop v1.1.0 (Ender 3 V3 SE)
- **New**: Z-axis endstop mount designed for Ender 3 V3 SE
- **Purpose**: Microswitch mount on X gantry to replace original Z endstop (removed with hotend assembly)
- **Compatibility**: Ender 3 V3 SE specific

### slip-ring-holder v1.1.0
- **Updated**: Redesigned slipring mounting component
- **Replaces**: fan-mount v1 v1.0.0 functionality
- **Reason**: Better slipring positioning and eliminates need for separate fan mount
- **Compatibility**: Works with both printer models, incorporates multiple v1.0.0 functions

### Changed parts (no longer used)
- **fanmount v1.0.0 & fan-mount v1.0.0**: No longer used in current build examples (hotend fan mounted directly to hotend)
- **Note**: These components remain available for builders with different hotend configurations or preferences

### Other components
- B_arm v1.1.0, B_switch_cover v1.1.0, hotend-spacer v1.1.0, spacer-3mm v1.1.0: No changes from v1.0.0

---

## Version 1.0.0 (October 2025)

Initial release of all Rep5x 3D printed components.

### Components included:
- A-driven-pulley v1.0.0
- b-driven-pulley v1.0.0
- B_arm v1.0.0
- B_switch_cover v1.0.0
- slip-ring-holder v1.0.0
- spacer-3mm v1.0.0
- fan-mount v1.0.0
- fanmount v1.0.0
- hotend-spacer v1.0.0
- carriage-mount v1.0.0 (Ender 5 Pro)

