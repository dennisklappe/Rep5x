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
    }
};

// Rep5x modification offsets
const rep5xOffsets = {
    xy: 20,  // mm reduction for X and Y
    z: 100   // mm reduction for Z
};

// Wizard state
const wizardState = {
    currentStep: 1,
    totalSteps: 6,
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

        // Step 4: Display
        display: 'btt_mini_12864',
        neopixelColor: 'green',

        // Step 4: Motors - Drivers
        driverX: 'TMC2208',
        driverY: 'TMC2208',
        driverZ: 'TMC2208',
        driverC: 'TMC2208',
        driverB: 'TMC2208',
        driverE: 'TMC2208',

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

        // Step 6: Kinematics
        ikEnabled: true,
        ikLC: 0,
        ikLB: 47.9,
        cHomePos: 0,  // C axis coordinate at home switch
        bRange: 135,  // B axis travel limit (±degrees)
        eventAfterHomingEnabled: false,  // Whether to run custom G-code after homing
        eventAfterHomingGcode: 'G49\nG0 C0 B0 F3000\nG43.4',  // Default: disable IK, move to B0 C0, re-enable IK
        segmentsPerSecond: 200
    }
};

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

    // Update UI
    updateProgressUI();
    updateNavigationButtons();
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
        { id: 'segmentsPerSecond', key: 'segmentsPerSecond' }
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
        { id: 'socketE', key: 'socketE' }
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
        { id: 'ikEnabled', key: 'ikEnabled' }
    ];

    checkboxInputs.forEach(({ id, key }) => {
        const checkbox = document.getElementById(id);
        if (checkbox) {
            checkbox.addEventListener('change', () => {
                wizardState.config[key] = checkbox.checked;
            });
        }
    });

    // Event after homing toggle and textarea
    const eventAfterHomingCheckbox = document.getElementById('eventAfterHomingEnabled');
    const eventAfterHomingContainer = document.getElementById('eventAfterHomingContainer');
    const eventAfterHomingGcode = document.getElementById('eventAfterHomingGcode');

    if (eventAfterHomingCheckbox && eventAfterHomingContainer) {
        eventAfterHomingCheckbox.addEventListener('change', () => {
            wizardState.config.eventAfterHomingEnabled = eventAfterHomingCheckbox.checked;
            eventAfterHomingContainer.classList.toggle('hidden', !eventAfterHomingCheckbox.checked);
        });
    }

    if (eventAfterHomingGcode) {
        eventAfterHomingGcode.addEventListener('input', () => {
            wizardState.config.eventAfterHomingGcode = eventAfterHomingGcode.value;
        });
    }
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
 * Navigate to next step
 */
function nextStep() {
    if (wizardState.currentStep < wizardState.totalSteps) {
        // Hide current step
        const currentStepEl = document.getElementById(`step${wizardState.currentStep}`);
        currentStepEl.classList.remove('active');

        // Move to next step
        wizardState.currentStep++;

        // Show next step
        const nextStepEl = document.getElementById(`step${wizardState.currentStep}`);
        nextStepEl.classList.add('active', 'animate-in');

        // If on review step, generate summary
        if (wizardState.currentStep === wizardState.totalSteps) {
            generateConfigSummary();
            generateConfigPreview();
        }

        // Update UI
        updateProgressUI();
        updateNavigationButtons();

        // Scroll to top of wizard
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

/**
 * Navigate to previous step
 */
function previousStep() {
    if (wizardState.currentStep > 1) {
        // Hide current step
        const currentStepEl = document.getElementById(`step${wizardState.currentStep}`);
        currentStepEl.classList.remove('active');

        // Move to previous step
        wizardState.currentStep--;

        // Show previous step
        const prevStepEl = document.getElementById(`step${wizardState.currentStep}`);
        prevStepEl.classList.add('active', 'animate-in');

        // Update UI
        updateProgressUI();
        updateNavigationButtons();

        // Scroll to top of wizard
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

/**
 * Update progress indicators
 */
function updateProgressUI() {
    const step = wizardState.currentStep;
    const total = wizardState.totalSteps;

    // Update step counter
    document.getElementById('stepCounter').textContent = `Step ${step} of ${total}`;

    // Update progress bar
    const progress = (step / total) * 100;
    document.getElementById('progressFill').style.width = `${progress}%`;

    // Update step indicators
    for (let i = 1; i <= total; i++) {
        const indicator = document.querySelector(`.step-indicator[data-step="${i}"]`);
        const connector = document.querySelector(`.step-connector[data-step="${i}"]`);

        if (indicator) {
            indicator.classList.remove('active', 'completed');
            if (i === step) {
                indicator.classList.add('active');
            } else if (i < step) {
                indicator.classList.add('completed');
                indicator.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>';
            } else {
                indicator.textContent = i;
            }
        }

        if (connector) {
            connector.classList.toggle('completed', i < step);
        }
    }
}

/**
 * Update navigation button visibility
 */
function updateNavigationButtons() {
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');

    // Show/hide previous button
    prevBtn.style.visibility = wizardState.currentStep > 1 ? 'visible' : 'hidden';

    // Update next button text on last step
    if (wizardState.currentStep === wizardState.totalSteps) {
        nextBtn.style.display = 'none';
    } else {
        nextBtn.style.display = 'flex';
    }
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
        { label: 'Axis limits', value: `C home=${config.cHomePos}°, B=±${config.bRange}°` },
        { label: 'Event after homing', value: config.eventAfterHomingEnabled ? 'Enabled' : 'Disabled' },
        { label: 'IK default', value: config.ikEnabled ? 'Enabled' : 'Disabled' }
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
            downloadFile('Configuration.h', configH);
        }, 300);

        // Generate Configuration_adv.h
        setTimeout(() => {
            const configAdvH = ConfigGenerator.generateConfigurationAdvH(config);
            downloadFile('Configuration_adv.h', configAdvH);
        }, 600);
    }
}

/**
 * Download a file
 */
function downloadFile(filename, content) {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
            // IK parameters
            ikEnabled: config.ikEnabled,
            ikLC: config.ikLC,
            ikLB: config.ikLB,
            cHomePos: config.cHomePos,
            bRange: config.bRange,
            eventAfterHomingEnabled: config.eventAfterHomingEnabled,
            eventAfterHomingGcode: config.eventAfterHomingGcode,
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
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'firmware.bin';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Sleep helper
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Export current configuration as JSON file
 * @param {boolean} showToast - Whether to show toast notification (default true)
 */
function exportConfig(showToast = true) {
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

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `rep5x-firmware-config-${timestamp}.json`;

    // Download as JSON
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Show feedback toast
    if (showToast) {
        showConfigToast('Configuration saved', 'save');
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

            // Show success toast
            showConfigToast('Configuration loaded', 'load');

        } catch (error) {
            console.error('Import error:', error);
            showConfigToast('Invalid config file', 'error');
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

    // === IK Parameters ===
    document.getElementById('ikEnabled').checked = config.ikEnabled;
    document.getElementById('ikLC').value = config.ikLC;
    document.getElementById('ikLB').value = config.ikLB;
    document.getElementById('segmentsPerSecond').value = config.segmentsPerSecond;
}

/**
 * Show a toast notification for config actions
 */
function showConfigToast(message, type = 'save') {
    // Remove existing toast if any
    const existingToast = document.querySelector('.config-toast');
    if (existingToast) {
        existingToast.remove();
    }

    // Create toast element
    const toast = document.createElement('div');
    toast.className = 'config-toast';

    const iconSvg = type === 'error'
        ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>'
        : type === 'load'
        ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>'
        : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>';

    toast.innerHTML = `
        <div class="toast-icon" style="${type === 'error' ? 'background: #ef4444;' : ''}">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">${iconSvg}</svg>
        </div>
        <span>${message}</span>
    `;

    document.body.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    // Auto-remove after delay
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', initWizard);
