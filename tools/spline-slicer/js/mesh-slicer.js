// Mesh slicer for Rep5x Spline Slicer - triangle-plane intersection and contour extraction

class MeshSlicer {
    constructor() {
        // Snap grid: 0.001mm — merges intersection endpoints from shared STL edges
        // that may have slightly different vertex coordinates (float32 precision).
        this.SNAP_PRECISION = 1000;      // round(coord * 1000) / 1000
        this.HASH_PRECISION = 3;         // toFixed(3) — matches snap grid
        this.MIN_SEGMENT_LENGTH = 0.001; // discard degenerate segments below 1 micron
    }

    /**
     * Intersect a single triangle with a plane
     * @param {object} triangle - {v0, v1, v2} THREE.Vector3 vertices
     * @param {THREE.Vector3} planePoint - Point on the plane
     * @param {THREE.Vector3} planeNormal - Normal of the plane (normalised)
     * @returns {object|null} Segment {a, b} or null if no intersection
     */
    intersectTriangle(triangle, planePoint, planeNormal) {
        const { v0, v1, v2 } = triangle;

        // Signed distance of each vertex to the plane
        const d0 = v0.clone().sub(planePoint).dot(planeNormal);
        const d1 = v1.clone().sub(planePoint).dot(planeNormal);
        const d2 = v2.clone().sub(planePoint).dot(planeNormal);

        const intersections = [];

        // Check each edge for plane crossing
        this._checkEdge(v0, v1, d0, d1, intersections);
        this._checkEdge(v1, v2, d1, d2, intersections);
        this._checkEdge(v2, v0, d2, d0, intersections);

        if (intersections.length === 2) {
            return { a: intersections[0], b: intersections[1] };
        }

        return null;
    }

    /**
     * Check if an edge crosses the plane and compute intersection point
     */
    _checkEdge(va, vb, da, db, intersections) {
        if ((da > 0 && db < 0) || (da < 0 && db > 0)) {
            const t = da / (da - db);
            const point = new THREE.Vector3().lerpVectors(va, vb, t);
            intersections.push(point);
        } else if (Math.abs(da) < 1e-6 && Math.abs(db) > 1e-6) {
            intersections.push(va.clone());
        } else if (Math.abs(db) < 1e-6 && Math.abs(da) > 1e-6) {
            intersections.push(vb.clone());
        }
    }

    /**
     * Snap a point to the precision grid (mutates in place)
     * This ensures shared edges from adjacent STL triangles produce
     * identical intersection endpoints even if vertex coords differ slightly.
     */
    _snapPoint(point) {
        const p = this.SNAP_PRECISION;
        point.x = Math.round(point.x * p) / p;
        point.y = Math.round(point.y * p) / p;
        point.z = Math.round(point.z * p) / p;
    }

    /**
     * Hash a 3D point for adjacency lookup
     * @param {THREE.Vector3} point
     * @returns {string}
     */
    _hashPoint(point) {
        return `${point.x.toFixed(this.HASH_PRECISION)},${point.y.toFixed(this.HASH_PRECISION)},${point.z.toFixed(this.HASH_PRECISION)}`;
    }

    /**
     * Connect line segments into ordered contours.
     *
     * Strategy:
     * 1. Snap endpoints to grid and build hash-based adjacency
     * 2. Walk adjacency chains to form contours
     * 3. If the chain breaks (no matching neighbour), try nearest-neighbour
     *    from remaining unused segments to continue
     *
     * @param {Array} segments - Array of {a, b} segments
     * @returns {Array} Array of contours (each contour is an array of THREE.Vector3)
     */
    connectSegments(segments) {
        if (segments.length === 0) return [];

        // Snap all endpoints to grid for robust matching
        for (const seg of segments) {
            this._snapPoint(seg.a);
            this._snapPoint(seg.b);
        }

        // Filter out degenerate (near-zero-length) segments
        const validSegments = segments.filter(seg =>
            seg.a.distanceTo(seg.b) > this.MIN_SEGMENT_LENGTH
        );
        if (validSegments.length === 0) return [];

        // Build adjacency map
        const adjacency = new Map();
        for (let i = 0; i < validSegments.length; i++) {
            const seg = validSegments[i];
            const hashA = this._hashPoint(seg.a);
            const hashB = this._hashPoint(seg.b);

            if (!adjacency.has(hashA)) adjacency.set(hashA, []);
            if (!adjacency.has(hashB)) adjacency.set(hashB, []);

            adjacency.get(hashA).push({ point: seg.b, hash: hashB, index: i });
            adjacency.get(hashB).push({ point: seg.a, hash: hashA, index: i });
        }

        const used = new Set();
        const contours = [];

        // Build a spatial index of segment midpoints for nearest-neighbour fallback
        const segMidpoints = validSegments.map(seg =>
            new THREE.Vector3().addVectors(seg.a, seg.b).multiplyScalar(0.5)
        );

        for (let i = 0; i < validSegments.length; i++) {
            if (used.has(i)) continue;

            const contour = [];
            used.add(i);
            contour.push(validSegments[i].a.clone());
            contour.push(validSegments[i].b.clone());

            let currentHash = this._hashPoint(validSegments[i].b);
            let currentPoint = validSegments[i].b;
            const startHash = this._hashPoint(validSegments[i].a);

            // Walk the chain
            let maxSteps = validSegments.length;
            while (maxSteps-- > 0) {
                const neighbours = adjacency.get(currentHash);
                let found = false;

                if (neighbours) {
                    for (const neighbour of neighbours) {
                        if (!used.has(neighbour.index)) {
                            used.add(neighbour.index);
                            // Don't push if this closes the loop (avoids duplicate of start point)
                            if (neighbour.hash === startHash) {
                                found = true;
                                currentHash = neighbour.hash;
                                break;
                            }
                            contour.push(neighbour.point.clone());
                            currentHash = neighbour.hash;
                            currentPoint = neighbour.point;
                            found = true;
                            break;
                        }
                    }
                }

                if (currentHash === startHash) break;

                // Nearest-neighbour fallback: if adjacency chain broke,
                // find the closest unused segment endpoint and jump to it
                if (!found) {
                    let bestDist = Infinity;
                    let bestIdx = -1;
                    let bestIsA = true;

                    for (let j = 0; j < validSegments.length; j++) {
                        if (used.has(j)) continue;
                        const dA = currentPoint.distanceTo(validSegments[j].a);
                        const dB = currentPoint.distanceTo(validSegments[j].b);
                        if (dA < bestDist) { bestDist = dA; bestIdx = j; bestIsA = true; }
                        if (dB < bestDist) { bestDist = dB; bestIdx = j; bestIsA = false; }
                    }

                    if (bestIdx >= 0 && bestDist < 1.0) {
                        // Jump to nearest segment (within 1mm tolerance)
                        used.add(bestIdx);
                        const seg = validSegments[bestIdx];
                        const nextPoint = bestIsA ? seg.b : seg.a;
                        contour.push(nextPoint.clone());
                        currentHash = this._hashPoint(nextPoint);
                        currentPoint = nextPoint;
                    } else {
                        break; // No nearby segment found — end this contour
                    }
                }
            }

            if (contour.length >= 3) {
                contours.push(contour);
            }
        }

        return contours;
    }

    /**
     * Slice the mesh at all spline sample points
     * @param {Array} triangles - Array of {v0, v1, v2} triangles
     * @param {Array} splineSamples - Array of {point, tangent} from SplineEditor
     * @returns {Array} Array of slice objects {contours, point, tangent, index}
     */
    sliceAll(triangles, splineSamples) {
        const slices = [];

        for (let i = 0; i < splineSamples.length; i++) {
            const sample = splineSamples[i];
            const planePoint = sample.point;
            const planeNormal = sample.normal || sample.tangent;
            const clipPlanes = sample.clipPlanes || [];

            // Intersect all triangles with this plane
            const segments = [];
            for (const triangle of triangles) {
                const seg = this.intersectTriangle(triangle, planePoint, planeNormal);
                if (seg) {
                    // Filter against barrier clip planes
                    if (clipPlanes.length > 0) {
                        const mid = new THREE.Vector3()
                            .addVectors(seg.a, seg.b)
                            .multiplyScalar(0.5);
                        let clipped = false;
                        for (const clip of clipPlanes) {
                            // Signed distance of midpoint to clip plane
                            // Negative = behind the barrier = discard
                            const d = mid.clone().sub(clip.point).dot(clip.normal);
                            if (d < 0) {
                                clipped = true;
                                break;
                            }
                        }
                        if (clipped) continue;
                    }
                    segments.push(seg);
                }
            }

            if (segments.length === 0) continue;

            // Connect segments into contours
            const contours = this.connectSegments(segments);

            if (contours.length > 0) {
                slices.push({
                    contours,
                    point: planePoint,
                    normal: planeNormal,
                    tangent: sample.tangent,
                    distance: sample.distance,
                    index: i
                });
            }
        }

        return slices;
    }
}
