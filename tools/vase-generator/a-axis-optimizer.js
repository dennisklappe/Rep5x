// A-axis shortest route optimizer for continuous rotation
// Converts A-axis commands to take the shortest rotational path

function optimizeAAxisRotation(gcode, enableOptimization = true) {
    if (!enableOptimization) {
        return gcode;
    }
    
    const lines = gcode.split('\n');
    const processedLines = [];
    let currentA = 0; // Track current A-axis position
    let cumulativeA = 0; // Track cumulative A-axis rotation
    
    for (let line of lines) {
        if (line.startsWith('G1') && line.includes(' A')) {
            const processedLine = optimizeAAxisLine(line, currentA, cumulativeA);
            processedLines.push(processedLine.line);
            currentA = processedLine.newA;
            cumulativeA = processedLine.cumulativeA;
        } else {
            // Handle A-axis reset commands like G92 A90.600
            if (line.includes('G92') && line.includes(' A')) {
                const aMatch = line.match(/A([-+]?\d*\.?\d+)/);
                if (aMatch) {
                    currentA = parseFloat(aMatch[1]);
                    cumulativeA = currentA;
                }
            }
            processedLines.push(line);
        }
    }
    
    return processedLines.join('\n');
}

function optimizeAAxisLine(gcodeLine, currentA, cumulativeA) {
    // Parse the A value from the G-code line
    const aMatch = gcodeLine.match(/A([-+]?\d*\.?\d+)/);
    if (!aMatch) {
        return { line: gcodeLine, newA: currentA, cumulativeA: cumulativeA };
    }
    
    const targetA = parseFloat(aMatch[1]);
    
    // Calculate the shortest route
    const shortestRoute = calculateShortestRoute(currentA, targetA);
    
    // Update cumulative position
    const newCumulativeA = cumulativeA + shortestRoute.deltaA;
    
    // Replace the A value in the G-code line
    const newLine = gcodeLine.replace(/A[-+]?\d*\.?\d+/, `A${newCumulativeA.toFixed(3)}`);
    
    return {
        line: newLine,
        newA: shortestRoute.normalizedTarget,
        cumulativeA: newCumulativeA
    };
}

function calculateShortestRoute(currentA, targetA) {
    // Normalize angles to 0-360 range
    const normalizedCurrent = normalizeAngle(currentA);
    const normalizedTarget = normalizeAngle(targetA);
    
    // Calculate direct difference
    let deltaA = normalizedTarget - normalizedCurrent;
    
    // Find shortest route (considering 360° wrap-around)
    if (deltaA > 180) {
        deltaA -= 360; // Go backwards instead
    } else if (deltaA < -180) {
        deltaA += 360; // Go forwards instead
    }
    
    return {
        deltaA: deltaA,
        normalizedTarget: normalizedTarget
    };
}

function normalizeAngle(angle) {
    // Normalize angle to 0-360 range
    angle = angle % 360;
    if (angle < 0) {
        angle += 360;
    }
    return angle;
}

// Add comment to G-code indicating optimization
function addAAxisOptimizationComment(gcode) {
    const lines = gcode.split('\n');
    
    // Find a good place to insert the comment (after header, before first G1)
    let insertIndex = 0;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('G1')) {
            insertIndex = i;
            break;
        }
    }
    
    lines.splice(insertIndex, 0, '; A-axis optimized for shortest rotation path');
    return lines.join('\n');
}

// Statistics function to analyze A-axis movements
function analyzeAAxisMovements(gcode) {
    const lines = gcode.split('\n');
    const aValues = [];
    let totalRotation = 0;
    let maxRotationSpeed = 0;
    
    for (let line of lines) {
        if (line.startsWith('G1') && line.includes(' A')) {
            const aMatch = line.match(/A([-+]?\d*\.?\d+)/);
            if (aMatch) {
                aValues.push(parseFloat(aMatch[1]));
            }
        }
    }
    
    // Calculate statistics
    for (let i = 1; i < aValues.length; i++) {
        const rotation = Math.abs(aValues[i] - aValues[i-1]);
        totalRotation += rotation;
        maxRotationSpeed = Math.max(maxRotationSpeed, rotation);
    }
    
    return {
        totalCommands: aValues.length,
        totalRotation: totalRotation.toFixed(1),
        averageRotation: aValues.length > 1 ? (totalRotation / (aValues.length - 1)).toFixed(2) : 0,
        maxRotationSpeed: maxRotationSpeed.toFixed(1),
        aAxisRange: aValues.length > 0 ? {
            min: Math.min(...aValues).toFixed(1),
            max: Math.max(...aValues).toFixed(1)
        } : null
    };
}