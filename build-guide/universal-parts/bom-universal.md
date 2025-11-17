# Rep5x - Universal BOM

Universal components required for any Rep5x 5-axis printer conversion. These parts are compatible across all supported printer models.

## Universal 3D printed components

All files available in [`../3d-printed-parts/current/3mf/`](../3d-printed-parts/current/3mf/).

**Recommended material**: PETG for all components.

| Component | File | Description |
|-----------|------|-------------|
| A-driven-pulley | A-driven-pulley_v1.1.0.3mf | Drive pulley for A-axis |
| B-driven-pulley | b-driven-pulley_v1.1.0.3mf | Custom pulley for B-axis drive |
| B_arm | B_arm_v1.0.0.3mf | Rotational arm for B-axis |
| Slip ring holder | slip-ring-holder_v1.1.0.3mf | Mount for slip ring assembly |
| Spacer 3mm | spacer-3mm_v1.0.0.3mf | 3mm spacer component |
| Hotend spacer | hotend-spacer_v1.0.0.3mf | Spacer for hotend mounting |

## Universal COTS components

| Qty | Part Number | Description | Notes | Purchase links |
|-----|-------------|-------------|-------|----------------|
| 2 | Nema17 stepper motor | Stepper motors for A and B axis | Standard 42mm body | [AliExpress](https://s.click.aliexpress.com/e/_c4c2iJMv)<br>[Amazon](https://amzn.to/4i9SpMc) |
| 2 | GT2 20T 5mm bore | Drive pulleys for A and B axis | 20 teeth, 5mm bore | [AliExpress](https://s.click.aliexpress.com/e/_c4c25zbJ)<br>[Amazon](https://amzn.to/3XxPq6t) |
| 1 | GT2 timing belt 6x188mm | Drive belt for A-axis | 6mm wide, 188mm length | [AliExpress](https://s.click.aliexpress.com/e/_c3iFUMNX)<br>[Amazon](https://amzn.to/3LBjJXs) |
| 1 | GT2 timing belt 6x158mm | Drive belt for B-axis | 6mm wide, 158mm length | [AliExpress](https://s.click.aliexpress.com/e/_c4EfUQFx)<br>[Amazon](https://amzn.to/3K1CsuB) |
| 2 | 608 2RS bearing DIN625 | Ball bearings for B-axis rotation | Standard skateboard bearings | [AliExpress](https://s.click.aliexpress.com/e/_c4TmSNYv)<br>[Amazon](https://amzn.to/4p7kIwW) |
| 2 | 61804 bearing | Thin section bearing for carriage mount | For A-axis rotation | [AliExpress](https://s.click.aliexpress.com/e/_c3f9UJ2d)<br>[Amazon](https://amzn.to/47YWRs9) |
| 1 | Microswitch | Endstop switch for B-axis | 2-pin micro limit switch | [AliExpress](https://s.click.aliexpress.com/e/_c3jaHbCv)<br>[Amazon](https://amzn.to/47Vp3w5) |
| 1 | Optical sensor | A-axis homing sensor | 3-pin optical endstop sensor | [AliExpress](https://s.click.aliexpress.com/e/_c2xizb7R)<br>[Amazon](https://amzn.to/3LGSqed) |
| 1 | Control board | 6+ stepper driver board | See tested control boards section| [AliExpress](https://s.click.aliexpress.com/e/_c4ahdz8D)<br>[Amazon](https://amzn.to/44cmTHi) |
| 6 | TMC2208 | Stepper drivers | UART mode, for all 6 axes | [AliExpress](https://s.click.aliexpress.com/e/_c3kOJ4tX)<br>[Amazon](https://amzn.to/444ykkm) |
| 1 | MST-005-12A slipring | Slipring assembly | 12 channels, 2A each, 5mm bore | [AliExpress](https://s.click.aliexpress.com/e/_c4bPjNQN)<br>[Amazon](https://amzn.to/3JRFemi) |
| 1 | Wire/cables | Connection wires | For slip ring and stepper connections | - |
| 1 | JST connectors (optional) | Removable connectors | For easy maintenance | [AliExpress](https://s.click.aliexpress.com/e/_c4TqCjzL)<br>[Amazon](https://amzn.to/4i4tx8f) |
| 1 | Cable organizers (optional) | Zip ties, cable clips, or spiral wrap | For clean wire routing | - |

## Universal fasteners

| Qty | Description | Purchase links |
|-----|-------------|----------------|
| 8 | DIN912 M3x6mm socket head cap bolt | [AliExpress](https://s.click.aliexpress.com/e/_c3Ylz0Rb)<br>[Amazon](https://amzn.to/4i7uBZa) |
| 8 | DIN912 M3x10mm socket head cap bolt | [AliExpress](https://s.click.aliexpress.com/e/_c3Y7jvop)<br>[Amazon](https://amzn.to/49SUXvN) |
| 2 | M3 heat-set insert for plastic | [AliExpress](https://s.click.aliexpress.com/e/_c3xF4D6N)<br>[Amazon](https://amzn.to/4pkGLjX) |

## Electronics requirements

### Control board requirements
- **Minimum stepper drivers**: 6 (X, Y, Z, E, A, B)
- **Processor**: 32-bit ARM recommended
- **Communication**: USB, UART support
- **Power**: 24V DC input capability

### Tested control boards
- **BTT Octopus V1.1** (STM32F446ZE) - 8 stepper drivers, proven working

### Stepper drivers
- **Required**: 6x TMC2208 (UART) or equivalent
- **Configuration**: X, Y, Z, Extruder, A-axis, B-axis
- **Benefits**: Unified driver type simplifies wiring and configuration

## Component specifications

### Slipring (MST-005-12A)
- **Channels**: 12 electrical channels
- **Current rating**: 2A per channel
- **Through-bore**: 5mm diameter
- **Purpose**: Allows continuous rotation

## Printer-specific components

The following components require printer-specific adaptation:

1. **Carriage mount** - Varies by printer X-carriage design
2. **Endstop positions** - May require relocation or addition

See printer-specific folders for adaptation requirements.

## Getting help

- **Assembly instructions**: See [assembly instructions](../../assembly-instructions-universal.md) for complete build instructions
- **Community support**: Join our [Discord community](https://discord.gg/GNdah82VBg) for help and discussions