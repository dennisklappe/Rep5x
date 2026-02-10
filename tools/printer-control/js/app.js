/**
 * Rep5x Printer Control Application
 * Simple Pronterface-like interface for controlling 5-axis printers
 */

class PrinterControlApp {
    constructor() {
        this.printer = new PrinterInterface();
        this.linearStep = 1;
        this.angleStep = 5;
        this.extrudeStep = 5;

        // Response collection for copy-to-clipboard
        this.responseCollector = null;
        this.responseLines = [];

        // Temperature polling interval
        this.tempPollInterval = null;

        // Console auto-scroll control
        this.consoleAutoScroll = true;

        // Command history
        this.commandHistory = [];
        this.historyIndex = -1;

        // G-code file playback
        this.gcodeLines = [];
        this.gcodeIndex = 0;
        this.isPlaying = false;

        // Bind printer callbacks
        this.printer.onPositionUpdate = (pos) => this.updatePositionDisplay(pos);
        this.printer.onConnectionChange = (connected) => this.updateConnectionStatus(connected);
        this.printer.onTemperatureUpdate = (temp) => this.updateTemperatureDisplay(temp);
        this.printer.onLog = (msg) => this.handlePrinterLog(msg);

        this.init();
    }

    /**
     * Handle printer log messages and collect responses if needed
     */
    handlePrinterLog(msg) {
        this.logToConsole(msg);

        // If we're collecting responses, add to buffer
        if (this.responseCollector && msg.startsWith('< ')) {
            const line = msg.substring(2); // Remove "< " prefix
            this.responseLines.push(line);

            // Check for "ok" to know command is done
            if (line.toLowerCase() === 'ok') {
                this.finishResponseCollection();
            }
        }
    }

    /**
     * Start collecting responses for a command
     */
    startResponseCollection(commandName) {
        this.responseLines = [];
        this.responseCollector = commandName;
    }

    /**
     * Finish collecting and copy to clipboard
     */
    async finishResponseCollection() {
        if (!this.responseCollector) return;

        const commandName = this.responseCollector;
        const lines = this.responseLines.filter(l => l.toLowerCase() !== 'ok');
        this.responseCollector = null;
        this.responseLines = [];

        if (lines.length > 0) {
            // Wrap in code block for easy Discord paste
            const text = '```\n' + lines.join('\n') + '\n```';
            try {
                await navigator.clipboard.writeText(text);
                this.logToConsole(`[Copied ${commandName} response to clipboard]`, 'info');
            } catch (err) {
                this.logToConsole(`[Could not copy to clipboard: ${err.message}]`, 'error');
            }
        }
    }

    init() {
        // Initialize shared components
        if (typeof SharedHeader !== 'undefined') {
            SharedHeader.init('Printer Control');
        }
        if (typeof SharedFooter !== 'undefined') {
            SharedFooter.init();
        }

        this.setupEventListeners();
        this.setupConsoleHeight();
        this.logToConsole('[Ready] Printer control initialized', 'info');

        // Try auto-connect to previously used port
        this.tryAutoConnect();
    }

    /**
     * Lock right column height to left column so console scrolls instead of growing
     */
    setupConsoleHeight() {
        const leftCol = document.getElementById('leftColumn');
        const rightCol = document.querySelector('.right-column');
        if (!leftCol || !rightCol) return;

        const sync = () => {
            // Only constrain on desktop (lg grid) where columns are side-by-side
            if (window.innerWidth >= 1024) {
                rightCol.style.maxHeight = leftCol.offsetHeight + 'px';
            } else {
                rightCol.style.maxHeight = '';
            }
        };

        // Sync after layout settles
        requestAnimationFrame(sync);

        // Re-sync on resize
        window.addEventListener('resize', sync);

        // Re-sync when left column content changes height
        if (typeof ResizeObserver !== 'undefined') {
            new ResizeObserver(sync).observe(leftCol);
        }
    }

    /**
     * Try to auto-connect to a previously granted serial port
     */
    async tryAutoConnect() {
        if (!PrinterInterface.isSupported()) return;

        try {
            const ports = await navigator.serial.getPorts();
            if (ports.length > 0) {
                this.logToConsole('Found previously connected port, auto-connecting...', 'info');
                const btn = document.getElementById('connectBtn');
                btn.textContent = 'Connecting...';
                btn.disabled = true;

                try {
                    await this.printer.connectToPort(ports[0]);
                    btn.textContent = 'Disconnect';
                } catch (error) {
                    this.logToConsole(`Auto-connect failed: ${error.message}`, 'error');
                    btn.textContent = 'Connect';
                } finally {
                    btn.disabled = false;
                }
            }
        } catch (error) {
            // Silent fail - auto-connect is optional
        }
    }

    setupEventListeners() {
        // Connection
        document.getElementById('connectBtn').addEventListener('click', () => this.toggleConnection());
        document.getElementById('testModeToggle').addEventListener('change', (e) => {
            this.printer.setTestMode(e.target.checked);
        });

        // Jog buttons
        document.querySelectorAll('.jog-btn[data-axis]').forEach(btn => {
            btn.addEventListener('click', () => {
                const axis = btn.dataset.axis;
                const dir = parseInt(btn.dataset.dir);
                this.jog(axis, dir);
            });
        });

        // Home buttons
        document.getElementById('homeXY').addEventListener('click', () => this.home(['X', 'Y']));
        document.getElementById('homeZ').addEventListener('click', () => this.home(['Z']));
        document.getElementById('homeC').addEventListener('click', () => this.home(['C']));
        document.getElementById('homeB').addEventListener('click', () => this.home(['B']));
        document.getElementById('homeAll').addEventListener('click', () => this.home([]));
        document.getElementById('homeCBZero').addEventListener('click', () => this.homeCBAndZero());

        // Emergency stop
        document.getElementById('emergencyStop').addEventListener('click', () => this.emergencyStop());

        // Step size buttons
        document.querySelectorAll('.linear-step').forEach(btn => {
            btn.addEventListener('click', () => {
                this.linearStep = parseFloat(btn.dataset.step);
                document.querySelectorAll('.linear-step').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        document.querySelectorAll('.angle-step').forEach(btn => {
            btn.addEventListener('click', () => {
                this.angleStep = parseFloat(btn.dataset.step);
                document.querySelectorAll('.angle-step').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        // Extrusion step size buttons
        document.querySelectorAll('.extrude-step').forEach(btn => {
            btn.addEventListener('click', () => {
                this.extrudeStep = parseFloat(btn.dataset.step);
                document.querySelectorAll('.extrude-step').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        // Extrusion buttons
        document.getElementById('extrudeBtn').addEventListener('click', () => this.extrude(1));
        document.getElementById('retractBtn').addEventListener('click', () => this.extrude(-1));

        // Quick commands
        document.querySelectorAll('.quick-cmd').forEach(btn => {
            btn.addEventListener('click', () => {
                const cmd = btn.dataset.cmd;
                // Commands that return useful info for troubleshooting - auto-copy to clipboard
                const copyCommands = ['M114', 'M115', 'M119', 'M503', 'M105'];

                // Start collecting response for commands that should auto-copy
                if (copyCommands.includes(cmd)) {
                    this.startResponseCollection(cmd);
                }

                this.sendCommand(cmd);
            });
        });

        // Toggle buttons (IK, Motors)
        document.querySelectorAll('.toggle-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const currentState = btn.dataset.state;
                const newState = currentState === 'on' ? 'off' : 'on';
                const cmd = newState === 'on' ? btn.dataset.cmdOn : btn.dataset.cmdOff;

                // Update button state and appearance
                btn.dataset.state = newState;
                const label = btn.textContent.split(':')[0];
                btn.textContent = `${label}: ${newState.toUpperCase()}`;

                // Update styling based on state
                if (newState === 'on') {
                    btn.classList.add('bg-green-50', 'border-green-300');
                    btn.classList.remove('bg-red-50', 'border-red-300');
                } else {
                    btn.classList.add('bg-red-50', 'border-red-300');
                    btn.classList.remove('bg-green-50', 'border-green-300');
                }

                this.sendCommand(cmd);
            });
        });

        // Command form
        const commandInput = document.getElementById('commandInput');
        document.getElementById('commandForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const cmd = commandInput.value.trim();
            if (cmd) {
                // Handle "clear" command
                if (cmd.toLowerCase() === 'clear') {
                    document.getElementById('console').innerHTML = '';
                    this.consoleAutoScroll = true;
                    this.logToConsole('[Console cleared]', 'info');
                } else {
                    // Add to history (avoid duplicates)
                    if (this.commandHistory[0] !== cmd) {
                        this.commandHistory.unshift(cmd);
                        // Limit history size
                        if (this.commandHistory.length > 50) {
                            this.commandHistory.pop();
                        }
                    }
                    this.sendCommand(cmd);
                }
                commandInput.value = '';
                this.historyIndex = -1;
            }
        });

        // Command history navigation (arrow up/down)
        commandInput.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (this.commandHistory.length > 0 && this.historyIndex < this.commandHistory.length - 1) {
                    this.historyIndex++;
                    commandInput.value = this.commandHistory[this.historyIndex];
                    // Move cursor to end
                    setTimeout(() => commandInput.setSelectionRange(commandInput.value.length, commandInput.value.length), 0);
                }
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (this.historyIndex > 0) {
                    this.historyIndex--;
                    commandInput.value = this.commandHistory[this.historyIndex];
                } else if (this.historyIndex === 0) {
                    this.historyIndex = -1;
                    commandInput.value = '';
                }
            }
        });

        // Clear console
        document.getElementById('clearConsole').addEventListener('click', () => {
            document.getElementById('console').innerHTML = '';
            this.consoleAutoScroll = true;  // Re-enable auto-scroll after clearing
            this.logToConsole('[Console cleared]', 'info');
        });

        // Console scroll detection
        const consoleEl = document.getElementById('console');
        consoleEl.addEventListener('scroll', () => {
            // Check if user is scrolled to bottom (within 10px threshold)
            const isAtBottom = consoleEl.scrollHeight - consoleEl.scrollTop - consoleEl.clientHeight < 10;
            this.consoleAutoScroll = isAtBottom;
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));

        // G-code file upload
        const gcodeFileInput = document.getElementById('gcodeFile');
        if (gcodeFileInput) {
            gcodeFileInput.addEventListener('change', (e) => this.loadGcodeFile(e.target.files[0]));
        }

        const gcodePlayBtn = document.getElementById('gcodePlayBtn');
        if (gcodePlayBtn) {
            gcodePlayBtn.addEventListener('click', () => this.toggleGcodePlay());
        }

        const gcodeStopBtn = document.getElementById('gcodeStopBtn');
        if (gcodeStopBtn) {
            gcodeStopBtn.addEventListener('click', () => this.stopGcode());
        }

        // EEPROM backup/restore
        document.getElementById('eepromBackup').addEventListener('click', () => this.backupEeprom());
        document.getElementById('eepromRestoreFile').addEventListener('change', (e) => {
            if (e.target.files[0]) {
                this.restoreEeprom(e.target.files[0]);
                e.target.value = ''; // Reset so same file can be selected again
            }
        });
    }

    handleKeyboard(e) {
        // Don't capture if typing in input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        if (!this.printer.isConnected()) return;

        let handled = true;

        switch (e.key) {
            case 'ArrowUp':
                this.jog('Y', 1);
                break;
            case 'ArrowDown':
                this.jog('Y', -1);
                break;
            case 'ArrowLeft':
                this.jog('X', -1);
                break;
            case 'ArrowRight':
                this.jog('X', 1);
                break;
            case 'PageUp':
                this.jog('Z', 1);
                break;
            case 'PageDown':
                this.jog('Z', -1);
                break;
            case 'Home':
                this.home([]);
                break;
            case ' ':
                this.emergencyStop();
                break;
            case '1':
                this.setStepSize('linear', 0.1);
                this.setStepSize('angle', 1);
                break;
            case '2':
                this.setStepSize('linear', 1);
                this.setStepSize('angle', 5);
                break;
            case '3':
                this.setStepSize('linear', 10);
                this.setStepSize('angle', 15);
                break;
            case '5':
                this.setStepSize('linear', 50);
                this.setStepSize('angle', 45);
                break;
            default:
                handled = false;
        }

        if (handled) {
            e.preventDefault();
        }
    }

    setStepSize(type, value) {
        if (type === 'linear') {
            this.linearStep = value;
            // Update UI
            document.querySelectorAll('.linear-step').forEach(btn => {
                const btnValue = parseFloat(btn.dataset.step);
                if (btnValue === value) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
        } else if (type === 'angle') {
            this.angleStep = value;
            // Update UI
            document.querySelectorAll('.angle-step').forEach(btn => {
                const btnValue = parseFloat(btn.dataset.step);
                if (btnValue === value) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
        }
    }

    async toggleConnection() {
        const btn = document.getElementById('connectBtn');

        if (this.printer.isConnected() && !this.printer.testMode.enabled) {
            await this.printer.disconnect();
            btn.textContent = 'Connect';
        } else {
            try {
                btn.textContent = 'Connecting...';
                btn.disabled = true;
                await this.printer.connect();
                btn.textContent = 'Disconnect';
            } catch (error) {
                this.logToConsole(`Connection failed: ${error.message}`, 'error');
                btn.textContent = 'Connect';
            } finally {
                btn.disabled = false;
            }
        }
    }

    updateConnectionStatus(connected) {
        const status = document.getElementById('connectionStatus');
        const btn = document.getElementById('connectBtn');

        if (connected) {
            status.className = 'flex items-center gap-2 px-3 py-1 rounded-full text-sm status-success border';
            status.innerHTML = '<span class="w-2 h-2 rounded-full bg-current"></span><span>Connected</span>';
            btn.textContent = 'Disconnect';
            // Start temperature polling
            this.startTemperaturePolling();
        } else {
            status.className = 'flex items-center gap-2 px-3 py-1 rounded-full text-sm status-danger border';
            status.innerHTML = '<span class="w-2 h-2 rounded-full bg-current"></span><span>Disconnected</span>';
            btn.textContent = 'Connect';
            // Stop temperature polling
            this.stopTemperaturePolling();
        }

        // Enable/disable controls
        this.setControlsEnabled(connected);
    }

    setControlsEnabled(enabled) {
        // Jog buttons
        document.querySelectorAll('.jog-btn').forEach(btn => {
            btn.disabled = !enabled;
            btn.style.opacity = enabled ? '1' : '0.5';
        });

        // Quick commands
        document.querySelectorAll('.quick-cmd').forEach(btn => {
            btn.disabled = !enabled;
            btn.style.opacity = enabled ? '1' : '0.5';
        });

        // Home, emergency, extrusion and EEPROM buttons
        ['homeXY', 'homeZ', 'homeC', 'homeB', 'homeAll', 'homeCBZero', 'emergencyStop', 'extrudeBtn', 'retractBtn', 'eepromBackup'].forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.disabled = !enabled;
                btn.style.opacity = enabled ? '1' : '0.5';
            }
        });

        // EEPROM restore label
        const restoreLabel = document.getElementById('eepromRestoreLabel');
        if (restoreLabel) {
            restoreLabel.style.opacity = enabled ? '1' : '0.5';
            restoreLabel.style.pointerEvents = enabled ? '' : 'none';
        }

        // Command input
        document.getElementById('commandInput').disabled = !enabled;
        document.querySelector('#commandForm button').disabled = !enabled;
    }

    updatePositionDisplay(pos) {
        document.getElementById('pos-x').textContent = pos.x.toFixed(2);
        document.getElementById('pos-y').textContent = pos.y.toFixed(2);
        document.getElementById('pos-z').textContent = pos.z.toFixed(2);
        document.getElementById('pos-c').textContent = pos.c.toFixed(2);
        document.getElementById('pos-b').textContent = pos.b.toFixed(2);
    }

    updateTemperatureDisplay(temp) {
        const hotendEl = document.getElementById('temp-hotend');
        const hotendTargetEl = document.getElementById('temp-hotend-target');
        const bedEl = document.getElementById('temp-bed');
        const bedTargetEl = document.getElementById('temp-bed-target');

        if (hotendEl && temp.hotend !== null) {
            hotendEl.textContent = temp.hotend.toFixed(1);
        }
        if (hotendTargetEl && temp.hotendTarget !== null) {
            hotendTargetEl.textContent = temp.hotendTarget.toFixed(0);
        }
        if (bedEl && temp.bed !== null) {
            bedEl.textContent = temp.bed.toFixed(1);
        }
        if (bedTargetEl && temp.bedTarget !== null) {
            bedTargetEl.textContent = temp.bedTarget.toFixed(0);
        }
    }

    startTemperaturePolling() {
        if (this.tempPollInterval) return;
        // Poll temperature every 2 seconds
        this.tempPollInterval = setInterval(() => {
            if (this.printer.isConnected()) {
                this.printer.sendCommand('M105');
            }
        }, 2000);
        // Initial poll
        if (this.printer.isConnected()) {
            this.printer.sendCommand('M105');
        }
    }

    stopTemperaturePolling() {
        if (this.tempPollInterval) {
            clearInterval(this.tempPollInterval);
            this.tempPollInterval = null;
        }
        // Reset display
        document.getElementById('temp-hotend').textContent = '--';
        document.getElementById('temp-hotend-target').textContent = '--';
        document.getElementById('temp-bed').textContent = '--';
        document.getElementById('temp-bed-target').textContent = '--';
    }

    async jog(axis, direction) {
        if (!this.printer.isConnected()) {
            this.logToConsole('Not connected to printer', 'error');
            return;
        }

        const isRotational = axis === 'C' || axis === 'B';
        const step = isRotational ? this.angleStep : this.linearStep;
        const distance = step * direction;

        try {
            const delta = {};
            delta[axis.toLowerCase()] = distance;
            await this.printer.moveRelative(delta);
        } catch (error) {
            this.logToConsole(`Jog error: ${error.message}`, 'error');
        }
    }

    async home(axes) {
        if (!this.printer.isConnected()) {
            this.logToConsole('Not connected to printer', 'error');
            return;
        }

        try {
            // Disable IK before homing (don't re-enable - user controls via start g-code)
            this.logToConsole('Disabling IK for homing...', 'info');
            await this.printer.sendCommandAndWait('G49');

            const axisStr = axes.length > 0 ? axes.join(', ') : 'all axes';
            this.logToConsole(`Homing ${axisStr}...`, 'info');
            await this.printer.home(axes);
            this.logToConsole(`Homing complete`, 'info');
        } catch (error) {
            this.logToConsole(`Home error: ${error.message}`, 'error');
        }
    }

    async homeCBAndZero() {
        if (!this.printer.isConnected()) {
            this.logToConsole('Not connected to printer', 'error');
            return;
        }

        try {
            // Disable IK before homing (don't re-enable - user controls via start g-code)
            this.logToConsole('Disabling IK for homing...', 'info');
            await this.printer.sendCommandAndWait('G49');

            this.logToConsole('Homing C & B axes...', 'info');
            await this.printer.sendCommandAndWait('G28 C B', 60000);

            this.logToConsole('Moving to C0 B0...', 'info');
            await this.printer.sendCommandAndWait('G0 C0 B0 F3000', 30000);

            this.logToConsole('C/B at zero position', 'info');
        } catch (error) {
            this.logToConsole(`Home C/B error: ${error.message}`, 'error');
        }
    }

    async emergencyStop() {
        try {
            // Send emergency stop (M112 is standard, M410 is quick stop)
            await this.printer.sendCommand('M410');
            await this.printer.sendCommand('M112');
            this.logToConsole('EMERGENCY STOP SENT', 'error');
        } catch (error) {
            this.logToConsole(`Emergency stop error: ${error.message}`, 'error');
        }
    }

    async extrude(direction) {
        if (!this.printer.isConnected()) {
            this.logToConsole('Not connected to printer', 'error');
            return;
        }

        const amount = this.extrudeStep * direction;
        const action = direction > 0 ? 'Extruding' : 'Retracting';

        try {
            this.logToConsole(`${action} ${Math.abs(amount)}mm...`, 'info');
            // Use relative extrusion mode
            await this.printer.sendCommand('M83');
            // Extrude at reasonable speed (3mm/s = 180mm/min)
            await this.printer.sendCommand(`G1 E${amount} F180`);
        } catch (error) {
            this.logToConsole(`Extrusion error: ${error.message}`, 'error');
        }
    }

    async sendCommand(cmd) {
        if (!this.printer.isConnected()) {
            this.logToConsole('Not connected to printer', 'error');
            return;
        }

        try {
            await this.printer.sendCommand(cmd);
        } catch (error) {
            this.logToConsole(`Send error: ${error.message}`, 'error');
        }
    }

    /**
     * Backup EEPROM settings to a downloadable file
     * Captures M503 + M665 (IK parameters) + M667 (calibration coefficients)
     */
    async backupEeprom() {
        if (!this.printer.isConnected()) {
            this.logToConsole('Not connected to printer', 'error');
            return;
        }

        try {
            // Capture M503 (standard Marlin settings)
            this.logToConsole('Reading EEPROM settings (M503)...', 'info');
            const m503Response = await this.printer.sendCommandAndCapture('M503', 15000);
            const m503Lines = m503Response.split('\n').filter(l => l.trim() && l.toLowerCase().trim() !== 'ok');

            if (m503Lines.length === 0) {
                this.logToConsole('No settings received from printer', 'error');
                return;
            }

            // Capture M665 (IK parameters: LC/LB lengths)
            this.logToConsole('Reading IK parameters (M665)...', 'info');
            let m665Lines = [];
            try {
                const m665Response = await this.printer.sendCommandAndCapture('M665', 10000);
                m665Lines = m665Response.split('\n').filter(l => l.trim() && l.toLowerCase().trim() !== 'ok');
            } catch (e) {
                this.logToConsole('Could not read M665 (IK parameters) - skipping', 'info');
            }

            // Capture M667 (calibration correction coefficients)
            this.logToConsole('Reading calibration data (M667)...', 'info');
            let m667Lines = [];
            try {
                const m667Response = await this.printer.sendCommandAndCapture('M667', 10000);
                m667Lines = m667Response.split('\n').filter(l => l.trim() && l.toLowerCase().trim() !== 'ok');
            } catch (e) {
                this.logToConsole('Could not read M667 (calibration) - skipping', 'info');
            }

            // Build the backup file
            const now = new Date();
            const timestamp = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}T${String(now.getHours()).padStart(2,'0')}-${String(now.getMinutes()).padStart(2,'0')}-${String(now.getSeconds()).padStart(2,'0')}`;
            const sections = [
                '; Rep5x EEPROM backup',
                `; Date: ${new Date().toLocaleString()}`,
                '; Restore this file via Printer Control > Restore backup',
                ';',
                '; === M503 output (standard settings) ===',
                ...m503Lines,
            ];

            if (m665Lines.length > 0) {
                sections.push('', '; === M665 output (IK parameters: LC/LB) ===', ...m665Lines);
            }

            if (m667Lines.length > 0) {
                sections.push('', '; === M667 output (calibration coefficients) ===', ...m667Lines);
            }

            const content = sections.join('\n') + '\n';

            // Download as file
            const blob = new Blob([content], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `rep5x-eeprom-backup-${timestamp}.cfg`;
            a.click();
            URL.revokeObjectURL(url);

            const totalLines = m503Lines.length + m665Lines.length + m667Lines.length;
            this.logToConsole(`EEPROM backup saved (${totalLines} lines: M503 + M665 + M667)`, 'info');
        } catch (error) {
            this.logToConsole(`Backup failed: ${error.message}`, 'error');
        }
    }

    /**
     * Restore EEPROM settings from a backup file
     */
    async restoreEeprom(file) {
        if (!this.printer.isConnected()) {
            this.logToConsole('Not connected to printer', 'error');
            return;
        }

        try {
            const text = await file.text();
            const allLines = text.split('\n');

            // Extract valid firmware commands from the backup
            // M503 output has lines like "echo:  M92 X80.00 Y80.00 ..." or raw "M92 ..."
            const commands = [];
            for (const raw of allLines) {
                let line = raw.trim();
                if (!line || line.startsWith(';')) continue;

                // Strip "echo:" prefix and leading whitespace
                line = line.replace(/^echo:\s*/i, '').trim();

                // Strip inline comments
                line = line.split(';')[0].trim();
                if (!line) continue;

                // Only keep lines that start with a valid G/M command
                if (/^[GM]\d+/i.test(line)) {
                    commands.push(line);
                }
            }

            if (commands.length === 0) {
                this.logToConsole('No valid commands found in backup file', 'error');
                return;
            }

            this.logToConsole(`Restoring ${commands.length} settings from ${file.name}...`, 'info');

            // Send each command and wait for ok
            for (let i = 0; i < commands.length; i++) {
                const cmd = commands[i];
                this.logToConsole(`[${i + 1}/${commands.length}] ${cmd}`, 'info');
                try {
                    await this.printer.sendCommandAndWait(cmd, 10000);
                } catch (error) {
                    this.logToConsole(`Warning: ${cmd} - ${error.message}`, 'error');
                }
            }

            // Save to EEPROM
            this.logToConsole('Saving to EEPROM (M500)...', 'info');
            await this.printer.sendCommandAndWait('M500', 10000);

            this.logToConsole('EEPROM restore complete!', 'info');
        } catch (error) {
            this.logToConsole(`Restore failed: ${error.message}`, 'error');
        }
    }

    logToConsole(message, type = 'received') {
        // Filter out M105 temperature polling noise
        if (message === '> M105' || message.includes('ok T:')) {
            return;
        }

        const console = document.getElementById('console');
        const line = document.createElement('div');
        line.className = `console-line ${type}`;

        // Format message
        const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });

        if (message.startsWith('>')) {
            line.className = 'console-line sent';
            line.textContent = `[${timestamp}] ${message}`;
        } else if (message.startsWith('[TEST]')) {
            line.className = 'console-line info';
            line.textContent = `[${timestamp}] ${message}`;
        } else if (type === 'error') {
            line.textContent = `[${timestamp}] ERROR: ${message}`;
        } else if (type === 'info') {
            line.textContent = `[${timestamp}] ${message}`;
        } else {
            line.textContent = `[${timestamp}] < ${message}`;
        }

        console.appendChild(line);

        // Only auto-scroll if user hasn't scrolled up
        if (this.consoleAutoScroll) {
            console.scrollTop = console.scrollHeight;
        }
    }

    /**
     * Load G-code file for playback
     */
    async loadGcodeFile(file) {
        if (!file) return;

        try {
            const text = await file.text();
            // Parse G-code lines, filtering out comments and empty lines
            this.gcodeLines = text.split('\n')
                .map(line => line.split(';')[0].trim())  // Remove comments
                .filter(line => line.length > 0);        // Remove empty lines

            this.gcodeIndex = 0;
            this.isPlaying = false;

            this.logToConsole(`[Loaded ${file.name}: ${this.gcodeLines.length} commands]`, 'info');
            this.updateGcodeUI();
        } catch (error) {
            this.logToConsole(`Error loading file: ${error.message}`, 'error');
        }
    }

    /**
     * Toggle G-code playback
     */
    toggleGcodePlay() {
        if (this.isPlaying) {
            this.pauseGcode();
        } else {
            this.playGcode();
        }
    }

    /**
     * Start/resume G-code playback
     */
    async playGcode() {
        if (!this.printer.isConnected()) {
            this.logToConsole('Not connected to printer', 'error');
            return;
        }

        if (this.gcodeLines.length === 0) {
            this.logToConsole('No G-code loaded', 'error');
            return;
        }

        this.isPlaying = true;
        this.updateGcodeUI();
        this.logToConsole(`[Playing G-code from line ${this.gcodeIndex + 1}]`, 'info');

        while (this.isPlaying && this.gcodeIndex < this.gcodeLines.length) {
            const line = this.gcodeLines[this.gcodeIndex];
            try {
                await this.printer.sendCommandAndWait(line, 60000);
                this.gcodeIndex++;
                this.updateGcodeUI();
            } catch (error) {
                this.logToConsole(`Error at line ${this.gcodeIndex + 1}: ${error.message}`, 'error');
                this.pauseGcode();
                break;
            }
        }

        if (this.gcodeIndex >= this.gcodeLines.length) {
            this.logToConsole('[G-code complete]', 'info');
            this.isPlaying = false;
            this.updateGcodeUI();
        }
    }

    /**
     * Pause G-code playback
     */
    pauseGcode() {
        this.isPlaying = false;
        this.logToConsole(`[Paused at line ${this.gcodeIndex + 1}]`, 'info');
        this.updateGcodeUI();
    }

    /**
     * Stop G-code playback and reset
     */
    stopGcode() {
        this.isPlaying = false;
        this.gcodeIndex = 0;
        this.logToConsole('[G-code stopped]', 'info');
        this.updateGcodeUI();
    }

    /**
     * Update G-code playback UI
     */
    updateGcodeUI() {
        const playBtn = document.getElementById('gcodePlayBtn');
        const progressEl = document.getElementById('gcodeProgress');

        if (playBtn) {
            playBtn.textContent = this.isPlaying ? 'Pause' : 'Play';
            playBtn.disabled = this.gcodeLines.length === 0;
        }

        if (progressEl) {
            if (this.gcodeLines.length > 0) {
                progressEl.textContent = `${this.gcodeIndex}/${this.gcodeLines.length}`;
            } else {
                progressEl.textContent = 'No file';
            }
        }
    }

}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new PrinterControlApp();
});
