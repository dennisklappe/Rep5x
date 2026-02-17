// Contour processor for Rep5x Spline Slicer
// Handles polygon offset (walls) and line infill generation on arbitrary 3D slice planes

class ContourProcessor {
    /**
     * Build a local 2D coordinate system for a plane (initial/fallback)
     * Returns {u, v, origin} where u and v are orthogonal unit vectors in the plane
     */
    _buildPlaneCoords(planeNormal, planePoint) {
        // Choose a reference vector not parallel to the normal
        const ref = Math.abs(planeNormal.y) < 0.9
            ? new THREE.Vector3(0, 1, 0)
            : new THREE.Vector3(1, 0, 0);

        const u = new THREE.Vector3().crossVectors(planeNormal, ref).normalize();
        const v = new THREE.Vector3().crossVectors(planeNormal, u).normalize();

        return { u, v, origin: planePoint.clone() };
    }

    /**
     * Build plane coords using parallel transport from a previous frame.
     * This prevents the U/V basis from flipping abruptly when the plane
     * normal crosses the reference-vector threshold, which would cause
     * contour winding to flip and break offset/infill generation.
     */
    _buildPlaneCoordsFromPrev(planeNormal, planePoint, prevCoords) {
        if (!prevCoords) {
            return this._buildPlaneCoords(planeNormal, planePoint);
        }

        // Project previous U onto the new plane (parallel transport)
        let u = prevCoords.u.clone()
            .sub(planeNormal.clone().multiplyScalar(prevCoords.u.dot(planeNormal)));

        const uLen = u.length();
        if (uLen < 0.01) {
            // Previous U is nearly parallel to new normal — fall back
            return this._buildPlaneCoords(planeNormal, planePoint);
        }

        u.divideScalar(uLen); // normalize
        const v = new THREE.Vector3().crossVectors(planeNormal, u).normalize();

        return { u, v, origin: planePoint.clone() };
    }

    /** Project a 3D point onto the 2D plane */
    _to2D(point3D, coords) {
        const d = point3D.clone().sub(coords.origin);
        return { x: d.dot(coords.u), y: d.dot(coords.v) };
    }

    /** Project a 2D point back to 3D */
    _to3D(point2D, coords) {
        return coords.origin.clone()
            .add(coords.u.clone().multiplyScalar(point2D.x))
            .add(coords.v.clone().multiplyScalar(point2D.y));
    }

    /** Signed area of a 2D polygon (positive = CCW, negative = CW) */
    _signedArea2D(points) {
        let area = 0;
        for (let i = 0; i < points.length; i++) {
            const j = (i + 1) % points.length;
            area += points[i].x * points[j].y;
            area -= points[j].x * points[i].y;
        }
        return area / 2;
    }

    /**
     * Offset a 2D polygon inward by the given distance
     * Uses vertex bisector method with miter limit
     */
    _offsetContour2D(points, distance) {
        const N = points.length;
        if (N < 3) return [];

        const area = this._signedArea2D(points);
        if (Math.abs(area) < 1e-6) return [];

        // For CCW (positive area): inward normal points right of edge
        // For CW (negative area): inward normal points left of edge
        const sign = area > 0 ? 1 : -1;

        const offset = [];
        for (let i = 0; i < N; i++) {
            const prev = points[(i - 1 + N) % N];
            const curr = points[i];
            const next = points[(i + 1) % N];

            // Edge vectors
            const e1x = curr.x - prev.x, e1y = curr.y - prev.y;
            const e2x = next.x - curr.x, e2y = next.y - curr.y;

            // Inward normals (perpendicular, pointing inward)
            const n1x = e1y * sign, n1y = -e1x * sign;
            const n2x = e2y * sign, n2y = -e2x * sign;

            const len1 = Math.sqrt(n1x * n1x + n1y * n1y);
            const len2 = Math.sqrt(n2x * n2x + n2y * n2y);
            if (len1 < 1e-10 || len2 < 1e-10) {
                offset.push({ x: curr.x, y: curr.y });
                continue;
            }

            // Normalise
            const nn1x = n1x / len1, nn1y = n1y / len1;
            const nn2x = n2x / len2, nn2y = n2y / len2;

            // Bisector direction
            const bx = (nn1x + nn2x) / 2;
            const by = (nn1y + nn2y) / 2;
            const bLen = Math.sqrt(bx * bx + by * by);

            if (bLen < 1e-10) {
                offset.push({ x: curr.x + nn1x * distance, y: curr.y + nn1y * distance });
                continue;
            }

            // Adjust distance for the angle between edges (miter)
            const dot = nn1x * bx / bLen + nn1y * by / bLen;
            const adjustedDist = dot > 0.1 ? distance / dot : distance * 2;
            // Cap to prevent extreme offsets at sharp corners
            const finalDist = Math.min(adjustedDist, distance * 3);

            offset.push({
                x: curr.x + bx / bLen * finalDist,
                y: curr.y + by / bLen * finalDist
            });
        }

        // Validate: if area sign flipped or became tiny, offset is degenerate
        const offsetArea = this._signedArea2D(offset);
        if (Math.abs(offsetArea) < Math.abs(area) * 0.01 ||
            (offsetArea > 0) !== (area > 0)) {
            return [];
        }

        return offset;
    }

    /**
     * Generate line infill inside a 2D polygon
     * @param {Array} polygon - 2D polygon points
     * @param {number} spacing - Distance between lines
     * @param {number} angle - Infill angle in radians
     * @returns {Array} Array of {a, b} line segments in 2D
     */
    _generateLineInfill2D(polygon, spacing, angle) {
        if (polygon.length < 3 || spacing <= 0) return [];

        const cosA = Math.cos(-angle);
        const sinA = Math.sin(-angle);

        // Rotate polygon so infill lines are horizontal
        const rotated = polygon.map(p => ({
            x: p.x * cosA - p.y * sinA,
            y: p.x * sinA + p.y * cosA
        }));

        // Bounding box
        let minY = Infinity, maxY = -Infinity;
        for (const p of rotated) {
            if (p.y < minY) minY = p.y;
            if (p.y > maxY) maxY = p.y;
        }

        const lines = [];
        const cosA2 = Math.cos(angle);
        const sinA2 = Math.sin(angle);

        // Scan horizontal lines across the rotated polygon
        for (let y = minY + spacing / 2; y < maxY; y += spacing) {
            const intersections = [];

            for (let i = 0; i < rotated.length; i++) {
                const a = rotated[i];
                const b = rotated[(i + 1) % rotated.length];

                if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y)) {
                    const t = (y - a.y) / (b.y - a.y);
                    intersections.push(a.x + t * (b.x - a.x));
                }
            }

            intersections.sort((a, b) => a - b);

            // Pair intersections (enter/exit polygon)
            for (let i = 0; i + 1 < intersections.length; i += 2) {
                const ax = intersections[i], bx = intersections[i + 1];
                // Rotate back to original orientation
                lines.push({
                    a: { x: ax * cosA2 - y * sinA2, y: ax * sinA2 + y * cosA2 },
                    b: { x: bx * cosA2 - y * sinA2, y: bx * sinA2 + y * cosA2 }
                });
            }
        }

        return lines;
    }

    /**
     * Process a slice's contours into walls and infill toolpaths
     * @param {Array} contours3D - Array of 3D contour point arrays
     * @param {THREE.Vector3} planeNormal - Slice plane normal
     * @param {THREE.Vector3} planePoint - Point on the slice plane
     * @param {object} settings - {wallCount, nozzleDiameter, infillDensity}
     * @param {number} sliceIndex - For alternating infill angle
     * @param {object|null} prevCoords - Previous slice's plane coords for continuous basis
     * @returns {object} {walls, infill, coords} — coords should be passed to next slice
     */
    process(contours3D, planeNormal, planePoint, settings, sliceIndex, prevCoords = null) {
        const { wallCount, nozzleDiameter, infillDensity } = settings;
        const coords = this._buildPlaneCoordsFromPrev(planeNormal, planePoint, prevCoords);

        const allWalls = [];
        const allInfill = [];

        for (const contour3D of contours3D) {
            // Project contour to local 2D
            const contour2D = contour3D.map(p => this._to2D(p, coords));

            // Generate walls by successive inward offsets
            const walls2D = [contour2D];
            for (let w = 1; w < wallCount; w++) {
                const prev = walls2D[walls2D.length - 1];
                const offset = this._offsetContour2D(prev, nozzleDiameter);
                if (offset.length >= 3) {
                    walls2D.push(offset);
                } else {
                    break; // Can't offset further (polygon too small)
                }
            }

            // Convert walls back to 3D
            for (const wall2D of walls2D) {
                allWalls.push(wall2D.map(p => this._to3D(p, coords)));
            }

            // Generate infill inside innermost wall
            if (infillDensity > 0 && walls2D.length > 0) {
                const innerWall = walls2D[walls2D.length - 1];
                // Offset half a nozzle width inward for infill boundary
                const infillBoundary = this._offsetContour2D(innerWall, nozzleDiameter * 0.5);

                if (infillBoundary.length >= 3) {
                    const spacing = nozzleDiameter / (infillDensity / 100);
                    // Alternate 45° and -45° for cross-hatch pattern
                    const angle = (sliceIndex % 2 === 0) ? Math.PI / 4 : -Math.PI / 4;
                    const lines2D = this._generateLineInfill2D(infillBoundary, spacing, angle);

                    for (const line of lines2D) {
                        allInfill.push({
                            a: this._to3D(line.a, coords),
                            b: this._to3D(line.b, coords)
                        });
                    }
                }
            }
        }

        return { walls: allWalls, infill: allInfill, coords };
    }
}
