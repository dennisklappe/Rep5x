/**
 * Step 3: LA Measurement
 * Measure A-axis offset by recording positions at 0°, 90°, 180°, 270°
 * Uses inverse kinematics to pre-position the nozzle when LA/LB estimates are provided.
 */

class StepLaMeasure {
    constructor(app) {
        this.app = app;
        this.currentStep = 0;
        this.angles = [0, 90, 180, 270];

        // IK-assisted positioning parameters
        this.useIkPositioning = false;
        this.estimatedLa = 0;
        this.estimatedLb = 47;
        this.referencePosition = null;  // Tip position at A=0 (camera focus point)
        this.zSafetyOffset = 0;  // No Z lift needed for LA measurement (rotating around vertical axis)
        this.coneSafetyMargin = 10; // Extra mm to stay above cone when using cone method
    }

    /**
     * Set up event listeners for this step
     */
    setup() {
        document.getElementById('laConfirmBtn').addEventListener('click', () => this.confirmPosition());

        // Redo button
        const redoBtn = document.getElementById('laRedoBtn');
        if (redoBtn) {
            redoBtn.addEventListener('click', () => this.redo());
        }

        // IK toggle for LA (if exists)
        const ikToggle = document.getElementById('laIkPositioningToggle');
        if (ikToggle) {
            ikToggle.addEventListener('change', (e) => {
                const container = document.getElementById('laIkParamsContainer');
                if (container) {
                    container.style.display = e.target.checked ? 'flex' : 'none';
                }
                if (e.target.checked) {
                    const la = parseFloat(document.getElementById('laIkLaEstimate')?.value) || 0;
                    const lb = parseFloat(document.getElementById('laIkLbEstimate')?.value) || 47;
                    this.enableIkPositioning(la, lb);
                } else {
                    this.useIkPositioning = false;
                }
            });
        }

        // Z safety offset input
        const zSafetyInput = document.getElementById('laZSafetyOffset');
        if (zSafetyInput) {
            zSafetyInput.addEventListener('change', (e) => {
                this.zSafetyOffset = parseFloat(e.target.value) || 0;
            });
        }
    }

    /**
     * Enable IK-assisted positioning
     * @param {number} la - Estimated LA value
     * @param {number} lb - Estimated LB value
     */
    enableIkPositioning(la = 0, lb = 47) {
        this.useIkPositioning = true;
        this.estimatedLa = la;
        this.estimatedLb = lb;
    }

    /**
     * Calculate IK position for a given A angle (B stays at 0)
     * @param {number} aAngle - Target A angle
     * @returns {object} Machine position { x, y, z }
     */
    calculateIkPosition(aAngle) {
        if (!this.referencePosition) return null;

        // Use MeasurementEngine's IK function
        return MeasurementEngine.applyInverseKinematics(
            this.referencePosition.x,
            this.referencePosition.y,
            this.referencePosition.z,
            aAngle,
            0,  // B stays at 0 during LA measurement
            this.estimatedLa,
            this.estimatedLb
        );
    }

    /**
     * Move to IK-calculated position for given A angle
     * @param {number} aAngle - Target A angle
     */
    async moveToIkPosition(aAngle) {
        const targetPos = this.calculateIkPosition(aAngle);
        if (!targetPos) {
            console.warn('[LA Cal] No reference position set, falling back to simple rotation');
            await this.app.printer.moveTo({ a: aAngle }, 1800);
            return;
        }


        // If Z safety offset is set, do full safety sequence
        if (this.zSafetyOffset > 0) {
            const safeZ = this.referencePosition.z + this.zSafetyOffset;
            await this.app.printer.moveTo({ z: safeZ }, 3000);
        }

        // Rotate A
        await this.app.printer.moveTo({ a: aAngle }, 1800);

        // Move XY to target
        await this.app.printer.moveTo({ x: targetPos.x, y: targetPos.y }, 3000);

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
        const cameraPanel = document.getElementById('laCameraPanel');
        const conePanel = document.getElementById('laConePanel');

        if (cameraPanel) cameraPanel.style.display = this.app.selectedMethod === 'camera' ? 'block' : 'none';
        if (conePanel) conePanel.style.display = this.app.selectedMethod === 'cone' ? 'block' : 'none';

        // Attach camera if needed
        if (this.app.selectedMethod === 'camera' && this.app.camera.isActive()) {
            this.app.camera.attachToElement('laCamera', 'laCrosshair');
        }

        // Reset calibration state
        this.currentStep = 0;
        this.app.calibration.reset();

        // Use reference position from prepare step if available
        if (this.app.referencePosition) {
            this.referencePosition = { ...this.app.referencePosition };
        }

        // Move to A0 B0 at the start of LA measurement
        await this.app.printer.moveTo({ a: 0, b: 0 }, 1800);

        // Load saved LA/LB values from storage, or use defaults
        const savedResults = StorageManager.loadCalibrationResults();
        const savedLa = savedResults?.la ?? 0;
        const savedLb = savedResults?.lb ?? 47;

        // Update input fields with saved values if they exist
        const laInput = document.getElementById('laIkLaEstimate');
        const lbInput = document.getElementById('laIkLbEstimate');
        if (laInput) laInput.value = savedLa;
        if (lbInput) lbInput.value = savedLb;

        // Update estimated values
        this.estimatedLa = savedLa;
        this.estimatedLb = savedLb;

        // Enable IK positioning by default (checkbox is checked by default in HTML)
        const ikToggle = document.getElementById('laIkPositioningToggle');
        if (ikToggle) {
            // Enable IK if toggle is checked (default: checked)
            if (ikToggle.checked) {
                this.enableIkPositioning(this.estimatedLa, this.estimatedLb);
            }
            const container = document.getElementById('laIkParamsContainer');
            if (container) container.style.display = ikToggle.checked ? 'flex' : 'none';
        }

        // Update Z safety offset from input (use ?? to allow 0)
        const zSafetyInput = document.getElementById('laZSafetyOffset');
        this.zSafetyOffset = parseFloat(zSafetyInput?.value) ?? 0;

        this.updateUI();

        // Hide result preview initially
        document.getElementById('laResultPreview').style.display = 'none';

        // Disable next until LA is complete
        document.getElementById('nextBtn').disabled = true;
    }

    /**
     * Update UI for current measurement
     */
    updateUI() {
        if (this.currentStep >= this.angles.length) return;

        const currentAngle = this.angles[this.currentStep];

        // Update current angle display
        document.getElementById('laCurrentAngle').textContent = `A = ${currentAngle}°`;

        // Update instructions
        const instructionText = this.app.selectedMethod === 'camera'
            ? `Align the nozzle tip with the camera crosshair at A = ${currentAngle}°`
            : `Touch the nozzle tip to the cone tip at A = ${currentAngle}°`;
        document.getElementById('laInstructions').textContent = instructionText;

        // Update measurement item styling
        document.querySelectorAll('#laMeasurements .measurement-item').forEach(item => {
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


        // If this is A=0 and IK positioning is enabled, use this as the reference position
        // This ensures IK calculations for subsequent angles use the correct reference
        if (currentAngle === 0 && this.useIkPositioning) {
            this.referencePosition = { x: position.x, y: position.y, z: position.z };
        }

        // Record the measurement
        this.app.calibration.recordLaPosition(currentAngle, position);

        // Update UI
        const posDisplay = document.getElementById(`la-pos-${currentAngle}`);
        if (posDisplay) {
            posDisplay.textContent = `X: ${position.x.toFixed(2)}, Y: ${position.y.toFixed(2)}`;
        }

        // Mark as completed
        const measurementItem = document.querySelector(`#laMeasurements [data-angle="${currentAngle}"]`);
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
                // Manual positioning: lift Z, rotate A, then lower Z
                const zOffset = this.zSafetyOffset;

                // Lift Z
                await this.app.printer.moveRelative({ z: zOffset }, 3000);

                // Rotate A
                await this.app.printer.moveTo({ a: nextAngle }, 1800);

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
     * Complete LA calibration
     */
    complete() {
        const result = this.app.calibration.calculateLa();

        if (result) {
            // Show result preview
            const preview = document.getElementById('laResultPreview');
            preview.style.display = 'block';

            document.getElementById('laResultValue').textContent =
                MeasurementEngine.formatValue(result.value);

            document.getElementById('laConsistency').innerHTML =
                `Asymmetry: &plusmn;${MeasurementEngine.formatValue(result.consistency, 3)}mm`;

            // Disable confirm button since we're done
            document.getElementById('laConfirmBtn').disabled = true;

            // Show redo button
            const redoBtn = document.getElementById('laRedoBtn');
            if (redoBtn) redoBtn.style.display = 'inline-block';

            // Change Next button to "Save & Next" and set up save behavior
            const nextBtn = document.getElementById('nextBtn');
            nextBtn.disabled = false;
            nextBtn.textContent = 'Save & Next →';
            nextBtn.dataset.saveAndNext = 'la';
        }
    }

    /**
     * Save LA value to storage and update footer
     */
    saveToStorage() {
        const results = this.app.calibration.getResults();
        if (results.la !== null) {
            const savedResults = StorageManager.loadCalibrationResults() || {};
            const currentLb = savedResults.lb ?? 47;
            StorageManager.saveCalibrationResults(results.la, currentLb, {
                method: this.app.selectedMethod,
                testMode: this.app.testMode
            });

            // Update footer display
            const footerLaInput = document.getElementById('savedLaValue');
            if (footerLaInput) footerLaInput.value = results.la.toFixed(2);

        }
    }

    /**
     * Redo LA measurement using the just-measured value for IK positioning
     */
    async redo() {
        // Get the just-calculated LA value
        const results = this.app.calibration.getResults();
        if (results.la !== null) {
            this.estimatedLa = results.la;
            // Update the input field
            const laInput = document.getElementById('laIkLaEstimate');
            if (laInput) laInput.value = results.la.toFixed(2);

            // Save to storage and update footer
            const savedResults = StorageManager.loadCalibrationResults() || {};
            const currentLb = savedResults.lb ?? 47;
            StorageManager.saveCalibrationResults(results.la, currentLb, {
                method: this.app.selectedMethod,
                testMode: this.app.testMode
            });

            // Update footer display
            const footerLaInput = document.getElementById('savedLaValue');
            if (footerLaInput) footerLaInput.value = results.la.toFixed(2);
        }

        // Reset state
        this.currentStep = 0;
        this.app.calibration.resetLa();

        // Hide result preview
        document.getElementById('laResultPreview').style.display = 'none';

        // Hide redo button
        const redoBtn = document.getElementById('laRedoBtn');
        if (redoBtn) redoBtn.style.display = 'none';

        // Re-enable confirm button
        document.getElementById('laConfirmBtn').disabled = false;

        // Disable next button
        document.getElementById('nextBtn').disabled = true;

        // Reset measurement items UI
        document.querySelectorAll('#laMeasurements .measurement-item').forEach(item => {
            item.classList.remove('completed', 'current');
        });

        // Reset position display texts
        document.getElementById('la-pos-0').textContent = 'Waiting...';
        document.getElementById('la-pos-90').textContent = 'Waiting...';
        document.getElementById('la-pos-180').textContent = 'Waiting...';
        document.getElementById('la-pos-270').textContent = 'Waiting...';

        // Return to reference position (A=0, XY at reference)
        await this.returnToReferencePosition();

        this.updateUI();
    }

    /**
     * Return to reference position for starting a new measurement
     */
    async returnToReferencePosition() {
        if (!this.referencePosition) {
            console.warn('[LA Cal] No reference position, just rotating to A=0');
            await this.app.printer.moveTo({ a: 0 }, 1800);
            return;
        }


        // If Z safety offset is set, raise Z first
        if (this.zSafetyOffset > 0) {
            const safeZ = this.referencePosition.z + this.zSafetyOffset;
            await this.app.printer.moveTo({ z: safeZ }, 3000);
        }

        // Rotate A back to 0
        await this.app.printer.moveTo({ a: 0 }, 1800);

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
