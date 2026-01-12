/**
 * Graph Renderer
 * Canvas-based error curve visualization
 */
class GraphRenderer {
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

        // Data
        this.engine = null;
        this.viewMode = 'b';  // 'b' for view by B angle, 'a' for view by A angle
        this.selectedAngle = null;  // Which angle slice to show

        // Animation
        this.animationId = null;

        // Calibration phase ('xy', 'z', or 'full') - controls which axes to plot
        this.calibrationPhase = 'xy';

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
     * Set data from calibration engine
     * @param {CalibrationEngine} engine
     */
    setDataFromEngine(engine) {
        this.engine = engine;
        this.render();
    }

    /**
     * Set view mode ('b' for by B angle, 'a' for by A angle)
     */
    setViewMode(mode, angle = null) {
        this.viewMode = mode;
        this.selectedAngle = angle;
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
     * Draw a data line
     */
    drawLine(data, angleValues, minY, maxY, colour) {
        if (data.length < 2) return;

        const area = this.drawArea;
        const xStep = area.width / (angleValues.length - 1 || 1);
        const yRange = maxY - minY;

        // Sort data by angle to draw line in correct order along X axis
        const sortedData = [...data].sort((a, b) => {
            const angleA = this.viewMode === 'b' ? a.a : a.b;
            const angleB = this.viewMode === 'b' ? b.a : b.b;
            return angleValues.indexOf(angleA) - angleValues.indexOf(angleB);
        });

        this.ctx.strokeStyle = colour;
        this.ctx.lineWidth = 2;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';

        this.ctx.beginPath();

        let started = false;
        for (const point of sortedData) {
            const angleIndex = angleValues.indexOf(this.viewMode === 'b' ? point.a : point.b);
            if (angleIndex === -1) continue;

            const x = area.x + angleIndex * xStep;
            const y = area.y + ((maxY - point.error) / yRange) * area.height;

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
            const angleIndex = angleValues.indexOf(this.viewMode === 'b' ? point.a : point.b);
            if (angleIndex === -1) continue;

            const x = area.x + angleIndex * xStep;
            const y = area.y + ((maxY - point.error) / yRange) * area.height;

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

        if (!this.engine) return;

        // Get data based on view mode
        let measurements, angleValues, angleLabel;

        if (this.viewMode === 'b') {
            // Show all A angles for selected B (or all B values)
            angleValues = this.engine.aAngles;
            angleLabel = 'A';

            if (this.selectedAngle !== null) {
                measurements = this.engine.getMeasurementsByB(this.selectedAngle);
            } else {
                // Show all B values, pick first one with data
                for (const b of this.engine.bAngles) {
                    measurements = this.engine.getMeasurementsByB(b);
                    if (measurements.length > 0) break;
                }
            }
        } else {
            // Show all B angles for selected A (use sorted order for graph: -90 to 90)
            angleValues = this.engine.bAnglesSorted;
            angleLabel = 'B';

            if (this.selectedAngle !== null) {
                measurements = this.engine.getMeasurementsByA(this.selectedAngle);
            } else {
                // Show all A values, pick first one with data
                for (const a of this.engine.aAngles) {
                    measurements = this.engine.getMeasurementsByA(a);
                    if (measurements.length > 0) break;
                }
            }
        }

        if (!measurements || measurements.length === 0) {
            // Draw empty state
            this.ctx.fillStyle = this.textColour;
            this.ctx.font = '14px system-ui, sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText('No data yet', this.width / 2, this.height / 2);
            return;
        }

        // Calculate Y range (error values) - only include relevant axes based on phase
        let allErrors;
        if (this.calibrationPhase === 'xy') {
            allErrors = measurements.flatMap(m => [m.error.x, m.error.y]);
        } else if (this.calibrationPhase === 'z') {
            allErrors = measurements.flatMap(m => [m.error.z]);
        } else {
            allErrors = measurements.flatMap(m => [m.error.x, m.error.y, m.error.z]);
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

        // Prepare data for each axis
        const xData = measurements.map(m => ({
            a: m.a,
            b: m.b,
            error: m.error.x
        }));

        const yData = measurements.map(m => ({
            a: m.a,
            b: m.b,
            error: m.error.y
        }));

        const zData = measurements.map(m => ({
            a: m.a,
            b: m.b,
            error: m.error.z
        }));

        // Draw lines for each axis based on calibration phase
        if (this.calibrationPhase !== 'z') {
            this.drawLine(xData, angleValues, minY, maxY, this.colours.x);
            this.drawLine(yData, angleValues, minY, maxY, this.colours.y);
        }
        if (this.calibrationPhase !== 'xy') {
            this.drawLine(zData, angleValues, minY, maxY, this.colours.z);
        }

        // Draw title showing current slice
        const title = this.selectedAngle !== null
            ? `${this.viewMode === 'b' ? 'B' : 'A'} = ${this.selectedAngle}°`
            : 'All data';
        this.ctx.fillStyle = this.textColour;
        this.ctx.font = 'bold 12px system-ui, sans-serif';
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'top';
        this.ctx.fillText(title, this.padding.left, 4);
    }

    /**
     * Render all data as overview (multiple lines for different angle slices)
     */
    renderOverview() {
        this.setupCanvas();
        this.clear();

        if (!this.engine) return;

        const measurements = this.engine.getAllMeasurements();
        if (measurements.length === 0) {
            this.ctx.fillStyle = this.textColour;
            this.ctx.font = '14px system-ui, sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText('No data yet', this.width / 2, this.height / 2);
            return;
        }

        // For overview, show B on X axis (sorted: -90 to 90), with separate line for each A
        const angleValues = this.engine.bAnglesSorted;
        const angleLabel = 'B';

        // Calculate Y range
        const allErrors = measurements.flatMap(m => [m.error.x, m.error.y, m.error.z]);
        let minY = Math.min(...allErrors);
        let maxY = Math.max(...allErrors);
        const padding = (maxY - minY) * 0.1 || 0.5;
        minY -= padding;
        maxY += padding;
        if (minY > 0) minY = -padding;
        if (maxY < 0) maxY = padding;

        this.drawGrid(minY, maxY, angleValues);
        this.drawAxes(minY, maxY, angleValues, angleLabel);

        // Draw all A slices with varying opacity
        for (let i = 0; i < this.engine.aAngles.length; i++) {
            const a = this.engine.aAngles[i];
            const sliceMeasurements = this.engine.getMeasurementsByA(a);
            if (sliceMeasurements.length === 0) continue;

            const opacity = 0.3 + (0.7 * (i / this.engine.aAngles.length));

            const xData = sliceMeasurements.map(m => ({ a: m.a, b: m.b, error: m.error.x }));
            const yData = sliceMeasurements.map(m => ({ a: m.a, b: m.b, error: m.error.y }));
            const zData = sliceMeasurements.map(m => ({ a: m.a, b: m.b, error: m.error.z }));

            this.ctx.globalAlpha = opacity;
            this.drawLine(xData, angleValues, minY, maxY, this.colours.x);
            this.drawLine(yData, angleValues, minY, maxY, this.colours.y);
            this.drawLine(zData, angleValues, minY, maxY, this.colours.z);
        }

        this.ctx.globalAlpha = 1;
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
