# Rep5x - Printer setup

Calibrate Z height and A/B axis zero positions before kinematic calibration.

**Live tool:** https://tools.rep5x.com/printer-setup/

## Why is this needed?

Before measuring LA/LB parameters, your printer needs basic calibration:

- **Z-axis**: Z0 should be where the nozzle touches the bed
- **B-axis**: B0 should point the nozzle straight down
- **A-axis**: A360 should complete exactly one full rotation

## Features

- **Direction check**: Verify A and B motors rotate correctly
- **A-axis calibration**: Two-point measurement for rotation accuracy
- **B-axis calibration**: Two-point measurement for tilt accuracy
- **Z-axis calibration**: Paper test method for Z height
- **Auto-calculation**: Generates M206 and M92 corrections
- **Save to EEPROM**: Apply settings directly to printer

## Usage

1. Connect to your printer via USB
2. Check A and B axis directions (first time only)
3. Set A-axis reference positions (A0, A360)
4. Set B-axis reference positions (B0, B90)
5. Set Z0 using paper test method
6. Apply settings to printer

## Browser requirements

- **Chrome 89+** or **Microsoft Edge 89+** (Web Serial API)
- Firefox and Safari are not supported

## Next steps

After printer setup, continue to [LA/LB Measure](../la-lb-measure/) to determine your kinematic parameters.

## File structure

```
printer-setup/
├── index.html
├── README.md
└── js/
    ├── app.js
    ├── connect.js
    ├── prepare.js
    ├── direction-check.js
    ├── a-axis.js
    ├── b-axis.js
    ├── z-axis.js
    └── apply.js
```

## Support

- **Discord**: [Join our community](https://discord.gg/GNdah82VBg)
