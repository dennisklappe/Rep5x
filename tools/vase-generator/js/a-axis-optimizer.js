// A-axis shortest route optimizer for continuous rotation
// For printers WITH slipring: wraps A values to 0-360 range and inserts G92 resets
// For printers WITHOUT slipring: leave A values continuous (they rotate back at end)
// Based on aAxisTakeShortRoute.py

function optimizeAAxisRotation(gcode, enableOptimization = true) {
    if (!enableOptimization) {
        // No optimization - return as-is with continuous A values
        // Printer will rotate continuously, wires may need unwinding after print
        return gcode;
    }

    // Optimization enabled: wrap A values to 0-360 and add G92 resets
    const lines = gcode.split('\n');
    const processedLines = [];
    let aOffset = 0;  // Track cumulative offset from G92 resets

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Check if this is a G0 or G1 command with A value
        if ((line.trim().startsWith('G1') || line.trim().startsWith('G0')) && line.includes(' A')) {
            // Extract and wrap the A value
            const aMatch = line.match(/A([-+]?\d*\.?\d+)/);
            if (aMatch) {
                const originalA = parseFloat(aMatch[1]);
                const wrappedA = ((originalA % 360) + 360) % 360;  // Wrap to 0-360

                // Replace A value with wrapped value
                const newLine = line.replace(/A[-+]?\d*\.?\d+/, `A${wrappedA.toFixed(3)}`);
                processedLines.push(newLine);

                // Check if we need a G92 reset for next command
                if (i < lines.length - 1) {
                    const nextLine = lines[i + 1];
                    if ((nextLine.trim().startsWith('G1') || nextLine.trim().startsWith('G0')) && nextLine.includes(' A')) {
                        const nextAMatch = nextLine.match(/A([-+]?\d*\.?\d+)/);
                        if (nextAMatch) {
                            const nextOriginalA = parseFloat(nextAMatch[1]);
                            const nextWrappedA = ((nextOriginalA % 360) + 360) % 360;

                            const diff = wrappedA - nextWrappedA;

                            if (diff > 180) {
                                // Going from high to low (e.g., 350 to 10) - add G92 to continue forward
                                processedLines.push(`G92 A${(wrappedA - 360).toFixed(3)} ; A-axis shortest route`);
                            } else if (diff < -180) {
                                // Going from low to high (e.g., 10 to 350) - add G92 to go backward
                                processedLines.push(`G92 A${(wrappedA + 360).toFixed(3)} ; A-axis shortest route`);
                            }
                        }
                    }
                }
            } else {
                processedLines.push(line);
            }
        } else {
            processedLines.push(line);
        }
    }

    return processedLines.join('\n');
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

    lines.splice(insertIndex, 0, '; A-axis optimized for shortest rotation path (slipring mode)');
    return lines.join('\n');
}

// Statistics function to analyze A-axis movements
function analyzeAAxisMovements(gcode) {
    const lines = gcode.split('\n');
    const aValues = [];
    let totalRotation = 0;
    let maxRotationSpeed = 0;

    for (let line of lines) {
        if ((line.startsWith('G1') || line.startsWith('G0')) && line.includes(' A')) {
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
