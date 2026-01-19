/**
 * Calibration Visualizer (2D Canvas)
 * Shows nozzle tip position error as axes rotate
 * Compares uncalibrated (with drift) vs calibrated (corrected)
 *
 * Used by: Calibrator
 */

class CalibrationVisualizer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        // Corrector reference
        this.corrector = null;

        // View settings
        this.scale = 15;  // pixels per mm of error (amplified for visibility)
        this.nozzleRadius = 8;
        this.trailLength = 50;

        // Animation state
        this.animating = false;
        this.animationId = null;
        this.currentA = 0;
        this.currentB = 0;
        this.sweepMode = 'a';  // 'a', 'b', or 'both'
        this.animationSpeed = 2;  // degrees per frame

        // Mode: 'uncalibrated' shows errors, 'calibrated' shows corrected
        this.mode = 'uncalibrated';

        // Trail of previous positions
        this.trail = [];

        // Colours
        this.colours = {
            background: '#1a1a2e',
            grid: 'rgba(255, 255, 255, 0.1)',
            gridMajor: 'rgba(255, 255, 255, 0.2)',
            nozzle: '#ff6b6b',
            nozzleCorrected: '#4ecdc4',
            trail: 'rgba(255, 107, 107, 0.3)',
            trailCorrected: 'rgba(78, 205, 196, 0.3)',
            crosshair: 'rgba(255, 255, 255, 0.5)',
            text: 'rgba(255, 255, 255, 0.8)',
            axisX: '#ff4444',
            axisY: '#44ff44',
            axisZ: '#4444ff'
        };

        this.setupCanvas();
    }

    setupCanvas() {
        const rect = this.canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;

        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.ctx.scale(dpr, dpr);

        this.width = rect.width;
        this.height = rect.height;
        this.centerX = this.width / 2;
        this.centerY = this.height / 2;
    }

    setCorrector(corrector) {
        this.corrector = corrector;
        this.render();
    }

    setMode(mode) {
        this.mode = mode;
        this.trail = [];
        this.render();
    }

    setSweepMode(mode) {
        this.sweepMode = mode;
        this.trail = [];
        this.currentA = 0;
        this.currentB = 0;
    }

    /**
     * Get nozzle position error at current A/B
     */
    getError(a, b) {
        if (!this.corrector || !this.corrector.loaded) {
            return { x: 0, y: 0, z: 0 };
        }

        if (this.mode === 'calibrated') {
            // In calibrated mode, the correction cancels the error
            // So the nozzle stays at center (0, 0, 0)
            return { x: 0, y: 0, z: 0 };
        } else {
            // Uncalibrated: show the actual error
            // The error is what the calibration would correct
            const correction = this.corrector.getCorrection(a, b);
            // Negate because error = -correction (correction compensates for error)
            return {
                x: -correction.x,
                y: -correction.y,
                z: -correction.z
            };
        }
    }

    /**
     * Clear and draw background
     */
    clear() {
        this.ctx.fillStyle = this.colours.background;
        this.ctx.fillRect(0, 0, this.width, this.height);
    }

    /**
     * Draw reference grid
     */
    drawGrid() {
        const gridSize = this.scale;  // 1mm grid
        const majorGridSize = this.scale * 5;  // 5mm major grid

        // Minor grid
        this.ctx.strokeStyle = this.colours.grid;
        this.ctx.lineWidth = 0.5;

        for (let x = this.centerX % gridSize; x < this.width; x += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.height);
            this.ctx.stroke();
        }

        for (let y = this.centerY % gridSize; y < this.height; y += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.width, y);
            this.ctx.stroke();
        }

        // Major grid
        this.ctx.strokeStyle = this.colours.gridMajor;
        this.ctx.lineWidth = 1;

        for (let x = this.centerX % majorGridSize; x < this.width; x += majorGridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.height);
            this.ctx.stroke();
        }

        for (let y = this.centerY % majorGridSize; y < this.height; y += majorGridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.width, y);
            this.ctx.stroke();
        }

        // Center crosshair
        this.ctx.strokeStyle = this.colours.crosshair;
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([5, 5]);

        this.ctx.beginPath();
        this.ctx.moveTo(this.centerX, 0);
        this.ctx.lineTo(this.centerX, this.height);
        this.ctx.stroke();

        this.ctx.beginPath();
        this.ctx.moveTo(0, this.centerY);
        this.ctx.lineTo(this.width, this.centerY);
        this.ctx.stroke();

        this.ctx.setLineDash([]);

        // Axis labels
        this.ctx.fillStyle = this.colours.axisX;
        this.ctx.font = 'bold 12px system-ui';
        this.ctx.textAlign = 'right';
        this.ctx.fillText('X', this.width - 10, this.centerY - 5);

        this.ctx.fillStyle = this.colours.axisY;
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Y', this.centerX + 15, 15);

        // Scale indicator
        this.ctx.fillStyle = this.colours.text;
        this.ctx.font = '10px system-ui';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`Grid: 1mm (${this.scale}x scale)`, 10, this.height - 10);
    }

    /**
     * Draw the trail of previous positions
     */
    drawTrail() {
        if (this.trail.length < 2) return;

        const trailColour = this.mode === 'calibrated'
            ? this.colours.trailCorrected
            : this.colours.trail;

        this.ctx.strokeStyle = trailColour;
        this.ctx.lineWidth = 2;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';

        this.ctx.beginPath();
        for (let i = 0; i < this.trail.length; i++) {
            const point = this.trail[i];
            const x = this.centerX + point.x * this.scale;
            const y = this.centerY - point.y * this.scale;  // Flip Y

            if (i === 0) {
                this.ctx.moveTo(x, y);
            } else {
                this.ctx.lineTo(x, y);
            }
        }
        this.ctx.stroke();

        // Draw fading dots
        for (let i = 0; i < this.trail.length; i++) {
            const point = this.trail[i];
            const x = this.centerX + point.x * this.scale;
            const y = this.centerY - point.y * this.scale;
            const alpha = (i / this.trail.length) * 0.5;

            this.ctx.fillStyle = this.mode === 'calibrated'
                ? `rgba(78, 205, 196, ${alpha})`
                : `rgba(255, 107, 107, ${alpha})`;
            this.ctx.beginPath();
            this.ctx.arc(x, y, 2, 0, Math.PI * 2);
            this.ctx.fill();
        }
    }

    /**
     * Draw the nozzle tip
     */
    drawNozzle(error) {
        const x = this.centerX + error.x * this.scale;
        const y = this.centerY - error.y * this.scale;  // Flip Y for screen coords

        const colour = this.mode === 'calibrated'
            ? this.colours.nozzleCorrected
            : this.colours.nozzle;

        // Outer glow
        const gradient = this.ctx.createRadialGradient(x, y, 0, x, y, this.nozzleRadius * 2);
        gradient.addColorStop(0, colour);
        gradient.addColorStop(1, 'transparent');
        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.arc(x, y, this.nozzleRadius * 2, 0, Math.PI * 2);
        this.ctx.fill();

        // Main nozzle dot
        this.ctx.fillStyle = colour;
        this.ctx.beginPath();
        this.ctx.arc(x, y, this.nozzleRadius, 0, Math.PI * 2);
        this.ctx.fill();

        // White center
        this.ctx.fillStyle = 'white';
        this.ctx.beginPath();
        this.ctx.arc(x, y, this.nozzleRadius / 3, 0, Math.PI * 2);
        this.ctx.fill();

        // Z indicator (vertical bar below nozzle)
        const zHeight = error.z * this.scale;
        if (Math.abs(zHeight) > 1) {
            this.ctx.strokeStyle = this.colours.axisZ;
            this.ctx.lineWidth = 3;
            this.ctx.beginPath();
            this.ctx.moveTo(x, y + this.nozzleRadius + 5);
            this.ctx.lineTo(x, y + this.nozzleRadius + 5 + zHeight);
            this.ctx.stroke();

            // Z label
            this.ctx.fillStyle = this.colours.axisZ;
            this.ctx.font = '10px system-ui';
            this.ctx.textAlign = 'left';
            this.ctx.fillText(`Z: ${error.z.toFixed(2)}mm`, x + 10, y + this.nozzleRadius + 10);
        }
    }

    /**
     * Draw current angle info
     */
    drawInfo(error) {
        const padding = 15;

        // Mode indicator
        this.ctx.fillStyle = this.mode === 'calibrated'
            ? this.colours.nozzleCorrected
            : this.colours.nozzle;
        this.ctx.font = 'bold 14px system-ui';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(
            this.mode === 'calibrated' ? '✓ CALIBRATED' : '✗ UNCALIBRATED',
            padding,
            padding + 5
        );

        // Current angles
        this.ctx.fillStyle = this.colours.text;
        this.ctx.font = '12px system-ui';
        this.ctx.fillText(`A: ${this.currentA.toFixed(0)}°  B: ${this.currentB.toFixed(0)}°`, padding, padding + 25);

        // Current error
        if (this.mode === 'uncalibrated') {
            this.ctx.fillText(
                `Error: X=${error.x.toFixed(2)} Y=${error.y.toFixed(2)} Z=${error.z.toFixed(2)} mm`,
                padding,
                padding + 42
            );
        }

        // Instructions
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        this.ctx.font = '10px system-ui';
        this.ctx.textAlign = 'right';
        this.ctx.fillText(
            this.animating ? 'Click to pause' : 'Click to start animation',
            this.width - padding,
            this.height - padding
        );
    }

    /**
     * Main render function
     */
    render() {
        this.setupCanvas();
        this.clear();
        this.drawGrid();

        if (!this.corrector || !this.corrector.loaded) {
            // No data state
            this.ctx.fillStyle = this.colours.text;
            this.ctx.font = '14px system-ui';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('Load calibration data to see visualization', this.centerX, this.centerY);
            return;
        }

        const error = this.getError(this.currentA, this.currentB);

        this.drawTrail();
        this.drawNozzle(error);
        this.drawInfo(error);
    }

    /**
     * Animation step
     */
    animate() {
        if (!this.animating) return;

        // Update angles based on sweep mode
        if (this.sweepMode === 'a' || this.sweepMode === 'both') {
            this.currentA += this.animationSpeed;
            if (this.currentA >= 360) this.currentA = 0;
        }

        if (this.sweepMode === 'b') {
            this.currentB += this.animationSpeed * 0.5;
            if (this.currentB > 90) {
                this.currentB = 90;
                this.animationSpeed = -Math.abs(this.animationSpeed);
            } else if (this.currentB < -90) {
                this.currentB = -90;
                this.animationSpeed = Math.abs(this.animationSpeed);
            }
        }

        if (this.sweepMode === 'both') {
            // Slowly vary B while A rotates
            this.currentB = Math.sin(this.currentA * Math.PI / 180) * 45;
        }

        // Add to trail
        const error = this.getError(this.currentA, this.currentB);
        this.trail.push({ x: error.x, y: error.y, z: error.z });
        if (this.trail.length > this.trailLength) {
            this.trail.shift();
        }

        this.render();
        this.animationId = requestAnimationFrame(() => this.animate());
    }

    /**
     * Start animation
     */
    start() {
        if (this.animating) return;
        this.animating = true;
        this.animate();
    }

    /**
     * Stop animation
     */
    stop() {
        this.animating = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    /**
     * Toggle animation
     */
    toggle() {
        if (this.animating) {
            this.stop();
        } else {
            this.start();
        }
    }

    /**
     * Reset to initial state
     */
    reset() {
        this.stop();
        this.currentA = 0;
        this.currentB = 0;
        this.trail = [];
        this.render();
    }

    /**
     * Set specific angles
     */
    setAngles(a, b) {
        this.currentA = a;
        this.currentB = b;
        this.trail = [];
        this.render();
    }

    /**
     * Clean up
     */
    destroy() {
        this.stop();
    }
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CalibrationVisualizer };
}
