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
        this.logToConsole('[Ready] Printer control initialized', 'info');

        // Try auto-connect to previously used port
        this.tryAutoConnect();
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
        document.getElementById('homeA').addEventListener('click', () => this.home(['A']));
        document.getElementById('homeB').addEventListener('click', () => this.home(['B']));
        document.getElementById('homeAll').addEventListener('click', () => this.home([]));
        document.getElementById('homeABZero').addEventListener('click', () => this.homeABAndZero());

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

        // Command form
        document.getElementById('commandForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const input = document.getElementById('commandInput');
            const cmd = input.value.trim();
            if (cmd) {
                this.sendCommand(cmd);
                input.value = '';
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

        // Home, emergency and extrusion buttons
        ['homeXY', 'homeZ', 'homeA', 'homeB', 'homeAll', 'homeABZero', 'emergencyStop', 'extrudeBtn', 'retractBtn'].forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.disabled = !enabled;
                btn.style.opacity = enabled ? '1' : '0.5';
            }
        });

        // Command input
        document.getElementById('commandInput').disabled = !enabled;
        document.querySelector('#commandForm button').disabled = !enabled;
    }

    updatePositionDisplay(pos) {
        document.getElementById('pos-x').textContent = pos.x.toFixed(2);
        document.getElementById('pos-y').textContent = pos.y.toFixed(2);
        document.getElementById('pos-z').textContent = pos.z.toFixed(2);
        document.getElementById('pos-a').textContent = pos.a.toFixed(2);
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

        const isRotational = axis === 'A' || axis === 'B';
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
            const axisStr = axes.length > 0 ? axes.join(', ') : 'all axes';
            this.logToConsole(`Homing ${axisStr}...`, 'info');
            await this.printer.home(axes);
            this.logToConsole(`Homing complete`, 'info');
        } catch (error) {
            this.logToConsole(`Home error: ${error.message}`, 'error');
        }
    }

    async homeABAndZero() {
        if (!this.printer.isConnected()) {
            this.logToConsole('Not connected to printer', 'error');
            return;
        }

        try {
            this.logToConsole('Homing A & B axes...', 'info');
            await this.printer.home(['A', 'B']);
            this.logToConsole('Moving to A0 B0...', 'info');
            await this.printer.moveTo({ a: 0, b: 0 });
            this.logToConsole('A/B at zero position', 'info');
        } catch (error) {
            this.logToConsole(`Home A/B error: ${error.message}`, 'error');
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

    logToConsole(message, type = 'received') {
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
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new PrinterControlApp();
});
