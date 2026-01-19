// UI controller for Rep5x G-code viewer
// Handles all DOM interactions, event listeners, and display updates

class UIController {
    constructor() {
        this.elements = {
            // File upload
            gcodeFile: document.getElementById('gcodeFile'),
            dropZone: document.getElementById('dropZone'),
            dropContent: document.getElementById('dropContent'),
            fileSelected: document.getElementById('fileSelected'),
            fileName: document.getElementById('fileName'),
            fileSize: document.getElementById('fileSize'),
            fileInfo: document.getElementById('fileInfo'),
            fileDetails: document.getElementById('fileDetails'),

            // Animation controls
            playPause: document.getElementById('playPause'),
            reset: document.getElementById('reset'),
            speed: document.getElementById('speed'),
            speedValue: document.getElementById('speedValue'),
            progress: document.getElementById('progress'),
            progressText: document.getElementById('progressText'),

            // View options
            showPrinthead: document.getElementById('showPrinthead'),
            showAxisMarker: document.getElementById('showAxisMarker'),
            showRealisticHead: document.getElementById('showRealisticHead'),
            showCollisions: document.getElementById('showCollisions'),
            collisionInfo: document.getElementById('collisionInfo'),
            collisionCount: document.getElementById('collisionCount'),

            // Position display
            posX: document.getElementById('posX'),
            posY: document.getElementById('posY'),
            posZ: document.getElementById('posZ'),
            posC: document.getElementById('posC'),
            posB: document.getElementById('posB'),
            layer: document.getElementById('layer'),

            // Printhead selector
            printheadSelect: document.getElementById('printheadSelect'),

            // Advanced options
            advancedOptions: document.getElementById('advancedOptions'),
            manualMode: document.getElementById('manualMode'),
            manualControls: document.getElementById('manualControls'),
            manualIK: document.getElementById('manualIK'),
            manualLC: document.getElementById('manualLC'),
            manualLB: document.getElementById('manualLB'),
            applyManual: document.getElementById('applyManual'),

            // Loading
            loading: document.getElementById('loading'),
            canvas3d: document.getElementById('canvas3d')
        };

        // Callbacks (set by main app)
        this.onFileSelect = null;
        this.onPlayPause = null;
        this.onReset = null;
        this.onSpeedChange = null;
        this.onProgressChange = null;
        this.onShowPrintheadChange = null;
        this.onShowAxisMarkerChange = null;
        this.onShowRealisticHeadChange = null;
        this.onShowCollisionsChange = null;
        this.onPrintheadChange = null;
        this.onManualModeChange = null;
        this.onApplyManual = null;
    }

    setupEventListeners() {
        // File upload
        this.elements.gcodeFile.addEventListener('change', (e) => {
            if (this.onFileSelect) this.onFileSelect(e.target.files[0]);
        });

        this.setupDragAndDrop();

        // Animation controls
        this.elements.playPause.addEventListener('click', () => {
            if (this.onPlayPause) this.onPlayPause();
        });

        this.elements.reset.addEventListener('click', () => {
            if (this.onReset) this.onReset();
        });

        this.elements.speed.addEventListener('input', (e) => {
            const speed = parseFloat(e.target.value);
            this.elements.speedValue.textContent = speed.toFixed(1);
            if (this.onSpeedChange) this.onSpeedChange(speed);
        });

        this.elements.progress.addEventListener('input', (e) => {
            const progress = parseFloat(e.target.value);
            if (this.onProgressChange) this.onProgressChange(progress);
        });

        // View controls
        this.elements.showPrinthead.addEventListener('change', (e) => {
            if (this.onShowPrintheadChange) this.onShowPrintheadChange(e.target.checked);
        });

        this.elements.showAxisMarker.addEventListener('change', (e) => {
            if (this.onShowAxisMarkerChange) this.onShowAxisMarkerChange(e.target.checked);
        });

        this.elements.showRealisticHead.addEventListener('change', (e) => {
            if (this.onShowRealisticHeadChange) this.onShowRealisticHeadChange(e.target.checked);
        });

        this.elements.printheadSelect.addEventListener('change', (e) => {
            if (this.onPrintheadChange) this.onPrintheadChange(e.target.value);
        });

        this.elements.showCollisions.addEventListener('change', (e) => {
            if (this.onShowCollisionsChange) this.onShowCollisionsChange(e.target.checked);
        });

        // Manual override controls
        this.elements.manualMode.addEventListener('change', (e) => {
            if (this.onManualModeChange) this.onManualModeChange(e.target.checked);
        });

        // Load LC/LB from browser storage when IK is enabled
        this.elements.manualIK.addEventListener('change', (e) => {
            if (e.target.checked) {
                const lc = StorageManager.loadLc();
                const lb = StorageManager.loadLb();
                if (lc !== null) this.elements.manualLC.value = lc;
                if (lb !== null) this.elements.manualLB.value = lb;
            }
        });

        this.elements.applyManual.addEventListener('click', () => {
            if (this.onApplyManual) this.onApplyManual();
        });

        // Window resize
        window.addEventListener('resize', () => {
            if (this.onResize) this.onResize();
        });
    }

    setupDragAndDrop() {
        const dropZone = this.elements.dropZone;

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                dropZone.classList.add('drag-over');
            });
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                dropZone.classList.remove('drag-over');
            });
        });

        dropZone.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            if (files.length > 0 && this.onFileSelect) {
                this.onFileSelect(files[0]);
            }
        });
    }

    // Display methods
    showFileSelected(fileName, fileSize) {
        this.elements.dropContent.classList.add('hidden');
        this.elements.fileSelected.classList.remove('hidden');
        this.elements.fileName.textContent = fileName;
        this.elements.fileSize.textContent = fileSize;
    }

    showLoading(message = 'Loading...') {
        this.elements.loading.style.display = 'flex';
        this.elements.loading.querySelector('p').textContent = message;
    }

    hideLoading() {
        this.elements.loading.style.display = 'none';
    }

    displayFileInfo(metadata, statistics) {
        let html = '<div class="space-y-1">';

        if (metadata.shape) html += `<div><strong>Shape:</strong> ${metadata.shape}</div>`;
        if (metadata.diameter) html += `<div><strong>Diameter:</strong> ${metadata.diameter}mm</div>`;
        if (metadata.height) html += `<div><strong>Height:</strong> ${metadata.height}mm</div>`;
        if (metadata.layerHeight) html += `<div><strong>Layer Height:</strong> ${metadata.layerHeight}mm</div>`;
        if (metadata.calculatedPrintSpeed) html += `<div><strong>Print Speed:</strong> ${metadata.calculatedPrintSpeed.toFixed(1)}mm/s</div>`;

        html += '<div class="mt-2 pt-2 border-t border-gray-300">';
        html += `<div><strong>Commands:</strong> ${statistics.totalCommands}</div>`;
        html += `<div><strong>Layers:</strong> ${statistics.layers}</div>`;
        html += `<div><strong>Print Distance:</strong> ${statistics.printDistance}mm</div>`;
        html += `<div><strong>Est. Time:</strong> ${statistics.estimatedTime}</div>`;
        html += '</div>';

        html += '<div class="mt-2 pt-2 border-t border-gray-300">';
        html += `<div><strong>Inverse Kinematics:</strong> ${metadata.inverseKinematics ? 'Yes' : 'No'}</div>`;
        if (metadata.inverseKinematics) {
            html += `<div><strong>LC Parameter:</strong> ${metadata.lcParameter}</div>`;
            html += `<div><strong>LB Parameter:</strong> ${metadata.lbParameter}</div>`;
        }
        html += '</div>';
        html += '</div>';

        this.elements.fileDetails.innerHTML = html;
        this.elements.fileInfo.classList.remove('hidden');
    }

    displayIKAnalysis(analysis) {
        if (!analysis || analysis.totalCommands === 0) return;

        let ikHtml = '<div class="mt-2 pt-2 border-t border-gray-300">';
        ikHtml += '<div><strong>IK Correction Analysis:</strong></div>';
        ikHtml += `<div class="text-xs">Max X: ±${analysis.summary.maxX}mm</div>`;
        ikHtml += `<div class="text-xs">Max Y: ±${analysis.summary.maxY}mm</div>`;
        ikHtml += `<div class="text-xs">Max Z: ±${analysis.summary.maxZ}mm</div>`;
        ikHtml += `<div class="text-xs">Avg corrections: ±${analysis.summary.avgX}, ±${analysis.summary.avgY}, ±${analysis.summary.avgZ}mm</div>`;
        ikHtml += '</div>';

        this.elements.fileDetails.innerHTML += ikHtml;
    }

    displayCalibrationInfo(summary) {
        if (!summary || !summary.enabled) return;

        let calibHtml = '<div class="mt-2 pt-2 border-t border-gray-300">';
        calibHtml += '<div><strong>Calibration Correction:</strong></div>';
        calibHtml += `<div class="text-xs text-green-600">✓ Detected and reversed for display</div>`;
        calibHtml += `<div class="text-xs">C-axis: ${summary.cHarmonics} Fourier harmonics</div>`;
        calibHtml += `<div class="text-xs">B-axis: ${summary.bHarmonics} harmonics</div>`;
        calibHtml += '</div>';

        this.elements.fileDetails.innerHTML += calibHtml;
    }

    updateReversalStatus(status) {
        // Update UI to show which reversals are active
        const statusEl = document.getElementById('reversalStatus');
        if (!statusEl) return;

        let html = '';
        if (status.ik) {
            html += '<span class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded mr-1">IK reversed</span>';
        }
        if (status.calibration) {
            html += '<span class="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Calibration reversed</span>';
        }
        statusEl.innerHTML = html;
    }

    updateProgress(progress) {
        this.elements.progress.value = progress;
        this.elements.progressText.textContent = `${Math.round(progress)}%`;
    }

    updateLayer(layer) {
        this.elements.layer.textContent = layer;
    }

    updatePositionDisplay(position) {
        this.elements.posX.textContent = position.x.toFixed(3);
        this.elements.posY.textContent = position.y.toFixed(3);
        this.elements.posZ.textContent = position.z.toFixed(3);
        this.elements.posC.textContent = position.c.toFixed(3);
        this.elements.posB.textContent = position.b.toFixed(3);
    }

    updateCollisionDisplay(count) {
        if (count > 0) {
            this.elements.collisionInfo.classList.remove('hidden');
            this.elements.collisionCount.textContent = count;
        } else {
            this.elements.collisionInfo.classList.add('hidden');
        }
    }

    setPlayButtonState(isPlaying) {
        if (isPlaying) {
            this.elements.playPause.innerHTML = `
                <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6"></path>
                </svg>
                Pause Animation
            `;
        } else {
            this.elements.playPause.innerHTML = `
                <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3l14 9-14 9V3z"></path>
                </svg>
                Play Animation
            `;
        }
    }

    enableControls() {
        this.elements.playPause.disabled = false;
        this.elements.reset.disabled = false;
    }

    setSpeed(speed) {
        this.elements.speed.value = speed;
        this.elements.speedValue.textContent = speed.toFixed(1);
    }

    showAdvancedOptions() {
        this.elements.advancedOptions.classList.remove('hidden');
    }

    toggleManualControls(show) {
        if (show) {
            this.elements.manualControls.classList.remove('hidden');
        } else {
            this.elements.manualControls.classList.add('hidden');
        }
    }

    prefillAdvancedOptions(metadata) {
        this.elements.manualIK.checked = metadata.inverseKinematics || false;
        this.elements.manualLC.value = metadata.lcParameter || 0;
        this.elements.manualLB.value = metadata.lbParameter || 46;
    }

    getManualSettings() {
        const manualCalibration = document.getElementById('manualCalibration');
        return {
            inverseKinematics: this.elements.manualIK.checked,
            lcParameter: parseFloat(this.elements.manualLC.value) || 0,
            lbParameter: parseFloat(this.elements.manualLB.value) || 46,
            reverseCalibration: manualCalibration ? manualCalibration.checked : true
        };
    }

    showPauseMessage(message) {
        this.elements.playPause.innerHTML = `
            <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3l14 9-14 9V3z"></path>
            </svg>
            Continue
        `;

        let overlay = document.getElementById('pauseOverlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'pauseOverlay';
            overlay.className = 'absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-black bg-opacity-80 text-white px-6 py-4 rounded-lg text-center z-50';
            this.elements.canvas3d.parentElement.appendChild(overlay);
        }
        overlay.innerHTML = `
            <div class="text-lg font-bold mb-2">PAUSED</div>
            <div class="text-sm mb-3">${message}</div>
            <div class="text-xs text-gray-300">Click "Continue" to proceed</div>
        `;
        overlay.style.display = 'block';
    }

    hidePauseMessage() {
        const overlay = document.getElementById('pauseOverlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
    }

    // Printhead selector methods
    populatePrintheadSelector(printheads, selectedId) {
        this.elements.printheadSelect.innerHTML = '';
        for (const ph of printheads) {
            const option = document.createElement('option');
            option.value = ph.id;
            option.textContent = ph.name;
            option.title = ph.description;
            if (ph.id === selectedId) {
                option.selected = true;
            }
            this.elements.printheadSelect.appendChild(option);
        }
    }

    getSelectedPrintheadId() {
        return this.elements.printheadSelect.value;
    }
}
