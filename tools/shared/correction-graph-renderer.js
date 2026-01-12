/**
 * Correction Graph Renderer
 * Canvas-based error curve visualisation for calibration data
 *
 * Used by: Calibrator, G-code Corrector
 */
class CorrectionGraphRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        // Colours for each axis (matching gcode-viewer axis arrows)
        this.colours = {
            x: '#ff0000',
            y: '#00ff00',
            z: '#0000ff'
        };

        // Graph configuration
        this.padding = { top: 20, right: 20, bottom: 40, left: 50 };
        this.gridColour = 'rgba(255, 255, 255, 0.1)';
        this.axisColour = 'rgba(255, 255, 255, 0.3)';
        this.textColour = 'rgba(255, 255, 255, 0.7)';

        // Data storage - simple arrays of {angle, errorX, errorY, errorZ}
        this.aSweepData = [];  // A sweep data (at B=0) - raw measured points
        this.bSweepData = [];  // B sweep data (at A=0) - raw measured points
        this.aSweepFitted = [];  // A sweep fitted curve points
        this.bSweepFitted = [];  // B sweep fitted curve points

        // View configuration
        this.viewMode = 'a';  // 'a' for A sweep, 'b' for B sweep
        this.showAxes = { x: true, y: true, z: true };  // Which error axes to show
        this.showFittedCurve = true;  // Show the fitted curve

        // Animation
        this.animationId = null;

        this.setupCanvas();
    }

    /**
     * Setup canvas with proper resolution
     */
    setupCanvas() {
        const rect = this.canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;

        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.ctx.scale(dpr, dpr);

        // Store actual drawing dimensions
        this.width = rect.width;
        this.height = rect.height;
    }

    /**
     * Get drawing area dimensions
     */
    get drawArea() {
        return {
            x: this.padding.left,
            y: this.padding.top,
            width: this.width - this.padding.left - this.padding.right,
            height: this.height - this.padding.top - this.padding.bottom
        };
    }

    /**
     * Set A sweep data (errors at different A angles, B=0)
     * @param {Array} data - Array of {angle, errorX, errorY, errorZ}
     */
    setASweepData(data) {
        this.aSweepData = [...data].sort((a, b) => a.angle - b.angle);
    }

    /**
     * Set B sweep data (errors at different B angles, A=0)
     * @param {Array} data - Array of {angle, errorX, errorY, errorZ}
     */
    setBSweepData(data) {
        this.bSweepData = [...data].sort((a, b) => a.angle - b.angle);
    }

    /**
     * Load data from CalibrationCorrector instance
     * @param {CalibrationCorrector} corrector
     */
    setDataFromCorrector(corrector) {
        // Get raw measured data points
        if (corrector.getASweepData) {
            this.setASweepData(corrector.getASweepData());
        }
        if (corrector.getBSweepData) {
            this.setBSweepData(corrector.getBSweepData());
        }

        // Get fitted curve data (if available)
        if (corrector.getASweepFitted) {
            this.aSweepFitted = corrector.getASweepFitted(5);  // 5° steps for smooth curve
        }
        if (corrector.getBSweepFitted) {
            this.bSweepFitted = corrector.getBSweepFitted(5);
        }

        this.render();
    }

    /**
     * Load data from CalibrationEngine instance (for calibrator compatibility)
     * @param {CalibrationEngine} engine
     */
    setDataFromEngine(engine) {
        // Convert engine measurements to simple data format
        // A sweep: all A angles at B=0
        const aSweepMeasurements = engine.getMeasurementsByB(0);
        this.aSweepData = aSweepMeasurements.map(m => ({
            angle: m.a,
            errorX: m.error.x,
            errorY: m.error.y,
            errorZ: m.error.z
        })).sort((a, b) => a.angle - b.angle);

        // B sweep: all B angles at A=0
        const bSweepMeasurements = engine.getMeasurementsByA(0);
        this.bSweepData = bSweepMeasurements.map(m => ({
            angle: m.b,
            errorX: m.error.x,
            errorY: m.error.y,
            errorZ: m.error.z
        })).sort((a, b) => a.angle - b.angle);

        this.render();
    }

    /**
     * Set view mode
     * @param {string} mode - 'a' for A sweep, 'b' for B sweep
     */
    setViewMode(mode) {
        this.viewMode = mode;
        this.render();
    }

    /**
     * Set which error axes to show
     * @param {Object} axes - {x: bool, y: bool, z: bool}
     */
    setShowAxes(axes) {
        this.showAxes = { ...this.showAxes, ...axes };
        this.render();
    }

    /**
     * Clear canvas
     */
    clear() {
        this.ctx.clearRect(0, 0, this.width, this.height);
    }

    /**
     * Draw grid lines
     */
    drawGrid(minY, maxY, angleValues) {
        const area = this.drawArea;
        this.ctx.strokeStyle = this.gridColour;
        this.ctx.lineWidth = 1;

        // Horizontal grid lines (error values)
        const ySteps = 5;

        for (let i = 0; i <= ySteps; i++) {
            const y = area.y + (i / ySteps) * area.height;
            this.ctx.beginPath();
            this.ctx.moveTo(area.x, y);
            this.ctx.lineTo(area.x + area.width, y);
            this.ctx.stroke();
        }

        // Vertical grid lines (angle values)
        const xStep = area.width / (angleValues.length - 1 || 1);
        for (let i = 0; i < angleValues.length; i++) {
            const x = area.x + i * xStep;
            this.ctx.beginPath();
            this.ctx.moveTo(x, area.y);
            this.ctx.lineTo(x, area.y + area.height);
            this.ctx.stroke();
        }
    }

    /**
     * Draw axis labels
     */
    drawAxes(minY, maxY, angleValues, angleLabel) {
        const area = this.drawArea;

        this.ctx.fillStyle = this.textColour;
        this.ctx.font = '11px system-ui, sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'top';

        // X-axis labels (angles)
        const xStep = area.width / (angleValues.length - 1 || 1);
        for (let i = 0; i < angleValues.length; i++) {
            const x = area.x + i * xStep;
            this.ctx.fillText(`${angleValues[i]}°`, x, area.y + area.height + 8);
        }

        // X-axis title
        this.ctx.fillText(`${angleLabel} angle`, area.x + area.width / 2, area.y + area.height + 24);

        // Y-axis labels (error values)
        this.ctx.textAlign = 'right';
        this.ctx.textBaseline = 'middle';
        const ySteps = 5;
        for (let i = 0; i <= ySteps; i++) {
            const value = maxY - (i / ySteps) * (maxY - minY);
            const y = area.y + (i / ySteps) * area.height;
            this.ctx.fillText(value.toFixed(2), area.x - 8, y);
        }

        // Y-axis title
        this.ctx.save();
        this.ctx.translate(12, area.y + area.height / 2);
        this.ctx.rotate(-Math.PI / 2);
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Error (mm)', 0, 0);
        this.ctx.restore();

        // Draw zero line if in range
        if (minY < 0 && maxY > 0) {
            const zeroY = area.y + (maxY / (maxY - minY)) * area.height;
            this.ctx.strokeStyle = this.axisColour;
            this.ctx.lineWidth = 1;
            this.ctx.setLineDash([5, 5]);
            this.ctx.beginPath();
            this.ctx.moveTo(area.x, zeroY);
            this.ctx.lineTo(area.x + area.width, zeroY);
            this.ctx.stroke();
            this.ctx.setLineDash([]);
        }
    }

    /**
     * Draw a smooth fitted curve (no points, just line)
     */
    drawFittedCurve(data, minAngle, maxAngle, minY, maxY, colour, errorKey) {
        if (data.length < 2) return;

        const area = this.drawArea;
        const yRange = maxY - minY;
        const angleRange = maxAngle - minAngle;

        this.ctx.strokeStyle = colour;
        this.ctx.lineWidth = 2;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';

        this.ctx.beginPath();

        let started = false;
        for (const point of data) {
            const error = point[errorKey];
            // Map angle to x position
            const x = area.x + ((point.angle - minAngle) / angleRange) * area.width;
            const y = area.y + ((maxY - error) / yRange) * area.height;

            if (!started) {
                this.ctx.moveTo(x, y);
                started = true;
            } else {
                this.ctx.lineTo(x, y);
            }
        }

        this.ctx.stroke();
    }

    /**
     * Draw data points (dots only, no connecting line)
     */
    drawDataPoints(data, minAngle, maxAngle, minY, maxY, colour, errorKey) {
        if (data.length === 0) return;

        const area = this.drawArea;
        const yRange = maxY - minY;
        const angleRange = maxAngle - minAngle;

        this.ctx.fillStyle = colour;

        for (const point of data) {
            const error = point[errorKey];
            const x = area.x + ((point.angle - minAngle) / angleRange) * area.width;
            const y = area.y + ((maxY - error) / yRange) * area.height;

            this.ctx.beginPath();
            this.ctx.arc(x, y, 5, 0, Math.PI * 2);
            this.ctx.fill();

            // White border for visibility
            this.ctx.strokeStyle = 'rgba(255,255,255,0.5)';
            this.ctx.lineWidth = 1;
            this.ctx.stroke();
        }
    }

    /**
     * Draw a data line (legacy method for compatibility)
     */
    drawLine(data, angleValues, minY, maxY, colour, errorKey) {
        if (data.length < 2) return;

        const area = this.drawArea;
        const xStep = area.width / (angleValues.length - 1 || 1);
        const yRange = maxY - minY;

        this.ctx.strokeStyle = colour;
        this.ctx.lineWidth = 2;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';

        this.ctx.beginPath();

        let started = false;
        for (const point of data) {
            const angleIndex = angleValues.indexOf(point.angle);
            if (angleIndex === -1) continue;

            const error = point[errorKey];
            const x = area.x + angleIndex * xStep;
            const y = area.y + ((maxY - error) / yRange) * area.height;

            if (!started) {
                this.ctx.moveTo(x, y);
                started = true;
            } else {
                this.ctx.lineTo(x, y);
            }
        }

        this.ctx.stroke();

        // Draw data points
        this.ctx.fillStyle = colour;
        for (const point of data) {
            const angleIndex = angleValues.indexOf(point.angle);
            if (angleIndex === -1) continue;

            const error = point[errorKey];
            const x = area.x + angleIndex * xStep;
            const y = area.y + ((maxY - error) / yRange) * area.height;

            this.ctx.beginPath();
            this.ctx.arc(x, y, 4, 0, Math.PI * 2);
            this.ctx.fill();
        }
    }

    /**
     * Main render function
     */
    render() {
        this.setupCanvas();
        this.clear();

        // Select data based on view mode
        const rawData = this.viewMode === 'a' ? this.aSweepData : this.bSweepData;
        const fittedData = this.viewMode === 'a' ? this.aSweepFitted : this.bSweepFitted;
        const angleLabel = this.viewMode === 'a' ? 'A' : 'B';

        if ((!rawData || rawData.length === 0) && (!fittedData || fittedData.length === 0)) {
            // Draw empty state
            this.ctx.fillStyle = this.textColour;
            this.ctx.font = '14px system-ui, sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText('No data', this.width / 2, this.height / 2);
            return;
        }

        // Determine angle range
        const minAngle = this.viewMode === 'a' ? 0 : -90;
        const maxAngle = this.viewMode === 'a' ? 360 : 90;

        // Get angle values for x-axis labels (use raw data points)
        const angleValues = rawData.map(d => d.angle);

        // Calculate Y range - include both raw and fitted data
        let allErrors = [];
        const dataToCheck = fittedData && fittedData.length > 0 ? fittedData : rawData;
        if (this.showAxes.x) allErrors.push(...dataToCheck.map(d => d.errorX));
        if (this.showAxes.y) allErrors.push(...dataToCheck.map(d => d.errorY));
        if (this.showAxes.z) allErrors.push(...dataToCheck.map(d => d.errorZ));

        // Also include raw data in range calculation
        if (rawData && rawData.length > 0) {
            if (this.showAxes.x) allErrors.push(...rawData.map(d => d.errorX));
            if (this.showAxes.y) allErrors.push(...rawData.map(d => d.errorY));
            if (this.showAxes.z) allErrors.push(...rawData.map(d => d.errorZ));
        }

        if (allErrors.length === 0) {
            allErrors = [0];
        }

        let minY = Math.min(...allErrors);
        let maxY = Math.max(...allErrors);

        // Add some padding
        const padding = (maxY - minY) * 0.1 || 0.5;
        minY -= padding;
        maxY += padding;

        // Ensure zero is visible
        if (minY > 0) minY = -padding;
        if (maxY < 0) maxY = padding;

        // Draw components
        this.drawGrid(minY, maxY, angleValues);
        this.drawAxes(minY, maxY, angleValues, angleLabel);

        // Draw fitted curves first (if available)
        if (this.showFittedCurve && fittedData && fittedData.length > 0) {
            if (this.showAxes.x) {
                this.drawFittedCurve(fittedData, minAngle, maxAngle, minY, maxY, this.colours.x, 'errorX');
            }
            if (this.showAxes.y) {
                this.drawFittedCurve(fittedData, minAngle, maxAngle, minY, maxY, this.colours.y, 'errorY');
            }
            if (this.showAxes.z) {
                this.drawFittedCurve(fittedData, minAngle, maxAngle, minY, maxY, this.colours.z, 'errorZ');
            }
        }

        // Draw raw data points on top
        if (rawData && rawData.length > 0) {
            if (this.showAxes.x) {
                this.drawDataPoints(rawData, minAngle, maxAngle, minY, maxY, this.colours.x, 'errorX');
            }
            if (this.showAxes.y) {
                this.drawDataPoints(rawData, minAngle, maxAngle, minY, maxY, this.colours.y, 'errorY');
            }
            if (this.showAxes.z) {
                this.drawDataPoints(rawData, minAngle, maxAngle, minY, maxY, this.colours.z, 'errorZ');
            }
        }

        // Draw title
        const hasFitted = fittedData && fittedData.length > 0;
        const fitLabel = this.viewMode === 'a' ? 'Fourier fit' : 'Harmonic fit';
        const title = `${angleLabel} sweep (${this.viewMode === 'a' ? 'B=0°' : 'A=0°'})${hasFitted ? ` - ${fitLabel}` : ''}`;
        this.ctx.fillStyle = this.textColour;
        this.ctx.font = 'bold 12px system-ui, sans-serif';
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'top';
        this.ctx.fillText(title, this.padding.left, 4);
    }

    /**
     * Handle window resize
     */
    handleResize() {
        this.render();
    }

    /**
     * Clean up
     */
    destroy() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
    }
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CorrectionGraphRenderer };
}
