// G-code parser for Rep5x 5-axis files
// Extracts movement commands and inverse kinematics parameters

class GcodeParser {
    constructor() {
        this.commands = [];
        this.metadata = {
            shape: null,
            diameter: null,
            height: null,
            layerHeight: null,
            printSpeed: null,
            wallThickness: null,
            generatedOn: null,
            inverseKinematics: false,
            laParameter: 0,
            lbParameter: 46,
            aAxisOptimization: false
        };
    }

    async parse(gcodeText) {
        const lines = gcodeText.split('\n');
        this.commands = [];
        
        console.log('Parsing G-code, lines:', lines.length);
        
        // Process in chunks to avoid stack overflow
        const chunkSize = 1000;
        for (let start = 0; start < lines.length; start += chunkSize) {
            const chunk = lines.slice(start, start + chunkSize);
            
            for (let i = 0; i < chunk.length; i++) {
                const line = chunk[i].trim();
                const lineNumber = start + i;
                
                if (line.startsWith(';')) {
                    // Parse metadata from comments
                    this.parseComment(line);
                } else if (line.startsWith('G1') || line.startsWith('G0')) {
                    // Parse movement command
                    const command = this.parseMovementCommand(line, lineNumber);
                    if (command) {
                        this.commands.push(command);
                    }
                }
            }
            
            // Yield to browser to prevent blocking
            if (start % (chunkSize * 10) === 0) {
                await new Promise(resolve => setTimeout(resolve, 1));
            }
        }

        console.log('Parsed commands:', this.commands.length);
        console.log('Metadata:', this.metadata);

        return {
            commands: this.commands,
            metadata: this.metadata
        };
    }

    parseComment(line) {
        // Remove leading semicolon and trim
        const comment = line.substring(1).trim();

        // Parse shape info
        if (comment.startsWith('Shape:')) {
            this.metadata.shape = comment.substring(6).trim();
        }
        else if (comment.startsWith('Diameter:')) {
            this.metadata.diameter = parseFloat(comment.substring(9));
        }
        else if (comment.startsWith('Height:')) {
            this.metadata.height = parseFloat(comment.substring(7));
        }
        else if (comment.startsWith('Layer Height:')) {
            this.metadata.layerHeight = parseFloat(comment.substring(13));
        }
        else if (comment.startsWith('Print Speed:')) {
            this.metadata.printSpeed = parseFloat(comment.substring(12));
        }
        else if (comment.startsWith('Wall Thickness:')) {
            this.metadata.wallThickness = parseFloat(comment.substring(15));
        }
        else if (comment.startsWith('Generated on:')) {
            this.metadata.generatedOn = comment.substring(13).trim();
        }
        
        // Parse 5-axis parameters
        else if (comment.startsWith('Inverse Kinematics:')) {
            this.metadata.inverseKinematics = comment.includes('enabled');
        }
        else if (comment.startsWith('LA Parameter:')) {
            this.metadata.laParameter = parseFloat(comment.substring(13));
        }
        else if (comment.startsWith('LB Parameter:')) {
            this.metadata.lbParameter = parseFloat(comment.substring(13));
        }
        else if (comment.startsWith('A-axis Optimization:')) {
            this.metadata.aAxisOptimization = comment.includes('enabled');
        }
    }

    parseMovementCommand(line, lineNumber) {
        // Parse G1/G0 movement commands
        const coords = {
            lineNumber: lineNumber,
            type: line.startsWith('G1') ? 'move' : 'rapid',
            x: null, y: null, z: null, a: null, b: null,
            e: null, f: null,
            hasMovement: false
        };

        // Extract coordinate values using regex
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
                coords[axis] = parseFloat(match[1]);
                if (axis !== 'e' && axis !== 'f') {
                    coords.hasMovement = true;
                }
            }
        }

        // Only return if there's actual movement
        return coords.hasMovement ? coords : null;
    }

    // Get total number of layers
    getLayerCount() {
        if (this.metadata.height && this.metadata.layerHeight) {
            return Math.floor(this.metadata.height / this.metadata.layerHeight);
        }
        
        // Fallback: estimate from Z positions
        const zPositions = this.commands
            .filter(cmd => cmd.z !== null)
            .map(cmd => cmd.z);
        
        if (zPositions.length > 0) {
            const maxZ = Math.max(...zPositions);
            const minZ = Math.min(...zPositions);
            return Math.floor((maxZ - minZ) / 0.2) + 1; // Assume 0.2mm layers
        }
        
        return 1;
    }

    // Get print statistics
    getStatistics() {
        console.log('Calculating statistics for', this.commands.length, 'commands');
        
        // Filter in chunks to avoid stack issues
        let movements = 0;
        let rapids = 0;
        const chunkSize = 1000;
        
        for (let i = 0; i < this.commands.length; i += chunkSize) {
            const chunk = this.commands.slice(i, i + chunkSize);
            movements += chunk.filter(cmd => cmd.type === 'move').length;
            rapids += chunk.filter(cmd => cmd.type === 'rapid').length;
        }
        
        let totalDistance = 0;
        let printDistance = 0;
        
        for (let i = 1; i < this.commands.length; i++) {
            const prev = this.commands[i-1];
            const curr = this.commands[i];
            
            if (prev.x !== null && prev.y !== null && prev.z !== null &&
                curr.x !== null && curr.y !== null && curr.z !== null) {
                
                const dx = curr.x - prev.x;
                const dy = curr.y - prev.y;
                const dz = curr.z - prev.z;
                const distance = Math.sqrt(dx*dx + dy*dy + dz*dz);
                
                totalDistance += distance;
                if (curr.e !== null && curr.e > 0) {
                    printDistance += distance;
                }
            }
        }

        return {
            totalCommands: this.commands.length,
            movements: movements,
            rapids: rapids,
            layers: this.getLayerCount(),
            totalDistance: totalDistance.toFixed(1),
            printDistance: printDistance.toFixed(1),
            estimatedTime: this.estimatePrintTime()
        };
    }

    estimatePrintTime() {
        // Basic time estimation based on distances and speeds
        // This is a simplified calculation
        const defaultSpeed = this.metadata.printSpeed || 30; // mm/s
        
        // Use simple estimation to avoid recursive call
        const estimatedDistance = this.commands.length * 0.1; // Rough estimate
        const timeSeconds = estimatedDistance / defaultSpeed;
        
        if (timeSeconds < 60) {
            return `${Math.round(timeSeconds)}s`;
        } else if (timeSeconds < 3600) {
            return `${Math.round(timeSeconds / 60)}m`;
        } else {
            const hours = Math.floor(timeSeconds / 3600);
            const minutes = Math.round((timeSeconds % 3600) / 60);
            return `${hours}h ${minutes}m`;
        }
    }
}