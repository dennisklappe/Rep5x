// Main application for Rep5x 5-axis G-code viewer
// Coordinates all components: UI, file handling, animation, and collision detection

class GcodePreviewerApp {
    constructor() {
        this.parser = new GcodeParser();
        this.fileHandler = new FileHandler(this.parser);
        this.ui = new UIController();
        this.animationEngine = null;
        this.collisionDetector = new CollisionDetector();
        this.ikReverser = null;
        this.calibrationReverser = null;
        this.currentData = null;

        // Reversal settings
        this.reverseIK = true;           // Auto-reverse IK if detected
        this.reverseCalibration = true;  // Auto-reverse calibration if detected

        this.initializeApp();
    }

    initializeApp() {
        try {
            this.animationEngine = new AnimationEngine('canvas3d');
            this.setupCallbacks();
            this.ui.setupEventListeners();
            this.initializePrintheadSelector();
            this.ui.hideLoading();
        } catch (error) {
            console.error('Error initializing app:', error);
            document.getElementById('loading').innerHTML =
                '<div class="text-center"><div style="color: #DC2626;">Error initializing 3D viewer: ' + error.message + '</div></div>';
        }
    }

    initializePrintheadSelector() {
        const printheads = PrintheadRegistry.getList();
        const currentId = this.animationEngine.getCurrentPrintheadId();
        this.ui.populatePrintheadSelector(printheads, currentId);
    }

    setupCallbacks() {
        // Animation engine callbacks
        this.animationEngine.updateProgressCallback = (progress) => this.handleProgressUpdate(progress);
        this.animationEngine.updatePositionCallback = (position) => this.ui.updatePositionDisplay(position);
        this.animationEngine.onPauseCallback = (message) => this.ui.showPauseMessage(message);

        // UI callbacks
        this.ui.onFileSelect = (file) => this.handleFileSelect(file);
        this.ui.onPlayPause = () => this.togglePlayPause();
        this.ui.onReset = () => this.resetAnimation();
        this.ui.onSpeedChange = (speed) => this.animationEngine.setSpeed(speed);
        this.ui.onProgressChange = (progress) => this.animationEngine.setProgress(progress);
        this.ui.onShowPrintheadChange = (show) => this.animationEngine.showPrinthead(show);
        this.ui.onShowAxisMarkerChange = (show) => this.animationEngine.showAxisMarker(show);
        this.ui.onShowRealisticHeadChange = (show) => this.animationEngine.showRealisticPrinthead(show);
        this.ui.onShowCollisionsChange = (enabled) => this.handleCollisionToggle(enabled);
        this.ui.onShowTravelMovesChange = (show) => this.animationEngine.setShowTravelMoves(show);
        this.ui.onPrintheadChange = (printheadId) => this.handlePrintheadChange(printheadId);
        this.ui.onManualModeChange = (enabled) => this.toggleManualMode(enabled);
        this.ui.onApplyManual = () => this.applyManualSettings();

        this.ui.onResize = () => {
            const container = document.querySelector('.canvas-container');
            const width = container.clientWidth;
            const height = container.clientHeight;
            this.animationEngine.camera.aspect = width / height;
            this.animationEngine.camera.updateProjectionMatrix();
            this.animationEngine.renderer.setSize(width, height);
        };
    }

    async handleFileSelect(file) {
        if (!file) return;

        this.ui.showFileSelected(file.name, this.fileHandler.formatFileSize(file.size));
        this.ui.showLoading('Loading G-code...');

        try {
            const parseResult = await this.fileHandler.loadFile(file);
            if (!parseResult) {
                this.ui.hideLoading();
                return;
            }

            this.currentData = parseResult;

            // Calculate print speed
            const printSpeed = this.fileHandler.calculateAverageFeedrate(parseResult.commands);
            if (printSpeed) {
                parseResult.metadata.calculatedPrintSpeed = printSpeed;
            }

            this.ui.displayFileInfo(parseResult.metadata, this.parser.getStatistics());
            this.ui.showAdvancedOptions();
            this.ui.prefillAdvancedOptions(parseResult.metadata);

            // Show notice if file uses A axis instead of C
            if (parseResult.metadata.usesAAxis) {
                this.ui.showToast(
                    '<strong>A axis detected:</strong> This G-code uses the A axis for yaw. Rep5x uses the <strong>C axis</strong> for yaw rotation. Values have been converted automatically.',
                    'warning',
                    8000
                );
            }

            // Process commands (with or without IK reversal)
            this.processCommands(parseResult);

            // Set default speed to 10x
            this.ui.setSpeed(10.0);
            this.animationEngine.setSpeed(10.0);

            this.ui.enableControls();
            this.ui.hideLoading();

        } catch (error) {
            console.error('Error loading G-code file:', error);
            let errorMessage = error.message;
            if (error.message.includes('Maximum call stack size')) {
                errorMessage = 'File too large or complex to process. Please try a smaller G-code file.';
            }
            alert('Error loading G-code file: ' + errorMessage);
            this.ui.hideLoading();
        }
    }

    processCommands(parseResult) {
        let commands = parseResult.commands;

        // Check for calibration correction in G-code
        this.calibrationReverser = new CalibrationReverser();
        const hasCalibration = this.calibrationReverser.parseFromGcode(this.fileHandler.lastFileContent || '');

        // Step 1: Reverse calibration if present and enabled
        if (hasCalibration && this.reverseCalibration) {
            commands = this.calibrationReverser.reverseCommandArray(commands);
            this.ui.displayCalibrationInfo(this.calibrationReverser.getSummary());
        }

        // Step 2: Reverse IK if present and enabled
        if (parseResult.metadata.inverseKinematics && this.reverseIK) {
            this.ikReverser = new InverseKinematicsReverser(
                parseResult.metadata.lcParameter,
                parseResult.metadata.lbParameter
            );
            commands = this.ikReverser.reverseCommandArray(commands);
            this.ui.displayIKAnalysis(this.ikReverser.analyzeIKCorrections(parseResult.commands));
        }

        this.animationEngine.loadCommands(commands);

        // Update UI to show what reversals are active
        this.ui.updateReversalStatus({
            ik: parseResult.metadata.inverseKinematics && this.reverseIK,
            calibration: hasCalibration && this.reverseCalibration
        });
    }

    togglePlayPause() {
        if (this.animationEngine.isPlaying) {
            this.animationEngine.pause();
            this.ui.setPlayButtonState(false);
        } else {
            this.ui.hidePauseMessage();
            this.animationEngine.play();
            this.ui.setPlayButtonState(true);
        }
    }

    resetAnimation() {
        this.animationEngine.reset();
        this.ui.hidePauseMessage();
        this.ui.setPlayButtonState(false);
    }

    handleProgressUpdate(progress) {
        this.ui.updateProgress(progress);

        if (this.currentData && this.currentData.metadata.layerHeight) {
            const currentStep = Math.floor((progress / 100) * this.animationEngine.commands.length);
            const command = this.animationEngine.commands[currentStep];
            if (command && command.z !== null) {
                const layer = Math.floor(command.z / this.currentData.metadata.layerHeight) + 1;
                this.ui.updateLayer(layer);
            }
        }
    }

    async handleCollisionToggle(enabled) {
        this.animationEngine.setCollisionDetection(enabled);

        if (enabled && this.currentData) {
            await this.runCollisionAnalysis();
        } else {
            this.ui.updateCollisionDisplay(0);
        }
    }

    async runCollisionAnalysis() {
        this.ui.showLoading('Analyzing collisions...');
        await new Promise(resolve => setTimeout(resolve, 50));

        // Update collision detector with current printhead params
        const printheadParams = this.animationEngine.getCurrentPrintheadParams();
        if (printheadParams) {
            this.collisionDetector.setParams(printheadParams);
        }

        const collisions = this.collisionDetector.analyzeCollisions(this.animationEngine.commands);
        this.animationEngine.setCollisionPoints(collisions);
        this.animationEngine.updateCollisionMarkers();
        this.ui.updateCollisionDisplay(collisions.length);

        this.ui.hideLoading();
    }

    handlePrintheadChange(printheadId) {
        this.animationEngine.setPrinthead(printheadId);

        // Re-run collision analysis if enabled
        if (this.animationEngine.collisionEnabled && this.currentData) {
            this.runCollisionAnalysis();
        }
    }

    toggleManualMode(enabled) {
        this.ui.toggleManualControls(enabled);

        if (!enabled && this.currentData) {
            this.processWithSettings(this.currentData.metadata);
            this.ui.displayFileInfo(this.currentData.metadata, this.parser.getStatistics());
        }
    }

    applyManualSettings() {
        if (!this.currentData) {
            alert('Please load a G-code file first');
            return;
        }

        const manualSettings = this.ui.getManualSettings();
        const manualMetadata = {
            ...this.currentData.metadata,
            ...manualSettings
        };

        this.processWithSettings(manualMetadata);
        this.ui.displayFileInfo(manualMetadata, this.parser.getStatistics());
    }

    processWithSettings(metadata) {
        let commands = this.currentData.commands;

        // Check for calibration in file and apply reversal if enabled
        const reverseCalibration = metadata.reverseCalibration !== false;
        if (reverseCalibration && this.calibrationReverser?.isEnabled()) {
            commands = this.calibrationReverser.reverseCommandArray(commands);
        }

        // Apply IK reversal if enabled
        if (metadata.inverseKinematics) {
            this.ikReverser = new InverseKinematicsReverser(
                metadata.lcParameter,
                metadata.lbParameter
            );
            commands = this.ikReverser.reverseCommandArray(commands);
            this.ui.displayIKAnalysis(this.ikReverser.analyzeIKCorrections(this.currentData.commands));
        }

        this.animationEngine.loadCommands(commands);

        // Update reversal status
        this.ui.updateReversalStatus({
            ik: metadata.inverseKinematics,
            calibration: reverseCalibration && this.calibrationReverser?.isEnabled()
        });

        this.animationEngine.currentStep = this.animationEngine.commands.length;
        this.animationEngine.rebuildPrintPath();
        this.ui.updateProgress(100);
    }
}

// Initialize app when page loads
document.addEventListener('DOMContentLoaded', () => {
    const initApp = () => {
        if (typeof getTheme === 'function' && getTheme()) {
            window.gcodeApp = new GcodePreviewerApp();
            // Expose engine for settings panel access
            window.gcodeApp.engine = window.gcodeApp.animationEngine;
        } else {
            setTimeout(initApp, 50);
        }
    };
    initApp();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (window.gcodeApp && window.gcodeApp.animationEngine) {
        window.gcodeApp.animationEngine.dispose();
    }
});
