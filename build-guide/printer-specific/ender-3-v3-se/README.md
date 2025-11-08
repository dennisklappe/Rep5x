# Rep5x - Ender 3 V3 SE adaptation

Follow the main [assembly guide](../../assembly-guide.md) with these Ender 3 V3 SE specific differences.

## Status: Complete

### What's different

#### Endstop modifications required
- **Y endstop**: 3D printed mount ([y-endstop_v1.1.0.3mf](3d-printed-parts/3mf/y-endstop_v1.1.0.3mf)) with microswitch (original was in hotend)
- **Z endstop**: 3D printed mount ([z-endstop_v1.1.0.3mf](3d-printed-parts/3mf/z-endstop_v1.1.0.3mf)) with microswitch on X gantry (original was in hotend)
- **X endstop**: Uses original microswitch

#### Hotend modifications required
- **Bowden tube retention**: Original V3 SE hotend has no Bowden coupling
- **Solution options**:
  - Replace hotend with Bowden-compatible model (recommended)
  - Modify existing hotend to retain PTFE tube (compression fitting or pin-through-tube method)
- **Issue**: Stock hotend designed for direct drive, not Bowden setup

#### Electronics differences
- **Original screen**: Not compatible with Marlin (use BTT screen, older Ender screen, or run headless)

#### Cable management
- **Combined hotend cable**: Cannot use original cable (too few wires)
- **Separate cables needed**: Individual wires for hotend components and slip ring

### Components
- **Carriage mount**: Uses optical sensor (v1.1.0 design)
- **Endstop mounts**: 3D printed microswitch mounts for Y and Z axes
- **Extruder**: External Bowden extruder setup

## Getting help
- **Assembly guide**: Follow main [assembly guide](../../assembly-guide.md)
- **Discord**: Join our [Discord community](https://discord.gg/GNdah82VBg) for support