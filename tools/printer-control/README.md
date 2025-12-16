# Rep5x - Printer control

A web-based control panel for your Rep5x 5-axis 3D printer, similar to Pronterface but running directly in your browser.

**Live tool:** https://tools.rep5x.com/printer-control/

## Features

- **5-axis jog controls**: Move X, Y, Z plus A (yaw) and B (pitch) axes
- **Configurable step sizes**: Linear (0.1, 1, 10, 100mm) and angular (1, 5, 15, 45, 90°)
- **Home controls**: Home individual axes or all at once
- **Emergency stop**: Quickly halt all movement
- **G-code console**: Send commands and view responses in real-time
- **Quick commands**: One-click access to common commands (M114, M503, M500, etc.)
- **Temperature controls**: Set hotend and bed temperatures
- **Auto-connect**: Automatically reconnects to previously used serial port
- **Clipboard copy**: Troubleshooting commands auto-copy responses to clipboard (formatted for Discord)

## Quick start

1. Go to https://tools.rep5x.com/printer-control/ (or open `index.html` locally in Chrome or Edge)
2. Click "Connect" and select your printer's serial port
3. Use the jog buttons to move the printer
4. Send G-code commands via the console

## Controls

### Jog buttons

- **X/Y pad**: Move in the horizontal plane
- **Z buttons**: Move up/down
- **A buttons**: Rotate around vertical axis (yaw)
- **B buttons**: Tilt nozzle (pitch)

### Keyboard shortcuts

| Key | Action |
|-----|--------|
| Arrow keys | Jog X/Y |
| Page Up/Down | Jog Z |
| Home | Home all axes |
| Spacebar | Emergency stop |

### Quick commands

| Button | G-code | Description |
|--------|--------|-------------|
| Get position | M114 | Report current position (auto-copy) |
| Endstop status | M119 | Show endstop states (auto-copy) |
| Report settings | M503 | Show all firmware settings (auto-copy) |
| Firmware info | M115 | Show firmware version (auto-copy) |
| Save EEPROM | M500 | Save settings to EEPROM |
| Load EEPROM | M501 | Load settings from EEPROM |
| Reset defaults | M502 | Reset to factory defaults |
| Disable motors | M18 | Release stepper motors |
| Enable motors | M17 | Energise stepper motors |
| Absolute mode | G90 | Set absolute positioning |
| Relative mode | G91 | Set relative positioning |
| Get temps | M105 | Report temperatures (auto-copy) |

## Browser requirements

- **Chrome 89+** or **Microsoft Edge 89+** (Web Serial API support)
- Firefox and Safari are not supported

## File structure

```
printer-control/
├── index.html    # Main application
├── README.md     # This file
└── js/
    └── app.js    # Application logic
```

## Support

- **Discord**: [Join our community](https://discord.gg/GNdah82VBg)
