# Rep5x - Ender 3 V3 SE BOM

This BOM covers components specific to the Ender 3 V3 SE conversion. See the [universal BOM](../../universal-parts/bom-universal.md) for common components required across all printer models.

## Printer-specific 3D printed components

All files available in [`3d-printed-parts/3mf/`](3d-printed-parts/3mf/) and [`3d-printed-parts/step/`](3d-printed-parts/step/).

| Component | File | Description |
|-----------|------|-------------|
| Carriage mount | carriage-mount_v1.1.0.3mf | Mounts to Ender 3 V3 SE X carriage |
| Y endstop mount | y-endstop_v1.1.0.3mf | 3D printed mount for Y-axis microswitch |
| Z endstop mount | z-endstop_v1.1.0.3mf | 3D printed mount for Z-axis microswitch on X gantry |

## Printer-specific COTS components

| Qty | Part Number | Description | Notes | Purchase links |
|-----|-------------|-------------|-------|----------------|
| 2 | Microswitch | Endstop switches for Y and Z axes | 2-pin micro limit switch | [AliExpress](https://s.click.aliexpress.com/e/_c4MonxZx)<br>[Amazon](https://amzn.to/47VtY08) |
| 1 | BTT Mini 12864 Display (optional) | LCD display | V3 SE stock screen not compatible - other compatible screens or headless operation also work | [AliExpress](https://s.click.aliexpress.com/e/_c36wGfe9)<br>[Amazon](https://amzn.to/3JDvGeD) |
| 1 | External Bowden extruder | Remote extruder assembly | Stock is direct drive | [AliExpress](https://s.click.aliexpress.com/e/_c38c2EU9)<br>[Amazon](https://amzn.to/49ikoqu) |
| 1 | Bowden-compatible hotend | Replacement hotend with PTFE coupling | Stock V3 SE hotend lacks Bowden retention | [AliExpress](https://s.click.aliexpress.com/e/_c2yOJW0z)<br>[Amazon](https://amzn.to/4o3crsJ) |
| 1 | PTFE Bowden tube | ~500mm PTFE tube | 4mm OD, 2mm ID | [AliExpress](https://s.click.aliexpress.com/e/_c3sghXBJ)<br>[Amazon](https://amzn.to/3X3DRns) |

**Alternative to hotend**: Modify stock hotend to retain Bowden tube.

## Firmware

Pre-configured Marlin 2.1.x firmware available in [`firmware/octopus-v1.1/`](firmware/octopus-v1.1/) folder:
- Configuration.h
- Configuration_adv.h
- firmware_rep5x_ender3v3se_octopus_v1.1.bin

See [firmware README](firmware/octopus-v1.1/README.md) for installation instructions.

## Getting help

- **Assembly guide**: Follow main [assembly guide](../../assembly-instructions-universal.md)
- **V3 SE specifics**: See [README.md](README.md) for detailed differences
- **Discord**: Join our [Discord community](https://discord.gg/GNdah82VBg) for support
