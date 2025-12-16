// Elbow pipe shape for Rep5x vase generator

// Calculate distance between two points
function distance3D(p1, p2) {
    return Math.sqrt(
        Math.pow(p1.x - p2.x, 2) +
        Math.pow(p1.y - p2.y, 2) +
        Math.pow(p1.z - p2.z, 2)
    );
}

// Get elbow pipe centerline position and tangent at given distance along path
function getElbowProfile(distance, L1, R, theta, L2) {
    const curveLength = R * theta;

    if (distance <= L1) {
        // Vertical section
        return {
            center: { x: 0, y: distance },
            tangent: { x: 0, y: 1 }
        };
    } else if (distance <= L1 + curveLength) {
        // Curved elbow section
        const alpha = (distance - L1) / R;
        return {
            center: {
                x: R - R * Math.cos(alpha),
                y: L1 + R * Math.sin(alpha)
            },
            tangent: {
                x: Math.sin(alpha),
                y: Math.cos(alpha)
            },
            alpha
        };
    } else {
        // Angled section after elbow
        const s = distance - L1 - curveLength;
        return {
            center: {
                x: R - R * Math.cos(theta) + s * Math.sin(theta),
                y: L1 + R * Math.sin(theta) + s * Math.cos(theta)
            },
            tangent: {
                x: Math.sin(theta),
                y: Math.cos(theta)
            }
        };
    }
}

// Create Three.js geometry for preview
function createElbowPipe(radius, verticalHeight, horizontalLength, bendAngle = 90) {
    const geometry = new THREE.BufferGeometry();
    const vertices = [];
    const indices = [];
    const segments = 32;

    const L1 = verticalHeight;
    const L2 = horizontalLength;
    const theta = bendAngle * Math.PI / 180;
    const R = radius * 1.5;

    const totalLength = L1 + R * theta + L2;
    const layers = Math.max(50, Math.floor(totalLength / 2));

    for (let i = 0; i <= layers; i++) {
        const distance = (i / layers) * totalLength;
        const profile = getElbowProfile(distance, L1, R, theta, L2);

        const normalX = -profile.tangent.y;
        const normalY = profile.tangent.x;

        for (let j = 0; j <= segments; j++) {
            const angle = (j / segments) * Math.PI * 2;
            const cosA = Math.cos(angle);
            const sinA = Math.sin(angle);

            vertices.push(
                profile.center.x + radius * cosA * normalX,
                profile.center.y + radius * cosA * normalY,
                radius * sinA
            );
        }
    }

    for (let i = 0; i < layers; i++) {
        for (let j = 0; j < segments; j++) {
            const a = i * (segments + 1) + j;
            const b = a + segments + 1;
            indices.push(a, b, a + 1, b, b + 1, a + 1);
        }
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
}

// Generate G-code for printing
function generateElbowPipeGcode(diameter, verticalHeight, horizontalLength, layerHeight, speed, bendAngle) {
    const gcode = [];
    const pipeRadius = diameter / 2;
    const L1 = verticalHeight;
    const R = diameter;
    const theta = bendAngle * Math.PI / 180;
    const L2 = horizontalLength;
    const resolution = 100;

    let prevPos = null;
    let totalSpiralAngle = 0;

    // Helper to add G-code line
    function addMove(x, y, z, A, B, isFirst, speedMult = 1) {
        const pos = { x, y, z };
        const deltaE = prevPos ? distance3D(pos, prevPos) * 0.05 : 0;

        if (isFirst) {
            gcode.push(`G0 X${x.toFixed(3)} Y${y.toFixed(3)} Z${z.toFixed(3)} A${A.toFixed(3)} B${B.toFixed(3)} ; move to start`);
        } else {
            gcode.push(`G1 X${x.toFixed(3)} Y${y.toFixed(3)} Z${z.toFixed(3)} A${A.toFixed(3)} B${B.toFixed(3)} E${deltaE.toFixed(4)} F${Math.round(speed * speedMult)}`);
        }
        prevPos = pos;
    }

    // SECTION 1: Vertical part
    const rotations1 = L1 / layerHeight;
    const segments1 = Math.round(rotations1 * resolution);

    gcode.push("; === SECTION 1: Vertical ===");
    gcode.push(`; Segments: ${segments1}, Rotations: ${rotations1.toFixed(2)}`);

    for (let i = 0; i <= segments1; i++) {
        const t = segments1 > 0 ? i / segments1 : 0;
        const z = t * L1;
        const spiralAngle = totalSpiralAngle + (i / resolution) * 2 * Math.PI;

        addMove(
            pipeRadius * Math.cos(spiralAngle),
            pipeRadius * Math.sin(spiralAngle),
            z, 0, 0, i === 0
        );
    }
    totalSpiralAngle += rotations1 * 2 * Math.PI;

    // SECTION 2: Elbow curve
    const arcLength = R * theta;
    const rotations2 = arcLength / layerHeight;
    const segments2 = Math.round(rotations2 * resolution);

    gcode.push("", "; === SECTION 2: Elbow Curve ===");
    gcode.push(`; Arc length: ${arcLength.toFixed(2)}mm, Segments: ${segments2}, Rotations: ${rotations2.toFixed(2)}`);

    for (let i = 0; i <= segments2; i++) {
        const t = segments2 > 0 ? i / segments2 : 0;
        const alpha = t * theta;
        const spiralAngle = totalSpiralAngle + (i / resolution) * 2 * Math.PI;

        const centerX = R - R * Math.cos(alpha);
        const centerZ = L1 + R * Math.sin(alpha);

        const binormalX = Math.cos(alpha);
        const binormalZ = -Math.sin(alpha);

        const offsetY = pipeRadius * Math.sin(spiralAngle);
        const offsetBinormal = pipeRadius * Math.cos(spiralAngle);

        addMove(
            centerX + offsetBinormal * binormalX,
            offsetY,
            centerZ + offsetBinormal * binormalZ,
            0, alpha * 180 / Math.PI, false, 0.8
        );
    }
    totalSpiralAngle += rotations2 * 2 * Math.PI;

    // SECTION 3: Angled section after elbow
    const rotations3 = L2 / layerHeight;
    const segments3 = Math.round(rotations3 * resolution);
    const BFinal = theta * 180 / Math.PI;

    gcode.push("", "; === SECTION 3: Angled Section ===");
    gcode.push(`; Segments: ${segments3}, Rotations: ${rotations3.toFixed(2)}`);

    const binormalX = Math.cos(theta);
    const binormalZ = -Math.sin(theta);

    for (let i = 0; i <= segments3; i++) {
        const t = segments3 > 0 ? i / segments3 : 0;
        const s = t * L2;
        const spiralAngle = totalSpiralAngle + (i / resolution) * 2 * Math.PI;

        const centerX = R - R * Math.cos(theta) + s * Math.sin(theta);
        const centerZ = L1 + R * Math.sin(theta) + s * Math.cos(theta);

        const offsetY = pipeRadius * Math.sin(spiralAngle);
        const offsetBinormal = pipeRadius * Math.cos(spiralAngle);

        addMove(
            centerX + offsetBinormal * binormalX,
            offsetY,
            centerZ + offsetBinormal * binormalZ,
            0, BFinal, false
        );
    }

    return gcode;
}

// Create path for animation preview
function createElbowPipePath(radius, verticalHeight, horizontalLength, bendAngle = 90) {
    const pathPoints = [];
    const pathRadius = radius * 1.05;

    const L1 = verticalHeight;
    const L2 = horizontalLength;
    const theta = bendAngle * Math.PI / 180;
    const R = radius * 1.5;

    const totalLength = L1 + R * theta + L2;
    const totalPoints = 300;

    for (let i = 0; i < totalPoints; i++) {
        const distance = (i / totalPoints) * totalLength;
        const spiralAngle = (i * 10) * Math.PI / 180;
        const profile = getElbowProfile(distance, L1, R, theta, L2);

        const normalX = -profile.tangent.y;
        const normalY = profile.tangent.x;

        pathPoints.push(new THREE.Vector3(
            profile.center.x + pathRadius * Math.cos(spiralAngle) * normalX,
            profile.center.y + pathRadius * Math.cos(spiralAngle) * normalY,
            pathRadius * Math.sin(spiralAngle)
        ));
    }

    return pathPoints;
}
