// 5-axis animation engine for Rep5x G-code viewer

class AnimationEngine {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);

        // Renderer
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.animationId = null;

        // Animation state
        this.isPlaying = false;
        this.currentStep = 0;
        this.commands = [];
        this.speed = 1.0;
        this.lastFeedrate = 1800;
        this.onPauseCallback = null;

        // 3D objects
        this.printhead = null;
        this.realisticHead = null;
        this.currentPrintheadId = 'ender3-v3-se';
        this.printPath = null;
        this.buildPlatform = null;
        this.axes = null;

        // Collision detection
        this.collisionPoints = [];
        this.collisionMarkers = null;
        this.collisionEnabled = false;

        // Print path
        this.printedPath = [];
        this.pathMaterial = null;

        // Current position
        this.currentPosition = { x: 0, y: 0, z: 0, a: 0, b: 0 };

        this.initThreeJS();
    }

    initThreeJS() {
        // Scene
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

        this.createBuildPlatform();
        this.createPrinthead();
        this.createRealisticPrinthead();
        this.createAxes();
        this.setupMouseControls();
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
        const group = new THREE.Group();

        // Nozzle cylinder
        const nozzleGeometry = new THREE.CylinderGeometry(2, 2, 12, 8);
        const nozzleMaterial = new THREE.MeshPhongMaterial({ color: 0x333333 });
        const nozzle = new THREE.Mesh(nozzleGeometry, nozzleMaterial);
        nozzle.position.set(0, 14, 0);
        group.add(nozzle);

        // Hotend block
        const hotendGeometry = new THREE.BoxGeometry(15, 10, 15);
        const hotendMaterial = new THREE.MeshPhongMaterial({ color: 0x666666 });
        const hotend = new THREE.Mesh(hotendGeometry, hotendMaterial);
        hotend.position.set(0, 25, 0);
        group.add(hotend);

        // Direction indicator (red cone with tip at nozzle)
        const arrowGeometry = new THREE.ConeGeometry(3, 8, 8);
        const arrowMaterial = new THREE.MeshPhongMaterial({ color: 0xff6b6b });
        const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
        arrow.rotation.x = Math.PI;
        arrow.position.set(0, 4, 0);
        group.add(arrow);

        // A-axis rotation indicator (green arrow)
        const markerGeometry = new THREE.ConeGeometry(2, 8, 4);
        const markerMaterial = new THREE.MeshPhongMaterial({ color: 0x00ff00 });
        const marker = new THREE.Mesh(markerGeometry, markerMaterial);
        marker.rotation.z = Math.PI / 2;
        marker.position.set(-10, 15, 0);
        group.add(marker);

        group.nozzle = nozzle;
        group.hotend = hotend;
        group.arrow = arrow;
        group.marker = marker;

        this.printhead = group;
        this.scene.add(this.printhead);
    }

    createRealisticPrinthead() {
        // Use default printhead from registry
        this.setPrinthead(this.currentPrintheadId);
    }

    setPrinthead(printheadId) {
        const printhead = PrintheadRegistry.get(printheadId);
        if (!printhead) return false;

        // Remove existing realistic head
        if (this.realisticHead) {
            const wasVisible = this.realisticHead.visible;
            this.scene.remove(this.realisticHead);
            this.realisticHead = printhead.createMesh();
            this.realisticHead.visible = wasVisible;
        } else {
            this.realisticHead = printhead.createMesh();
            this.realisticHead.visible = false;
        }

        this.currentPrintheadId = printheadId;
        this.scene.add(this.realisticHead);
        this.updatePrinthead();

        return true;
    }

    getCurrentPrintheadId() {
        return this.currentPrintheadId;
    }

    getCurrentPrintheadParams() {
        const printhead = PrintheadRegistry.get(this.currentPrintheadId);
        return printhead ? printhead.getCollisionParams() : null;
    }

    createAxes() {
        const axesGroup = new THREE.Group();
        const axisLength = 50;
        const axisRadius = 1;

        // X-axis (red)
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

        // Y-axis (green)
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

        // Z-axis (blue)
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

        // Left click: orbit, Right click: pan
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
                const spherical = new THREE.Spherical();
                spherical.setFromVector3(this.camera.position.clone().sub(cameraTarget));

                spherical.theta -= deltaX * 0.01;
                spherical.phi += deltaY * 0.01;
                spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));

                this.camera.position.copy(cameraTarget).add(new THREE.Vector3().setFromSpherical(spherical));
                this.camera.lookAt(cameraTarget);

            } else if (mouseButton === 2) {
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
        this.commands = [];
        const chunkSize = 5000;

        for (let i = 0; i < commands.length; i += chunkSize) {
            const chunk = commands.slice(i, i + chunkSize);
            for (let j = 0; j < chunk.length; j++) {
                if (chunk[j] && chunk[j].hasMovement) {
                    this.commands.push(chunk[j]);
                }
            }
        }

        this.currentStep = this.commands.length;
        this.printedPath = [];

        if (this.printPath) {
            this.scene.remove(this.printPath);
        }

        this.currentStep = this.commands.length;
        this.rebuildPrintPath();

        this.currentPosition = { x: 0, y: 0, z: 0, a: 0, b: 0 };
        this.updatePrinthead();
    }

    play() {
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
        this.speed = Math.max(1, Math.min(20, speed));
    }

    setProgress(percentage) {
        const step = Math.floor((percentage / 100) * this.commands.length);
        this.currentStep = Math.max(0, Math.min(step, this.commands.length - 1));

        this.rebuildPrintPath();
        this.updateCurrentPosition();

        if (this.collisionEnabled && this.collisionPoints.length > 0) {
            this.updateCollisionMarkers();
        }
    }

    playAnimation() {
        if (!this.isPlaying || this.currentStep >= this.commands.length) {
            this.isPlaying = false;
            return;
        }

        const command = this.commands[this.currentStep];

        if (command && command.type === 'reset') {
            this.processStep(this.currentStep);
            this.currentStep++;
            this.updateProgressCallback((this.currentStep / this.commands.length) * 100);
            setTimeout(() => this.playAnimation(), 0);
            return;
        }

        let distance = 0;
        if (command) {
            const dx = (command.x !== null ? command.x : this.currentPosition.x) - this.currentPosition.x;
            const dy = (command.y !== null ? command.y : this.currentPosition.y) - this.currentPosition.y;
            const dz = (command.z !== null ? command.z : this.currentPosition.z) - this.currentPosition.z;
            distance = Math.sqrt(dx*dx + dy*dy + dz*dz);
        }

        const feedrate = (command && command.f) ? command.f : this.lastFeedrate || 1800;
        if (command && command.f) this.lastFeedrate = command.f;

        let delayMs = (distance * 60000) / feedrate / this.speed;
        const minDelay = Math.max(5, distance * 50 / this.speed);
        delayMs = Math.max(minDelay, Math.min(5000, delayMs));

        this.processStep(this.currentStep);
        this.currentStep++;

        this.updateCurrentPosition();
        this.updateProgressCallback((this.currentStep / this.commands.length) * 100);

        setTimeout(() => this.playAnimation(), delayMs);
    }

    processStep(stepIndex) {
        const command = this.commands[stepIndex];
        if (!command) return;

        if (command.type === 'reset') {
            if (command.x !== null) this.currentPosition.x = command.x;
            if (command.y !== null) this.currentPosition.y = command.y;
            if (command.z !== null) this.currentPosition.z = command.z;
            if (command.a !== null) this.currentPosition.a = command.a;
            if (command.b !== null) this.currentPosition.b = command.b;
            return;
        }

        if (command.x !== null) this.currentPosition.x = command.x;
        if (command.y !== null) this.currentPosition.y = command.y;
        if (command.z !== null) this.currentPosition.z = command.z;
        if (command.a !== null) this.currentPosition.a = command.a;
        if (command.b !== null) this.currentPosition.b = command.b;

        if (command.e !== null && command.e > 0) {
            const printPos = new THREE.Vector3(
                this.currentPosition.x,
                this.currentPosition.z,
                -this.currentPosition.y
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
            if (command.type === 'reset') continue;

            if (command.x !== null) position.x = command.x;
            if (command.y !== null) position.y = command.y;
            if (command.z !== null) position.z = command.z;
            if (command.a !== null) position.a = command.a;
            if (command.b !== null) position.b = command.b;

            if (command.e !== null && command.e > 0) {
                const printPos = new THREE.Vector3(
                    position.x,
                    position.z,
                    -position.y
                );
                this.printedPath.push(printPos);
            }
        }

        this.updatePrintPath();
    }

    updateCurrentPosition() {
        if (this.currentStep > 0 && this.currentStep <= this.commands.length) {
            const command = this.commands[this.currentStep - 1];
            if (command && command.type !== 'reset') {
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
        const position = new THREE.Vector3(
            this.currentPosition.x,
            this.currentPosition.z,
            -this.currentPosition.y
        );

        const aRadians = -this.currentPosition.a * Math.PI / 180;
        const bRadians = -this.currentPosition.b * Math.PI / 180;

        if (this.printhead) {
            this.printhead.position.copy(position);
            this.printhead.rotation.set(0, 0, 0);
            this.printhead.rotateY(aRadians);
            this.printhead.rotateZ(bRadians);
        }

        if (this.realisticHead) {
            this.realisticHead.position.copy(position);
            this.realisticHead.rotation.set(0, 0, 0);
            this.realisticHead.rotateY(aRadians);
            this.realisticHead.rotateZ(bRadians);
        }
    }

    updatePrintPath() {
        if (this.printedPath.length < 2) return;

        if (this.printPath) {
            this.scene.remove(this.printPath);
        }

        const pathGeometry = new THREE.BufferGeometry().setFromPoints(this.printedPath);
        const pathMaterial = new THREE.LineBasicMaterial({
            color: 0x32D74B,
            linewidth: 3
        });

        this.printPath = new THREE.Line(pathGeometry, pathMaterial);
        this.scene.add(this.printPath);
    }

    animate() {
        this.animationId = requestAnimationFrame(() => this.animate());
        this.renderer.render(this.scene, this.camera);
    }

    // Callbacks (set by main app)
    updateProgressCallback(progress) {}
    updatePositionCallback(position) {}

    // Visibility controls
    showPrinthead(show) {
        if (this.printhead) {
            this.printhead.visible = show;
        }
    }

    showAxisMarker(show) {
        if (this.printhead && this.printhead.marker) {
            this.printhead.marker.visible = show;
        }
    }

    showRealisticPrinthead(show) {
        if (this.realisticHead) {
            this.realisticHead.visible = show;
        }
    }

    // Collision detection
    setCollisionDetection(enabled) {
        this.collisionEnabled = enabled;
        if (!enabled) {
            this.clearCollisionMarkers();
        }
    }

    setCollisionPoints(points) {
        this.collisionPoints = points;
    }

    clearCollisionMarkers() {
        if (this.collisionMarkers) {
            this.scene.remove(this.collisionMarkers);
            this.collisionMarkers = null;
        }
    }

    updateCollisionMarkers() {
        this.clearCollisionMarkers();

        if (this.collisionPoints.length === 0) return;

        const visibleCollisions = this.collisionPoints.filter(c => c.step <= this.currentStep);
        if (visibleCollisions.length === 0) return;

        const group = new THREE.Group();

        const maxMarkers = 100;
        const step = Math.max(1, Math.floor(visibleCollisions.length / maxMarkers));
        const sampledCollisions = visibleCollisions.filter((_, i) => i % step === 0);

        const sphereGeometry = new THREE.SphereGeometry(1.5, 8, 8);
        const sphereMaterial = new THREE.MeshBasicMaterial({
            color: 0xff0000,
            transparent: true,
            opacity: 0.8
        });

        for (const collision of sampledCollisions) {
            const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
            sphere.position.set(
                collision.position.x,
                collision.position.z,
                -collision.position.y
            );
            group.add(sphere);
        }

        this.collisionMarkers = group;
        this.scene.add(this.collisionMarkers);
    }

    dispose() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        if (this.renderer) {
            this.renderer.dispose();
        }
    }
}
