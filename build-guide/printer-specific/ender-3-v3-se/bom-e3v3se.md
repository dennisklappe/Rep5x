# Rep5x - Ender 3 V3 SE BOM

This BOM covers components specific to the Ender 3 V3 SE conversion. See the [universal BOM](../../universal-parts/bom-universal.md) for common components required across all printer models.

## Printer-specific 3D printed components

All files available in [`3d-printed-parts/3mf/`](3d-printed-parts/3mf/) and [`3d-printed-parts/step/`](3d-printed-parts/step/).

| Component | File | Description |
|-----------|------|-------------|
| Carriage mount | carriage-mount_v1.1.0.3mf | Mounts to Ender 3 V3 SE X carriage |
| X endstop mount | x-endstop_v1.1.0.3mf | Mount for X-axis microswitch on right side of X gantry |
| Z endstop mount | z-endstop_v1.1.0.3mf | Mount for Z-axis microswitch on left side of X gantry |
| Extruder mount | extruder-mount_v1.1.0.3mf | Mounts external Bowden extruder between spool holder and printer frame |

## Printer-specific COTS components

| Item | Qty | Part Number | Description | Notes |
|------|-----|-------------|-------------|-------|
| 1 | 2 | Microswitch | Endstop switches for X and Z axes | Micro limit switch |
| 2 | 1 | BTT Mini 12864 Display (optional) | LCD display | V3 SE stock screen not compatible - other compatible screens or headless operation also work |
| 3 | 1 | External Bowden extruder | Remote extruder assembly | Stock is direct drive |
| 4 | 1 | Bowden-compatible hotend | Replacement hotend with PTFE coupling | Stock V3 SE hotend lacks Bowden retention |
| 5 | 1 | PTFE Bowden tube | ~500mm PTFE tube | 4mm OD, 2mm ID |

**Alternative to item 4**: Modify stock hotend to retain Bowden tube.

## Printer-specific fasteners

| Item | Qty | Description | Notes |
|------|-----|-------------|-------|
| M3x6mm screws | 2 | Socket head cap bolt | For mounting spool holder on top of extruder mount |

## Firmware

Pre-configured Marlin 2.1.x firmware available in [`firmware/octopus-v1.1/`](firmware/octopus-v1.1/) folder:
- Configuration.h
- Configuration_adv.h
- firmware_rep5x_ender3v3se_octopus_v1.1.bin

See [firmware README](firmware/octopus-v1.1/README.md) for installation instructions.

## Getting help

- **Assembly instructions**: Follow main [assembly instructions](../../assembly-instructions-universal.md)
- **V3 SE specifics**: See [assembly instructions](assembly-instructions-e3v3se.md) for printer-specific steps
- **Discord**: Join our [Discord community](https://discord.gg/GNdah82VBg) for support
