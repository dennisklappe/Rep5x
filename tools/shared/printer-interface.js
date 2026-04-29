/**
 * Printer Interface for Rep5x Tools
 * Handles serial communication with the printer via Web Serial API
 *
 * Used by: Printer Control, LC/LB Measure, Printer Setup, Calibrator
 */

class PrinterInterface {
    static DEFAULT_BAUD_RATE = 250000;
    static BAUD_STORAGE_KEY = 'rep5x.baudRate';
    static POSITION_POLL_DELAY = 500;
    static COMMAND_TIMEOUT = 30000;

    /**
     * Read the user's chosen baud from localStorage, falling back to the default.
     * @returns {number}
     */
    static getStoredBaudRate() {
        try {
            const stored = parseInt(localStorage.getItem(PrinterInterface.BAUD_STORAGE_KEY), 10);
            if (Number.isFinite(stored) && stored > 0) return stored;
        } catch (_) { /* localStorage unavailable */ }
        return PrinterInterface.DEFAULT_BAUD_RATE;
    }

    /**
     * Create a new PrinterInterface
     * @param {object} options - Configuration options
     * @param {boolean} options.logResponses - Whether to log all serial responses (default: true)
     * @param {number} options.baudRate - Override the baud rate (default: read from localStorage / DEFAULT_BAUD_RATE)
     */
    constructor(options = {}) {
        this.port = null;
        this.reader = null;
        this.writer = null;
        this.readableStreamClosed = null;
        this.writableStreamClosed = null;

        this.currentPosition = { x: 0, y: 0, z: 0, c: 0, b: 0 };
        this.isRelativeMode = false;

        // Configuration
        this.logResponses = options.logResponses !== false; // Default to true
        this.baudRate = Number.isFinite(options.baudRate) && options.baudRate > 0
            ? options.baudRate
            : PrinterInterface.getStoredBaudRate();

        // Command queue to prevent concurrent writes (WritableStream can only have one writer)
        this.sendQueue = Promise.resolve();

        // Test mode for development without hardware
        this.testMode = {
            enabled: false,
            position: { x: 100, y: 100, z: 50, c: 0, b: 0 }
        };

        // Callbacks
        this.onPositionUpdate = null;
        this.onConnectionChange = null;
        this.onTemperatureUpdate = null;
        this.onLog = null;

        // Current temperature state
        this.currentTemperature = {
            hotend: null,
            hotendTarget: null,
            bed: null,
            bedTarget: null
        };

        // Response buffer
        this.responseBuffer = '';
        this.pendingPositionResolve = null;
        this.pendingOkResolve = null;
        this.pendingM92Resolve = null;
        this.pendingM206Resolve = null;
        this.pendingM665Resolve = null;
    }

    /**
     * Check if Web Serial API is available
     * @returns {boolean}
     */
    static isSupported() {
        return 'serial' in navigator;
    }

    /**
     * Check if connected to printer
     * @returns {boolean}
     */
    isConnected() {
        return this.testMode.enabled || (this.port !== null && this.port.readable !== null);
    }

    /**
     * Enable or disable test mode
     * @param {boolean} enabled
     */
    setTestMode(enabled) {
        this.testMode.enabled = enabled;
        if (enabled) {
            this.testMode.position = { x: 100, y: 100, z: 50, c: 0, b: 0 };
            this.currentPosition = { ...this.testMode.position };
            this.log('Test mode enabled - movements will be simulated');
            if (this.onConnectionChange) {
                this.onConnectionChange(true);
            }
        } else {
            this.log('Test mode disabled');
            if (!this.port && this.onConnectionChange) {
                this.onConnectionChange(false);
            }
        }
    }

    /**
     * Connect to printer serial port
     * @returns {Promise<boolean>} Success status
     */
    async connect() {
        if (this.testMode.enabled) {
            this.log('Test mode active - skipping serial connection');
            return true;
        }

        if (!PrinterInterface.isSupported()) {
            this.log('Web Serial API not supported in this browser');
            throw new Error('Web Serial API not supported. Please use Chrome or Edge.');
        }

        try {
            // Request port from user
            this.port = await navigator.serial.requestPort();
            return await this.openPort();
        } catch (error) {
            this.log(`Connection error: ${error.message}`);
            if (this.onConnectionChange) {
                this.onConnectionChange(false);
            }
            throw error;
        }
    }

    /**
     * Connect to a specific serial port (for auto-reconnect)
     * @param {SerialPort} port - Previously granted port
     * @returns {Promise<boolean>} Success status
     */
    async connectToPort(port) {
        if (this.testMode.enabled) {
            this.log('Test mode active - skipping serial connection');
            return true;
        }

        this.port = port;
        return await this.openPort();
    }

    /**
     * Open the serial port and start communication
     * @returns {Promise<boolean>} Success status
     */
    async openPort() {
        try {
            // Re-read baud at open time so a selector change takes effect on reconnect
            this.baudRate = PrinterInterface.getStoredBaudRate();

            await this.port.open({
                baudRate: this.baudRate,
                dataBits: 8,
                stopBits: 1,
                parity: 'none',
                flowControl: 'none'
            });

            this.log(`Connected at ${this.baudRate} baud`);

            // Start reading
            this.startReading();

            if (this.onConnectionChange) {
                this.onConnectionChange(true);
            }

            // Request initial position after a short delay
            setTimeout(() => this.requestPosition(), 1000);

            return true;
        } catch (error) {
            this.log(`Connection error: ${error.message}`);
            if (this.onConnectionChange) {
                this.onConnectionChange(false);
            }
            throw error;
        }
    }

    /**
     * Disconnect from printer
     */
    async disconnect() {
        if (this.testMode.enabled) {
            this.log('Test mode - no connection to close');
            return;
        }

        try {
            if (this.reader) {
                await this.reader.cancel();
                await this.readableStreamClosed;
            }
            if (this.writer) {
                await this.writer.close();
                await this.writableStreamClosed;
            }
            if (this.port) {
                await this.port.close();
            }
        } catch (error) {
            this.log(`Disconnect error: ${error.message}`);
        } finally {
            this.port = null;
            this.reader = null;
            this.writer = null;
            if (this.onConnectionChange) {
                this.onConnectionChange(false);
            }
            this.log('Disconnected');
        }
    }

    /**
     * Start reading from serial port
     */
    async startReading() {
        const decoder = new TextDecoderStream();
        this.readableStreamClosed = this.port.readable.pipeTo(decoder.writable);
        this.reader = decoder.readable.getReader();

        try {
            while (true) {
                const { value, done } = await this.reader.read();
                if (done) break;
                this.processResponse(value);
            }
        } catch (error) {
            this.log(`Read error: ${error.message}`);
        }
    }

    /**
     * Process incoming serial data
     * @param {string} data - Received data
     */
    processResponse(data) {
        this.responseBuffer += data;

        // Process complete lines
        const lines = this.responseBuffer.split('\n');
        this.responseBuffer = lines.pop(); // Keep incomplete line in buffer

        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed) {
                this.handleResponseLine(trimmed);
            }
        }
    }

    /**
     * Handle a complete response line
     * @param {string} line - Response line
     */
    handleResponseLine(line) {
        // If capturing, send line to capture callback
        if (this.pendingCaptureResolve) {
            console.log('[PrinterInterface] Capture receiving line:', line);
            this.pendingCaptureResolve(line);
        }

        // Check for position response (M114)
        // Format: "X:100.00 Y:50.00 Z:25.00 A:0.00 B:0.00" or similar
        const posMatch = line.match(/X:([-\d.]+)\s*Y:([-\d.]+)\s*Z:([-\d.]+)/i);
        if (posMatch) {
            this.currentPosition.x = parseFloat(posMatch[1]);
            this.currentPosition.y = parseFloat(posMatch[2]);
            this.currentPosition.z = parseFloat(posMatch[3]);

            // Check for C and B axes
            const cMatch = line.match(/C:([-\d.]+)/i);
            const bMatch = line.match(/B:([-\d.]+)/i);
            if (cMatch) this.currentPosition.c = parseFloat(cMatch[1]);
            if (bMatch) this.currentPosition.b = parseFloat(bMatch[1]);

            if (this.onPositionUpdate) {
                this.onPositionUpdate({ ...this.currentPosition });
            }

            if (this.pendingPositionResolve) {
                this.pendingPositionResolve({ ...this.currentPosition });
                this.pendingPositionResolve = null;
            }
        }

        // Check for temperature response (M105)
        // Format: "ok T:25.3 /210.0 B:60.0 /60.0" or "T:25.3 /210.0 B:60.0 /60.0 @:0 B@:0"
        const tempMatch = line.match(/T:([\d.]+)\s*\/\s*([\d.]+)/i);
        const bedMatch = line.match(/B:([\d.]+)\s*\/\s*([\d.]+)/i);
        if (tempMatch || bedMatch) {
            if (tempMatch) {
                this.currentTemperature.hotend = parseFloat(tempMatch[1]);
                this.currentTemperature.hotendTarget = parseFloat(tempMatch[2]);
            }
            if (bedMatch) {
                this.currentTemperature.bed = parseFloat(bedMatch[1]);
                this.currentTemperature.bedTarget = parseFloat(bedMatch[2]);
            }

            if (this.onTemperatureUpdate) {
                this.onTemperatureUpdate({ ...this.currentTemperature });
            }
        }

        // Check for "ok" response
        if (line.toLowerCase() === 'ok' || line.toLowerCase().startsWith('ok ')) {
            if (this.pendingOkResolve) {
                this.pendingOkResolve();
                this.pendingOkResolve = null;
            }
        }

        // Check for M92 response (steps per unit)
        const m92Match = line.match(/M92.*C([\d.]+).*B([\d.]+)/i);
        if (m92Match && this.pendingM92Resolve) {
            this.pendingM92Resolve({
                c: parseFloat(m92Match[1]),
                b: parseFloat(m92Match[2])
            });
            this.pendingM92Resolve = null;
        }

        // Check for M206 response (home offsets)
        // Marlin format: M206 X0.00 Y0.00 Z0.00 C0.00 B0.00 (or I/J for rotational axes)
        if (line.includes('M206') && this.pendingM206Resolve) {
            const zMatch = line.match(/Z([-\d.]+)/i);
            const cMatch = line.match(/[CI]([-\d.]+)/i);
            const bMatch = line.match(/[BJ]([-\d.]+)/i);
            if (zMatch || cMatch || bMatch) {
                this.pendingM206Resolve({
                    z: zMatch ? parseFloat(zMatch[1]) : 0,
                    c: cMatch ? parseFloat(cMatch[1]) : 0,
                    b: bMatch ? parseFloat(bMatch[1]) : 0
                });
                this.pendingM206Resolve = null;
            }
        }

        // Check for M665 response (IK parameters LC/LB)
        // Marlin PENTA_AXIS_HH format: M665 S200 J1.6 K54.67
        if (line.includes('M665') && this.pendingM665Resolve) {
            const jMatch = line.match(/J([-\d.]+)/i);
            const kMatch = line.match(/K([-\d.]+)/i);
            const sMatch = line.match(/S([-\d.]+)/i);
            this.pendingM665Resolve({
                lc: jMatch ? parseFloat(jMatch[1]) : 0,
                lb: kMatch ? parseFloat(kMatch[1]) : 54.67,
                segmentsPerSecond: sMatch ? parseFloat(sMatch[1]) : 200
            });
            this.pendingM665Resolve = null;
        }

        // Log responses if enabled (configurable per tool)
        if (this.logResponses) {
            this.log(`< ${line}`);
        }
    }

    /**
     * Send a G-code command
     * @param {string} command - G-code command
     * @returns {Promise<void>}
     */
    async sendCommand(command) {
        if (this.testMode.enabled) {
            return this.simulateCommand(command);
        }

        if (!this.isConnected()) {
            throw new Error('Not connected to printer');
        }

        // Queue this command to prevent concurrent writes
        // (WritableStream can only have one active writer at a time)
        const sendPromise = this.sendQueue.then(async () => {
            try {
                const encoder = new TextEncoder();
                const writer = this.port.writable.getWriter();
                await writer.write(encoder.encode(command + '\n'));
                writer.releaseLock();
                this.log(`> ${command}`);
            } catch (error) {
                this.log(`Send error: ${error.message}`);
                throw error;
            }
        });

        // Update queue to wait for this command (don't propagate errors to queue)
        this.sendQueue = sendPromise.catch(() => {});

        return sendPromise;
    }

    /**
     * Send a G-code command and wait for "ok" response
     * @param {string} command - G-code command
     * @param {number} timeout - Timeout in ms (default 60s for long operations like homing)
     * @returns {Promise<void>}
     */
    async sendCommandAndWait(command, timeout = 60000) {
        if (this.testMode.enabled) {
            await this.simulateCommand(command);
            // Simulate longer delays for certain commands in test mode
            const upperCmd = command.toUpperCase();
            if (upperCmd.includes('G28')) {
                await new Promise(r => setTimeout(r, 3000)); // Simulate homing delay
            } else if (upperCmd.includes('G0') || upperCmd.includes('G1')) {
                await new Promise(r => setTimeout(r, 1000)); // Simulate move delay
            }
            return;
        }

        if (!this.isConnected()) {
            throw new Error('Not connected to printer');
        }

        // Chain onto queue - the entire operation (send + wait for ok) happens in sequence
        // This prevents the next command from starting until this one receives its "ok"
        const queuedCommand = this.sendQueue.then(async () => {
            // Set up ok handler and send command
            let resolveOk, rejectOk;
            const okPromise = new Promise((resolve, reject) => {
                resolveOk = resolve;
                rejectOk = reject;
            });

            const timeoutId = setTimeout(() => {
                this.pendingOkResolve = null;
                rejectOk(new Error(`Command timeout: ${command}`));
            }, timeout);

            this.pendingOkResolve = () => {
                clearTimeout(timeoutId);
                console.log('[PrinterInterface] sendCommandAndWait ok received for:', command);
                resolveOk();
            };

            // Send the command (with proper await)
            try {
                const encoder = new TextEncoder();
                const writer = this.port.writable.getWriter();
                await writer.write(encoder.encode(command + '\n'));
                writer.releaseLock();
                this.log(`> ${command}`);
            } catch (error) {
                clearTimeout(timeoutId);
                this.pendingOkResolve = null;
                throw error;
            }

            // Wait for ok
            return okPromise;
        });

        // Hold the queue until ok is received
        this.sendQueue = queuedCommand.catch(() => {});

        return queuedCommand;
    }

    /**
     * Send a command and capture all response lines until "ok"
     * @param {string} command - G-code command to send
     * @param {number} timeout - Timeout in ms
     * @returns {Promise<string>} All response lines joined by newlines
     */
    async sendCommandAndCapture(command, timeout = 10000) {
        if (this.testMode.enabled) {
            return 'Test mode - no response';
        }

        if (!this.isConnected()) {
            throw new Error('Not connected to printer');
        }

        // Chain onto queue - the entire capture (send + wait for response) happens in sequence
        const queuedCapture = this.sendQueue.then(async () => {
            const capturedLines = [];
            let resolveCapture, rejectCapture;

            const capturePromise = new Promise((resolve, reject) => {
                resolveCapture = resolve;
                rejectCapture = reject;
            });

            const timeoutId = setTimeout(() => {
                this.pendingCaptureResolve = null;
                rejectCapture(new Error(`Command timeout: ${command}`));
            }, timeout);

            // Set up capture callback BEFORE sending command
            console.log('[PrinterInterface] Setting up capture for:', command);
            this.pendingCaptureResolve = (line) => {
                capturedLines.push(line);
                console.log('[PrinterInterface] Captured line #' + capturedLines.length + ':', line);
                // Check if this is the final "ok" line
                if (line.toLowerCase().trim() === 'ok') {
                    clearTimeout(timeoutId);
                    this.pendingCaptureResolve = null;
                    console.log('[PrinterInterface] Capture complete, total lines:', capturedLines.length);
                    resolveCapture(capturedLines.join('\n'));
                }
            };

            // Now send the command
            try {
                const encoder = new TextEncoder();
                const writer = this.port.writable.getWriter();
                await writer.write(encoder.encode(command + '\n'));
                writer.releaseLock();
                this.log(`> ${command}`);
            } catch (error) {
                clearTimeout(timeoutId);
                this.pendingCaptureResolve = null;
                this.log(`Send error: ${error.message}`);
                rejectCapture(error);
            }

            return capturePromise;
        });

        // Hold the queue until capture completes
        this.sendQueue = queuedCapture.catch(() => {});

        return queuedCapture;
    }

    /**
     * Simulate a command in test mode
     * @param {string} command - G-code command
     */
    async simulateCommand(command) {
        this.log(`[TEST] > ${command}`);

        // Simulate processing delay
        await new Promise(r => setTimeout(r, 100));

        // Parse movement commands
        const upperCmd = command.toUpperCase();

        // Handle G90/G91
        if (upperCmd.includes('G90')) {
            this.isRelativeMode = false;
        } else if (upperCmd.includes('G91')) {
            this.isRelativeMode = true;
        }

        // Handle G0/G1 movements
        if (upperCmd.includes('G0') || upperCmd.includes('G1')) {
            const axes = ['X', 'Y', 'Z', 'C', 'B'];
            for (const axis of axes) {
                const match = upperCmd.match(new RegExp(`${axis}([-\\d.]+)`));
                if (match) {
                    const value = parseFloat(match[1]);
                    const key = axis.toLowerCase();
                    if (this.isRelativeMode) {
                        this.testMode.position[key] += value;
                    } else {
                        this.testMode.position[key] = value;
                    }
                }
            }
        }

        // Handle G28 homing
        if (upperCmd.includes('G28')) {
            if (upperCmd.includes('X')) this.testMode.position.x = 0;
            if (upperCmd.includes('Y')) this.testMode.position.y = 0;
            if (upperCmd.includes('Z')) this.testMode.position.z = 0;
            if (upperCmd === 'G28') {
                // Home all
                this.testMode.position = { x: 0, y: 0, z: 0, c: 0, b: 0 };
            }
        }

        // Update current position from test mode
        this.currentPosition = { ...this.testMode.position };

        if (this.onPositionUpdate) {
            this.onPositionUpdate({ ...this.currentPosition });
        }
    }

    /**
     * Request current position from printer
     * @returns {Promise<object>} Position object
     */
    async requestPosition() {
        if (this.testMode.enabled) {
            await this.simulateCommand('M114');
            return { ...this.currentPosition };
        }

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.pendingPositionResolve = null;
                reject(new Error('Position request timeout'));
            }, 5000);

            this.pendingPositionResolve = (position) => {
                clearTimeout(timeout);
                resolve(position);
            };

            this.sendCommand('M114');
        });
    }

    /**
     * Query current M92 steps/degree values for C and B axes
     * @returns {Promise<object>} Steps per degree { c, b }
     */
    async queryM92() {
        if (this.testMode.enabled) {
            return { c: 17.778, b: 17.778 }; // Default test values
        }

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.pendingM92Resolve = null;
                reject(new Error('M92 query timeout'));
            }, 5000);

            this.pendingM92Resolve = (steps) => {
                clearTimeout(timeout);
                resolve(steps);
            };

            this.sendCommand('M503'); // Report settings, includes M92
        });
    }

    /**
     * Query current M206 home offset values for C and B axes
     * @returns {Promise<{c: number, b: number}>}
     */
    async queryM206() {
        if (this.testMode.enabled) {
            return { z: 0, c: 0, b: 0 }; // Default test values (no offset)
        }

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.pendingM206Resolve = null;
                reject(new Error('M206 query timeout'));
            }, 5000);

            this.pendingM206Resolve = (offsets) => {
                clearTimeout(timeout);
                resolve(offsets);
            };

            this.sendCommand('M503'); // Report settings, includes M206
        });
    }

    /**
     * Query M119 (endstop states) and parse the response.
     * Marlin reports each endstop on its own line: "x_min: open" or "x_min: TRIGGERED".
     * Rep5x uses I and J as the Marlin internal names for the C and B axes respectively,
     * so the returned object normalises those to c and b.
     * @returns {Promise<{x: string, y: string, z: string, c: string, b: string, raw: string}>}
     *   Each axis value is either "open", "TRIGGERED", or "unknown" (axis not reported).
     */
    async queryEndstops() {
        if (this.testMode.enabled) {
            return { x: 'open', y: 'open', z: 'open', c: 'open', b: 'open', raw: 'Test mode' };
        }

        const raw = await this.sendCommandAndCapture('M119', 5000);
        const result = { x: 'unknown', y: 'unknown', z: 'unknown', c: 'unknown', b: 'unknown', raw };

        // Match lines like "x_min: open", "y_min: TRIGGERED", "i_min: open", etc.
        // Marlin uses i/j for the 4th/5th rotational axes which Rep5x calls c/b.
        const axisAliases = { x: ['x'], y: ['y'], z: ['z'], c: ['c', 'i'], b: ['b', 'j'] };
        for (const line of raw.split('\n')) {
            const match = line.trim().match(/^([a-z])_(?:min|max):\s*(\S+)/i);
            if (!match) continue;
            const letter = match[1].toLowerCase();
            const state = match[2].toLowerCase() === 'triggered' ? 'TRIGGERED' : 'open';
            for (const [axis, aliases] of Object.entries(axisAliases)) {
                if (aliases.includes(letter)) {
                    result[axis] = state;
                    break;
                }
            }
        }
        return result;
    }

    /**
     * Query M122 (TMC driver diagnostics) and parse the response for UART communication health.
     * A working setup returns numeric values for current, microstepping, etc. on every axis.
     * A driver with broken UART typically shows "0xFFFFFFFF" or similar markers.
     * @returns {Promise<{ok: boolean, brokenAxes: string[], raw: string}>}
     */
    async queryDriverStatus() {
        if (this.testMode.enabled) {
            return { ok: true, brokenAxes: [], raw: 'Test mode' };
        }

        const raw = await this.sendCommandAndCapture('M122', 5000);
        const brokenAxes = [];

        // Look for the "Test connection" row Marlin emits; values are "OK" or include "READ" errors.
        // Also detect the well-known UART-broken signature "0xFFFFFFFF".
        const testLine = raw.split('\n').find(l => /test\s+connection/i.test(l));
        if (testLine) {
            // Format example: "Test connection   OK    OK    OK    OK    OK    OK"
            // We just need to confirm none read as something other than OK.
            const tokens = testLine.split(/\s+/).filter(Boolean);
            const firstOkIndex = tokens.findIndex(t => /^(ok|read|fail)/i.test(t));
            if (firstOkIndex !== -1) {
                const statuses = tokens.slice(firstOkIndex);
                statuses.forEach((status, idx) => {
                    if (!/^ok$/i.test(status)) {
                        brokenAxes.push(`driver-${idx}`);
                    }
                });
            }
        }

        if (raw.includes('0xFFFFFFFF') || /UART.*err/i.test(raw)) {
            if (brokenAxes.length === 0) brokenAxes.push('uart-comm');
        }

        return { ok: brokenAxes.length === 0, brokenAxes, raw };
    }

    /**
     * Query M115 (firmware identifier) and return the protocol/firmware string.
     * @returns {Promise<{firmware: string, raw: string}>}
     */
    async queryFirmwareInfo() {
        if (this.testMode.enabled) {
            return { firmware: 'Test mode firmware', raw: 'Test mode' };
        }

        const raw = await this.sendCommandAndCapture('M115', 5000);
        const fwLine = raw.split('\n').find(l => /FIRMWARE_NAME/i.test(l)) || raw.split('\n')[0] || '';
        return { firmware: fwLine.trim(), raw };
    }

    /**
     * Query M665 (IK parameters LC/LB)
     * @returns {Promise<{lc: number, lb: number, segmentsPerSecond: number}>}
     */
    async queryM665() {
        if (this.testMode.enabled) {
            return { lc: 1.6, lb: 54.67, segmentsPerSecond: 200 }; // Default test values
        }

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.pendingM665Resolve = null;
                reject(new Error('M665 query timeout'));
            }, 5000);

            this.pendingM665Resolve = (params) => {
                clearTimeout(timeout);
                resolve(params);
            };

            this.sendCommand('M665'); // Query IK settings
        });
    }

    /**
     * Move to absolute position
     * @param {object} target - Target position { x, y, z, c, b } (optional axes)
     * @param {number} feedrate - Feed rate in mm/min
     */
    async moveTo(target, feedrate = 3000) {
        // Ensure absolute mode
        await this.sendCommand('G90');

        let cmd = 'G0';
        if (target.x !== undefined) cmd += ` X${target.x.toFixed(2)}`;
        if (target.y !== undefined) cmd += ` Y${target.y.toFixed(2)}`;
        if (target.z !== undefined) cmd += ` Z${target.z.toFixed(2)}`;
        if (target.c !== undefined) cmd += ` C${target.c.toFixed(1)}`;
        if (target.b !== undefined) cmd += ` B${target.b.toFixed(1)}`;
        cmd += ` F${feedrate}`;

        await this.sendCommand(cmd);

        // Wait a bit and request position
        await new Promise(r => setTimeout(r, PrinterInterface.POSITION_POLL_DELAY));
        return this.requestPosition();
    }

    /**
     * Move relative to current position
     * @param {object} delta - Relative movement { x, y, z, c, b } (optional axes)
     * @param {number} feedrate - Feed rate in mm/min
     */
    async moveRelative(delta, feedrate = 3000) {
        // Set relative mode
        await this.sendCommand('G91');

        let cmd = 'G0';
        if (delta.x !== undefined) cmd += ` X${delta.x.toFixed(2)}`;
        if (delta.y !== undefined) cmd += ` Y${delta.y.toFixed(2)}`;
        if (delta.z !== undefined) cmd += ` Z${delta.z.toFixed(2)}`;
        if (delta.c !== undefined) cmd += ` C${delta.c.toFixed(1)}`;
        if (delta.b !== undefined) cmd += ` B${delta.b.toFixed(1)}`;
        cmd += ` F${feedrate}`;

        await this.sendCommand(cmd);

        // Return to absolute mode
        await this.sendCommand('G90');

        // Wait a bit and request position
        await new Promise(r => setTimeout(r, PrinterInterface.POSITION_POLL_DELAY));
        return this.requestPosition();
    }

    /**
     * Home specified axes
     * @param {string[]} axes - Axes to home (e.g., ['X', 'Y', 'Z'])
     * @param {number} timeout - Timeout in ms (default 120s — homing can be slow)
     */
    async home(axes = [], timeout = 120000) {
        const cmd = axes.length === 0 ? 'G28' : 'G28 ' + axes.join(' ');
        await this.sendCommandAndWait(cmd, timeout);
        return this.requestPosition();
    }

    /**
     * Get current position
     * @returns {object} Current position
     */
    getPosition() {
        return { ...this.currentPosition };
    }

    /**
     * Log a message
     * @param {string} message
     */
    log(message) {
        if (this.onLog) {
            this.onLog(message);
        }
    }
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PrinterInterface;
}
