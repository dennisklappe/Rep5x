// Mushroom shape implementation for Rep5x vase generator
// Demonstrates both A-axis (yaw) and B-axis (pitch) movements
// Organic mushroom: tapered stem, cap goes outward then curves up and inward to rounded top

// Helper function to get mushroom profile at a given height progress
function getMushroomProfile(progress, stemRadius, stemHeight, capRadius, capHeight) {
    const stemBottomRadius = stemRadius * 1.4;  // Wider base
    const stemTopRadius = stemRadius * 0.85;    // Narrower at top of stem

    // Total path: stem then cap
    const stemLength = stemHeight;
    const capLength = capRadius * 2.5;  // Cap needs more path length for the curve
    const totalLength = stemLength + capLength;
    const stemFraction = stemLength / totalLength;

    let radius, z, tiltAngle;

    if (progress <= stemFraction) {
        // STEM: tapered cylinder with slight organic bulge
        const stemProgress = progress / stemFraction;
        z = stemProgress * stemHeight;

        // Slight bulge in middle for organic look
        const bulge = Math.sin(stemProgress * Math.PI) * 0.08;
        radius = stemBottomRadius + (stemTopRadius - stemBottomRadius) * stemProgress;
        radius *= (1 + bulge);

        // Gradual tilt at end of stem to transition smoothly into cap
        if (stemProgress > 0.9) {
            const transitionT = (stemProgress - 0.9) / 0.1;  // 0 to 1 over last 10%
            tiltAngle = Math.PI / 2 * 0.55 * transitionT;  // 0 to ~50° to match cap start
        } else {
            tiltAngle = 0;  // Vertical nozzle for most of stem
        }
    } else {
        // CAP: goes outward horizontally, then curves up and inward to center
        const capProgress = (progress - stemFraction) / (1 - stemFraction);

        if (capProgress < 0.35) {
            // Phase 1: Go outward almost horizontally (like underside of mushroom cap)
            const t = capProgress / 0.35;

            // Radius expands from stem to full cap width
            radius = stemTopRadius + (capRadius - stemTopRadius) * t;

            // Height rises very slightly - almost flat/horizontal
            z = stemHeight + capHeight * 0.1 * t;

            // Nozzle tilts inward (positive B) to be parallel with the layers
            // Cap underside is nearly horizontal, so nozzle needs significant tilt
            tiltAngle = Math.PI / 2 * (0.55 + 0.25 * t);  // Start ~50°, ease to ~72°

        } else if (capProgress < 0.7) {
            // Phase 2: Curve upward while coming back inward
            const t = (capProgress - 0.35) / 0.35;

            // Radius starts decreasing - coming back inward
            const prevRadius = capRadius;
            radius = capRadius - (capRadius * 0.4) * t;

            // Height increases - going up
            const prevZ = stemHeight + capHeight * 0.1;
            z = stemHeight + capHeight * 0.1 + capHeight * 0.6 * Math.pow(t, 0.7);

            // Calculate surface angle - nozzle perpendicular to surface, pointing outward
            // Surface goes inward and up, so nozzle tilts inward (negative)
            const dRadius = -capRadius * 0.4;  // Change in radius (negative = inward)
            const dZ = capHeight * 0.6;  // Change in height
            // Surface angle from vertical: negative because curving inward
            tiltAngle = -Math.atan2(-dRadius, dZ) * 0.8;  // Tilt inward, slightly reduced

        } else {
            // Phase 3: Final curve inward to rounded top center
            const t = (capProgress - 0.7) / 0.3;

            // Radius converges toward center
            const startRadius = capRadius * 0.6;
            radius = startRadius * (1 - t * 0.85);

            // Height reaches peak with rounded top
            z = stemHeight + capHeight * 0.7 + capHeight * 0.3 * Math.sin(t * Math.PI / 2);

            // Nozzle perpendicular to dome surface, pointing outward (inward tilt)
            // As we approach the top center, surface becomes more horizontal
            const surfaceAngle = Math.atan2(startRadius * 0.85, capHeight * 0.3) * (1 - t);
            tiltAngle = -surfaceAngle * 0.7;  // Negative = tilting inward
        }
    }

    return { radius, z, tiltAngle };
}

function createMushroom(stemRadius, stemHeight, capRadius, capHeight) {
    const geometry = new THREE.BufferGeometry();
    const vertices = [];
    const indices = [];
    const segments = 32;
    const layers = 80;

    // Generate mushroom body
    for (let i = 0; i <= layers; i++) {
        const progress = i / layers;
        const profile = getMushroomProfile(progress, stemRadius, stemHeight, capRadius, capHeight);

        for (let j = 0; j <= segments; j++) {
            const theta = (j / segments) * Math.PI * 2;
            const x = profile.radius * Math.cos(theta);
            const y = profile.radius * Math.sin(theta);
            vertices.push(x, profile.z, y);
        }
    }

    // Create faces for mushroom body
    for (let i = 0; i < layers; i++) {
        for (let j = 0; j < segments; j++) {
            const a = i * (segments + 1) + j;
            const b = a + segments + 1;
            indices.push(a, b, a + 1);
            indices.push(b, b + 1, a + 1);
        }
    }

    // Add closed top - converge to center point
    const lastLayerStart = layers * (segments + 1);
    const lastProfile = getMushroomProfile(1, stemRadius, stemHeight, capRadius, capHeight);

    // Add center point at top
    const centerIndex = vertices.length / 3;
    vertices.push(0, lastProfile.z, 0);

    // Connect last layer to center
    for (let j = 0; j < segments; j++) {
        const a = lastLayerStart + j;
        indices.push(a, a + 1, centerIndex);
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    return geometry;
}

// Generate G-code for mushroom shape
function generateMushroomGcode(stemDiameter, stemHeight, capDiameter, capHeight, layerHeight, speed) {
    const gcode = [];
    const stemRadius = stemDiameter / 2;
    const capRadius = capDiameter / 2;

    const stemBottomRadius = stemRadius * 1.4;  // Match the stem base width

    const resolution = 100;
    let prevPos = null;

    // Extrusion calculation: E = (layer_height * line_width * distance) / filament_area
    // For 1.75mm filament: area = π * 0.875² ≈ 2.405
    // Assuming line_width ≈ 0.4mm (nozzle diameter)
    const filamentArea = Math.PI * Math.pow(1.75 / 2, 2);
    const lineWidth = 0.4;
    const extrusionMultiplier = (layerHeight * lineWidth) / filamentArea;  // ~0.033 for 0.2mm layer

    gcode.push("; === MUSHROOM VASE ===");
    gcode.push(`; Stem: ${stemDiameter}mm x ${stemHeight}mm`);
    gcode.push(`; Cap: ${capDiameter}mm x ${capHeight}mm`);

    // === FLOOR: Spiral outward from center ===
    // NOTE: Floor commented out - starting with wall directly
    // gcode.push("");
    // gcode.push("; === FLOOR ===");
    //
    // const floorRotations = Math.max(3, stemBottomRadius / layerHeight);
    // const floorSegments = Math.round(floorRotations * resolution);
    //
    // // Start floor spiral from a minimum radius to avoid tiny movements at center
    // const minFloorRadius = 10;  // 10mm hole in center
    //
    // for (let i = 0; i <= floorSegments; i++) {
    //     const t = i / floorSegments;
    //     const spiralAngle = (i / resolution) * 2 * Math.PI;
    //
    //     // Spiral outward from minimum radius to stem base radius
    //     const floorRadius = minFloorRadius + (stemBottomRadius - minFloorRadius) * t;
    //     const x = floorRadius * Math.cos(spiralAngle);
    //     const y = floorRadius * Math.sin(spiralAngle);
    //     const z = layerHeight;  // First layer height
    //
    //     const A = spiralAngle * 180 / Math.PI;  // Continuous rotation - optimizer will add G92 resets if enabled
    //     const B = 0;  // Vertical nozzle for floor
    //
    //     let deltaE = 0;
    //     if (prevPos) {
    //         const distance = Math.sqrt(
    //             Math.pow(x - prevPos.x, 2) +
    //             Math.pow(y - prevPos.y, 2) +
    //             Math.pow(z - prevPos.z, 2)
    //         );
    //         deltaE = distance * extrusionMultiplier;
    //     }
    //
    //     if (i === 0) {
    //         gcode.push(`G1 X${x.toFixed(3)} Y${y.toFixed(3)} Z${z.toFixed(3)} A${A.toFixed(3)} B${B.toFixed(3)} E0 F${speed} ; move to center`);
    //     } else {
    //         gcode.push(`G1 X${x.toFixed(3)} Y${y.toFixed(3)} Z${z.toFixed(3)} A${A.toFixed(3)} B${B.toFixed(3)} E${deltaE.toFixed(4)} F${speed}`);
    //     }
    //
    //     prevPos = { x, y, z };
    // }

    // === STEM SECTION ===
    gcode.push("");
    gcode.push("; === STEM ===");

    // Calculate stem segment count based on layer height
    const stemRotations = stemHeight / layerHeight;
    const stemSegments = Math.round(stemRotations * resolution);
    let totalSpiralAngle = 0;

    gcode.push(`; Segments: ${stemSegments}, Rotations: ${stemRotations.toFixed(2)}`);

    for (let i = 0; i <= stemSegments; i++) {
        const progress = i / stemSegments;
        const spiralAngle = totalSpiralAngle + (i / resolution) * 2 * Math.PI;

        // Calculate stem profile at this progress
        const stemProgress = progress;
        const z = stemProgress * stemHeight;

        // Slight bulge in middle for organic look
        const bulge = Math.sin(stemProgress * Math.PI) * 0.08;
        let radius = stemBottomRadius + (stemRadius * 0.85 - stemBottomRadius) * stemProgress;
        radius *= (1 + bulge);

        const x = radius * Math.cos(spiralAngle);
        const y = radius * Math.sin(spiralAngle);

        // Gradual tilt at end of stem to transition smoothly into cap
        let tiltAngle = 0;
        if (stemProgress > 0.9) {
            const transitionT = (stemProgress - 0.9) / 0.1;  // 0 to 1 over last 10%
            tiltAngle = Math.PI / 2 * 0.55 * transitionT;  // 0 to ~50° to match cap start
        }

        const A = -spiralAngle * 180 / Math.PI;
        const B = tiltAngle * 180 / Math.PI;

        let deltaE = 0;
        if (prevPos) {
            const distance = Math.sqrt(
                Math.pow(x - prevPos.x, 2) +
                Math.pow(y - prevPos.y, 2) +
                Math.pow(z - prevPos.z, 2)
            );
            deltaE = distance * extrusionMultiplier;
        }

        if (i === 0) {
            gcode.push(`G0 X${x.toFixed(3)} Y${y.toFixed(3)} Z${z.toFixed(3)} A${A.toFixed(3)} B${B.toFixed(3)} ; move to start`);
        } else {
            gcode.push(`G1 X${x.toFixed(3)} Y${y.toFixed(3)} Z${z.toFixed(3)} A${A.toFixed(3)} B${B.toFixed(3)} E${deltaE.toFixed(4)} F${speed}`);
        }

        prevPos = { x, y, z };
    }

    totalSpiralAngle += stemRotations * 2 * Math.PI;

    // === CAP SECTION ===
    gcode.push("");
    gcode.push("; === CAP ===");

    // Cap path length and segments
    const capLength = capRadius * 2.5;
    const capRotations = capLength / layerHeight;
    const capSegments = Math.round(capRotations * resolution);

    gcode.push(`; Cap length: ${capLength.toFixed(2)}mm, Segments: ${capSegments}, Rotations: ${capRotations.toFixed(2)}`);

    for (let i = 0; i <= capSegments; i++) {
        const capProgress = i / capSegments;
        const spiralAngle = totalSpiralAngle + (i / resolution) * 2 * Math.PI;

        let radius, z, tiltAngle;

        if (capProgress < 0.35) {
            // Phase 1: Go outward almost horizontally (underside of mushroom cap)
            const t = capProgress / 0.35;
            const stemTopRadius = stemRadius * 0.85;
            radius = stemTopRadius + (capRadius - stemTopRadius) * t;
            z = stemHeight + capHeight * 0.1 * t;
            tiltAngle = Math.PI / 2 * (0.55 + 0.25 * t);

        } else if (capProgress < 0.7) {
            // Phase 2: Curve upward while coming back inward
            const t = (capProgress - 0.35) / 0.35;
            radius = capRadius - (capRadius * 0.4) * t;
            z = stemHeight + capHeight * 0.1 + capHeight * 0.6 * Math.pow(t, 0.7);
            const dRadius = -capRadius * 0.4;
            const dZ = capHeight * 0.6;
            tiltAngle = -Math.atan2(-dRadius, dZ) * 0.8;

        } else {
            // Phase 3: Final curve inward to rounded top center
            const t = (capProgress - 0.7) / 0.3;
            const startRadius = capRadius * 0.6;
            radius = startRadius * (1 - t * 0.85);
            z = stemHeight + capHeight * 0.7 + capHeight * 0.3 * Math.sin(t * Math.PI / 2);
            const surfaceAngle = Math.atan2(startRadius * 0.85, capHeight * 0.3) * (1 - t);
            tiltAngle = -surfaceAngle * 0.7;
        }

        const x = radius * Math.cos(spiralAngle);
        const y = radius * Math.sin(spiralAngle);

        const A = -spiralAngle * 180 / Math.PI;
        const B = tiltAngle * 180 / Math.PI;

        let deltaE = 0;
        if (prevPos) {
            const distance = Math.sqrt(
                Math.pow(x - prevPos.x, 2) +
                Math.pow(y - prevPos.y, 2) +
                Math.pow(z - prevPos.z, 2)
            );
            deltaE = distance * extrusionMultiplier;
        }

        // Slow down for cap (more complex movements)
        gcode.push(`G1 X${x.toFixed(3)} Y${y.toFixed(3)} Z${z.toFixed(3)} A${A.toFixed(3)} B${B.toFixed(3)} E${deltaE.toFixed(4)} F${Math.round(speed * 0.6)}`);

        prevPos = { x, y, z };
    }

    totalSpiralAngle += capRotations * 2 * Math.PI;

    // Close at top - spiral inward to center
    gcode.push("");
    gcode.push("; === CLOSING TOP ===");

    const lastProfile = getMushroomProfile(1, stemRadius, stemHeight, capRadius, capHeight);

    // Calculate how many segments needed to spiral from current radius to center
    // More rotations for a proper fill
    const closeStartRadius = lastProfile.radius;
    const closeRotations = Math.max(3, closeStartRadius / layerHeight);  // At least 3 full rotations
    const closeSegments = Math.round(closeRotations * resolution);

    gcode.push(`; Close rotations: ${closeRotations.toFixed(2)}`);

    for (let i = 1; i <= closeSegments; i++) {
        const t = i / closeSegments;
        const spiralAngle = totalSpiralAngle + (i / resolution) * 2 * Math.PI;

        // Spiral inward to center - goes all the way to 0
        const closingRadius = closeStartRadius * (1 - t);
        const x = closingRadius * Math.cos(spiralAngle);
        const y = closingRadius * Math.sin(spiralAngle);
        const z = lastProfile.z;

        const A = -spiralAngle * 180 / Math.PI;
        const B = 0;  // Vertical nozzle for closing

        let deltaE = 0;
        if (prevPos) {
            const distance = Math.sqrt(
                Math.pow(x - prevPos.x, 2) +
                Math.pow(y - prevPos.y, 2) +
                Math.pow(z - prevPos.z, 2)
            );
            deltaE = distance * extrusionMultiplier;
        }

        gcode.push(`G1 X${x.toFixed(3)} Y${y.toFixed(3)} Z${z.toFixed(3)} A${A.toFixed(3)} B${B.toFixed(3)} E${deltaE.toFixed(4)} F${Math.round(speed * 0.4)}`);
        prevPos = { x, y, z };
    }

    return gcode;
}

// Create print path visualization for mushroom
function createMushroomPath(stemRadius, stemHeight, capRadius, capHeight) {
    const pathPoints = [];

    // NOTE: Floor commented out - starting with wall directly
    // const stemBottomRadius = stemRadius * 1.4;
    // const minFloorRadius = 10;  // Match G-code generation
    //
    // // Floor spiral - outward from minimum radius (hole in center)
    // const floorPoints = 90;  // 3 rotations
    // for (let i = 0; i <= floorPoints; i++) {
    //     const t = i / floorPoints;
    //     const spiralAngle = (i * 12) * Math.PI / 180;
    //
    //     const floorRadius = (minFloorRadius + (stemBottomRadius - minFloorRadius) * t) * 1.02;
    //     const x = floorRadius * Math.cos(spiralAngle);
    //     const y = floorRadius * Math.sin(spiralAngle);
    //
    //     pathPoints.push(new THREE.Vector3(x, 0, y));
    // }

    // Main mushroom body
    const totalPoints = 400;
    const floorEndAngle = 0;  // No floor, start from angle 0

    for (let i = 0; i < totalPoints; i++) {
        const progress = i / totalPoints;
        const spiralAngle = (floorEndAngle + i * 12) * Math.PI / 180;

        const profile = getMushroomProfile(progress, stemRadius, stemHeight, capRadius, capHeight);
        const displayRadius = profile.radius * 1.02;

        const x = displayRadius * Math.cos(spiralAngle);
        const y = displayRadius * Math.sin(spiralAngle);

        pathPoints.push(new THREE.Vector3(x, profile.z, y));
    }

    // Closing spiral at top - more rotations to fully close
    const lastProfile = getMushroomProfile(1, stemRadius, stemHeight, capRadius, capHeight);
    const startRadius = lastProfile.radius;
    const closeRotations = 3;
    const closePoints = closeRotations * 30;
    const bodyEndAngle = floorEndAngle + totalPoints * 12;

    for (let i = 1; i <= closePoints; i++) {
        const t = i / closePoints;
        const spiralAngle = (bodyEndAngle + i * 12) * Math.PI / 180;

        const closingRadius = startRadius * (1 - t) * 1.02;
        const x = closingRadius * Math.cos(spiralAngle);
        const y = closingRadius * Math.sin(spiralAngle);

        pathPoints.push(new THREE.Vector3(x, lastProfile.z, y));
    }

    return pathPoints;
}
