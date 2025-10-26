// Shared Printer Interface Module
// Handles all common printer communication, position tracking, and UI management

class PrinterInterface {
    constructor() {
        this.serialPort = null;
        this.currentPosition = { x: 0, y: 0, z: 0, a: 0, b: 0 };
        this.isRelativeMode = false;
        this.positionCallbacks = [];
        
        // Test mode state
        this.testMode = {
            enabled: false,
            position: { 
                x: PrinterInterface.DEFAULT_TEST_X, 
                y: PrinterInterface.DEFAULT_TEST_Y, 
                z: PrinterInterface.DEFAULT_TEST_Z, 
                a: PrinterInterface.DEFAULT_ANGLE, 
                b: PrinterInterface.DEFAULT_ANGLE 
            },
            relativeMode: false
        };
        
        // Log state
        this.logState = {
            autoScroll: true,
            maxEntries: PrinterInterface.MAX_LOG_ENTRIES
        };
    }
    
    // Serial communication constants
    static get BAUD_RATE() { return 115200; }
    static get POSITION_REQUEST_DELAY() { return 1000; }
    static get MOVEMENT_VERIFY_DELAY() { return 1000; }
    static get TEST_MODE_SIMULATION_DELAY() { return 500; }
    static get TEST_MODE_CALLBACK_DELAY() { return 100; }
    
    // Position display constants
    static get POSITION_DECIMAL_PLACES() { return 1; }
    
    // Test mode default positions
    static get DEFAULT_TEST_X() { return 100; }
    static get DEFAULT_TEST_Y() { return 100; }
    static get DEFAULT_TEST_Z() { return 50; }
    static get DEFAULT_ANGLE() { return 0; }
    
    // UI constants
    static get MAX_LOG_ENTRIES() { return 1000; }
    
    // Storage constants  
    static get COOKIE_EXPIRY_DAYS() { return 365; }
    static get COOKIE_EXPIRY_SECONDS() { return 86400; }  // 24 hours in seconds
    static get HOURS_PER_DAY() { return 24; }
    static get MINUTES_PER_HOUR() { return 60; }
    static get SECONDS_PER_MINUTE() { return 60; }
    static get MILLISECONDS_PER_SECOND() { return 1000; }
    
    // Initialize common UI elements present in all calibration pages
    initializeCommonUI() {
        // Connection button
        const connectBtn = document.getElementById('connectBtn');
        if (connectBtn) {
            connectBtn.addEventListener('click', () => this.connectPrinter());
        }
        
        // Movement controls
        this.initializeMovementControls();
        
        // Home buttons
        this.initializeHomeButtons();
        
        // Step size controls
        this.initializeStepControls();
        
        // Test mode button
        const testModeBtn = document.getElementById('testModeBtn');
        if (testModeBtn) {
            testModeBtn.addEventListener('click', () => this.toggleTestMode());
        }
        
        // Log controls
        this.initializeLogControls();
        
        // Manual G-code
        this.initializeManualGcode();
    }
    
    initializeMovementControls() {
        const moveButtons = document.querySelectorAll('.move-btn');
        moveButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const axis = btn.dataset.axis;
                const direction = parseFloat(btn.dataset.direction);
                const stepSize = this.getStepSize();
                const moveAmount = direction * stepSize;
                
                if (axis === 'X' || axis === 'Y' || axis === 'Z' || axis === 'A' || axis === 'B') {
                    const command = `G91\nG0 ${axis}${moveAmount}\nG90`;
                    this.sendCommand(command);
                }
            });
        });
    }
    
    initializeHomeButtons() {
        const homeButtons = document.querySelectorAll('.home-btn');
        homeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const axis = btn.dataset.axis;
                if (axis === 'XY') {
                    this.sendCommand('G28');
                } else {
                    this.sendCommand(`G28 ${axis}`);
                }
            });
        });
    }
    
    initializeStepControls() {
        const stepButtons = document.querySelectorAll('.step-btn');
        stepButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                stepButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
        
        const customInput = document.getElementById('moveDistance');
        if (customInput) {
            customInput.addEventListener('input', () => {
                stepButtons.forEach(b => b.classList.remove('active'));
            });
        }
    }
    
    initializeLogControls() {
        const clearBtn = document.getElementById('clearLogBtn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearLog());
        }
        
        const autoScrollBtn = document.getElementById('autoScrollBtn');
        if (autoScrollBtn) {
            autoScrollBtn.addEventListener('click', () => this.toggleAutoScroll());
        }
    }
    
    initializeManualGcode() {
        const sendBtn = document.getElementById('sendGcodeBtn');
        if (sendBtn) {
            sendBtn.addEventListener('click', () => this.sendManualGcode());
        }
        
        const input = document.getElementById('manualGcodeInput');
        if (input) {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.sendManualGcode();
                }
            });
        }
    }
    
    getStepSize() {
        const activeBtn = document.querySelector('.step-btn.active');
        if (activeBtn) {
            return parseFloat(activeBtn.dataset.step);
        } else {
            const customValue = parseFloat(document.getElementById('moveDistance')?.value);
            return isNaN(customValue) ? 1.0 : customValue;
        }
    }
    
    async connectPrinter() {
        try {
            this.serialPort = await navigator.serial.requestPort();
            await this.serialPort.open({ baudRate: PrinterInterface.BAUD_RATE });
            
            this.updateConnectionStatus(true);
            this.addLogEntry('Printer connected successfully', 'info');
            
            // Enable measurement buttons if they exist
            this.enableMeasurementButtons();
            
            // Start reading serial data
            this.readSerialData();
            
            // Request initial position
            setTimeout(() => this.sendCommand('M114'), PrinterInterface.POSITION_REQUEST_DELAY);
            
        } catch (error) {
            this.addLogEntry('Connection failed: ' + error.message, 'error');
        }
    }
    
    updateConnectionStatus(connected) {
        const statusIcon = document.getElementById('printerStatus');
        const statusText = document.getElementById('printerText');
        const connectBtn = document.getElementById('connectBtn');
        
        if (connected) {
            if (statusIcon) statusIcon.textContent = '✅';
            if (statusText) statusText.textContent = 'Connected';
            if (connectBtn) {
                connectBtn.textContent = 'Connected';
                connectBtn.disabled = true;
            }
        } else {
            if (statusIcon) statusIcon.textContent = '⚠️';
            if (statusText) statusText.textContent = 'Not connected';
            if (connectBtn) {
                connectBtn.textContent = 'Connect Printer';
                connectBtn.disabled = false;
            }
        }
    }
    
    enableMeasurementButtons() {
        const buttons = [
            'start-la-btn', 'start-lb-btn', 'start-calibration-btn', 
            'start-z-calibration-btn', 'confirm-alignment-btn'
        ];
        
        buttons.forEach(id => {
            const btn = document.getElementById(id);
            if (btn) btn.disabled = false;
        });
    }
    
    async readSerialData() {
        const textDecoder = new TextDecoderStream();
        const readableStreamClosed = this.serialPort.readable.pipeTo(textDecoder.writable);
        const reader = textDecoder.readable.getReader();
        
        try {
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                
                const lines = value.split('\n');
                lines.forEach(line => {
                    if (line.trim()) {
                        this.processSerialLine(line.trim());
                    }
                });
            }
        } catch (error) {
            this.addLogEntry('Serial read error: ' + error.message, 'error');
        }
    }
    
    processSerialLine(line) {
        this.addLogEntry(line, 'received');
        
        // Parse position from M114 response
        if (line.includes('X:') && line.includes('Y:')) {
            const xMatch = line.match(/X:([-\d.]+)/);
            const yMatch = line.match(/Y:([-\d.]+)/);
            const zMatch = line.match(/Z:([-\d.]+)/);
            const aMatch = line.match(/A:([-\d.]+)/);
            const bMatch = line.match(/B:([-\d.]+)/);
            
            if (xMatch && yMatch) {
                this.currentPosition.x = parseFloat(xMatch[1]);
                this.currentPosition.y = parseFloat(yMatch[1]);
                if (zMatch) this.currentPosition.z = parseFloat(zMatch[1]);
                if (aMatch) this.currentPosition.a = parseFloat(aMatch[1]);
                if (bMatch) this.currentPosition.b = parseFloat(bMatch[1]);
                
                this.updatePositionDisplay(this.currentPosition);
                
                // Notify waiting callbacks
                this.positionCallbacks.forEach(callback => callback(this.currentPosition));
                this.positionCallbacks = [];
            }
        }
    }
    
    updatePositionFromCommand(command) {
        // Split multi-line commands and process each line
        const commands = command.split('\n').filter(cmd => cmd.trim());
        
        commands.forEach(cmd => {
            cmd = cmd.trim();
            
            // Track relative/absolute mode
            if (cmd === 'G90') {
                this.isRelativeMode = false;
                this.testMode.relativeMode = false;
                return;
            }
            if (cmd === 'G91') {
                this.isRelativeMode = true;
                this.testMode.relativeMode = true;
                return;
            }
            
            // Use appropriate position source
            const sourcePos = this.testMode.enabled ? this.testMode.position : this.currentPosition;
            const newPos = { ...sourcePos };
            
            // Parse G0/G1 movement commands
            if (/^G[01](\s|$)/.test(cmd)) {
                const xMatch = cmd.match(/X([-\d.]+)/);
                const yMatch = cmd.match(/Y([-\d.]+)/);
                const zMatch = cmd.match(/Z([-\d.]+)/);
                const aMatch = cmd.match(/A([-\d.]+)/);
                const bMatch = cmd.match(/B([-\d.]+)/);
                
                const relMode = this.testMode.enabled ? this.testMode.relativeMode : this.isRelativeMode;
                
                if (relMode) {
                    // Relative positioning
                    if (xMatch) newPos.x += parseFloat(xMatch[1]);
                    if (yMatch) newPos.y += parseFloat(yMatch[1]);
                    if (zMatch) newPos.z += parseFloat(zMatch[1]);
                    if (aMatch) newPos.a += parseFloat(aMatch[1]);
                    if (bMatch) newPos.b += parseFloat(bMatch[1]);
                } else {
                    // Absolute positioning
                    if (xMatch) newPos.x = parseFloat(xMatch[1]);
                    if (yMatch) newPos.y = parseFloat(yMatch[1]);
                    if (zMatch) newPos.z = parseFloat(zMatch[1]);
                    if (aMatch) newPos.a = parseFloat(aMatch[1]);
                    if (bMatch) newPos.b = parseFloat(bMatch[1]);
                }
                
                // Update appropriate position tracker
                if (this.testMode.enabled) {
                    this.testMode.position = newPos;
                } else {
                    this.currentPosition = newPos;
                }
                this.updatePositionDisplay(newPos);
            }
            
            // Handle homing (G28)
            if (/^G28/.test(cmd)) {
                if (cmd === 'G28' || cmd.includes('X')) newPos.x = 0;
                if (cmd === 'G28' || cmd.includes('Y')) newPos.y = 0;
                if (cmd === 'G28' || cmd.includes('Z')) newPos.z = 0;
                if (cmd === 'G28' || cmd.includes('A')) newPos.a = 0;
                if (cmd === 'G28' || cmd.includes('B')) newPos.b = 0;
                
                // Update appropriate position tracker
                if (this.testMode.enabled) {
                    this.testMode.position = newPos;
                } else {
                    this.currentPosition = newPos;
                }
                this.updatePositionDisplay(newPos);
            }
        });
    }
    
    async sendCommand(command) {
        // Log the sent command
        this.addLogEntry(`> ${command}`, 'sent');
        
        // Update position immediately based on command
        this.updatePositionFromCommand(command);
        
        // Check if this is a movement command for M114 verification
        const isMovementCommand = /^G[01]\s|^G28/.test(command.trim());
        
        if (this.testMode.enabled) {
            // In test mode, just simulate
            this.addLogEntry('TEST MODE: Command simulated', 'info');
            if (isMovementCommand) {
                // Simulate delay and then request position update
                setTimeout(() => {
                    this.addLogEntry('TEST MODE: Position updated', 'received');
                }, PrinterInterface.TEST_MODE_SIMULATION_DELAY);
            }
            return;
        }
        
        if (!this.serialPort || !this.serialPort.writable) {
            this.addLogEntry('Error: Printer not connected', 'error');
            return;
        }
        
        try {
            const writer = this.serialPort.writable.getWriter();
            await writer.write(new TextEncoder().encode(command + '\n'));
            writer.releaseLock();
            
            // Auto-request position after movement for real-time updates
            if (isMovementCommand) {
                setTimeout(async () => {
                    try {
                        const encoder = new TextEncoder();
                        const writer = this.serialPort.writable.getWriter();
                        await writer.write(encoder.encode('M114\n'));
                        writer.releaseLock();
                        this.addLogEntry('> M114', 'sent');
                    } catch (error) {
                        this.addLogEntry('Position request failed: ' + error.message, 'error');
                    }
                }, PrinterInterface.MOVEMENT_VERIFY_DELAY);
            }
            
        } catch (error) {
            this.addLogEntry('Send error: ' + error.message, 'error');
        }
    }
    
    async requestCurrentPosition(callback) {
        if (callback) {
            this.positionCallbacks.push(callback);
        }
        
        if (this.testMode.enabled) {
            // In test mode, immediately call callback with test position
            setTimeout(() => {
                if (callback) callback(this.testMode.position);
            }, PrinterInterface.TEST_MODE_CALLBACK_DELAY);
        } else {
            await this.sendCommand('M114');
        }
    }
    
    updatePositionDisplay(position) {
        const elements = {
            'current-x': position.x.toFixed(PrinterInterface.POSITION_DECIMAL_PLACES),
            'current-y': position.y.toFixed(PrinterInterface.POSITION_DECIMAL_PLACES),
            'current-z': position.z.toFixed(PrinterInterface.POSITION_DECIMAL_PLACES),
            'current-a': position.a.toFixed(PrinterInterface.POSITION_DECIMAL_PLACES),
            'current-b': position.b.toFixed(PrinterInterface.POSITION_DECIMAL_PLACES)
        };
        
        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value;
        });
    }
    
    getCurrentPosition() {
        return this.testMode.enabled ? this.testMode.position : this.currentPosition;
    }
    
    toggleTestMode() {
        this.testMode.enabled = !this.testMode.enabled;
        const btn = document.getElementById('testModeBtn');
        
        if (this.testMode.enabled) {
            if (btn) {
                btn.textContent = 'Exit Test Mode';
                btn.classList.add('active');
            }
            this.addLogEntry('Test mode enabled - movements are simulated', 'info');
            
            // Enable measurement buttons even without connection
            this.enableMeasurementButtons();
            
            // Update position display
            this.updatePositionDisplay(this.testMode.position);
            
            this.updateConnectionStatus(false);
            const statusIcon = document.getElementById('printerStatus');
            const statusText = document.getElementById('printerText');
            if (statusIcon) statusIcon.textContent = '🧪';
            if (statusText) statusText.textContent = 'Test Mode';
        } else {
            if (btn) {
                btn.textContent = 'Test Mode';
                btn.classList.remove('active');
            }
            this.addLogEntry('Test mode disabled', 'info');
            
            if (!this.serialPort) {
                this.updateConnectionStatus(false);
            }
        }
    }
    
    sendManualGcode() {
        const input = document.getElementById('manualGcodeInput');
        if (!input) return;
        
        const command = input.value.trim();
        if (command) {
            this.sendCommand(command);
            input.value = '';
        }
    }
    
    addLogEntry(message, type = 'info') {
        const log = document.getElementById('gcodeLog');
        if (!log) return;
        
        const entry = document.createElement('div');
        entry.className = `log-entry ${type}`;
        entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        
        log.appendChild(entry);
        
        // Limit log entries
        while (log.children.length > PrinterInterface.MAX_LOG_ENTRIES) {
            log.removeChild(log.firstChild);
        }
        
        if (this.logState.autoScroll) {
            log.scrollTop = log.scrollHeight;
        }
    }
    
    clearLog() {
        const log = document.getElementById('gcodeLog');
        if (log) {
            log.innerHTML = '<div class="log-entry">Log cleared</div>';
        }
    }
    
    toggleAutoScroll() {
        this.logState.autoScroll = !this.logState.autoScroll;
        const btn = document.getElementById('autoScrollBtn');
        
        if (btn) {
            if (this.logState.autoScroll) {
                btn.classList.add('active');
                btn.textContent = 'Auto Scroll';
            } else {
                btn.classList.remove('active');
                btn.textContent = 'Manual Scroll';
            }
        }
    }
    
    // Check if printer is connected (real or test mode)
    isConnected() {
        return this.serialPort !== null || this.testMode.enabled;
    }
}

// Utility functions for storage management
function getValue(name) {
    // Try localStorage first
    try {
        const localValue = localStorage.getItem(`rep5x_${name}`);
        if (localValue !== null) {
            return localValue;
        }
    } catch (e) {
        // localStorage might not be available
    }
    
    // Fall back to cookies
    const nameEQ = `rep5x_${name}=`;
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) === 0) {
            return c.substring(nameEQ.length, c.length);
        }
    }
    
    return null;
}

function setValue(name, value, days = 365) {
    // Try localStorage first
    try {
        localStorage.setItem(`rep5x_${name}`, value);
    } catch (e) {
        // localStorage might not be available or full
    }
    
    // Also set cookie as backup
    const expires = new Date();
    expires.setTime(expires.getTime() + (days * PrinterInterface.HOURS_PER_DAY * PrinterInterface.MINUTES_PER_HOUR * PrinterInterface.SECONDS_PER_MINUTE * PrinterInterface.MILLISECONDS_PER_SECOND));
    document.cookie = `rep5x_${name}=${value};expires=${expires.toUTCString()};path=/`;
}

// Legacy function names for backward compatibility
function getCookie(name) {
    return getValue(name);
}

function setCookie(name, value, days) {
    setValue(name, value, days);
}