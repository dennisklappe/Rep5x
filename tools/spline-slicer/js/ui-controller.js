// UI Controller for Rep5x Spline Slicer - handles all UI interactions

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
        this.onFileLoaded = null;
        this.onModeChange = null;
        this.onPreviewSlices = null;
        this.onGenerate = null;
        this.onPointRemove = null;
        this.onClearPoints = null;
        this.onRotateModel = null;
        this.onCurveTypeChange = null;
        this.onPointEdit = null;
        this.onSliceModeChange = null;
        this.onClipFlagChange = null;
        this.onTabChange = null;
    }

    init() {
        this.setupTabListeners();
        this.setupSliderListeners();
        this.setupFileUpload();
        this.setupViewportDragDrop();
        this.setupMaterialPresetListeners();
        this.setupNozzleListeners();
        this.setupSplineControls();
        this.setupRotationControls();
        this.setupGenerateButton();
    }

    // === Tab Management ===

    setupTabListeners() {
        const tabs = ['Model', 'Spline', 'Slice', 'PrintSettings', 'Advanced'];
        for (const tab of tabs) {
            const btn = document.getElementById('tab' + tab);
            if (btn) btn.addEventListener('click', () => this.switchTab(tab));
        }
    }

    switchTab(tabName) {
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.add('hidden');
        });
        document.querySelectorAll('.tab-button').forEach(button => {
            button.classList.remove('border-primary', 'text-primary');
            button.classList.add('border-transparent', 'text-gray-500');
        });

        const content = document.getElementById('content' + tabName);
        if (content) content.classList.remove('hidden');

        const activeButton = document.getElementById('tab' + tabName);
        if (activeButton) {
            activeButton.classList.add('border-primary', 'text-primary');
            activeButton.classList.remove('border-transparent', 'text-gray-500');
        }

        if (this.onTabChange) this.onTabChange(tabName);
    }

    // === File Upload ===

    setupFileUpload() {
        const dropZone = document.getElementById('stlDropZone');
        const fileInput = document.getElementById('stlFileInput');

        if (dropZone && fileInput) {
            setupDropZoneWithFeedback(dropZone, fileInput, (e) => {
                const file = e.target.files[0];
                if (file && this.onFileLoaded) {
                    this.onFileLoaded(file);
                }
            }, {
                contentElement: document.getElementById('dropZoneContent'),
                selectedElement: document.getElementById('dropZoneSelected'),
                fileNameElement: document.getElementById('stlFileName'),
                fileSizeElement: document.getElementById('stlFileSize')
            });
        }
    }

    // === Viewport Drag & Drop ===

    setupViewportDragDrop() {
        const viewport = document.querySelector('.slicer-viewport');
        if (!viewport) return;

        // Create drop overlay
        const overlay = document.createElement('div');
        overlay.className = 'canvas-drop-overlay';
        overlay.innerHTML = `
            <div class="canvas-drop-content">
                <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
                <span>Drop STL file here</span>
            </div>
        `;
        viewport.appendChild(overlay);

        let dragCounter = 0;

        viewport.addEventListener('dragenter', (e) => {
            e.preventDefault();
            dragCounter++;
            overlay.classList.add('active');
        });

        viewport.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dragCounter--;
            if (dragCounter === 0) overlay.classList.remove('active');
        });

        viewport.addEventListener('dragover', (e) => {
            e.preventDefault();
        });

        viewport.addEventListener('drop', (e) => {
            e.preventDefault();
            dragCounter = 0;
            overlay.classList.remove('active');

            const files = e.dataTransfer?.files;
            if (files?.length > 0) {
                const file = files[0];
                if (file.name.match(/\.stl$/i) && this.onFileLoaded) {
                    this.onFileLoaded(file);
                    // Update the drop zone UI in the Model tab
                    const content = document.getElementById('dropZoneContent');
                    const selected = document.getElementById('dropZoneSelected');
                    const nameEl = document.getElementById('stlFileName');
                    const sizeEl = document.getElementById('stlFileSize');
                    if (content) content.classList.add('hidden');
                    if (selected) selected.classList.remove('hidden');
                    if (nameEl) nameEl.textContent = file.name;
                    if (sizeEl) sizeEl.textContent = (file.size / 1024).toFixed(1) + ' KB';
                }
            }
        });
    }

    // === Rotation Controls ===

    setupRotationControls() {
        const axes = ['X', 'Y', 'Z'];
        const directions = ['Pos', 'Neg'];

        for (const axis of axes) {
            for (const dir of directions) {
                const btn = document.getElementById(`rotate${axis}${dir}`);
                if (btn) {
                    btn.addEventListener('click', () => {
                        if (this.onRotateModel) {
                            this.onRotateModel(axis.toLowerCase(), dir === 'Pos' ? 1 : -1);
                        }
                    });
                }
            }
        }
    }

    showRotationControls(show) {
        const controls = document.getElementById('modelRotationControls');
        if (controls) {
            if (show) controls.classList.remove('hidden');
            else controls.classList.add('hidden');
        }
    }

    // === Slider Listeners ===

    setupSliderListeners() {
        document.querySelectorAll('input[type="range"]').forEach(input => {
            input.addEventListener('input', (e) => {
                const valueSpan = document.getElementById(e.target.id + 'Value');
                if (valueSpan && e.target.id !== 'nozzleDiameter') {
                    valueSpan.textContent = e.target.value;
                }
            });
        });
    }

    // === Material Presets ===

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

        const setCustomPreset = () => {
            if (materialSelect) materialSelect.value = 'custom';
        };

        if (nozzleTempSlider) nozzleTempSlider.addEventListener('input', setCustomPreset);
        if (bedTempSlider) bedTempSlider.addEventListener('input', setCustomPreset);
        if (speedSlider) speedSlider.addEventListener('input', setCustomPreset);
    }

    // === Nozzle Listeners ===

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

        this.updateNozzleDiameterDisplay();
        this.validateLayerHeight();
    }

    // === Spline Controls ===

    setupSplineControls() {
        const placeBtn = document.getElementById('placeModeBtn');
        const editBtn = document.getElementById('editModeBtn');
        const clearBtn = document.getElementById('clearPointsBtn');
        const previewBtn = document.getElementById('previewSlicesBtn');
        const linearBtn = document.getElementById('curveTypeLinear');
        const smoothBtn = document.getElementById('curveTypeSmooth');

        if (placeBtn) {
            placeBtn.addEventListener('click', () => {
                this.setActiveMode('place');
                if (this.onModeChange) this.onModeChange('place');
            });
        }

        if (editBtn) {
            editBtn.addEventListener('click', () => {
                this.setActiveMode('edit');
                if (this.onModeChange) this.onModeChange('edit');
            });
        }

        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                if (this.onClearPoints) this.onClearPoints();
            });
        }

        if (previewBtn) {
            previewBtn.addEventListener('click', () => {
                if (this.onPreviewSlices) this.onPreviewSlices();
            });
        }

        if (linearBtn) {
            linearBtn.addEventListener('click', () => {
                this.setActiveCurveType('linear');
                if (this.onCurveTypeChange) this.onCurveTypeChange('linear');
            });
        }

        if (smoothBtn) {
            smoothBtn.addEventListener('click', () => {
                this.setActiveCurveType('smooth');
                if (this.onCurveTypeChange) this.onCurveTypeChange('smooth');
            });
        }
    }

    setActiveCurveType(type) {
        const linearBtn = document.getElementById('curveTypeLinear');
        const smoothBtn = document.getElementById('curveTypeSmooth');
        const hint = document.getElementById('curveTypeHint');

        if (linearBtn && smoothBtn) {
            if (type === 'linear') {
                linearBtn.classList.add('bg-primary', 'text-white');
                linearBtn.classList.remove('bg-gray-200', 'text-gray-700');
                smoothBtn.classList.remove('bg-primary', 'text-white');
                smoothBtn.classList.add('bg-gray-200', 'text-gray-700');
                if (hint) hint.textContent = 'Each segment has a constant tilt angle. Use this for sharp transitions (e.g. print vertically, then bend 90\u00B0 for a nose).';
            } else {
                smoothBtn.classList.add('bg-primary', 'text-white');
                smoothBtn.classList.remove('bg-gray-200', 'text-gray-700');
                linearBtn.classList.remove('bg-primary', 'text-white');
                linearBtn.classList.add('bg-gray-200', 'text-gray-700');
                if (hint) hint.textContent = 'Smooth CatmullRom curve through all points. Tilt angle transitions gradually along the entire path.';
            }
        }
    }

    setActiveMode(mode) {
        const placeBtn = document.getElementById('placeModeBtn');
        const editBtn = document.getElementById('editModeBtn');

        if (placeBtn && editBtn) {
            if (mode === 'place') {
                placeBtn.classList.add('bg-primary', 'text-white');
                placeBtn.classList.remove('bg-gray-200', 'text-gray-700');
                editBtn.classList.remove('bg-primary', 'text-white');
                editBtn.classList.add('bg-gray-200', 'text-gray-700');
            } else {
                editBtn.classList.add('bg-primary', 'text-white');
                editBtn.classList.remove('bg-gray-200', 'text-gray-700');
                placeBtn.classList.remove('bg-primary', 'text-white');
                placeBtn.classList.add('bg-gray-200', 'text-gray-700');
            }
        }
    }

    // === Generate Button ===

    setupGenerateButton() {
        const generateBtn = document.getElementById('generate');
        if (generateBtn) {
            generateBtn.addEventListener('click', () => {
                if (this.onGenerate) this.onGenerate();
            });
        }
    }

    // === Control Point List ===

    updateControlPointList(points, sliceModes, clipFlags) {
        const list = document.getElementById('controlPointList');
        if (!list) return;

        if (points.length === 0) {
            list.innerHTML = '<p class="ss-empty-msg">No control points placed yet</p>';
            return;
        }

        list.innerHTML = '';
        for (let i = 0; i < points.length; i++) {
            const pt = points[i];
            const mode = (sliceModes && sliceModes[i]) || 'auto';
            const hasClip = (clipFlags && clipFlags[i]) || false;
            // Transform from Three.js (Y-up) to printer space (Z-up) for display
            const displayX = pt.x;
            const displayY = -pt.z;
            const displayZ = pt.y;

            const item = document.createElement('div');
            item.className = 'ss-point-item';

            const autoActive = mode === 'auto';
            const flatActive = mode === 'flat';
            // Barrier only makes sense for points after the first (need an incoming direction)
            const canHaveBarrier = i > 0;

            item.innerHTML = `
                <div class="ss-point-header">
                    <span class="ss-point-label">Point ${i + 1}</span>
                    <button class="delete-point-btn ss-point-delete" data-index="${i}" title="Remove point">
                        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>
                <div class="ss-point-coords">
                    <div>
                        <label class="ss-coord-label">X</label>
                        <input type="number" step="0.1" value="${displayX.toFixed(1)}" class="point-coord ss-coord-input" data-index="${i}" data-axis="x" />
                    </div>
                    <div>
                        <label class="ss-coord-label">Y</label>
                        <input type="number" step="0.1" value="${displayY.toFixed(1)}" class="point-coord ss-coord-input" data-index="${i}" data-axis="y" />
                    </div>
                    <div>
                        <label class="ss-coord-label">Z</label>
                        <input type="number" step="0.1" value="${displayZ.toFixed(1)}" class="point-coord ss-coord-input" data-index="${i}" data-axis="z" />
                    </div>
                </div>
                <div class="ss-point-options">
                    <span class="ss-slice-label">Slice:</span>
                    <button class="slice-mode-btn ss-mode-btn ${autoActive ? 'active' : ''}" data-index="${i}" data-mode="auto" title="Slice perpendicular to spline direction">Auto</button>
                    <button class="slice-mode-btn ss-mode-btn ${flatActive ? 'active' : ''}" data-index="${i}" data-mode="flat" title="Slice horizontally (flat layers, B=0)">Flat</button>
                    ${canHaveBarrier ? `
                    <label class="clip-flag-label ss-barrier-label" title="Barrier: block geometry behind this point from later slices">
                        <input type="checkbox" class="clip-flag-checkbox ss-barrier-checkbox" data-index="${i}" ${hasClip ? 'checked' : ''} />
                        <span class="${hasClip ? 'ss-barrier-active' : ''}">Barrier</span>
                    </label>
                    ` : ''}
                </div>
            `;

            const deleteBtn = item.querySelector('.delete-point-btn');
            deleteBtn.addEventListener('click', () => {
                if (this.onPointRemove) this.onPointRemove(i);
            });

            // Coordinate input change handlers
            const inputs = item.querySelectorAll('.point-coord');
            inputs.forEach(input => {
                input.addEventListener('change', (e) => {
                    const idx = parseInt(e.target.dataset.index);
                    const axis = e.target.dataset.axis;
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val) && this.onPointEdit) {
                        this.onPointEdit(idx, axis, val);
                    }
                });
            });

            // Slice mode toggle handlers
            const modeButtons = item.querySelectorAll('.slice-mode-btn');
            modeButtons.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const idx = parseInt(e.target.dataset.index);
                    const newMode = e.target.dataset.mode;
                    if (this.onSliceModeChange) {
                        this.onSliceModeChange(idx, newMode);
                    }
                });
            });

            // Barrier checkbox handler
            const clipCheckbox = item.querySelector('.clip-flag-checkbox');
            if (clipCheckbox) {
                clipCheckbox.addEventListener('change', (e) => {
                    const idx = parseInt(e.target.dataset.index);
                    if (this.onClipFlagChange) {
                        this.onClipFlagChange(idx, e.target.checked);
                    }
                });
            }

            list.appendChild(item);
        }
    }

    // === Model Info ===

    updateModelInfo(info) {
        const infoDiv = document.getElementById('modelInfo');
        if (!infoDiv) return;

        infoDiv.innerHTML = `
            <div class="grid grid-cols-2 gap-2 text-sm">
                <div><span class="text-gray-500">File:</span> <span class="font-medium">${info.fileName}</span></div>
                <div><span class="text-gray-500">Size:</span> <span class="font-medium">${formatFileSize(info.fileSize)}</span></div>
                <div><span class="text-gray-500">Triangles:</span> <span class="font-medium">${info.triangleCount.toLocaleString()}</span></div>
                <div><span class="text-gray-500">Dimensions:</span> <span class="font-medium">${info.dimensions.x} x ${info.dimensions.y} x ${info.dimensions.z}mm</span></div>
            </div>
        `;
    }

    // === Slice Info ===

    updateSliceInfo(sliceCount, totalLength) {
        const infoDiv = document.getElementById('sliceInfo');
        if (!infoDiv) return;

        infoDiv.innerHTML = `
            <div class="text-sm text-gray-600">
                <p><span class="font-medium">${sliceCount}</span> slices generated</p>
                <p>Spline length: <span class="font-medium">${totalLength.toFixed(1)}mm</span></p>
            </div>
        `;
    }

    // === Value Helpers ===

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
        if (displayElement) displayElement.textContent = diameter;
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
            warning.textContent = `Recommended layer height for ${nozzleDiameter}mm nozzle: ${minLayerHeight.toFixed(2)}-${maxLayerHeight.toFixed(2)}mm`;
            warning.classList.remove('hidden');
        } else {
            warning.classList.add('hidden');
        }
    }

    // === Settings Getters ===

    getPrintSettings() {
        return {
            layerHeight: parseFloat(document.getElementById('layerHeight')?.value || 0.3),
            speed: parseFloat(document.getElementById('speed')?.value || 20) * 60,
            nozzleDiameter: this.getNozzleDiameter(),
            nozzleTemp: parseFloat(document.getElementById('nozzleTemp')?.value || 210),
            bedTemp: parseFloat(document.getElementById('bedTemp')?.value || 60),
            bedWidth: parseFloat(document.getElementById('bedWidth')?.value || 200),
            bedDepth: parseFloat(document.getElementById('bedDepth')?.value || 200),
            wallCount: parseInt(document.getElementById('wallCount')?.value || 2),
            infillDensity: parseInt(document.getElementById('infillDensity')?.value || 20)
        };
    }

    getAdvancedSettings() {
        return {
            enableCAxisOptimization: document.getElementById('enableCAxisOptimization')?.checked || false,
            ikMode: document.getElementById('ikMode')?.value || 'live',
            startGcode: document.getElementById('startGcode')?.value || '',
            endGcode: document.getElementById('endGcode')?.value || ''
        };
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

    setPreviewButtonLoading(isLoading) {
        const button = document.getElementById('previewSlicesBtn');
        if (!button) return;

        if (isLoading) {
            button.dataset.originalText = button.innerHTML;
            button.innerHTML = '<div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-1 inline-block"></div> Slicing...';
            button.disabled = true;
        } else {
            button.innerHTML = button.dataset.originalText || 'Preview slices';
            button.disabled = false;
        }
    }
}
