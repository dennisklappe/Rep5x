// 5-axis animation engine for Rep5x G-code viewer

class AnimationEngine {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.cameraControls = null;
        this.animationId = null;

        this.isPlaying = false;
        this.currentStep = 0;
        this.commands = [];
        this.speed = 1.0;
        this.lastFeedrate = 1800;

        this.printhead = null;
        this.realisticHead = null;
        this.currentPrintheadId = 'ender3-v3-se';
        this.printPath = null;
        this.printedPath = [];

        this.collisionPoints = [];
        this.collisionMarkers = null;
        this.collisionEnabled = false;

        this.position = { x: 0, y: 0, z: 0, c: 0, b: 0 };

        this.initThreeJS();
    }

    initThreeJS() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xf8fafc);

        this.camera = new THREE.PerspectiveCamera(45, this.canvas.offsetWidth / this.canvas.offsetHeight, 0.1, 1000);
        this.camera.position.set(120, 80, 120);
        this.camera.lookAt(0, 40, 0);

        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
        this.renderer.setSize(this.canvas.offsetWidth, this.canvas.offsetHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        SceneObjects.createLighting(this.scene);
        SceneObjects.createBuildPlatform(this.scene);
        this.printhead = SceneObjects.createSchematicPrinthead();
        this.scene.add(this.printhead);
        this.scene.add(SceneObjects.createAxes());

        this.setPrinthead(this.currentPrintheadId);
        this.cameraControls = new CameraControls(this.camera, this.canvas);
        this.animate();
    }

    // Convert G-code position to Three.js coordinates
    toThreePos(pos) {
        return new THREE.Vector3(pos.x, pos.z, -pos.y);
    }

    // Apply command values to position object
    applyCommand(cmd, pos) {
        if (cmd.x !== null) pos.x = cmd.x;
        if (cmd.y !== null) pos.y = cmd.y;
        if (cmd.z !== null) pos.z = cmd.z;
        if (cmd.c !== null) pos.c = cmd.c;
        if (cmd.b !== null) pos.b = cmd.b;
    }

    // Printhead management
    setPrinthead(printheadId) {
        const ph = PrintheadRegistry.get(printheadId);
        if (!ph) return false;

        const wasVisible = this.realisticHead?.visible || false;
        if (this.realisticHead) this.scene.remove(this.realisticHead);

        this.realisticHead = ph.createMesh();
        this.realisticHead.visible = wasVisible;
        this.currentPrintheadId = printheadId;
        this.scene.add(this.realisticHead);
        this.updatePrinthead();
        return true;
    }

    getCurrentPrintheadId() { return this.currentPrintheadId; }

    getCurrentPrintheadParams() {
        const ph = PrintheadRegistry.get(this.currentPrintheadId);
        return ph ? ph.getCollisionParams() : null;
    }

    // Command loading
    loadCommands(commands) {
        this.commands = commands.filter(cmd => cmd?.hasMovement);
        if (this.printPath) this.scene.remove(this.printPath);

        this.currentStep = this.commands.length;
        this.rebuildPrintPath();
        this.position = { x: 0, y: 0, z: 0, c: 0, b: 0 };
        this.updatePrinthead();
    }

    // Playback
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

    pause() { this.isPlaying = false; }

    reset() {
        this.pause();
        this.currentStep = 0;
        this.printedPath = [];
        if (this.printPath) {
            this.scene.remove(this.printPath);
            this.printPath = null;
        }
        this.position = { x: 0, y: 0, z: 0, c: 0, b: 0 };
        this.updatePrinthead();
        this.updateProgressCallback(0);
    }

    setSpeed(speed) { this.speed = Math.max(1, Math.min(20, speed)); }

    setProgress(percentage) {
        this.currentStep = Math.floor((percentage / 100) * this.commands.length);
        this.currentStep = Math.max(0, Math.min(this.currentStep, this.commands.length - 1));
        this.rebuildPrintPath();
        this.syncPosition();
        if (this.collisionEnabled && this.collisionPoints.length > 0) {
            this.updateCollisionMarkers();
        }
    }

    playAnimation() {
        if (!this.isPlaying || this.currentStep >= this.commands.length) {
            this.isPlaying = false;
            return;
        }

        const cmd = this.commands[this.currentStep];
        if (cmd?.type === 'reset') {
            this.applyCommand(cmd, this.position);
            this.currentStep++;
            this.updateProgressCallback((this.currentStep / this.commands.length) * 100);
            setTimeout(() => this.playAnimation(), 0);
            return;
        }

        const prevPos = { ...this.position };
        this.applyCommand(cmd, this.position);

        const dx = this.position.x - prevPos.x;
        const dy = this.position.y - prevPos.y;
        const dz = this.position.z - prevPos.z;
        const distance = Math.sqrt(dx*dx + dy*dy + dz*dz);

        const feedrate = cmd?.f || this.lastFeedrate || 1800;
        if (cmd?.f) this.lastFeedrate = cmd.f;

        if (cmd?.e > 0) {
            this.printedPath.push(this.toThreePos(this.position));
            this.updatePrintPath();
        }

        this.currentStep++;
        this.updatePrinthead();
        this.updatePositionCallback(this.position);
        this.updateProgressCallback((this.currentStep / this.commands.length) * 100);

        const delayMs = Math.max(5, Math.min(5000, (distance * 60000) / feedrate / this.speed));
        setTimeout(() => this.playAnimation(), delayMs);
    }

    rebuildPrintPath() {
        this.printedPath = [];
        const pos = { x: 0, y: 0, z: 0, c: 0, b: 0 };

        for (let i = 0; i < this.currentStep; i++) {
            const cmd = this.commands[i];
            if (!cmd || cmd.type === 'reset') continue;
            this.applyCommand(cmd, pos);
            if (cmd.e > 0) this.printedPath.push(this.toThreePos(pos));
        }
        this.updatePrintPath();
    }

    syncPosition() {
        if (this.currentStep > 0) {
            const pos = { x: 0, y: 0, z: 0, c: 0, b: 0 };
            for (let i = 0; i < this.currentStep; i++) {
                const cmd = this.commands[i];
                if (cmd && cmd.type !== 'reset') this.applyCommand(cmd, pos);
            }
            this.position = pos;
        }
        this.updatePrinthead();
        this.updatePositionCallback(this.position);
    }

    updatePrintPath() {
        if (this.printedPath.length < 2) return;
        if (this.printPath) this.scene.remove(this.printPath);

        const geometry = new THREE.BufferGeometry().setFromPoints(this.printedPath);
        const material = new THREE.LineBasicMaterial({ color: 0x32D74B, linewidth: 3 });
        this.printPath = new THREE.Line(geometry, material);
        this.scene.add(this.printPath);
    }

    updatePrinthead() {
        const pos = this.toThreePos(this.position);
        const cRad = -this.position.c * Math.PI / 180;
        const bRad = -this.position.b * Math.PI / 180;

        [this.printhead, this.realisticHead].forEach(head => {
            if (head) {
                head.position.copy(pos);
                head.rotation.set(0, 0, 0);
                head.rotateY(cRad);
                head.rotateZ(bRad);
            }
        });
    }

    animate() {
        this.animationId = requestAnimationFrame(() => this.animate());
        this.renderer.render(this.scene, this.camera);
    }

    // Callbacks
    updateProgressCallback(progress) {}
    updatePositionCallback(position) {}

    // Visibility
    showPrinthead(show) { if (this.printhead) this.printhead.visible = show; }
    showAxisMarker(show) { if (this.printhead?.marker) this.printhead.marker.visible = show; }
    showRealisticPrinthead(show) { if (this.realisticHead) this.realisticHead.visible = show; }

    // Collision markers
    setCollisionDetection(enabled) {
        this.collisionEnabled = enabled;
        if (!enabled) this.clearCollisionMarkers();
    }

    setCollisionPoints(points) { this.collisionPoints = points; }

    clearCollisionMarkers() {
        if (this.collisionMarkers) {
            this.scene.remove(this.collisionMarkers);
            this.collisionMarkers = null;
        }
    }

    updateCollisionMarkers() {
        this.clearCollisionMarkers();
        if (this.collisionPoints.length === 0) return;

        const visible = this.collisionPoints.filter(c => c.step <= this.currentStep);
        if (visible.length === 0) return;

        const step = Math.max(1, Math.floor(visible.length / 100));
        const sampled = visible.filter((_, i) => i % step === 0);

        const geometry = new THREE.SphereGeometry(1.5, 8, 8);
        const material = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.8 });

        const group = new THREE.Group();
        for (const c of sampled) {
            const sphere = new THREE.Mesh(geometry, material);
            sphere.position.set(c.position.x, c.position.z, -c.position.y);
            group.add(sphere);
        }

        this.collisionMarkers = group;
        this.scene.add(this.collisionMarkers);
    }

    dispose() {
        if (this.animationId) cancelAnimationFrame(this.animationId);
        if (this.renderer) this.renderer.dispose();
    }
}
