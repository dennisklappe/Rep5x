// Inverse Kinematics Reverser for Rep5x
// Takes IK-corrected G-code and reverses it back to original coordinates

class InverseKinematicsReverser {
    constructor(laParameter = 0, lbParameter = 46, ikFormulas = null) {
        this.la = laParameter;
        this.lb = lbParameter;
        this.customFormulas = ikFormulas;
    }

    // Parse and evaluate IK formula
    evaluateFormula(formula, x, y, z, a, b) {
        // Convert angles to radians
        const aRad = a * Math.PI / 180;
        const bRad = b * Math.PI / 180;

        // Replace mathematical notation with JavaScript
        let jsFormula = formula
            .replace(/X'/g, x)
            .replace(/Y'/g, y)
            .replace(/Z'/g, z)
            .replace(/A'/g, a)
            .replace(/B'/g, b)
            .replace(/LA/g, this.la)
            .replace(/LB/g, this.lb)
            .replace(/sin\(/g, 'Math.sin(')
            .replace(/cos\(/g, 'Math.cos(')
            .replace(/tan\(/g, 'Math.tan(')
            .replace(/×/g, '*')
            .replace(/÷/g, '/')
            // Convert degree angles in trig functions to radians
            .replace(/Math\.sin\(([AB])\)/g, (match, angle) => {
                return angle === 'A' ? `Math.sin(${aRad})` : `Math.sin(${bRad})`;
            })
            .replace(/Math\.cos\(([AB])\)/g, (match, angle) => {
                return angle === 'A' ? `Math.cos(${aRad})` : `Math.cos(${bRad})`;
            });

        try {
            return eval(jsFormula);
        } catch (e) {
            console.error('Formula evaluation error:', e, 'Formula:', jsFormula);
            return 0;
        }
    }

    // Reverse the Rep5x inverse kinematics to get original coordinates
    reverseIK(x, y, z, a, b) {
        let originalX, originalY, originalZ;

        if (this.customFormulas) {
            // Use custom formulas to calculate forward IK, then reverse it
            // Forward IK formulas give us: X_ik, Y_ik, Z_ik
            // We need to reverse them to get original X', Y', Z'

            // Since the formulas are: X = X' + corrections
            // We need to solve for X' by subtracting the corrections
            // We'll evaluate the correction part only

            // Parse formulas to extract correction terms
            // Default approach: assume formulas are in form "X' + corrections"
            // Reverse by computing: X' = X - corrections

            // For X formula: evaluate everything except X'
            const xCorrection = this.evaluateFormula(
                this.customFormulas.x.replace(/X'\s*\+?\s*/g, '').replace(/^\+\s*/, ''),
                0, 0, 0, a, b
            );
            originalX = x - xCorrection;

            // For Y formula
            const yCorrection = this.evaluateFormula(
                this.customFormulas.y.replace(/Y'\s*\+?\s*/g, '').replace(/^\+\s*/, '').replace(/^-\s*/, '+'),
                0, 0, 0, a, b
            );
            originalY = y - yCorrection;

            // For Z formula
            const zCorrection = this.evaluateFormula(
                this.customFormulas.z.replace(/Z'\s*\+?\s*/g, '').replace(/^\+\s*/, ''),
                0, 0, 0, a, b
            );
            originalZ = z - zCorrection;

        } else {
            // Use default hard-coded formulas
            const aRad = a * Math.PI / 180;
            const bRad = b * Math.PI / 180;

            // Reverse the Rep5x inverse kinematics formulas:
            // Original: X = X' + sin(A') × LA + cos(A') × sin(B') × LB
            // Reversed: X' = X - sin(A') × LA - cos(A') × sin(B') × LB

            originalX = x - Math.sin(aRad) * this.la - Math.cos(aRad) * Math.sin(bRad) * this.lb;

            // Original: Y = Y' - LA + cos(A') × LA - sin(A') × sin(B') × LB
            // Reversed: Y' = Y + LA - cos(A') × LA + sin(A') × sin(B') × LB
            originalY = y + this.la - Math.cos(aRad) * this.la + Math.sin(aRad) * Math.sin(bRad) * this.lb;

            // Original: Z = Z' + cos(B') × LB - LB
            // Reversed: Z' = Z - cos(B') × LB + LB = Z + LB × (1 - cos(B'))
            originalZ = z + this.lb * (1 - Math.cos(bRad));
        }

        return {
            x: originalX,
            y: originalY,
            z: originalZ,
            a: a, // A and B angles remain the same
            b: b
        };
    }

    // Process an entire command array to reverse IK
    reverseCommandArray(commands) {
        // Process in chunks to avoid performance issues
        const result = [];
        const chunkSize = 1000;
        
        for (let i = 0; i < commands.length; i += chunkSize) {
            const chunk = commands.slice(i, i + chunkSize);
            const processedChunk = chunk.map(command => {
                if (command.hasMovement) {
                    // Use previous position for null coordinates
                    const x = command.x !== null ? command.x : 0;
                    const y = command.y !== null ? command.y : 0;
                    const z = command.z !== null ? command.z : 0;
                    const a = command.a !== null ? command.a : 0;
                    const b = command.b !== null ? command.b : 0;

                    const reversed = this.reverseIK(x, y, z, a, b);

                    return {
                        ...command,
                        x: command.x !== null ? reversed.x : null,
                        y: command.y !== null ? reversed.y : null,
                        z: command.z !== null ? reversed.z : null,
                        a: command.a !== null ? reversed.a : null,
                        b: command.b !== null ? reversed.b : null,
                        original: { // Keep track of original IK-corrected values
                            x: command.x,
                            y: command.y,
                            z: command.z,
                            a: command.a,
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
    getIKCorrection(x, y, z, a, b) {
        // Apply IK to original coordinates
        const aRad = a * Math.PI / 180;
        const bRad = b * Math.PI / 180;
        
        const correctedX = x + Math.sin(aRad) * this.la + Math.cos(aRad) * Math.sin(bRad) * this.lb;
        const correctedY = y - this.la + Math.cos(aRad) * this.la - Math.sin(aRad) * Math.sin(bRad) * this.lb;
        const correctedZ = z + this.lb * (Math.cos(bRad) - 1);
        
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
            if (command.hasMovement && command.a !== null && command.b !== null) {
                const x = command.x || 0;
                const y = command.y || 0;
                const z = command.z || 0;
                const a = command.a || 0;
                const b = command.b || 0;

                const correction = this.getIKCorrection(x, y, z, a, b);
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