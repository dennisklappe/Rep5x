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
    }

    /**
     * Set up event listeners for this step
     */
    setup() {
        document.getElementById('export-csv-btn').addEventListener('click', () => {
            const csv = this.app.engine.exportCSV();
            this.downloadFile('calibration-data.csv', csv, 'text/csv');
        });

        document.getElementById('export-json-btn').addEventListener('click', () => {
            const json = JSON.stringify(this.app.engine.exportJSON(), null, 2);
            this.downloadFile('calibration-data.json', json, 'application/json');
        });

        document.getElementById('save-results-btn').addEventListener('click', () => {
            const data = this.app.engine.exportJSON();
            StorageManager.saveCalibrationData(data);
            alert('Calibration data saved!');
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
            this.downloadFile(filename, gcode, 'text/plain');
        } catch (error) {
            alert('Error generating G-code: ' + error.message);
        }
    }

    /**
     * Called when entering this step
     */
    enter() {
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
    }

    downloadFile(filename, content, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }
}
