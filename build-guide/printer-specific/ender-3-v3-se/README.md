# Rep5x - Ender 3 V3 SE adaptation

Follow the main [assembly guide](../../assembly-guide.md) with these Ender 3 V3 SE specific differences.

## Status: In Development

### What works
- **Hardware design** - Carriage mount and endstop modifications designed
- **Electronics** - BTT Octopus V1.1 configuration working
- **Build process** - Assembly guide tested on this printer

### What's different

#### Endstop modifications required
- **Y endstop**: Configure sensorless homing (original was in hotend)
- **Z endstop**: Install new microswitch on X gantry (original was in hotend) 
- **Detailed instructions**: Available next week in this folder

#### Electronics differences
- **Original screen**: Not compatible with Marlin (use BTT screen, Ender 3 V2 screen, or run headless)

#### Cable management
- **Combined hotend cable**: Cannot use original cable (too few wires)
- **Separate cables needed**: Individual wires for hotend components and slip ring

#### Other modifications
- **Bed leveling**: Add manual leveling knobs (modification tutorial available soon)
- **Direct drive**: Current retrofit designed for Bowden (extruder modification needed)

### Components
- **Carriage mount**: Uses optical sensor (v1.1.0 design)
- **Additional fasteners**: May require specific bolts for modifications

### Timeline
- **Complete documentation**: Next week
- **Tested configuration**: Currently in use for assembly guide development

## Getting help
- **Assembly guide**: Follow main [assembly guide](../../assembly-guide.md)
- **Discord**: Join our [Discord community](https://discord.gg/GNdah82VBg) for support