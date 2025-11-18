// Clean elbow pipe implementation based on algebraic formulas
function createElbowPipe(radius, verticalHeight, horizontalLength, bendAngle = 90) {
    const geometry = new THREE.BufferGeometry();
    const vertices = [];
    const indices = [];
    const segments = 32; // Cross-section segments
    
    // Parameters
    const L1 = verticalHeight;  // Vertical section length
    const L2 = horizontalLength; // Horizontal section length
    const theta = bendAngle * Math.PI / 180; // Convert to radians
    const R = radius * 1.5; // Elbow curve radius (1.5x pipe radius for smooth bend)
    
    // Calculate total path length
    const verticalLength = L1;
    const curveLength = R * theta; // Arc length
    const angledLength = L2;
    const totalLength = verticalLength + curveLength + angledLength;
    
    // Number of layers along the pipe
    const layers = Math.max(50, Math.floor(totalLength / 2));
    
    // Generate vertices layer by layer
    for (let i = 0; i <= layers; i++) {
        const progress = i / layers;
        const distance = progress * totalLength;
        
        let centerX, centerY, centerZ = 0;
        let tangentX, tangentY; // Tangent direction for pipe orientation
        
        if (distance <= L1) {
            // SECTION 1: Vertical part
            const t = distance;
            centerX = 0;
            centerY = t;
            tangentX = 0;
            tangentY = 1; // Going up
            
        } else if (distance <= L1 + curveLength) {
            // SECTION 2: Curved elbow
            const arcDistance = distance - L1;
            const alpha = arcDistance / R; // Angle along the curve
            
            // Center of curve is at (R, L1)
            centerX = R - R * Math.cos(alpha);
            centerY = L1 + R * Math.sin(alpha);
            
            // Tangent direction (derivative of curve)
            tangentX = Math.sin(alpha);
            tangentY = Math.cos(alpha);
            
        } else {
            // SECTION 3: Angled section after elbow
            const s = distance - L1 - curveLength;
            
            centerX = R - R * Math.cos(theta) + s * Math.sin(theta);
            centerY = L1 + R * Math.sin(theta) + s * Math.cos(theta);
            
            // Tangent direction (final direction)
            tangentX = Math.sin(theta);
            tangentY = Math.cos(theta);
        }
        
        // Create circular cross-section perpendicular to tangent
        // Normal to tangent in 2D: rotate tangent by 90°
        const normalX = -tangentY;
        const normalY = tangentX;
        
        for (let j = 0; j <= segments; j++) {
            const angle = (j / segments) * Math.PI * 2;
            const cosA = Math.cos(angle);
            const sinA = Math.sin(angle);
            
            // Circle in the plane perpendicular to pipe direction
            const x = centerX + radius * cosA * normalX;
            const y = centerY + radius * cosA * normalY;
            const z = centerZ + radius * sinA; // Z component of circle
            
            vertices.push(x, y, z);
        }
    }
    
    // Create faces connecting the layers
    for (let i = 0; i < layers; i++) {
        for (let j = 0; j < segments; j++) {
            const a = i * (segments + 1) + j;
            const b = a + segments + 1;
            
            indices.push(a, b, a + 1);
            indices.push(b, b + 1, a + 1);
        }
    }
    
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    
    return geometry;
}

// Generate G-code for elbow pipe using proper 3-section approach
function generateElbowPipeGcode(diameter, verticalHeight, horizontalLength, layerHeight, speed, bendAngle, wall) {
    const gcode = [];
    const pipeRadius = diameter / 2;
    const L1 = verticalHeight;
    const R = diameter; // Elbow curve radius
    const theta = bendAngle * Math.PI / 180; // Convert to radians
    const L2 = horizontalLength;
    
    const resolution = 100; // segments per 360° rotation
    let E = 0; // Extrusion counter
    let prevPos = null;
    let totalSpiralAngle = 0; // Track continuous spiral angle across all sections
    
    // SECTION 1: Vertical part
    const rotations1 = L1 / layerHeight;
    const segments1 = Math.round(rotations1 * resolution);
    
    gcode.push("; === SECTION 1: Vertical ===");
    gcode.push(`; Segments: ${segments1}, Rotations: ${rotations1.toFixed(2)}`);
    for (let i = 0; i <= segments1; i++) {
        const progress = segments1 > 0 ? i / segments1 : 0;
        const z = progress * L1;
        const spiralAngle = totalSpiralAngle + (i / resolution) * 2 * Math.PI;
        
        const x = pipeRadius * Math.cos(spiralAngle);
        const y = pipeRadius * Math.sin(spiralAngle);
        const B = 0; // Vertical nozzle
        const A = 0; // No yaw needed
        
        if (prevPos) {
            const distance = Math.sqrt(
                Math.pow(x - prevPos.x, 2) + 
                Math.pow(y - prevPos.y, 2) + 
                Math.pow(z - prevPos.z, 2)
            );
            E += distance * 0.05; // Extrusion multiplier
        }
        
        if (i === 0) {
            gcode.push(`G0 X${x.toFixed(3)} Y${y.toFixed(3)} Z${z.toFixed(3)} A${A.toFixed(3)} B${B.toFixed(3)} ; move to start`);
        } else {
            gcode.push(`G1 X${x.toFixed(3)} Y${y.toFixed(3)} Z${z.toFixed(3)} A${A.toFixed(3)} B${B.toFixed(3)} E${E.toFixed(4)} F${speed}`);
        }
        
        prevPos = { x, y, z };
    }
    
    totalSpiralAngle += rotations1 * 2 * Math.PI;
    
    // SECTION 2: Elbow curve
    // Arc length along the centerline of the elbow
    const arcLength = R * theta;
    // Number of rotations needed for this arc length
    const rotations2 = arcLength / layerHeight;
    const segments2 = Math.round(rotations2 * resolution);
    
    gcode.push("");
    gcode.push("; === SECTION 2: Elbow Curve ===");
    gcode.push(`; Arc length: ${arcLength.toFixed(2)}mm, Segments: ${segments2}, Rotations: ${rotations2.toFixed(2)}`);
    
    for (let i = 0; i <= segments2; i++) {
        const progress = segments2 > 0 ? i / segments2 : 0;
        const alpha = progress * theta; // Current angle in the bend (radians)
        
        // Continuous spiral angle
        const spiralAngle = totalSpiralAngle + (i / resolution) * 2 * Math.PI;
        
        // Centerline position (in XZ plane, Y=0 for centerline)
        const centerX = R - R * Math.cos(alpha);
        const centerZ = L1 + R * Math.sin(alpha);
        
        // B angle (nozzle tilt) follows the bend - negative for right turn
        const B = -alpha * 180 / Math.PI;
        
        // Local coordinate system at this point on the curve:
        // Tangent direction (along the curve)
        const tangentX = Math.sin(alpha);
        const tangentZ = Math.cos(alpha);
        
        // Binormal (perpendicular to tangent, in the XZ bend plane)
        const binormalX = Math.cos(alpha);
        const binormalZ = -Math.sin(alpha);
        
        // Create circular cross-section by offsetting from centerline
        const offsetY = pipeRadius * Math.sin(spiralAngle);
        const offsetBinormal = pipeRadius * Math.cos(spiralAngle);
        
        // Final position
        const x = centerX + offsetBinormal * binormalX;
        const y = offsetY;
        const z = centerZ + offsetBinormal * binormalZ;
        
        const A = 0;
        
        if (prevPos) {
            const distance = Math.sqrt(
                Math.pow(x - prevPos.x, 2) + 
                Math.pow(y - prevPos.y, 2) + 
                Math.pow(z - prevPos.z, 2)
            );
            E += distance * 0.05;
        }
        
        gcode.push(`G1 X${x.toFixed(3)} Y${y.toFixed(3)} Z${z.toFixed(3)} A${A.toFixed(3)} B${B.toFixed(3)} E${E.toFixed(4)} F${Math.round(speed * 0.8)}`);
        prevPos = { x, y, z };
    }
    
    totalSpiralAngle += rotations2 * 2 * Math.PI;
    
    // SECTION 3: Angled section after elbow
    const rotations3 = L2 / layerHeight;
    const segments3 = Math.round(rotations3 * resolution);
    
    gcode.push("");
    gcode.push("; === SECTION 3: Angled Section ===");
    gcode.push(`; Segments: ${segments3}, Rotations: ${rotations3.toFixed(2)}`);
    
    const BFinal = -theta * 180 / Math.PI;
    
    for (let i = 0; i <= segments3; i++) {
        const progress = segments3 > 0 ? i / segments3 : 0;
        const s = progress * L2;
        
        const spiralAngle = totalSpiralAngle + (i / resolution) * 2 * Math.PI;
        
        // Centerline continues from elbow at angle theta
        const centerX = R - R * Math.cos(theta) + s * Math.sin(theta);
        const centerZ = L1 + R * Math.sin(theta) + s * Math.cos(theta);
        
        // Local coordinate system (similar to end of elbow)
        const tangentX = Math.sin(theta);
        const tangentZ = Math.cos(theta);
        
        const binormalX = Math.cos(theta);
        const binormalZ = -Math.sin(theta);
        
        // Circular cross-section
        const offsetY = pipeRadius * Math.sin(spiralAngle);
        const offsetBinormal = pipeRadius * Math.cos(spiralAngle);
        
        const x = centerX + offsetBinormal * binormalX;
        const y = offsetY;
        const z = centerZ + offsetBinormal * binormalZ;
        
        const B = BFinal;
        const A = 0;
        
        if (prevPos) {
            const distance = Math.sqrt(
                Math.pow(x - prevPos.x, 2) + 
                Math.pow(y - prevPos.y, 2) + 
                Math.pow(z - prevPos.z, 2)
            );
            E += distance * 0.05;
        }
        
        gcode.push(`G1 X${x.toFixed(3)} Y${y.toFixed(3)} Z${z.toFixed(3)} A${A.toFixed(3)} B${B.toFixed(3)} E${E.toFixed(4)} F${speed}`);
        prevPos = { x, y, z };
    }
    
    return gcode;
}

// Create print path for visualization
function createElbowPipePath(radius, verticalHeight, horizontalLength, bendAngle = 90) {
    const pathPoints = [];
    const pathRadius = radius * 1.05; // Slightly larger for visibility
    
    // Parameters
    const L1 = verticalHeight;
    const L2 = horizontalLength;
    const theta = bendAngle * Math.PI / 180;
    const R = radius * 1.5;
    
    // Path calculations
    const curveLength = R * theta;
    const totalLength = L1 + curveLength + L2;
    const totalPoints = 300;
    
    for (let i = 0; i < totalPoints; i++) {
        const progress = i / totalPoints;
        const distance = progress * totalLength;
        const spiralAngle = (i * 10) * Math.PI / 180; // Spiral around pipe
        
        let centerX, centerY;
        let tangentX, tangentY;
        
        if (distance <= L1) {
            // Vertical section
            centerX = 0;
            centerY = distance;
            tangentX = 0;
            tangentY = 1;
            
        } else if (distance <= L1 + curveLength) {
            // Curved section
            const arcDistance = distance - L1;
            const alpha = arcDistance / R;
            
            centerX = R - R * Math.cos(alpha);
            centerY = L1 + R * Math.sin(alpha);
            tangentX = Math.sin(alpha);
            tangentY = Math.cos(alpha);
            
        } else {
            // Angled section
            const s = distance - L1 - curveLength;
            
            centerX = R - R * Math.cos(theta) + s * Math.sin(theta);
            centerY = L1 + R * Math.sin(theta) + s * Math.cos(theta);
            tangentX = Math.sin(theta);
            tangentY = Math.cos(theta);
        }
        
        // Cross-section perpendicular to pipe
        const normalX = -tangentY;
        const normalY = tangentX;
        
        // Spiral point
        const x = centerX + pathRadius * Math.cos(spiralAngle) * normalX;
        const y = centerY + pathRadius * Math.cos(spiralAngle) * normalY;
        const z = pathRadius * Math.sin(spiralAngle);
        
        pathPoints.push(new THREE.Vector3(x, y, z));
    }
    
    return pathPoints;
}