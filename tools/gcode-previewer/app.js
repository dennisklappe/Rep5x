// Main application for Rep5x 5-Axis G-code Previewer
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
            console.log('Initializing app...');
            // Initialize animation engine
            this.animationEngine = new AnimationEngine('canvas3d');
            console.log('Animation engine created');
            
            // Set up callbacks
            this.animationEngine.updateProgressCallback = (progress) => this.updateProgress(progress);
            this.animationEngine.updatePositionCallback = (position) => this.updatePositionDisplay(position);
            
            // Set up event listeners
            this.setupEventListeners();
            console.log('Event listeners set up');
            
            // Hide loading indicator
            document.getElementById('loading').style.display = 'none';
            console.log('App initialized successfully');
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
            console.log('Loading G-code file:', file.name);
            // Show loading indicator
            document.getElementById('loading').style.display = 'flex';
            
            const text = await this.readFileAsText(file);
            console.log('File read, length:', text.length);
            
            const parseResult = await this.parser.parse(text);
            console.log('Parse result:', parseResult);
            
            this.currentData = parseResult;
            this.displayFileInfo(parseResult.metadata, this.parser.getStatistics());
            
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
            
            // Enable controls
            document.getElementById('playPause').disabled = false;
            document.getElementById('reset').disabled = false;
            
            // Hide loading indicator
            document.getElementById('loading').style.display = 'none';
            
        } catch (error) {
            console.error('Error loading G-code file:', error);
            alert('Error loading G-code file: ' + error.message);
            
            // Hide loading indicator
            document.getElementById('loading').style.display = 'none';
        }
    }

    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error('Failed to read file'));
            reader.readAsText(file);
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
        html += `<div><strong>A-axis Optimization:</strong> ${metadata.aAxisOptimization ? 'Yes' : 'No'}</div>`;
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