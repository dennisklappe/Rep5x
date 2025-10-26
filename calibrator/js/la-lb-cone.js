// Cone La/Lb Measurement Script
let serialPort = null;
let serialPortReader = null;
let serialPortWriter = null;

// Error handling constants
const ERROR_TYPES = {
    SERIAL_PORT_IN_USE: 'SERIAL_PORT_IN_USE',
    SERIAL_DISCONNECTED: 'SERIAL_DISCONNECTED',
    STORAGE_QUOTA_EXCEEDED: 'STORAGE_QUOTA_EXCEEDED',
    TIMEOUT_ERROR: 'TIMEOUT_ERROR',
    MALFORMED_RESPONSE: 'MALFORMED_RESPONSE',
    CALCULATION_ERROR: 'CALCULATION_ERROR'
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

// Measurement angle constants (in degrees)
const MEASUREMENT_ANGLES = {
    LA_AXIS: [0, 90, 180, 270],
    LB_AXIS: [-90, 0, 90]
};

// Default position constants
const DEFAULT_POSITIONS = {
    TEST_X: 100,
    TEST_Y: 100,
    TEST_Z: 50,
    TEST_A: 0,
    TEST_B: 0,
    Z_OFFSET: 50.0
};

// UI constants
const UI_CONFIG = {
    LOG_AUTO_SCROLL: true
};
let measurementData = {
    la: {
        a0: null,
        a90: null,
        a180: null,
        a270: null,
        calculated: null,
        consistency: null
    },
    lb: {
        bNeg90: null,
        b0: null,
        b90: null,
        calculated: null,
        consistency: null
    }
};

let measurementState = {
    isRunning: false,
    currentPhase: null, // 'la' or 'lb'
    currentStep: 0,
    zOffset: DEFAULT_POSITIONS.Z_OFFSET,
    phases: {
        la: [
            { angle: MEASUREMENT_ANGLES.LA_AXIS[0], key: 'a0', label: 'A0°' },
            { angle: MEASUREMENT_ANGLES.LA_AXIS[1], key: 'a90', label: 'A90°' },
            { angle: MEASUREMENT_ANGLES.LA_AXIS[2], key: 'a180', label: 'A180°' },
            { angle: MEASUREMENT_ANGLES.LA_AXIS[3], key: 'a270', label: 'A270°' }
        ],
        lb: [
            { angle: MEASUREMENT_ANGLES.LB_AXIS[0], key: 'bNeg90', label: 'B-90°' },
            { angle: MEASUREMENT_ANGLES.LB_AXIS[1], key: 'b0', label: 'B0°' },
            { angle: MEASUREMENT_ANGLES.LB_AXIS[2], key: 'b90', label: 'B90°' }
        ]
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

// Global position tracking
let currentPosition = { x: 0, y: 0, z: 0, a: 0, b: 0 };
let isRelativeMode = false;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    try {
        initializeUI();
        
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
                sendCommand('G28');
            } else {
                sendCommand(`G28 ${axis}`);
            }
        });
    });
    
    // Step size controls
    const stepButtons = document.querySelectorAll('.step-btn');
    stepButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            stepButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });
    
    // Custom step input
    document.getElementById('moveDistance').addEventListener('input', () => {
        stepButtons.forEach(b => b.classList.remove('active'));
    });
    
    // Test mode toggle
    document.getElementById('testModeBtn').addEventListener('click', toggleTestMode);
    
    // Log controls
    document.getElementById('clearLogBtn').addEventListener('click', clearLog);
    document.getElementById('autoScrollBtn').addEventListener('click', toggleAutoScroll);
    
    // Manual G-code input
    document.getElementById('sendGcodeBtn').addEventListener('click', sendManualGcode);
    document.getElementById('manualGcodeInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendManualGcode();
        }
    });
    
    // Measurement control buttons
    document.getElementById('startLaBtn').addEventListener('click', () => startMeasurement('la'));
    document.getElementById('startLbBtn').addEventListener('click', () => {
        // Show Z offset input for B axis measurement
        document.getElementById('zOffsetGroup').style.display = 'block';
        startMeasurement('lb');
    });
    
    // Z offset input handler
    document.getElementById('zOffsetInput').addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        measurementState.zOffset = isNaN(value) ? 50.0 : value;
    });
    
    // Measurement control buttons
    document.getElementById('confirmPositionBtn').addEventListener('click', confirmCurrentPosition);
    document.getElementById('skipMeasurementBtn').addEventListener('click', skipCurrentPosition);
    
    // Save parameters button
    document.getElementById('saveParametersBtn').addEventListener('click', saveParameters);
    document.getElementById('backToSetupBtn').addEventListener('click', () => {
        window.location.href = 'setup.html';
    });
}

function getStepSize() {
    const activeBtn = document.querySelector('.step-btn.active');
    if (activeBtn) {
        return parseFloat(activeBtn.dataset.step);
    } else {
        const customValue = parseFloat(document.getElementById('moveDistance').value);
        return isNaN(customValue) ? 1.0 : customValue;
    }
}

async function connectPrinter() {
    try {
        serialPort = await navigator.serial.requestPort();
        await serialPort.open({ baudRate: SERIAL_CONFIG.BAUD_RATE });
        
        document.getElementById('printerStatus').textContent = '✅';
        document.getElementById('printerText').textContent = 'Connected';
        document.getElementById('connectBtn').textContent = 'Connected';
        document.getElementById('connectBtn').disabled = true;
        
        addLogEntry('Printer connected successfully', 'info');
        
        // Enable measurement buttons
        enableMeasurementButtons();
        
        // Start reading serial data
        readSerialData();
        
        // Request initial position
        setTimeout(() => sendCommand('M114'), 1000);
        
    } catch (error) {
        addLogEntry('Connection failed: ' + error.message, 'error');
    }
}

function enableMeasurementButtons() {
    document.getElementById('startLaBtn').disabled = false;
    document.getElementById('startLbBtn').disabled = false;
}

async function readSerialData() {
    const textDecoder = new TextDecoderStream();
    const readableStreamClosed = serialPort.readable.pipeTo(textDecoder.writable);
    const reader = textDecoder.readable.getReader();
    
    try {
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            
            const lines = value.split('\n');
            lines.forEach(line => {
                if (line.trim()) {
                    processSerialLine(line.trim());
                }
            });
        }
    } catch (error) {
    }
}

function processSerialLine(line) {
    addLogEntry(line, 'received');
    
    // Parse position from M114 response
    if (line.includes('X:') && line.includes('Y:')) {
        const xMatch = line.match(/X:([-\d.]+)/);
        const yMatch = line.match(/Y:([-\d.]+)/);
        const zMatch = line.match(/Z:([-\d.]+)/);
        const aMatch = line.match(/A:([-\d.]+)/);
        const bMatch = line.match(/B:([-\d.]+)/);
        
        if (xMatch && yMatch) {
            currentPosition.x = parseFloat(xMatch[1]);
            currentPosition.y = parseFloat(yMatch[1]);
            if (zMatch) currentPosition.z = parseFloat(zMatch[1]);
            if (aMatch) currentPosition.a = parseFloat(aMatch[1]);
            if (bMatch) currentPosition.b = parseFloat(bMatch[1]);
            
            updatePositionDisplay(currentPosition);
        }
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

async function sendCommand(command) {
    // Log the sent command
    addLogEntry(`> ${command}`, 'sent');
    
    // Update position immediately based on command
    updatePositionFromCommand(command);
    
    // Check if this is a movement command for M114 verification
    const isMovementCommand = /^G[01]\s|^G28/.test(command.trim());
    
    if (testMode.enabled) {
        // In test mode, just simulate
        addLogEntry('TEST MODE: Command simulated', 'info');
        if (isMovementCommand) {
            // Simulate delay and then request position update
            setTimeout(() => {
                addLogEntry('TEST MODE: Position updated', 'received');
            }, 500);
        }
        return;
    }
    
    if (!serialPort || !serialPort.writable) {
        addLogEntry('Error: Printer not connected', 'error');
        return;
    }
    
    try {
        const writer = serialPort.writable.getWriter();
        await writer.write(new TextEncoder().encode(command + '\n'));
        writer.releaseLock();
        
        // Auto-request position after movement for real-time updates
        if (isMovementCommand) {
            setTimeout(async () => {
                const encoder = new TextEncoder();
                const writer = serialPort.writable.getWriter();
                await writer.write(encoder.encode('M114\n'));
                writer.releaseLock();
                addLogEntry('> M114', 'sent');
            }, 1000);
        }
        
    } catch (error) {
        addLogEntry('Error: ' + error.message, 'error');
    }
}

function updatePositionDisplay(position) {
    document.getElementById('currentX').textContent = position.x.toFixed(1);
    document.getElementById('currentY').textContent = position.y.toFixed(1);
    document.getElementById('currentZ').textContent = position.z.toFixed(1);
    document.getElementById('currentA').textContent = position.a.toFixed(1);
    document.getElementById('currentB').textContent = position.b.toFixed(1);
}

function startMeasurement(phase) {
    measurementState.isRunning = true;
    measurementState.currentPhase = phase;
    measurementState.currentStep = 0;
    
    // Show measurement progress box
    document.getElementById('measurementProgress').style.display = 'block';
    
    // Start the first step
    nextMeasurementStep();
}

function nextMeasurementStep() {
    const phase = measurementState.phases[measurementState.currentPhase];
    const currentPoint = phase[measurementState.currentStep];
    
    if (!currentPoint) {
        // Measurement phase complete
        completeMeasurementPhase();
        return;
    }
    
    // Update UI
    document.getElementById('currentStep').textContent = `${measurementState.currentStep + 1}/${phase.length}`;
    document.getElementById('currentAngle').textContent = currentPoint.label;
    
    const axis = measurementState.currentPhase === 'la' ? 'A' : 'B';
    if (measurementState.currentPhase === 'lb') {
        document.getElementById('measurementInstruction').innerHTML = 
            `<p>Use movement controls to position the nozzle tip to touch the cone tip, then confirm.</p>`;
    } else {
        document.getElementById('measurementInstruction').innerHTML = 
            `<p>Moving to ${currentPoint.label}. Position the nozzle tip to touch the cone tip.</p>`;
    }
    
    // Move to the angle and apply Z safety offset for B axis
    if (measurementState.currentPhase === 'lb') {
        // Move up by safety offset, then rotate to angle
        sendCommand(`G91\nG0 Z${measurementState.zOffset}\nG90\nG0 ${axis}${currentPoint.angle}`);
    } else {
        sendCommand(`G0 ${axis}${currentPoint.angle}`);
    }
    
    // Update expected and actual position displays
    setTimeout(() => {
        const pos = testMode.enabled ? testMode.position : currentPosition;
        document.getElementById('expectedX').textContent = '--';
        document.getElementById('expectedY').textContent = '--';
        document.getElementById('expectedZ').textContent = measurementState.currentPhase === 'lb' ? `${(pos.z + measurementState.zOffset).toFixed(1)} (safety offset applied)` : '--';
        document.getElementById('actualX').textContent = pos.x.toFixed(1);
        document.getElementById('actualY').textContent = pos.y.toFixed(1);
        document.getElementById('actualZ').textContent = pos.z.toFixed(1);
    }, 1000);
    
    document.getElementById('statusMessage').textContent = 
        `Step ${measurementState.currentStep + 1}: Position nozzle at ${currentPoint.label}`;
}

function confirmCurrentPosition() {
    const phase = measurementState.phases[measurementState.currentPhase];
    const currentPoint = phase[measurementState.currentStep];
    
    // Request current position and store it
    sendCommand('M114');
    
    setTimeout(() => {
        const pos = testMode.enabled ? testMode.position : currentPosition;
        measurementData[measurementState.currentPhase][currentPoint.key] = { ...pos };
        
        
        // Move to next step
        measurementState.currentStep++;
        nextMeasurementStep();
    }, 1000);
}

function skipCurrentPosition() {
    // Move to next step without storing position
    measurementState.currentStep++;
    nextMeasurementStep();
}

function completeMeasurementPhase() {
    measurementState.isRunning = false;
    document.getElementById('measurementProgress').style.display = 'none';
    
    if (measurementState.currentPhase === 'la') {
        calculateLa();
    } else {
        calculateLb();
        // Hide Z offset group after lb measurement
        document.getElementById('zOffsetGroup').style.display = 'none';
    }
    
    document.getElementById('statusMessage').textContent = 
        `${measurementState.currentPhase.toUpperCase()} measurement complete!`;
}

function calculateLa() {
    try {
        const { a0, a90, a180, a270 } = measurementData.la;
        
        // Validate measurement data
        if (!a0 || !a90 || !a180 || !a270) {
            throw new Error('Incomplete A-axis measurement data');
        }
        
        // Validate position data
        const positions = [a0, a90, a180, a270];
        positions.forEach((pos, index) => {
            if (!pos || typeof pos.x !== 'number' || typeof pos.y !== 'number' || 
                isNaN(pos.x) || isNaN(pos.y)) {
                throw new Error(`Invalid position data at angle ${index * 90}°`);
            }
        });
        
        // Calculate distances from A0 reference
        const dist90 = Math.sqrt(Math.pow(a90.x - a0.x, 2) + Math.pow(a90.y - a0.y, 2));
        const dist180 = Math.sqrt(Math.pow(a180.x - a0.x, 2) + Math.pow(a180.y - a0.y, 2));
        const dist270 = Math.sqrt(Math.pow(a270.x - a0.x, 2) + Math.pow(a270.y - a0.y, 2));
        
        // Validate calculations
        if (isNaN(dist90) || isNaN(dist180) || isNaN(dist270)) {
            throw new Error('Distance calculation resulted in NaN');
        }
        
        // Check for reasonable distance values
        const distances = [dist90, dist180, dist270];
        if (distances.some(d => d > 500)) {
            addLogEntry('Warning: Unusually large distances detected in La calculation', 'warning');
        }
        
        // For perfect la, A90 and A270 should be equidistant from A0
        // and A180 should be 2*la from A0
        const laEstimate1 = dist90;
        const laEstimate2 = dist180 / 2;
        const laEstimate3 = dist270;
        
        // Check for division by zero
        if (dist180 === 0) {
            addLogEntry('Warning: Zero distance for A180, calculation may be inaccurate', 'warning');
        }
        
        const laAverage = (laEstimate1 + laEstimate2 + laEstimate3) / 3;
        const maxDeviation = Math.max(
            Math.abs(laEstimate1 - laAverage),
            Math.abs(laEstimate2 - laAverage), 
            Math.abs(laEstimate3 - laAverage)
        );
        
        // Validate final results
        if (isNaN(laAverage) || isNaN(maxDeviation)) {
            throw new Error('La calculation resulted in NaN');
        }
        
        if (laAverage < 0) {
            addLogEntry('Warning: Negative La value calculated, check measurement setup', 'warning');
        }
        
        measurementData.la.calculated = laAverage;
        measurementData.la.consistency = maxDeviation;
        
        // Display results safely
        safeUpdateElement(document.getElementById('laValue'), 'textContent', laAverage.toFixed(2));
        safeUpdateElement(document.getElementById('laConsistency'), 'textContent', 
            maxDeviation < 1.0 ? 'Good' : 'Poor (±' + maxDeviation.toFixed(1) + 'mm)');
        
        const laResults = document.getElementById('laResults');
        if (laResults) laResults.style.display = 'block';
        
        // Update final results
        safeUpdateElement(document.getElementById('finalLa'), 'textContent', laAverage.toFixed(2));
        
        updateSaveButton();
        
        addLogEntry(`La calculated: ${laAverage.toFixed(2)}mm (consistency: ±${maxDeviation.toFixed(2)}mm)`, 'info');
        
    } catch (error) {
        handleError(ERROR_TYPES.CALCULATION_ERROR, `Failed to calculate La: ${error.message}`, error);
        addLogEntry(`La calculation failed: ${error.message}`, 'error');
    }
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

function calculateLb() {
    try {
        const { bNeg90, b0, b90 } = measurementData.lb;
        
        // Validate measurement data
        if (!bNeg90 || !b0 || !b90) {
            throw new Error('Incomplete B-axis measurement data');
        }
        
        // Validate position data
        const positions = [bNeg90, b0, b90];
        positions.forEach((pos, index) => {
            const angle = [-90, 0, 90][index];
            if (!pos || typeof pos.x !== 'number' || typeof pos.y !== 'number' || 
                isNaN(pos.x) || isNaN(pos.y)) {
                throw new Error(`Invalid position data at B${angle}°`);
            }
        });
        
        // For B-axis (pitch), measure X displacement from B0 reference
        const xDispNeg90 = Math.abs(bNeg90.x - b0.x);
        const xDisp90 = Math.abs(b90.x - b0.x);
        
        // Validate calculations
        if (isNaN(xDispNeg90) || isNaN(xDisp90)) {
            throw new Error('X displacement calculation resulted in NaN');
        }
        
        // Check for reasonable displacement values
        if (xDispNeg90 > 500 || xDisp90 > 500) {
            addLogEntry('Warning: Unusually large X displacements detected in Lb calculation', 'warning');
        }
        
        // For perfect lb, B-90 and B90 should have equal X displacement from B0
        const lbEstimate = (xDispNeg90 + xDisp90) / 2;
        const asymmetry = Math.abs(xDispNeg90 - xDisp90);
        
        // Validate final results
        if (isNaN(lbEstimate) || isNaN(asymmetry)) {
            throw new Error('Lb calculation resulted in NaN');
        }
        
        if (lbEstimate <= 0) {
            throw new Error('Lb must be greater than 0');
        }
        
        measurementData.lb.calculated = lbEstimate;
        measurementData.lb.consistency = asymmetry;
        
        // Display results safely
        safeUpdateElement(document.getElementById('lbValue'), 'textContent', lbEstimate.toFixed(2));
        safeUpdateElement(document.getElementById('lbConsistency'), 'textContent', 
            asymmetry < 1.0 ? 'Good' : 'Poor (±' + asymmetry.toFixed(1) + 'mm)');
        
        const lbResults = document.getElementById('lbResults');
        if (lbResults) lbResults.style.display = 'block';
        
        // Update final results
        safeUpdateElement(document.getElementById('finalLb'), 'textContent', lbEstimate.toFixed(2));
        
        updateSaveButton();
        
        addLogEntry(`Lb calculated: ${lbEstimate.toFixed(2)}mm (asymmetry: ±${asymmetry.toFixed(2)}mm)`, 'info');
        
    } catch (error) {
        handleError(ERROR_TYPES.CALCULATION_ERROR, `Failed to calculate Lb: ${error.message}`, error);
        addLogEntry(`Lb calculation failed: ${error.message}`, 'error');
    }
}

function updateSaveButton() {
    // Show final results and enable save if at least one parameter is measured
    if (measurementData.la.calculated !== null || measurementData.lb.calculated !== null) {
        document.getElementById('finalResults').style.display = 'block';
        document.getElementById('saveParametersBtn').disabled = false;
        
        // Update display values or show "--" for unmeasured parameters
        if (measurementData.la.calculated !== null) {
            document.getElementById('finalLa').textContent = measurementData.la.calculated.toFixed(2);
        } else {
            document.getElementById('finalLa').textContent = '--';
        }
        
        if (measurementData.lb.calculated !== null) {
            document.getElementById('finalLb').textContent = measurementData.lb.calculated.toFixed(2);
        } else {
            document.getElementById('finalLb').textContent = '--';
        }
        
        document.getElementById('statusMessage').textContent = 
            'Parameters ready! Review results and save.';
    }
}

function saveParameters() {
    try {
        let savedParams = [];
        
        // Validate that we have at least one parameter to save
        if (measurementData.la.calculated === null && measurementData.lb.calculated === null) {
            throw new Error('No parameters available to save');
        }
        
        // Save only the measured parameters
        if (measurementData.la.calculated !== null) {
            const la = measurementData.la.calculated;
            
            // Validate la value
            if (typeof la !== 'number' || isNaN(la) || la < 0) {
                throw new Error(`Invalid La value: ${la}`);
            }
            
            try {
                setCookie('rep5x_la', la.toFixed(2), 365);
                savedParams.push(`la=${la.toFixed(2)}mm`);
            } catch (saveError) {
                throw new Error(`Failed to save La parameter: ${saveError.message}`);
            }
        }
        
        if (measurementData.lb.calculated !== null) {
            const lb = measurementData.lb.calculated;
            
            // Validate lb value
            if (typeof lb !== 'number' || isNaN(lb) || lb <= 0) {
                throw new Error(`Invalid Lb value: ${lb}`);
            }
            
            try {
                setCookie('rep5x_lb', lb.toFixed(2), 365);
                savedParams.push(`lb=${lb.toFixed(2)}mm`);
            } catch (saveError) {
                throw new Error(`Failed to save Lb parameter: ${saveError.message}`);
            }
        }
        
        addLogEntry(`Parameters saved: ${savedParams.join(', ')}`, 'info');
        
        // Verify parameters were saved correctly
        const verifyLa = getCookie('rep5x_la');
        const verifyLb = getCookie('rep5x_lb');
        
        if (measurementData.la.calculated !== null && !verifyLa) {
            throw new Error('Failed to verify La parameter save');
        }
        
        if (measurementData.lb.calculated !== null && !verifyLb) {
            throw new Error('Failed to verify Lb parameter save');
        }
        
        // Redirect to setup page
        try {
            window.location.href = 'setup.html';
        } catch (navError) {
            handleError('NAVIGATION_ERROR', 'Failed to navigate to setup page', navError);
        }
        
    } catch (error) {
        handleError('SAVE_PARAMETERS_ERROR', `Failed to save parameters: ${error.message}`, error);
        addLogEntry(`Save failed: ${error.message}`, 'error');
    }
}

function toggleTestMode() {
    testMode.enabled = !testMode.enabled;
    const btn = document.getElementById('testModeBtn');
    
    if (testMode.enabled) {
        btn.textContent = 'Exit Test Mode';
        btn.classList.add('active');
        addLogEntry('Test mode enabled - movements are simulated', 'info');
        
        // Enable measurement buttons even without connection
        enableMeasurementButtons();
        
        // Update position display
        updatePositionDisplay(testMode.position);
        
        document.getElementById('printerStatus').textContent = '🧪';
        document.getElementById('printerText').textContent = 'Test Mode';
    } else {
        btn.textContent = 'Test Mode';
        btn.classList.remove('active');
        addLogEntry('Test mode disabled', 'info');
        
        if (!serialPort) {
            document.getElementById('printerStatus').textContent = '⚠️';
            document.getElementById('printerText').textContent = 'Not connected';
        }
    }
}

function sendManualGcode() {
    const input = document.getElementById('manualGcodeInput');
    const command = input.value.trim();
    
    if (command) {
        sendCommand(command);
        input.value = '';
    }
}

function addLogEntry(message, type = 'info') {
    const log = document.getElementById('gcodeLog');
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    
    log.appendChild(entry);
    
    if (logState.autoScroll) {
        log.scrollTop = log.scrollHeight;
    }
}

function clearLog() {
    const log = document.getElementById('gcodeLog');
    log.innerHTML = '<div class="log-entry">Log cleared</div>';
}

function toggleAutoScroll() {
    logState.autoScroll = !logState.autoScroll;
    const btn = document.getElementById('autoScrollBtn');
    
    if (logState.autoScroll) {
        btn.classList.add('active');
        btn.textContent = 'Auto Scroll';
    } else {
        btn.classList.remove('active');
        btn.textContent = 'Manual Scroll';
    }
}

// Cookie helpers with error handling
function setCookie(name, value, days) {
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

function getCookie(name) {
    try {
        if (!name || typeof name !== 'string') {
            throw new Error('Invalid cookie name');
        }
        
        // Try localStorage first
        try {
            const localValue = localStorage.getItem(name);
            if (localValue !== null) {
                return localValue;
            }
        } catch (storageError) {
            addLogEntry(`localStorage access failed: ${storageError.message}`, 'warning');
        }
        
        // Fallback to cookies
        try {
            const nameEQ = name + "=";
            const ca = document.cookie.split(';');
            for (let i = 0; i < ca.length; i++) {
                let c = ca[i];
                while (c.charAt(0) === ' ') c = c.substring(1, c.length);
                if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
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