// Mushroom shape for Rep5x vase generator

class Mushroom extends ShapeBase {
    constructor() {
        super(
            'mushroom',
            'Organic mushroom shape demonstrating both C and B axis movements',
            'Mushroom shape demonstrates both C-axis (yaw) and B-axis (pitch) capabilities with an organic overhanging form.'
        );
    }

    getDefaultParams() {
        return {
            stemDiameter: 20,
            stemHeight: 40,
            capDiameter: 50,
            capHeight: 25
        };
    }

    getTotalHeight(params) {
        return params.stemHeight + params.capHeight;
    }

    getFilename(params) {
        return `rep5x_mushroom_stem${params.stemDiameter}x${params.stemHeight}_cap${params.capDiameter}x${params.capHeight}mm.gcode`;
    }

    /**
     * Get mushroom profile at a given progress (0-1)
     */
    getProfile(progress, stemRadius, stemHeight, capRadius, capHeight) {
        const stemBottomRadius = stemRadius * 1.4;
        const stemTopRadius = stemRadius * 0.85;
        const stemFraction = stemHeight / (stemHeight + capRadius * 2.5);

        let radius, z, tiltAngle;

        if (progress <= stemFraction) {
            // Stem section
            const t = progress / stemFraction;
            z = t * stemHeight;

            const bulge = Math.sin(t * Math.PI) * 0.08;
            radius = stemBottomRadius + (stemTopRadius - stemBottomRadius) * t;
            radius *= (1 + bulge);

            tiltAngle = t > 0.9 ? Math.PI / 2 * 0.55 * ((t - 0.9) / 0.1) : 0;
        } else {
            // Cap section
            const t = (progress - stemFraction) / (1 - stemFraction);
            const perpAngle = Math.atan2(capRadius * 0.3, capHeight * 0.35);

            if (t < 0.30) {
                // Underside - expand outward
                const p = t / 0.30;
                radius = stemTopRadius + (capRadius - stemTopRadius) * p;
                z = stemHeight + capHeight * 0.10 * p;
                tiltAngle = Math.PI / 2 * (0.55 + 0.25 * p);
            } else if (t < 0.45) {
                // Transition - curve upward
                const p = (t - 0.30) / 0.15;
                radius = capRadius - (capRadius * 0.08) * p;
                z = stemHeight + capHeight * 0.10 + capHeight * 0.20 * p;
                tiltAngle = Math.PI / 2 * 0.8 + (perpAngle - Math.PI / 2 * 0.8) * smoothstep(p);
            } else if (t < 0.65) {
                // Dome - curve inward
                const p = (t - 0.45) / 0.20;
                radius = capRadius * 0.92 - (capRadius * 0.32) * p;
                z = stemHeight + capHeight * 0.30 + capHeight * 0.30 * p;
                tiltAngle = perpAngle;
            } else {
                // Top - converge to centre
                const p = (t - 0.65) / 0.35;
                radius = capRadius * 0.6 * (1 - p * 0.85);
                z = stemHeight + capHeight * 0.60 + capHeight * 0.40 * Math.sin(p * Math.PI / 2);
                tiltAngle = perpAngle * (1 - smoothstep(p));
            }
        }

        return { radius, z, tiltAngle };
    }

    createGeometry(params) {
        const { stemDiameter, stemHeight, capDiameter, capHeight } = params;
        const stemRadius = stemDiameter / 2;
        const capRadius = capDiameter / 2;

        const geometry = new THREE.BufferGeometry();
        const vertices = [];
        const indices = [];
        const segments = 32;
        const layers = 80;

        for (let i = 0; i <= layers; i++) {
            const profile = this.getProfile(i / layers, stemRadius, stemHeight, capRadius, capHeight);
            for (let j = 0; j <= segments; j++) {
                const theta = (j / segments) * Math.PI * 2;
                vertices.push(profile.radius * Math.cos(theta), profile.z, profile.radius * Math.sin(theta));
            }
        }

        for (let i = 0; i < layers; i++) {
            for (let j = 0; j < segments; j++) {
                const a = i * (segments + 1) + j;
                const b = a + segments + 1;
                indices.push(a, b, a + 1, b, b + 1, a + 1);
            }
        }

        // Cap the top
        const lastLayerStart = layers * (segments + 1);
        const lastProfile = this.getProfile(1, stemRadius, stemHeight, capRadius, capHeight);
        const centerIndex = vertices.length / 3;
        vertices.push(0, lastProfile.z, 0);

        for (let j = 0; j < segments; j++) {
            indices.push(lastLayerStart + j, lastLayerStart + j + 1, centerIndex);
        }

        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();
        return geometry;
    }

    createPath(params) {
        const { stemDiameter, stemHeight, capDiameter, capHeight } = params;
        const stemRadius = stemDiameter / 2;
        const capRadius = capDiameter / 2;

        const pathPoints = [];
        const totalPoints = 400;

        for (let i = 0; i < totalPoints; i++) {
            const profile = this.getProfile(i / totalPoints, stemRadius, stemHeight, capRadius, capHeight);
            const angle = (i * 12) * Math.PI / 180;
            const r = profile.radius * 1.02;
            pathPoints.push(new THREE.Vector3(r * Math.cos(angle), profile.z, r * Math.sin(angle)));
        }

        // Closing spiral
        const lastProfile = this.getProfile(1, stemRadius, stemHeight, capRadius, capHeight);
        const closePoints = 90;
        const bodyEndAngle = totalPoints * 12;

        for (let i = 1; i <= closePoints; i++) {
            const t = i / closePoints;
            const angle = (bodyEndAngle + i * 12) * Math.PI / 180;
            const r = lastProfile.radius * (1 - t) * 1.02;
            pathPoints.push(new THREE.Vector3(r * Math.cos(angle), lastProfile.z, r * Math.sin(angle)));
        }

        return pathPoints;
    }

    generateGcode(params, layerHeight, speed) {
        const { stemDiameter, stemHeight, capDiameter, capHeight } = params;
        const gcode = [];
        const stemRadius = stemDiameter / 2;
        const capRadius = capDiameter / 2;
        const resolution = 100;

        const filamentArea = Math.PI * Math.pow(1.75 / 2, 2);
        const extrusionMultiplier = (layerHeight * 0.4) / filamentArea;

        gcode.push("; === MUSHROOM VASE ===");
        gcode.push(`; Stem: ${stemDiameter}mm x ${stemHeight}mm`);
        gcode.push(`; Cap: ${capDiameter}mm x ${capHeight}mm`);

        let prevPos = null;
        let totalAngle = 0;

        // Helper to add G-code line
        const addMove = (x, y, z, C, B, isFirst, speedMult = 1) => {
            let deltaE = 0;
            const pos = { x, y, z };
            if (prevPos) deltaE = distance3D(pos, prevPos) * extrusionMultiplier;

            if (isFirst) {
                gcode.push(`G0 X${x.toFixed(3)} Y${y.toFixed(3)} Z${z.toFixed(3)} C${C.toFixed(3)} B${B.toFixed(3)}`);
            } else {
                gcode.push(`G1 X${x.toFixed(3)} Y${y.toFixed(3)} Z${z.toFixed(3)} C${C.toFixed(3)} B${B.toFixed(3)} E${deltaE.toFixed(4)} F${Math.round(speed * speedMult)}`);
            }
            prevPos = pos;
        };

        // Stem
        gcode.push("", "; === STEM ===");
        const stemRotations = stemHeight / layerHeight;
        const stemSegments = Math.round(stemRotations * resolution);
        const stemBottomRadius = stemRadius * 1.4;
        const stemTopRadius = stemRadius * 0.85;

        for (let i = 0; i <= stemSegments; i++) {
            const t = i / stemSegments;
            const angle = totalAngle + (i / resolution) * 2 * Math.PI;
            const z = t * stemHeight;

            const bulge = Math.sin(t * Math.PI) * 0.08;
            let radius = stemBottomRadius + (stemTopRadius - stemBottomRadius) * t;
            radius *= (1 + bulge);

            const x = radius * Math.cos(angle);
            const y = radius * Math.sin(angle);

            let tiltAngle = 0, aOffset = 0, bSign = 1;
            if (t > 0.9) {
                const p = (t - 0.9) / 0.1;
                tiltAngle = Math.PI / 2 * 0.55 * p;
                aOffset = 180 * p;
                bSign = 1 - 2 * p;
            }

            addMove(x, y, z, -angle * 180 / Math.PI + aOffset, bSign * tiltAngle * 180 / Math.PI, i === 0);
        }
        totalAngle += stemRotations * 2 * Math.PI;

        // Cap
        gcode.push("", "; === CAP ===");
        const capLength = capRadius * 2.5;
        const capRotations = capLength / layerHeight;
        const capSegments = Math.round(capRotations * resolution);

        for (let i = 1; i <= capSegments; i++) {
            const t = i / capSegments;
            const angle = totalAngle + (i / resolution) * 2 * Math.PI;
            const perpAngle = Math.atan2(capRadius * 0.3, capHeight * 0.35);

            let radius, z, tiltAngle;
            if (t < 0.30) {
                // Underside - expand outward
                const p = t / 0.30;
                radius = stemTopRadius + (capRadius - stemTopRadius) * p;
                z = stemHeight + capHeight * 0.10 * p;
                tiltAngle = Math.PI / 2 * (0.55 + 0.25 * p);
            } else if (t < 0.45) {
                // Transition - curve upward
                const p = (t - 0.30) / 0.15;
                radius = capRadius - (capRadius * 0.08) * p;
                z = stemHeight + capHeight * 0.10 + capHeight * 0.20 * p;
                tiltAngle = Math.PI / 2 * 0.8 + (perpAngle - Math.PI / 2 * 0.8) * smoothstep(p);
            } else if (t < 0.65) {
                // Dome - curve inward
                const p = (t - 0.45) / 0.20;
                radius = capRadius * 0.92 - (capRadius * 0.32) * p;
                z = stemHeight + capHeight * 0.30 + capHeight * 0.30 * p;
                tiltAngle = perpAngle;
            } else {
                // Top - converge to centre
                const p = (t - 0.65) / 0.35;
                radius = capRadius * 0.6 * (1 - p * 0.85);
                z = stemHeight + capHeight * 0.60 + capHeight * 0.40 * Math.sin(p * Math.PI / 2);
                tiltAngle = perpAngle * (1 - smoothstep(p));
            }

            const x = radius * Math.cos(angle);
            const y = radius * Math.sin(angle);
            const baseC = -angle * 180 / Math.PI;
            const baseBdeg = tiltAngle * 180 / Math.PI;

            let C, B;
            if (t < 0.33) {
                C = baseC + 180;
                B = -baseBdeg;
            } else if (t < 0.43) {
                // B-axis flip
                C = baseC + 180;
                B = baseBdeg * (2 * smoothstep((t - 0.33) / 0.10) - 1);
            } else if (t < 0.85) {
                C = baseC + 180;
                B = baseBdeg;
            } else {
                C = baseC + 180 * (1 - smoothstep((t - 0.85) / 0.15));
                B = baseBdeg;
            }

            const inCriticalZone = t >= 0.30 && t < 0.65;
            addMove(x, y, z, C, B, false, inCriticalZone ? 0.35 : 0.6);
        }
        totalAngle += capRotations * 2 * Math.PI;

        // Closing spiral
        gcode.push("", "; === CLOSING ===");
        const lastProfile = this.getProfile(1, stemRadius, stemHeight, capRadius, capHeight);
        const closeRotations = Math.max(3, lastProfile.radius / layerHeight);
        const closeSegments = Math.round(closeRotations * resolution);

        for (let i = 1; i <= closeSegments; i++) {
            const t = i / closeSegments;
            const angle = totalAngle + (i / resolution) * 2 * Math.PI;
            const radius = lastProfile.radius * (1 - t);

            addMove(radius * Math.cos(angle), radius * Math.sin(angle), lastProfile.z, -angle * 180 / Math.PI, 0, false, 0.4);
        }

        return gcode;
    }
}

// Legacy function wrappers for backwards compatibility
function createMushroom(stemRadius, stemHeight, capRadius, capHeight) {
    const shape = new Mushroom();
    return shape.createGeometry({
        stemDiameter: stemRadius * 2,
        stemHeight,
        capDiameter: capRadius * 2,
        capHeight
    });
}

function createMushroomPath(stemRadius, stemHeight, capRadius, capHeight) {
    const shape = new Mushroom();
    return shape.createPath({
        stemDiameter: stemRadius * 2,
        stemHeight,
        capDiameter: capRadius * 2,
        capHeight
    });
}

function generateMushroomGcode(stemDiameter, stemHeight, capDiameter, capHeight, layerHeight, speed) {
    const shape = new Mushroom();
    return shape.generateGcode(
        { stemDiameter, stemHeight, capDiameter, capHeight },
        layerHeight,
        speed
    );
}
