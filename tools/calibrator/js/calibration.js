/**
 * Step 4: Calibrate XY
 * Handles X/Y calibration with camera (top-down view)
 */

class StepCalibrateXY {
    constructor(app) {
        this.app = app;
        this.graphRenderer = null;
        this.currentSweep = 'c';
        this.importedData = null;
        this.confirmInProgress = false;
        this.controlsLocked = false;
        this.movementInProgress = false;  // Prevent race conditions
    }

    setup() {
        document.getElementById('confirm-point-btn').addEventListener('click', () => this.confirmCurrentPoint());
        document.getElementById('skip-c-sweep-btn')?.addEventListener('click', () => this.skipCSweep());
        document.getElementById('skip-to-z-btn')?.addEventListener('click', () => this.skipToZ());
        document.getElementById('redo-prev-btn')?.addEventListener('click', () => this.redoPreviousPoint());

        // Camera reconnect button
        const reconnectBtn = document.getElementById('reconnect-camera-btn');
        if (reconnectBtn) {
            reconnectBtn.addEventListener('click', () => this.reconnectCamera());
        }

        // Graph view selector
        document.querySelectorAll('#graph-axis-selector button').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#graph-axis-selector button').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const sweep = btn.dataset.view;
                const graphViewMode = sweep === 'c' ? 'b' : 'c';
                this.graphRenderer.setViewMode(graphViewMode, 0);
            });
        });

        const graphCanvas = document.getElementById('error-graph');
        this.graphRenderer = new GraphRenderer(graphCanvas);
        this.graphRenderer.setDataFromEngine(this.app.engine);
    }

    enter() {
        document.getElementById('nextBtn').style.display = 'none';
        this.showImportModal();
    }

    showImportModal() {
        let modal = document.getElementById('import-calibration-modal');
        if (modal) modal.remove();

        modal = document.createElement('div');
        modal.id = 'import-calibration-modal';
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        modal.innerHTML = `
            <div class="bg-white rounded-xl shadow-xl max-w-lg mx-4 p-6">
                <h3 class="text-lg font-bold text-gray-900 mb-3">Start calibration</h3>
                <p class="text-gray-600 mb-4">
                    Choose calibration mode based on whether you have existing calibration data.
                </p>
                <div class="space-y-3 mb-4">
                    <button id="start-fresh-btn" class="w-full btn-primary px-4 py-3 rounded-lg text-left">
                        <div class="font-medium">Fresh calibration</div>
                        <div class="text-sm opacity-75">No existing calibration - measure raw mechanical errors</div>
                    </button>
                    <button id="refine-calibration-btn" class="w-full btn-secondary px-4 py-3 rounded-lg text-left">
                        <div class="font-medium">Refine existing calibration</div>
                        <div class="text-sm text-gray-500">Measure residual errors and add to current M667 coefficients</div>
                    </button>
                    <button id="skip-xy-btn" class="w-full btn-outline px-4 py-3 rounded-lg text-left text-gray-600">
                        <div class="font-medium">Skip to Z calibration</div>
                        <div class="text-sm text-gray-500">Only calibrate Z axis (XY already done)</div>
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('refine-calibration-btn').addEventListener('click', () => {
            modal.remove();
            this.app.refineMode = true;
            // Set refine mode toggle on results page
            const toggle = document.getElementById('refine-mode-toggle');
            if (toggle) toggle.checked = true;
            this.startCalibration(false);  // Don't disable calibration correction
        });

        document.getElementById('start-fresh-btn').addEventListener('click', () => {
            modal.remove();
            this.app.refineMode = false;
            // Ensure refine mode toggle is unchecked
            const toggle = document.getElementById('refine-mode-toggle');
            if (toggle) toggle.checked = false;
            this.startCalibration(true);  // Disable calibration correction for fresh start
        });

        document.getElementById('skip-xy-btn').addEventListener('click', () => {
            modal.remove();
            this.skipToZ();
        });
    }

    /**
     * Skip entire XY calibration and go to Z
     */
    skipToZ() {
        this.app.nextStep();
    }

    /**
     * Skip remaining C sweep points and go to B sweep
     */
    skipCSweep() {
        if (this.movementInProgress) return;

        // Find first B sweep point
        const engine = this.app.engine;
        while (engine.currentIndex < engine.totalPoints) {
            const point = engine.getCurrentPoint();
            if (point && point.b !== 0) {
                // Found first B point
                break;
            }
            // Skip this A point
            engine.currentIndex++;
        }

        if (engine.currentIndex >= engine.totalPoints) {
            // No more points, go to next step
            this.app.nextStep();
        } else {
            this.moveToCurrentPoint();
        }
    }

    parseCSV(csvText) {
        const lines = csvText.trim().split('\n');
        if (lines.length < 2) return null;
        const measurements = [];
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',');
            if (values.length >= 11) {
                measurements.push({
                    c: parseFloat(values[0]),
                    b: parseFloat(values[1]),
                    expected: { x: parseFloat(values[2]), y: parseFloat(values[3]), z: parseFloat(values[4]) },
                    actual: { x: parseFloat(values[5]), y: parseFloat(values[6]), z: parseFloat(values[7]) },
                    error: { x: parseFloat(values[8]), y: parseFloat(values[9]), z: parseFloat(values[10]) },
                    skipped: false
                });
            }
        }
        return { measurements };
    }

    importCalibrationData(data) {
        this.importedData = new Map();
        if (data.measurements) {
            for (const m of data.measurements) {
                this.importedData.set(`${m.c}_${m.b}`, m);
            }
        }
        this.startCalibration();
    }

    async startCalibration(disableCalibrationCorrection = true) {
        // Reset redo button
        const redoBtn = document.getElementById('redo-prev-btn');
        if (redoBtn) redoBtn.disabled = true;

        // Disable or keep calibration correction based on mode
        if (this.app.printer && this.app.printer.isConnected()) {
            try {
                if (disableCalibrationCorrection) {
                    await this.app.printer.sendCommandAndWait('M667 S0', 5000);
                    console.log('[Calibration] Calibration correction disabled for fresh calibration');
                } else {
                    // Keep calibration correction enabled for refine mode
                    console.log('[Calibration] Calibration correction kept enabled for refine mode');
                }
            } catch (e) {
                console.warn('[Calibration] Could not set calibration correction state:', e);
            }
        }

        const cameraPanel = document.getElementById('calibrationCameraPanel');
        const conePanel = document.getElementById('calibrationConePanel');

        if (this.app.selectedMethod === 'camera') {
            if (cameraPanel) cameraPanel.style.display = 'block';
            if (conePanel) conePanel.style.display = 'none';

            if (this.app.camera.isActive()) {
                this.app.camera.setMode('crosshair');
                await this.app.camera.attachToElement('calibration-video', 'calibration-overlay');
            } else {
                // Try to get camera access
                try {
                    await this.app.camera.requestAccess();
                    this.app.camera.setMode('crosshair');
                    await this.app.camera.attachToElement('calibration-video', 'calibration-overlay');
                } catch (e) {
                    console.error('Could not access camera:', e);
                    if (this.app.testMode) {
                        this.renderTestModePlaceholder();
                    }
                }
            }

            // Set zoom after camera is attached (with small delay to ensure video is ready)
            setTimeout(() => {
                const video = document.getElementById('calibration-video');
                if (video) {
                    video.style.transform = 'scale(2)';
                }
            }, 100);
        } else {
            if (cameraPanel) cameraPanel.style.display = 'none';
            if (conePanel) conePanel.style.display = 'block';
        }

        // Setup UI
        document.getElementById('calibration-title').textContent = 'X/Y calibration';
        document.getElementById('jog-z-controls').classList.add('hidden');

        // Hide Z offset during XY calibration
        const zOffsetEl = document.getElementById('offset-z');
        if (zOffsetEl) zOffsetEl.parentElement.style.display = 'none';

        document.getElementById('calibration-instructions').innerHTML = `
            <li>Camera on bed looking up at nozzle</li>
            <li>Use X/Y jog to centre nozzle in crosshair</li>
            <li>Press "Confirm" when aligned (Enter)</li>
        `;

        this.currentSweep = 'c';
        this.app.engine.currentIndex = 0;  // Reset to start from beginning
        this.app.engine.phase = 'xy';
        this.graphRenderer.calibrationPhase = 'xy';
        this.graphRenderer.setViewMode('b', 0);

        // Store current imported offset for display
        this.currentImportedOffset = null;

        this.app.engine.onProgressUpdate = (percent, completed, total) => {
            document.getElementById('progress-text').textContent = `${completed} / ${total}`;
            document.getElementById('progress-fill').style.width = `${percent}%`;
            document.getElementById('progress-percent').textContent = `${percent}%`;
        };

        this.app.engine.onMeasurementComplete = async () => {
            // Move to safe position
            const safeZ = this.app.referencePosition.z + 50;
            await this.app.printer.sendCommand('G90');
            await this.app.printer.sendCommand(`G0 Z${safeZ.toFixed(2)} F3000`);
            await this.app.printer.sendCommand('M400');
            await this.app.printer.sendCommand('G0 C0 B0 F1800');
            await this.app.printer.sendCommand('M400');

            // Show XY completion dialog instead of auto-advancing
            this.showXYCompletionDialog();
        };

        this.moveToCurrentPoint();
    }

    async moveToCurrentPoint() {
        // Prevent concurrent movements
        if (this.movementInProgress) {
            return;
        }
        this.movementInProgress = true;

        const point = this.app.engine.getCurrentPoint();
        if (!point) {
            this.movementInProgress = false;
            if (this.app.engine.onMeasurementComplete) {
                this.app.engine.onMeasurementComplete();
            }
            return;
        }

        // Verify reference position is set
        if (!this.app.referencePosition || this.app.referencePosition.z === undefined) {
            console.error('Reference position not set!');
            this.movementInProgress = false;
            alert('Reference position not set. Please go back and set the reference point.');
            return;
        }

        // Lock controls during movement
        this.setControlsLocked(true);

        try {
            // Update UI immediately
            document.getElementById('current-c').textContent = point.c;
            document.getElementById('current-b').textContent = point.b;

            // Check for sweep transition (C sweep -> B sweep)
            // Transition happens when we reach the first B sweep point (index = cAngles.length)
            const cAnglesCount = this.app.engine.cAngles.length;
            if (this.currentSweep === 'c' && this.app.engine.currentIndex >= cAnglesCount) {
                // Transition from C sweep to B sweep
                this.movementInProgress = false;
                this.setControlsLocked(false);
                await this.transitionToBSweep(point);
                return;  // Will continue after transition
            }

            // Special case: C0B0 at start of C sweep (index 0) - auto-confirm
            // C0B0 at start of B sweep (index = cAngles.length) - DON'T auto-confirm, let user set new reference
            if (point.c === 0 && point.b === 0 && this.app.engine.currentIndex === 0) {
                // Get current position and record it
                const pos = this.app.printer.getPosition();
                const expected = this.app.engine.getExpectedPosition(0, 0);

                if (pos && pos.x !== undefined) {
                    // Get existing measurement to preserve Z value if it exists (from Z calibration)
                    const existingMeasurement = this.app.engine.getMeasurement(0, 0);
                    const actualZ = existingMeasurement?.actual?.z ?? expected.z;

                    // Record XY, preserve existing Z or use expected Z
                    this.app.engine.recordMeasurement(0, 0, { x: pos.x, y: pos.y, z: actualZ });
                    this.graphRenderer.render();

                    // Unlock and move to next point
                    this.setControlsLocked(false);
                    this.movementInProgress = false;

                    // Move to next point immediately
                    await this.moveToCurrentPoint();
                } else {
                    console.error('Position not available for C0B0 auto-confirm');
                    this.setControlsLocked(false);
                    this.movementInProgress = false;
                }
                return;
            }

            // Special case: C0B0 at start of B sweep (index = cAngles.length)
            // This is the new reference point - show offset as 0.000 and let user confirm to reset reference
            if (point.c === 0 && point.b === 0 && this.app.engine.currentIndex === this.app.engine.cAngles.length) {
                // Clear offset display to show this is the reference
                document.getElementById('offset-x').textContent = '0.000';
                document.getElementById('offset-y').textContent = '0.000';

                // Unlock controls so user can adjust
                this.setControlsLocked(false);
                this.movementInProgress = false;
                // Don't auto-advance - wait for user to confirm
                return;
            }

            // With firmware IK enabled, we just send the reference position with the desired angles
            // Firmware handles all the position compensation automatically
            const ref = this.app.referencePosition;

            console.log('Moving to reference position with firmware IK:', {
                point,
                reference: { x: ref.x, y: ref.y, z: ref.z }
            });

            // Reset offset display - will be updated after position is received
            document.getElementById('offset-x').textContent = '0.000';
            document.getElementById('offset-y').textContent = '0.000';

            // Single movement command - firmware IK handles everything
            // No need for safety Z lifts, separate rotations, or calculated positions
            await this.app.printer.sendCommand('G90');  // Absolute mode
            await this.app.printer.sendCommand(`G0 X${ref.x.toFixed(2)} Y${ref.y.toFixed(2)} Z${ref.z.toFixed(2)} C${point.c.toFixed(1)} B${point.b.toFixed(1)} F1800`);
            await this.app.printer.sendCommand('M400');  // Wait for move to complete

            // Unlock controls immediately after movement completes
            this.setControlsLocked(false);
            this.movementInProgress = false;

            // Request position for display (non-blocking for UX)
            this.app.printer.requestPosition().then(() => {
                this.updateOffsetDisplay();
            }).catch(e => console.warn('Position request failed:', e));

        } catch (error) {
            console.error('Movement error:', error);
            this.setControlsLocked(false);
            this.movementInProgress = false;
        }
    }

    /**
     * Transition from C sweep to B sweep
     * Completes the C rotation (to 360° = 0°) and sets new reference at C0B0
     */
    async transitionToBSweep(nextPoint) {
        console.log('Transitioning from C sweep to B sweep');

        const ref = this.app.referencePosition;

        // Temporarily disable IK for rotation/reset (avoids IK interference)
        await this.app.printer.sendCommand('G49');
        await this.app.printer.sendCommand('M400');

        // 1. Complete C rotation using relative move (avoids C360 limit issues)
        // We're at C315, need to complete to 360° = 0°
        console.log('Completing C rotation (+45° relative to reach 360)');
        await this.app.printer.sendCommand('G91');
        await this.app.printer.sendCommand('G0 C45 F1800');
        await this.app.printer.sendCommand('M400');
        await this.app.printer.sendCommand('G90');

        // Reset C to 0 (we're now physically at 360° = 0°)
        await this.app.printer.sendCommand('G92 C0');
        await this.app.printer.sendCommand('M400');

        // Explicit move to C0 to confirm reset
        await this.app.printer.sendCommand('G0 C0 F1800');
        await this.app.printer.sendCommand('M400');

        // Re-enable IK
        await this.app.printer.sendCommand('G43.4');
        await this.app.printer.sendCommand('M400');

        // 2. Move to C0B0 reference position - firmware IK handles everything
        console.log('Moving to C0B0 reference position with firmware IK');
        await this.app.printer.sendCommand(`G0 X${ref.x.toFixed(2)} Y${ref.y.toFixed(2)} Z${ref.z.toFixed(2)} C0 B0 F1800`);
        await this.app.printer.sendCommand('M400');

        // Wait for position to settle
        await new Promise(r => setTimeout(r, 500));

        // Request position update and wait for it
        await this.app.printer.requestPosition();
        await new Promise(r => setTimeout(r, 200));

        // Switch to B sweep mode
        this.currentSweep = 'b';
        const graphViewMode = 'c';
        document.querySelectorAll('#graph-axis-selector button').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === 'b');
        });
        this.graphRenderer.setViewMode(graphViewMode, 0);
        this.graphRenderer.render();

        // Continue to first B sweep point (C0B0 - user will confirm to reset reference)
        await this.moveToCurrentPoint();
    }

    /**
     * Lock/unlock controls during movement
     */
    setControlsLocked(locked) {
        this.controlsLocked = locked;

        const confirmBtn = document.getElementById('confirm-point-btn');
        const jogBtns = document.querySelectorAll('#step-3 .jog-btn');
        const stepBtns = document.querySelectorAll('#step-3 .step-btn');

        if (confirmBtn) {
            confirmBtn.disabled = locked;
            if (locked) {
                confirmBtn.textContent = 'Moving...';
            } else {
                confirmBtn.textContent = 'Confirm (Enter)';
            }
        }

        jogBtns.forEach(btn => btn.disabled = locked);
        stepBtns.forEach(btn => btn.disabled = locked);
    }

    async confirmCurrentPoint() {
        // Prevent overlapping confirm commands
        if (this.confirmInProgress || this.controlsLocked) return;
        this.confirmInProgress = true;
        this.setControlsLocked(true);  // Lock immediately

        try {
            const point = this.app.engine.getCurrentPoint();
            if (!point) {
                console.log('No current point - calibration complete');
                return;
            }

            console.log('Confirming point:', point.c, point.b);

            // Use cached position - it's already up to date from position display
            const pos = this.app.printer.getPosition();
            if (!pos || pos.x === undefined) {
                console.error('No position data available');
                return;
            }

            // Special case: C0B0 at start of B sweep (resetting reference)
            if (point.c === 0 && point.b === 0 && this.app.engine.currentIndex === this.app.engine.cAngles.length) {
                console.log('Resetting XY reference for B sweep to:', pos);
                // Reset the reference to current position
                this.app.referencePosition = {
                    x: pos.x,
                    y: pos.y,
                    z: pos.z,
                    a: 0,
                    b: 0
                };
                // Update engine reference
                this.app.engine.setReferencePosition(pos.x, pos.y, pos.z);

                // Get existing measurement to preserve Z value if it exists (from Z calibration)
                const existingMeasurement = this.app.engine.getMeasurement(0, 0);
                const actualZ = existingMeasurement?.actual?.z ?? pos.z;

                // Record the new reference
                this.app.engine.recordMeasurement(0, 0, { x: pos.x, y: pos.y, z: actualZ });
                console.log('Recorded new B sweep reference at C0B0, advancing to next point');

                this.graphRenderer.render();

                // Enable redo button
                const redoBtn = document.getElementById('redo-prev-btn');
                if (redoBtn) redoBtn.disabled = false;

                // Wait a moment for the reference to settle before moving to first B point
                await this.app.printer.sendCommand('M400');
                await new Promise(r => setTimeout(r, 500));

                await this.moveToCurrentPoint();
                return;
            }

            // Normal point confirmation
            const expected = this.app.engine.getExpectedPosition(point.c, point.b);

            // Record the actual offset (current pos - expected = error)
            const errorX = pos.x - expected.x;
            const errorY = pos.y - expected.y;
            console.log('Recording error:', { errorX, errorY });

            // Get existing measurement to preserve Z value if it exists (from Z calibration)
            const existingMeasurement = this.app.engine.getMeasurement(point.c, point.b);
            const actualZ = existingMeasurement?.actual?.z ?? expected.z;

            // Record XY, preserve existing Z or use expected Z
            this.app.engine.recordMeasurement(point.c, point.b, { x: pos.x, y: pos.y, z: actualZ });
            console.log('Recorded XY measurement, advancing to next point');

            this.graphRenderer.render();

            // Enable redo button now that we have a previous point
            const redoBtn = document.getElementById('redo-prev-btn');
            if (redoBtn) redoBtn.disabled = false;

            await this.moveToCurrentPoint();
        } catch (error) {
            console.error('Error confirming point:', error);
            this.setControlsLocked(false);  // Unlock on error
        } finally {
            this.confirmInProgress = false;
        }
    }

    /**
     * Show XY calibration completion dialog with save option
     */
    showXYCompletionDialog() {
        // Get statistics
        const stats = this.app.engine.getStatistics();

        // Create modal
        let modal = document.getElementById('xy-complete-modal');
        if (modal) modal.remove();

        modal = document.createElement('div');
        modal.id = 'xy-complete-modal';
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        modal.innerHTML = `
            <div class="bg-white rounded-xl shadow-xl p-6 max-w-md mx-4">
                <h3 class="text-xl font-bold text-gray-900 mb-4">X/Y calibration complete!</h3>

                <div class="bg-gray-50 rounded-lg p-4 mb-4">
                    <div class="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <span class="text-gray-500">X max error:</span>
                            <span class="font-mono font-bold text-red-600">${stats ? stats.x.absMax.toFixed(2) : '--'}mm</span>
                        </div>
                        <div>
                            <span class="text-gray-500">Y max error:</span>
                            <span class="font-mono font-bold text-green-600">${stats ? stats.y.absMax.toFixed(2) : '--'}mm</span>
                        </div>
                        <div>
                            <span class="text-gray-500">Points measured:</span>
                            <span class="font-bold">${stats ? stats.completedPoints : 0} / ${stats ? stats.totalPoints : 0}</span>
                        </div>
                    </div>
                </div>

                <div class="space-y-3">
                    <button id="continue-to-z-btn" class="w-full btn-primary py-3 rounded-lg font-medium">
                        Continue to Z calibration →
                    </button>
                    <button id="skip-z-from-xy-btn" class="w-full btn-outline py-2 rounded-lg text-sm text-gray-500">
                        Skip Z calibration (go to results)
                    </button>
                </div>
                <p class="text-xs text-gray-400 mt-3 text-center">Calibration data will be exported to printer at the end</p>
            </div>
        `;
        document.body.appendChild(modal);

        // Event handlers
        document.getElementById('continue-to-z-btn').addEventListener('click', () => {
            modal.remove();
            this.app.nextStep();
        });

        document.getElementById('skip-z-from-xy-btn').addEventListener('click', () => {
            modal.remove();
            // Skip to results
            this.app.currentStep = 5;  // Results step
            this.app.showStep(5);
        });
    }


    /**
     * Redo the previous measurement point
     */
    async redoPreviousPoint() {
        if (this.controlsLocked || this.app.engine.currentIndex === 0) return;

        this.setControlsLocked(true);

        try {
            // Get the previous point
            const points = this.app.engine.getGridPoints();
            const prevIndex = this.app.engine.currentIndex - 1;
            const prevPoint = points[prevIndex];

            if (!prevPoint) {
                console.warn('No previous point to redo');
                return;
            }

            console.log('Redoing previous point:', prevPoint);

            // Remove the measurement for the previous point
            const key = `${prevPoint.c}_${prevPoint.b}`;
            this.app.engine.measurements.delete(key);

            // Go back to the previous point
            this.app.engine.currentIndex = prevIndex;

            // Update sweep state if needed
            this.currentSweep = prevPoint.b === 0 ? 'c' : 'b';

            // Update progress display
            if (this.app.engine.onProgressUpdate) {
                this.app.engine.onProgressUpdate(
                    this.app.engine.progressPercent,
                    this.app.engine.completedCount,
                    this.app.engine.totalPoints
                );
            }

            // Disable redo button if we're back to the first point
            const redoBtn = document.getElementById('redo-prev-btn');
            if (redoBtn) redoBtn.disabled = (prevIndex === 0);

            // Update graph
            this.graphRenderer.render();

            // Move to the point
            await this.moveToCurrentPoint();

        } catch (error) {
            console.error('Error redoing point:', error);
        } finally {
            this.setControlsLocked(false);
        }
    }

    updateOffsetDisplay() {
        const point = this.app.engine.getCurrentPoint();
        if (!point) return;

        const expected = this.app.engine.getExpectedPosition(point.c, point.b);
        const pos = this.app.printer.getPosition();

        console.log('updateOffsetDisplay:', {
            point,
            expected,
            pos,
            referencePosition: this.app.engine.referencePosition
        });

        if (pos && pos.x !== undefined) {
            const offsetX = pos.x - expected.x;
            const offsetY = pos.y - expected.y;
            document.getElementById('offset-x').textContent = offsetX.toFixed(3);
            document.getElementById('offset-y').textContent = offsetY.toFixed(3);
            console.log('Offset calculated:', { offsetX, offsetY });
        } else {
            console.warn('No position data for offset display');
        }
        // Z offset hidden during XY calibration
    }

    renderTestModePlaceholder() {
        const canvas = document.getElementById('calibration-overlay');
        if (!canvas) return;
        const container = canvas.parentElement;
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#666';
        ctx.font = '14px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('TEST MODE - No camera', canvas.width / 2, canvas.height / 2);
    }

    async reconnectCamera() {
        const btn = document.getElementById('reconnect-camera-btn');
        if (btn) btn.textContent = '...';
        try {
            // Stop current stream and request fresh one
            this.app.camera.stop();
            await this.app.camera.requestAccess();
            this.app.camera.setMode('crosshair');
            await this.app.camera.attachToElement('calibration-video', 'calibration-overlay');
            // Force video to play
            const video = document.getElementById('calibration-video');
            if (video) video.play().catch(() => {});
            if (btn) btn.textContent = '↻ Camera';
        } catch (e) {
            console.error('Failed to reconnect camera:', e);
            if (btn) btn.textContent = '✗ Failed';
            setTimeout(() => { if (btn) btn.textContent = '↻ Camera'; }, 2000);
        }
    }
}


/**
 * Step 5: Calibrate Z
 * Handles Z calibration with camera (side view)
 */

class StepCalibrateZ {
    constructor(app) {
        this.app = app;
        this.graphRenderer = null;
        this.currentSweep = 'c';
        this.confirmInProgress = false;
        this.controlsLocked = false;
        this.zReferenceConfirmed = false;
        this.zReferencePosition = null;
        this.importedData = null;  // Imported XY corrections for Z calibration
    }

    setup() {
        document.getElementById('confirm-point-btn-z')?.addEventListener('click', () => this.confirmCurrentPoint());
        document.getElementById('skip-z-btn')?.addEventListener('click', () => this.skip());
        document.getElementById('confirm-z-ref-btn')?.addEventListener('click', () => this.confirmZReference());

        // Camera reconnect buttons (both Z reference and Z calibration panels)
        const reconnectBtn = document.getElementById('reconnect-camera-btn-z');
        if (reconnectBtn) {
            reconnectBtn.addEventListener('click', () => this.reconnectCamera());
        }
        const reconnectBtnRef = document.getElementById('reconnect-camera-btn-z-ref');
        if (reconnectBtnRef) {
            reconnectBtnRef.addEventListener('click', () => this.reconnectCameraRef());
        }

        const graphCanvas = document.getElementById('error-graph-z');
        if (graphCanvas) {
            this.graphRenderer = new GraphRenderer(graphCanvas);
            this.graphRenderer.setDataFromEngine(this.app.engine);
        }
    }

    enter() {
        document.getElementById('nextBtn').style.display = 'none';

        // Only show for camera method
        if (this.app.selectedMethod !== 'camera') {
            this.app.nextStep();
            return;
        }

        // Reset state
        this.zReferenceConfirmed = false;
        this.zReferencePosition = null;

        // Get imported data from XY calibration step (for XY corrections during movement)
        this.importedData = this.app.stepCalibrateXY.importedData || null;

        // Check if we have XY calibration data from the previous step
        if (this.app.engine.measurements.size > 0) {
            console.log('Engine has', this.app.engine.measurements.size, 'measurements from XY calibration');
        } else {
            console.log('Starting Z calibration without XY data (XY was skipped)');
        }

        // Show reference panel, hide calibration panel
        document.getElementById('z-reference-panel').classList.remove('hidden');
        document.getElementById('z-calibration-panel').classList.add('hidden');

        // Show XY jog controls (in case they were hidden previously)
        const jogControls = document.getElementById('z-ref-jog-controls');
        if (jogControls) jogControls.classList.remove('hidden');

        // Setup camera for reference with line mode and flip
        this.setupReferenceCamera();
    }

    async setupReferenceCamera() {
        // Move nozzle to center X for Z reference setup (if reference is set)
        // Keep Y at reference, move X to center (100), C=0, B=0
        if (this.app.referencePosition) {
            const refPos = this.app.referencePosition;
            const centerX = 100;  // Center of bed
            const safeZ = refPos.z + 20;  // Safety offset

            console.log('Moving to center X for Z reference setup');
            await this.app.printer.sendCommand('G90');
            await this.app.printer.sendCommand(`G0 Z${safeZ.toFixed(2)} F3000`);  // Lift first
            await this.app.printer.sendCommand('M400');
            await this.app.printer.sendCommand('G0 C0 B0 F1800');  // Ensure C/B at 0
            await this.app.printer.sendCommand('M400');
            await this.app.printer.sendCommand(`G0 X${centerX} Y${refPos.y.toFixed(2)} F3000`);  // Move to center X
            await this.app.printer.sendCommand('M400');
            await this.app.printer.sendCommand(`G0 Z${refPos.z.toFixed(2)} F1500`);  // Lower to reference Z
            await this.app.printer.sendCommand('M400');
        } else {
            console.log('No reference position set - skipping movement, setting up camera only');
        }

        // Attach camera with line mode and flip (always do this, even if movement failed)
        if (this.app.camera.isActive()) {
            this.app.camera.setMode('line');
            await this.app.camera.attachToElement('z-ref-video', 'z-ref-overlay');
        } else {
            try {
                await this.app.camera.requestAccess();
                this.app.camera.setMode('line');
                await this.app.camera.attachToElement('z-ref-video', 'z-ref-overlay');
            } catch (e) {
                console.warn('Could not access camera for Z reference:', e);
            }
        }

        // Flip video for upside-down camera (always do this)
        const video = document.getElementById('z-ref-video');
        if (video) {
            video.style.transform = 'rotate(180deg)';
            console.log('Z reference camera flipped 180°');
        }

        // Request position and update Z display
        await this.app.printer.requestPosition();
        this.updateZRefDisplay();
    }

    updateZRefDisplay() {
        const pos = this.app.printer.getPosition();
        const display = document.getElementById('z-ref-display');
        if (display && pos && pos.z !== undefined) {
            display.textContent = pos.z.toFixed(2) + ' mm';
        }
    }

    async confirmZReference() {
        const pos = this.app.printer.getPosition();
        if (!pos || pos.z === undefined) {
            alert('Position not available. Please wait for printer connection.');
            return;
        }

        // Store Z reference
        this.zReferencePosition = pos.z;
        this.zReferenceConfirmed = true;

        console.log('Z reference confirmed:', this.zReferencePosition);

        // If no XY reference exists (skipped XY calibration), set it now for IK calculations
        if (!this.app.referencePosition) {
            console.log('No XY reference found - setting reference from Z reference position');
            this.app.referencePosition = {
                x: pos.x,
                y: pos.y,
                z: pos.z,
                a: pos.c || 0,
                b: pos.b || 0
            };
            // Set reference position in engine for IK calculations
            this.app.engine.setReferencePosition(pos.x, pos.y, pos.z);
        }

        // Update button
        const btn = document.getElementById('confirm-z-ref-btn');
        if (btn) {
            btn.textContent = 'Reference confirmed ✓';
            btn.disabled = true;
        }

        // Hide XY jog controls (no longer needed after reference is set)
        const jogControls = document.getElementById('z-ref-jog-controls');
        if (jogControls) jogControls.classList.add('hidden');

        // Hide reference panel, show calibration panel
        document.getElementById('z-reference-panel').classList.add('hidden');
        document.getElementById('z-calibration-panel').classList.remove('hidden');

        // Start calibration
        await this.startCalibration();
    }

    skip() {
        this.app.nextStep();
    }

    async startCalibration() {
        // Setup UI
        document.getElementById('calibration-title-z').textContent = 'Z calibration';
        document.getElementById('jog-z-controls-z').classList.remove('hidden');

        document.getElementById('calibration-instructions-z').innerHTML = `
            <li>Camera in <strong>side view</strong> (upright, flipped)</li>
            <li>Use Z jog to align nozzle tip with horizontal line</li>
            <li>Press "Confirm" when aligned (Enter)</li>
        `;

        // Attach camera with line mode and flip
        if (this.app.camera.isActive()) {
            this.app.camera.setMode('line');
            await this.app.camera.attachToElement('calibration-video-z', 'calibration-overlay-z');
        } else {
            try {
                await this.app.camera.requestAccess();
                this.app.camera.setMode('line');
                await this.app.camera.attachToElement('calibration-video-z', 'calibration-overlay-z');
            } catch (e) {
                console.warn('Could not access camera for Z calibration:', e);
            }
        }

        const video = document.getElementById('calibration-video-z');
        if (video) video.style.transform = 'scale(4) rotate(180deg)';

        this.currentSweep = 'c';
        // Start at index 0 (C0B0) - will auto-confirm and advance to C45
        this.app.engine.currentIndex = 0;
        this.app.engine.phase = 'z';

        if (this.graphRenderer) {
            this.graphRenderer.calibrationPhase = 'z';
            this.graphRenderer.setViewMode('b', 0);
        }

        this.app.engine.onProgressUpdate = (percent, completed, total) => {
            const progressText = document.getElementById('progress-text-z');
            const progressFill = document.getElementById('progress-fill-z');
            const progressPercent = document.getElementById('progress-percent-z');
            if (progressText) progressText.textContent = `${completed} / ${total}`;
            if (progressFill) progressFill.style.width = `${percent}%`;
            if (progressPercent) progressPercent.textContent = `${percent}%`;
        };

        this.app.engine.onMeasurementComplete = async () => {
            const safeZ = this.zReferencePosition + 50;
            await this.app.printer.sendCommand('G90');
            await this.app.printer.sendCommand(`G0 Z${safeZ.toFixed(2)} F3000`);
            await this.app.printer.sendCommand('M400');
            await this.app.printer.sendCommand('G0 C0 B0 F1800');
            await this.app.printer.sendCommand('M400');

            // Continue to results (export to printer happens there)
            this.app.nextStep();
        };

        // Start at C0B0 (will auto-confirm reference and move to C45)
        console.log('Starting Z calibration at C0B0 (will auto-confirm and advance)');
        this.moveToCurrentPoint();
    }

    async moveToCurrentPoint() {
        const point = this.app.engine.getCurrentPoint();
        if (!point) {
            if (this.app.engine.onMeasurementComplete) {
                this.app.engine.onMeasurementComplete();
            }
            return;
        }

        // Lock controls during movement
        this.setControlsLocked(true);

        try {
            const currentC = document.getElementById('current-c-z');
            const currentB = document.getElementById('current-b-z');
            if (currentC) currentC.textContent = point.c;
            if (currentB) currentB.textContent = point.b;

            // Check for sweep transition (C sweep -> B sweep)
            // Transition happens when we reach the first B sweep point (index = cAngles.length)
            const cAnglesCount = this.app.engine.cAngles.length;
            if (this.currentSweep === 'c' && this.app.engine.currentIndex >= cAnglesCount) {
                // Transition from C sweep to B sweep
                console.log('Z calibration: Transitioning from C sweep to B sweep at index', this.app.engine.currentIndex);
                this.setControlsLocked(false);
                await this.transitionToBSweepZ(point);
                return;  // Will continue after transition
            }

            // Special case: C0B0 at start of C sweep (index 0) - auto-confirm
            // C0B0 at start of B sweep (index = cAngles.length) - DON'T auto-confirm, let user set new reference
            if (point.c === 0 && point.b === 0 && this.app.engine.currentIndex === 0) {
                console.log('Z calibration: C0B0 start of C sweep - auto-confirming');

                // Get current position and record it with Z reference
                const pos = this.app.printer.getPosition();
                const expected = this.app.engine.getExpectedPosition(0, 0);

                if (pos && pos.x !== undefined) {
                    // Get XY from XY calibration if available
                    const xyMeasurement = this.app.engine.getMeasurement(0, 0);
                    const actualX = xyMeasurement?.actual.x || pos.x;
                    const actualY = xyMeasurement?.actual.y || pos.y;

                    // Use Z reference position for Z
                    // If XY reference exists, align Z to it; otherwise just use current Z
                    const adjustedZ = (this.app.referencePosition && this.app.referencePosition.z !== undefined)
                        ? this.app.referencePosition.z
                        : this.zReferencePosition;

                    // Record the measurement
                    this.app.engine.recordMeasurement(0, 0, { x: actualX, y: actualY, z: adjustedZ });
                    if (this.graphRenderer) this.graphRenderer.render();
                    console.log('Z calibration: C0B0 auto-confirmed, advancing to next point');

                    // Unlock and move to next point
                    this.setControlsLocked(false);

                    // Move to next point immediately
                    await this.moveToCurrentPoint();
                } else {
                    console.error('Position not available for C0B0 auto-confirm');
                    this.setControlsLocked(false);
                }
                return;
            }

            // Special case: C0B0 at start of B sweep (index = cAngles.length)
            // This is the new reference point - show offset as 0.000 and let user confirm to reset reference
            if (point.c === 0 && point.b === 0 && this.app.engine.currentIndex === this.app.engine.cAngles.length) {
                console.log('Z calibration: C0B0 start of B sweep - setting as new reference point');
                // Clear offset display to show this is the reference
                const offsetZ = document.getElementById('offset-z-z');
                if (offsetZ) offsetZ.textContent = '0.000';

                // Unlock controls so user can adjust
                this.setControlsLocked(false);
                // Don't auto-advance - wait for user to confirm
                return;
            }

            // With firmware IK enabled, we just send reference position with desired angles
            // Firmware handles all position compensation automatically
            // Use Z reference position (may differ from XY reference if Z calibration started fresh)
            const ref = this.app.referencePosition;
            const refZ = this.zReferencePosition || ref.z;

            console.log('Z calibration: Moving to reference position with firmware IK:', {
                point,
                reference: { x: ref.x, y: ref.y, z: refZ }
            });

            // Single movement command - firmware IK handles everything
            // No need for safety Z lifts or separate movements
            await this.app.printer.sendCommand('G90');
            await this.app.printer.sendCommand(`G0 X${ref.x.toFixed(2)} Y${ref.y.toFixed(2)} Z${refZ.toFixed(2)} C${point.c.toFixed(1)} B${point.b.toFixed(1)} F1800`);
            await this.app.printer.sendCommand('M400');

            // Unlock controls immediately after movement completes
            this.setControlsLocked(false);

            // Request position for display (non-blocking for UX)
            this.app.printer.requestPosition().then(() => {
                this.updateOffsetDisplay();
            }).catch(e => console.warn('Position request failed:', e));

        } catch (error) {
            console.error('Movement error:', error);
            this.setControlsLocked(false);
        }
    }

    /**
     * Transition from C sweep to B sweep for Z calibration
     * Moves to C=0,B=0 as the new reference point - automatic, no modal
     */
    async transitionToBSweepZ(nextPoint) {
        console.log('Z calibration: Transitioning from C sweep to B sweep');

        const ref = this.app.referencePosition;
        const refZ = this.zReferencePosition || ref.z;

        // Temporarily disable IK for rotation/reset (avoids IK interference)
        await this.app.printer.sendCommand('G49');
        await this.app.printer.sendCommand('M400');

        // 1. Complete rotation using relative move (avoids C360 limit issues)
        console.log('Completing C rotation (+45° relative)');
        await this.app.printer.sendCommand('G91');
        await this.app.printer.sendCommand('G0 C45 F1800');
        await this.app.printer.sendCommand('M400');
        await this.app.printer.sendCommand('G90');

        // Reset C to 0
        await this.app.printer.sendCommand('G92 C0');
        await this.app.printer.sendCommand('M400');

        // Explicit move to C0 to confirm reset
        await this.app.printer.sendCommand('G0 C0 F1800');
        await this.app.printer.sendCommand('M400');

        // Re-enable IK
        await this.app.printer.sendCommand('G43.4');
        await this.app.printer.sendCommand('M400');

        // 2. Move to C0B0 reference position - firmware IK handles everything
        console.log('Moving to C0B0 reference position with firmware IK');
        await this.app.printer.sendCommand(`G0 X${ref.x.toFixed(2)} Y${ref.y.toFixed(2)} Z${refZ.toFixed(2)} C0 B0 F1800`);
        await this.app.printer.sendCommand('M400');

        // Request position update
        await this.app.printer.requestPosition();

        // Continue with B sweep - no modal, automatic transition
        this.currentSweep = 'b';
        if (this.graphRenderer) {
            this.graphRenderer.setViewMode('c', 0);
        }

        // Continue to first B sweep point (C0B0 - user will confirm to reset Z reference)
        await this.moveToCurrentPoint();
    }

    /**
     * Lock/unlock controls during movement
     */
    setControlsLocked(locked) {
        this.controlsLocked = locked;

        const confirmBtn = document.getElementById('confirm-point-btn-z');
        const jogBtns = document.querySelectorAll('#step-4 .jog-btn');
        const stepBtns = document.querySelectorAll('#step-4 .step-btn');

        if (confirmBtn) {
            confirmBtn.disabled = locked;
            if (locked) {
                confirmBtn.textContent = 'Moving...';
            } else {
                confirmBtn.textContent = 'Confirm (Enter)';
            }
        }

        jogBtns.forEach(btn => btn.disabled = locked);
        stepBtns.forEach(btn => btn.disabled = locked);
    }

    async confirmCurrentPoint() {
        // Prevent overlapping confirm commands
        if (this.confirmInProgress || this.controlsLocked) return;
        this.confirmInProgress = true;
        this.setControlsLocked(true);  // Lock immediately

        try {
            const point = this.app.engine.getCurrentPoint();
            if (!point) {
                console.log('No current point - Z calibration complete');
                return;
            }

            console.log('Confirming Z point:', point.c, point.b);

            // Use cached position
            const pos = this.app.printer.getPosition();
            if (!pos || pos.x === undefined) {
                console.error('No position data available');
                return;
            }

            // Special case: C0B0 at start of B sweep (resetting reference)
            if (point.c === 0 && point.b === 0 && this.app.engine.currentIndex === this.app.engine.cAngles.length) {
                console.log('Resetting Z reference for B sweep to:', pos.z);
                // Reset the Z reference to current position
                this.zReferencePosition = pos.z;

                // Update existing measurement with actual Z
                const measurement = this.app.engine.getMeasurement(point.c, point.b);
                const actualX = measurement ? measurement.actual.x : pos.x;
                const actualY = measurement ? measurement.actual.y : pos.y;

                // Use current Z as the new reference baseline
                const adjustedZ = (this.app.referencePosition && this.app.referencePosition.z !== undefined)
                    ? this.app.referencePosition.z
                    : this.zReferencePosition;

                this.app.engine.recordMeasurement(point.c, point.b, { x: actualX, y: actualY, z: adjustedZ });
                console.log('Recorded new B sweep reference at C0B0, advancing to next point');

                if (this.graphRenderer) this.graphRenderer.render();
                await this.moveToCurrentPoint();
                return;
            }

            // Normal point confirmation
            // Update existing measurement with actual Z
            const measurement = this.app.engine.getMeasurement(point.c, point.b);
            const actualX = measurement ? measurement.actual.x : pos.x;
            const actualY = measurement ? measurement.actual.y : pos.y;

            // Adjust Z to account for different reference points
            // If we have an XY reference position, use it; otherwise use Z reference as baseline
            let adjustedZ;
            if (this.app.referencePosition && this.app.referencePosition.z !== undefined) {
                // Normal case: XY calibration was done, adjust relative to that reference
                adjustedZ = pos.z - this.zReferencePosition + this.app.referencePosition.z;
            } else {
                // Skipped XY: use Z reference position as the baseline (no adjustment needed)
                adjustedZ = pos.z;
            }

            this.app.engine.recordMeasurement(point.c, point.b, { x: actualX, y: actualY, z: adjustedZ });
            console.log('Recorded Z measurement, advancing to next point');

            if (this.graphRenderer) this.graphRenderer.render();
            await this.moveToCurrentPoint();
        } catch (error) {
            console.error('Error confirming Z point:', error);
            this.setControlsLocked(false);  // Unlock on error
        } finally {
            this.confirmInProgress = false;
        }
    }

    updateOffsetDisplay() {
        const point = this.app.engine.getCurrentPoint();
        if (!point) return;

        const pos = this.app.printer.getPosition();
        const offsetZ = document.getElementById('offset-z-z');

        if (pos && pos.z !== undefined && this.zReferencePosition !== null) {
            // With firmware IK, error is simply actual - reference
            // Firmware should keep nozzle at reference Z; any deviation is calibration error
            const zError = pos.z - this.zReferencePosition;
            if (offsetZ) offsetZ.textContent = zError.toFixed(3);
        }
    }

    async reconnectCamera() {
        const btn = document.getElementById('reconnect-camera-btn-z');
        if (btn) btn.textContent = '...';
        try {
            // Stop current stream and request fresh one
            this.app.camera.stop();
            await this.app.camera.requestAccess();
            this.app.camera.setMode('line');
            await this.app.camera.attachToElement('calibration-video-z', 'calibration-overlay-z');
            // Force video to play
            const video = document.getElementById('calibration-video-z');
            if (video) video.play().catch(() => {});
            if (btn) btn.textContent = '↻ Camera';
        } catch (e) {
            console.error('Failed to reconnect camera:', e);
            if (btn) btn.textContent = '✗ Failed';
            setTimeout(() => { if (btn) btn.textContent = '↻ Camera'; }, 2000);
        }
    }

    async reconnectCameraRef() {
        const btn = document.getElementById('reconnect-camera-btn-z-ref');
        if (btn) btn.textContent = '...';
        try {
            // Stop current stream and request fresh one
            this.app.camera.stop();
            await this.app.camera.requestAccess();
            this.app.camera.setMode('line');
            await this.app.camera.attachToElement('z-ref-video', 'z-ref-overlay');
            // Force video to play
            const video = document.getElementById('z-ref-video');
            if (video) video.play().catch(() => {});
            if (btn) btn.textContent = '↻ Camera';
        } catch (e) {
            console.error('Failed to reconnect camera:', e);
            if (btn) btn.textContent = '✗ Failed';
            setTimeout(() => { if (btn) btn.textContent = '↻ Camera'; }, 2000);
        }
    }
}
