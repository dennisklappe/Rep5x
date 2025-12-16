/**
 * Step 3: LB Measurement
 * Measure B-axis offset by recording positions at B0°, B-90°, B+90°
 *
 * Uses inverse kinematics to pre-position the nozzle when LA/LB estimates are provided.
 * This helps verify/refine the LB value.
 */

class StepLbMeasure {
    constructor(app) {
        this.app = app;
        this.currentStep = 0;
        // Measurement sequence: B0@A0, B-90@A0, B+90@A180
        // Using A=180 for B+90 helps validate LA and provides cross-check
        this.measurementSteps = [
            { a: 0, b: 0 },
            { a: 0, b: -90 },
            { a: 180, b: 90 }
        ];

        // IK-assisted positioning parameters
        this.useIkPositioning = false;
        this.estimatedLa = 0;
        this.estimatedLb = 47;
        this.referencePosition = null;  // Tip position at B=0 (camera focus point)
        this.zSafetyOffset = 20;
        this.coneSafetyMargin = 10; // Extra mm to stay above cone when using cone method
    }

    /**
     * Set up event listeners for this step
     */
    setup() {
        document.getElementById('lbConfirmBtn').addEventListener('click', () => this.confirmPosition());

        // Redo button
        const redoBtn = document.getElementById('lbRedoBtn');
        if (redoBtn) {
            redoBtn.addEventListener('click', () => this.redo());
        }

        // IK positioning toggle
        const ikToggle = document.getElementById('ikPositioningToggle');
        const ikParams = document.getElementById('ikParamsContainer');

        if (ikToggle) {
            ikToggle.addEventListener('change', (e) => {
                if (e.target.checked) {
                    const la = parseFloat(document.getElementById('ikLaEstimate').value) || 0;
                    const lb = parseFloat(document.getElementById('ikLbEstimate').value) || 47;
                    this.enableIkPositioning(la, lb);
                    ikParams.style.display = 'flex';
                } else {
                    this.useIkPositioning = false;
                    this.referencePosition = null;
                    ikParams.style.display = 'none';
                }
            });
        }

        // Update IK params when values change
        const laInput = document.getElementById('ikLaEstimate');
        const lbInput = document.getElementById('ikLbEstimate');

        if (laInput) {
            laInput.addEventListener('change', () => {
                if (this.useIkPositioning) {
                    this.estimatedLa = parseFloat(laInput.value) || 0;
                }
            });
        }

        if (lbInput) {
            lbInput.addEventListener('change', () => {
                if (this.useIkPositioning) {
                    this.estimatedLb = parseFloat(lbInput.value) || 47;
                }
            });
        }
    }

    /**
     * Enable IK-assisted positioning for LB calibration
     * When enabled, the tool will pre-calculate machine positions using IK
     * to keep the nozzle tip at the camera focus point when rotating B
     *
     * @param {number} la - Estimated LA value (default 0)
     * @param {number} lb - Estimated LB value (default 47)
     */
    enableIkPositioning(la = 0, lb = 47) {
        this.useIkPositioning = true;
        this.estimatedLa = la;
        this.estimatedLb = lb;
    }

    /**
     * Set the reference position (camera focus point at B=0)
     * This is where we want the nozzle tip to stay during all measurements
     *
     * @param {object} position - Position at B=0 { x, y, z }
     */
    setReferencePosition(position) {
        this.referencePosition = { ...position };
    }

    /**
     * Calculate and move to the IK-corrected position for given A and B angles
     * Uses Z safety offset during travel
     *
     * @param {number} aAngle - Target A-axis angle
     * @param {number} bAngle - Target B-axis angle
     */
    async moveToIkPosition(aAngle, bAngle) {
        if (!this.referencePosition) {
            console.error('[LB Cal] No reference position set');
            return;
        }


        // Calculate IK position for the target A and B angles
        const targetMachine = MeasurementEngine.applyInverseKinematics(
            this.referencePosition.x,
            this.referencePosition.y,
            this.referencePosition.z,
            aAngle,
            bAngle,
            this.estimatedLa,
            this.estimatedLb
        );

        const safeZ = this.referencePosition.z + this.zSafetyOffset;

        // Ensure target Z is not below 0 (would be invalid)
        const targetZ = Math.max(0, targetMachine.z);
        if (targetMachine.z < 0) {
            console.warn(`[LB Cal] Target Z (${targetMachine.z.toFixed(2)}) is below bed! Clamping to 0. Reference Z may be too low.`);
        }


        // Safety move sequence:
        // 1. Raise Z to safe height
        // 2. Rotate A and B
        // 3. Move XY to target
        // 4. Lower Z to target

        // Step 1: Raise Z for safety
        await this.app.printer.moveTo({ z: safeZ }, 3000);

        // Step 2: Rotate A and B
        await this.app.printer.moveTo({ a: aAngle, b: bAngle }, 1800);

        // Step 3: Move XY
        await this.app.printer.moveTo({
            x: targetMachine.x,
            y: targetMachine.y
        }, 3000);

        // Step 4: Lower Z to IK position (user will fine-tune)
        await this.app.printer.moveTo({ z: targetZ }, 1500);

    }

    /**
     * Called when entering this step
     */
    async enter() {
        // Show correct panel for method
        const cameraPanel = document.getElementById('lbCameraPanel');
        const conePanel = document.getElementById('lbConePanel');

        if (cameraPanel) cameraPanel.style.display = this.app.selectedMethod === 'camera' ? 'block' : 'none';
        if (conePanel) conePanel.style.display = this.app.selectedMethod === 'cone' ? 'block' : 'none';

        // Attach camera if needed
        if (this.app.selectedMethod === 'camera' && this.app.camera.isActive()) {
            this.app.camera.attachToElement('lbCamera', 'lbCrosshair');
        }

        // Reset LB calibration state
        this.currentStep = 0;

        // Use reference position from prepare step
        if (this.app.referencePosition) {
            this.referencePosition = { ...this.app.referencePosition };
        }

        // Load saved LA/LB values from storage, or use defaults
        const savedResults = StorageManager.loadCalibrationResults();
        const savedLa = savedResults?.la ?? 0;
        const savedLb = savedResults?.lb ?? 47;

        // If we just completed LA measurement, use that value instead of saved
        if (this.app.calibration.laResult) {
            this.estimatedLa = this.app.calibration.laResult.value;
        } else {
            this.estimatedLa = savedLa;
        }
        this.estimatedLb = savedLb;

        // Update input fields with values
        const laInput = document.getElementById('ikLaEstimate');
        const lbInput = document.getElementById('ikLbEstimate');
        if (laInput) laInput.value = this.estimatedLa.toFixed(2);
        if (lbInput) lbInput.value = this.estimatedLb.toFixed(2);

        // Enable IK positioning by default (checkbox is checked by default in HTML)
        const ikToggle = document.getElementById('ikPositioningToggle');
        if (ikToggle) {
            // Enable IK if toggle is checked (default: checked)
            if (ikToggle.checked) {
                this.enableIkPositioning(this.estimatedLa, this.estimatedLb);
            }
            const container = document.getElementById('ikParamsContainer');
            if (container) container.style.display = ikToggle.checked ? 'flex' : 'none';
        }

        // Update Z safety offset from input
        this.zSafetyOffset = parseFloat(document.getElementById('zSafetyOffset').value) || 20;

        // Move back to reference position (A=0, B=0) before starting LB measurement
        // This is necessary because LA measurement ends at A=270°
        await this.returnToReference();

        this.updateUI();

        // Hide result preview initially
        document.getElementById('lbResultPreview').style.display = 'none';

        // Disable next until LB is complete
        document.getElementById('nextBtn').disabled = true;
    }

    /**
     * Return to reference position (A=0, B=0) before starting LB measurement
     */
    async returnToReference() {

        try {
            if (this.referencePosition) {
                // Full return sequence with reference position
                // Raise Z for safety
                const safeZ = this.referencePosition.z + this.zSafetyOffset;
                await this.app.printer.moveTo({ z: safeZ }, 3000);

                // Return to A=0, B=0
                await this.app.printer.moveTo({ a: 0, b: 0 }, 1800);

                // Move to reference XY position
                await this.app.printer.moveTo({
                    x: this.referencePosition.x,
                    y: this.referencePosition.y
                }, 3000);

                // Lower Z back to reference height (or with safety margin for cone)
                if (this.app.selectedMethod === 'cone') {
                    await this.app.printer.moveTo({ z: this.referencePosition.z + this.coneSafetyMargin }, 3000);
                } else {
                    await this.app.printer.moveTo({ z: this.referencePosition.z }, 3000);
                }
            } else {
                // No reference position (e.g. skipped Prepare), just rotate to A0 B0
                console.warn('[LB Cal] No reference position, just rotating to A=0, B=0');
                await this.app.printer.moveTo({ a: 0, b: 0 }, 1800);
            }

        } catch (error) {
            console.error('[LB Cal] Error returning to reference:', error);
        }
    }

    /**
     * Update UI for current measurement
     */
    updateUI() {
        if (this.currentStep >= this.measurementSteps.length) return;

        const currentStep = this.measurementSteps[this.currentStep];
        const { a: aAngle, b: bAngle } = currentStep;

        // Update current angle display - show both A and B for B+90@A180
        if (aAngle === 0) {
            document.getElementById('lbCurrentAngle').textContent = `B = ${bAngle}°`;
        } else {
            document.getElementById('lbCurrentAngle').textContent = `A = ${aAngle}°, B = ${bAngle}°`;
        }

        // Update instructions
        let instructionText;
        if (this.currentStep === 0) {
            instructionText = this.app.selectedMethod === 'camera'
                ? `Align the nozzle tip with the camera crosshair at B = ${bAngle}°`
                : `Touch the nozzle tip to the cone tip at B = ${bAngle}°`;

            if (this.useIkPositioning) {
                instructionText += ` (this will be the IK reference point)`;
            }
        } else {
            if (this.useIkPositioning && this.referencePosition) {
                // Show IK-calculated target position
                const targetMachine = MeasurementEngine.applyInverseKinematics(
                    this.referencePosition.x,
                    this.referencePosition.y,
                    this.referencePosition.z,
                    aAngle,
                    bAngle,
                    this.estimatedLa,
                    this.estimatedLb
                );
                instructionText = `IK moved to X=${targetMachine.x.toFixed(1)}, Z=${targetMachine.z.toFixed(1)}. Fine-tune alignment.`;
            } else {
                const angleStr = aAngle === 0 ? `B = ${bAngle}°` : `A = ${aAngle}°, B = ${bAngle}°`;
                instructionText = this.app.selectedMethod === 'camera'
                    ? `Lower Z and align with crosshair at ${angleStr}`
                    : `Lower Z and touch the cone tip at ${angleStr}`;
            }
        }
        document.getElementById('lbInstructions').textContent = instructionText;

        // Update measurement item styling
        document.querySelectorAll('#lbMeasurements .measurement-item').forEach(item => {
            const itemStep = parseInt(item.dataset.step);
            item.classList.remove('current');
            if (itemStep === this.currentStep && !item.classList.contains('completed')) {
                item.classList.add('current');
            }
        });
    }

    /**
     * Confirm current position measurement
     */
    async confirmPosition() {
        const currentMeasurement = this.measurementSteps[this.currentStep];
        const { a: aAngle, b: bAngle } = currentMeasurement;

        // Request fresh position from printer via M114 before recording
        // This ensures we get the actual position, not a cached/estimated one
        const position = await this.app.printer.requestPosition();


        // If this is B=0 and IK positioning is enabled, use this as the reference position
        // This ensures IK calculations for subsequent angles use the correct reference
        if (bAngle === 0 && this.useIkPositioning) {
            this.setReferencePosition(position);
        }

        // Record the measurement (pass A angle for B+90@A180 calculation)
        this.app.calibration.recordLbPosition(bAngle, position, aAngle);

        // Update UI - use step index for element lookup
        const posDisplay = document.getElementById(`lb-pos-step-${this.currentStep}`);
        if (posDisplay) {
            posDisplay.textContent = `X: ${position.x.toFixed(2)}, Z: ${position.z.toFixed(2)}`;
        }

        // Mark as completed
        const measurementItem = document.querySelector(`#lbMeasurements [data-step="${this.currentStep}"]`);
        if (measurementItem) {
            measurementItem.classList.remove('current');
            measurementItem.classList.add('completed');
        }

        // Move to next step
        this.currentStep++;

        if (this.currentStep >= this.measurementSteps.length) {
            // All measurements complete
            this.complete();
        } else {
            const nextMeasurement = this.measurementSteps[this.currentStep];
            const { a: nextA, b: nextB } = nextMeasurement;


            if (this.useIkPositioning && this.referencePosition) {
                // Use IK-assisted positioning
                await this.moveToIkPosition(nextA, nextB);
            } else {
                // Manual positioning: lift Z, rotate A and B, then lower Z
                const zOffset = parseFloat(document.getElementById('zSafetyOffset').value) || 50;

                // Lift Z
                await this.app.printer.moveRelative({ z: zOffset }, 3000);

                // Rotate A and B
                await this.app.printer.moveTo({ a: nextA, b: nextB }, 1800);

                // For cone method, lower Z less than we raised to avoid hitting the cone
                // For camera method, lower Z back to the same height
                if (this.app.selectedMethod === 'cone') {
                    // Lower Z by (zOffset - coneSafetyMargin), leaving nozzle higher than before
                    const lowerAmount = zOffset - this.coneSafetyMargin;
                    if (lowerAmount > 0) {
                        await this.app.printer.moveRelative({ z: -lowerAmount }, 3000);
                    }
                } else {
                    // Camera method: lower Z back to original height
                    await this.app.printer.moveRelative({ z: -zOffset }, 3000);
                }
            }

            this.updateUI();
        }
    }

    /**
     * Complete LB calibration
     */
    async complete() {
        const result = this.app.calibration.calculateLb();

        if (result) {
            // Show result preview
            const preview = document.getElementById('lbResultPreview');
            preview.style.display = 'block';

            document.getElementById('lbResultValue').textContent =
                MeasurementEngine.formatValue(result.value);

            document.getElementById('lbConsistency').innerHTML =
                `Asymmetry: ${MeasurementEngine.formatValue(result.consistency, 3)}mm`;

            // Disable confirm button since we're done
            document.getElementById('lbConfirmBtn').disabled = true;

            // Show redo button
            const redoBtn = document.getElementById('lbRedoBtn');
            if (redoBtn) redoBtn.style.display = 'inline-block';

            // Change Next button to "Save & Next" and set up save behavior
            const nextBtn = document.getElementById('nextBtn');
            nextBtn.disabled = false;
            nextBtn.textContent = 'Save & Next →';
            nextBtn.dataset.saveAndNext = 'lb';

            // Return nozzle to starting position (reference position with B=0)
            await this.returnToStartingPosition();
        }
    }

    /**
     * Save LB value to storage and update footer
     */
    saveToStorage() {
        const results = this.app.calibration.getResults();
        if (results.lb !== null) {
            const savedResults = StorageManager.loadCalibrationResults() || {};
            const currentLa = savedResults.la ?? results.la ?? 0;
            StorageManager.saveCalibrationResults(currentLa, results.lb, {
                method: this.app.selectedMethod,
                testMode: this.app.testMode
            });

            // Update footer display
            const footerLbInput = document.getElementById('savedLbValue');
            if (footerLbInput) footerLbInput.value = results.lb.toFixed(2);

        }
    }

    /**
     * Redo LB measurement using the just-measured value for IK positioning
     */
    async redo() {
        // Get the just-calculated LB value
        const results = this.app.calibration.getResults();
        if (results.lb !== null) {
            this.estimatedLb = results.lb;
            // Update the input field
            const lbInput = document.getElementById('ikLbEstimate');
            if (lbInput) lbInput.value = results.lb.toFixed(2);

            // Save to storage and update footer
            const savedResults = StorageManager.loadCalibrationResults() || {};
            const currentLa = savedResults.la ?? 0;
            StorageManager.saveCalibrationResults(currentLa, results.lb, {
                method: this.app.selectedMethod,
                testMode: this.app.testMode
            });

            // Update footer display
            const footerLbInput = document.getElementById('savedLbValue');
            if (footerLbInput) footerLbInput.value = results.lb.toFixed(2);
        }

        // Reset state
        this.currentStep = 0;
        this.app.calibration.resetLb();

        // Hide result preview
        document.getElementById('lbResultPreview').style.display = 'none';

        // Hide redo button
        const redoBtn = document.getElementById('lbRedoBtn');
        if (redoBtn) redoBtn.style.display = 'none';

        // Re-enable confirm button
        document.getElementById('lbConfirmBtn').disabled = false;

        // Disable next button
        document.getElementById('nextBtn').disabled = true;

        // Reset measurement items UI
        document.querySelectorAll('#lbMeasurements .measurement-item').forEach(item => {
            item.classList.remove('completed', 'current');
        });

        // Reset position display texts
        document.getElementById('lb-pos-step-0').textContent = 'Waiting...';
        document.getElementById('lb-pos-step-1').textContent = 'Waiting...';
        document.getElementById('lb-pos-step-2').textContent = 'Waiting...';

        // We're already at reference position from returnToStartingPosition()
        // Just update the UI
        this.updateUI();
    }

    /**
     * Return to the starting position after completing LB measurement
     */
    async returnToStartingPosition() {
        if (!this.referencePosition) {
            console.warn('[LB Cal] No reference position available for return');
            // Still return to A0 B0 even without reference
            await this.app.printer.moveTo({ a: 0, b: 0 }, 1800);
            return;
        }

        try {
            const zSafetyOffset = parseFloat(document.getElementById('zSafetyOffset')?.value) || 50;
            const safeZ = this.referencePosition.z + zSafetyOffset;


            // Step 1: Lift Z for safety
            await this.app.printer.moveTo({ z: safeZ }, 3000);

            // Step 2: Rotate A and B back to 0 (we end at A180 B90)
            await this.app.printer.moveTo({ a: 0, b: 0 }, 1800);

            // Step 3: Move XY back to reference position
            await this.app.printer.moveTo({
                x: this.referencePosition.x,
                y: this.referencePosition.y
            }, 3000);

            // Step 4: Lower Z back to reference height
            await this.app.printer.moveTo({ z: this.referencePosition.z }, 3000);

        } catch (error) {
            console.error('[LB Cal] Error returning to starting position:', error);
        }
    }
}
