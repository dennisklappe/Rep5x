// Main application class for Rep5x Vase Generator

class VaseGeneratorApp {
    constructor() {
        this.sceneManager = new SceneManager();
        this.uiController = new UIController();
        this.gcodeGenerator = new GcodeGenerator();

        // Register shapes
        this.shapes = {
            'elbow-pipe': new ElbowPipe(),
            'mushroom': new Mushroom()
        };
    }

    async init() {
        // Wait for theme to load
        while (typeof getTheme === 'undefined' || !getTheme()) {
            await new Promise(resolve => setTimeout(resolve, 50));
        }

        // Register shapes with generator
        for (const [name, shape] of Object.entries(this.shapes)) {
            this.gcodeGenerator.registerShape(name, shape);
        }

        // Initialize scene
        this.sceneManager.init('canvas3d');

        // Set up UI callbacks
        this.uiController.onPreviewUpdate = () => this.updatePreview();
        this.uiController.onPlatformUpdate = () => this.updatePlatform();
        this.uiController.onGenerate = () => this.generateGcode();

        // Initialize UI
        this.uiController.init();

        // Initial platform and preview
        this.updatePlatform();
        this.updatePreview();

        // Hide loading indicator
        const loadingDiv = document.getElementById('loading');
        if (loadingDiv) loadingDiv.style.display = 'none';

        // Start render loop
        this.sceneManager.startRenderLoop();

        // Cleanup on page unload
        window.addEventListener('beforeunload', () => this.dispose());
    }

    updatePlatform() {
        const settings = this.uiController.getPrintSettings();
        this.sceneManager.updateBuildPlatform(settings.bedWidth, settings.bedDepth);
    }

    updatePreview() {
        const shapeName = this.uiController.getSelectedShape();
        const shapeParams = this.uiController.getShapeParams(shapeName);
        const shape = this.shapes[shapeName];

        if (!shape) {
            console.error('Unknown shape:', shapeName);
            return;
        }

        // Update UI info
        this.uiController.updateShapeInfo(shapeName);

        try {
            // Create geometry
            const geometry = shape.createGeometry(shapeParams);

            // Get theme color
            const theme = getTheme();
            const primaryColor = new THREE.Color(theme.colors.primary);

            // Update scene
            this.sceneManager.setMesh(geometry, primaryColor);

            // Create path
            const pathPoints = shape.createPath(shapeParams);
            this.sceneManager.setPath(pathPoints);

        } catch (error) {
            console.error('Error creating geometry:', error);
        }
    }

    generateGcode() {
        this.uiController.setGenerateButtonLoading(true);

        // Use setTimeout to allow UI to update
        setTimeout(() => {
            try {
                const shapeName = this.uiController.getSelectedShape();
                const shapeParams = this.uiController.getShapeParams(shapeName);
                const printSettings = this.uiController.getPrintSettings();
                const advancedSettings = this.uiController.getAdvancedSettings();

                const result = this.gcodeGenerator.generate(
                    shapeName,
                    shapeParams,
                    printSettings,
                    advancedSettings
                );

                // Use shared utility
                downloadGcode(result.gcode, result.filename);

            } catch (error) {
                alert('Error generating G-code: ' + error.message);
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
    const app = new VaseGeneratorApp();
    // Small delay to ensure canvas is ready
    setTimeout(() => app.init(), 100);
});
