/**
 * Step 4: Results
 * Handles results display, export, and saving
 */

class StepResults {
    constructor(app) {
        this.app = app;
        this.graphRendererC = null;  // Graph for C sweep (shows C angles at B=0)
        this.graphRendererB = null;  // Graph for B sweep (shows B angles at C=0)
        this.visualizer = null;      // 3D Nozzle position visualizer
        this.corrector = null;       // CalibrationCorrector for visualizer
        this.existingCoeffs = null;  // Existing M667 coefficients from printer
        this.refineMode = false;     // If true, add new offsets to existing
    }

    /**
     * Set up event listeners for this step
     */
    setup() {
        document.getElementById('export-csv-btn').addEventListener('click', () => {
            const csv = this.app.engine.exportCSV();
            downloadCSV(csv, 'calibration-data.csv');
        });

        document.getElementById('export-json-btn').addEventListener('click', () => {
            const json = JSON.stringify(this.app.engine.exportJSON(), null, 2);
            downloadFile(json, 'calibration-data.json', 'application/json');
        });

        document.getElementById('export-firmware-btn').addEventListener('click', () => {
            this.exportToFirmware();
        });

        document.getElementById('results-refine-btn')?.addEventListener('click', () => {
            this.startRefineCalibration();
        });

        // Initialise both graphs
        const graphACanvas = document.getElementById('results-graph-c');
        const graphBCanvas = document.getElementById('results-graph-b');

        if (graphACanvas) {
            this.graphRendererC = new GraphRenderer(graphACanvas);
        }
        if (graphBCanvas) {
            this.graphRendererB = new GraphRenderer(graphBCanvas);
        }

        // Initialize 3D visualizer
        const vizContainer = document.getElementById('results-viz-container');
        if (vizContainer) {
            this.visualizer = new CalibrationVisualizer3D(vizContainer);

            // Click to toggle animation
            vizContainer.addEventListener('click', (e) => {
                // Only toggle if not dragging (orbit controls)
                if (!e.target.closest('canvas')) return;
                this.visualizer.toggle();
            });

            // Mode toggle buttons
            document.getElementById('results-viz-uncal').addEventListener('click', () => {
                this.visualizer.setMode('uncalibrated');
                document.getElementById('results-viz-uncal').className = 'text-xs px-3 py-1 rounded bg-red-500 text-white';
                document.getElementById('results-viz-cal').className = 'text-xs px-3 py-1 rounded bg-gray-300 text-gray-700 hover:bg-gray-400';
            });

            document.getElementById('results-viz-cal').addEventListener('click', () => {
                this.visualizer.setMode('calibrated');
                document.getElementById('results-viz-cal').className = 'text-xs px-3 py-1 rounded bg-teal-500 text-white';
                document.getElementById('results-viz-uncal').className = 'text-xs px-3 py-1 rounded bg-gray-300 text-gray-700 hover:bg-gray-400';
            });

            // Sweep mode buttons
            const sweepBtns = {
                'results-viz-sweep-c': 'c',
                'results-viz-sweep-b': 'b',
                'results-viz-sweep-both': 'both',
                'results-viz-sweep-combined': 'combined'
            };

            for (const [btnId, mode] of Object.entries(sweepBtns)) {
                document.getElementById(btnId).addEventListener('click', () => {
                    this.visualizer.setSweepMode(mode);
                    // Update button styles
                    for (const id of Object.keys(sweepBtns)) {
                        document.getElementById(id).className = id === btnId
                            ? 'text-xs px-3 py-1 rounded bg-gray-600 text-white'
                            : 'text-xs px-3 py-1 rounded bg-gray-300 text-gray-700';
                    }
                });
            }

            // Reset button
            document.getElementById('results-viz-reset').addEventListener('click', () => {
                this.visualizer.reset();
            });

            // G-code generation buttons
            document.getElementById('gen-gcode-uncal').addEventListener('click', () => {
                this.downloadDemoGcode('uncalibrated');
            });

            document.getElementById('gen-gcode-cal').addEventListener('click', () => {
                this.downloadDemoGcode('calibrated');
            });
        }
    }

    /**
     * Generate and download demo G-code
     */
    downloadDemoGcode(mode) {
        if (!this.visualizer || !this.corrector) {
            alert('Please wait for calibration data to load');
            return;
        }

        try {
            // Temporarily set mode for generation
            const originalMode = this.visualizer.mode;
            this.visualizer.mode = mode;

            // Read inputs
            const applyIK = document.getElementById('gen-gcode-apply-ik')?.checked ?? true;
            const centerX = parseFloat(document.getElementById('gen-gcode-center-x')?.value) || 100.7;
            const centerY = parseFloat(document.getElementById('gen-gcode-center-y')?.value) || 99.5;
            const centerZ = parseFloat(document.getElementById('gen-gcode-center-z')?.value) || 141.3;

            const gcode = this.visualizer.generateDemoGcode({
                mode: mode,
                sweepMode: this.visualizer.sweepMode,
                applyIK: applyIK,
                centerX: centerX,
                centerY: centerY,
                centerZ: centerZ
            });

            // Restore mode
            this.visualizer.mode = originalMode;

            // Download
            const filename = `rep5x-demo-${mode}-${this.visualizer.sweepMode}.gcode`;
            downloadGcode(gcode, filename);
        } catch (error) {
            alert('Error generating G-code: ' + error.message);
        }
    }

    /**
     * Called when entering this step
     */
    async enter() {
        // Re-enable IK now that calibration is complete
        if (this.app.printer && this.app.printer.isConnected()) {
            try {
                await this.app.printer.sendCommandAndWait('G43.4', 5000);
            } catch (e) {
                console.warn('Could not re-enable IK:', e);
            }
        }

        // Get refine mode from app (set during calibration start modal)
        this.refineMode = this.app.refineMode || false;
        console.log('[Results] Refine mode:', this.refineMode ? 'ON' : 'OFF');

        // Hide next button on results page
        document.getElementById('nextBtn').style.display = 'none';

        // Update both graphs - show all axes in results view
        if (this.graphRendererC) {
            this.graphRendererC.calibrationPhase = 'full';
            this.graphRendererC.setDataFromEngine(this.app.engine);
            this.graphRendererC.setViewMode('b', 0);  // Show C angles for B=0
            this.graphRendererC.render();
        }

        if (this.graphRendererB) {
            this.graphRendererB.calibrationPhase = 'full';
            this.graphRendererB.setDataFromEngine(this.app.engine);
            this.graphRendererB.setViewMode('c', 0);  // Show B angles for C=0
            this.graphRendererB.render();
        }

        // Initialize visualizer with calibration data
        if (this.visualizer) {
            // Create corrector from engine data
            this.corrector = new CalibrationCorrector();
            const jsonData = this.app.engine.exportJSON();
            this.corrector.loadFromJSON(jsonData);
            this.visualizer.setCorrector(this.corrector);

            // Set default sweep mode to "both" and auto-play
            this.visualizer.setSweepMode('both');

            // Update sweep mode button styles to show "both" as active
            const sweepBtnIds = ['results-viz-sweep-c', 'results-viz-sweep-b', 'results-viz-sweep-both', 'results-viz-sweep-combined'];
            sweepBtnIds.forEach(id => {
                const btn = document.getElementById(id);
                if (btn) {
                    btn.className = id === 'results-viz-sweep-both'
                        ? 'text-xs px-3 py-1 rounded bg-gray-600 text-white'
                        : 'text-xs px-3 py-1 rounded bg-gray-300 text-gray-700';
                }
            });

            // Auto-start the animation
            this.visualizer.start();
        }

        // Update statistics
        const stats = this.app.engine.getStatistics();
        if (stats) {
            document.getElementById('result-x-max').textContent = `Max: ${stats.x.absMax.toFixed(3)} mm`;
            document.getElementById('result-x-avg').textContent = `Avg: ${stats.x.absAvg.toFixed(3)} mm`;
            document.getElementById('result-y-max').textContent = `Max: ${stats.y.absMax.toFixed(3)} mm`;
            document.getElementById('result-y-avg').textContent = `Avg: ${stats.y.absAvg.toFixed(3)} mm`;
            document.getElementById('result-z-max').textContent = `Max: ${stats.z.absMax.toFixed(3)} mm`;
            document.getElementById('result-z-avg').textContent = `Avg: ${stats.z.absAvg.toFixed(3)} mm`;
        }

        // Auto-save calibration to firmware
        if (this.app.printer && this.app.printer.isConnected()) {
            await this.exportToFirmware();
        }
    }

    /**
     * Export calibration data to firmware M667 commands
     * Uses Fourier fitting to convert measurement points to coefficients
     * If refine mode is enabled, adds new offsets to existing calibration
     */
    async exportToFirmware() {
        try {
            // Get measurement data from engine
            const cSweepData = this.app.engine.getMeasurementsByB(0);  // C sweep at B=0
            const bSweepData = this.app.engine.getMeasurementsByC(0);  // B sweep at C=0

            if (cSweepData.length === 0 && bSweepData.length === 0) {
                alert('No calibration data to export. Please complete calibration first.');
                return;
            }

            // If refine mode, first read existing coefficients from printer
            if (this.refineMode && this.app.printer && this.app.printer.isConnected()) {
                console.log('[Results] Refine mode: reading existing coefficients...');
                this.existingCoeffs = await this.readExistingCoefficients();
                console.log('[Results] Existing coefficients:', this.existingCoeffs);

                // Validate that we got actual coefficients (not all nulls)
                const hasValidCoeffs = this.existingCoeffs &&
                    (this.existingCoeffs.cSweep?.x || this.existingCoeffs.cSweep?.y ||
                     this.existingCoeffs.bSweep?.x || this.existingCoeffs.bSweep?.y);
                if (!hasValidCoeffs) {
                    console.error('[Results] WARNING: Could not read existing coefficients from printer!');
                    console.error('[Results] Refine mode will NOT combine - using new measurements only');
                    this.existingCoeffs = null;  // Force non-combine path
                }
            }

            // Check if Z calibration was completed or skipped
            const zCalibrationCompleted = this.app.zCalibrationCompleted !== false;
            console.log('[Results] Z calibration completed:', zCalibrationCompleted);

            // Convert to format for Fourier fitting
            // If Z calibration was skipped, set Z errors to 0 so they don't affect the fit
            const cSweepPoints = cSweepData.map(m => ({
                c: m.c,
                errorX: m.error?.x || 0,
                errorY: m.error?.y || 0,
                errorZ: zCalibrationCompleted ? (m.error?.z || 0) : 0
            }));

            const bSweepPoints = bSweepData.map(m => ({
                b: m.b,
                errorX: m.error?.x || 0,
                errorY: m.error?.y || 0,
                errorZ: zCalibrationCompleted ? (m.error?.z || 0) : 0
            }));

            console.log('C sweep points for fitting:', cSweepPoints);
            console.log('B sweep points for fitting:', bSweepPoints);

            // Fit Fourier series
            // C sweep: 3 harmonics (7 coefficients per axis) - periodic 0-360
            // B sweep: 2 harmonics (5 coefficients per axis) - not periodic
            const cSweepCoeffs = FourierFitter.fitSweep(cSweepPoints, 'c', 3);
            const bSweepCoeffs = FourierFitter.fitSweep(bSweepPoints, 'b', 2);

            console.log('New C sweep coefficients:', cSweepCoeffs);
            console.log('New B sweep coefficients:', bSweepCoeffs);

            // Structure for combining
            let finalCoeffs = {
                cSweep: { x: cSweepCoeffs.x, y: cSweepCoeffs.y, z: cSweepCoeffs.z },
                bSweep: { x: bSweepCoeffs.x, y: bSweepCoeffs.y, z: bSweepCoeffs.z }
            };

            // If refine mode, combine with existing
            if (this.refineMode && this.existingCoeffs) {
                console.log('[Results] Combining new offsets with existing calibration...');
                finalCoeffs = FourierFitter.combineCoefficients(this.existingCoeffs, finalCoeffs);
                console.log('[Results] Combined coefficients:', finalCoeffs);

                // If Z was skipped, use existing Z coefficients unchanged
                if (!zCalibrationCompleted) {
                    console.log('[Results] Z skipped - preserving existing Z coefficients');
                    finalCoeffs.cSweep.z = this.existingCoeffs.cSweep?.z || [0, 0, 0, 0, 0, 0, 0];
                    finalCoeffs.bSweep.z = this.existingCoeffs.bSweep?.z || [0, 0, 0, 0, 0];
                }
            }

            // Generate M667 commands
            const commands = FourierFitter.generateM667FromCoeffs(finalCoeffs);

            // Send directly to printer if connected
            await this.sendCalibrationToFirmware(commands);

        } catch (error) {
            console.error('Error exporting to firmware:', error);
            alert('Error exporting to firmware: ' + error.message);
        }
    }

    /**
     * Read existing calibration coefficients from printer
     */
    async readExistingCoefficients() {
        if (!this.app.printer || !this.app.printer.isConnected()) {
            return null;
        }

        try {
            // Send M667 with no parameters to get current state
            const response = await this.app.printer.sendCommandAndCapture('M667', 5000);
            console.log('[Results] M667 raw response:');
            console.log(response);
            console.log('[Results] Response lines:');
            response.split('\n').forEach((line, i) => console.log(`  ${i}: "${line}"`));

            // Parse the response
            const parsed = FourierFitter.parseM667Response(response);
            console.log('[Results] Parsed coefficients:', JSON.stringify(parsed, null, 2));
            return parsed;
        } catch (error) {
            console.warn('[Results] Could not read existing coefficients:', error);
            return null;
        }
    }

    /**
     * Send calibration commands directly to the printer
     */
    async sendCalibrationToFirmware(commands) {
        // Check if printer is connected
        if (!this.app.printer || !this.app.printer.isConnected()) {
            alert('Printer not connected. Please reconnect to send calibration data.');
            return;
        }

        const btn = document.getElementById('export-firmware-btn');
        const originalText = btn?.textContent || 'Export to Firmware';

        try {
            if (btn) {
                btn.disabled = true;
                btn.textContent = 'Sending...';
            }

            // Parse commands and send only the M667 lines (skip comments)
            const lines = commands.split('\n').filter(line => {
                const trimmed = line.trim();
                return trimmed.startsWith('M667') || trimmed.startsWith('M500');
            });

            console.log('[Results] Sending calibration commands:', lines);

            for (const line of lines) {
                console.log('[Results] Sending:', line);
                await this.app.printer.sendCommandAndWait(line, 5000);
            }

            // Save to EEPROM
            await this.app.printer.sendCommandAndWait('M500', 5000);
            console.log('[Results] Calibration saved to EEPROM');

            if (btn) {
                btn.textContent = 'Saved to EEPROM ✓';
                btn.disabled = false;
            }

            // Show refine option
            const refineSection = document.getElementById('refine-section');
            if (refineSection) {
                refineSection.classList.remove('hidden');
            }

        } catch (error) {
            console.error('[Results] Error sending calibration:', error);
            alert('Error sending calibration: ' + error.message);
            if (btn) {
                btn.textContent = originalText;
                btn.disabled = false;
            }
        }
    }

    /**
     * Start a new calibration pass in refine mode
     * This will add corrections on top of existing calibration
     */
    startRefineCalibration() {
        // Clear measurements but keep refine mode enabled
        this.app.engine.measurements.clear();
        this.app.engine.currentIndex = 0;

        // Set refine mode so new calibration adds to existing
        // IMPORTANT: Use this.app.refineMode (not this.app.calibration.refineMode)
        this.app.refineMode = true;

        // Hide refine section
        const refineSection = document.getElementById('refine-section');
        if (refineSection) {
            refineSection.classList.add('hidden');
        }

        // Reset the save button
        const btn = document.getElementById('export-firmware-btn');
        if (btn) {
            btn.textContent = 'Save to Firmware';
            btn.disabled = false;
        }

        // Go to prepare step (step 2) so user can reposition camera and confirm reference
        // Camera needs to switch back from Z (horizontal) to XY (vertical) position
        this.app.goToStep(2);
    }
}
