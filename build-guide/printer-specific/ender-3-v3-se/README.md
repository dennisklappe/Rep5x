# Rep5x - Ender 3 V3 SE adaptation

Follow the main [assembly guide](../../assembly-instructions-universal.md) with these Ender 3 V3 SE specific differences.

## What's different

The Ender 3 V3 SE adaptation requires several modifications from the universal build due to its hardware configuration. You'll need to endstops for both the X and Z since the original print head-mounted X endstop and CR Touch Z probe won't work with the Rep5x system. The stock hotend, designed for direct drive extrusion, lacks a Bowden tube coupling and must be either replaced with a Bowden-compatible hotend or modified to retain the PTFE tube. Additionally, the V3 SE's proprietary screen isn't compatible with Marlin firmware, so you'll need to use a BTT screen, older Ender screen, or run the printer headless, and the combined hotend cable must be replaced with individual wires for each component.

## Getting help
- **Assembly guide**: Follow main [assembly guide](../../assembly-instructions-universal.md)
- **Discord**: Join our [Discord community](https://discord.gg/GNdah82VBg) for support