/**
 * C-axis Shortest Route Optimizer
 * For printers WITH slipring: wraps C values to 0-360 range and inserts G92 resets
 * For printers WITHOUT slipring: leave C values continuous (they rotate back at end)
 * Based on aAxisTakeShortRoute.py
 *
 * Used by: Vase Generator, G-code Corrector
 */

function optimizeCAxisRotation(gcode, enableOptimization = true) {
    if (!enableOptimization) {
        // No optimization - return as-is with continuous C values
        // Printer will rotate continuously, wires may need unwinding after print
        return gcode;
    }

    // Optimization enabled: wrap C values to 0-360 and add G92 resets
    const lines = gcode.split('\n');
    const processedLines = [];
    let cOffset = 0;  // Track cumulative offset from G92 resets

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Check if this is a G0 or G1 command with C value
        if ((line.trim().startsWith('G1') || line.trim().startsWith('G0')) && line.includes(' C')) {
            // Extract and wrap the C value
            const cMatch = line.match(/C([-+]?\d*\.?\d+)/);
            if (cMatch) {
                const originalC = parseFloat(cMatch[1]);
                const wrappedC = ((originalC % 360) + 360) % 360;  // Wrap to 0-360

                // Replace C value with wrapped value
                const newLine = line.replace(/C[-+]?\d*\.?\d+/, `C${wrappedC.toFixed(3)}`);
                processedLines.push(newLine);

                // Check if we need a G92 reset for next command
                if (i < lines.length - 1) {
                    const nextLine = lines[i + 1];
                    if ((nextLine.trim().startsWith('G1') || nextLine.trim().startsWith('G0')) && nextLine.includes(' C')) {
                        const nextCMatch = nextLine.match(/C([-+]?\d*\.?\d+)/);
                        if (nextCMatch) {
                            const nextOriginalC = parseFloat(nextCMatch[1]);
                            const nextWrappedC = ((nextOriginalC % 360) + 360) % 360;

                            const diff = wrappedC - nextWrappedC;

                            if (diff > 180) {
                                // Going from high to low (e.g., 350 to 10) - add G92 to continue forward
                                processedLines.push(`G92 C${(wrappedC - 360).toFixed(3)} ; C-axis shortest route`);
                            } else if (diff < -180) {
                                // Going from low to high (e.g., 10 to 350) - add G92 to go backward
                                processedLines.push(`G92 C${(wrappedC + 360).toFixed(3)} ; C-axis shortest route`);
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
function addCAxisOptimizationComment(gcode) {
    const lines = gcode.split('\n');

    // Find a good place to insert the comment (after header, before first G1)
    let insertIndex = 0;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('G1')) {
            insertIndex = i;
            break;
        }
    }

    lines.splice(insertIndex, 0, '; C-axis optimized for shortest rotation path (slipring mode)');
    return lines.join('\n');
}

// Statistics function to analyze C-axis movements
function analyzeCAxisMovements(gcode) {
    const lines = gcode.split('\n');
    const cValues = [];
    let totalRotation = 0;
    let maxRotationSpeed = 0;

    for (let line of lines) {
        if ((line.startsWith('G1') || line.startsWith('G0')) && line.includes(' C')) {
            const cMatch = line.match(/C([-+]?\d*\.?\d+)/);
            if (cMatch) {
                cValues.push(parseFloat(cMatch[1]));
            }
        }
    }

    // Calculate statistics
    for (let i = 1; i < cValues.length; i++) {
        const rotation = Math.abs(cValues[i] - cValues[i-1]);
        totalRotation += rotation;
        maxRotationSpeed = Math.max(maxRotationSpeed, rotation);
    }

    return {
        totalCommands: cValues.length,
        totalRotation: totalRotation.toFixed(1),
        averageRotation: cValues.length > 1 ? (totalRotation / (cValues.length - 1)).toFixed(2) : 0,
        maxRotationSpeed: maxRotationSpeed.toFixed(1),
        cAxisRange: cValues.length > 0 ? {
            min: Math.min(...cValues).toFixed(1),
            max: Math.max(...cValues).toFixed(1)
        } : null
    };
}
