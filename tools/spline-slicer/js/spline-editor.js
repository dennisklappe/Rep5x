// Spline editor for Rep5x Spline Slicer - control point management and curve sampling

class SplineEditor {
    constructor() {
        this.controlPoints = [];
        this.sliceModes = [];   // 'auto' or 'flat' per control point
        this.clipFlags = [];    // boolean per control point — barrier that clips geometry behind it
        this.curve = null;
        this.curveType = 'linear'; // 'smooth' or 'linear'
    }

    /**
     * Set the curve type
     * @param {string} type - 'smooth' (CatmullRom) or 'linear' (polyline segments)
     */
    setCurveType(type) {
        this.curveType = type;
        this.rebuildCurve();
    }

    /**
     * Add a control point
     * @param {THREE.Vector3} pos - Position of the control point
     * @param {string} sliceMode - 'auto' or 'flat' (default: 'auto')
     */
    addPoint(pos, sliceMode = 'auto') {
        this.controlPoints.push(pos.clone());
        this.sliceModes.push(sliceMode);
        this.clipFlags.push(false);
        this.rebuildCurve();
    }

    /**
     * Remove a control point by index
     * @param {number} index
     */
    removePoint(index) {
        if (index >= 0 && index < this.controlPoints.length) {
            this.controlPoints.splice(index, 1);
            this.sliceModes.splice(index, 1);
            this.clipFlags.splice(index, 1);
            this.rebuildCurve();
        }
    }

    /**
     * Move a control point to a new position
     * @param {number} index
     * @param {THREE.Vector3} pos
     */
    movePoint(index, pos) {
        if (index >= 0 && index < this.controlPoints.length) {
            this.controlPoints[index].copy(pos);
            this.rebuildCurve();
        }
    }

    /**
     * Set the slice mode for a control point
     * @param {number} index
     * @param {string} mode - 'auto' or 'flat'
     */
    setSliceMode(index, mode) {
        if (index >= 0 && index < this.sliceModes.length) {
            this.sliceModes[index] = mode;
        }
    }

    /**
     * Get slice modes for all control points
     * @returns {string[]}
     */
    getSliceModes() {
        return this.sliceModes;
    }

    /**
     * Set the clip/barrier flag for a control point
     * @param {number} index
     * @param {boolean} enabled
     */
    setClipFlag(index, enabled) {
        if (index >= 0 && index < this.clipFlags.length) {
            this.clipFlags[index] = enabled;
        }
    }

    /**
     * Get clip flags for all control points
     * @returns {boolean[]}
     */
    getClipFlags() {
        return this.clipFlags;
    }

    /**
     * Clear all control points
     */
    clearPoints() {
        this.controlPoints = [];
        this.sliceModes = [];
        this.clipFlags = [];
        this.curve = null;
    }

    /**
     * Rebuild the curve from control points
     */
    rebuildCurve() {
        if (this.controlPoints.length < 2) {
            this.curve = null;
            return;
        }

        if (this.curveType === 'smooth') {
            this.curve = new THREE.CatmullRomCurve3(this.controlPoints, false, 'catmullrom', 0.5);
        } else {
            // Linear mode: build a CurvePath of LineCurve3 segments
            this.curve = new THREE.CurvePath();
            for (let i = 0; i < this.controlPoints.length - 1; i++) {
                this.curve.add(new THREE.LineCurve3(
                    this.controlPoints[i],
                    this.controlPoints[i + 1]
                ));
            }
        }
    }

    /**
     * Get points along the curve for visual display
     * @param {number} numPoints - Number of sample points
     * @returns {THREE.Vector3[]} Array of points along the curve
     */
    getCurvePoints(numPoints = 200) {
        if (!this.curve) return [];

        if (this.curveType === 'linear') {
            // For linear mode, just return control points (straight line segments)
            return this.controlPoints.map(p => p.clone());
        }

        return this.curve.getPoints(numPoints);
    }

    /**
     * Sample the curve at arc-length intervals, adapting step size for curvature.
     * @param {number} layerHeight - Target layer height on the model surface
     * @param {number} modelRadius - Estimated max distance from spline to model surface (0 = uniform sampling)
     * @returns {Array} Array of {point, tangent, normal, distance, u}
     */
    sampleByArcLength(layerHeight, modelRadius = 0) {
        if (!this.curve) return [];

        if (this.curveType === 'linear') {
            return this._sampleLinearByArcLength(layerHeight);
        }

        return this._sampleSmoothByArcLength(layerHeight, modelRadius);
    }

    /**
     * Get the effective slice normal at a control point
     * @param {number} index - Control point index
     * @param {THREE.Vector3} segmentTangent - Tangent of the relevant segment (used for 'auto')
     * @returns {THREE.Vector3}
     */
    _getEffectiveNormal(index, segmentTangent) {
        if (this.sliceModes[index] === 'flat') {
            return new THREE.Vector3(0, 1, 0); // Horizontal slicing
        }
        // Auto: use the segment tangent
        return segmentTangent.clone();
    }

    /**
     * Spherical linear interpolation between two unit vectors
     */
    _slerpVectors(v1, v2, t) {
        const dot = Math.max(-1, Math.min(1, v1.dot(v2)));

        // Nearly parallel vectors — just lerp
        if (Math.abs(dot) > 0.9999) {
            return v1.clone().lerp(v2, t).normalize();
        }

        const omega = Math.acos(dot);
        const sinOmega = Math.sin(omega);
        const s1 = Math.sin((1 - t) * omega) / sinOmega;
        const s2 = Math.sin(t * omega) / sinOmega;

        return new THREE.Vector3(
            v1.x * s1 + v2.x * s2,
            v1.y * s1 + v2.y * s2,
            v1.z * s1 + v2.z * s2
        ).normalize();
    }

    /**
     * Compute the curvature of the spline at parameter u.
     * Curvature = |dT/ds| where T is the unit tangent and s is arc length.
     * @returns {number} curvature (1/radius). 0 = straight.
     */
    _getCurvature(u) {
        const du = 0.002;
        const u1 = Math.max(0, u - du / 2);
        const u2 = Math.min(1, u + du / 2);
        const t1 = this.curve.getTangent(u1).normalize();
        const t2 = this.curve.getTangent(u2).normalize();
        const p1 = this.curve.getPoint(u1);
        const p2 = this.curve.getPoint(u2);
        const ds = p1.distanceTo(p2);
        if (ds < 1e-10) return 0;
        return t1.distanceTo(t2) / ds;
    }

    /**
     * Sample smooth CatmullRom curve by arc length with curvature-adaptive step size.
     * Where the spline curves, steps are smaller so the outside surface
     * gets layer gaps close to the target layerHeight.
     *
     * @param {number} layerHeight - Target surface layer height
     * @param {number} modelRadius - Max distance from spline to model surface (0 = uniform)
     */
    _sampleSmoothByArcLength(layerHeight, modelRadius = 0) {
        const totalLength = this.curve.getLength();
        const samples = [];

        // Compute approximate arc-length fractions for each control point
        const cpFractions = this._getControlPointFractions();

        // Pre-compute clip planes from control points with barriers
        const allClipPlanes = [];
        for (let cp = 1; cp < this.controlPoints.length; cp++) {
            if (this.clipFlags[cp]) {
                const incomingDir = new THREE.Vector3()
                    .subVectors(this.controlPoints[cp], this.controlPoints[cp - 1])
                    .normalize();
                allClipPlanes.push({
                    point: this.controlPoints[cp].clone(),
                    normal: incomingDir,
                    fraction: cpFractions[cp]
                });
            }
        }

        // Walk along the curve with adaptive step size
        let distance = 0;
        const minStep = layerHeight * 0.2; // Never subdivide below 20% of layer height

        while (distance <= totalLength) {
            const u = this.curve.getUtoTmapping(0, Math.min(distance, totalLength));
            const point = this.curve.getPoint(u);
            const tangent = this.curve.getTangent(u).normalize();
            const fraction = distance / totalLength;

            // Compute interpolated normal
            const normal = this._interpolateNormal(fraction, tangent, cpFractions);

            // Collect clip planes that have been passed
            const clipPlanes = allClipPlanes
                .filter(cp => fraction >= cp.fraction - 1e-10)
                .map(cp => ({ point: cp.point, normal: cp.normal }));

            samples.push({ point, tangent, normal, clipPlanes, distance, u });

            // Compute adaptive step for the next sample
            if (modelRadius > 0) {
                const curvature = this._getCurvature(u);
                const R = curvature > 1e-6 ? 1 / curvature : Infinity;
                // step = layerHeight * R / (R + modelRadius)
                // This ensures the gap on the outside surface ≈ layerHeight
                const step = R < Infinity
                    ? layerHeight * R / (R + modelRadius)
                    : layerHeight;
                distance += Math.max(step, minStep);
            } else {
                distance += layerHeight;
            }
        }

        return samples;
    }

    /**
     * Get approximate arc-length fractions for each control point on the smooth curve
     */
    _getControlPointFractions() {
        const N = this.controlPoints.length;
        if (N < 2) return [0];

        // For CatmullRom, control point i is at t = i/(N-1) in native parameterization
        // Compute arc length to each control point by numerical integration
        const fractions = [0];
        let cumulativeLength = 0;
        const stepsPerSegment = 50;

        for (let i = 1; i < N; i++) {
            const prevT = (i - 1) / (N - 1);
            const currT = i / (N - 1);
            let segLength = 0;
            let prevPt = this.curve.getPoint(prevT);

            for (let s = 1; s <= stepsPerSegment; s++) {
                const t = prevT + (currT - prevT) * s / stepsPerSegment;
                const pt = this.curve.getPoint(t);
                segLength += pt.distanceTo(prevPt);
                prevPt = pt;
            }
            cumulativeLength += segLength;
            fractions.push(cumulativeLength);
        }

        // Normalize to 0..1
        const total = cumulativeLength;
        for (let i = 1; i < fractions.length; i++) {
            fractions[i] /= total;
        }

        return fractions;
    }

    /**
     * Interpolate the effective normal at a given fraction along the curve
     */
    _interpolateNormal(fraction, tangent, cpFractions) {
        const N = this.controlPoints.length;

        // Find which two control points this fraction falls between
        let segIdx = 0;
        for (let i = 0; i < N - 1; i++) {
            if (fraction >= cpFractions[i] && fraction <= cpFractions[i + 1] + 1e-10) {
                segIdx = i;
                break;
            }
        }

        // Compute local t within this segment
        const segStart = cpFractions[segIdx];
        const segEnd = cpFractions[segIdx + 1];
        const segRange = segEnd - segStart;
        const localT = segRange > 1e-10 ? (fraction - segStart) / segRange : 0;

        // Get effective normals at segment endpoints
        const startNormal = this._getEffectiveNormal(segIdx, tangent);
        const endNormal = this._getEffectiveNormal(segIdx + 1, tangent);

        // If both are the same mode and auto, just use tangent directly
        if (this.sliceModes[segIdx] === 'auto' && this.sliceModes[segIdx + 1] === 'auto') {
            return tangent.clone();
        }

        // Slerp between the two normals
        return this._slerpVectors(startNormal, endNormal, localT);
    }

    /**
     * Sample linear polyline segments by arc length.
     * Each segment has a constant tangent (the segment direction).
     * Normal is interpolated between control point slice modes.
     */
    _sampleLinearByArcLength(layerHeight) {
        const samples = [];
        let totalDistance = 0;
        const activeClipPlanes = [];

        for (let seg = 0; seg < this.controlPoints.length - 1; seg++) {
            const start = this.controlPoints[seg];
            const end = this.controlPoints[seg + 1];
            const segDir = new THREE.Vector3().subVectors(end, start);
            const segLength = segDir.length();
            const tangent = segDir.clone().normalize();

            // Check if start control point has a barrier — use incoming tangent as clip normal
            if (this.clipFlags[seg] && seg > 0) {
                const incomingTangent = new THREE.Vector3()
                    .subVectors(this.controlPoints[seg], this.controlPoints[seg - 1])
                    .normalize();
                activeClipPlanes.push({
                    point: this.controlPoints[seg].clone(),
                    normal: incomingTangent
                });
            }

            // Get effective normals at segment endpoints for interpolation
            const startNormal = this._getEffectiveNormal(seg, tangent);
            const endNormal = this._getEffectiveNormal(seg + 1, tangent);
            const needsInterpolation = this.sliceModes[seg] !== this.sliceModes[seg + 1];

            // How far into this segment do we start?
            const distIntoSeg = totalDistance % layerHeight;
            const firstSampleOffset = distIntoSeg === 0 ? 0 : layerHeight - distIntoSeg;

            let d = firstSampleOffset;

            // If this is the first segment and we're at the very start, add the start point
            if (seg === 0 && d > 0) {
                samples.push({
                    point: start.clone(),
                    tangent: tangent.clone(),
                    normal: startNormal.clone(),
                    clipPlanes: [...activeClipPlanes],
                    distance: 0,
                    u: 0
                });
            }

            while (d <= segLength + 1e-10) {
                const t = d / segLength;
                const point = new THREE.Vector3().lerpVectors(start, end, Math.min(t, 1));
                const sampleDist = totalDistance + d;

                // Interpolate normal if endpoints have different modes
                let normal;
                if (needsInterpolation) {
                    normal = this._slerpVectors(startNormal, endNormal, Math.min(t, 1));
                } else {
                    normal = startNormal.clone();
                }

                samples.push({
                    point,
                    tangent: tangent.clone(),
                    normal,
                    clipPlanes: [...activeClipPlanes],
                    distance: sampleDist,
                    u: sampleDist / this.getTotalLength()
                });

                d += layerHeight;
            }

            totalDistance += segLength;
        }

        return samples;
    }

    /**
     * Get the total length of the curve
     * @returns {number}
     */
    getTotalLength() {
        if (!this.curve) return 0;

        if (this.curveType === 'linear') {
            let total = 0;
            for (let i = 0; i < this.controlPoints.length - 1; i++) {
                total += this.controlPoints[i].distanceTo(this.controlPoints[i + 1]);
            }
            return total;
        }

        return this.curve.getLength();
    }

    /**
     * Get the number of control points
     * @returns {number}
     */
    getPointCount() {
        return this.controlPoints.length;
    }

    /**
     * Get all control points
     * @returns {THREE.Vector3[]}
     */
    getPoints() {
        return this.controlPoints;
    }

    /**
     * Check if the curve is valid (has at least 2 points)
     * @returns {boolean}
     */
    isValid() {
        return this.controlPoints.length >= 2;
    }
}
