// Rep5x Inverse Kinematics Processor
// Processes raw G-code and applies kinematic corrections based on A/B axis movements

function processInverseKinematics(rawGcode, enableKinematics = true, la = 0, lb = 46) {
    if (!enableKinematics) {
        return rawGcode; // Return unchanged if disabled
    }
    
    const lines = rawGcode.split('\n');
    const processedLines = [];
    
    for (let line of lines) {
        // Check if line contains movement command with A or B axes
        if (line.startsWith('G1') && (line.includes(' A') || line.includes(' B'))) {
            const processedLine = applyKinematicCorrections(line, la, lb);
            processedLines.push(processedLine);
        } else {
            // Non-movement lines pass through unchanged
            processedLines.push(line);
        }
    }
    
    return processedLines.join('\n');
}

function applyKinematicCorrections(gcodeLine, la, lb) {
    // Parse G-code line to extract coordinates and axes
    const coords = parseGcodeLine(gcodeLine);
    
    if (!coords) {
        return gcodeLine; // Return unchanged if parsing fails
    }
    
    // Apply inverse kinematics calculations
    const corrected = applyInverseKinematics(
        coords.x, coords.y, coords.z, 
        coords.a, coords.b, 
        la, lb
    );
    
    // Reconstruct G-code line with corrected coordinates
    return buildGcodeLine(coords, corrected);
}

function parseGcodeLine(line) {
    // Extract coordinates from G-code line
    const coords = {
        x: 0, y: 0, z: 0, a: 0, b: 0,
        e: null, f: null, // Keep extrusion and feedrate
        hasA: false, hasB: false
    };
    
    // Match coordinate patterns
    const patterns = {
        x: /X([-+]?\d*\.?\d+)/i,
        y: /Y([-+]?\d*\.?\d+)/i,
        z: /Z([-+]?\d*\.?\d+)/i,
        a: /A([-+]?\d*\.?\d+)/i,
        b: /B([-+]?\d*\.?\d+)/i,
        e: /E([-+]?\d*\.?\d+)/i,
        f: /F([-+]?\d*\.?\d+)/i
    };
    
    for (const [axis, pattern] of Object.entries(patterns)) {
        const match = line.match(pattern);
        if (match) {
            if (axis === 'a') coords.hasA = true;
            if (axis === 'b') coords.hasB = true;
            coords[axis] = parseFloat(match[1]);
        }
    }
    
    // Only process if we have A or B axis movements
    if (!coords.hasA && !coords.hasB) {
        return null;
    }
    
    return coords;
}

function buildGcodeLine(originalCoords, correctedCoords) {
    let line = 'G1';
    
    // Add corrected coordinates
    line += ` X${correctedCoords.x.toFixed(3)}`;
    line += ` Y${correctedCoords.y.toFixed(3)}`;
    line += ` Z${correctedCoords.z.toFixed(3)}`;
    line += ` A${correctedCoords.a.toFixed(3)}`;
    line += ` B${correctedCoords.b.toFixed(3)}`;
    
    // Add extrusion and feedrate if they exist
    if (originalCoords.e !== null) {
        line += ` E${originalCoords.e.toFixed(4)}`;
    }
    if (originalCoords.f !== null) {
        line += ` F${Math.round(originalCoords.f)}`;
    }
    
    return line;
}