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
            lcParameter: 0,
            lbParameter: 46,
            cAxisOptimization: false,
            usesAAxis: false,  // Track if file uses A instead of C for yaw
            ikFormulas: {
                x: "X' + sin(C') × LC + cos(C') × sin(B') × LB",
                y: "Y' - LC + cos(C') × LC - sin(C') × sin(B') × LB",
                z: "Z' + cos(B') × LB - LB"
            }
        };
        // Track coordinate offsets from G92 commands
        this.coordinateOffset = { x: 0, y: 0, z: 0 };
        // Track current position for G92 offset calculation
        this.currentPosition = { x: 0, y: 0, z: 0 };
    }

    async parse(gcodeText) {
        this.commands = [];
        // Reset ALL state for new file
        this.coordinateOffset = { x: 0, y: 0, z: 0 };
        this.currentPosition = { x: 0, y: 0, z: 0 };
        this.metadata = {
            shape: null,
            diameter: null,
            height: null,
            layerHeight: null,
            printSpeed: null,
            wallThickness: null,
            generatedOn: null,
            inverseKinematics: false,
            lcParameter: 0,
            lbParameter: 46,
            cAxisOptimization: false,
            usesAAxis: false,
            ikFormulas: {
                x: "X' + sin(C') × LC + cos(C') × sin(B') × LB",
                y: "Y' - LC + cos(C') × LC - sin(C') × sin(B') × LB",
                z: "Z' + cos(B') × LB - LB"
            }
        };
        
        
        // Manual line splitting to avoid regex stack overflow on large files
        const lines = [];
        let currentLine = '';
        let lineCount = 0;
        
        
        // Split manually in chunks to avoid memory issues
        const chunkSize = 100000; // 100KB chunks
        
        for (let i = 0; i < gcodeText.length; i += chunkSize) {
            const chunk = gcodeText.slice(i, Math.min(i + chunkSize, gcodeText.length));
            
            for (let j = 0; j < chunk.length; j++) {
                const char = chunk[j];
                
                if (char === '\n' || char === '\r') {
                    if (currentLine.trim()) {
                        lines.push(currentLine.trim());
                        lineCount++;
                    }
                    currentLine = '';
                } else {
                    currentLine += char;
                }
            }
            
            // Yield occasionally during splitting
            if (i % (chunkSize * 50) === 0) {
                await new Promise(resolve => setTimeout(resolve, 1));
            }
        }
        
        // Add final line if exists
        if (currentLine.trim()) {
            lines.push(currentLine.trim());
            lineCount++;
        }
        
        
        // Smart decimation for large files
        let decimation = 1;
        if (lineCount > 300000) {
            decimation = Math.ceil(lineCount / 100000); // Target ~100k commands max
        }
        
        // Process lines in batches
        const batchSize = 500;
        
        for (let i = 0; i < lineCount; i += batchSize) {
            const endIndex = Math.min(i + batchSize, lineCount);
            
            // Process batch
            for (let j = i; j < endIndex; j++) {
                // Apply decimation for large files
                if (j % decimation === 0) {
                    this.processLine(lines[j], j);
                }
            }
            
            // Yield to browser every batch
            if (i % (batchSize * 10) === 0) {
                await new Promise(resolve => setTimeout(resolve, 1));
                const progress = Math.round((i / lineCount) * 100);
            }
        }

        if (decimation > 1) {
        }

        return {
            commands: this.commands,
            metadata: this.metadata
        };
    }
    
    processLine(line, lineNumber) {
        if (line.startsWith(';')) {
            // Parse metadata from comments
            this.parseComment(line);
        } else if (line.startsWith('G92')) {
            // Parse coordinate system reset (used by C-axis optimizer)
            const resetCommand = this.parseG92Command(line, lineNumber);
            if (resetCommand) {
                this.commands.push(resetCommand);
            }
        } else if (line.startsWith('G1') || line.startsWith('G0')) {
            // Parse movement command
            const command = this.parseMovementCommand(line, lineNumber);
            if (command) {
                this.commands.push(command);
            }
        }
        // M0 pause commands are ignored in the viewer
    }

    parseG92Command(line, lineNumber) {
        // Parse G92 coordinate reset commands
        // G92 sets the current position to the specified value
        // This creates an offset between machine coordinates and logical coordinates

        const coords = {
            lineNumber: lineNumber,
            type: 'reset',
            c: null,
            hasReset: false
        };

        // Extract X value - G92 X0 means "current position is now X0"
        // So offset = currentPosition - newValue
        const xMatch = line.match(/X([-+]?\d*\.?\d+)/i);
        if (xMatch) {
            const newX = parseFloat(xMatch[1]);
            this.coordinateOffset.x = this.currentPosition.x - newX;
            coords.hasReset = true;
        }

        // Extract Y value
        const yMatch = line.match(/Y([-+]?\d*\.?\d+)/i);
        if (yMatch) {
            const newY = parseFloat(yMatch[1]);
            this.coordinateOffset.y = this.currentPosition.y - newY;
            coords.hasReset = true;
        }

        // Extract Z value
        const zMatch = line.match(/Z([-+]?\d*\.?\d+)/i);
        if (zMatch) {
            const newZ = parseFloat(zMatch[1]);
            this.coordinateOffset.z = this.currentPosition.z - newZ;
            coords.hasReset = true;
        }

        // Extract C value (for C-axis optimizer)
        const cMatch = line.match(/C([-+]?\d*\.?\d+)/i);
        if (cMatch) {
            coords.c = parseFloat(cMatch[1]);
            coords.hasReset = true;
        }

        return coords.hasReset ? coords : null;
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
        
        // Parse 5-axis parameters (flexible matching)
        else if (comment.toLowerCase().includes('inverse kinematics')) {
            this.metadata.inverseKinematics = comment.toLowerCase().includes('enabled');
        }
        else if (comment.toLowerCase().includes('lc parameter')) {
            const match = comment.match(/lc parameter\s*:\s*([+-]?\d*\.?\d+)/i);
            if (match) {
                this.metadata.lcParameter = parseFloat(match[1]);
            }
        }
        else if (comment.toLowerCase().includes('lb parameter')) {
            const match = comment.match(/lb parameter\s*:\s*([+-]?\d*\.?\d+)/i);
            if (match) {
                this.metadata.lbParameter = parseFloat(match[1]);
            }
        }
        else if (comment.toLowerCase().includes('c-axis optimization')) {
            this.metadata.cAxisOptimization = comment.toLowerCase().includes('enabled');
        }
        // Parse IK formulas
        else if (comment.startsWith('X = ') || comment.startsWith('X= ')) {
            this.metadata.ikFormulas.x = comment.substring(comment.indexOf('=') + 1).trim();
        }
        else if (comment.startsWith('Y = ') || comment.startsWith('Y= ')) {
            this.metadata.ikFormulas.y = comment.substring(comment.indexOf('=') + 1).trim();
        }
        else if (comment.startsWith('Z = ') || comment.startsWith('Z= ')) {
            this.metadata.ikFormulas.z = comment.substring(comment.indexOf('=') + 1).trim();
        }
    }

    parseMovementCommand(line, lineNumber) {
        // Parse G1/G0 movement commands
        const coords = {
            lineNumber: lineNumber,
            type: line.startsWith('G1') ? 'move' : 'rapid',
            x: null, y: null, z: null, c: null, b: null,
            e: null, f: null,
            hasMovement: false
        };

        // Extract coordinate values using regex
        const patterns = {
            x: /X([-+]?\d*\.?\d+)/i,
            y: /Y([-+]?\d*\.?\d+)/i,
            z: /Z([-+]?\d*\.?\d+)/i,
            c: /C([-+]?\d*\.?\d+)/i,
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

        // Check for A axis (legacy - treat as C axis for yaw)
        // Some older 5-axis setups use A for yaw, Rep5x uses C
        const aMatch = line.match(/A([-+]?\d*\.?\d+)/i);
        if (aMatch && coords.c === null) {
            coords.c = parseFloat(aMatch[1]);
            coords.hasMovement = true;
            this.metadata.usesAAxis = true;
        }

        // Apply coordinate offsets from G92 commands
        // This converts logical coordinates back to machine coordinates for display
        if (coords.x !== null) {
            coords.x += this.coordinateOffset.x;
            this.currentPosition.x = coords.x;
        }
        if (coords.y !== null) {
            coords.y += this.coordinateOffset.y;
            this.currentPosition.y = coords.y;
        }
        if (coords.z !== null) {
            coords.z += this.coordinateOffset.z;
            this.currentPosition.z = coords.z;
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
        let minZ = Infinity, maxZ = -Infinity, hasZ = false;
        for (const cmd of this.commands) {
            if (cmd.z !== null) {
                if (cmd.z < minZ) minZ = cmd.z;
                if (cmd.z > maxZ) maxZ = cmd.z;
                hasZ = true;
            }
        }

        if (hasZ) {
            return Math.floor((maxZ - minZ) / 0.2) + 1; // Assume 0.2mm layers
        }
        
        return 1;
    }

    // Get print statistics
    getStatistics() {
        
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