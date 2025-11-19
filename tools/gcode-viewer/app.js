// Main application for Rep5x 5-axis G-code previewer
// Coordinates all components and handles UI interactions

class GcodePreviewerApp {
    constructor() {
        this.parser = new GcodeParser();
        this.ikReverser = null;
        this.animationEngine = null;
        this.currentData = null;
        
        this.initializeApp();
    }

    initializeApp() {
        try {
            // Initialize animation engine
            this.animationEngine = new AnimationEngine('canvas3d');
            
            // Set up callbacks
            this.animationEngine.updateProgressCallback = (progress) => this.updateProgress(progress);
            this.animationEngine.updatePositionCallback = (position) => this.updatePositionDisplay(position);
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Hide loading indicator
            document.getElementById('loading').style.display = 'none';
        } catch (error) {
            console.error('Error initializing app:', error);
            document.getElementById('loading').innerHTML = '<div class="text-center"><div class="text-red-600">Error initializing 3D viewer: ' + error.message + '</div></div>';
        }
    }

    setupEventListeners() {
        // File upload
        document.getElementById('gcodeFile').addEventListener('change', (e) => {
            console.log('File input changed:', e.target.files[0]);
            this.handleFileSelect(e.target.files[0]);
        });

        // Drag and drop
        this.setupDragAndDrop();

        // Animation controls
        document.getElementById('playPause').addEventListener('click', () => {
            this.togglePlayPause();
        });

        document.getElementById('reset').addEventListener('click', () => {
            this.resetAnimation();
        });

        // Speed control
        document.getElementById('speed').addEventListener('input', (e) => {
            const speed = parseFloat(e.target.value);
            document.getElementById('speedValue').textContent = speed.toFixed(1);
            if (this.animationEngine) {
                this.animationEngine.setSpeed(speed);
            }
        });

        // Progress control
        document.getElementById('progress').addEventListener('input', (e) => {
            const progress = parseFloat(e.target.value);
            if (this.animationEngine) {
                this.animationEngine.setProgress(progress);
            }
        });

        // View controls
        document.getElementById('showPath').addEventListener('change', (e) => {
            if (this.animationEngine) {
                this.animationEngine.showPrintPath(e.target.checked);
            }
        });

        document.getElementById('showPrinthead').addEventListener('change', (e) => {
            if (this.animationEngine) {
                this.animationEngine.showPrinthead(e.target.checked);
            }
        });

        document.getElementById('showAxes').addEventListener('change', (e) => {
            if (this.animationEngine) {
                this.animationEngine.showAxes(e.target.checked);
            }
        });

        // Handle window resize
        window.addEventListener('resize', () => {
            if (this.animationEngine && this.animationEngine.camera && this.animationEngine.renderer) {
                const canvas = document.getElementById('canvas3d');
                this.animationEngine.camera.aspect = canvas.offsetWidth / canvas.offsetHeight;
                this.animationEngine.camera.updateProjectionMatrix();
                this.animationEngine.renderer.setSize(canvas.offsetWidth, canvas.offsetHeight);
            }
        });
        
        // Manual override controls
        document.getElementById('manualMode').addEventListener('change', (e) => {
            this.toggleManualMode(e.target.checked);
        });

        document.getElementById('applyManual').addEventListener('click', () => {
            this.applyManualSettings();
        });
    }

    setupDragAndDrop() {
        const dropZone = document.getElementById('dropZone');
        
        // Prevent default drag behaviors
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        // Highlight drop zone when item is dragged over it
        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                dropZone.classList.add('drag-over');
            });
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                dropZone.classList.remove('drag-over');
            });
        });

        // Handle dropped files
        dropZone.addEventListener('drop', (e) => {
            console.log('File dropped:', e.dataTransfer.files[0]);
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.handleFileSelect(files[0]);
            }
        });
    }

    handleFileSelect(file) {
        console.log('Handling file selection:', file);
        if (!file) return;

        // Show file selected state
        this.showFileSelected(file);
        
        // Load the file
        this.loadGcodeFile(file);
    }

    showFileSelected(file) {
        console.log('Showing file selected:', file.name);
        const dropContent = document.getElementById('dropContent');
        const fileSelected = document.getElementById('fileSelected');
        const fileName = document.getElementById('fileName');
        const fileSize = document.getElementById('fileSize');

        // Hide drop content, show file selected
        dropContent.classList.add('hidden');
        fileSelected.classList.remove('hidden');

        // Update file info
        fileName.textContent = file.name;
        fileSize.textContent = this.formatFileSize(file.size);
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    async loadGcodeFile(file) {
        if (!file) return;

        try {
            console.log('Loading G-code file:', file.name, 'size:', file.size, 'bytes');
            
            // Check file size and warn for very large files
            if (file.size > 100 * 1024 * 1024) {
                const proceed = confirm('File is very large (>100MB). This may take a while to process. Continue?');
                if (!proceed) return;
            }
            
            // Show loading indicator
            document.getElementById('loading').style.display = 'flex';
            
            // Use streaming approach for large files
            const parseResult = await this.parseFileInChunks(file);
            console.log('Parse result:', parseResult);
            
            this.currentData = parseResult;
            this.displayFileInfo(parseResult.metadata, this.parser.getStatistics());
            
            // Always show advanced options when a file is loaded (for manual override)
            console.log('Checking 5-axis parameters:', {
                inverseKinematics: parseResult.metadata.inverseKinematics,
                aAxisOptimization: parseResult.metadata.aAxisOptimization,
                laParameter: parseResult.metadata.laParameter,
                lbParameter: parseResult.metadata.lbParameter
            });
            
            // Show advanced options and prefill with detected parameters
            document.getElementById('advancedOptions').classList.remove('hidden');
            this.prefillAdvancedOptions(parseResult.metadata);
            
            // Set up IK reverser if needed
            if (parseResult.metadata.inverseKinematics) {
                console.log('IK enabled, setting up reverser...');
                this.ikReverser = new InverseKinematicsReverser(
                    parseResult.metadata.laParameter,
                    parseResult.metadata.lbParameter
                );
                
                // Reverse the IK to get original coordinates
                const reversedCommands = this.ikReverser.reverseCommandArray(parseResult.commands);
                this.animationEngine.loadCommands(reversedCommands);
                
                // Show IK analysis
                this.displayIKAnalysis(this.ikReverser.analyzeIKCorrections(parseResult.commands));
                
            } else {
                console.log('IK disabled, loading commands directly...');
                // Load commands directly - no IK processing needed
                this.animationEngine.loadCommands(parseResult.commands);
            }

            // Calculate average feedrate from G-code commands (only movement, not extrusion)
            const feedrates = parseResult.commands
                .filter(cmd => cmd.f && cmd.f > 0 && cmd.hasMovement && (cmd.x !== null || cmd.y !== null || cmd.z !== null))
                .map(cmd => cmd.f);

            let calculatedPrintSpeed = null;
            let defaultSpeed = 1.0;

            if (feedrates.length > 0) {
                const avgFeedrate = feedrates.reduce((a, b) => a + b, 0) / feedrates.length;
                calculatedPrintSpeed = avgFeedrate / 60; // Convert mm/min to mm/s
                defaultSpeed = calculatedPrintSpeed / 20; // Normalize to 20mm/s = 1x

                // Store calculated speed in metadata for display
                parseResult.metadata.calculatedPrintSpeed = calculatedPrintSpeed;
            }

            document.getElementById('speed').value = defaultSpeed;
            document.getElementById('speedValue').textContent = defaultSpeed.toFixed(1);
            this.animationEngine.setSpeed(defaultSpeed);

            // Enable controls
            document.getElementById('playPause').disabled = false;
            document.getElementById('reset').disabled = false;
            
            // Hide loading indicator
            document.getElementById('loading').style.display = 'none';
            
        } catch (error) {
            console.error('Error loading G-code file:', error);
            
            let errorMessage = error.message;
            if (error.message.includes('Maximum call stack size')) {
                errorMessage = 'File too large or complex to process. Please try a smaller G-code file.';
            }
            
            alert('Error loading G-code file: ' + errorMessage);
            
            // Hide loading indicator
            document.getElementById('loading').style.display = 'none';
        }
    }

    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const result = e.target.result;
                    console.log('File read successfully, size:', result.length, 'characters');
                    resolve(result);
                } catch (error) {
                    console.error('Error processing file content:', error);
                    reject(new Error('Error processing file content: ' + error.message));
                }
            };
            
            reader.onerror = (e) => {
                console.error('FileReader error:', e);
                reject(new Error('Failed to read file'));
            };
            
            reader.onprogress = (e) => {
                if (e.lengthComputable) {
                    const progress = Math.round((e.loaded / e.total) * 100);
                    console.log(`Reading file: ${progress}%`);
                }
            };
            
            try {
                reader.readAsText(file);
            } catch (error) {
                console.error('Error starting file read:', error);
                reject(new Error('Error starting file read: ' + error.message));
            }
        });
    }

    async parseFileInChunks(file) {
        console.log('Streaming parse of file:', file.name, 'size:', file.size, 'bytes');
        
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
        let commandCount = 0;
        
        // Decimation for large files
        let decimation = 1;
        const estimatedLines = fileSize / 50; // Rough estimate: 50 bytes per line
        if (estimatedLines > 200000) {
            decimation = Math.ceil(estimatedLines / 100000);
            console.log(`Large file detected. Using decimation factor: ${decimation}`);
        }
        
        while (offset < fileSize) {
            try {
                const chunk = await this.readFileChunk(file, offset, chunkSize);
                buffer += chunk;
                
                // Process complete lines from buffer
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // Keep incomplete line in buffer
                
                for (const line of lines) {
                    // Always process first 50 lines for metadata, then apply decimation
                    if (lineNumber < 50 || lineNumber % decimation === 0) {
                        this.parser.processLine(line.trim(), lineNumber);
                        if (line.trim().startsWith('G1') || line.trim().startsWith('G0')) {
                            commandCount++;
                        }
                    }
                    lineNumber++;
                }
                
                offset += chunkSize;
                
                // Progress feedback
                const progress = Math.min(100, Math.round((offset / fileSize) * 100));
                console.log(`Parsed ${progress}% (${commandCount} commands found, line ${lineNumber})`);
                
                // Yield to browser
                await new Promise(resolve => setTimeout(resolve, 1));
                
            } catch (error) {
                console.error('Error reading chunk:', error);
                throw new Error('Error reading file chunk: ' + error.message);
            }
        }
        
        // Process final buffer
        if (buffer.trim()) {
            this.parser.processLine(buffer.trim(), lineNumber);
        }
        
        console.log('Streaming parse complete. Commands:', this.parser.commands.length);
        
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
            reader.onerror = (e) => reject(new Error('Failed to read chunk'));
            
            reader.readAsText(blob);
        });
    }

    displayFileInfo(metadata, statistics) {
        const fileInfo = document.getElementById('fileInfo');
        const fileDetails = document.getElementById('fileDetails');
        
        let html = '<div class="space-y-1">';
        
        // Basic info
        if (metadata.shape) html += `<div><strong>Shape:</strong> ${metadata.shape}</div>`;
        if (metadata.diameter) html += `<div><strong>Diameter:</strong> ${metadata.diameter}mm</div>`;
        if (metadata.height) html += `<div><strong>Height:</strong> ${metadata.height}mm</div>`;
        if (metadata.layerHeight) html += `<div><strong>Layer Height:</strong> ${metadata.layerHeight}mm</div>`;
        if (metadata.calculatedPrintSpeed) html += `<div><strong>Print Speed:</strong> ${metadata.calculatedPrintSpeed.toFixed(1)}mm/s</div>`;
        
        // Print statistics
        html += '<div class="mt-2 pt-2 border-t border-gray-300">';
        html += `<div><strong>Commands:</strong> ${statistics.totalCommands}</div>`;
        html += `<div><strong>Layers:</strong> ${statistics.layers}</div>`;
        html += `<div><strong>Print Distance:</strong> ${statistics.printDistance}mm</div>`;
        html += `<div><strong>Est. Time:</strong> ${statistics.estimatedTime}</div>`;
        html += '</div>';
        
        // 5-axis info
        html += '<div class="mt-2 pt-2 border-t border-gray-300">';
        html += `<div><strong>Inverse Kinematics:</strong> ${metadata.inverseKinematics ? 'Yes' : 'No'}</div>`;
        if (metadata.inverseKinematics) {
            html += `<div><strong>LA Parameter:</strong> ${metadata.laParameter}</div>`;
            html += `<div><strong>LB Parameter:</strong> ${metadata.lbParameter}</div>`;
        }
        html += '</div>';
        
        html += '</div>';
        
        fileDetails.innerHTML = html;
        fileInfo.classList.remove('hidden');
    }

    displayIKAnalysis(analysis) {
        if (!analysis || analysis.totalCommands === 0) return;
        
        const fileDetails = document.getElementById('fileDetails');
        
        // Add IK analysis section
        let ikHtml = '<div class="mt-2 pt-2 border-t border-gray-300">';
        ikHtml += '<div><strong>IK Correction Analysis:</strong></div>';
        ikHtml += `<div class="text-xs">Max X: ±${analysis.summary.maxX}mm</div>`;
        ikHtml += `<div class="text-xs">Max Y: ±${analysis.summary.maxY}mm</div>`;
        ikHtml += `<div class="text-xs">Max Z: ±${analysis.summary.maxZ}mm</div>`;
        ikHtml += `<div class="text-xs">Avg corrections: ±${analysis.summary.avgX}, ±${analysis.summary.avgY}, ±${analysis.summary.avgZ}mm</div>`;
        ikHtml += '</div>';
        
        fileDetails.innerHTML += ikHtml;
    }

    togglePlayPause() {
        const button = document.getElementById('playPause');
        
        if (this.animationEngine.isPlaying) {
            this.animationEngine.pause();
            button.innerHTML = `
                <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3l14 9-14 9V3z"></path>
                </svg>
                Play Animation
            `;
        } else {
            this.animationEngine.play();
            button.innerHTML = `
                <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6"></path>
                </svg>
                Pause Animation
            `;
        }
    }

    resetAnimation() {
        this.animationEngine.reset();
        const button = document.getElementById('playPause');
        button.innerHTML = `
            <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3l14 9-14 9V3z"></path>
            </svg>
            Play Animation
        `;
    }

    updateProgress(progress) {
        const progressSlider = document.getElementById('progress');
        const progressText = document.getElementById('progressText');
        
        progressSlider.value = progress;
        progressText.textContent = `${Math.round(progress)}%`;
        
        // Calculate current layer
        if (this.currentData && this.currentData.metadata.layerHeight) {
            const currentStep = Math.floor((progress / 100) * this.animationEngine.commands.length);
            const command = this.animationEngine.commands[currentStep];
            if (command && command.z !== null) {
                const layer = Math.floor(command.z / this.currentData.metadata.layerHeight) + 1;
                document.getElementById('layer').textContent = layer;
            }
        }
    }

    updatePositionDisplay(position) {
        document.getElementById('posX').textContent = position.x.toFixed(3);
        document.getElementById('posY').textContent = position.y.toFixed(3);
        document.getElementById('posZ').textContent = position.z.toFixed(3);
        document.getElementById('posA').textContent = position.a.toFixed(3);
        document.getElementById('posB').textContent = position.b.toFixed(3);
    }
    
    toggleManualMode(enabled) {
        const advancedOptions = document.getElementById('advancedOptions');
        const manualControls = document.getElementById('manualControls');

        if (enabled) {
            // Show advanced options if hidden
            advancedOptions.classList.remove('hidden');
            // Show manual controls
            manualControls.classList.remove('hidden');

            // Values are already prefilled by prefillAdvancedOptions when file loads
        } else {
            // Hide manual controls
            manualControls.classList.add('hidden');

            // Revert to file-based settings if file is loaded
            if (this.currentData) {
                this.applyFileSettings();
            }
        }
    }
    
    applyManualSettings() {
        console.log('Applying manual settings...');

        if (!this.currentData) {
            alert('Please load a G-code file first');
            return;
        }

        // Get manual settings
        const manualMetadata = {
            ...this.currentData.metadata,
            inverseKinematics: document.getElementById('manualIK').checked,
            laParameter: parseFloat(document.getElementById('manualLA').value) || 0,
            lbParameter: parseFloat(document.getElementById('manualLB').value) || 46
        };

        // Reprocess with new settings
        this.processWithSettings(manualMetadata);

        // Update display
        this.displayFileInfo(manualMetadata, this.parser.getStatistics());
    }

    applyFileSettings() {
        if (!this.currentData) return;

        // Use original file metadata
        this.processWithSettings(this.currentData.metadata);
        this.displayFileInfo(this.currentData.metadata, this.parser.getStatistics());
    }

    processWithSettings(metadata) {
        // Process commands with specified settings
        if (metadata.inverseKinematics) {
            console.log('Applying IK with manual settings...');
            this.ikReverser = new InverseKinematicsReverser(
                metadata.laParameter,
                metadata.lbParameter
            );
            
            // Reverse the IK to get original coordinates
            const reversedCommands = this.ikReverser.reverseCommandArray(this.currentData.commands);
            this.animationEngine.loadCommands(reversedCommands);
            
            // Show IK analysis
            this.displayIKAnalysis(this.ikReverser.analyzeIKCorrections(this.currentData.commands));
        } else {
            console.log('Loading commands directly...');
            this.animationEngine.loadCommands(this.currentData.commands);
        }
        
        // Always show complete model after applying settings
        this.animationEngine.currentStep = this.animationEngine.commands.length;
        this.animationEngine.rebuildPrintPath();
        this.updateProgress(100);
    }
    
    prefillAdvancedOptions(metadata) {
        // Prefill the advanced options with current metadata
        document.getElementById('manualIK').checked = metadata.inverseKinematics || false;
        document.getElementById('manualLA').value = metadata.laParameter || 0;
        document.getElementById('manualLB').value = metadata.lbParameter || 46;
    }
}

// Initialize app when page loads
document.addEventListener('DOMContentLoaded', () => {
    // Wait for theme to load before initializing
    const initApp = () => {
        if (typeof getTheme === 'function' && getTheme()) {
            new GcodePreviewerApp();
        } else {
            setTimeout(initApp, 50);
        }
    };
    
    initApp();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (window.app && window.app.animationEngine) {
        window.app.animationEngine.dispose();
    }
});