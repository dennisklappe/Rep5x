/**
 * Calibration Engine
 * Manages calibration data, IK calculations, and error tracking
 */
class CalibrationEngine {
    constructor() {
        // Sweep configuration - measure A and B axes separately
        this.aAngles = [0, 45, 90, 135, 180, 225, 270, 315];  // A sweep at B=0
        this.bAngles = [0, 15, 30, 45, 60, 75, 90, -15, -30, -45, -60, -75, -90];  // B sweep at A=0 (order for safe measurement)
        this.bAnglesSorted = [-90, -75, -60, -45, -30, -15, 0, 15, 30, 45, 60, 75, 90];  // Sorted for graph display

        // Current sweep: 'a' (varying A at B=0) or 'b' (varying B at A=0)
        this.currentSweep = 'a';

        // Calibration data storage
        this.measurements = new Map();  // Key: "A_B", Value: {x, y, z, skipped}

        // Reference position (nozzle tip at A=0, B=0)
        this.referencePosition = { x: 0, y: 0, z: 0 };

        // LA/LB values from previous calibration
        this.la = 0;
        this.lb = 47;

        // IK instance using shared module
        this.ik = new InverseKinematics(this.la, this.lb);

        // Current measurement state
        this.currentIndex = 0;
        this.phase = 'xy';  // 'xy', 'z', or 'full' (for cone method)

        // Callbacks
        this.onProgressUpdate = null;
        this.onMeasurementComplete = null;
    }

    /**
     * Generate range of values
     */
    generateRange(start, end, step) {
        const values = [];
        if (step > 0) {
            for (let v = start; v <= end; v += step) {
                values.push(v);
            }
        } else {
            for (let v = start; v >= end; v += step) {
                values.push(v);
            }
        }
        return values;
    }

    /**
     * Get total number of measurement points (A sweep + B sweep)
     */
    get totalPoints() {
        // A sweep (all A at B=0) + B sweep (all B at A=0, including B=0 as reference)
        return this.aAngles.length + this.bAngles.length;
    }

    /**
     * Get completed count
     */
    get completedCount() {
        return Array.from(this.measurements.values()).filter(m => !m.skipped).length;
    }

    /**
     * Get skipped count
     */
    get skippedCount() {
        return Array.from(this.measurements.values()).filter(m => m.skipped).length;
    }

    /**
     * Get progress percentage
     */
    get progressPercent() {
        return Math.round((this.measurements.size / this.totalPoints) * 100);
    }

    /**
     * Set LA/LB values
     */
    setLaLb(la, lb) {
        this.la = la;
        this.lb = lb;
        this.ik.setParameters(la, lb);
    }

    /**
     * Set reference position (nozzle tip at A=0, B=0)
     */
    setReferencePosition(x, y, z) {
        this.referencePosition = { x, y, z };
    }

    /**
     * Get all sweep points in order
     * First: A sweep (varying A at B=0)
     * Then: B sweep (varying B at A=0, starting with B=0 as reference point)
     */
    getGridPoints() {
        const points = [];

        // A sweep: all A angles at B=0
        for (const a of this.aAngles) {
            points.push({ a, b: 0 });
        }

        // B sweep: all B angles at A=0 (including B=0 as reference point for B sweep)
        for (const b of this.bAngles) {
            points.push({ a: 0, b });
        }

        return points;
    }

    /**
     * Get current measurement point
     */
    getCurrentPoint() {
        const points = this.getGridPoints();
        if (this.currentIndex >= points.length) {
            return null;
        }
        return points[this.currentIndex];
    }

    /**
     * Get next unmeasured point
     */
    getNextUnmeasuredPoint() {
        const points = this.getGridPoints();
        for (let i = this.currentIndex; i < points.length; i++) {
            const { a, b } = points[i];
            const key = `${a}_${b}`;
            if (!this.measurements.has(key)) {
                this.currentIndex = i;
                return points[i];
            }
        }
        return null;
    }

    /**
     * Apply inverse kinematics to get machine position
     * Given a desired nozzle tip position and A/B angles, calculate machine XYZ
     * Uses shared InverseKinematics module
     */
    applyInverseKinematics(tipX, tipY, tipZ, a, b) {
        return this.ik.apply(tipX, tipY, tipZ, a, b);
    }

    /**
     * Get expected machine position for current A/B
     * Uses reference position and IK to calculate where machine should be
     */
    getExpectedPosition(a, b) {
        return this.applyInverseKinematics(
            this.referencePosition.x,
            this.referencePosition.y,
            this.referencePosition.z,
            a,
            b
        );
    }

    /**
     * Record a measurement
     * @param {number} a - A angle
     * @param {number} b - B angle
     * @param {object} actualPosition - Actual machine position {x, y, z}
     * @param {boolean} skipped - Whether this point was skipped
     */
    recordMeasurement(a, b, actualPosition, skipped = false) {
        const key = `${a}_${b}`;
        const expected = this.getExpectedPosition(a, b);

        const measurement = {
            a,
            b,
            expected,
            actual: actualPosition,
            error: skipped ? null : {
                x: actualPosition.x - expected.x,
                y: actualPosition.y - expected.y,
                z: actualPosition.z - expected.z
            },
            skipped,
            timestamp: Date.now()
        };

        this.measurements.set(key, measurement);

        // Move to next point
        this.currentIndex++;

        // Notify callbacks
        if (this.onProgressUpdate) {
            this.onProgressUpdate(this.progressPercent, this.completedCount, this.totalPoints);
        }

        if (this.currentIndex >= this.totalPoints && this.onMeasurementComplete) {
            this.onMeasurementComplete();
        }

        return measurement;
    }

    /**
     * Get measurement for specific A/B
     */
    getMeasurement(a, b) {
        const key = `${a}_${b}`;
        return this.measurements.get(key);
    }

    /**
     * Get all measurements as array
     */
    getAllMeasurements() {
        return Array.from(this.measurements.values()).filter(m => !m.skipped);
    }

    /**
     * Get measurements filtered by B angle (for graphing)
     */
    getMeasurementsByB(b) {
        return this.aAngles.map(a => this.getMeasurement(a, b)).filter(m => m && !m.skipped);
    }

    /**
     * Get measurements filtered by A angle (for graphing)
     */
    getMeasurementsByA(a) {
        return this.bAngles.map(b => this.getMeasurement(a, b)).filter(m => m && !m.skipped);
    }

    /**
     * Get error statistics
     */
    getStatistics() {
        const measurements = this.getAllMeasurements();
        if (measurements.length === 0) {
            return null;
        }

        const xErrors = measurements.map(m => m.error.x);
        const yErrors = measurements.map(m => m.error.y);
        const zErrors = measurements.map(m => m.error.z);

        const calcStats = (errors) => ({
            min: Math.min(...errors),
            max: Math.max(...errors),
            avg: errors.reduce((a, b) => a + b, 0) / errors.length,
            absMax: Math.max(...errors.map(Math.abs)),
            absAvg: errors.map(Math.abs).reduce((a, b) => a + b, 0) / errors.length
        });

        return {
            x: calcStats(xErrors),
            y: calcStats(yErrors),
            z: calcStats(zErrors),
            totalPoints: this.totalPoints,
            completedPoints: measurements.length,
            skippedPoints: this.skippedCount
        };
    }

    /**
     * Export data as JSON
     */
    exportJSON() {
        return {
            metadata: {
                timestamp: new Date().toISOString(),
                la: this.la,
                lb: this.lb,
                referencePosition: this.referencePosition,
                bAngles: this.bAngles,
                aAngles: this.aAngles
            },
            measurements: this.getAllMeasurements(),
            statistics: this.getStatistics()
        };
    }

    /**
     * Export data as CSV
     */
    exportCSV() {
        const measurements = this.getAllMeasurements();
        const headers = ['A', 'B', 'Expected_X', 'Expected_Y', 'Expected_Z', 'Actual_X', 'Actual_Y', 'Actual_Z', 'Error_X', 'Error_Y', 'Error_Z'];

        const rows = measurements.map(m => [
            m.a,
            m.b,
            m.expected.x.toFixed(3),
            m.expected.y.toFixed(3),
            m.expected.z.toFixed(3),
            m.actual.x.toFixed(3),
            m.actual.y.toFixed(3),
            m.actual.z.toFixed(3),
            m.error.x.toFixed(3),
            m.error.y.toFixed(3),
            m.error.z.toFixed(3)
        ]);

        return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    }

    /**
     * Reset all measurements
     */
    reset() {
        this.measurements.clear();
        this.currentIndex = 0;
    }

    /**
     * Load from saved data
     */
    loadFromData(data) {
        if (data.metadata) {
            this.la = data.metadata.la || 0;
            this.lb = data.metadata.lb || 47;
            this.referencePosition = data.metadata.referencePosition || { x: 0, y: 0, z: 0 };
        }

        if (data.measurements) {
            this.measurements.clear();
            for (const m of data.measurements) {
                const key = `${m.a}_${m.b}`;
                this.measurements.set(key, m);
            }
        }
    }
}
