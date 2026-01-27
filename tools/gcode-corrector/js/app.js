/**
 * G-code Corrector Application
 * Main application controller
 */

class GcodeCorrectorApp {
    constructor() {
        this.corrector = new CalibrationCorrector();
        this.processor = new GcodeProcessor();
        this.processor.setCalibrationCorrector(this.corrector);

        this.inputGcode = '';
        this.outputGcode = '';

        // Graph renderer for calibration visualisation
        this.graphRenderer = null;

        // Calibration visualizer
        this.visualizer = null;

        // Load saved LC/LB
        const lc = StorageManager.loadLc() || 0;
        const lb = StorageManager.loadLb() || 47;
        this.processor.setIKParameters(lc, lb);
    }

    init() {
        this.setupEventListeners();
        this.initGraph();
        this.loadCalibrationFromStorage();
        this.updateUI();
    }

    initGraph() {
        const canvas = document.getElementById('calibrationGraph');
        if (canvas) {
            this.graphRenderer = new CorrectionGraphRenderer(canvas);

            // Graph view toggle buttons
            document.getElementById('graphViewC').addEventListener('click', () => {
                this.graphRenderer.setViewMode('c');
                document.getElementById('graphViewC').classList.add('active');
                document.getElementById('graphViewB').classList.remove('active');
            });

            document.getElementById('graphViewB').addEventListener('click', () => {
                this.graphRenderer.setViewMode('b');
                document.getElementById('graphViewB').classList.add('active');
                document.getElementById('graphViewC').classList.remove('active');
            });
        }

        // Set up visualizer controls (visualizer created later when section visible)
        this.vizContainer = document.getElementById('calibrationViz');
        this.setupVisualizerControls();
    }

    setupVisualizerControls() {
        if (!this.vizContainer) return;

        // Click to toggle animation
        this.vizContainer.addEventListener('click', (e) => {
            // Only toggle if clicking on the canvas (not during orbit control drag)
            if (!this.visualizer || !e.target.closest('canvas')) return;
            this.visualizer.toggle();
        });

        // Mode toggle (uncalibrated vs calibrated)
        document.getElementById('vizModeUncal').addEventListener('click', () => {
            if (!this.visualizer) return;
            this.visualizer.setMode('uncalibrated');
            document.getElementById('vizModeUncal').classList.remove('bg-gray-700');
            document.getElementById('vizModeUncal').classList.add('bg-red-600');
            document.getElementById('vizModeCal').classList.remove('bg-teal-600');
            document.getElementById('vizModeCal').classList.add('bg-gray-700');
        });

        document.getElementById('vizModeCal').addEventListener('click', () => {
            if (!this.visualizer) return;
            this.visualizer.setMode('calibrated');
            document.getElementById('vizModeCal').classList.remove('bg-gray-700');
            document.getElementById('vizModeCal').classList.add('bg-teal-600');
            document.getElementById('vizModeUncal').classList.remove('bg-red-600');
            document.getElementById('vizModeUncal').classList.add('bg-gray-700');
        });

        // Sweep mode buttons (Both is default)
        const sweepButtons = ['vizSweepBoth', 'vizSweepC', 'vizSweepB', 'vizSweepCombined'];
        const sweepModes = ['both', 'c', 'b', 'combined'];

        sweepButtons.forEach((btnId, index) => {
            document.getElementById(btnId).addEventListener('click', () => {
                if (!this.visualizer) return;
                this.visualizer.setSweepMode(sweepModes[index]);
                sweepButtons.forEach(id => {
                    document.getElementById(id).classList.remove('bg-gray-600');
                    document.getElementById(id).classList.add('bg-gray-700');
                });
                document.getElementById(btnId).classList.remove('bg-gray-700');
                document.getElementById(btnId).classList.add('bg-gray-600');
            });
        });

        // G-code generation buttons
        document.getElementById('genGcodeUncal').addEventListener('click', () => {
            this.downloadDemoGcode('uncalibrated');
        });

        document.getElementById('genGcodeCal').addEventListener('click', () => {
            this.downloadDemoGcode('calibrated');
        });
    }

    downloadDemoGcode(mode) {
        if (!this.visualizer || !this.corrector.loaded) {
            alert('Please load calibration data first');
            return;
        }

        try {
            // Temporarily set mode for generation
            const originalMode = this.visualizer.mode;
            this.visualizer.mode = mode;

            // Read inputs
            const applyIK = document.getElementById('genGcodeApplyIK')?.checked ?? true;
            const centerX = parseFloat(document.getElementById('genGcodeCenterX')?.value) || 100.7;
            const centerY = parseFloat(document.getElementById('genGcodeCenterY')?.value) || 99.5;
            const centerZ = parseFloat(document.getElementById('genGcodeCenterZ')?.value) || 141.3;

            const gcode = this.visualizer.generateDemoGcode({
                mode: mode,
                sweepMode: 'both',  // Always use 'both' for demo G-code (tests C and B sweeps)
                applyIK: applyIK,
                centerX: centerX,
                centerY: centerY,
                centerZ: centerZ
            });

            // Restore mode
            this.visualizer.mode = originalMode;

            // Download using shared utility
            const filename = `rep5x-demo-${mode}-both.gcode`;
            downloadGcode(gcode, filename);
        } catch (error) {
            alert('Error generating G-code: ' + error.message);
        }
    }

    setupEventListeners() {
        // Calibration file import with drag and drop
        const calibrationDropZone = document.getElementById('calibrationDropZone');
        const calibrationFileInput = document.getElementById('calibrationFile');

        calibrationFileInput.addEventListener('change', (e) => this.handleCalibrationFile(e));
        document.getElementById('loadBrowserCalibration').addEventListener('click', () => this.loadCalibrationFromStorage());

        // Calibration drag and drop (using shared utility)
        setupDropZone(calibrationDropZone, calibrationFileInput, (e) => this.handleCalibrationFile(e));

        // G-code file import with drag and drop
        const gcodeDropZone = document.getElementById('gcodeDropZone');
        const gcodeFileInput = document.getElementById('gcodeFile');

        gcodeFileInput.addEventListener('change', (e) => this.handleGcodeFile(e));

        // G-code drag and drop (using shared utility)
        setupDropZone(gcodeDropZone, gcodeFileInput, (e) => this.handleGcodeFile(e));

        // Processing options
        document.getElementById('applyIK').addEventListener('change', () => this.updateUI());
        document.getElementById('applyCalibration').addEventListener('change', () => this.updateUI());
        document.getElementById('firmwareIK').addEventListener('change', () => this.updateUI());

        // LC/LB inputs
        document.getElementById('lcParam').addEventListener('change', (e) => {
            const lc = parseFloat(e.target.value) || 0;
            const lb = parseFloat(document.getElementById('lbParam').value) || 47;
            this.processor.setIKParameters(lc, lb);
            this.updatePreview();
        });
        document.getElementById('lbParam').addEventListener('change', (e) => {
            const lc = parseFloat(document.getElementById('lcParam').value) || 0;
            const lb = parseFloat(e.target.value) || 47;
            this.processor.setIKParameters(lc, lb);
            this.updatePreview();
        });

        // Process button
        document.getElementById('processBtn').addEventListener('click', () => this.processGcode());

        // Download button
        document.getElementById('downloadBtn').addEventListener('click', () => this.downloadOutput());

        // Copy button
        document.getElementById('copyBtn').addEventListener('click', () => this.copyToClipboard());
    }

    async handleCalibrationFile(e) {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            const data = JSON.parse(text);

            // Update drop zone UI to show selected state
            document.getElementById('calibrationDropContent').classList.add('hidden');
            document.getElementById('calibrationFileSelected').classList.remove('hidden');
            document.getElementById('calibrationFileName').textContent = file.name;

            this.loadCalibrationData(data);
        } catch (error) {
            showStatus('calibrationStatus', 'Failed to load: ' + error.message, 'error');
        }
    }

    loadCalibrationFromStorage() {
        const data = StorageManager.loadCalibrationData();
        if (data) {
            // Update drop zone UI to show loaded state
            document.getElementById('calibrationDropContent').classList.add('hidden');
            document.getElementById('calibrationFileSelected').classList.remove('hidden');
            document.getElementById('calibrationFileName').textContent = 'Loaded from browser storage';

            this.loadCalibrationData(data);
        } else {
            showStatus('calibrationStatus', 'No calibration data in browser storage', 'warning');
        }
    }

    loadCalibrationData(data) {
        try {
            const result = this.corrector.loadFromJSON(data);

            // Update LC/LB from calibration data
            if (data.metadata) {
                const lc = data.metadata.lc || 0;
                const lb = data.metadata.lb || 47;
                document.getElementById('lcParam').value = lc.toFixed(2);
                document.getElementById('lbParam').value = lb.toFixed(2);
                this.processor.setIKParameters(lc, lb);
            }

            // Show statistics
            const stats = this.corrector.getStatistics();
            showStatus('calibrationStatus',
                `Loaded: ${result.cSweepPoints} C-sweep + ${result.bSweepPoints} B-sweep points. ` +
                `Max errors: X=${stats.x.absMax.toFixed(2)}mm, Y=${stats.y.absMax.toFixed(2)}mm, Z=${stats.z.absMax.toFixed(2)}mm`,
                'success'
            );

            // Update and show graph
            this.updateGraph();

            this.updateUI();
            this.updatePreview();
        } catch (error) {
            showStatus('calibrationStatus', 'Error: ' + error.message, 'error');
            this.hideGraph();
        }
    }

    updateGraph() {
        if (this.corrector.loaded) {
            // Show section first so canvas has dimensions
            document.getElementById('calibrationGraphSection').classList.remove('hidden');
            // Small delay to ensure layout is calculated before rendering
            requestAnimationFrame(() => {
                if (this.graphRenderer) {
                    this.graphRenderer.setDataFromCorrector(this.corrector);
                }
                // Create 3D visualizer now that container is visible
                if (!this.visualizer && this.vizContainer) {
                    this.visualizer = new CalibrationVisualizer3D(this.vizContainer);
                }
                if (this.visualizer) {
                    this.visualizer.setCorrector(this.corrector);
                }
            });
        }
    }

    hideGraph() {
        document.getElementById('calibrationGraphSection').classList.add('hidden');
    }

    async handleGcodeFile(e) {
        const file = e.target.files[0];
        if (!file) return;

        try {
            this.inputGcode = await file.text();
            const lineCount = this.inputGcode.split('\n').length;

            // Detect existing headers
            const detected = this.processor.detectHeaders(this.inputGcode);

            // Update drop zone UI to show selected state
            document.getElementById('gcodeDropContent').classList.add('hidden');
            document.getElementById('gcodeFileSelected').classList.remove('hidden');
            document.getElementById('inputFileName').textContent = file.name;
            document.getElementById('inputFileSize').textContent = `${this.formatFileSize(file.size)} • ${lineCount} lines`;

            let statusMsg = `Loaded successfully`;
            if (detected.hasRep5xHeaders) {
                statusMsg += ' - Rep5x headers detected';
            }
            showStatus('gcodeStatus', statusMsg, 'success');

            // Show detected info and prefill options
            this.handleDetectedHeaders(detected);

            this.updateUI();
            this.updatePreview();
        } catch (error) {
            showStatus('gcodeStatus', 'Error loading file: ' + error.message, 'error');
        }
    }

    formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    handleDetectedHeaders(detected) {
        const warningDiv = document.getElementById('headerWarnings');
        const infoDiv = document.getElementById('headerInfo');

        // Clear previous warnings and hide divs
        if (warningDiv) {
            warningDiv.innerHTML = '';
            warningDiv.classList.add('hidden');
        }
        if (infoDiv) {
            infoDiv.innerHTML = '';
            infoDiv.classList.add('hidden');
        }

        // Reset checkbox states to defaults before applying detected settings
        document.getElementById('applyIK').disabled = false;
        document.getElementById('applyIK').checked = true;  // Default to checked
        document.getElementById('firmwareIK').disabled = false;
        document.getElementById('firmwareIK').checked = false;
        document.getElementById('applyCalibration').checked = false;

        if (!detected.hasRep5xHeaders) {
            // No Rep5x headers - show info
            if (infoDiv) {
                infoDiv.innerHTML = `
                    <div class="p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
                        <strong>No Rep5x headers detected</strong> - This file may be from another slicer or generator.
                        Select the appropriate options below based on how the file was created.
                    </div>`;
                infoDiv.classList.remove('hidden');
            }
            return;
        }

        // Build info message
        let infoHtml = '<div class="p-3 bg-blue-50 rounded-lg text-sm text-blue-800">';
        infoHtml += '<strong>Detected Rep5x headers:</strong><ul class="mt-1 ml-4 list-disc">';

        if (detected.generator) {
            infoHtml += `<li>Generated by: ${detected.generator}</li>`;
        }
        if (detected.processedBy) {
            infoHtml += `<li>Previously processed by: ${detected.processedBy}</li>`;
        }
        if (detected.ikType) {
            infoHtml += `<li>IK: ${detected.ikType === 'disabled' ? 'disabled' : detected.ikType}</li>`;
        }
        if (detected.lc !== null) {
            infoHtml += `<li>LC: ${detected.lc}</li>`;
        }
        if (detected.lb !== null) {
            infoHtml += `<li>LB: ${detected.lb}</li>`;
        }
        if (detected.calibrationEnabled) {
            infoHtml += `<li>Calibration: ${detected.calibrationMode || 'enabled'}</li>`;
        }

        infoHtml += '</ul></div>';

        if (infoDiv) {
            infoDiv.innerHTML = infoHtml;
            infoDiv.classList.remove('hidden');
        }

        // Prefill LC/LB from headers if available
        if (detected.lc !== null) {
            document.getElementById('lcParam').value = detected.lc.toFixed(2);
        }
        if (detected.lb !== null) {
            document.getElementById('lbParam').value = detected.lb.toFixed(2);
            // Update processor too
            const lc = parseFloat(document.getElementById('lcParam').value) || 0;
            this.processor.setIKParameters(lc, detected.lb);
        }

        // Handle warnings based on what's detected
        let warnings = [];

        if (detected.ikEnabled && detected.ikType === 'software') {
            // Software IK already applied - coordinates are machine coords
            warnings.push({
                type: 'warning',
                message: `This file already has software IK applied (machine coordinates). Both "Apply IK" and "Firmware IK mode" have been disabled to prevent double-IK.`
            });

            // Disable both IK options
            document.getElementById('applyIK').checked = false;
            document.getElementById('applyIK').disabled = true;
            document.getElementById('firmwareIK').checked = false;
            document.getElementById('firmwareIK').disabled = true;

            // Show info about what they can do
            if (!detected.calibrationEnabled) {
                warnings.push({
                    type: 'info',
                    message: `Since IK is already applied, you can only apply calibration corrections to this file.`
                });
            }
        }

        if (detected.calibrationEnabled) {
            // Calibration already applied
            warnings.push({
                type: 'warning',
                message: `This file already has calibration corrections applied. Applying calibration again may overcorrect.`
            });
            // Uncheck but don't disable - user might want to re-apply with different calibration
            document.getElementById('applyCalibration').checked = false;
        }

        if (detected.processedBy === 'G-code Corrector') {
            warnings.push({
                type: 'info',
                message: `This file was already processed by G-code Corrector. Re-processing will add another header block.`
            });
        }

        // Display warnings
        if (warnings.length > 0 && warningDiv) {
            let warningHtml = '';
            for (const w of warnings) {
                const bgColor = w.type === 'warning' ? 'bg-yellow-50 border-yellow-200 text-yellow-800' : 'bg-blue-50 border-blue-200 text-blue-700';
                const icon = w.type === 'warning' ? '⚠️' : 'ℹ️';
                warningHtml += `<div class="p-3 ${bgColor} border rounded-lg text-sm mb-2">${icon} ${w.message}</div>`;
            }
            warningDiv.innerHTML = warningHtml;
            warningDiv.classList.remove('hidden');
        }
    }

    updateUI() {
        const hasGcode = this.inputGcode.length > 0;
        const hasCalibration = this.corrector.loaded;
        const detected = this.processor.getDetectedHeaders();

        // Check if IK should be disabled due to detected headers (software IK already applied)
        const ikAlreadyApplied = detected?.ikEnabled && detected?.ikType === 'software';

        const applyIKCheckbox = document.getElementById('applyIK');
        const firmwareIKCheckbox = document.getElementById('firmwareIK');

        // Handle IK checkbox states based on detected headers
        if (ikAlreadyApplied) {
            // Software IK already applied - disable both IK options
            applyIKCheckbox.disabled = true;
            applyIKCheckbox.checked = false;
            firmwareIKCheckbox.disabled = true;
            firmwareIKCheckbox.checked = false;
        } else if (firmwareIKCheckbox.checked) {
            // Firmware IK mode selected - disable software IK
            applyIKCheckbox.disabled = true;
            applyIKCheckbox.checked = false;
        } else {
            // Normal mode - enable software IK
            applyIKCheckbox.disabled = false;
        }

        const applyIK = applyIKCheckbox.checked;
        const firmwareIK = firmwareIKCheckbox.checked;
        const applyCalibration = document.getElementById('applyCalibration').checked;

        // Enable/disable process button
        // Can process if: has gcode AND (applying IK OR (applying calibration AND have calibration data))
        // Also allow if firmwareIK mode is on with calibration
        const canProcess = hasGcode && (applyIK || (applyCalibration && hasCalibration) || (firmwareIK && applyCalibration && hasCalibration));
        document.getElementById('processBtn').disabled = !canProcess;

        // Show/hide IK parameters based on mode
        const ikParamsDiv = document.getElementById('ikParams');
        if (applyIK && !firmwareIK) {
            ikParamsDiv.classList.remove('hidden');
        } else {
            ikParamsDiv.classList.add('hidden');
        }

        // Update firmware IK info
        const firmwareInfo = document.getElementById('firmwareIKInfo');
        if (firmwareIK) {
            firmwareInfo.classList.remove('hidden');
        } else {
            firmwareInfo.classList.add('hidden');
        }

        // Update calibration checkbox state
        if (!hasCalibration) {
            document.getElementById('applyCalibration').disabled = true;
        } else {
            document.getElementById('applyCalibration').disabled = false;
        }
    }

    updatePreview() {
        if (!this.inputGcode) {
            document.getElementById('previewContent').innerHTML = '<p class="text-gray-500">Load G-code to see analysis</p>';
            return;
        }

        const options = this.getProcessingOptions();
        const analysis = this.processor.analyzeCorrections(this.inputGcode, options);

        if (analysis.linesWithRotation === 0) {
            document.getElementById('previewContent').innerHTML =
                '<p class="text-gray-500">No lines with C/B rotation found in G-code</p>';
            return;
        }

        let html = '<div class="space-y-3 text-sm">';

        // Axis ranges
        html += '<div class="p-3 bg-gray-50 rounded-lg">';
        html += `<div class="font-medium text-gray-700 mb-1">Rotation ranges</div>`;
        html += `<div class="text-gray-600">`;
        if (analysis.aRange) {
            html += `A: ${analysis.aRange.min.toFixed(1)}° to ${analysis.aRange.max.toFixed(1)}°`;
        }
        if (analysis.bRange) {
            html += ` &nbsp;|&nbsp; B: ${analysis.bRange.min.toFixed(1)}° to ${analysis.bRange.max.toFixed(1)}°`;
        }
        html += `</div>`;
        html += `<div class="text-xs text-gray-500 mt-1">${analysis.linesWithRotation.toLocaleString()} lines with rotation</div>`;
        html += '</div>';

        // Max IK corrections
        if (analysis.maxIK) {
            html += '<div class="p-3 bg-blue-50 rounded-lg">';
            html += '<div class="font-medium text-blue-700 mb-2">Max IK corrections</div>';
            html += '<div class="grid grid-cols-3 gap-2 text-xs">';
            html += `<div><span class="text-blue-600 font-semibold">ΔX: ${analysis.maxIK.x.val.toFixed(2)}mm</span><br><span class="text-gray-500">@ C${analysis.maxIK.x.a.toFixed(0)}° B${analysis.maxIK.x.b.toFixed(0)}°</span></div>`;
            html += `<div><span class="text-blue-600 font-semibold">ΔY: ${analysis.maxIK.y.val.toFixed(2)}mm</span><br><span class="text-gray-500">@ C${analysis.maxIK.y.a.toFixed(0)}° B${analysis.maxIK.y.b.toFixed(0)}°</span></div>`;
            html += `<div><span class="text-blue-600 font-semibold">ΔZ: ${analysis.maxIK.z.val.toFixed(2)}mm</span><br><span class="text-gray-500">@ C${analysis.maxIK.z.a.toFixed(0)}° B${analysis.maxIK.z.b.toFixed(0)}°</span></div>`;
            html += '</div></div>';
        }

        // Max calibration corrections
        if (analysis.maxCalib) {
            html += '<div class="p-3 bg-green-50 rounded-lg">';
            html += '<div class="font-medium text-green-700 mb-2">Max calibration corrections</div>';
            html += '<div class="grid grid-cols-3 gap-2 text-xs">';
            html += `<div><span class="text-green-600 font-semibold">ΔX: ${analysis.maxCalib.x.val.toFixed(2)}mm</span><br><span class="text-gray-500">@ C${analysis.maxCalib.x.a.toFixed(0)}° B${analysis.maxCalib.x.b.toFixed(0)}°</span></div>`;
            html += `<div><span class="text-green-600 font-semibold">ΔY: ${analysis.maxCalib.y.val.toFixed(2)}mm</span><br><span class="text-gray-500">@ C${analysis.maxCalib.y.a.toFixed(0)}° B${analysis.maxCalib.y.b.toFixed(0)}°</span></div>`;
            html += `<div><span class="text-green-600 font-semibold">ΔZ: ${analysis.maxCalib.z.val.toFixed(2)}mm</span><br><span class="text-gray-500">@ C${analysis.maxCalib.z.a.toFixed(0)}° B${analysis.maxCalib.z.b.toFixed(0)}°</span></div>`;
            html += '</div></div>';
        }

        html += '</div>';
        document.getElementById('previewContent').innerHTML = html;
    }

    getProcessingOptions() {
        return {
            applyIK: document.getElementById('applyIK').checked && !document.getElementById('firmwareIK').checked,
            applyCalibration: document.getElementById('applyCalibration').checked,
            firmwareIK: document.getElementById('firmwareIK').checked,
            precision: 3
        };
    }

    processGcode() {
        if (!this.inputGcode) {
            alert('Please load a G-code file first');
            return;
        }

        const options = this.getProcessingOptions();

        try {
            this.outputGcode = this.processor.process(this.inputGcode, options);

            const stats = this.processor.getStatistics();

            // Show output
            document.getElementById('outputGcode').value = this.outputGcode;
            document.getElementById('outputSection').classList.remove('hidden');

            // Show statistics
            let statsHtml = `<strong>Processed:</strong> ${stats.processedLines} / ${stats.totalLines} lines`;

            if (stats.ikCorrectedLines > 0) {
                statsHtml += `<br>IK corrected: ${stats.ikCorrectedLines} lines`;
            }
            if (stats.calibrationCorrectedLines > 0) {
                statsHtml += `<br>Calibration corrected: ${stats.calibrationCorrectedLines} lines`;
                statsHtml += `<br>Max calibration: X=${stats.maxCorrectionX.toFixed(2)}mm, Y=${stats.maxCorrectionY.toFixed(2)}mm, Z=${stats.maxCorrectionZ.toFixed(2)}mm`;
            }

            document.getElementById('outputStats').innerHTML = statsHtml;

            // Enable download
            document.getElementById('downloadBtn').disabled = false;
            document.getElementById('copyBtn').disabled = false;

        } catch (error) {
            alert('Processing error: ' + error.message);
            console.error(error);
        }
    }

    downloadOutput() {
        if (!this.outputGcode) return;

        const inputName = document.getElementById('inputFileName').textContent || 'output';
        const baseName = inputName.replace(/\.[^/.]+$/, '');
        const filename = `${baseName}_corrected.gcode`;

        // Use shared utility
        downloadGcode(this.outputGcode, filename);
    }

    copyToClipboard() {
        if (!this.outputGcode) return;

        navigator.clipboard.writeText(this.outputGcode).then(() => {
            const btn = document.getElementById('copyBtn');
            const originalText = btn.textContent;
            btn.textContent = 'Copied!';
            setTimeout(() => btn.textContent = originalText, 2000);
        });
    }

}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new GcodeCorrectorApp();
    window.app.init();
});
