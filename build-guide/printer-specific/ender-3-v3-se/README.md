# Rep5x - Ender 3 V3 SE adaptation

Follow the main [assembly guide](../../assembly-guide.md) with these Ender 3 V3 SE specific differences.

### What's different

#### Endstop modifications required
- **X endstop**: 3D printed mount ([x-endstop_v1.1.0.3mf](3d-printed-parts/3mf/x-endstop_v1.1.0.3mf)) with microswitch (original was in print head)
- **Z endstop**: 3D printed mount ([z-endstop_v1.1.0.3mf](3d-printed-parts/3mf/z-endstop_v1.1.0.3mf)) with microswitch on X gantry (original was a CR touch)

#### Hotend modifications required
- **Bowden tube retention**: Original V3 SE hotend has no Bowden coupling
- **Issue**: Stock hotend designed for direct drive, not Bowden setup
- **Solution**:
  - Replace hotend with Bowden-compatible model (recommended)
  - Modify existing hotend to retain PTFE tube

#### Electronics differences
- **Original screen**: Not compatible with Marlin (use BTT screen, older Ender screen, or run headless)

#### Cables
- **Combined hotend cable**: Cannot use original cable
- **Separate cables needed**: Individual wires for hotend components

## Getting help
- **Assembly guide**: Follow main [assembly guide](../../assembly-guide.md)
- **Discord**: Join our [Discord community](https://discord.gg/GNdah82VBg) for support