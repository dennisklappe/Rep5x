// File handling for Rep5x G-code viewer
// Manages file loading, parsing, and chunked reading for large files

class FileHandler {
    constructor(parser) {
        this.parser = parser;
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    async loadFile(file, onProgress) {
        if (!file) return null;

        // Check file size and warn for very large files
        if (file.size > 100 * 1024 * 1024) {
            const proceed = confirm('File is very large (>100MB). This may take a while to process. Continue?');
            if (!proceed) return null;
        }

        return await this.parseFileInChunks(file, onProgress);
    }

    async parseFileInChunks(file, onProgress) {
        // Reset parser
        this.parser.commands = [];
        this.parser.metadata = {
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
            aAxisOptimization: false,
            ikFormulas: {
                x: "X' + sin(A') × LA + cos(A') × sin(B') × LB",
                y: "Y' - LA + cos(A') × LA - sin(A') × sin(B') × LB",
                z: "Z' + cos(B') × LB - LB"
            }
        };

        const chunkSize = 1024 * 1024; // 1MB chunks
        const fileSize = file.size;
        let offset = 0;
        let buffer = '';
        let lineNumber = 0;

        // Decimation for large files
        let decimation = 1;
        const estimatedLines = fileSize / 50;
        if (estimatedLines > 200000) {
            decimation = Math.ceil(estimatedLines / 100000);
        }

        while (offset < fileSize) {
            const chunk = await this.readFileChunk(file, offset, chunkSize);
            buffer += chunk;

            // Process complete lines from buffer
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                // Always process first 50 lines for metadata, then apply decimation
                if (lineNumber < 50 || lineNumber % decimation === 0) {
                    this.parser.processLine(line.trim(), lineNumber);
                }
                lineNumber++;
            }

            offset += chunkSize;

            // Progress callback
            if (onProgress) {
                const progress = Math.min(100, Math.round((offset / fileSize) * 100));
                onProgress(progress);
            }

            // Yield to browser
            await new Promise(resolve => setTimeout(resolve, 1));
        }

        // Process final buffer
        if (buffer.trim()) {
            this.parser.processLine(buffer.trim(), lineNumber);
        }

        return {
            commands: this.parser.commands,
            metadata: this.parser.metadata
        };
    }

    readFileChunk(file, offset, length) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            const blob = file.slice(offset, offset + length);

            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject(new Error('Failed to read chunk'));

            reader.readAsText(blob);
        });
    }

    calculateAverageFeedrate(commands) {
        const feedrates = commands
            .filter(cmd => cmd.f && cmd.f > 0 && cmd.hasMovement &&
                   (cmd.x !== null || cmd.y !== null || cmd.z !== null))
            .map(cmd => cmd.f);

        if (feedrates.length === 0) return null;

        const avgFeedrate = feedrates.reduce((a, b) => a + b, 0) / feedrates.length;
        return avgFeedrate / 60; // Convert mm/min to mm/s
    }
}
