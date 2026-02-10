// Mesh slicer for Rep5x Spline Slicer - triangle-plane intersection and contour extraction

class MeshSlicer {
    constructor() {
        this.HASH_PRECISION = 5;
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
        } else if (Math.abs(da) < 1e-10 && Math.abs(db) > 1e-10) {
            intersections.push(va.clone());
        } else if (Math.abs(db) < 1e-10 && Math.abs(da) > 1e-10) {
            intersections.push(vb.clone());
        }
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
     * Connect line segments into ordered contours
     * @param {Array} segments - Array of {a, b} segments
     * @returns {Array} Array of contours (each contour is an array of THREE.Vector3)
     */
    connectSegments(segments) {
        if (segments.length === 0) return [];

        // Build adjacency map
        const adjacency = new Map();
        for (let i = 0; i < segments.length; i++) {
            const seg = segments[i];
            const hashA = this._hashPoint(seg.a);
            const hashB = this._hashPoint(seg.b);

            if (!adjacency.has(hashA)) adjacency.set(hashA, []);
            if (!adjacency.has(hashB)) adjacency.set(hashB, []);

            adjacency.get(hashA).push({ point: seg.b, hash: hashB, index: i });
            adjacency.get(hashB).push({ point: seg.a, hash: hashA, index: i });
        }

        const used = new Set();
        const contours = [];

        for (let i = 0; i < segments.length; i++) {
            if (used.has(i)) continue;

            const contour = [];
            used.add(i);
            contour.push(segments[i].a.clone());
            contour.push(segments[i].b.clone());

            let currentHash = this._hashPoint(segments[i].b);
            const startHash = this._hashPoint(segments[i].a);

            // Walk the chain
            let maxSteps = segments.length;
            while (maxSteps-- > 0) {
                const neighbours = adjacency.get(currentHash);
                if (!neighbours) break;

                let found = false;
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
                        found = true;
                        break;
                    }
                }

                if (!found || currentHash === startHash) break;
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
