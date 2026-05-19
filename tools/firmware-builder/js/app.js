/**
 * Rep5x Firmware Builder - Wizard Application
 * Step-by-step firmware configuration wizard
 */

// Printer presets (official build volumes)
const printerPresets = {
    'ender3v3se': {
        name: 'Ender 3 V3 SE',
        xBedSize: 220,
        yBedSize: 220,
        zMaxPos: 270,
        xHomeDir: 1,
        yHomeDir: -1,
        zHomeDir: 1
    },
    'ender3pro': {
        name: 'Ender 3 Pro',
        xBedSize: 220,
        yBedSize: 220,
        zMaxPos: 250,
        xHomeDir: -1,
        yHomeDir: -1,
        zHomeDir: -1
    },
    'ender3v2': {
        name: 'Ender 3 V2',
        xBedSize: 220,
        yBedSize: 220,
        zMaxPos: 250,
        xHomeDir: -1,
        yHomeDir: -1,
        zHomeDir: -1
    },
    'ender5pro': {
        name: 'Ender 5 Pro',
        xBedSize: 220,
        yBedSize: 220,
        zMaxPos: 300,
        xHomeDir: -1,
        yHomeDir: -1,
        zHomeDir: 1
    }
};

// Rep5x modification offsets
const rep5xOffsets = {
    xy: 20,  // mm reduction for X and Y
    z: 100   // mm reduction for Z
};

// Wizard framework instance
let wizard = null;

// Wizard state
const wizardState = {
    applyRep5xOffsets: true,  // Whether to apply automatic Rep5x volume reduction
    config: {
        // Step 1: Printer
        printer: 'ender3v3se',

        // Step 2: Board
        board: 'octopus_v1.1',

        // Step 2: Dimensions (set by preset or custom, with Rep5x offsets applied)
        xBedSize: 200,    // 220 - 20 (Rep5x offset)
        yBedSize: 200,    // 220 - 20 (Rep5x offset)
        zMaxPos: 170,     // 270 - 100 (Rep5x offset)
        xHomeDir: 1,      // Set by preset
        yHomeDir: -1,     // Set by preset
        zHomeDir: 1,      // Always MAX for Rep5x

        // Step 2: XY homing method
        xyHomingMode: 'endstops',  // 'endstops' or 'sensorless'
        stallSensitivityX: 8,
        stallSensitivityY: 8,

        // Step 4: Display
        display: 'btt_mini_12864',
        neopixelColor: 'green',

        // Step 3: Case light LED
        caseLightEnabled: false,
        caseLightBrightness: 105,
        caseLightPin: 'PD13',

        // Step 4: Motors - Drivers
        driverX: 'TMC2208',
        driverY: 'TMC2208',
        driverZ: 'TMC2208',
        driverC: 'TMC2208',
        driverB: 'TMC2208',
        driverE: 'TMC2208',

        // Step 4: Dual Z steppers
        dualZ: false,
        zMultiEndstops: false,

        // Step 4: Motors - Socket assignment
        socketX: 'MOTOR0',
        socketY: 'MOTOR1',
        socketZ: 'MOTOR2_1',
        socketC: 'MOTOR4',
        socketB: 'MOTOR5',
        socketE: 'MOTOR3',

        // Step 4: Motors - Steps per unit
        stepsX: 80,
        stepsY: 80,
        stepsZ: 400,
        stepsC: 26.666,
        stepsB: 26.68,
        stepsE: 415,

        // Step 4: Motors - Direction
        invertX: false,
        invertY: true,
        invertZ: false,
        invertC: true,
        invertB: false,
        invertE: false,

        // Step 4: Endstop hit state (HIGH = NO, LOW = NC)
        endstopX: 'HIGH',
        endstopY: 'HIGH',
        endstopZ: 'HIGH',
        endstopC: 'HIGH',
        endstopB: 'LOW',

        // Step 6: Kinematics
        ikLC: 2.30,
        ikLB: 52.87,
        cHomePos: 0,  // C axis coordinate at home switch
        bRange: 135,  // B axis travel limit (±degrees)
        segmentsPerSecond: 200,

        // Step 4: Advanced pin assignments
        // Each function: { header: <label>, raw: <raw pin or ''> }
        pinAssignments: {}
    }
};

/**
 * Functions assignable in the advanced pin panel.
 * `kind` selects which board pin list applies ('endstop' or 'fan').
 */
const advancedPinFunctions = [
    { key: 'endstopX', label: 'X endstop', kind: 'endstop' },
    { key: 'endstopY', label: 'Y endstop', kind: 'endstop' },
    { key: 'endstopZ', label: 'Z endstop', kind: 'endstop' },
    { key: 'endstopC', label: 'C-axis endstop', kind: 'endstop' },
    { key: 'endstopB', label: 'B-axis endstop', kind: 'endstop' },
    { key: 'fanHotend', label: 'Hotend / auto fan', kind: 'fan' },
    { key: 'fanController', label: 'Controller fan', kind: 'fan' }
];

// Neopixel color definitions
const neopixelColors = {
    green: { r: 0, g: 255, b: 0 },
    blue: { r: 0, g: 0, b: 255 },
    red: { r: 255, g: 0, b: 0 },
    white: { r: 255, g: 255, b: 255 },
    purple: { r: 175, g: 82, b: 222 },
    orange: { r: 255, g: 149, b: 0 }
};

/**
 * Initialize the wizard
 */
function initWizard() {
    // Initialise wizard framework
    wizard = new WizardFramework({
        totalSteps: 6,
        stepIdPrefix: 'step',
        zeroIndexed: false,
        getNextButtonText: () => 'Next',
        onStepChange: (newStep) => {
            // If on review step (step 6), generate summary
            if (newStep + 1 === 6) {
                generateConfigSummary();
                generateConfigPreview();
            }
            // Scroll to top of wizard
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });
    wizard.init();

    // Try to load saved IK values from storage
    if (typeof StorageManager !== 'undefined') {
        const savedResults = StorageManager.loadCalibrationResults();
        if (savedResults) {
            if (savedResults.lc !== undefined) {
                wizardState.config.ikLC = savedResults.lc;
                document.getElementById('ikLC').value = savedResults.lc;
            }
            if (savedResults.lb !== undefined) {
                wizardState.config.ikLB = savedResults.lb;
                document.getElementById('ikLB').value = savedResults.lb;
            }
        }
    }

    // Apply default preset (Ender 3 V3 SE) with Rep5x offsets
    const defaultPreset = document.getElementById('printerPreset').value;
    if (defaultPreset) {
        applyPrinterPreset(defaultPreset);
    }

    // Set up input change listeners
    setupInputListeners();

    // Build the advanced pin panel from the board map
    renderAdvancedPinPanel();
}

/**
 * Set up listeners for all inputs to update state
 */
function setupInputListeners() {
    // Numeric inputs
    const numericInputs = [
        { id: 'xBedSize', key: 'xBedSize' },
        { id: 'yBedSize', key: 'yBedSize' },
        { id: 'zMaxPos', key: 'zMaxPos' },
        { id: 'stepsX', key: 'stepsX' },
        { id: 'stepsY', key: 'stepsY' },
        { id: 'stepsZ', key: 'stepsZ' },
        { id: 'stepsC', key: 'stepsC' },
        { id: 'stepsB', key: 'stepsB' },
        { id: 'stepsE', key: 'stepsE' },
        { id: 'ikLC', key: 'ikLC' },
        { id: 'ikLB', key: 'ikLB' },
        { id: 'cHomePos', key: 'cHomePos' },
        { id: 'bRange', key: 'bRange' },
        { id: 'segmentsPerSecond', key: 'segmentsPerSecond' },
        { id: 'stallSensitivityX', key: 'stallSensitivityX' },
        { id: 'stallSensitivityY', key: 'stallSensitivityY' },
        { id: 'caseLightBrightness', key: 'caseLightBrightness' }
    ];

    numericInputs.forEach(({ id, key }) => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('change', () => {
                wizardState.config[key] = parseFloat(input.value);
            });
        }
    });

    // Select inputs (numeric values)
    const selectInputsNumeric = [
        { id: 'xHomeDir', key: 'xHomeDir' },
        { id: 'yHomeDir', key: 'yHomeDir' },
        { id: 'zHomeDir', key: 'zHomeDir' }
    ];

    selectInputsNumeric.forEach(({ id, key }) => {
        const select = document.getElementById(id);
        if (select) {
            select.addEventListener('change', () => {
                wizardState.config[key] = parseInt(select.value);
            });
        }
    });

    // Select inputs (string values) - drivers and sockets
    const selectInputsString = [
        { id: 'driverX', key: 'driverX' },
        { id: 'driverY', key: 'driverY' },
        { id: 'driverZ', key: 'driverZ' },
        { id: 'driverC', key: 'driverC' },
        { id: 'driverB', key: 'driverB' },
        { id: 'driverE', key: 'driverE' },
        { id: 'socketX', key: 'socketX' },
        { id: 'socketY', key: 'socketY' },
        { id: 'socketZ', key: 'socketZ' },
        { id: 'socketC', key: 'socketC' },
        { id: 'socketB', key: 'socketB' },
        { id: 'socketE', key: 'socketE' },
        { id: 'endstopX', key: 'endstopX' },
        { id: 'endstopY', key: 'endstopY' },
        { id: 'endstopZ', key: 'endstopZ' },
        { id: 'endstopC', key: 'endstopC' },
        { id: 'endstopB', key: 'endstopB' },
        { id: 'caseLightPin', key: 'caseLightPin' }
    ];

    selectInputsString.forEach(({ id, key }) => {
        const select = document.getElementById(id);
        if (select) {
            select.addEventListener('change', () => {
                wizardState.config[key] = select.value;
            });
        }
    });

    // Checkbox inputs
    const checkboxInputs = [
        { id: 'invertX', key: 'invertX' },
        { id: 'invertY', key: 'invertY' },
        { id: 'invertZ', key: 'invertZ' },
        { id: 'invertC', key: 'invertC' },
        { id: 'invertB', key: 'invertB' },
        { id: 'invertE', key: 'invertE' },
        { id: 'zMultiEndstops', key: 'zMultiEndstops' }
    ];

    checkboxInputs.forEach(({ id, key }) => {
        const checkbox = document.getElementById(id);
        if (checkbox) {
            checkbox.addEventListener('change', () => {
                wizardState.config[key] = checkbox.checked;
            });
        }
    });

}

/**
 * Select an option card
 */
function selectOption(element, category) {
    // Don't select disabled options
    if (element.classList.contains('disabled')) {
        return;
    }

    // Deselect all options in this category
    const parent = element.parentElement;
    parent.querySelectorAll('.option-card').forEach(card => {
        card.classList.remove('selected');
        const icon = card.querySelector('.check-icon');
        if (icon) icon.classList.add('hidden');
    });

    // Select clicked option
    element.classList.add('selected');
    const icon = element.querySelector('.check-icon');
    if (icon) icon.classList.remove('hidden');

    // Update state
    const value = element.dataset.value;
    wizardState.config[category] = value;

    // Handle display-specific UI
    if (category === 'display') {
        const neopixelOptions = document.getElementById('neopixelOptions');
        if (neopixelOptions) {
            neopixelOptions.style.display = value === 'btt_mini_12864' ? 'block' : 'none';
        }
    }

    // Re-render the advanced pin panel against the newly selected board
    if (category === 'board') {
        renderAdvancedPinPanel();
    }
}

/**
 * Apply printer preset values
 */
function applyPrinterPreset(presetId) {
    if (!presetId || !printerPresets[presetId]) {
        // Custom values - just update the adjusted display
        updateAdjustedValues();
        return;
    }

    const preset = printerPresets[presetId];
    wizardState.config.printer = presetId;

    // Set official values in form fields (offsets shown dynamically below)
    document.getElementById('xBedSize').value = preset.xBedSize;
    document.getElementById('yBedSize').value = preset.yBedSize;
    document.getElementById('zMaxPos').value = preset.zMaxPos;
    document.getElementById('xHomeDir').value = preset.xHomeDir;
    document.getElementById('yHomeDir').value = preset.yHomeDir;
    document.getElementById('zHomeDir').value = preset.zHomeDir;

    // Update state with adjusted values for config generation
    wizardState.config.xHomeDir = preset.xHomeDir;
    wizardState.config.yHomeDir = preset.yHomeDir;
    wizardState.config.zHomeDir = preset.zHomeDir;

    // Update dynamic adjusted value display
    updateAdjustedValues();
}

/**
 * Toggle Rep5x offset application
 */
function toggleRep5xOffsets() {
    wizardState.applyRep5xOffsets = !wizardState.applyRep5xOffsets;

    // Update toggle button state
    const toggle = document.getElementById('offsetToggle');
    const toggleDot = document.getElementById('offsetToggleDot');

    if (wizardState.applyRep5xOffsets) {
        toggle.classList.add('bg-primary');
        toggle.classList.remove('bg-gray-300');
        toggleDot.classList.add('translate-x-5');
        toggleDot.classList.remove('translate-x-0');
    } else {
        toggle.classList.remove('bg-primary');
        toggle.classList.add('bg-gray-300');
        toggleDot.classList.remove('translate-x-5');
        toggleDot.classList.add('translate-x-0');
    }

    // Update dynamic adjusted value display
    updateAdjustedValues();
}

/**
 * Update the adjusted value display below each dimension field
 */
function updateAdjustedValues() {
    const xInput = parseFloat(document.getElementById('xBedSize').value) || 0;
    const yInput = parseFloat(document.getElementById('yBedSize').value) || 0;
    const zInput = parseFloat(document.getElementById('zMaxPos').value) || 0;

    const xAdjustedEl = document.getElementById('xAdjusted');
    const yAdjustedEl = document.getElementById('yAdjusted');
    const zAdjustedEl = document.getElementById('zAdjusted');

    if (wizardState.applyRep5xOffsets) {
        const xFinal = xInput - rep5xOffsets.xy;
        const yFinal = yInput - rep5xOffsets.xy;
        const zFinal = zInput - rep5xOffsets.z;

        xAdjustedEl.textContent = `→ ${xFinal}mm used (−${rep5xOffsets.xy}mm for Rep5x)`;
        yAdjustedEl.textContent = `→ ${yFinal}mm used (−${rep5xOffsets.xy}mm for Rep5x)`;
        zAdjustedEl.textContent = `→ ${zFinal}mm used (−${rep5xOffsets.z}mm for Rep5x)`;

        xAdjustedEl.classList.remove('hidden');
        yAdjustedEl.classList.remove('hidden');
        zAdjustedEl.classList.remove('hidden');

        // Update state with adjusted values
        wizardState.config.xBedSize = xFinal;
        wizardState.config.yBedSize = yFinal;
        wizardState.config.zMaxPos = zFinal;
    } else {
        xAdjustedEl.classList.add('hidden');
        yAdjustedEl.classList.add('hidden');
        zAdjustedEl.classList.add('hidden');

        // Update state with raw values
        wizardState.config.xBedSize = xInput;
        wizardState.config.yBedSize = yInput;
        wizardState.config.zMaxPos = zInput;
    }
}

/**
 * Expand or collapse the advanced pin panel.
 */
function toggleAdvancedPins() {
    const body = document.getElementById('advancedPinsBody');
    const chevron = document.getElementById('advancedPinsChevron');
    const hidden = body.classList.toggle('hidden');
    chevron.style.transform = hidden ? '' : 'rotate(180deg)';
}

/**
 * Fill in any pin assignment the user has not set with the board default.
 * Each assignment is a single MCU pin name.
 */
function initPinAssignments() {
    const defaults = BoardPins.getDefaults(wizardState.config.board);
    const assignments = wizardState.config.pinAssignments;
    advancedPinFunctions.forEach(fn => {
        if (typeof assignments[fn.key] !== 'string' || !assignments[fn.key]) {
            assignments[fn.key] = defaults[fn.key];
        }
    });
}

/**
 * Build the advanced pin panel rows from board-pins.js.
 * Each row is a function label and a dropdown of the board's MCU pins.
 */
function renderAdvancedPinPanel() {
    initPinAssignments();
    const board = BoardPins.boards[wizardState.config.board] || BoardPins.boards['octopus_v1.1'];
    const container = document.getElementById('advancedPinRows');
    if (!container) return;

    container.innerHTML = advancedPinFunctions.map(fn => {
        const pins = fn.kind === 'fan' ? board.fanPins : board.endstopPins;
        const current = wizardState.config.pinAssignments[fn.key];
        const options = pins.map(pin =>
            `<option value="${pin}"${pin === current ? ' selected' : ''}>${pin}</option>`
        ).join('');
        return `
            <div class="grid grid-cols-2 gap-3 items-center">
                <label class="text-sm text-gray-600">${fn.label}</label>
                <select class="config-input text-sm" data-pin-fn="${fn.key}"
                    onchange="updatePinAssignment(this)">${options}</select>
            </div>`;
    }).join('');

    checkPinConflicts();
}

/**
 * Persist a pin-dropdown change into wizard state.
 */
function updatePinAssignment(element) {
    wizardState.config.pinAssignments[element.dataset.pinFn] = element.value;
    checkPinConflicts();
}

/**
 * Collect the advanced pin assignments as a functionName -> pin map.
 * @returns {Object}
 */
function resolvePinOverrides() {
    const assignments = wizardState.config.pinAssignments;
    const resolved = {};
    advancedPinFunctions.forEach(fn => {
        resolved[fn.key] = assignments[fn.key];
    });
    return resolved;
}

/**
 * Warn when two functions are assigned the same pin.
 */
function checkPinConflicts() {
    const conflicts = BoardPins.findConflicts(resolvePinOverrides());
    const warning = document.getElementById('pinConflictWarning');
    if (!warning) return;

    if (conflicts.length > 0) {
        const labelOf = key => (advancedPinFunctions.find(f => f.key === key) || {}).label || key;
        const text = conflicts
            .map(group => group.map(labelOf).join(' + '))
            .join('; ');
        warning.querySelector('p').textContent = 'Pin conflict: ' + text + ' share the same pin.';
        warning.classList.remove('hidden');
    } else {
        warning.classList.add('hidden');
    }
}

/**
 * Show or hide the case-light options and sync the enabled state.
 */
function updateCaseLight() {
    const enabled = document.getElementById('caseLightEnabled').checked;
    wizardState.config.caseLightEnabled = enabled;
    document.getElementById('caseLightOptions').classList.toggle('hidden', !enabled);
}

/**
 * Show or hide the dual-Z options and sync the enabled state.
 */
function updateDualZ() {
    const enabled = document.getElementById('dualZ').checked;
    wizardState.config.dualZ = enabled;
    document.getElementById('dualZOptions').classList.toggle('hidden', !enabled);
}

// Remembers X/Y driver choices made before sensorless homing forced them to TMC2209.
let preSensorlessDrivers = null;

/**
 * Apply the XY homing-method choice.
 * Sensorless homing requires StallGuard drivers, so X/Y drivers are forced
 * to TMC2209 and locked, and the stall-sensitivity inputs are revealed.
 */
function updateXyHomingMode() {
    const mode = document.getElementById('xyHomingMode').value;
    wizardState.config.xyHomingMode = mode;

    const options = document.getElementById('sensorlessOptions');
    const sameDriverAll = document.getElementById('sameDriverAll');
    const driverX = document.getElementById('driverX');
    const driverY = document.getElementById('driverY');

    if (mode === 'sensorless') {
        options.classList.remove('hidden');

        // Remember the user's driver choice so it can be restored on switch-back.
        if (!preSensorlessDrivers) {
            preSensorlessDrivers = {
                x: wizardState.config.driverX,
                y: wizardState.config.driverY
            };
        }

        // Sensorless needs per-axis drivers, so leave "same for all" mode.
        if (sameDriverAll.checked) {
            sameDriverAll.checked = false;
            toggleSameDriverAll();
        }
        sameDriverAll.disabled = true;

        // Force X/Y to a StallGuard-capable driver and lock these selectors
        // (the driver selectors live on the Motors step).
        ['X', 'Y'].forEach(axis => {
            const select = document.getElementById('driver' + axis);
            select.value = 'TMC2209';
            select.disabled = true;
            wizardState.config['driver' + axis] = 'TMC2209';
        });
    } else {
        options.classList.add('hidden');

        // Restore the driver choice that sensorless mode overrode.
        if (preSensorlessDrivers) {
            driverX.value = preSensorlessDrivers.x;
            driverY.value = preSensorlessDrivers.y;
            wizardState.config.driverX = preSensorlessDrivers.x;
            wizardState.config.driverY = preSensorlessDrivers.y;
            preSensorlessDrivers = null;
        }

        sameDriverAll.disabled = false;
        driverX.disabled = false;
        driverY.disabled = false;
    }
}

/**
 * Update Z homing warning visibility based on selection
 */
function updateZHomingWarning() {
    const zHomeDir = document.getElementById('zHomeDir').value;
    const warning = document.getElementById('zMinWarning');

    if (warning) {
        // Show warning only when Z MIN (-1) is selected
        if (zHomeDir === '-1') {
            warning.classList.remove('hidden');
        } else {
            warning.classList.add('hidden');
        }
    }
}

/**
 * Toggle between same driver for all axes and individual selection
 */
function toggleSameDriverAll() {
    const sameForAll = document.getElementById('sameDriverAll').checked;
    const singleSelect = document.getElementById('singleDriverSelect');
    const individualSelect = document.getElementById('individualDriverSelect');

    if (sameForAll) {
        singleSelect.classList.remove('hidden');
        individualSelect.classList.add('hidden');
        // Apply current single driver to all
        updateAllDrivers();
    } else {
        singleSelect.classList.add('hidden');
        individualSelect.classList.remove('hidden');
    }
}

/**
 * Update all individual driver selects to match the "all" selector
 */
function updateAllDrivers() {
    const driverType = document.getElementById('driverAll').value;
    const axes = ['X', 'Y', 'Z', 'C', 'B', 'E'];

    axes.forEach(axis => {
        const select = document.getElementById(`driver${axis}`);
        if (select) {
            select.value = driverType;
            wizardState.config[`driver${axis}`] = driverType;
        }
    });
}

/**
 * Select neopixel backlight color
 */
function selectNeopixelColor(element) {
    // Deselect all
    document.querySelectorAll('.neopixel-color').forEach(btn => {
        btn.classList.remove('selected');
        btn.style.boxShadow = 'none';
    });

    // Select clicked
    element.classList.add('selected');
    element.style.boxShadow = '0 0 0 3px rgba(50, 215, 75, 0.5)';

    // Update state
    wizardState.config.neopixelColor = element.dataset.color;
}

/**
 * Navigate to next step (delegates to wizard framework)
 */
function nextStep() {
    wizard.nextStep();
}

/**
 * Navigate to previous step (delegates to wizard framework)
 */
function previousStep() {
    wizard.prevStep();
}

/**
 * Get current step (1-indexed for firmware builder)
 * @returns {number} Current step (1-indexed)
 */
function getCurrentStep() {
    return wizard.getCurrentStep() + 1;
}

/**
 * Get total steps
 * @returns {number} Total steps
 */
function getTotalSteps() {
    return wizard.getTotalSteps();
}

/**
 * Generate configuration summary for review step
 */
function generateConfigSummary() {
    const config = wizardState.config;
    const container = document.getElementById('configSummary');

    const summaryItems = [
        { label: 'Board', value: formatBoardName(config.board) },
        { label: 'Bed size', value: `${config.xBedSize} × ${config.yBedSize} mm` },
        { label: 'Z height', value: `${config.zMaxPos} mm` },
        { label: 'Display', value: formatDisplayName(config.display) },
        { label: 'IK parameters', value: `LC=${config.ikLC}, LB=${config.ikLB}` },
        { label: 'Axis limits', value: `C home=${config.cHomePos}°, B=±${config.bRange}°` }
    ];

    container.innerHTML = summaryItems.map(item => `
        <div class="bg-gray-50 p-4 rounded-lg">
            <div class="text-xs text-gray-500 uppercase tracking-wide mb-1">${item.label}</div>
            <div class="font-medium text-gray-900">${item.value}</div>
        </div>
    `).join('');
}

/**
 * Generate configuration file preview
 */
function generateConfigPreview() {
    const config = wizardState.config;
    const preview = document.getElementById('configPreview');

    // Generate preview using config generator
    if (typeof ConfigGenerator !== 'undefined') {
        const configContent = ConfigGenerator.generatePreview(config);
        preview.innerHTML = syntaxHighlight(configContent);
    } else {
        preview.textContent = '// Configuration preview will appear here';
    }
}

/**
 * Apply syntax highlighting to config content
 */
function syntaxHighlight(code) {
    return code
        .replace(/(\/\/.*$)/gm, '<span class="comment">$1</span>')
        .replace(/(#define)/g, '<span class="define">$1</span>')
        .replace(/\b(\d+\.?\d*)\b/g, '<span class="number">$1</span>')
        .replace(/"([^"]*)"/g, '"<span class="value">$1</span>"');
}

/**
 * Format printer name for display
 */
function formatPrinterName(value) {
    const names = {
        'ender3v3se': 'Ender 3 V3 SE',
        'ender3pro': 'Ender 3 Pro',
        'ender3v2': 'Ender 3 V2',
        'ender5pro': 'Ender 5 Pro',
        'custom': 'Custom'
    };
    return names[value] || value;
}

/**
 * Format board name for display
 */
function formatBoardName(value) {
    const names = {
        'octopus_v1.1': 'BTT Octopus V1.1',
        'octopus_pro': 'BTT Octopus Pro',
        'skr_3': 'BTT SKR 3',
        'custom_board': 'Custom'
    };
    return names[value] || value;
}

/**
 * Format display name for display
 */
function formatDisplayName(value) {
    const names = {
        'btt_mini_12864': 'BTT Mini 12864',
        'reprap_full_graphic': 'RepRap Full Graphic',
        'cr10_stock': 'CR-10 Stock Display',
        'tft35': 'BTT TFT35',
        'none': 'No display'
    };
    return names[value] || value;
}

/**
 * Copy config to clipboard
 */
async function copyConfig() {
    const config = wizardState.config;

    if (typeof ConfigGenerator !== 'undefined') {
        const configContent = ConfigGenerator.generateConfigurationH(config);

        try {
            await navigator.clipboard.writeText(configContent);

            // Show feedback
            const btn = event.target.closest('button');
            const originalHTML = btn.innerHTML;
            btn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg> Copied!';
            setTimeout(() => {
                btn.innerHTML = originalHTML;
            }, 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    }
}

/**
 * Download configuration files
 */
function downloadConfigFiles() {
    const config = wizardState.config;

    // Also save the JSON config so they can reload it later
    exportConfig(false);

    if (typeof ConfigGenerator !== 'undefined') {
        // Generate Configuration.h
        setTimeout(() => {
            const configH = ConfigGenerator.generateConfigurationH(config);
            downloadConfigFile('Configuration.h', configH);
        }, 300);

        // Generate Configuration_adv.h
        setTimeout(() => {
            const configAdvH = ConfigGenerator.generateConfigurationAdvH(config);
            downloadConfigFile('Configuration_adv.h', configAdvH);
        }, 600);
    }
}

// downloadFile is now provided by shared/file-downloader.js
// Local wrapper to maintain the existing function signature (filename, content)
function downloadConfigFile(filename, content) {
    downloadFile(content, filename);
}

/**
 * Build firmware via cloud compilation
 */
const BUILDER_URL = 'https://rep5x-firmware-builder.klappe.workers.dev';

async function buildFirmware() {
    const btn = document.getElementById('buildFirmwareBtn');
    const originalHTML = btn.innerHTML;

    // Save config file for the user (they'll need it if something goes wrong)
    exportConfig(false);

    // Show starting state
    btn.disabled = true;
    updateBuildButton(btn, 'Starting build...', 'Sending configuration');

    try {
        const config = wizardState.config;

        // Prepare build request with customization values
        const buildRequest = {
            board: config.board,
            // Dimensions
            xBedSize: config.xBedSize,
            yBedSize: config.yBedSize,
            zMaxPos: config.zMaxPos,
            // Homing directions
            xHomeDir: config.xHomeDir,
            yHomeDir: config.yHomeDir,
            zHomeDir: config.zHomeDir,
            // Display
            display: config.display,
            neopixelColor: config.neopixelColor,
            // Drivers
            driverX: config.driverX,
            driverY: config.driverY,
            driverZ: config.driverZ,
            driverC: config.driverC,
            driverB: config.driverB,
            driverE: config.driverE,
            // Dual Z steppers
            dualZ: config.dualZ,
            zMultiEndstops: config.zMultiEndstops,
            // Motor sockets
            socketX: config.socketX,
            socketY: config.socketY,
            socketZ: config.socketZ,
            socketC: config.socketC,
            socketB: config.socketB,
            socketE: config.socketE,
            // Steps per unit
            stepsX: config.stepsX,
            stepsY: config.stepsY,
            stepsZ: config.stepsZ,
            stepsC: config.stepsC,
            stepsB: config.stepsB,
            stepsE: config.stepsE,
            // Motor directions
            invertX: config.invertX,
            invertY: config.invertY,
            invertZ: config.invertZ,
            invertC: config.invertC,
            invertB: config.invertB,
            invertE: config.invertE,
            // Endstop hit states
            endstopX: config.endstopX,
            endstopY: config.endstopY,
            endstopZ: config.endstopZ,
            endstopC: config.endstopC,
            endstopB: config.endstopB,
            // Sensorless XY homing
            xyHomingMode: config.xyHomingMode,
            stallSensitivityX: config.stallSensitivityX,
            stallSensitivityY: config.stallSensitivityY,
            // Case light LED
            caseLightEnabled: config.caseLightEnabled,
            caseLightBrightness: config.caseLightBrightness,
            caseLightPin: config.caseLightPin,
            // Advanced pin assignments (resolved to MCU pins)
            pinOverrides: resolvePinOverrides(),
            // IK parameters
            ikLC: config.ikLC,
            ikLB: config.ikLB,
            cHomePos: config.cHomePos,
            bRange: config.bRange,
            segmentsPerSecond: config.segmentsPerSecond
        };

        // Send to cloud build service
        const response = await fetch(`${BUILDER_URL}/build`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(buildRequest)
        });

        if (!response.ok) {
            throw new Error(`Build request failed: ${response.statusText}`);
        }

        const result = await response.json();
        const buildId = result.buildId;

        if (!buildId) {
            throw new Error('No build ID received');
        }

        // Store buildId for error handling
        window.currentBuildId = buildId;

        // Poll for build status
        updateBuildButton(btn, 'Building...', `Build ID: ${buildId}`);

        const firmware = await pollBuildStatus(buildId, btn);

        // Download the firmware
        downloadFirmwareBlob(firmware);

        // Show success state with build ID
        btn.innerHTML = `
            <div class="w-12 h-12 bg-white bg-opacity-20 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
            </div>
            <div>
                <div class="font-semibold">Build complete!</div>
                <div class="text-sm opacity-80">Build ID: ${buildId}</div>
            </div>
        `;

        setTimeout(() => {
            btn.innerHTML = originalHTML;
            btn.disabled = false;
        }, 8000);

    } catch (error) {
        console.error('Build failed:', error);
        const failedBuildId = window.currentBuildId || 'unknown';

        // Show error state with build ID for troubleshooting
        btn.innerHTML = `
            <div class="w-12 h-12 bg-white bg-opacity-20 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
            </div>
            <div>
                <div class="font-semibold">${error.message || 'Build failed'}</div>
                <div class="text-sm opacity-80">Build ID: ${failedBuildId}</div>
            </div>
        `;

        setTimeout(() => {
            btn.innerHTML = originalHTML;
            btn.disabled = false;
        }, 10000);
    }
}

/**
 * Poll build status until complete or failed
 */
async function pollBuildStatus(buildId, btn) {
    const maxAttempts = 60; // 5 minutes max (5s intervals)
    let attempts = 0;

    while (attempts < maxAttempts) {
        await sleep(5000); // Wait 5 seconds between polls
        attempts++;

        const response = await fetch(`${BUILDER_URL}/status/${buildId}`);
        const status = await response.json();

        if (status.status === 'complete') {
            // Fetch the firmware
            const firmwareResponse = await fetch(`${BUILDER_URL}/download/${buildId}`);
            if (!firmwareResponse.ok) {
                throw new Error('Failed to download firmware');
            }
            return await firmwareResponse.blob();
        }

        if (status.status === 'failed') {
            throw new Error(status.error || 'Build failed');
        }

        // Update progress
        const elapsed = attempts * 5;
        updateBuildButton(btn, 'Building...', `Compiling firmware (${elapsed}s)`);
    }

    throw new Error('Build timed out');
}

/**
 * Update build button state
 */
function updateBuildButton(btn, title, subtitle) {
    btn.innerHTML = `
        <div class="w-12 h-12 bg-white bg-opacity-20 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg class="w-6 h-6 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
            </svg>
        </div>
        <div>
            <div class="font-semibold">${title}</div>
            <div class="text-sm opacity-80">${subtitle}</div>
        </div>
    `;
}

/**
 * Download firmware blob
 */
function downloadFirmwareBlob(blob) {
    downloadBlob(blob, 'firmware.bin');
}

/**
 * Sleep helper
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Export current configuration as JSON file
 * @param {boolean} showToastNotification - Whether to show toast notification (default true)
 */
function exportConfig(showToastNotification = true) {
    const config = wizardState.config;

    // Create export object with metadata
    const exportData = {
        _meta: {
            version: '1.0',
            exportedAt: new Date().toISOString(),
            tool: 'Rep5x Firmware Builder'
        },
        config: config
    };

    // Generate filename with local timestamp
    const now = new Date();
    const timestamp = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}T${String(now.getHours()).padStart(2,'0')}-${String(now.getMinutes()).padStart(2,'0')}-${String(now.getSeconds()).padStart(2,'0')}`;
    const filename = `rep5x-firmware-config-${timestamp}.json`;

    // Download as JSON using shared utility
    downloadJSON(exportData, filename);

    // Show feedback toast
    if (showToastNotification) {
        showToast('Configuration saved', 'save');
    }
}

/**
 * Trigger file input for importing config
 */
function importConfigTrigger() {
    document.getElementById('configFileInput').click();
}

/**
 * Handle config file import
 */
function handleConfigImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);

            // Validate the imported data
            if (!data.config) {
                throw new Error('Invalid config file format');
            }

            // Apply the imported configuration
            applyImportedConfig(data.config);

            // Show success toast using shared utility
            showToast('Configuration loaded', 'load');

        } catch (error) {
            console.error('Import error:', error);
            showToast('Invalid config file', 'error');
        }
    };

    reader.readAsText(file);

    // Reset file input so same file can be selected again
    event.target.value = '';
}

/**
 * Apply imported configuration to wizard state and UI
 */
function applyImportedConfig(config) {
    // Merge imported config with current state (preserves any missing fields)
    Object.assign(wizardState.config, config);

    // Update all form elements to reflect imported values

    // === Board Selection ===
    const boardCards = document.querySelectorAll('#step1 .option-card');
    boardCards.forEach(card => {
        card.classList.remove('selected');
        const icon = card.querySelector('.check-icon');
        if (icon) icon.classList.add('hidden');
        if (card.dataset.value === config.board) {
            card.classList.add('selected');
            if (icon) icon.classList.remove('hidden');
        }
    });

    // === Dimensions ===
    // For dimensions, we need to reverse the Rep5x offset calculation
    // The stored config has the adjusted values, but the form shows original values
    if (wizardState.applyRep5xOffsets) {
        document.getElementById('xBedSize').value = config.xBedSize + rep5xOffsets.xy;
        document.getElementById('yBedSize').value = config.yBedSize + rep5xOffsets.xy;
        document.getElementById('zMaxPos').value = config.zMaxPos + rep5xOffsets.z;
    } else {
        document.getElementById('xBedSize').value = config.xBedSize;
        document.getElementById('yBedSize').value = config.yBedSize;
        document.getElementById('zMaxPos').value = config.zMaxPos;
    }
    updateAdjustedValues();

    // === Homing Directions ===
    document.getElementById('xHomeDir').value = config.xHomeDir;
    document.getElementById('yHomeDir').value = config.yHomeDir;
    document.getElementById('zHomeDir').value = config.zHomeDir;
    updateZHomingWarning();

    // === XY Homing Method ===
    if (config.xyHomingMode) {
        document.getElementById('xyHomingMode').value = config.xyHomingMode;
    }
    if (config.stallSensitivityX != null) {
        document.getElementById('stallSensitivityX').value = config.stallSensitivityX;
    }
    if (config.stallSensitivityY != null) {
        document.getElementById('stallSensitivityY').value = config.stallSensitivityY;
    }
    updateXyHomingMode();

    // === Display Selection ===
    const displayCards = document.querySelectorAll('#step3 .option-card');
    displayCards.forEach(card => {
        card.classList.remove('selected');
        const icon = card.querySelector('.check-icon');
        if (icon) icon.classList.add('hidden');
        if (card.dataset.value === config.display) {
            card.classList.add('selected');
            if (icon) icon.classList.remove('hidden');
        }
    });

    // Show/hide neopixel options based on display
    const neopixelOptions = document.getElementById('neopixelOptions');
    if (neopixelOptions) {
        neopixelOptions.style.display = config.display === 'btt_mini_12864' ? 'block' : 'none';
    }

    // === Neopixel Color ===
    document.querySelectorAll('.neopixel-color').forEach(btn => {
        btn.classList.remove('selected');
        btn.style.boxShadow = 'none';
        if (btn.dataset.color === config.neopixelColor) {
            btn.classList.add('selected');
            btn.style.boxShadow = '0 0 0 3px rgba(50, 215, 75, 0.5)';
        }
    });

    // === Case Light ===
    if (config.caseLightEnabled != null) {
        document.getElementById('caseLightEnabled').checked = config.caseLightEnabled;
    }
    if (config.caseLightBrightness != null) {
        document.getElementById('caseLightBrightness').value = config.caseLightBrightness;
    }
    if (config.caseLightPin) {
        document.getElementById('caseLightPin').value = config.caseLightPin;
    }
    updateCaseLight();

    // === Advanced Pin Assignments ===
    if (config.pinAssignments) {
        wizardState.config.pinAssignments = config.pinAssignments;
    } else {
        wizardState.config.pinAssignments = {};
    }
    renderAdvancedPinPanel();

    // === Stepper Drivers ===
    const driverFields = ['driverX', 'driverY', 'driverZ', 'driverC', 'driverB', 'driverE'];
    const allSameDriver = driverFields.every(f => config[f] === config.driverX);

    document.getElementById('sameDriverAll').checked = allSameDriver;
    if (allSameDriver) {
        document.getElementById('driverAll').value = config.driverX;
        document.getElementById('singleDriverSelect').classList.remove('hidden');
        document.getElementById('individualDriverSelect').classList.add('hidden');
    } else {
        document.getElementById('singleDriverSelect').classList.add('hidden');
        document.getElementById('individualDriverSelect').classList.remove('hidden');
    }

    driverFields.forEach(field => {
        const el = document.getElementById(field);
        if (el) el.value = config[field];
    });

    // === Dual Z Steppers ===
    if (config.dualZ != null) {
        document.getElementById('dualZ').checked = config.dualZ;
    }
    if (config.zMultiEndstops != null) {
        document.getElementById('zMultiEndstops').checked = config.zMultiEndstops;
    }
    updateDualZ();

    // === Motor Sockets ===
    const socketFields = ['socketX', 'socketY', 'socketZ', 'socketC', 'socketB', 'socketE'];
    socketFields.forEach(field => {
        const el = document.getElementById(field);
        if (el) el.value = config[field];
    });

    // === Steps Per Unit ===
    const stepsFields = ['stepsX', 'stepsY', 'stepsZ', 'stepsC', 'stepsB', 'stepsE'];
    stepsFields.forEach(field => {
        const el = document.getElementById(field);
        if (el) el.value = config[field];
    });

    // === Motor Directions (Invert) ===
    const invertFields = ['invertX', 'invertY', 'invertZ', 'invertC', 'invertB', 'invertE'];
    invertFields.forEach(field => {
        const el = document.getElementById(field);
        if (el) el.checked = config[field];
    });

    // === Endstop hit states ===
    const endstopFields = ['endstopX', 'endstopY', 'endstopZ', 'endstopC', 'endstopB'];
    endstopFields.forEach(field => {
        const el = document.getElementById(field);
        if (el && config[field]) el.value = config[field];
    });

    // === IK Parameters ===
    document.getElementById('ikLC').value = config.ikLC;
    document.getElementById('ikLB').value = config.ikLB;
    document.getElementById('segmentsPerSecond').value = config.segmentsPerSecond;
}

// showConfigToast is now provided by shared/toast-notification.js as showToast

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', initWizard);
