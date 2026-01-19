// Inverse Kinematics Reverser for Rep5x
// Takes IK-corrected G-code and reverses it back to original coordinates

class InverseKinematicsReverser {
    constructor(lcParameter = 0, lbParameter = 46) {
        this.lc = lcParameter;
        this.lb = lbParameter;
    }

    // Reverse the Rep5x inverse kinematics to get original coordinates
    reverseIK(x, y, z, c, b) {
        const cRad = c * Math.PI / 180;
        const bRad = b * Math.PI / 180;

        // Forward: X = X' + sin(C)·LC + cos(C)·sin(B)·LB
        // Reversed: X' = X - sin(C)·LC - cos(C)·sin(B)·LB
        const originalX = x - Math.sin(cRad) * this.lc - Math.cos(cRad) * Math.sin(bRad) * this.lb;

        // Forward: Y = Y' + (cos(C) - 1)·LC - sin(C)·sin(B)·LB
        // Reversed: Y' = Y - (cos(C) - 1)·LC + sin(C)·sin(B)·LB
        const originalY = y - (Math.cos(cRad) - 1) * this.lc + Math.sin(cRad) * Math.sin(bRad) * this.lb;

        // Forward: Z = Z' + (cos(B) - 1)·LB
        // Reversed: Z' = Z - (cos(B) - 1)·LB
        const originalZ = z - (Math.cos(bRad) - 1) * this.lb;

        return {
            x: originalX,
            y: originalY,
            z: originalZ,
            c: c,
            b: b
        };
    }

    // Process an entire command array to reverse IK
    reverseCommandArray(commands) {
        // Process in chunks to avoid performance issues
        const result = [];
        const chunkSize = 1000;

        // Track modal values for C and B axes (G-code retains last set value)
        let currentC = 0;
        let currentB = 0;
        let currentX = 0;
        let currentY = 0;
        let currentZ = 0;

        for (let i = 0; i < commands.length; i += chunkSize) {
            const chunk = commands.slice(i, i + chunkSize);
            const processedChunk = chunk.map(command => {
                // Handle G92 reset commands - they set modal values without IK transformation
                if (command.type === 'reset') {
                    if (command.c !== null) currentC = command.c;
                    return command;
                }

                if (command.hasMovement) {
                    // Update modal values when explicitly set
                    if (command.c !== null) currentC = command.c;
                    if (command.b !== null) currentB = command.b;
                    if (command.x !== null) currentX = command.x;
                    if (command.y !== null) currentY = command.y;
                    if (command.z !== null) currentZ = command.z;

                    // Use current modal values for IK reversal
                    const x = currentX;
                    const y = currentY;
                    const z = currentZ;
                    const c = currentC;
                    const b = currentB;

                    const reversed = this.reverseIK(x, y, z, c, b);

                    return {
                        ...command,
                        x: command.x !== null ? reversed.x : null,
                        y: command.y !== null ? reversed.y : null,
                        z: command.z !== null ? reversed.z : null,
                        c: command.c !== null ? reversed.c : null,
                        b: command.b !== null ? reversed.b : null,
                        original: { // Keep track of original IK-corrected values
                            x: command.x,
                            y: command.y,
                            z: command.z,
                            c: command.c,
                            b: command.b
                        }
                    };
                }
                return command;
            });

            result.push(...processedChunk);
        }

        return result;
    }

    // Calculate the difference between original and IK-corrected positions
    getIKCorrection(x, y, z, c, b) {
        const cRad = c * Math.PI / 180;
        const bRad = b * Math.PI / 180;

        // X = X' + sin(C)·LC + cos(C)·sin(B)·LB
        const correctedX = x + Math.sin(cRad) * this.lc + Math.cos(cRad) * Math.sin(bRad) * this.lb;

        // Y = Y' + (cos(C) - 1)·LC - sin(C)·sin(B)·LB
        const correctedY = y + (Math.cos(cRad) - 1) * this.lc - Math.sin(cRad) * Math.sin(bRad) * this.lb;

        // Z = Z' + (cos(B) - 1)·LB
        const correctedZ = z + (Math.cos(bRad) - 1) * this.lb;

        return {
            deltaX: correctedX - x,
            deltaY: correctedY - y,
            deltaZ: correctedZ - z,
            corrected: { x: correctedX, y: correctedY, z: correctedZ },
            original: { x: x, y: y, z: z }
        };
    }

    // Analyze IK corrections over the entire path
    analyzeIKCorrections(commands) {
        const corrections = [];
        let maxCorrection = { x: 0, y: 0, z: 0 };
        let totalCorrection = { x: 0, y: 0, z: 0 };
        let count = 0;

        for (const command of commands) {
            if (command.hasMovement && command.c !== null && command.b !== null) {
                const x = command.x || 0;
                const y = command.y || 0;
                const z = command.z || 0;
                const c = command.c || 0;
                const b = command.b || 0;

                const correction = this.getIKCorrection(x, y, z, c, b);
                corrections.push(correction);

                // Track maximum corrections
                maxCorrection.x = Math.max(maxCorrection.x, Math.abs(correction.deltaX));
                maxCorrection.y = Math.max(maxCorrection.y, Math.abs(correction.deltaY));
                maxCorrection.z = Math.max(maxCorrection.z, Math.abs(correction.deltaZ));

                // Track total corrections for averaging
                totalCorrection.x += Math.abs(correction.deltaX);
                totalCorrection.y += Math.abs(correction.deltaY);
                totalCorrection.z += Math.abs(correction.deltaZ);
                count++;
            }
        }

        const avgCorrection = count > 0 ? {
            x: totalCorrection.x / count,
            y: totalCorrection.y / count,
            z: totalCorrection.z / count
        } : { x: 0, y: 0, z: 0 };

        return {
            corrections: corrections,
            maxCorrection: maxCorrection,
            avgCorrection: avgCorrection,
            totalCommands: count,
            summary: {
                maxX: maxCorrection.x.toFixed(3),
                maxY: maxCorrection.y.toFixed(3),
                maxZ: maxCorrection.z.toFixed(3),
                avgX: avgCorrection.x.toFixed(3),
                avgY: avgCorrection.y.toFixed(3),
                avgZ: avgCorrection.z.toFixed(3)
            }
        };
    }
}