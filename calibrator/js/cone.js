// Cone Calibration Script
let serialPort = null;
let serialPortReader = null;
let serialPortWriter = null;

// Error handling constants
const ERROR_TYPES = {
    SERIAL_PORT_IN_USE: 'SERIAL_PORT_IN_USE',
    SERIAL_DISCONNECTED: 'SERIAL_DISCONNECTED',
    STORAGE_QUOTA_EXCEEDED: 'STORAGE_QUOTA_EXCEEDED',
    INVALID_KINEMATIC_PARAMS: 'INVALID_KINEMATIC_PARAMS',
    TIMEOUT_ERROR: 'TIMEOUT_ERROR',
    MALFORMED_RESPONSE: 'MALFORMED_RESPONSE'
};

// Timeout constants (in milliseconds)
const TIMEOUTS = {
    COMMAND_RESPONSE: 30000,    // 30 seconds
    POSITION_REQUEST: 10000,    // 10 seconds  
    MOVEMENT_TIMEOUT: 20000     // 20 seconds
};

// Serial communication constants
const SERIAL_CONFIG = {
    BAUD_RATE: 115200
};

// Calibration angle constants (in degrees)
const CALIBRATION_ANGLES = {
    A_AXIS: [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330, 360],
    B_AXIS: [-90, -75, -60, -45, -30, -15, 0, 15, 30, 45, 60, 75, 90]
};

// Default position constants
const DEFAULT_POSITIONS = {
    TEST_X: 100,
    TEST_Y: 100,
    TEST_Z: 50,
    TEST_A: 0,
    TEST_B: 0,
    Z_OFFSET: 5.0
};

// UI constants
const UI_CONFIG = {
    LOG_AUTO_SCROLL: true
};
let calibrationData = {
    reference: null,
    aAxis: [],
    bAxis: [],
    kinematicParams: {
        la: 0,
        lb: 0
    }
};

let calibrationState = {
    isRunning: false,
    currentAxis: 'A',
    currentStep: 0,
    zOffset: DEFAULT_POSITIONS.Z_OFFSET,
    angles: {
        A: CALIBRATION_ANGLES.A_AXIS,
        B: CALIBRATION_ANGLES.B_AXIS
    }
};

let testMode = {
    enabled: false,
    position: { 
        x: DEFAULT_POSITIONS.TEST_X, 
        y: DEFAULT_POSITIONS.TEST_Y, 
        z: DEFAULT_POSITIONS.TEST_Z, 
        a: DEFAULT_POSITIONS.TEST_A, 
        b: DEFAULT_POSITIONS.TEST_B 
    },
    relativeMode: false
};

let logState = {
    autoScroll: UI_CONFIG.LOG_AUTO_SCROLL
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    try {
        loadKinematicParams();
        initializeUI();
        initializeGraphs();
        
        // Add global error handlers
        window.addEventListener('error', handleGlobalError);
        window.addEventListener('unhandledrejection', handleUnhandledRejection);
        
    } catch (error) {
        handleError('INITIALIZATION_ERROR', 'Failed to initialize application', error);
        console.error('Initialization error:', error);
    }
});

// Global error handlers
function handleGlobalError(event) {
    console.error('Global error:', event.error);
    addLogEntry(`Global error: ${event.error?.message || 'Unknown error'}`, 'error');
}

function handleUnhandledRejection(event) {
    console.error('Unhandled promise rejection:', event.reason);
    addLogEntry(`Unhandled promise rejection: ${event.reason?.message || 'Unknown rejection'}`, 'error');
    event.preventDefault();
}

// Central error handler
function handleError(errorType, message, details = null) {
    const timestamp = new Date().toISOString();
    const errorInfo = {
        type: errorType,
        message: message,
        timestamp: timestamp,
        details: details
    };
    
    console.error('Application error:', errorInfo);
    addLogEntry(`ERROR [${errorType}]: ${message}`, 'error');
    
    // Handle specific error types
    switch (errorType) {
        case ERROR_TYPES.SERIAL_PORT_IN_USE:
            addLogEntry('Try disconnecting and reconnecting the printer', 'warning');
            break;
        case ERROR_TYPES.STORAGE_QUOTA_EXCEEDED:
            addLogEntry('Browser storage is full - clearing old data', 'warning');
            try {
                clearOldStorageData();
            } catch (e) {
                console.error('Failed to clear storage:', e);
            }
            break;
        case ERROR_TYPES.INVALID_KINEMATIC_PARAMS:
            addLogEntry('Please run setup to configure kinematic parameters', 'warning');
            break;
    }
}

function clearOldStorageData() {
    try {
        const keysToKeep = ['rep5x_la', 'rep5x_lb'];
        const allKeys = Object.keys(localStorage);
        
        allKeys.forEach(key => {
            if (!keysToKeep.includes(key)) {
                localStorage.removeItem(key);
            }
        });
        
        addLogEntry('Cleared old storage data', 'info');
    } catch (error) {
        console.error('Failed to clear storage data:', error);
    }
}

function loadKinematicParams() {
    try {
        const la = getCookie('rep5x_la');
        const lb = getCookie('rep5x_lb');
        
        if (la && lb) {
            const laValue = parseFloat(la);
            const lbValue = parseFloat(lb);
            
            // Validate kinematic parameters
            if (isNaN(laValue) || isNaN(lbValue) || laValue < 0 || lbValue <= 0) {
                handleError(ERROR_TYPES.INVALID_KINEMATIC_PARAMS, 
                    `Invalid kinematic parameters: la=${la}, lb=${lb}`, 
                    { la, lb });
                setKinematicDisplay('Invalid parameters');
                return;
            }
            
            if (laValue > 500 || lbValue > 500) {
                addLogEntry(`Warning: Unusually large kinematic parameters (la: ${laValue}mm, lb: ${lbValue}mm)`, 'warning');
            }
            
            calibrationData.kinematicParams.la = laValue;
            calibrationData.kinematicParams.lb = lbValue;
            
            setKinematicDisplay(`la: ${laValue.toFixed(1)}mm lb: ${lbValue.toFixed(1)}mm`);
        } else {
            setKinematicDisplay('la: -- lb: --');
            addLogEntry('Kinematic parameters not found - please run setup first', 'warning');
        }
    } catch (error) {
        handleError('KINEMATIC_LOAD_ERROR', 'Failed to load kinematic parameters', error);
        setKinematicDisplay('Error loading parameters');
    }
}

function setKinematicDisplay(text) {
    try {
        const display = document.getElementById('kinematicValues');
        if (display) {
            display.textContent = text;
        } else {
            addLogEntry('Warning: kinematic-values element not found', 'warning');
        }
    } catch (error) {
        console.error('Error updating kinematic display:', error);
    }
}

function initializeUI() {
    // Connection button
    document.getElementById('connectBtn').addEventListener('click', connectPrinter);
    
    // Movement controls
    const moveButtons = document.querySelectorAll('.move-btn');
    moveButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const axis = btn.dataset.axis;
            const direction = parseFloat(btn.dataset.direction);
            const stepSize = getStepSize();
            const moveAmount = direction * stepSize;
            
            
            if (axis === 'X' || axis === 'Y' || axis === 'Z') {
                const command = `G91\nG0 ${axis}${moveAmount}\nG90`;
                sendCommand(command);
            }
        });
    });
    
    // Home buttons
    const homeButtons = document.querySelectorAll('.home-btn');
    homeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const axis = btn.dataset.axis;
            if (axis === 'XY') {
                // Home all axes
                sendCommand('G28');
            } else {
                sendCommand(`G28 ${axis}`);
            }
        });
    });
    
    // Step size buttons
    const stepButtons = document.querySelectorAll('.step-btn');
    stepButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            stepButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById('moveDistance').value = btn.dataset.step;
        });
    });
    
    // Custom step input
    document.getElementById('moveDistance').addEventListener('input', (e) => {
        stepButtons.forEach(b => b.classList.remove('active'));
    });
    
    // Z offset input
    document.getElementById('zOffsetInput').addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        calibrationState.zOffset = isNaN(value) ? 5.0 : value;
    });
    
    // Log controls
    document.getElementById('clearLogBtn').addEventListener('click', clearLog);
    document.getElementById('autoScrollBtn').addEventListener('click', toggleAutoScroll);
    
    // Manual G-code input
    document.getElementById('sendGcodeBtn').addEventListener('click', sendManualGcode);
    document.getElementById('manualGcodeInput').addEventListener('keypress', handleGcodeInputKeypress);
    
    // Test mode button
    document.getElementById('testModeBtn').addEventListener('click', toggleTestMode);
    
    // Cone setup button
    document.getElementById('checkConeBtn').addEventListener('click', () => {
        document.getElementById('coneStatus').textContent = '✅';
        document.getElementById('coneText').textContent = 'Ready';
        checkCalibrationReady();
    });
    
    // Calibration control
    document.getElementById('startCalibrationBtn').addEventListener('click', startCalibration);
    document.getElementById('confirmAlignmentBtn').addEventListener('click', confirmAlignment);
    document.getElementById('skipPointBtn').addEventListener('click', skipPoint);
    document.getElementById('exportResultsBtn').addEventListener('click', exportResults);
}

async function connectPrinter() {
    const statusIcon = document.getElementById('printerStatus');
    const statusText = document.getElementById('printerText');
    const connectBtn = document.getElementById('connectBtn');
    
    try {
        // Check if Web Serial API is supported
        if (!('serial' in navigator)) {
            throw new Error('Web Serial API not supported in this browser');
        }
        
        // Check if port is already open
        if (serialPort && serialPort.readable) {
            addLogEntry('Serial port already connected', 'warning');
            return;
        }
        
        const filters = [
            { usbVendorId: 0x1A86 }, // CH340
            { usbVendorId: 0x2341 }, // Arduino
            { usbVendorId: 0x0403 }, // FTDI
            { usbVendorId: 0x10C4 }, // CP210x
            { usbVendorId: 0x0483 }  // STM32
        ];
        
        addLogEntry('Requesting serial port access...', 'info');
        serialPort = await navigator.serial.requestPort({ filters });
        
        addLogEntry('Opening serial connection...', 'info');
        await serialPort.open({ 
            baudRate: SERIAL_CONFIG.BAUD_RATE,
            dataBits: 8,
            stopBits: 1,
            parity: 'none',
            flowControl: 'none'
        });
        
        // Update UI safely
        safeUpdateElement(statusIcon, 'textContent', '✅');
        safeUpdateElement(statusText, 'textContent', 'Connected');
        safeUpdateElement(connectBtn, 'textContent', 'Disconnect');
        if (connectBtn) connectBtn.onclick = disconnectPrinter;
        
        // Enable movement controls safely
        enableControlsSafely(['.move-btn', '.home-btn']);
        
        // Set up disconnect handler
        serialPort.addEventListener('disconnect', handleSerialDisconnect);
        
        checkCalibrationReady();
        readSerialData();
        
        addLogEntry('Printer connected successfully', 'received');
        
    } catch (error) {
        const errorType = error.name === 'NotFoundError' ? 'No device selected' :
                         error.name === 'InvalidStateError' ? ERROR_TYPES.SERIAL_PORT_IN_USE :
                         'CONNECTION_ERROR';
        
        handleError(errorType, `Connection failed: ${error.message}`, error);
        
        safeUpdateElement(statusIcon, 'textContent', '❌');
        safeUpdateElement(statusText, 'textContent', 'Connection Failed');
        addLogEntry(`Connection failed: ${error.message}`, 'error');
    }
}

function handleSerialDisconnect(event) {
    addLogEntry('Serial device disconnected unexpectedly', 'error');
    serialPort = null;
    serialPortReader = null;
    serialPortWriter = null;
    
    safeUpdateElement(document.getElementById('printerStatus'), 'textContent', '❌');
    safeUpdateElement(document.getElementById('printerText'), 'textContent', 'Disconnected');
    safeUpdateElement(document.getElementById('connectBtn'), 'textContent', 'Connect');
    
    const connectBtn = document.getElementById('connectBtn');
    if (connectBtn) connectBtn.onclick = connectPrinter;
    
    disableControlsSafely(['.move-btn', '.home-btn', '#start-calibration-btn']);
}

function safeUpdateElement(element, property, value) {
    try {
        if (element && element[property] !== undefined) {
            element[property] = value;
        }
    } catch (error) {
        console.error('Error updating element:', error);
    }
}

function enableControlsSafely(selectors) {
    try {
        selectors.forEach(selector => {
            const elements = typeof selector === 'string' ? document.querySelectorAll(selector) : [selector];
            elements.forEach(btn => {
                if (btn) btn.disabled = false;
            });
        });
    } catch (error) {
        console.error('Error enabling controls:', error);
    }
}

function disableControlsSafely(selectors) {
    try {
        selectors.forEach(selector => {
            const elements = typeof selector === 'string' ? document.querySelectorAll(selector) : [selector];
            elements.forEach(btn => {
                if (btn) btn.disabled = true;
            });
        });
    } catch (error) {
        console.error('Error disabling controls:', error);
    }
}

async function disconnectPrinter() {
    try {
        if (serialPort) {
            addLogEntry('Disconnecting printer...', 'info');
            
            // Close reader if it exists
            if (serialPortReader) {
                try {
                    await serialPortReader.cancel();
                } catch (cancelError) {
                    console.error('Error canceling reader:', cancelError);
                }
            }
            
            // Close writer if it exists
            if (serialPortWriter) {
                try {
                    serialPortWriter.releaseLock();
                } catch (releaseError) {
                    console.error('Error releasing writer:', releaseError);
                }
            }
            
            // Close the port
            await serialPort.close();
            serialPort = null;
            serialPortReader = null;
            serialPortWriter = null;
            
            // Update UI
            safeUpdateElement(document.getElementById('printerStatus'), 'textContent', '❌');
            safeUpdateElement(document.getElementById('printerText'), 'textContent', 'Disconnected');
            safeUpdateElement(document.getElementById('connectBtn'), 'textContent', 'Connect');
            
            const connectBtn = document.getElementById('connectBtn');
            if (connectBtn) connectBtn.onclick = connectPrinter;
            
            addLogEntry('Printer disconnected', 'received');
            
            // Disable controls
            disableControlsSafely(['.move-btn', '.home-btn', '#start-calibration-btn']);
        }
    } catch (error) {
        handleError('DISCONNECT_ERROR', `Failed to disconnect printer: ${error.message}`, error);
        addLogEntry(`Disconnect error: ${error.message}`, 'error');
    }
}

function checkCalibrationReady() {
    const printerConnected = document.getElementById('printerStatus').textContent === '✅' || testMode.enabled;
    const coneReady = document.getElementById('coneStatus').textContent === '✅' || testMode.enabled;
    
    document.getElementById('startCalibrationBtn').disabled = !(printerConnected && coneReady);
}

function toggleTestMode() {
    testMode.enabled = !testMode.enabled;
    const button = document.getElementById('testModeBtn');
    
    if (testMode.enabled) {
        button.textContent = 'Exit Test Mode';
        button.classList.add('active');
        
        // Simulate printer and cone connection
        document.getElementById('printerStatus').textContent = '🧪';
        document.getElementById('printerText').textContent = 'Test Mode';
        document.getElementById('coneStatus').textContent = '✅';
        document.getElementById('coneText').textContent = 'Simulated';
        
        // Enable controls
        document.querySelectorAll('.move-btn, .home-btn').forEach(btn => {
            btn.disabled = false;
        });
        
        // Enable calibration button immediately in test mode
        document.getElementById('startCalibrationBtn').disabled = false;
        
        // Update position display with test values
        updatePositionDisplay(testMode.position);
        
    } else {
        button.textContent = 'Test Mode';
        button.classList.remove('active');
        
        document.getElementById('printerStatus').textContent = '❌';
        document.getElementById('printerText').textContent = 'Not connected';
        document.getElementById('coneStatus').textContent = '⚠️';
        document.getElementById('coneText').textContent = 'Not positioned';
        
        // Disable controls
        document.querySelectorAll('.move-btn, .home-btn, #start-calibration-btn').forEach(btn => {
            btn.disabled = true;
        });
    }
}

// Global position tracking for both test and real mode
let currentPosition = { x: 0, y: 0, z: 0, a: 0, b: 0 };
let isRelativeMode = false;

function updatePositionFromCommand(command) {
    // Split multi-line commands and process each line
    const commands = command.split('\n').filter(cmd => cmd.trim());
    
    commands.forEach(cmd => {
        cmd = cmd.trim();
        
        // Track relative/absolute mode
        if (cmd === 'G90') {
            isRelativeMode = false;
            testMode.relativeMode = false;
            return;
        }
        if (cmd === 'G91') {
            isRelativeMode = true;
            testMode.relativeMode = true;
            return;
        }
        
        // Use appropriate position source
        const sourcePos = testMode.enabled ? testMode.position : currentPosition;
        const newPos = { ...sourcePos };
        
        // Parse G0/G1 movement commands
        if (/^G[01](\s|$)/.test(cmd)) {
            // Extract coordinates
            const xMatch = cmd.match(/X([-\d.]+)/);
            const yMatch = cmd.match(/Y([-\d.]+)/);
            const zMatch = cmd.match(/Z([-\d.]+)/);
            const aMatch = cmd.match(/A([-\d.]+)/);
            const bMatch = cmd.match(/B([-\d.]+)/);
            
            const relMode = testMode.enabled ? testMode.relativeMode : isRelativeMode;
            
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
            if (testMode.enabled) {
                testMode.position = newPos;
            } else {
                currentPosition = newPos;
            }
            updatePositionDisplay(newPos);
        }
        
        // Handle homing (G28)
        if (/^G28/.test(cmd)) {
            if (cmd === 'G28' || cmd.includes('X')) newPos.x = 0;
            if (cmd === 'G28' || cmd.includes('Y')) newPos.y = 0;
            if (cmd === 'G28' || cmd.includes('Z')) newPos.z = 0;
            if (cmd === 'G28' || cmd.includes('A')) newPos.a = 0;
            if (cmd === 'G28' || cmd.includes('B')) newPos.b = 0;
            
            // Update appropriate position tracker
            if (testMode.enabled) {
                testMode.position = newPos;
            } else {
                currentPosition = newPos;
            }
            updatePositionDisplay(newPos);
        }
    });
}

async function sendCommand(command) {
    // Log the sent command
    addLogEntry(`> ${command}`, 'sent');
    
    // Check if this is a movement command for M114 verification
    const isMovementCommand = /^G[01]\s|^G28/.test(command.trim());
    
    if (testMode.enabled) {
        // Split multiline commands and simulate each separately
        const commands = command.split('\n').filter(cmd => cmd.trim());
        commands.forEach((cmd, index) => {
            setTimeout(() => simulateResponse(cmd.trim()), 100 + (index * 50));
        });
        
        // Auto-request position after movement for real-time updates
        if (isMovementCommand) {
            setTimeout(() => {
                sendCommand('M114');
            }, 200 + (commands.length * 50));
        }
        return;
    }
    
    // Update position immediately based on command (only for real mode)
    updatePositionFromCommand(command);
    
    if (!serialPort) {
        addLogEntry('No printer connected', 'error');
        return;
    }
    
    const encoder = new TextEncoder();
    const writer = serialPort.writable.getWriter();
    await writer.write(encoder.encode(command + '\n'));
    writer.releaseLock();
    
    // Auto-request position after movement for real-time updates
    if (isMovementCommand) {
        setTimeout(async () => {
            const encoder = new TextEncoder();
            const writer = serialPort.writable.getWriter();
            await writer.write(encoder.encode('M114\n'));
            writer.releaseLock();
            addLogEntry('> M114', 'sent');
        }, 500);
    }
}

function simulateResponse(command) {
    
    // Handle mode changes
    if (command === 'G91') {
        testMode.relativeMode = true;
        addLogEntry(`< ok`, 'received');
        return;
    }
    
    if (command === 'G90') {
        testMode.relativeMode = false;
        addLogEntry(`< ok`, 'received');
        return;
    }
    
    // Parse movement commands and update test position
    if (command.includes('G0') || command.includes('G1')) {
        const xMatch = command.match(/X([\d.-]+)/);
        const yMatch = command.match(/Y([\d.-]+)/);
        const zMatch = command.match(/Z([\d.-]+)/);
        const aMatch = command.match(/A([\d.-]+)/);
        const bMatch = command.match(/B([\d.-]+)/);
        
        if (testMode.relativeMode) {
            // Relative movement - ADD to current position
            if (xMatch) testMode.position.x += parseFloat(xMatch[1]);
            if (yMatch) testMode.position.y += parseFloat(yMatch[1]);
            if (zMatch) testMode.position.z += parseFloat(zMatch[1]);
            if (aMatch) testMode.position.a += parseFloat(aMatch[1]);
            if (bMatch) testMode.position.b += parseFloat(bMatch[1]);
        } else {
            // Absolute movement - SET position
            if (xMatch) testMode.position.x = parseFloat(xMatch[1]);
            if (yMatch) testMode.position.y = parseFloat(yMatch[1]);
            if (zMatch) testMode.position.z = parseFloat(zMatch[1]);
            if (aMatch) testMode.position.a = parseFloat(aMatch[1]);
            if (bMatch) testMode.position.b = parseFloat(bMatch[1]);
        }
        
        updatePositionDisplay(testMode.position);
        addLogEntry(`< ok`, 'received');
        return;
    }
    
    // Handle M114 position report
    if (command.includes('M114')) {
        const response = `X:${testMode.position.x.toFixed(2)} Y:${testMode.position.y.toFixed(2)} Z:${testMode.position.z.toFixed(2)} A:${testMode.position.a.toFixed(1)} B:${testMode.position.b.toFixed(1)} Count X:0 Y:0 Z:0`;
        addLogEntry(`< ${response}`, 'received');
        processSerialLine(response);
        return;
    }
    
    // Handle homing
    if (command.includes('G28')) {
        if (command.includes('X')) testMode.position.x = 0;
        if (command.includes('Y')) testMode.position.y = 0;
        if (command.includes('Z')) testMode.position.z = 0;
        if (!command.includes('X') && !command.includes('Y') && !command.includes('Z')) {
            // Home all
            testMode.position.x = 0;
            testMode.position.y = 0;
            testMode.position.z = 0;
        }
        updatePositionDisplay(testMode.position);
        addLogEntry(`< ok`, 'received');
        return;
    }
    
    // Default response for other commands
    addLogEntry(`< ok`, 'received');
}

async function readSerialData() {
    const decoder = new TextDecoder();
    const reader = serialPort.readable.getReader();
    let buffer = '';
    
    try {
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            
            buffer += decoder.decode(value);
            const lines = buffer.split('\n');
            buffer = lines.pop();
            
            for (const line of lines) {
                processSerialLine(line.trim());
            }
        }
    } catch (error) {
    } finally {
        reader.releaseLock();
    }
}

function processSerialLine(line) {
    
    // Log received data
    if (line.trim()) {
        if (line.toLowerCase().includes('error')) {
            addLogEntry(`< ${line}`, 'error');
        } else {
            addLogEntry(`< ${line}`, 'received');
        }
    }
    
    // Parse position responses from M114
    if (line.includes('X:') && line.includes('Y:') && line.includes('Z:')) {
        const match = line.match(/X:([\d.-]+)\s+Y:([\d.-]+)\s+Z:([\d.-]+)/);
        if (match) {
            const position = {
                x: parseFloat(match[1]),
                y: parseFloat(match[2]),
                z: parseFloat(match[3])
            };
            
            // Extract A and B if present
            const aMatch = line.match(/A:([\d.-]+)/);
            const bMatch = line.match(/B:([\d.-]+)/);
            if (aMatch) position.a = parseFloat(aMatch[1]);
            if (bMatch) position.b = parseFloat(bMatch[1]);
            
            // Sync the global currentPosition variable with M114 response
            if (!testMode.enabled) {
                currentPosition = { ...position };
            }
            
            // Always call handlePositionReading to handle both real-time updates and calibration
            handlePositionReading(position);
        }
    }
}

function updatePositionDisplay(position) {
    
    // Update all position displays
    const xElement = document.getElementById('currentX');
    const yElement = document.getElementById('currentY');
    const zElement = document.getElementById('currentZ');
    const aElement = document.getElementById('currentA');
    const bElement = document.getElementById('currentB');
    
    if (xElement) xElement.textContent = position.x.toFixed(2);
    if (yElement) yElement.textContent = position.y.toFixed(2);
    if (zElement) zElement.textContent = position.z.toFixed(2);
    if (aElement && position.a !== undefined) aElement.textContent = position.a.toFixed(1);
    if (bElement && position.b !== undefined) bElement.textContent = position.b.toFixed(1);
    
    // Also update actual position in calibration box if it's visible
    const actualXElement = document.getElementById('actualX');
    const actualYElement = document.getElementById('actualY');
    const actualZElement = document.getElementById('actualZ');
    
    if (actualXElement) actualXElement.textContent = position.x.toFixed(2);
    if (actualYElement) actualYElement.textContent = position.y.toFixed(2);
    if (actualZElement) actualZElement.textContent = position.z.toFixed(2);
}

function startCalibration() {
    calibrationState.isRunning = true;
    calibrationState.currentAxis = 'A';
    calibrationState.currentStep = 0;
    calibrationData.aAxis = [];
    calibrationData.bAxis = [];
    
    
    // Show calibration box
    document.getElementById('calibrationBox').style.display = 'block';
    document.getElementById('startCalibrationBtn').style.display = 'none';
    
    // Set initial instruction
    document.getElementById('calibrationInstruction').innerHTML = 
        '<p style="font-size: 16px; font-weight: 600;">Step 1: Set Reference Position</p>' +
        '<p>Position nozzle tip to touch the cone tip</p>' +
        '<p style="color: #10b981;">This will be the reference (0,0) position</p>';
    
    document.getElementById('currentStep').textContent = 'Reference';
    document.getElementById('currentAAngle').textContent = '0°';
    document.getElementById('currentBAngle').textContent = '0°';
    document.getElementById('expectedX').textContent = '--';
    document.getElementById('expectedY').textContent = '--';
    document.getElementById('expectedZ').textContent = '--';
    
    // Update actual position from current position display
    const currentX = document.getElementById('currentX').textContent;
    const currentY = document.getElementById('currentY').textContent;
    const currentZ = document.getElementById('currentZ').textContent;
    
    document.getElementById('actualX').textContent = currentX;
    document.getElementById('actualY').textContent = currentY;
    document.getElementById('actualZ').textContent = currentZ;
    
    // Move to A0 B0 first
    sendCommand('G0 A0 B0');
}

async function confirmAlignment() {
    if (!calibrationState.isRunning) return;
    
    
    // Request current position and wait for response
    calibrationState.waitingForPosition = true;
    await sendCommand('M114');
}

function handlePositionReading(position) {
    
    // Always update the position display for real-time feedback
    updatePositionDisplay(position);
    
    // Handle calibration position reading only if explicitly waiting for it
    if (calibrationState.waitingForPosition) {
        calibrationState.waitingForPosition = false;
        handlePositionConfirmed(position);
    } else {
    }
}

function handlePositionConfirmed(position) {
    if (!position) {
            return;
    }
    
    
    if (!calibrationData.reference) {
        // First position is the reference (user manually positioned at cone tip)
        calibrationData.reference = position;
        document.getElementById('progressText').textContent = 'Reference position set';
        
        // Reference position is stored in calibrationData.reference
        
        // Start A-axis calibration (moveToAngleWithOffset will handle Z positioning)
        setTimeout(async () => {
            startAxisCalibration('A');
        }, 500);
    } else {
        // Calculate error from expected position
        const angle = calibrationState.currentAxis === 'A' 
            ? calibrationState.angles.A[calibrationState.currentStep]
            : calibrationState.angles.B[calibrationState.currentStep];
            
        const expected = calculateExpectedPosition(angle, calibrationState.currentAxis);
        
        // User manually positions nozzle at actual cone tip after system moves to safe position
        // No Z offset correction needed - use actual confirmed position directly
        const actualPosition = {
            x: position.x,
            y: position.y,
            z: position.z  // Use actual position where user confirmed (at cone tip)
        };
        
        
        // Round positions to 2 decimals to avoid floating point precision issues
        const actualX = Math.round(actualPosition.x * 100) / 100;
        const actualY = Math.round(actualPosition.y * 100) / 100;
        const actualZ = Math.round(actualPosition.z * 100) / 100;
        const expectedX = Math.round(expected.x * 100) / 100;
        const expectedY = Math.round(expected.y * 100) / 100;
        const expectedZ = Math.round(expected.z * 100) / 100;
        
        const error = {
            angle: angle,
            x: actualX - expectedX,
            y: actualY - expectedY,
            z: actualZ - expectedZ,
            actual: { x: actualX, y: actualY, z: actualZ },
            expected: { x: expectedX, y: expectedY, z: expectedZ }
        };
        
        
        if (calibrationState.currentAxis === 'A') {
            calibrationData.aAxis.push(error);
        } else {
            calibrationData.bAxis.push(error);
        }
        
        // Update graphs with new measurement
        updateGraphs();
        
        // Move to next step (moveToAngleWithOffset will handle Z positioning)
        setTimeout(async () => {
            nextCalibrationStep();
        }, 500);
    }
}

function calculateExpectedPosition(angle, axis) {
    const ref = calibrationData.reference;
    const radians = angle * Math.PI / 180;
    
    if (axis === 'A') {
        // A-axis rotation calculation using la
        const la = calibrationData.kinematicParams.la;
        return {
            x: ref.x + la * Math.sin(radians),
            y: ref.y,
            z: ref.z + la * (1 - Math.cos(radians))
        };
    } else {
        // B-axis rotation calculation using lb
        const lb = calibrationData.kinematicParams.lb;
        return {
            x: ref.x,
            y: ref.y + lb * Math.sin(radians),
            z: ref.z + lb * (1 - Math.cos(radians))
        };
    }
}

async function startAxisCalibration(axis) {
    calibrationState.currentAxis = axis;
    calibrationState.currentStep = 0;
    
    
    // Switch to appropriate graph tab when moving to B-axis
    if (axis === 'B') {
        switchToGraphTab('b-axis');
    }
    
    const angle = calibrationState.angles[axis][0];
    await moveToAngleWithOffset(angle, axis);
    
    const expected = calculateExpectedPosition(angle, axis);
    updateCalibrationDisplay(axis, angle, expected);
}

async function moveToAngleWithOffset(angle, axis) {
    
    // Ensure we're in absolute mode
    await sendCommand('G90');
    
    // Move to angle first
    await sendCommand(`G0 ${axis}${angle}`);
    
    // Calculate expected position with Z offset for safety
    const expected = calculateExpectedPosition(angle, calibrationState.currentAxis);
    const finalSafeZ = expected.z + calibrationState.zOffset;
    
    // Move to expected position with Z offset (all in absolute mode)
    await sendCommand(`G0 X${expected.x.toFixed(3)} Y${expected.y.toFixed(3)} Z${finalSafeZ.toFixed(3)}`);
}

function updateCalibrationDisplay(axis, angle, expected) {
    document.getElementById('calibrationInstruction').innerHTML = 
        `<p style="font-size: 16px; font-weight: 600;">${axis}-Axis Calibration</p>` +
        `<p>Position nozzle tip to touch the cone tip</p>` +
        `<p style="color: #3b82f6;">Current angle: ${angle}°</p>`;
    
    document.getElementById('currentStep').textContent = `${axis}-axis`;
    document.getElementById('currentAAngle').textContent = axis === 'A' ? `${angle}°` : '0°';
    document.getElementById('currentBAngle').textContent = axis === 'B' ? `${angle}°` : '0°';
    document.getElementById('expectedX').textContent = expected.x.toFixed(2);
    document.getElementById('expectedY').textContent = expected.y.toFixed(2);
    document.getElementById('expectedZ').textContent = expected.z.toFixed(2);
    
    // Update actual position from current position display
    const currentX = document.getElementById('currentX').textContent;
    const currentY = document.getElementById('currentY').textContent;
    const currentZ = document.getElementById('currentZ').textContent;
    
    document.getElementById('actualX').textContent = currentX;
    document.getElementById('actualY').textContent = currentY;
    document.getElementById('actualZ').textContent = currentZ;
}

async function nextCalibrationStep() {
    calibrationState.currentStep++;
    
    const angles = calibrationState.angles[calibrationState.currentAxis];
    
    if (calibrationState.currentStep >= angles.length) {
        // Finished current axis
        if (calibrationState.currentAxis === 'A') {
            // Move to B-axis
            await sendCommand('G0 A0'); // Reset A to 0
            startAxisCalibration('B');
        } else {
            // Calibration complete
            finishCalibration();
        }
    } else {
        // Continue with next angle
        const angle = angles[calibrationState.currentStep];
        
        // Skip if this angle is the same as reference position (A=0°, B=0°)
        if ((calibrationState.currentAxis === 'A' && angle === 0) || 
            (calibrationState.currentAxis === 'B' && angle === 0)) {
            addLogEntry(`Skipping duplicate ${calibrationState.currentAxis}=${angle}° point (same as reference)`, 'info');
            nextCalibrationStep(); // Recursively call to move to next point
            return;
        }
        
        await moveToAngleWithOffset(angle, calibrationState.currentAxis);
        const expected = calculateExpectedPosition(angle, calibrationState.currentAxis);
        updateCalibrationDisplay(calibrationState.currentAxis, angle, expected);
    }
    
    // Update progress
    const totalSteps = calibrationState.angles.A.length + calibrationState.angles.B.length;
    const currentTotal = calibrationState.currentAxis === 'A' 
        ? calibrationState.currentStep 
        : calibrationState.angles.A.length + calibrationState.currentStep;
    const progress = (currentTotal / totalSteps) * 100;
    
    document.getElementById('calibrationProgress').style.width = `${progress}%`;
    document.getElementById('progressText').textContent = `${Math.round(progress)}% complete`;
}

function skipPoint() {
    if (!calibrationState.isRunning) return;
    
    // Handle reference position skip
    if (!calibrationData.reference) {
        
        // Set a dummy reference position
        calibrationData.reference = { x: 100, y: 100, z: 10 };
        document.getElementById('progressText').textContent = 'Reference position skipped';
        
        // Reference position is stored in calibrationData.reference
        
        // Start A-axis calibration (moveToAngleWithOffset will handle Z positioning)
        setTimeout(async () => {
            startAxisCalibration('A');
        }, 500);
        return;
    }
    
    // Handle regular calibration point skip
    const angle = calibrationState.currentAxis === 'A' 
        ? calibrationState.angles.A[calibrationState.currentStep]
        : calibrationState.angles.B[calibrationState.currentStep];
    
    const error = {
        angle: angle,
        x: 0, y: 0, z: 0,
        actual: { x: 0, y: 0, z: 0 },
        expected: { x: 0, y: 0, z: 0 }
    };
    
    if (calibrationState.currentAxis === 'A') {
        calibrationData.aAxis.push(error);
    } else {
        calibrationData.bAxis.push(error);
    }
    
    // Move to next step (moveToAngleWithOffset will handle Z positioning)
    setTimeout(async () => {
        nextCalibrationStep();
    }, 500);
}

function finishCalibration() {
    calibrationState.isRunning = false;
    
    // Hide calibration box, show control button
    document.getElementById('calibrationBox').style.display = 'none';
    document.getElementById('startCalibrationBtn').style.display = 'block';
    
    // Enable export
    document.getElementById('exportResultsBtn').disabled = false;
    
    // Reset to 0 positions
    sendCommand('G0 A0 B0');
    
    document.getElementById('progressText').textContent = 'Calibration complete!';
    document.getElementById('calibrationProgress').style.width = '100%';
    
    // Calculate and display final statistics
    updateErrorStatistics();
}


function updateErrorStatistics() {
    const allErrors = [...calibrationData.aAxis, ...calibrationData.bAxis];
    
    if (allErrors.length === 0) return;
    
    const xErrors = allErrors.map(e => Math.abs(e.x));
    const yErrors = allErrors.map(e => Math.abs(e.y));
    const zErrors = allErrors.map(e => Math.abs(e.z));
    
    const maxX = Math.max(...xErrors);
    const maxY = Math.max(...yErrors);
    const maxZ = Math.max(...zErrors);
    
    const rms = Math.sqrt(allErrors.reduce((sum, e) => 
        sum + e.x*e.x + e.y*e.y + e.z*e.z, 0) / allErrors.length);
    
    document.getElementById('maxXError').textContent = maxX.toFixed(3);
    document.getElementById('maxYError').textContent = maxY.toFixed(3);
    document.getElementById('maxZError').textContent = maxZ.toFixed(3);
    document.getElementById('rmsError').textContent = rms.toFixed(3);
}

function exportResults() {
    const results = {
        timestamp: new Date().toISOString(),
        kinematicParams: calibrationData.kinematicParams,
        reference: calibrationData.reference,
        zOffset: calibrationState.zOffset,
        aAxisErrors: calibrationData.aAxis,
        bAxisErrors: calibrationData.bAxis,
        statistics: calculateStatistics()
    };
    
    const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rep5x-cone-calibration-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function calculateStatistics() {
    const stats = {
        aAxis: { maxX: 0, maxY: 0, maxZ: 0, rms: 0 },
        bAxis: { maxX: 0, maxY: 0, maxZ: 0, rms: 0 }
    };
    
    // A-axis stats
    if (calibrationData.aAxis.length > 0) {
        calibrationData.aAxis.forEach(point => {
            stats.aAxis.maxX = Math.max(stats.aAxis.maxX, Math.abs(point.x));
            stats.aAxis.maxY = Math.max(stats.aAxis.maxY, Math.abs(point.y));
            stats.aAxis.maxZ = Math.max(stats.aAxis.maxZ, Math.abs(point.z));
        });
        
        const sumSquares = calibrationData.aAxis.reduce((sum, point) => {
            return sum + point.x**2 + point.y**2 + point.z**2;
        }, 0);
        stats.aAxis.rms = Math.sqrt(sumSquares / (calibrationData.aAxis.length * 3));
    }
    
    // B-axis stats
    if (calibrationData.bAxis.length > 0) {
        calibrationData.bAxis.forEach(point => {
            stats.bAxis.maxX = Math.max(stats.bAxis.maxX, Math.abs(point.x));
            stats.bAxis.maxY = Math.max(stats.bAxis.maxY, Math.abs(point.y));
            stats.bAxis.maxZ = Math.max(stats.bAxis.maxZ, Math.abs(point.z));
        });
        
        const sumSquares = calibrationData.bAxis.reduce((sum, point) => {
            return sum + point.x**2 + point.y**2 + point.z**2;
        }, 0);
        stats.bAxis.rms = Math.sqrt(sumSquares / (calibrationData.bAxis.length * 3));
    }
    
    return stats;
}

function getStepSize() {
    try {
        const activeBtn = document.querySelector('.step-btn.active');
        if (activeBtn && activeBtn.dataset && activeBtn.dataset.step) {
            const stepSize = parseFloat(activeBtn.dataset.step);
            if (!isNaN(stepSize) && stepSize > 0 && stepSize <= 100) {
                return stepSize;
            }
        }
        
        const customInput = document.getElementById('moveDistance');
        if (customInput && customInput.value) {
            const customValue = parseFloat(customInput.value);
            if (!isNaN(customValue) && customValue > 0 && customValue <= 100) {
                return customValue;
            }
        }
        
        // Return safe default
        return 1.0;
        
    } catch (error) {
        addLogEntry(`Error getting step size: ${error.message}`, 'warning');
        return 1.0; // Safe default
    }
}

// Log management functions
function addLogEntry(message, type = 'default') {
    try {
        if (!message) return;
        
        const logContainer = document.getElementById('gcodeLog');
        if (!logContainer) {
            console.warn('Log container not found');
            return;
        }
        
        const entry = document.createElement('div');
        entry.className = `log-entry ${type}`;
        
        // Add timestamp
        const timestamp = new Date().toLocaleTimeString();
        entry.textContent = `[${timestamp}] ${String(message)}`;
        
        logContainer.appendChild(entry);
        
        // Auto scroll if enabled
        if (logState && logState.autoScroll) {
            logContainer.scrollTop = logContainer.scrollHeight;
        }
        
        // Limit log entries to prevent memory issues
        const entries = logContainer.children;
        if (entries.length > 500) {
            try {
                logContainer.removeChild(entries[0]);
            } catch (removeError) {
                // If removal fails, clear some entries
                while (entries.length > 400) {
                    try {
                        logContainer.removeChild(entries[0]);
                    } catch (e) {
                        break;
                    }
                }
            }
        }
        
    } catch (error) {
        console.error('Error adding log entry:', error);
        console.log(`[${new Date().toLocaleTimeString()}] ${message}`);
    }
}

function clearLog() {
    const logContainer = document.getElementById('gcodeLog');
    logContainer.innerHTML = '<div class="log-entry">Log cleared</div>';
}

function toggleAutoScroll() {
    const button = document.getElementById('autoScrollBtn');
    logState.autoScroll = !logState.autoScroll;
    
    if (logState.autoScroll) {
        button.classList.add('active');
        button.textContent = 'Auto Scroll';
        
        // Scroll to bottom immediately
        const logContainer = document.getElementById('gcodeLog');
        logContainer.scrollTop = logContainer.scrollHeight;
    } else {
        button.classList.remove('active');
        button.textContent = 'Manual Scroll';
    }
}

function sendManualGcode() {
    const input = document.getElementById('manualGcodeInput');
    const command = input.value.trim();
    
    if (command === '') {
        addLogEntry('Please enter a G-code command', 'error');
        return;
    }
    
    // Send the command using existing sendCommand function
    sendCommand(command);
    
    // Clear the input field
    input.value = '';
}

function handleGcodeInputKeypress(event) {
    if (event.key === 'Enter') {
        sendManualGcode();
    }
}

// Utility function to get cookie/localStorage
function getCookie(name) {
    // Try localStorage first (better for file:// protocol)
    const localValue = localStorage.getItem(name);
    if (localValue !== null) {
        return localValue;
    }
    
    // Fallback to cookies
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
        const cookieValue = parts.pop().split(';').shift();
        return cookieValue;
    }
    
    return null;
}

// Graph plotting functions (from camera.js)
function initializeGraphs() {
    // Initialize graph tabs
    const graphTabs = document.querySelectorAll('.graph-tab');
    graphTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const graphType = tab.dataset.graph;
            switchToGraphTab(graphType);
        });
    });
    
    // Draw initial empty graphs
    drawGraph('a-axis-graph');
    drawGraph('b-axis-graph');
}

function switchToGraphTab(graphType) {
    // Update tab states
    document.querySelectorAll('.graph-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelector(`[data-graph="${graphType}"]`).classList.add('active');
    
    // Show/hide canvases
    document.getElementById('aAxisGraph').style.display = graphType === 'a-axis' ? 'block' : 'none';
    document.getElementById('bAxisGraph').style.display = graphType === 'b-axis' ? 'block' : 'none';
}

function drawGraph(canvasId, maxError = 5) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Draw grid
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    
    // Vertical lines
    for (let i = 0; i <= 10; i++) {
        const x = (width / 10) * i;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
    }
    
    // Horizontal lines
    for (let i = 0; i <= 5; i++) {
        const y = (height / 5) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
    }
    
    // Draw center line
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
    
    // Add Y-axis labels
    ctx.fillStyle = '#6b7280';
    ctx.font = '12px system-ui';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    
    // Draw scale labels
    for (let i = 0; i <= 5; i++) {
        const y = (height / 5) * i;
        const errorValue = maxError - (i * (maxError * 2 / 5)); // Scale from +maxError to -maxError
        const label = errorValue.toFixed(1) + 'mm';
        
        ctx.fillText(label, width - 5, y);
    }
}

function updateGraphs() {
    updateAxisGraph('a-axis-graph', calibrationData.aAxis, calibrationState.angles.A);
    updateAxisGraph('b-axis-graph', calibrationData.bAxis, calibrationState.angles.B);
}

function updateAxisGraph(canvasId, data, angleRange) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // Filter out skipped points - only plot actual measurements
    const filteredData = data.filter(point => !point.skipped);
    
    // Calculate scale
    const minAngle = Math.min(...angleRange);
    const maxAngle = Math.max(...angleRange);
    const angleSpan = maxAngle - minAngle;
    
    let maxError = 0;
    if (filteredData.length > 0) {
        filteredData.forEach(point => {
            maxError = Math.max(maxError, Math.abs(point.x), Math.abs(point.y), Math.abs(point.z));
        });
    }
    maxError = Math.max(maxError, 1); // Minimum scale of 1mm
    
    // Redraw base grid with proper scale
    drawGraph(canvasId, maxError);
    
    if (filteredData.length === 0) return;
    
    // Draw error points and lines
    const colors = {
        x: '#ef4444',
        y: '#10b981',
        z: '#3b82f6'
    };
    
    ['x', 'y', 'z'].forEach(axis => {
        // Check if this axis has any non-zero errors
        const hasNonZeroError = filteredData.some(point => 
            point.hasOwnProperty(axis) && Math.abs(point[axis]) > 0.001);
        if (!hasNonZeroError) {
            return; // Skip plotting this axis if all errors are zero
        }
        
        ctx.strokeStyle = colors[axis];
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        // Convert filtered data to screen coordinates, skip points without this axis
        const points = filteredData.filter(point => point.hasOwnProperty(axis)).map(point => ({
            x: ((point.angle - minAngle) / angleSpan) * width,
            y: height / 2 - (point[axis] / maxError) * (height / 2 - 20)
        }));
        
        if (points.length > 0) {
            // Start the path
            ctx.moveTo(points[0].x, points[0].y);
            
            if (points.length > 2) {
                // Draw smooth curve through points using quadratic curves
                for (let i = 1; i < points.length - 1; i++) {
                    const xc = (points[i].x + points[i + 1].x) / 2;
                    const yc = (points[i].y + points[i + 1].y) / 2;
                    ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
                }
                // Draw final segment
                ctx.quadraticCurveTo(
                    points[points.length - 1].x, 
                    points[points.length - 1].y, 
                    points[points.length - 1].x, 
                    points[points.length - 1].y
                );
            } else if (points.length === 2) {
                // Simple line for 2 points
                ctx.lineTo(points[1].x, points[1].y);
            }
            
            ctx.stroke();
            
            // Draw points
            ctx.fillStyle = colors[axis];
            points.forEach(point => {
                ctx.beginPath();
                ctx.arc(point.x, point.y, 3, 0, 2 * Math.PI);
                ctx.fill();
            });
        }
    });
    
    // Draw labels
    ctx.fillStyle = '#374151';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    
    // Angle labels
    ctx.fillText(`${minAngle}°`, 20, height - 5);
    ctx.fillText(`${maxAngle}°`, width - 20, height - 5);
    
}