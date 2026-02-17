// Main application class for Rep5x Spline Slicer

class SplineSlicerApp {
    constructor() {
        this.sceneManager = new SceneManager();
        this.uiController = new UIController();
        this.stlHandler = new STLHandler();
        this.splineEditor = new SplineEditor();
        this.meshSlicer = new MeshSlicer();
        this.gcodeGenerator = new GcodeGenerator();

        this.slices = null;
    }

    async init() {
        // Wait for theme to load
        while (typeof getTheme === 'undefined' || !getTheme()) {
            await new Promise(resolve => setTimeout(resolve, 50));
        }

        // Initialize scene
        this.sceneManager.init('canvas3d');

        // Set up UI callbacks
        this.uiController.onFileLoaded = (file) => this.handleFileLoaded(file);
        this.uiController.onModeChange = (mode) => this.handleModeChange(mode);
        this.uiController.onPreviewSlices = () => this.previewSlices();
        this.uiController.onGenerate = () => this.generateGcode();
        this.uiController.onPointRemove = (index) => this.handlePointRemove(index);
        this.uiController.onClearPoints = () => this.handleClearPoints();
        this.uiController.onRotateModel = (axis, direction) => this.handleRotateModel(axis, direction);
        this.uiController.onCurveTypeChange = (type) => this.handleCurveTypeChange(type);
        this.uiController.onPointEdit = (index, axis, value) => this.handlePointEdit(index, axis, value);
        this.uiController.onSliceModeChange = (index, mode) => this.handleSliceModeChange(index, mode);
        this.uiController.onClipFlagChange = (index, enabled) => this.handleClipFlagChange(index, enabled);
        this.uiController.onTabChange = (tab) => this.handleTabChange(tab);

        // Set up scene callbacks
        this.sceneManager.onMeshClick = (point) => this.handleMeshClick(point);
        this.sceneManager.onPointDrag = (index, pos) => this.handlePointDrag(index, pos);
        this.sceneManager.onPointDragEnd = (index) => this.handlePointDragEnd(index);

        // Initialize UI
        this.uiController.init();

        // Initial platform
        this.sceneManager.updateBuildPlatform(200, 200);

        // Hide loading indicator
        const loadingDiv = document.getElementById('loading');
        if (loadingDiv) loadingDiv.style.display = 'none';

        // Start render loop
        this.sceneManager.startRenderLoop();

        // Cleanup on page unload
        window.addEventListener('beforeunload', () => this.dispose());
    }

    // === File Loading ===

    async handleFileLoaded(file) {
        try {
            const geometry = await this.stlHandler.loadFile(file);

            // Display the mesh
            this.sceneManager.setSTLMesh(geometry);

            // Update model info in UI
            const info = this.stlHandler.getInfo();
            this.uiController.updateModelInfo(info);

            // Clear existing spline and slices
            this.splineEditor.clearPoints();
            this.sceneManager.clearSliceContours();
            this.slices = null;

            // Auto-place starter points: bottom centre and a short distance straight up
            // This ensures the first layers are always flat on the bed
            geometry.computeBoundingBox();
            const modelHeight = geometry.boundingBox.max.y - geometry.boundingBox.min.y;
            const starterHeight = Math.min(5, modelHeight * 0.1); // 5mm or 10% of height, whichever is smaller

            this.splineEditor.addPoint(new THREE.Vector3(0, 0, 0), 'flat');
            this.splineEditor.addPoint(new THREE.Vector3(0, starterHeight, 0), 'flat');
            this.updateSplineVisuals();

            // Enable place mode for adding more points
            this.sceneManager.setMode('place');
            this.uiController.setActiveMode('place');

            // Show rotation controls
            this.uiController.showRotationControls(true);

            showSuccessToast(`Loaded ${info.fileName} (${info.triangleCount.toLocaleString()} triangles)`);
        } catch (error) {
            showErrorToast('Failed to load STL: ' + error.message);
            console.error(error);
        }
    }

    // === Model Rotation ===

    handleRotateModel(axis, direction) {
        this.stlHandler.rotate90(axis, direction);

        // Re-display the rotated geometry
        this.sceneManager.setSTLMesh(this.stlHandler.getGeometry());

        // Update model info with new dimensions
        this.uiController.updateModelInfo(this.stlHandler.getInfo());

        // Clear slices and re-add starter points for the rotated geometry
        this.splineEditor.clearPoints();
        this.sceneManager.clearSliceContours();
        this.slices = null;

        const geometry = this.stlHandler.getGeometry();
        geometry.computeBoundingBox();
        const modelHeight = geometry.boundingBox.max.y - geometry.boundingBox.min.y;
        const starterHeight = Math.min(5, modelHeight * 0.1);

        this.splineEditor.addPoint(new THREE.Vector3(0, 0, 0), 'flat');
        this.splineEditor.addPoint(new THREE.Vector3(0, starterHeight, 0), 'flat');
        this.updateSplineVisuals();
    }

    // === Curve Type ===

    handleCurveTypeChange(type) {
        this.splineEditor.setCurveType(type);
        this.updateSplineVisuals();
        this.sceneManager.clearSliceContours();
        this.slices = null;
    }

    // === Tab Change ===

    handleTabChange(tab) {
        // Only show slice contours on Slice and Print tabs
        const showContours = (tab === 'Slice' || tab === 'PrintSettings');
        this.sceneManager.setSliceContoursVisible(showContours);
    }

    // === Interaction Mode ===

    handleModeChange(mode) {
        this.sceneManager.setMode(mode);
    }

    // === Spline Point Management ===

    handleMeshClick(point) {
        this.splineEditor.addPoint(point);
        this.updateSplineVisuals();
        this.slices = null;
        this.sceneManager.clearSliceContours();
    }

    handlePointRemove(index) {
        this.splineEditor.removePoint(index);
        this.updateSplineVisuals();
        this.slices = null;
        this.sceneManager.clearSliceContours();
    }

    handleClearPoints() {
        this.splineEditor.clearPoints();
        this.updateSplineVisuals();
        this.slices = null;
        this.sceneManager.clearSliceContours();
    }

    handlePointEdit(index, axis, value) {
        const points = this.splineEditor.getPoints();
        if (index < 0 || index >= points.length) return;

        const pos = points[index].clone();
        // Convert from printer space (Z-up) to Three.js space (Y-up)
        if (axis === 'x') pos.x = value;       // Printer X = Three.js X
        else if (axis === 'y') pos.z = -value;  // Printer Y = -Three.js Z
        else if (axis === 'z') pos.y = value;   // Printer Z = Three.js Y

        this.splineEditor.movePoint(index, pos);
        this.updateSplineVisuals();
        this.slices = null;
        this.sceneManager.clearSliceContours();
    }

    handleSliceModeChange(index, mode) {
        this.splineEditor.setSliceMode(index, mode);
        this.updateSplineVisuals();
        this.slices = null;
        this.sceneManager.clearSliceContours();
    }

    handleClipFlagChange(index, enabled) {
        this.splineEditor.setClipFlag(index, enabled);
        this.updateSplineVisuals();
        this.slices = null;
        this.sceneManager.clearSliceContours();
    }

    handlePointDrag(index, pos) {
        this.splineEditor.movePoint(index, pos);
        this.updateSplineVisuals();
        this.slices = null;
    }

    handlePointDragEnd(index) {
        this.sceneManager.clearSliceContours();
    }

    updateSplineVisuals() {
        const points = this.splineEditor.getPoints();

        // Update control point spheres with mode/barrier indicators
        this.sceneManager.setControlPoints(
            points,
            this.splineEditor.getSliceModes(),
            this.splineEditor.getClipFlags()
        );

        // Update spline curve
        const curvePoints = this.splineEditor.getCurvePoints(200);
        this.sceneManager.setSpline(curvePoints);

        // Update UI point list with slice modes and clip flags
        this.uiController.updateControlPointList(
            points,
            this.splineEditor.getSliceModes(),
            this.splineEditor.getClipFlags()
        );
    }

    // === Slicing ===

    /**
     * Estimate max distance from the spline to the model surface.
     * Used for curvature-adaptive layer height.
     */
    _estimateModelRadius() {
        const geometry = this.stlHandler.getGeometry();
        if (!geometry) return 0;
        geometry.computeBoundingBox();
        const size = new THREE.Vector3();
        geometry.boundingBox.getSize(size);
        // Half the max XZ extent (model is centred in XZ)
        return Math.max(size.x, size.z) / 2;
    }

    previewSlices() {
        if (!this.splineEditor.isValid()) {
            showWarningToast('Place at least 2 control points to create a spline');
            return;
        }

        if (this.stlHandler.getTriangles().length === 0) {
            showWarningToast('Load an STL model first');
            return;
        }

        this.uiController.setPreviewButtonLoading(true);

        setTimeout(() => {
            try {
                const printSettings = this.uiController.getPrintSettings();
                const samples = this.splineEditor.sampleByArcLength(printSettings.layerHeight, this._estimateModelRadius());

                this.slices = this.meshSlicer.sliceAll(
                    this.stlHandler.getTriangles(),
                    samples
                );

                // Display slice contours
                this.sceneManager.setSliceContours(this.slices);

                // Update slice info
                this.uiController.updateSliceInfo(
                    this.slices.length,
                    this.splineEditor.getTotalLength()
                );

                showSuccessToast(`Generated ${this.slices.length} slices`);
            } catch (error) {
                showErrorToast('Slicing failed: ' + error.message);
                console.error(error);
            } finally {
                this.uiController.setPreviewButtonLoading(false);
            }
        }, 50);
    }

    // === G-code Generation ===

    generateGcode() {
        if (!this.splineEditor.isValid()) {
            showWarningToast('Place at least 2 control points to create a spline');
            return;
        }

        if (this.stlHandler.getTriangles().length === 0) {
            showWarningToast('Load an STL model first');
            return;
        }

        // Switch to Slice tab to show contours
        this.uiController.switchTab('Slice');
        this.uiController.setGenerateButtonLoading(true);

        setTimeout(() => {
            try {
                // Auto-slice if needed
                if (!this.slices) {
                    const printSettings = this.uiController.getPrintSettings();
                    const samples = this.splineEditor.sampleByArcLength(printSettings.layerHeight, this._estimateModelRadius());
                    this.slices = this.meshSlicer.sliceAll(
                        this.stlHandler.getTriangles(),
                        samples
                    );
                    this.sceneManager.setSliceContours(this.slices);
                }

                if (this.slices.length === 0) {
                    showWarningToast('No slice contours found. Check that the spline passes through the model.');
                    return;
                }

                const printSettings = this.uiController.getPrintSettings();
                const advancedSettings = this.uiController.getAdvancedSettings();

                const result = this.gcodeGenerator.generate(
                    this.slices,
                    printSettings,
                    advancedSettings
                );

                downloadGcode(result.gcode, result.filename);
                showSuccessToast(`G-code downloaded: ${result.filename}`);
            } catch (error) {
                showErrorToast('G-code generation failed: ' + error.message);
                console.error(error);
            } finally {
                this.uiController.setGenerateButtonLoading(false);
            }
        }, 100);
    }

    dispose() {
        this.sceneManager.dispose();
    }
}

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const app = new SplineSlicerApp();
    setTimeout(() => app.init(), 100);
});
