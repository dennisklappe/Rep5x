// UI Controller for Rep5x vase generator - handles all UI interactions

class UIController {
    constructor() {
        // Material preset configurations
        this.materialPresets = {
            pla: { nozzleTemp: 210, bedTemp: 60, speed: 50 },
            petg: { nozzleTemp: 240, bedTemp: 80, speed: 40 },
            abs: { nozzleTemp: 245, bedTemp: 100, speed: 45 }
        };

        // Nozzle size mapping
        this.nozzleSizes = [0.2, 0.3, 0.4, 0.6, 0.8, 1.0];

        // Callbacks
        this.onPreviewUpdate = null;
        this.onPlatformUpdate = null;
        this.onGenerate = null;
    }

    init() {
        this.setupTabListeners();
        this.setupSliderListeners();
        this.setupShapeListeners();
        this.setupMaterialPresetListeners();
        this.setupKinematicsListeners();
        this.setupNozzleListeners();
        this.loadSavedCalibration();
    }

    setupTabListeners() {
        const tabShape = document.getElementById('tabShape');
        const tabPrintSettings = document.getElementById('tabPrintSettings');
        const tabAdvanced = document.getElementById('tabAdvanced');

        if (tabShape) tabShape.addEventListener('click', () => this.switchTab('Shape'));
        if (tabPrintSettings) tabPrintSettings.addEventListener('click', () => this.switchTab('PrintSettings'));
        if (tabAdvanced) tabAdvanced.addEventListener('click', () => this.switchTab('Advanced'));
    }

    switchTab(tabName) {
        // Hide all tab contents
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.add('hidden');
        });

        // Remove active state from all tabs
        document.querySelectorAll('.tab-button').forEach(button => {
            button.classList.remove('border-primary', 'text-primary');
            button.classList.add('border-transparent', 'text-gray-500');
        });

        // Show selected tab content
        const content = document.getElementById('content' + tabName);
        if (content) content.classList.remove('hidden');

        // Activate selected tab button
        const activeButton = document.getElementById('tab' + tabName);
        if (activeButton) {
            activeButton.classList.add('border-primary', 'text-primary');
            activeButton.classList.remove('border-transparent', 'text-gray-500');
        }
    }

    setupSliderListeners() {
        // Generic slider value display updates
        document.querySelectorAll('input[type="range"]').forEach(input => {
            input.addEventListener('input', (e) => {
                const valueSpan = document.getElementById(e.target.id + 'Value');
                if (valueSpan && e.target.id !== 'nozzleDiameter') {
                    valueSpan.textContent = e.target.value;
                }
                if (this.onPreviewUpdate) this.onPreviewUpdate();
            });
        });

        // Specific slider listeners for elbow pipe
        const vertical = document.getElementById('vertical');
        const horizontal = document.getElementById('horizontal');

        if (vertical) {
            vertical.addEventListener('input', (e) => {
                const valueSpan = document.getElementById('verticalValue');
                if (valueSpan) valueSpan.textContent = e.target.value;
                if (this.onPreviewUpdate) this.onPreviewUpdate();
            });
        }

        if (horizontal) {
            horizontal.addEventListener('input', (e) => {
                const valueSpan = document.getElementById('horizontalValue');
                if (valueSpan) valueSpan.textContent = e.target.value;
                if (this.onPreviewUpdate) this.onPreviewUpdate();
            });
        }

        // Mushroom sliders
        ['stemDiameter', 'stemHeight', 'capDiameter', 'capHeight'].forEach(id => {
            const slider = document.getElementById(id);
            if (slider) {
                slider.addEventListener('input', (e) => {
                    const valueSpan = document.getElementById(id + 'Value');
                    if (valueSpan) valueSpan.textContent = e.target.value;
                    if (this.onPreviewUpdate) this.onPreviewUpdate();
                });
            }
        });

        // Bed size changes
        const bedWidth = document.getElementById('bedWidth');
        const bedDepth = document.getElementById('bedDepth');

        if (bedWidth) bedWidth.addEventListener('input', () => {
            if (this.onPlatformUpdate) this.onPlatformUpdate();
        });
        if (bedDepth) bedDepth.addEventListener('input', () => {
            if (this.onPlatformUpdate) this.onPlatformUpdate();
        });
    }

    setupShapeListeners() {
        const shapeSelect = document.getElementById('shape');
        if (shapeSelect) {
            shapeSelect.addEventListener('change', () => {
                if (this.onPreviewUpdate) this.onPreviewUpdate();
            });
        }

        const generateBtn = document.getElementById('generate');
        if (generateBtn) {
            generateBtn.addEventListener('click', () => {
                if (this.onGenerate) this.onGenerate();
            });
        }
    }

    setupMaterialPresetListeners() {
        const materialSelect = document.getElementById('materialPreset');
        const nozzleTempSlider = document.getElementById('nozzleTemp');
        const bedTempSlider = document.getElementById('bedTemp');
        const speedSlider = document.getElementById('speed');

        if (materialSelect) {
            materialSelect.addEventListener('change', (e) => {
                const preset = this.materialPresets[e.target.value];
                if (preset) {
                    if (nozzleTempSlider) {
                        nozzleTempSlider.value = preset.nozzleTemp;
                        this.updateValueDisplay('nozzleTemp', preset.nozzleTemp);
                    }
                    if (bedTempSlider) {
                        bedTempSlider.value = preset.bedTemp;
                        this.updateValueDisplay('bedTemp', preset.bedTemp);
                    }
                    if (speedSlider) {
                        speedSlider.value = preset.speed;
                        this.updateValueDisplay('speed', preset.speed);
                    }
                }
            });
        }

        // Set to custom when sliders change
        const setCustomPreset = () => {
            if (materialSelect) materialSelect.value = 'custom';
        };

        if (nozzleTempSlider) nozzleTempSlider.addEventListener('input', setCustomPreset);
        if (bedTempSlider) bedTempSlider.addEventListener('input', setCustomPreset);
        if (speedSlider) speedSlider.addEventListener('input', setCustomPreset);
    }

    setupKinematicsListeners() {
        const enableKinematics = document.getElementById('enableKinematics');
        const paramsDiv = document.getElementById('kinematicParams');

        if (enableKinematics && paramsDiv) {
            enableKinematics.addEventListener('change', (e) => {
                if (e.target.checked) {
                    paramsDiv.style.opacity = '1';
                    paramsDiv.style.pointerEvents = 'auto';
                } else {
                    paramsDiv.style.opacity = '0.5';
                    paramsDiv.style.pointerEvents = 'none';
                }
            });
        }

        // Save button for advanced LA/LB params
        const saveAdvancedBtn = document.getElementById('saveAdvancedParams');
        const laParamInput = document.getElementById('laParam');
        const lbParamInput = document.getElementById('lbParam');

        if (saveAdvancedBtn && laParamInput && lbParamInput) {
            saveAdvancedBtn.addEventListener('click', () => {
                const la = parseFloat(laParamInput.value) || 0;
                const lb = parseFloat(lbParamInput.value) || 47;

                if (typeof StorageManager !== 'undefined') {
                    StorageManager.saveCalibrationResults(la, lb, {
                        method: 'manual',
                        testMode: false
                    });
                }

                // Dispatch event so footer updates
                document.dispatchEvent(new CustomEvent('laLbUpdated', {
                    detail: { la, lb, source: 'advanced' }
                }));

                // Visual feedback
                saveAdvancedBtn.textContent = 'Saved!';
                setTimeout(() => {
                    saveAdvancedBtn.textContent = 'Save LA/LB to browser';
                }, 1500);
            });

            // Listen for updates from footer
            document.addEventListener('laLbUpdated', (e) => {
                if (e.detail.source !== 'advanced') {
                    if (e.detail.la !== undefined) laParamInput.value = e.detail.la.toFixed(2);
                    if (e.detail.lb !== undefined) lbParamInput.value = e.detail.lb.toFixed(2);
                }
            });
        }
    }

    setupNozzleListeners() {
        const nozzleDiameter = document.getElementById('nozzleDiameter');
        const layerHeight = document.getElementById('layerHeight');

        if (nozzleDiameter) {
            nozzleDiameter.addEventListener('input', () => {
                this.updateNozzleDiameterDisplay();
                this.validateLayerHeight();
            });
        }

        if (layerHeight) {
            layerHeight.addEventListener('input', () => {
                this.validateLayerHeight();
            });
        }

        // Initial setup
        this.updateNozzleDiameterDisplay();
        this.validateLayerHeight();
    }

    loadSavedCalibration() {
        if (typeof StorageManager === 'undefined') return;

        const savedResults = StorageManager.loadCalibrationResults();
        if (savedResults && (savedResults.la !== undefined || savedResults.lb !== undefined)) {
            // Update footer display
            const display = document.getElementById('savedKinematicsDisplay');
            const laSpan = document.getElementById('savedLaValue');
            const lbSpan = document.getElementById('savedLbValue');

            if (display && laSpan && lbSpan) {
                laSpan.textContent = savedResults.la?.toFixed(2) ?? '0';
                lbSpan.textContent = savedResults.lb?.toFixed(2) ?? '47';
                display.classList.remove('hidden');
            }

            // Prefill LA/LB input fields if they exist
            const laInput = document.getElementById('laParam');
            const lbInput = document.getElementById('lbParam');

            if (laInput && savedResults.la !== undefined) {
                laInput.value = savedResults.la.toFixed(2);
            }
            if (lbInput && savedResults.lb !== undefined) {
                lbInput.value = savedResults.lb.toFixed(2);
            }
        }
    }

    updateValueDisplay(id, value) {
        const valueSpan = document.getElementById(id + 'Value');
        if (valueSpan) valueSpan.textContent = value;
    }

    getNozzleDiameter() {
        const slider = document.getElementById('nozzleDiameter');
        if (!slider) return 0.4;
        const sliderValue = parseInt(slider.value);
        return this.nozzleSizes[sliderValue] || 0.4;
    }

    updateNozzleDiameterDisplay() {
        const diameter = this.getNozzleDiameter();
        const displayElement = document.getElementById('nozzleDiameterValue');
        if (displayElement) {
            displayElement.textContent = diameter;
        }
    }

    validateLayerHeight() {
        const nozzleDiameter = this.getNozzleDiameter();
        const layerHeightInput = document.getElementById('layerHeight');
        const warning = document.getElementById('layerHeightWarning');

        if (!layerHeightInput || !warning) return;

        const layerHeight = parseFloat(layerHeightInput.value);
        const minLayerHeight = nozzleDiameter * 0.2;
        const maxLayerHeight = nozzleDiameter * 0.8;

        if (layerHeight < minLayerHeight || layerHeight > maxLayerHeight) {
            warning.textContent = `⚠ Recommended layer height for ${nozzleDiameter}mm nozzle: ${minLayerHeight.toFixed(2)}-${maxLayerHeight.toFixed(2)}mm`;
            warning.classList.remove('hidden');
        } else {
            warning.classList.add('hidden');
        }
    }

    getSelectedShape() {
        const shapeSelect = document.getElementById('shape');
        return shapeSelect ? shapeSelect.value : 'elbow-pipe';
    }

    getShapeParams(shapeName) {
        if (shapeName === 'mushroom') {
            return {
                stemDiameter: parseFloat(document.getElementById('stemDiameter')?.value || 20),
                stemHeight: parseFloat(document.getElementById('stemHeight')?.value || 40),
                capDiameter: parseFloat(document.getElementById('capDiameter')?.value || 50),
                capHeight: parseFloat(document.getElementById('capHeight')?.value || 25)
            };
        } else {
            return {
                diameter: parseFloat(document.getElementById('diameter')?.value || 30),
                vertical: parseFloat(document.getElementById('vertical')?.value || 40),
                horizontal: parseFloat(document.getElementById('horizontal')?.value || 30),
                tilt: parseFloat(document.getElementById('tilt')?.value || 90)
            };
        }
    }

    getPrintSettings() {
        return {
            layerHeight: parseFloat(document.getElementById('layerHeight')?.value || 0.3),
            speed: parseFloat(document.getElementById('speed')?.value || 50) * 60, // mm/min
            nozzleDiameter: this.getNozzleDiameter(),
            nozzleTemp: parseFloat(document.getElementById('nozzleTemp')?.value || 210),
            bedTemp: parseFloat(document.getElementById('bedTemp')?.value || 60),
            bedWidth: parseFloat(document.getElementById('bedWidth')?.value || 200),
            bedDepth: parseFloat(document.getElementById('bedDepth')?.value || 200)
        };
    }

    getAdvancedSettings() {
        return {
            enableKinematics: document.getElementById('enableKinematics')?.checked || false,
            laParam: parseFloat(document.getElementById('laParam')?.value || 0),
            lbParam: parseFloat(document.getElementById('lbParam')?.value || 47.9),
            enableAAxisOptimization: document.getElementById('enableAAxisOptimization')?.checked || false,
            startGcode: document.getElementById('startGcode')?.value || '',
            endGcode: document.getElementById('endGcode')?.value || ''
        };
    }

    updateShapeInfo(shape) {
        const shapeInfo = {
            'elbow-pipe': 'Elbow pipe demonstrates the B-axis (pitch) printing capability.',
            'mushroom': 'Mushroom shape demonstrates both A-axis (yaw) and B-axis (pitch) capabilities with an organic overhanging form.'
        };

        const shapeDescriptions = {
            'elbow-pipe': 'Configurable elbow pipe to demonstrate B-axis (pitch) printing',
            'mushroom': 'Organic mushroom shape demonstrating both A and B axis movements'
        };

        const infoElem = document.getElementById('shapeInfo');
        if (infoElem && shapeInfo[shape]) {
            infoElem.innerHTML = `<p>${shapeInfo[shape]}</p>`;
        }

        const descElem = document.getElementById('shapeDescription');
        if (descElem && shapeDescriptions[shape]) {
            descElem.textContent = shapeDescriptions[shape];
        }

        // Toggle parameter panels
        const elbowParams = document.getElementById('elbowPipeParams');
        const mushroomParams = document.getElementById('mushroomParams');

        if (elbowParams && mushroomParams) {
            if (shape === 'mushroom') {
                elbowParams.classList.add('hidden');
                mushroomParams.classList.remove('hidden');
            } else {
                elbowParams.classList.remove('hidden');
                mushroomParams.classList.add('hidden');
            }
        }
    }

    setGenerateButtonLoading(isLoading) {
        const button = document.getElementById('generate');
        if (!button) return;

        if (isLoading) {
            button.dataset.originalText = button.innerHTML;
            button.innerHTML = '<div class="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>Generating...';
            button.disabled = true;
        } else {
            button.innerHTML = button.dataset.originalText || 'Generate G-code';
            button.disabled = false;
        }
    }
}
