// Camera Calibration Script
let serialPort = null;
let camera = null;
let serialPortReader = null;
let serialPortWriter = null;

// Error handling constants
const ERROR_TYPES = {
    SERIAL_PORT_IN_USE: 'SERIAL_PORT_IN_USE',
    SERIAL_DISCONNECTED: 'SERIAL_DISCONNECTED',
    CAMERA_PERMISSION_DENIED: 'CAMERA_PERMISSION_DENIED',
    CAMERA_STREAM_ERROR: 'CAMERA_STREAM_ERROR',
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
    TEST_B: 0
};

// UI constants
const UI_CONFIG = {
    LOG_AUTO_SCROLL: true
};
let calibrationData = {
    reference: null,
    aAxis: [],
    bAxis: [],
    zCalibration: {
        reference: null,
        aAxis: [],
        bAxis: []
    },
    kinematicParams: {
        la: 0,
        lb: 0
    }
};

let calibrationState = {
    isRunning: false,
    zCalibrationRunning: false,
    currentAxis: 'A',
    currentStep: 0,
    waitingForPosition: false,
    angles: {
        A: CALIBRATION_ANGLES.A_AXIS,
        B: CALIBRATION_ANGLES.B_AXIS
    }
};

let logState = {
    autoScroll: UI_CONFIG.LOG_AUTO_SCROLL
};

// Global position tracking for both test and real mode
let currentPosition = { x: 0, y: 0, z: 0, a: 0, b: 0 };
let isRelativeMode = false;

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

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    try {
        loadKinematicParams();
        initializeUI();
        initializeGraphs();
        
        // Start position sync timer with error handling
        setInterval(() => {
            try {
                syncActualPositions();
            } catch (error) {
                console.error('Position sync error:', error);
            }
        }, 500);
        
        // Add global error handler
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
    event.preventDefault(); // Prevent default browser behavior
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
    
    // Log to UI
    addLogEntry(`ERROR [${errorType}]: ${message}`, 'error');
    
    // Handle specific error types
    switch (errorType) {
        case ERROR_TYPES.SERIAL_PORT_IN_USE:
            addLogEntry('Try disconnecting and reconnecting the printer', 'warning');
            break;
        case ERROR_TYPES.CAMERA_PERMISSION_DENIED:
            addLogEntry('Please allow camera access and refresh the page', 'warning');
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
        // Keep only essential data, clear the rest
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
            
            // Additional validation for reasonable ranges
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
                sendCommand('G28 X Y');
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
    
    // Camera button
    document.getElementById('startCameraBtn').addEventListener('click', startCamera);
    
    // Log controls
    document.getElementById('clearLogBtn').addEventListener('click', clearLog);
    document.getElementById('autoScrollBtn').addEventListener('click', toggleAutoScroll);
    
    // Manual G-code input
    document.getElementById('sendGcodeBtn').addEventListener('click', sendManualGcode);
    document.getElementById('manualGcodeInput').addEventListener('keypress', handleGcodeInputKeypress);
    
    // Test mode button
    document.getElementById('testModeBtn').addEventListener('click', toggleTestMode);
    
    // Calibration control
    document.getElementById('zCalibrationBtn').addEventListener('click', showZCalibrationOptions);
    document.getElementById('zAAxisBtn').addEventListener('click', startAAxisZCalibration);
    document.getElementById('zBAxisBtn').addEventListener('click', startBAxisZCalibration);
    document.getElementById('startCalibrationBtn').addEventListener('click', startCalibration);
    document.getElementById('confirmAlignmentBtn').addEventListener('click', confirmAlignment);
    document.getElementById('skipPointBtn').addEventListener('click', skipPoint);
    document.getElementById('exportResultsBtn').addEventListener('click', exportResults);
    
    // Graph tabs
    const graphTabs = document.querySelectorAll('.graph-tab');
    graphTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            graphTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            const aGraph = document.getElementById('aAxisGraph');
            const bGraph = document.getElementById('bAxisGraph');
            
            if (tab.dataset.graph === 'a-axis') {
                aGraph.style.display = 'block';
                bGraph.style.display = 'none';
            } else {
                aGraph.style.display = 'none';
                bGraph.style.display = 'block';
            }
        });
    });
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
        
        addLogEntry('Printer connected successfully', 'received');
        
        // Enable movement controls safely
        enableControlsSafely(['.move-btn', '#home-all-btn', '#home-xy-btn']);
        
        // Enable calibration if camera is active or test mode is enabled
        if (camera || testMode.enabled) {
            enableControlsSafely(['#z-calibration-btn', '#start-calibration-btn']);
        }
        
        // Set up disconnect handler
        serialPort.addEventListener('disconnect', handleSerialDisconnect);
        
        readSerialData();
        
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
    
    // Update UI to show disconnected state
    safeUpdateElement(document.getElementById('printerStatus'), 'textContent', '❌');
    safeUpdateElement(document.getElementById('printerText'), 'textContent', 'Disconnected');
    safeUpdateElement(document.getElementById('connectBtn'), 'textContent', 'Connect');
    
    const connectBtn = document.getElementById('connectBtn');
    if (connectBtn) connectBtn.onclick = connectPrinter;
    
    // Disable controls
    disableControlsSafely(['.move-btn', '#home-all-btn', '#home-xy-btn', '#z-calibration-btn', '#start-calibration-btn']);
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
            disableControlsSafely(['.move-btn', '#home-all-btn', '#home-xy-btn', '#z-calibration-btn', '#start-calibration-btn']);
        }
    } catch (error) {
        handleError('DISCONNECT_ERROR', `Failed to disconnect printer: ${error.message}`, error);
        addLogEntry(`Disconnect error: ${error.message}`, 'error');
    }
}

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

async function sendCommand(command, timeout = TIMEOUTS.COMMAND_RESPONSE) {
    try {
        // Validate command
        if (!command || typeof command !== 'string') {
            throw new Error('Invalid command: must be a non-empty string');
        }
        
        const trimmedCommand = command.trim();
        if (!trimmedCommand) {
            throw new Error('Invalid command: command is empty after trimming');
        }
        
        // Log the sent command
        addLogEntry(`> ${trimmedCommand}`, 'sent');
        
        // Update position immediately based on command
        updatePositionFromCommand(trimmedCommand);
        
        // Check if this is a movement command for M114 verification
        const isMovementCommand = /^G[01]\s|^G28/.test(trimmedCommand);
        
        if (testMode.enabled) {
            return handleTestModeCommand(trimmedCommand, isMovementCommand);
        }
        
        if (!serialPort) {
            throw new Error('No printer connected');
        }
        
        if (!serialPort.writable) {
            throw new Error('Serial port not writable - connection may be lost');
        }
        
        // Send command with timeout protection
        await Promise.race([
            sendCommandToSerial(trimmedCommand),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Command timeout')), timeout)
            )
        ]);
        
        // Auto-request position after movement for real-time updates
        if (isMovementCommand) {
            setTimeout(async () => {
                try {
                    await sendPositionRequest();
                } catch (error) {
                    addLogEntry(`Position request failed: ${error.message}`, 'error');
                }
            }, 500);
        }
        
    } catch (error) {
        handleError('COMMAND_SEND_ERROR', `Failed to send command '${command}': ${error.message}`, error);
        addLogEntry(`Command send error: ${error.message}`, 'error');
    }
}

async function sendCommandToSerial(command) {
    try {
        const encoder = new TextEncoder();
        const writer = serialPort.writable.getWriter();
        
        try {
            await writer.write(encoder.encode(command + '\n'));
        } finally {
            writer.releaseLock();
        }
    } catch (error) {
        if (error.name === 'InvalidStateError') {
            handleError(ERROR_TYPES.SERIAL_DISCONNECTED, 'Serial port disconnected during command send', error);
        }
        throw error;
    }
}

async function sendPositionRequest() {
    if (!serialPort || !serialPort.writable) {
        throw new Error('Serial port not available for position request');
    }
    
    const encoder = new TextEncoder();
    const writer = serialPort.writable.getWriter();
    
    try {
        await writer.write(encoder.encode('M114\n'));
        addLogEntry('> M114', 'sent');
    } finally {
        writer.releaseLock();
    }
}

function handleTestModeCommand(command, isMovementCommand) {
    try {
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
    } catch (error) {
        addLogEntry(`Test mode command error: ${error.message}`, 'error');
    }
}

async function readSerialData() {
    let reader = null;
    let buffer = '';
    
    try {
        if (!serialPort || !serialPort.readable) {
            throw new Error('Serial port not available for reading');
        }
        
        const decoder = new TextDecoder();
        reader = serialPort.readable.getReader();
        serialPortReader = reader;
        
        addLogEntry('Started reading serial data', 'info');
        
        while (true) {
            const { value, done } = await reader.read();
            
            if (done) {
                addLogEntry('Serial stream ended', 'info');
                break;
            }
            
            if (!value) continue;
            
            try {
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // Keep incomplete line in buffer
                
                for (const line of lines) {
                    const trimmedLine = line.trim();
                    if (trimmedLine) {
                        processSerialLine(trimmedLine);
                    }
                }
            } catch (decodeError) {
                addLogEntry(`Serial decode error: ${decodeError.message}`, 'error');
                buffer = ''; // Reset buffer on decode error
            }
        }
        
    } catch (error) {
        if (error.name === 'NetworkError') {
            handleError(ERROR_TYPES.SERIAL_DISCONNECTED, 'Serial device disconnected', error);
        } else {
            handleError('SERIAL_READ_ERROR', `Serial read error: ${error.message}`, error);
        }
    } finally {
        if (reader) {
            try {
                reader.releaseLock();
            } catch (releaseError) {
                console.error('Error releasing reader:', releaseError);
            }
        }
        serialPortReader = null;
    }
}

function processSerialLine(line) {
    try {
        if (!line || typeof line !== 'string') {
            return;
        }
        
        const trimmedLine = line.trim();
        if (!trimmedLine) {
            return;
        }
        
        // Log received data
        if (trimmedLine.toLowerCase().includes('error')) {
            addLogEntry(`< ${trimmedLine}`, 'error');
        } else {
            addLogEntry(`< ${trimmedLine}`, 'received');
        }
        
        // Parse position responses from M114
        if (trimmedLine.includes('X:') && trimmedLine.includes('Y:') && trimmedLine.includes('Z:')) {
            try {
                const position = parsePositionResponse(trimmedLine);
                if (position) {
                    // Sync the global currentPosition variable with M114 response
                    if (!testMode.enabled) {
                        currentPosition = { ...position };
                    }
                    
                    updatePositionDisplay(position);
                    
                    // Handle calibration position reading
                    if (calibrationState.waitingForPosition) {
                        calibrationState.waitingForPosition = false;
                        handlePositionReading(position);
                    }
                }
            } catch (parseError) {
                handleError(ERROR_TYPES.MALFORMED_RESPONSE, 
                    `Failed to parse position response: ${parseError.message}`, 
                    { line: trimmedLine, error: parseError });
            }
        }
        
        // Check for specific error responses
        if (trimmedLine.toLowerCase().includes('unknown command')) {
            addLogEntry('Printer reported unknown command', 'warning');
        }
        
    } catch (error) {
        handleError('SERIAL_PROCESS_ERROR', `Error processing serial line: ${error.message}`, 
            { line, error });
    }
}

function parsePositionResponse(line) {
    const xMatch = line.match(/X:([\d.-]+)/);
    const yMatch = line.match(/Y:([\d.-]+)/);
    const zMatch = line.match(/Z:([\d.-]+)/);
    
    if (!xMatch || !yMatch || !zMatch) {
        throw new Error('Incomplete position data in response');
    }
    
    const x = parseFloat(xMatch[1]);
    const y = parseFloat(yMatch[1]);
    const z = parseFloat(zMatch[1]);
    
    if (isNaN(x) || isNaN(y) || isNaN(z)) {
        throw new Error(`Invalid numeric values: x=${xMatch[1]}, y=${yMatch[1]}, z=${zMatch[1]}`);
    }
    
    const position = { x, y, z };
    
    // Extract A and B if present
    const aMatch = line.match(/A:([\d.-]+)/);
    const bMatch = line.match(/B:([\d.-]+)/);
    
    if (aMatch) {
        const a = parseFloat(aMatch[1]);
        if (!isNaN(a)) position.a = a;
    }
    
    if (bMatch) {
        const b = parseFloat(bMatch[1]);
        if (!isNaN(b)) position.b = b;
    }
    
    return position;
}

function updatePositionDisplay(position) {
    try {
        if (!position || typeof position !== 'object') {
            return;
        }
        
        const elements = {
            'currentX': { value: position.x, decimals: 2 },
            'currentY': { value: position.y, decimals: 2 },
            'currentZ': { value: position.z, decimals: 2 },
            'current-a': { value: position.a, decimals: 1 },
            'current-b': { value: position.b, decimals: 1 }
        };
        
        Object.entries(elements).forEach(([id, config]) => {
            try {
                const element = document.getElementById(id);
                if (element && config.value !== undefined && !isNaN(config.value)) {
                    element.textContent = config.value.toFixed(config.decimals);
                }
            } catch (error) {
                console.error(`Error updating element ${id}:`, error);
            }
        });
        
    } catch (error) {
        console.error('Error updating position display:', error);
    }
}

function toggleTestMode() {
    testMode.enabled = !testMode.enabled;
    const button = document.getElementById('testModeBtn');
    
    if (testMode.enabled) {
        button.textContent = 'Exit Test Mode';
        button.classList.add('active');
        
        // Simulate printer connection
        document.getElementById('printerStatus').textContent = '🧪';
        document.getElementById('printerText').textContent = 'Test Mode';
        
        // Enable controls
        document.querySelectorAll('.move-btn, .home-btn').forEach(btn => {
            btn.disabled = false;
        });
        
        // Enable calibration buttons immediately in test mode
        document.getElementById('zCalibrationBtn').disabled = false;
        document.getElementById('startCalibrationBtn').disabled = false;
        
        addLogEntry('Test mode enabled - commands will be simulated', 'received');
        
        // Update position display with test values
        updatePositionDisplay(testMode.position);
        
    } else {
        button.textContent = 'Test Mode';
        button.classList.remove('active');
        
        document.getElementById('printerStatus').textContent = '❌';
        document.getElementById('printerText').textContent = 'Not connected';
        
        // Disable controls
        document.querySelectorAll('.move-btn, .home-btn, #z-calibration-btn, #start-calibration-btn').forEach(btn => {
            btn.disabled = true;
        });
        
        addLogEntry('Test mode disabled', 'received');
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
    
    // Don't process empty commands
    if (!command.trim()) {
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
            if (xMatch) {
                const moveAmount = parseFloat(xMatch[1]);
                testMode.position.x += moveAmount;
            }
            if (yMatch) {
                const moveAmount = parseFloat(yMatch[1]);
                testMode.position.y += moveAmount;
            }
            if (zMatch) {
                const moveAmount = parseFloat(zMatch[1]);
                testMode.position.z += moveAmount;
            }
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

async function startCamera() {
    const statusIcon = document.getElementById('cameraStatus');
    const statusText = document.getElementById('cameraText');
    const startBtn = document.getElementById('startCameraBtn');
    const video = document.getElementById('cameraFeed');
    
    try {
        // Check if MediaDevices API is supported
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('Camera API not supported in this browser');
        }
        
        // Check if video element exists
        if (!video) {
            throw new Error('Camera feed element not found');
        }
        
        addLogEntry('Requesting camera access...', 'info');
        
        const constraints = {
            video: { 
                width: { ideal: 1280, min: 640 },
                height: { ideal: 720, min: 480 },
                facingMode: 'environment'
            }
        };
        
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        // Verify stream is active
        if (!stream || !stream.active) {
            throw new Error('Camera stream is not active');
        }
        
        // Set up stream error handler
        stream.addEventListener('inactive', handleCameraStreamInactive);
        
        video.srcObject = stream;
        camera = stream;
        
        // Update UI safely
        safeUpdateElement(statusIcon, 'textContent', '✅');
        safeUpdateElement(statusText, 'textContent', 'Active');
        safeUpdateElement(startBtn, 'textContent', 'Stop Camera');
        if (startBtn) startBtn.onclick = stopCamera;
        
        // Add active class to camera container safely
        const container = document.querySelector('.camera-container');
        if (container) {
            container.classList.add('camera-active');
        }
        
        // Enable calibration if printer is connected or test mode is enabled
        if (serialPort || testMode.enabled) {
            enableControlsSafely(['#z-calibration-btn', '#start-calibration-btn']);
        }
        
        addLogEntry('Camera started successfully', 'received');
        
    } catch (error) {
        const errorType = error.name === 'NotAllowedError' ? ERROR_TYPES.CAMERA_PERMISSION_DENIED :
                         error.name === 'NotFoundError' ? 'CAMERA_NOT_FOUND' :
                         error.name === 'NotReadableError' ? 'CAMERA_IN_USE' :
                         ERROR_TYPES.CAMERA_STREAM_ERROR;
        
        handleError(errorType, `Camera failed: ${error.message}`, error);
        
        safeUpdateElement(statusIcon, 'textContent', '❌');
        
        const errorText = error.name === 'NotAllowedError' ? 'Permission denied' :
                         error.name === 'NotFoundError' ? 'No camera found' :
                         error.name === 'NotReadableError' ? 'Camera in use' :
                         'Access failed';
        
        safeUpdateElement(statusText, 'textContent', errorText);
        addLogEntry(`Camera error: ${error.message}`, 'error');
    }
}

function handleCameraStreamInactive(event) {
    addLogEntry('Camera stream became inactive', 'warning');
    camera = null;
    
    // Update UI to show camera is no longer active
    safeUpdateElement(document.getElementById('cameraStatus'), 'textContent', '❌');
    safeUpdateElement(document.getElementById('cameraText'), 'textContent', 'Inactive');
    safeUpdateElement(document.getElementById('startCameraBtn'), 'textContent', 'Start Camera');
    
    const startBtn = document.getElementById('startCameraBtn');
    if (startBtn) startBtn.onclick = startCamera;
    
    const container = document.querySelector('.camera-container');
    if (container) {
        container.classList.remove('camera-active');
    }
}

function stopCamera() {
    if (camera) {
        camera.getTracks().forEach(track => track.stop());
        camera = null;
        
        const video = document.getElementById('cameraFeed');
        video.srcObject = null;
        
        document.getElementById('cameraStatus').textContent = '❌';
        document.getElementById('cameraText').textContent = 'Inactive';
        document.getElementById('startCameraBtn').textContent = 'Start Camera';
        document.getElementById('startCameraBtn').onclick = startCamera;
        
        // Remove active class
        const container = document.querySelector('.camera-container');
        container.classList.remove('camera-active');
        
        // Disable calibration
        document.getElementById('zCalibrationBtn').disabled = true;
        document.getElementById('startCalibrationBtn').disabled = true;
    }
}

function startCalibration() {
    calibrationState.isRunning = true;
    calibrationState.currentAxis = 'A';
    calibrationState.currentStep = 0;
    calibrationData.aAxis = [];
    calibrationData.bAxis = [];
    
    // Ensure crosshair mode for XY calibration
    setCameraOverlayMode('crosshair');
    
    // Hide Z calibration box if it's open and show XY calibration box
    document.getElementById('zCalibrationBox').style.display = 'none';
    document.getElementById('calibrationBox').style.display = 'block';
    
    // Now disable buttons during active calibration
    document.getElementById('zCalibrationBtn').disabled = true;
    document.getElementById('startCalibrationBtn').disabled = true;
    
    // Set initial instruction
    document.getElementById('calibrationInstruction').innerHTML = 
        '<p style="font-size: 16px; font-weight: 600;">Step 1: Set Reference Position</p>' +
        '<p>Align the nozzle with the center crosshair</p>' +
        '<p style="color: #10b981;">This will be the reference (0,0) position</p>';
    
    document.getElementById('currentStep').textContent = 'Reference';
    document.getElementById('currentAngle').textContent = '0°';
    document.getElementById('expectedX').textContent = '--';
    document.getElementById('expectedY').textContent = '--';
    
    // Initialize actual position with current values
    const currentX = document.getElementById('currentX').textContent;
    const currentY = document.getElementById('currentY').textContent;
    document.getElementById('actualX').textContent = currentX;
    document.getElementById('actualY').textContent = currentY;
    
    // Move to A0 B0 first
    sendCommand('G0 A0 B0');
}

function showZCalibrationOptions() {
    // Show Z calibration box with axis selection
    document.getElementById('zCalibrationBox').style.display = 'block';
    // DON'T disable buttons - user should be able to switch to XY calibration
    // document.getElementById('zCalibrationBtn').disabled = true;
    // document.getElementById('startCalibrationBtn').disabled = true;
}

async function startAAxisZCalibration() {
    if (calibrationState.zCalibrationRunning) return;
    
    calibrationState.zCalibrationRunning = true;
    calibrationState.currentAxis = 'A';
    calibrationState.currentStep = 0;
    calibrationData.zCalibration.aAxis = [];
    
    // Hide axis selection, show progress
    document.getElementById('zCalibrationStatus').style.display = 'block';
    document.getElementById('zCalibrationInfo').style.display = 'block';
    document.querySelector('.z-calibration-buttons').style.display = 'none';
    
    // Lock all movement buttons and disable calibration buttons during active Z calibration
    setMovementButtonsLocked(true);
    document.getElementById('zCalibrationBtn').disabled = true;
    document.getElementById('startCalibrationBtn').disabled = true;
    
    // Update UI to show A-axis Z calibration is running
    document.getElementById('progressText').textContent = 'A-axis Z calibration running...';
    document.getElementById('calibrationProgress').style.width = '0%';
    
    // First home Z to establish bed surface as Z=0
    await sendCommand('G28 Z');
    addLogEntry('Z axis homed - bed surface is now Z=0', 'received');
    
    // Start with A0 B0 to get reference Z
    await sendCommand('G0 A0 B0');
    await performZCalibrationAt(0, 'A', true); // true = is reference
}

async function startBAxisZCalibration() {
    if (calibrationState.zCalibrationRunning) return;
    
    calibrationState.zCalibrationRunning = true;
    calibrationState.currentAxis = 'B';
    calibrationState.currentStep = 0;
    calibrationData.zCalibration.bAxis = [];
    
    // Keep Z calibration box visible, hide axis selection buttons
    document.querySelector('.z-calibration-buttons').style.display = 'none';
    // Hide the status information during camera setup
    document.getElementById('zCalibrationStatus').style.display = 'none';
    
    // Disable calibration buttons during active B-axis calibration
    document.getElementById('zCalibrationBtn').disabled = true;
    document.getElementById('startCalibrationBtn').disabled = true;
    
    // Show camera repositioning instruction
    document.getElementById('zCalibrationInstruction').innerHTML = 
        '<h4 style="color: #f59e0b;">⚠️ Camera Setup Required</h4>' +
        '<p><strong>Position camera sideways</strong> (perpendicular to B-axis rotation)</p>' +
        '<p>View should show nozzle from the side for Z height measurement</p>' +
        '<button id="continue-b-axis-btn" class="primary-btn" style="margin-top: 10px;">Continue with B-axis</button>';
    
    // Add event listener for continue button
    document.getElementById('continueBAxisBtn').addEventListener('click', startBAxisZMeasurements);
}

async function performZCalibrationAt(angle, axis, isReference = false) {
    
    // Update display
    const totalSteps = calibrationState.angles.A.length + calibrationState.angles.B.length;
    const currentTotal = axis === 'A' 
        ? calibrationState.currentStep 
        : calibrationState.angles.A.length + calibrationState.currentStep;
    const progress = (currentTotal / totalSteps) * 100;
    
    document.getElementById('calibrationProgress').style.width = `${progress}%`;
    document.getElementById('progressText').textContent = 
        `Z calibration: ${axis}${angle}° (${Math.round(progress)}%)`;
    
    // Step 1: Move Z up to safe height (10mm above bed)
    await sendCommand('G0 Z10');
    
    // Step 2: Move to angle and expected X/Y position
    await sendCommand(`G0 ${axis}${angle}`);
    
    const expected = calculateExpectedPosition(angle, axis);
    await sendCommand(`G0 X${expected.x.toFixed(3)} Y${expected.y.toFixed(3)}`);
    
    // Update test mode position for visual feedback
    if (testMode.enabled) {
        if (axis === 'A') {
            testMode.position.a = angle;
        } else {
            testMode.position.b = angle;
        }
        testMode.position.x = expected.x;
        testMode.position.y = expected.y;
        testMode.position.z = 10; // At safe height before probing
        updatePositionDisplay(testMode.position);
    }
    
    // Update Z calibration display
    updateZCalibrationDisplay(axis, angle, expected, isReference);
    
    // Step 3: Perform Z probe - probe down to bed surface
    if (testMode.enabled) {
        // Simulate realistic Z probing down to bed
        addLogEntry(`> G30 (Z probe to bed)`, 'sent');
        addLogEntry(`< Probing down to bed surface...`, 'received');
        
        // Simulate some manufacturing errors and mechanical play
        let simulatedError = 0;
        if (!isReference) {
            // Create realistic error patterns based on angle
            const radians = angle * Math.PI / 180;
            
            if (axis === 'A') {
                // A-axis might have some backlash and gravitational effects
                simulatedError = Math.sin(radians) * 0.3 + Math.cos(radians * 2) * 0.1;
            } else {
                // B-axis might have different error characteristics
                simulatedError = Math.sin(radians * 1.5) * 0.2 + (Math.random() - 0.5) * 0.15;
            }
            
            // Add some random measurement noise
            simulatedError += (Math.random() - 0.5) * 0.05;
        }
        
        // In real probing, we would expect to touch the bed at Z=0, but errors cause deviation
        const simulatedZ = 0 + simulatedError;
        
        // Update test mode position to show probe result
        testMode.position.z = simulatedZ;
        updatePositionDisplay(testMode.position);
        
        addLogEntry(`< Bed contact at Z=${simulatedZ.toFixed(3)}mm`, 'received');
        addLogEntry(`< ok`, 'received');
        
        // Update the Z actual display immediately with probed value
        document.getElementById('zActualZ').textContent = simulatedZ.toFixed(2);
        
        setTimeout(() => {
            handleZCalibrationResult(angle, axis, expected, simulatedZ, isReference);
        }, 1500);
    } else {
        // Real probe - probe down to bed surface
        await sendCommand('G30'); // Probe down to bed
        await sendCommand('M114'); // Get position after probe
        // In real mode, the position reading would trigger handleZCalibrationResult
        // For now, simulate with Z=0 (perfect bed contact)
        setTimeout(() => {
            handleZCalibrationResult(angle, axis, expected, 0, isReference);
        }, 2000);
    }
}

function handleZCalibrationResult(angle, axis, expected, actualZ, isReference) {
    // Update display with actual probed Z value
    document.getElementById('zActualZ').textContent = actualZ.toFixed(2);
    
    if (isReference) {
        // Store reference Z for comparison
        calibrationData.zCalibration.reference = { z: actualZ };
        addLogEntry(`Z reference set at A0 B0: ${actualZ.toFixed(3)}mm`, 'received');
        
        // Start A-axis calibration after reference is set
        calibrationState.currentAxis = 'A';
        calibrationState.currentStep = 0;
        const firstAngle = calibrationState.angles.A[0];
        setTimeout(() => {
            performZCalibrationAt(firstAngle, 'A');
        }, 500);
    } else {
        // Calculate Z error
        const referenceZ = calibrationData.zCalibration.reference.z;
        const expectedRelativeZ = expected.z - calculateExpectedPosition(0, 'A').z; // Relative to A0 B0
        const actualRelativeZ = actualZ - referenceZ;
        const zError = actualRelativeZ - expectedRelativeZ;
        
        const errorData = {
            angle: angle,
            x: 0, // Only measuring Z in this calibration
            y: 0,
            z: zError,
            actual: { x: expected.x, y: expected.y, z: actualZ },
            expected: expected
        };
        
        if (axis === 'A') {
            calibrationData.zCalibration.aAxis.push(errorData);
        } else {
            calibrationData.zCalibration.bAxis.push(errorData);
        }
        
        addLogEntry(`Z measurement ${axis}${angle}°: error ${zError.toFixed(2)}mm`, 'received');
        
        // Update graphs with new Z calibration data
        updateGraphs();
        
        // Continue to next measurement
        nextZCalibrationStep();
    }
}

async function nextZCalibrationStep() {
    calibrationState.currentStep++;
    
    const angles = calibrationState.angles[calibrationState.currentAxis];
    
    if (calibrationState.currentStep >= angles.length) {
        // Finished current axis
        // A-axis Z calibration complete - just finish, don't auto-start B-axis
        finishZCalibration();
    } else {
        // Continue with next angle
        const angle = angles[calibrationState.currentStep];
        performZCalibrationAt(angle, calibrationState.currentAxis);
    }
}

async function startBAxisZMeasurements() {
    // DON'T lock movement buttons - user needs Z controls for manual adjustment
    // setMovementButtonsLocked(true);
    
    // Switch camera to horizontal line mode
    setCameraOverlayMode('horizontal');
    
    // Switch to B-axis graph tab for Z calibration
    switchToGraphTab('b-axis');
    
    // Update progress
    document.getElementById('progressText').textContent = 'B-axis Z calibration starting...';
    document.getElementById('calibrationProgress').style.width = '0%';
    
    // Show zero point setting step first
    showBAxisZeroPointSetting();
}

async function moveToBAxisZPosition(angle) {
    // Lock A-axis at 0 for consistent perspective
    await sendCommand('G0 A0');
    
    // Move to B angle and expected position
    await sendCommand(`G0 B${angle}`);
    
    const expected = calculateExpectedPosition(angle, 'B');
    await sendCommand(`G0 X${expected.x.toFixed(3)} Y${expected.y.toFixed(3)} Z${expected.z.toFixed(3)}`);
    
    // Update test mode position
    if (testMode.enabled) {
        testMode.position.a = 0;
        testMode.position.b = angle;
        testMode.position.x = expected.x;
        testMode.position.y = expected.y;
        testMode.position.z = expected.z;
        updatePositionDisplay(testMode.position);
    }
    
    // Update Z calibration display for B-axis manual measurement
    updateBAxisZCalibrationDisplay(angle, expected);
}

function updateBAxisZCalibrationDisplay(angle, expected) {
    // Update Z calibration instruction (without buttons)
    document.getElementById('zCalibrationInstruction').innerHTML = 
        '<h4>B-axis Z Calibration (Manual)</h4>' +
        '<p><strong>Adjust Z position</strong> until nozzle underside aligns with green line</p>' +
        '<p style="color: #3b82f6;">Use Z movement controls on the right</p>' +
        '<p style="color: #6b7280;">A-axis locked at 0° for consistent perspective</p>';
    
    // Update Z calibration status
    document.getElementById('zCalibrationStatus').style.display = 'block';
    document.getElementById('zCurrentStep').textContent = 'B-axis Z';
    document.getElementById('zCurrentAngle').textContent = `B${angle}°`;
    
    // Show expected position for B-axis measurements
    document.getElementById('zExpectedZ').parentElement.style.display = 'block';
    document.getElementById('zExpectedZ').textContent = expected.z.toFixed(2);
    
    // Update actual Z position from Current Position container (ensure 2 decimals)
    const currentZ = document.getElementById('currentZ').textContent;
    const currentZFloat = parseFloat(currentZ);
    document.getElementById('zActualZ').textContent = isNaN(currentZFloat) ? currentZ : currentZFloat.toFixed(2);
    
    // Update buttons for B-axis measurements (replace zero point buttons)
    const buttonsContainer = document.querySelector('.z-calibration-buttons');
    buttonsContainer.style.display = 'block';
    buttonsContainer.innerHTML = 
        '<button id="confirm-b-z-btn" class="primary-btn">Confirm Z Position</button>' +
        '<button id="skip-b-z-btn" class="secondary-btn">Skip Point</button>';
    
    // Add event listeners for new buttons
    document.getElementById('confirmBZBtn').addEventListener('click', confirmBAxisZPosition);
    document.getElementById('skipBZBtn').addEventListener('click', skipBAxisZPosition);
    
    // Update progress
    const totalSteps = calibrationState.angles.B.length;
    const progress = ((calibrationState.currentStep + 1) / totalSteps) * 100;
    document.getElementById('calibrationProgress').style.width = `${progress}%`;
    document.getElementById('progressText').textContent = `B-axis Z calibration: ${Math.round(progress)}%`;
}

async function showBAxisZeroPointSetting() {
    // First move nozzle to green line position (at B=0, A=0)
    await sendCommand('G0 A0 B0'); // Ensure at 0,0 position
    
    // Get current position and move slightly above the bed for green line alignment
    if (testMode.enabled) {
        // In test mode, position at a reasonable Z height for green line
        await sendCommand('G0 Z45'); // Move to green line level
    } else {
        // In real mode, move to a safe position above bed
        await sendCommand('G0 Z45'); // Move to green line level
    }
    
    // Update instruction to show zero point setting
    document.getElementById('zCalibrationInstruction').innerHTML = 
        '<p><strong>Set B-axis Z Reference Point</strong></p>' +
        '<p>Use Z movement controls to position nozzle underside on the green line</p>' +
        '<p style="color: #6b7280; font-size: 0.9rem;">This will be Z=0 for B-axis measurements</p>';
    
    // Update status info
    document.getElementById('zCalibrationStatus').style.display = 'block';
    document.getElementById('zCurrentStep').textContent = 'Setting reference';
    document.getElementById('zCurrentAngle').textContent = 'B=0°';
    
    // Hide expected position, show actual position
    document.getElementById('zExpectedZ').parentElement.style.display = 'none';
    document.getElementById('zActualZ').parentElement.style.display = 'block';
    
    // Force initial position update
    setTimeout(() => {
        const currentZ = document.getElementById('currentZ').textContent;
        document.getElementById('zActualZ').textContent = currentZ;
    }, 1000); // Wait 1 second for position to update
    
    // Update buttons for zero point setting
    const buttonsContainer = document.querySelector('.z-calibration-buttons');
    buttonsContainer.style.display = 'block'; // Make sure buttons are visible
    buttonsContainer.innerHTML = 
        '<button id="set-b-zero-btn" class="primary-btn">Set Current Z as Reference</button>';
    
    // Add event listeners
    document.getElementById('setBZeroBtn').addEventListener('click', setBAxisZeroPoint);
}

async function setBAxisZeroPoint() {
    // Get current position
    const response = await sendCommand('M114');
    
    if (testMode.enabled) {
        // In test mode, use simulated position
        calibrationData.zCalibration.bAxisReference = {
            z: testMode.position.z
        };
        addLogEntry(`B-axis Z reference set to Z=${testMode.position.z.toFixed(3)}mm (test mode)`, 'received');
    } else {
        // Parse real position from M114 response
        const zMatch = response.match(/Z:([+-]?\d*\.?\d+)/);
        if (zMatch) {
            const currentZ = parseFloat(zMatch[1]);
            calibrationData.zCalibration.bAxisReference = {
                z: currentZ
            };
            addLogEntry(`B-axis Z reference set to Z=${currentZ.toFixed(3)}mm`, 'received');
        } else {
            addLogEntry('Failed to get current Z position for reference', 'error');
            return;
        }
    }
    
    // Start actual B-axis measurements
    proceedToBAxisMeasurements();
}

function skipBAxisCalibration() {
    addLogEntry('B-axis Z calibration skipped', 'info');
    finishZCalibration();
}

async function proceedToBAxisMeasurements() {
    // Now start with first B-axis angle
    calibrationState.currentStep = 0;
    const firstAngle = calibrationState.angles.B[0];
    await moveToBAxisZPosition(firstAngle);
}

function finishZCalibration() {
    calibrationState.zCalibrationRunning = false;
    
    // Switch back to crosshair mode
    setCameraOverlayMode('crosshair');
    
    // Keep Z calibration box open, hide XY calibration box
    document.getElementById('calibrationBox').style.display = 'none';
    
    // Reset Z calibration UI to show axis selection again
    document.getElementById('zCalibrationStatus').style.display = 'none';
    document.getElementById('zCalibrationInfo').style.display = 'none';
    document.querySelector('.z-calibration-buttons').style.display = 'block';
    
    // Reset instruction to original state
    document.getElementById('zCalibrationInstruction').innerHTML = 
        '<p>Choose calibration method for each axis:</p>' +
        '<p style="color: #6b7280; font-size: 0.9rem;">A-axis: Automated probing | B-axis: Manual with camera</p>';
    
    // Unlock movement buttons
    setMovementButtonsLocked(false);
    
    // Re-enable calibration buttons
    document.getElementById('zCalibrationBtn').disabled = false;
    document.getElementById('startCalibrationBtn').disabled = false;
    
    // Update progress
    document.getElementById('calibrationProgress').style.width = '100%';
    
    if (calibrationState.currentAxis === 'A') {
        document.getElementById('progressText').textContent = 'A-axis Z calibration complete! Ready for B-axis or XY calibration.';
        addLogEntry('A-axis Z calibration completed - ready for B-axis or XY calibration', 'received');
    } else {
        document.getElementById('progressText').textContent = 'B-axis Z calibration complete! Ready for XY calibration.';
        addLogEntry('B-axis Z calibration completed - ready for XY calibration', 'received');
    }
    
    // Reset to home position
    sendCommand('G0 A0 B0');
    
    // Update graphs to show Z calibration data
    updateGraphs();
}

function updateZCalibrationDisplay(axis, angle, expected, isReference) {
    if (isReference) {
        document.getElementById('zCalibrationInstruction').innerHTML = 
            '<p style="font-size: 16px; font-weight: 600;">Setting Z Reference</p>' +
            '<p>Probing bed at A0 B0 position</p>' +
            '<p style="color: #10b981;">This will be the Z baseline</p>';
        
        document.getElementById('zCurrentStep').textContent = 'Z Reference';
        document.getElementById('zCurrentAngle').textContent = 'A0 B0';
    } else {
        document.getElementById('zCalibrationInstruction').innerHTML = 
            `<p style="font-size: 16px; font-weight: 600;">Z Calibration - ${axis}-Axis</p>` +
            `<p>Automatic Z probing in progress...</p>` +
            `<p style="color: #3b82f6;">Measuring at ${axis}${angle}°</p>`;
        
        document.getElementById('zCurrentStep').textContent = `Z ${axis}-axis`;
        document.getElementById('zCurrentAngle').textContent = `${axis}${angle}°`;
    }
    
    // Show only Z for expected and actual position during Z calibration
    document.getElementById('zExpectedZ').textContent = expected.z.toFixed(2);
    
    // Set actual Z to "--" during probing, will be updated when probe completes
    if (!isReference) {
        document.getElementById('zActualZ').textContent = '-- (probing...)';
    } else {
        document.getElementById('zActualZ').textContent = '-- (setting reference)';
    }
}

async function confirmAlignment() {
    if (!calibrationState.isRunning) return;
    
    // Request current position via M114
    calibrationState.waitingForPosition = true;
    await sendCommand('M114');
}

function handlePositionReading(position) {
    // Check if we're in Z calibration mode for B-axis
    if (calibrationState.zCalibrationRunning && calibrationState.currentAxis === 'B') {
        handleBAxisZCalibration(position);
        return;
    }
    
    if (!calibrationData.reference) {
        // First position is the reference
        calibrationData.reference = position;
        document.getElementById('progressText').textContent = 'Reference position set';
        
        // Start A-axis calibration
        startAxisCalibration('A');
    } else {
        // Calculate error from expected position
        const angle = calibrationState.currentAxis === 'A' 
            ? calibrationState.angles.A[calibrationState.currentStep]
            : calibrationState.angles.B[calibrationState.currentStep];
            
        const expected = calculateExpectedPosition(angle, calibrationState.currentAxis);
        // Round positions to 2 decimals to avoid floating point precision issues
        const actualX = Math.round(position.x * 100) / 100;
        const actualY = Math.round(position.y * 100) / 100;
        const expectedX = Math.round(expected.x * 100) / 100;
        const expectedY = Math.round(expected.y * 100) / 100;
        
        const error = {
            angle: angle,
            x: actualX - expectedX,
            y: actualY - expectedY,
            // XY calibration: don't include Z at all - it will be filtered out in graph plotting
            actual: { x: actualX, y: actualY },
            expected: { x: expectedX, y: expectedY }
        };
        
        if (calibrationState.currentAxis === 'A') {
            calibrationData.aAxis.push(error);
        } else {
            calibrationData.bAxis.push(error);
        }
        
        // Update graphs
        updateGraphs();
        
        // Move to next step
        nextCalibrationStep();
    }
}

function handleBAxisZCalibration(position) {
    const angle = calibrationState.angles.B[calibrationState.currentStep];
    const expected = calculateExpectedPosition(angle, 'B');
    
    // For B-axis Z calibration, we only care about Z error
    // Round to 2 decimals to avoid floating point precision issues
    const actualZ = Math.round(position.z * 100) / 100;
    const expectedZ = Math.round(expected.z * 100) / 100;
    const zError = actualZ - expectedZ;
    
    
    const errorData = {
        angle: angle,
        x: 0, // Not measuring X/Y in Z calibration
        y: 0,
        z: zError,
        actual: position,
        expected: expected
    };
    
    calibrationData.zCalibration.bAxis.push(errorData);
    
    addLogEntry(`B-axis Z measurement B${angle}°: Z error ${zError.toFixed(2)}mm`, 'received');
    
    // Update graphs with new B-axis Z calibration data
    updateGraphs();
    
    // Update progress
    const totalSteps = calibrationState.angles.B.length;
    const progress = ((calibrationState.currentStep + 1) / totalSteps) * 100;
    document.getElementById('calibrationProgress').style.width = `${progress}%`;
    document.getElementById('progressText').textContent = `B-axis Z calibration: ${Math.round(progress)}%`;
    
    // Move to next B-axis step
    nextBAxisZCalibrationStep();
}

async function confirmBAxisZPosition() {
    // Get current position and calculate error
    calibrationState.waitingForPosition = true;
    await sendCommand('M114');
}

function skipBAxisZPosition() {
    // Add dummy data point with zero error
    const angle = calibrationState.angles.B[calibrationState.currentStep];
    const expected = calculateExpectedPosition(angle, 'B');
    
    const errorData = {
        angle: angle,
        x: 0,
        y: 0,
        z: 0, // Zero error for skipped point
        actual: expected,
        expected: expected,
        skipped: true  // Mark as skipped
    };
    
    calibrationData.zCalibration.bAxis.push(errorData);
    addLogEntry(`Skipped B-axis Z measurement B${angle}°`, 'received');
    
    nextBAxisZCalibrationStep();
}

async function nextBAxisZCalibrationStep() {
    calibrationState.currentStep++;
    
    if (calibrationState.currentStep >= calibrationState.angles.B.length) {
        // B-axis Z calibration complete
        finishZCalibration();
    } else {
        // Move to next B angle
        const angle = calibrationState.angles.B[calibrationState.currentStep];
        await moveToBAxisZPosition(angle);
    }
}

function calculateExpectedPosition(angle, axis) {
    try {
        // Validate inputs
        if (typeof angle !== 'number' || isNaN(angle)) {
            throw new Error(`Invalid angle: ${angle}`);
        }
        
        if (axis !== 'A' && axis !== 'B') {
            throw new Error(`Invalid axis: ${axis}`);
        }
        
        // Use XY calibration reference if available, otherwise use a default reference for Z calibration
        const ref = calibrationData.reference || { x: 100, y: 100, z: 50 };
        
        // Validate reference position
        if (!ref || typeof ref.x !== 'number' || typeof ref.y !== 'number' || typeof ref.z !== 'number') {
            throw new Error('Invalid reference position');
        }
        
        const la = calibrationData.kinematicParams.la;
        const lb = calibrationData.kinematicParams.lb;
        
        // Validate kinematic parameters
        if (typeof la !== 'number' || typeof lb !== 'number' || isNaN(la) || isNaN(lb)) {
            throw new Error(`Invalid kinematic parameters: la=${la}, lb=${lb}`);
        }
        
        if (la < 0 || lb <= 0) {
            throw new Error(`Invalid kinematic parameter ranges: la=${la}, lb=${lb}`);
        }
    
        // Current angles (other axis stays at 0)
        let A_prime, B_prime;
        if (axis === 'A') {
            A_prime = angle * Math.PI / 180;
            B_prime = 0;
        } else {
            A_prime = 0;
            B_prime = angle * Math.PI / 180;
        }
        
        // Validate angle conversion
        if (isNaN(A_prime) || isNaN(B_prime)) {
            throw new Error(`Angle conversion failed: angle=${angle}, A_prime=${A_prime}, B_prime=${B_prime}`);
        }
        
        // Apply the kinematic formulas from the image
        let expectedZ;
        if (calibrationState.zCalibrationRunning) {
            if (axis === 'B' && calibrationData.zCalibration.bAxisReference) {
                // For B-axis Z calibration, use the user-set reference point
                const refZ = calibrationData.zCalibration.bAxisReference.z;
                if (typeof refZ !== 'number' || isNaN(refZ)) {
                    throw new Error(`Invalid B-axis reference Z: ${refZ}`);
                }
                expectedZ = refZ + Math.cos(B_prime) * lb - lb;
            } else {
                // For A-axis Z calibration, use bed as reference (Z=0)
                expectedZ = 0 + Math.cos(B_prime) * lb - lb;
            }
        } else {
            // For XY calibration, use kinematic formula with reference position
            expectedZ = ref.z + Math.cos(B_prime) * lb - lb;
        }
        
        // Calculate position using kinematic formulas
        const x = ref.x + Math.sin(A_prime) * la + Math.cos(A_prime) * Math.sin(B_prime) * lb;
        const y = ref.y - la + Math.cos(A_prime) * la - Math.sin(A_prime) * Math.sin(B_prime) * lb;
        const z = expectedZ;
        
        // Validate calculated positions
        if (isNaN(x) || isNaN(y) || isNaN(z)) {
            throw new Error(`Kinematic calculation resulted in NaN: x=${x}, y=${y}, z=${z}`);
        }
        
        return { x, y, z };
        
    } catch (error) {
        handleError('KINEMATIC_CALCULATION_ERROR', 
            `Failed to calculate expected position for ${axis}${angle}°: ${error.message}`, 
            { angle, axis, error });
        
        // Return a safe default position
        return { x: 100, y: 100, z: 50 };
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
    await moveToAngle(angle, axis);
    
    // Small delay to ensure movement completes before updating display
    await new Promise(resolve => setTimeout(resolve, 200));
    const expected = calculateExpectedPosition(angle, axis);
    updateCalibrationDisplay(axis, angle, expected);
}

async function moveToAngle(angle, axis) {
    // Move to angle
    await sendCommand(`G0 ${axis}${angle}`);
    
    // Calculate expected position and move nozzle there
    const expected = calculateExpectedPosition(angle, axis);
    // For XY calibration: only move X/Y, let Z follow kinematics naturally
    // Z will automatically adjust based on the kinematic formula to maintain height
    await sendCommand(`G0 X${expected.x.toFixed(3)} Y${expected.y.toFixed(3)}`);
}

function updateCalibrationDisplay(axis, angle, expected) {
    document.getElementById('calibrationInstruction').innerHTML = 
        `<p style="font-size: 16px; font-weight: 600;">${axis}-Axis Calibration</p>` +
        `<p>Align the nozzle with the center crosshair</p>` +
        `<p style="color: #3b82f6;">Current angle: ${angle}°</p>`;
    
    document.getElementById('currentStep').textContent = `${axis}-axis`;
    document.getElementById('currentAngle').textContent = `${angle}°`;
    
    // Show only X/Y for expected position during XY calibration
    document.getElementById('expectedX').textContent = expected.x.toFixed(2);
    document.getElementById('expectedY').textContent = expected.y.toFixed(2);
    
    // Update actual position from current position display
    const currentX = document.getElementById('currentX').textContent;
    const currentY = document.getElementById('currentY').textContent;
    
    document.getElementById('actualX').textContent = currentX;
    document.getElementById('actualY').textContent = currentY;
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
        
        await moveToAngle(angle, calibrationState.currentAxis);
        // Small delay to ensure movement completes before updating display
        await new Promise(resolve => setTimeout(resolve, 200));
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
    
    // Add a dummy point with zero error and mark it as skipped
    const angle = calibrationState.currentAxis === 'A' 
        ? calibrationState.angles.A[calibrationState.currentStep]
        : calibrationState.angles.B[calibrationState.currentStep];
    
    const error = {
        angle: angle,
        x: 0, y: 0, z: 0,
        actual: { x: 0, y: 0, z: 0 },
        expected: { x: 0, y: 0, z: 0 },
        skipped: true  // Mark as skipped so we can exclude from graphs
    };
    
    if (calibrationState.currentAxis === 'A') {
        calibrationData.aAxis.push(error);
    } else {
        calibrationData.bAxis.push(error);
    }
    
    nextCalibrationStep();
}

function finishCalibration() {
    calibrationState.isRunning = false;
    
    // Hide calibration box, show control button
    document.getElementById('calibrationBox').style.display = 'none';
    document.getElementById('startCalibrationBtn').style.display = 'block';
    
    // Re-enable calibration buttons
    document.getElementById('zCalibrationBtn').disabled = false;
    document.getElementById('startCalibrationBtn').disabled = false;
    
    // Enable export
    document.getElementById('exportResultsBtn').disabled = false;
    
    // Reset to 0 positions
    sendCommand('G0 A0 B0');
    
    document.getElementById('progressText').textContent = 'Calibration complete!';
    document.getElementById('calibrationProgress').style.width = '100%';
}

function initializeGraphs() {
    drawGraph('aAxisGraph');
    drawGraph('bAxisGraph');
}

function drawGraph(canvasId) {
    const canvas = document.getElementById(canvasId);
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
}

function updateGraphs() {
    // Merge Z calibration data with XY calibration data
    const aAxisData = mergeCalibrationData(calibrationData.aAxis, calibrationData.zCalibration.aAxis);
    const bAxisData = mergeCalibrationData(calibrationData.bAxis, calibrationData.zCalibration.bAxis);
    
    updateAxisGraph('aAxisGraph', aAxisData, calibrationState.angles.A);
    updateAxisGraph('bAxisGraph', bAxisData, calibrationState.angles.B);
}

function mergeCalibrationData(xyData, zData) {
    // If no Z calibration data, return XY data as is
    if (!zData || zData.length === 0) {
        return xyData;
    }
    
    // If no XY data, return Z data with X/Y errors as 0
    if (!xyData || xyData.length === 0) {
        return zData;
    }
    
    // Merge both datasets - use Z from Z calibration, X/Y from XY calibration
    const merged = [];
    
    // For each angle, find corresponding data points
    const allAngles = [...new Set([
        ...xyData.map(d => d.angle),
        ...zData.map(d => d.angle)
    ])].sort((a, b) => a - b);
    
    allAngles.forEach(angle => {
        const xyPoint = xyData.find(d => d.angle === angle);
        const zPoint = zData.find(d => d.angle === angle);
        
        if (xyPoint && zPoint) {
            // Both available - merge them
            merged.push({
                angle: angle,
                x: xyPoint.x,
                y: xyPoint.y,
                z: zPoint.z,
                actual: xyPoint.actual,
                expected: xyPoint.expected
            });
        } else if (xyPoint) {
            // Only XY available - don't add Z property at all for XY calibration
            merged.push({
                ...xyPoint
                // Deliberately not adding z: 0 - let XY calibration data remain Z-free
            });
        } else if (zPoint) {
            // Only Z available - keep Z, set X/Y to 0
            merged.push({
                ...zPoint,
                x: 0,
                y: 0
            });
        }
    });
    
    return merged;
}

function updateAxisGraph(canvasId, data, angleRange) {
    const canvas = document.getElementById(canvasId);
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // Redraw base grid
    drawGraph(canvasId);
    
    // Filter out skipped points - only plot actual measurements
    const filteredData = data.filter(point => !point.skipped);
    
    if (filteredData.length === 0) return;
    
    // Calculate scale
    const minAngle = Math.min(...angleRange);
    const maxAngle = Math.max(...angleRange);
    const angleSpan = maxAngle - minAngle;
    
    let maxError = 0;
    filteredData.forEach(point => {
        maxError = Math.max(maxError, Math.abs(point.x), Math.abs(point.y), Math.abs(point.z));
    });
    maxError = maxError || 1; // Prevent division by zero
    
    // Draw error points and lines
    const colors = {
        x: '#ef4444',
        y: '#10b981',
        z: '#3b82f6'
    };
    
    ['x', 'y', 'z'].forEach(axis => {
        // For XY calibration data, skip Z axis entirely
        const isXYCalibrationData = filteredData.some(point => 
            point.hasOwnProperty('x') && point.hasOwnProperty('y') && 
            !point.hasOwnProperty('z'));
        
        if (isXYCalibrationData && axis === 'z') {
            return; // Skip Z axis for XY calibration data
        }
        
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
            } else {
                // For 2 or fewer points, just draw straight lines
                points.forEach((point, index) => {
                    if (index > 0) ctx.lineTo(point.x, point.y);
                });
            }
            
            ctx.stroke();
            
            // Draw data points on top of the smooth line
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
    
    // Error labels
    ctx.textAlign = 'right';
    ctx.fillText(`+${maxError.toFixed(1)}mm`, width - 5, 15);
    ctx.fillText(`-${maxError.toFixed(1)}mm`, width - 5, height - 5);
}

function exportResults() {
    const results = {
        timestamp: new Date().toISOString(),
        kinematicParams: calibrationData.kinematicParams,
        reference: calibrationData.reference,
        aAxisErrors: calibrationData.aAxis,
        bAxisErrors: calibrationData.bAxis,
        statistics: calculateStatistics()
    };
    
    const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rep5x-calibration-${new Date().toISOString().split('T')[0]}.json`;
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
        
        // Add timestamp safely
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
        // Try to log to console as fallback
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

// Utility function to get cookie with error handling
function getCookie(name) {
    try {
        if (!name || typeof name !== 'string') {
            throw new Error('Invalid cookie name');
        }
        
        // Try localStorage first (better for file:// protocol)
        try {
            const localValue = localStorage.getItem(name);
            if (localValue !== null) {
                return localValue;
            }
        } catch (storageError) {
            // localStorage might be disabled or full
            addLogEntry(`localStorage access failed: ${storageError.message}`, 'warning');
        }
        
        // Fallback to cookies
        try {
            const value = `; ${document.cookie}`;
            const parts = value.split(`; ${name}=`);
            if (parts.length === 2) {
                const cookieValue = parts.pop().split(';').shift();
                return cookieValue;
            }
        } catch (cookieError) {
            addLogEntry(`Cookie access failed: ${cookieError.message}`, 'warning');
        }
        
        return null;
    } catch (error) {
        handleError('STORAGE_READ_ERROR', `Failed to get cookie '${name}': ${error.message}`, error);
        return null;
    }
}

// Utility function to set cookie with error handling
function setCookie(name, value, days = 365) {
    try {
        if (!name || typeof name !== 'string') {
            throw new Error('Invalid cookie name');
        }
        
        if (value === null || value === undefined) {
            throw new Error('Invalid cookie value');
        }
        
        const valueStr = String(value);
        
        // Try localStorage first
        try {
            localStorage.setItem(name, valueStr);
        } catch (storageError) {
            if (storageError.name === 'QuotaExceededError') {
                handleError(ERROR_TYPES.STORAGE_QUOTA_EXCEEDED, 'localStorage quota exceeded', storageError);
            } else {
                addLogEntry(`localStorage write failed: ${storageError.message}`, 'warning');
            }
        }
        
        // Also set cookie as backup
        try {
            const expires = new Date();
            expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
            document.cookie = `${name}=${valueStr};expires=${expires.toUTCString()};path=/`;
        } catch (cookieError) {
            addLogEntry(`Cookie write failed: ${cookieError.message}`, 'warning');
        }
        
    } catch (error) {
        handleError('STORAGE_WRITE_ERROR', `Failed to set cookie '${name}': ${error.message}`, error);
    }
}

// Sync actual position displays with Current Position container
function syncActualPositions() {
    const currentX = document.getElementById('currentX').textContent;
    const currentY = document.getElementById('currentY').textContent;
    const currentZ = document.getElementById('currentZ').textContent;
    
    // Update XY calibration actual positions (X and Y only)
    const actualXElement = document.getElementById('actualX');
    const actualYElement = document.getElementById('actualY');
    
    if (actualXElement && !actualXElement.textContent.includes('--')) {
        actualXElement.textContent = currentX;
    }
    if (actualYElement && !actualYElement.textContent.includes('--')) {
        actualYElement.textContent = currentY;
    }
    
    // Update Z calibration actual positions
    const zActualElement = document.getElementById('zActualZ');
    if (zActualElement && !zActualElement.textContent.includes('--') && !zActualElement.textContent.includes('probing')) {
        zActualElement.textContent = currentZ;
    }
}

// Graph tab switching function
function switchToGraphTab(tabName) {
    const graphTabs = document.querySelectorAll('.graph-tab');
    const aGraph = document.getElementById('aAxisGraph');
    const bGraph = document.getElementById('bAxisGraph');
    
    // Update tab active states
    graphTabs.forEach(tab => {
        tab.classList.remove('active');
        if (tab.dataset.graph === tabName) {
            tab.classList.add('active');
        }
    });
    
    // Show appropriate graph
    if (tabName === 'a-axis') {
        aGraph.style.display = 'block';
        bGraph.style.display = 'none';
    } else if (tabName === 'b-axis') {
        aGraph.style.display = 'none';
        bGraph.style.display = 'block';
    }
}

// Camera overlay mode functions
function setCameraOverlayMode(mode) {
    const crosshairH = document.querySelector('.crosshair-horizontal');
    const crosshairV = document.querySelector('.crosshair-vertical');
    const zLine = document.querySelector('.z-reference-line');
    const instruction = document.getElementById('cameraInstruction');
    
    if (mode === 'horizontal') {
        // Show only horizontal line for Z calibration
        crosshairH.style.display = 'none';
        crosshairV.style.display = 'none';
        zLine.style.display = 'block';
        instruction.textContent = 'Align nozzle underside with green horizontal line';
    } else {
        // Show crosshair for XY calibration (default)
        crosshairH.style.display = 'block';
        crosshairV.style.display = 'block';
        zLine.style.display = 'none';
        instruction.textContent = 'Position nozzle at center of crosshair';
    }
}

// Movement button lock functionality
function setMovementButtonsLocked(locked) {
    const buttons = document.querySelectorAll('.move-btn, .home-btn, .step-btn, #move-distance');
    buttons.forEach(btn => {
        btn.disabled = locked;
        if (locked) {
            btn.style.opacity = '0.5';
            btn.style.cursor = 'not-allowed';
        } else {
            btn.style.opacity = '';
            btn.style.cursor = '';
        }
    });
    
    // Also disable confirm and skip buttons during probing
    const calibrationButtons = document.querySelectorAll('#confirm-alignment-btn, #skip-point-btn');
    calibrationButtons.forEach(btn => {
        btn.disabled = locked;
        if (locked) {
            btn.style.opacity = '0.5';
            btn.style.cursor = 'not-allowed';
        } else {
            btn.style.opacity = '';
            btn.style.cursor = '';
        }
    });
}