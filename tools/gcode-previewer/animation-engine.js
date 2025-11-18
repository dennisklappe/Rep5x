// 5-Axis Animation Engine for Rep5x G-code Previewer
// Handles 3D visualization and animation of the printing process

class AnimationEngine {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.animationId = null;
        
        // Animation state
        this.isPlaying = false;
        this.currentStep = 0;
        this.commands = [];
        this.speed = 1.0;
        
        // 3D objects
        this.printhead = null;
        this.printPath = null;
        this.buildPlatform = null;
        this.axes = null;
        
        // Print path tracking
        this.printedPath = [];
        this.pathMaterial = null;
        
        // Current position
        this.currentPosition = { x: 0, y: 0, z: 0, a: 0, b: 0 };
        
        this.initThreeJS();
    }

    initThreeJS() {
        // Scene setup
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xf8fafc);
        
        // Camera
        this.camera = new THREE.PerspectiveCamera(
            45,
            this.canvas.offsetWidth / this.canvas.offsetHeight,
            0.1,
            1000
        );
        this.camera.position.set(120, 80, 120);
        this.camera.lookAt(0, 40, 0);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ 
            canvas: this.canvas, 
            antialias: true,
            alpha: true 
        });
        this.renderer.setSize(this.canvas.offsetWidth, this.canvas.offsetHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(100, 100, 50);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 500;
        directionalLight.shadow.camera.left = -100;
        directionalLight.shadow.camera.right = 100;
        directionalLight.shadow.camera.top = 100;
        directionalLight.shadow.camera.bottom = -100;
        this.scene.add(directionalLight);

        // Create build platform
        this.createBuildPlatform();
        
        // Create printhead
        this.createPrinthead();
        
        // Create axes indicator
        this.createAxes();
        
        // Mouse controls
        this.setupMouseControls();
        
        // Start render loop
        this.animate();
    }

    createBuildPlatform() {
        const platformGeometry = new THREE.PlaneGeometry(220, 220);
        const platformMaterial = new THREE.MeshLambertMaterial({ 
            color: 0xe2e8f0,
            transparent: true,
            opacity: 0.5 
        });
        this.buildPlatform = new THREE.Mesh(platformGeometry, platformMaterial);
        this.buildPlatform.rotation.x = -Math.PI / 2;
        this.buildPlatform.position.y = 0;
        this.buildPlatform.receiveShadow = true;
        this.scene.add(this.buildPlatform);

        const gridHelper = new THREE.GridHelper(220, 22, 0x94a3b8, 0xd1d5db);
        gridHelper.position.y = 0;
        this.scene.add(gridHelper);
    }

    createPrinthead() {
        // Create a simplified 5-axis printhead representation
        const group = new THREE.Group();
        
        // IMPORTANT: Position parts so nozzle TIP is at origin (0, 0, 0)
        // Main nozzle (shorter cylinder, height=12) - positioned to not overlap with cone
        const nozzleGeometry = new THREE.CylinderGeometry(2, 2, 12, 8);
        const nozzleMaterial = new THREE.MeshPhongMaterial({ color: 0x333333 });
        const nozzle = new THREE.Mesh(nozzleGeometry, nozzleMaterial);
        nozzle.position.set(0, 14, 0);  // Center at Y=14, extends from Y=8 to Y=20 (no overlap with cone)
        group.add(nozzle);
        
        // Hotend block - shift up accordingly
        const hotendGeometry = new THREE.BoxGeometry(15, 10, 15);
        const hotendMaterial = new THREE.MeshPhongMaterial({ color: 0x666666 });
        const hotend = new THREE.Mesh(hotendGeometry, hotendMaterial);
        hotend.position.set(0, 25, 0);  // Was 5, now 25 (shifted up 20)
        group.add(hotend);
        
        // Direction indicator (red cone with tip at origin)
        const arrowGeometry = new THREE.ConeGeometry(3, 8, 8);
        const arrowMaterial = new THREE.MeshPhongMaterial({ color: 0xff6b6b });
        const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
        arrow.rotation.x = Math.PI; // Flip cone to point down initially
        // Position cone so its TIP is at origin (Y=0) and extends upward into nozzle
        // With rotation.x = Math.PI, the tip points down to Y=0, center should be at Y=4
        arrow.position.set(0, 4, 0);  // Cone center at Y=4, tip at Y=0, top at Y=8
        group.add(arrow);
        
        // Store references
        group.nozzle = nozzle;
        group.hotend = hotend;
        group.arrow = arrow;
        
        this.printhead = group;
        this.scene.add(this.printhead);
    }

    createAxes() {
        // Create coordinate axes (X=red, Y=green, Z=blue)
        const axesGroup = new THREE.Group();
        
        const axisLength = 50;
        const axisRadius = 1;
        
        // G-code X-axis (red) - left/right
        const xGroup = new THREE.Group();
        const xShaft = new THREE.Mesh(
            new THREE.CylinderGeometry(axisRadius * 0.5, axisRadius * 0.5, axisLength * 0.8),
            new THREE.MeshBasicMaterial({ color: 0xff0000 })
        );
        const xHead = new THREE.Mesh(
            new THREE.ConeGeometry(axisRadius * 2, axisLength * 0.2),
            new THREE.MeshBasicMaterial({ color: 0xff0000 })
        );
        xShaft.rotation.z = Math.PI / 2;
        xShaft.position.x = axisLength * 0.35;
        xHead.rotation.z = -Math.PI / 2;
        xHead.position.x = axisLength * 0.8;
        xGroup.add(xShaft);
        xGroup.add(xHead);
        axesGroup.add(xGroup);
        
        // G-code Y-axis (green) - front/back (Three.js Z direction)
        const yGroup = new THREE.Group();
        const yShaft = new THREE.Mesh(
            new THREE.CylinderGeometry(axisRadius * 0.5, axisRadius * 0.5, axisLength * 0.8),
            new THREE.MeshBasicMaterial({ color: 0x00ff00 })
        );
        const yHead = new THREE.Mesh(
            new THREE.ConeGeometry(axisRadius * 2, axisLength * 0.2),
            new THREE.MeshBasicMaterial({ color: 0x00ff00 })
        );
        yShaft.rotation.x = Math.PI / 2;
        yShaft.position.z = axisLength * 0.35;
        yHead.rotation.x = Math.PI / 2;
        yHead.position.z = axisLength * 0.8;
        yGroup.add(yShaft);
        yGroup.add(yHead);
        axesGroup.add(yGroup);
        
        // G-code Z-axis (blue) - up/down (Three.js Y direction)
        const zGroup = new THREE.Group();
        const zShaft = new THREE.Mesh(
            new THREE.CylinderGeometry(axisRadius * 0.5, axisRadius * 0.5, axisLength * 0.8),
            new THREE.MeshBasicMaterial({ color: 0x0000ff })
        );
        const zHead = new THREE.Mesh(
            new THREE.ConeGeometry(axisRadius * 2, axisLength * 0.2),
            new THREE.MeshBasicMaterial({ color: 0x0000ff })
        );
        zShaft.position.y = axisLength * 0.35;
        zHead.position.y = axisLength * 0.8;
        zGroup.add(zShaft);
        zGroup.add(zHead);
        axesGroup.add(zGroup);
        
        this.axes = axesGroup;
        this.scene.add(this.axes);
    }

    setupMouseControls() {
        let isMouseDown = false;
        let mouseButton = null;
        let mouseX = 0, mouseY = 0;
        let cameraTarget = new THREE.Vector3(0, 40, 0);

        this.canvas.addEventListener('mousedown', (e) => {
            isMouseDown = true;
            mouseButton = e.button;
            mouseX = e.clientX;
            mouseY = e.clientY;
            
            if (e.button === 0) {
                this.canvas.style.cursor = 'grabbing';
            } else if (e.button === 2) {
                this.canvas.style.cursor = 'move';
            }
            e.preventDefault();
        });

        document.addEventListener('mouseup', () => {
            isMouseDown = false;
            mouseButton = null;
            this.canvas.style.cursor = 'grab';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isMouseDown) return;
            
            const deltaX = e.clientX - mouseX;
            const deltaY = e.clientY - mouseY;
            
            mouseX = e.clientX;
            mouseY = e.clientY;
            
            if (mouseButton === 0) {
                // Left button: orbit
                const spherical = new THREE.Spherical();
                spherical.setFromVector3(this.camera.position.clone().sub(cameraTarget));
                
                spherical.theta -= deltaX * 0.01;
                spherical.phi += deltaY * 0.01;
                spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));
                
                this.camera.position.copy(cameraTarget).add(new THREE.Vector3().setFromSpherical(spherical));
                this.camera.lookAt(cameraTarget);
                
            } else if (mouseButton === 2) {
                // Right button: pan
                const distance = this.camera.position.distanceTo(cameraTarget);
                const panSpeed = distance * 0.001;
                
                const left = new THREE.Vector3();
                const up = new THREE.Vector3();
                
                left.setFromMatrixColumn(this.camera.matrix, 0);
                up.setFromMatrixColumn(this.camera.matrix, 1);
                
                const panOffset = new THREE.Vector3();
                panOffset.addScaledVector(left, -deltaX * panSpeed);
                panOffset.addScaledVector(up, deltaY * panSpeed);
                
                this.camera.position.add(panOffset);
                cameraTarget.add(panOffset);
                this.camera.lookAt(cameraTarget);
            }
        });

        // Disable context menu on right click
        this.canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });

        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            
            const spherical = new THREE.Spherical();
            spherical.setFromVector3(this.camera.position.clone().sub(cameraTarget));
            
            spherical.radius += e.deltaY * 0.1;
            spherical.radius = Math.max(10, Math.min(1000, spherical.radius));
            
            this.camera.position.copy(cameraTarget).add(new THREE.Vector3().setFromSpherical(spherical));
            this.camera.lookAt(cameraTarget);
        });

        this.canvas.style.cursor = 'grab';
    }

    loadCommands(commands) {
        console.log('Loading commands into animation engine, total:', commands.length);
        
        // Filter in chunks to avoid stack overflow
        this.commands = [];
        const chunkSize = 1000;
        
        for (let i = 0; i < commands.length; i += chunkSize) {
            const chunk = commands.slice(i, i + chunkSize);
            const filteredChunk = chunk.filter(cmd => cmd.hasMovement);
            this.commands.push(...filteredChunk);
        }
        
        console.log('Filtered to movement commands:', this.commands.length);
        
        this.currentStep = this.commands.length;
        this.printedPath = [];
        
        // Clear existing print path
        if (this.printPath) {
            this.scene.remove(this.printPath);
        }
        
        // Show complete model by default
        this.rebuildPrintPath();
        
        // Reset position
        this.currentPosition = { x: 0, y: 0, z: 0, a: 0, b: 0 };
        this.updatePrinthead();
    }

    play() {
        // Only reset if we're at the end of the animation
        if (this.currentStep >= this.commands.length) {
            this.currentStep = 0;
            this.printedPath = [];
            if (this.printPath) {
                this.scene.remove(this.printPath);
                this.printPath = null;
            }
            this.updateProgressCallback(0);
        }
        
        this.isPlaying = true;
        this.playAnimation();
    }

    pause() {
        this.isPlaying = false;
    }

    reset() {
        this.pause();
        this.currentStep = 0;
        this.printedPath = [];
        
        if (this.printPath) {
            this.scene.remove(this.printPath);
            this.printPath = null;
        }
        
        this.currentPosition = { x: 0, y: 0, z: 0, a: 0, b: 0 };
        this.updatePrinthead();
        this.updateProgressCallback(0);
    }

    setSpeed(speed) {
        this.speed = Math.max(0.1, Math.min(5.0, speed));
    }

    setProgress(percentage) {
        const step = Math.floor((percentage / 100) * this.commands.length);
        this.currentStep = Math.max(0, Math.min(step, this.commands.length - 1));
        
        // Rebuild printed path up to current step
        this.rebuildPrintPath();
        this.updateCurrentPosition();
    }

    playAnimation() {
        if (!this.isPlaying || this.currentStep >= this.commands.length) {
            this.isPlaying = false;
            return;
        }

        // Process multiple steps based on speed
        const stepsPerFrame = Math.max(1, Math.floor(this.speed * 2));
        
        for (let i = 0; i < stepsPerFrame && this.currentStep < this.commands.length; i++) {
            this.processStep(this.currentStep);
            this.currentStep++;
        }

        this.updateCurrentPosition();
        this.updateProgressCallback((this.currentStep / this.commands.length) * 100);

        // Continue animation
        setTimeout(() => this.playAnimation(), 50); // ~20 FPS
    }

    processStep(stepIndex) {
        const command = this.commands[stepIndex];
        if (!command) return;

        // Update position
        if (command.x !== null) this.currentPosition.x = command.x;
        if (command.y !== null) this.currentPosition.y = command.y;
        if (command.z !== null) this.currentPosition.z = command.z;
        if (command.a !== null) this.currentPosition.a = command.a;
        if (command.b !== null) this.currentPosition.b = command.b;

        // Add to printed path if extruding - use direct coordinate mapping
        if (command.e !== null && command.e > 0) {
            // Direct mapping: G-code X→Three.js X, G-code Y→Three.js Z, G-code Z→Three.js Y
            const printPos = new THREE.Vector3(
                this.currentPosition.x,  // G-code X → Three.js X
                this.currentPosition.z,  // G-code Z → Three.js Y (up)
                this.currentPosition.y   // G-code Y → Three.js Z (depth)
            );
            
            this.printedPath.push(printPos);
            this.updatePrintPath();
        }
    }

    rebuildPrintPath() {
        this.printedPath = [];
        let position = { x: 0, y: 0, z: 0, a: 0, b: 0 };

        for (let i = 0; i < this.currentStep; i++) {
            const command = this.commands[i];
            if (!command) continue;

            if (command.x !== null) position.x = command.x;
            if (command.y !== null) position.y = command.y;
            if (command.z !== null) position.z = command.z;
            if (command.a !== null) position.a = command.a;
            if (command.b !== null) position.b = command.b;

            if (command.e !== null && command.e > 0) {
                // Direct mapping: G-code X→Three.js X, G-code Y→Three.js Z, G-code Z→Three.js Y
                const printPos = new THREE.Vector3(
                    position.x,  // G-code X → Three.js X
                    position.z,  // G-code Z → Three.js Y (up)
                    position.y   // G-code Y → Three.js Z (depth)
                );
                
                this.printedPath.push(printPos);
            }
        }

        this.updatePrintPath();
    }

    updateCurrentPosition() {
        if (this.currentStep > 0 && this.currentStep <= this.commands.length) {
            const command = this.commands[this.currentStep - 1];
            if (command) {
                if (command.x !== null) this.currentPosition.x = command.x;
                if (command.y !== null) this.currentPosition.y = command.y;
                if (command.z !== null) this.currentPosition.z = command.z;
                if (command.a !== null) this.currentPosition.a = command.a;
                if (command.b !== null) this.currentPosition.b = command.b;
            }
        }

        this.updatePrinthead();
        this.updatePositionCallback(this.currentPosition);
    }

    updatePrinthead() {
        if (!this.printhead) return;

        // Direct mapping - no offset needed since nozzle tip is at group origin
        this.printhead.position.set(
            this.currentPosition.x,      // G-code X → Three.js X
            this.currentPosition.z,      // G-code Z → Three.js Y (up) - NO OFFSET
            this.currentPosition.y       // G-code Y → Three.js Z (depth)
        );

        // Set 5-axis orientation with correct coordinate system mapping
        // Reset rotation first
        this.printhead.rotation.set(0, 0, 0);
        
        // Apply A rotation (yaw around vertical axis = Three.js Y)
        const aRadians = this.currentPosition.a * Math.PI / 180;
        this.printhead.rotateY(aRadians);
        
        // Apply B rotation (should point left/right, so rotate around Three.js Z)
        const bRadians = this.currentPosition.b * Math.PI / 180;
        this.printhead.rotateZ(bRadians);
    }

    updatePrintPath() {
        if (this.printedPath.length < 2) return;

        // Remove existing path
        if (this.printPath) {
            this.scene.remove(this.printPath);
        }

        // Create new path
        const pathGeometry = new THREE.BufferGeometry().setFromPoints(this.printedPath);
        const pathMaterial = new THREE.LineBasicMaterial({ 
            color: 0x32D74B, // Rep5x green
            linewidth: 3 
        });
        
        this.printPath = new THREE.Line(pathGeometry, pathMaterial);
        this.scene.add(this.printPath);
    }

    animate() {
        this.animationId = requestAnimationFrame(() => this.animate());
        this.renderer.render(this.scene, this.camera);
    }

    // Callback functions (to be set by the main app)
    updateProgressCallback(progress) {
        // Override this in main app
    }

    updatePositionCallback(position) {
        // Override this in main app
    }

    // Visibility controls
    showPrintPath(show) {
        if (this.printPath) {
            this.printPath.visible = show;
        }
    }

    showPrinthead(show) {
        if (this.printhead) {
            this.printhead.visible = show;
        }
    }

    showAxes(show) {
        if (this.axes) {
            this.axes.visible = show;
        }
    }

    // Cleanup
    dispose() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        if (this.renderer) {
            this.renderer.dispose();
        }
    }
}