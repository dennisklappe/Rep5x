/**
 * Step 3: LC Measurement
 * Measure C-axis offset by recording positions at 0°, 90°, 180°, 270°
 * Uses inverse kinematics to pre-position the nozzle when LC/LB estimates are provided.
 */

class StepLcMeasure {
    constructor(app) {
        this.app = app;
        this.currentStep = 0;
        this.angles = [0, 90, 180, 270];

        // IK-assisted positioning parameters
        this.useIkPositioning = false;
        this.estimatedLc = 0;
        this.estimatedLb = 54.67;
        this.referencePosition = null;  // Tip position at C=0 (camera focus point)
        this.zSafetyOffset = 0;  // No Z lift needed for LC measurement (rotating around vertical axis)
        this.coneSafetyMargin = 10; // Extra mm to stay above cone when using cone method
    }

    /**
     * Set up event listeners for this step
     */
    setup() {
        document.getElementById('lcConfirmBtn').addEventListener('click', () => this.confirmPosition());

        // Redo button
        const redoBtn = document.getElementById('lcRedoBtn');
        if (redoBtn) {
            redoBtn.addEventListener('click', () => this.redo());
        }

        // IK toggle for LC (if exists)
        const ikToggle = document.getElementById('lcIkPositioningToggle');
        if (ikToggle) {
            ikToggle.addEventListener('change', (e) => {
                const container = document.getElementById('lcIkParamsContainer');
                if (container) {
                    container.style.display = e.target.checked ? 'flex' : 'none';
                }
                if (e.target.checked) {
                    const lc = parseFloat(document.getElementById('lcIkLcEstimate')?.value) || 0;
                    const lb = parseFloat(document.getElementById('lcIkLbEstimate')?.value) || 47;
                    this.enableIkPositioning(lc, lb);
                } else {
                    this.useIkPositioning = false;
                }
            });
        }

        // Z safety offset input
        const zSafetyInput = document.getElementById('lcZSafetyOffset');
        if (zSafetyInput) {
            zSafetyInput.addEventListener('change', (e) => {
                this.zSafetyOffset = parseFloat(e.target.value) || 0;
            });
        }
    }

    /**
     * Enable IK-assisted positioning
     * @param {number} lc - Estimated LC value
     * @param {number} lb - Estimated LB value
     */
    enableIkPositioning(lc = 0, lb = 54.67) {
        this.useIkPositioning = true;
        this.estimatedLc = lc;
        this.estimatedLb = lb;
    }

    /**
     * Query LC and LB values from printer firmware via M665
     * @returns {Promise<{lc: number, lb: number}>}
     */
    async queryIkParamsFromPrinter() {
        if (!this.app.printer || !this.app.printer.isConnected()) {
            console.warn('[LC Cal] Printer not connected, using defaults');
            return { lc: 0, lb: 54.67 };
        }

        try {
            const params = await this.app.printer.queryM665();
            console.log(`[LC Cal] Read from printer: LC=${params.lc}, LB=${params.lb}`);
            return { lc: params.lc, lb: params.lb };
        } catch (e) {
            console.warn('[LC Cal] Failed to query M665:', e);
            return { lc: 0, lb: 54.67 };
        }
    }

    /**
     * Set up listeners for LC/LB parameter inputs to send changes to printer
     */
    setupIkParamListeners() {
        const lcInput = document.getElementById('lcIkLcEstimate');
        const lbInput = document.getElementById('lcIkLbEstimate');

        // Remove any existing listeners by cloning and replacing
        if (lcInput) {
            const newLcInput = lcInput.cloneNode(true);
            lcInput.parentNode.replaceChild(newLcInput, lcInput);

            newLcInput.addEventListener('change', async (e) => {
                const lc = parseFloat(e.target.value) || 0;
                this.estimatedLc = lc;

                // Send to printer
                if (this.app.printer && this.app.printer.isConnected()) {
                    try {
                        await this.app.printer.sendCommandAndWait(`M665 J${lc.toFixed(2)}`, 3000);
                        console.log(`[LC Cal] Sent LC=${lc} to printer`);
                    } catch (err) {
                        console.warn('[LC Cal] Failed to send LC to printer:', err);
                    }
                }
            });
        }

        if (lbInput) {
            const newLbInput = lbInput.cloneNode(true);
            lbInput.parentNode.replaceChild(newLbInput, lbInput);

            newLbInput.addEventListener('change', async (e) => {
                const lb = parseFloat(e.target.value) || 47;
                this.estimatedLb = lb;

                // Send to printer
                if (this.app.printer && this.app.printer.isConnected()) {
                    try {
                        await this.app.printer.sendCommandAndWait(`M665 K${lb.toFixed(2)}`, 3000);
                        console.log(`[LC Cal] Sent LB=${lb} to printer`);
                    } catch (err) {
                        console.warn('[LC Cal] Failed to send LB to printer:', err);
                    }
                }
            });
        }
    }

    /**
     * Calculate IK position for a given C angle (B stays at 0)
     * @param {number} cAngle - Target C angle
     * @returns {object} Machine position { x, y, z }
     */
    calculateIkPosition(cAngle) {
        if (!this.referencePosition) return null;

        console.log(`[LC Cal] calculateIkPosition: C=${cAngle}, ref=(${this.referencePosition.x.toFixed(2)}, ${this.referencePosition.y.toFixed(2)}), LC=${this.estimatedLc}, LB=${this.estimatedLb}`);

        // Use MeasurementEngine's IK function
        const result = MeasurementEngine.applyInverseKinematics(
            this.referencePosition.x,
            this.referencePosition.y,
            this.referencePosition.z,
            cAngle,
            0,  // B stays at 0 during LC measurement
            this.estimatedLc,
            this.estimatedLb
        );

        console.log(`[LC Cal] calculateIkPosition: target=(${result.x.toFixed(2)}, ${result.y.toFixed(2)}), delta=(${(result.x - this.referencePosition.x).toFixed(3)}, ${(result.y - this.referencePosition.y).toFixed(3)})`);

        return result;
    }

    /**
     * Move to IK-calculated position for given C angle
     * @param {number} cAngle - Target C angle
     */
    async moveToIkPosition(cAngle) {
        const targetPos = this.calculateIkPosition(cAngle);
        if (!targetPos) {
            console.warn('[LC Cal] No reference position set, falling back to simple rotation');
            await this.app.printer.moveTo({ c: cAngle }, 1800);
            return;
        }

        // If Z safety offset is set, do full safety sequence
        if (this.zSafetyOffset > 0) {
            const safeZ = this.referencePosition.z + this.zSafetyOffset;
            await this.app.printer.moveTo({ z: safeZ }, 3000);
        }

        // Rotate C
        await this.app.printer.moveTo({ c: cAngle }, 1800);

        // Move XY to target (only if there's a meaningful delta)
        const deltaX = Math.abs(targetPos.x - this.referencePosition.x);
        const deltaY = Math.abs(targetPos.y - this.referencePosition.y);
        if (deltaX > 0.01 || deltaY > 0.01) {
            await this.app.printer.moveTo({ x: targetPos.x, y: targetPos.y }, 3000);
        }

        // Lower Z if we raised it, or for cone method stay higher
        if (this.zSafetyOffset > 0 || this.app.selectedMethod === 'cone') {
            if (this.app.selectedMethod === 'cone') {
                const lowerZ = this.referencePosition.z + this.coneSafetyMargin;
                await this.app.printer.moveTo({ z: lowerZ }, 3000);
            } else {
                await this.app.printer.moveTo({ z: targetPos.z }, 3000);
            }
        }

    }

    /**
     * Called when entering this step
     */
    async enter() {
        // Show correct panel for method
        const cameraPanel = document.getElementById('lcCameraPanel');
        const conePanel = document.getElementById('lcConePanel');

        if (cameraPanel) cameraPanel.style.display = this.app.selectedMethod === 'camera' ? 'block' : 'none';
        if (conePanel) conePanel.style.display = this.app.selectedMethod === 'cone' ? 'block' : 'none';

        // Attach camera if needed
        if (this.app.selectedMethod === 'camera' && this.app.camera.isActive()) {
            this.app.camera.attachToElement('lcCamera', 'lcCrosshair');
        }

        // Reset calibration state
        this.currentStep = 0;
        this.app.calibration.reset();

        // Use reference position from prepare step if available
        if (this.app.referencePosition) {
            this.referencePosition = { ...this.app.referencePosition };
        }

        // Move to C0 B0 at the start of LC measurement
        await this.app.printer.moveTo({ c: 0, b: 0 }, 1800);

        // Query LC/LB from printer firmware via M665
        const { lc, lb } = await this.queryIkParamsFromPrinter();

        // Update input fields with printer values
        const lcInput = document.getElementById('lcIkLcEstimate');
        const lbInput = document.getElementById('lcIkLbEstimate');
        if (lcInput) lcInput.value = lc;
        if (lbInput) lbInput.value = lb;

        // Update estimated values
        this.estimatedLc = lc;
        this.estimatedLb = lb;

        // Add change listeners to send values to printer when changed
        this.setupIkParamListeners();

        // Enable IK positioning by default (checkbox is checked by default in HTML)
        const ikToggle = document.getElementById('lcIkPositioningToggle');
        if (ikToggle) {
            // Enable IK if toggle is checked (default: checked)
            if (ikToggle.checked) {
                this.enableIkPositioning(this.estimatedLc, this.estimatedLb);
            }
            const container = document.getElementById('lcIkParamsContainer');
            if (container) container.style.display = ikToggle.checked ? 'flex' : 'none';
        }

        // Update Z safety offset from input (use ?? to allow 0)
        const zSafetyInput = document.getElementById('lcZSafetyOffset');
        this.zSafetyOffset = parseFloat(zSafetyInput?.value) ?? 0;

        this.updateUI();

        // Hide result preview initially
        document.getElementById('lcResultPreview').style.display = 'none';

        // Disable next until LC is complete
        document.getElementById('nextBtn').disabled = true;
    }

    /**
     * Update UI for current measurement
     */
    updateUI() {
        if (this.currentStep >= this.angles.length) return;

        const currentAngle = this.angles[this.currentStep];

        // Update current angle display
        document.getElementById('lcCurrentAngle').textContent = `C = ${currentAngle}°`;

        // Update instructions
        const instructionText = this.app.selectedMethod === 'camera'
            ? `Align the nozzle tip with the camera crosshair at C = ${currentAngle}°`
            : `Touch the nozzle tip to the cone tip at C = ${currentAngle}°`;
        document.getElementById('lcInstructions').textContent = instructionText;

        // Update measurement item styling
        document.querySelectorAll('#lcMeasurements .measurement-item').forEach(item => {
            const angle = parseInt(item.dataset.angle);
            item.classList.remove('current');
            if (angle === currentAngle && !item.classList.contains('completed')) {
                item.classList.add('current');
            }
        });
    }

    /**
     * Confirm current position measurement
     */
    async confirmPosition() {
        const currentAngle = this.angles[this.currentStep];

        // Request fresh position from printer via M114 before recording
        // This ensures we get the actual position, not a cached/estimated one
        const position = await this.app.printer.requestPosition();

        // If this is C=0 and IK positioning is enabled, use this as the reference position
        // This ensures IK calculations for subsequent angles use the correct reference
        if (currentAngle === 0 && this.useIkPositioning) {
            this.referencePosition = { x: position.x, y: position.y, z: position.z };
        }

        // Record the measurement
        this.app.calibration.recordLcPosition(currentAngle, position);

        // Update UI
        const posDisplay = document.getElementById(`lc-pos-${currentAngle}`);
        if (posDisplay) {
            posDisplay.textContent = `X: ${position.x.toFixed(2)}, Y: ${position.y.toFixed(2)}`;
        }

        // Mark as completed
        const measurementItem = document.querySelector(`#lcMeasurements [data-angle="${currentAngle}"]`);
        if (measurementItem) {
            measurementItem.classList.remove('current');
            measurementItem.classList.add('completed');
        }

        // Move to next step
        this.currentStep++;

        if (this.currentStep >= this.angles.length) {
            // All measurements complete
            this.complete();
        } else {
            const nextAngle = this.angles[this.currentStep];

            if (this.useIkPositioning && this.referencePosition) {
                // Use IK-assisted positioning
                await this.moveToIkPosition(nextAngle);
            } else {
                // Manual positioning: lift Z, rotate C, then lower Z
                const zOffset = this.zSafetyOffset;

                // Lift Z
                await this.app.printer.moveRelative({ z: zOffset }, 3000);

                // Rotate C
                await this.app.printer.moveTo({ c: nextAngle }, 1800);

                // For cone method, lower Z less than we raised to avoid hitting the cone
                // For camera method, lower Z back to the same height
                if (this.app.selectedMethod === 'cone') {
                    const lowerAmount = zOffset - this.coneSafetyMargin;
                    if (lowerAmount > 0) {
                        await this.app.printer.moveRelative({ z: -lowerAmount }, 3000);
                    }
                } else {
                    await this.app.printer.moveRelative({ z: -zOffset }, 3000);
                }
            }

            this.updateUI();
        }
    }

    /**
     * Complete LC calibration
     */
    complete() {
        const result = this.app.calibration.calculateLc();

        if (result) {
            // Show result preview
            const preview = document.getElementById('lcResultPreview');
            preview.style.display = 'block';

            document.getElementById('lcResultValue').textContent =
                MeasurementEngine.formatValue(result.value);

            document.getElementById('lcConsistency').innerHTML =
                `Uncertainty: &plusmn;${MeasurementEngine.formatValue(result.uncertainty, 3)}mm`;

            // Disable confirm button since we're done
            document.getElementById('lcConfirmBtn').disabled = true;

            // Show redo button
            const redoBtn = document.getElementById('lcRedoBtn');
            if (redoBtn) redoBtn.style.display = 'inline-block';

            // Change Next button to "Save & Next" and set up save behavior
            const nextBtn = document.getElementById('nextBtn');
            nextBtn.disabled = false;
            nextBtn.textContent = 'Save & Next →';
            nextBtn.dataset.saveAndNext = 'lc';
        }
    }

    /**
     * Save LC value to printer firmware and update footer
     */
    async saveToStorage() {
        const results = this.app.calibration.getResults();
        if (results.lc !== null) {
            // Send LC to printer firmware and save to EEPROM
            if (this.app.printer && this.app.printer.isConnected()) {
                try {
                    await this.app.printer.sendCommandAndWait(`M665 J${results.lc.toFixed(2)}`, 3000);
                    await this.app.printer.sendCommandAndWait('M500', 5000);  // Save to EEPROM
                    console.log(`[LC Cal] Saved LC=${results.lc.toFixed(2)} to printer and EEPROM`);
                } catch (err) {
                    console.warn('[LC Cal] Failed to save LC to printer:', err);
                }
            }

            // Also save to local storage for backup
            const savedResults = StorageManager.loadCalibrationResults() || {};
            const currentLb = savedResults.lb ?? 47;
            StorageManager.saveCalibrationResults(results.lc, currentLb, {
                method: this.app.selectedMethod,
                testMode: this.app.testMode
            });

            // Update footer display
            const footerLcInput = document.getElementById('savedLcValue');
            if (footerLcInput) footerLcInput.value = results.lc.toFixed(2);

        }
    }

    /**
     * Redo LC measurement using the just-measured value for IK positioning
     */
    async redo() {
        // Get the just-calculated LC value
        const results = this.app.calibration.getResults();
        if (results.lc !== null) {
            this.estimatedLc = results.lc;
            // Update the input field
            const lcInput = document.getElementById('lcIkLcEstimate');
            if (lcInput) lcInput.value = results.lc.toFixed(2);

            // Send LC to printer firmware for next iteration
            if (this.app.printer && this.app.printer.isConnected()) {
                try {
                    await this.app.printer.sendCommandAndWait(`M665 J${results.lc.toFixed(2)}`, 3000);
                    console.log(`[LC Cal] Sent LC=${results.lc.toFixed(2)} to printer for redo`);
                } catch (err) {
                    console.warn('[LC Cal] Failed to send LC to printer:', err);
                }
            }

            // Also save to local storage for backup
            const savedResults = StorageManager.loadCalibrationResults() || {};
            const currentLb = savedResults.lb ?? 47;
            StorageManager.saveCalibrationResults(results.lc, currentLb, {
                method: this.app.selectedMethod,
                testMode: this.app.testMode
            });

            // Update footer display
            const footerLcInput = document.getElementById('savedLcValue');
            if (footerLcInput) footerLcInput.value = results.lc.toFixed(2);
        }

        // Reset state
        this.currentStep = 0;
        this.app.calibration.resetLc();

        // Hide result preview
        document.getElementById('lcResultPreview').style.display = 'none';

        // Hide redo button
        const redoBtn = document.getElementById('lcRedoBtn');
        if (redoBtn) redoBtn.style.display = 'none';

        // Re-enable confirm button
        document.getElementById('lcConfirmBtn').disabled = false;

        // Disable next button
        document.getElementById('nextBtn').disabled = true;

        // Reset measurement items UI
        document.querySelectorAll('#lcMeasurements .measurement-item').forEach(item => {
            item.classList.remove('completed', 'current');
        });

        // Reset position display texts
        document.getElementById('lc-pos-0').textContent = 'Waiting...';
        document.getElementById('lc-pos-90').textContent = 'Waiting...';
        document.getElementById('lc-pos-180').textContent = 'Waiting...';
        document.getElementById('lc-pos-270').textContent = 'Waiting...';

        // Return to reference position (C=0, XY at reference)
        await this.returnToReferencePosition();

        this.updateUI();
    }

    /**
     * Return to reference position for starting a new measurement
     */
    async returnToReferencePosition() {
        if (!this.referencePosition) {
            console.warn('[LC Cal] No reference position, just rotating to C=0');
            await this.app.printer.moveTo({ c: 0 }, 1800);
            return;
        }


        // If Z safety offset is set, raise Z first
        if (this.zSafetyOffset > 0) {
            const safeZ = this.referencePosition.z + this.zSafetyOffset;
            await this.app.printer.moveTo({ z: safeZ }, 3000);
        }

        // Rotate C back to 0
        await this.app.printer.moveTo({ c: 0 }, 1800);

        // Move XY back to reference position
        await this.app.printer.moveTo({
            x: this.referencePosition.x,
            y: this.referencePosition.y
        }, 3000);

        // Lower Z back to reference if we raised it
        if (this.zSafetyOffset > 0) {
            await this.app.printer.moveTo({ z: this.referencePosition.z }, 3000);
        }

    }
}
