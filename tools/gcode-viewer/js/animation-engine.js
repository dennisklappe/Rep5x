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
        this.speed = 10.0;
        this.lastFeedrate = 1800;

        this.printhead = null;
        this.realisticHead = null;
        this.currentPrintheadId = 'ender3-v3-se';
        this.printPath = null;
        this.printedPath = [];  // Array of segments, each segment is array of points
        this.currentSegment = [];  // Current segment being built during playback
        this.lastExtrusionPos = null;  // Track last extrusion position for travel moves
        this.travelPath = null;
        this.travelMoves = [];  // Array of {from, to} travel moves
        this.showTravelMoves = false;

        this.collisionPoints = [];
        this.collisionMarkers = null;
        this.collisionEnabled = false;

        this.position = { x: 0, y: 0, z: 0, c: 0, b: 0 };

        // Bed size (can be changed via settings)
        this.bedSizeX = 200;
        this.bedSizeY = 200;

        this.initThreeJS();
    }

    initThreeJS() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xf8fafc);

        this.camera = new THREE.PerspectiveCamera(45, this.canvas.offsetWidth / this.canvas.offsetHeight, 0.1, 1000);

        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
        this.renderer.setSize(this.canvas.offsetWidth, this.canvas.offsetHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        SceneObjects.createLighting(this.scene);
        SceneObjects.createBuildPlatform(this.scene, this.bedSizeX, this.bedSizeY);
        this.printhead = SceneObjects.createSchematicPrinthead();
        this.scene.add(this.printhead);
        this.scene.add(SceneObjects.createAxes());

        this.setPrinthead(this.currentPrintheadId);

        // Position camera based on bed size
        this.updateCameraForBedSize();
        this.animate();
    }

    updateCameraForBedSize() {
        const centerX = this.bedSizeX / 2;
        const centerY = this.bedSizeY / 2;
        const maxSize = Math.max(this.bedSizeX, this.bedSizeY);

        // Position camera to view bed from corner
        this.camera.position.set(maxSize * 1.3, maxSize * 0.8, maxSize * 0.4);
        this.camera.lookAt(centerX, 20, -centerY);

        // Update camera controls target
        const target = new THREE.Vector3(centerX, 20, -centerY);
        if (this.cameraControls) {
            this.cameraControls.target = target;
        } else {
            this.cameraControls = new CameraControls(this.camera, this.canvas, target);
        }
    }

    setBedSize(sizeX, sizeY) {
        this.bedSizeX = sizeX;
        this.bedSizeY = sizeY;

        // Remove old platform and grid
        const oldPlatform = this.scene.getObjectByName('buildPlatform');
        const oldGrid = this.scene.getObjectByName('buildGrid');
        if (oldPlatform) this.scene.remove(oldPlatform);
        if (oldGrid) this.scene.remove(oldGrid);

        // Create new platform
        SceneObjects.createBuildPlatform(this.scene, sizeX, sizeY);

        // Update camera
        this.updateCameraForBedSize();
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

    // Convert hex color to normalized RGB (0-1 range)
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16) / 255,
            g: parseInt(result[2], 16) / 255,
            b: parseInt(result[3], 16) / 255
        } : { r: 0.196, g: 0.843, b: 0.294 };
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

        // Clear all existing paths
        if (this.printPath) this.scene.remove(this.printPath);
        if (this.travelPath) this.scene.remove(this.travelPath);
        this.printPath = null;
        this.travelPath = null;

        // Reset all path data
        this.printedPath = [];
        this.currentSegment = [];
        this.lastExtrusionPos = null;
        this.travelMoves = [];

        // Reset position
        this.position = { x: 0, y: 0, z: 0, c: 0, b: 0 };

        // Build the path
        this.currentStep = this.commands.length;
        this.rebuildPrintPath();
        this.updatePrinthead();
    }

    // Playback
    play() {
        if (this.currentStep >= this.commands.length) {
            this.currentStep = 0;
            this.printedPath = [];
            this.currentSegment = [];
            this.lastExtrusionPos = null;
            this.travelMoves = [];
            if (this.printPath) {
                this.scene.remove(this.printPath);
                this.printPath = null;
            }
            if (this.travelPath) {
                this.scene.remove(this.travelPath);
                this.travelPath = null;
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
        this.currentSegment = [];
        this.lastExtrusionPos = null;
        this.travelMoves = [];
        if (this.printPath) {
            this.scene.remove(this.printPath);
            this.printPath = null;
        }
        if (this.travelPath) {
            this.scene.remove(this.travelPath);
            this.travelPath = null;
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
            // Save final segment if any
            if (this.currentSegment.length > 0) {
                this.printedPath.push(this.currentSegment);
                this.currentSegment = [];
                this.updatePrintPath();
            }
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
            // Starting a new segment - add the start point first
            if (this.currentSegment.length === 0) {
                this.currentSegment.push({
                    point: this.toThreePos(prevPos),
                    b: Math.abs(prevPos.b),
                    z: prevPos.z
                });
            }
            // Add end point of this extrusion move
            this.currentSegment.push({
                point: this.toThreePos(this.position),
                b: Math.abs(this.position.b),
                z: this.position.z
            });
            this.lastExtrusionPos = { ...this.position };

            // Update path with current segment included
            const allSegments = [...this.printedPath, this.currentSegment];
            this.updatePrintPathWithSegments(allSegments);
        } else if (this.currentSegment.length > 0) {
            // Travel move after extrusion - save segment and record travel
            this.printedPath.push(this.currentSegment);

            if (this.lastExtrusionPos) {
                this.travelMoves.push({
                    from: this.toThreePos(this.lastExtrusionPos),
                    to: this.toThreePos(this.position)
                });
                this.updateTravelPath();
            }

            this.currentSegment = [];
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
        this.printedPath = [];  // Array of segments
        this.travelMoves = [];  // Array of travel moves
        const pos = { x: 0, y: 0, z: 0, c: 0, b: 0 };
        let currentSegment = [];
        let lastExtrusionPos = null;
        let wasExtruding = false;

        for (let i = 0; i < this.currentStep; i++) {
            const cmd = this.commands[i];
            if (!cmd || cmd.type === 'reset') continue;

            const prevPos = { ...pos };
            this.applyCommand(cmd, pos);

            if (cmd.e > 0) {
                // Starting a new segment - add the start point first
                if (!wasExtruding) {
                    currentSegment.push({
                        point: this.toThreePos(prevPos),
                        b: Math.abs(prevPos.b),
                        z: prevPos.z
                    });
                }
                // Add end point of this extrusion move
                currentSegment.push({
                    point: this.toThreePos(pos),
                    b: Math.abs(pos.b),
                    z: pos.z
                });
                lastExtrusionPos = { ...pos };
                wasExtruding = true;
            } else {
                if (currentSegment.length > 0) {
                    // Travel move after extrusion - save segment and record travel
                    this.printedPath.push(currentSegment);

                    // Record travel from last extrusion point to current position
                    if (lastExtrusionPos) {
                        this.travelMoves.push({
                            from: this.toThreePos(lastExtrusionPos),
                            to: this.toThreePos(pos)
                        });
                    }
                    currentSegment = [];
                }
                wasExtruding = false;
            }
        }

        // Add final segment if any
        if (currentSegment.length > 0) {
            this.printedPath.push(currentSegment);
        }

        this.updatePrintPath();
        this.updateTravelPath();
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
        if (this.printPath) this.scene.remove(this.printPath);

        // Flatten all segments to find global Z range
        const allPoints = this.printedPath.flat();
        if (allPoints.length < 2) return;

        const zValues = allPoints.map(p => p.z);
        const minZ = Math.min(...zValues);
        const maxZ = Math.max(...zValues);
        const zRange = maxZ - minZ || 1;

        const primaryHex = getTheme()?.colors?.primary || '#32D74B';
        const baseColor = this.hexToRgb(primaryHex);
        const tiltColor = { r: 0.0, g: 0.686, b: 0.894 }; // Cyan for tilted sections

        // Create a group to hold all segment lines
        const group = new THREE.Group();

        for (const segment of this.printedPath) {
            if (segment.length < 2) continue;

            const points = segment.map(p => p.point);
            const geometry = new THREE.BufferGeometry().setFromPoints(points);

            // Create vertex colors for this segment
            const colors = [];
            for (const p of segment) {
                const bNormalized = Math.min(p.b / 45, 1);
                const zNormalized = (p.z - minZ) / zRange;
                const brightness = 0.5 + zNormalized * 0.5;

                const r = (baseColor.r * (1 - bNormalized) + tiltColor.r * bNormalized) * brightness;
                const g = (baseColor.g * (1 - bNormalized) + tiltColor.g * bNormalized) * brightness;
                const b = (baseColor.b * (1 - bNormalized) + tiltColor.b * bNormalized) * brightness;

                colors.push(r, g, b);
            }

            geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
            const material = new THREE.LineBasicMaterial({ vertexColors: true, linewidth: 3 });
            const line = new THREE.Line(geometry, material);
            group.add(line);
        }

        this.printPath = group;
        this.scene.add(this.printPath);
    }

    // Used during playback to include current segment
    updatePrintPathWithSegments(segments) {
        if (this.printPath) this.scene.remove(this.printPath);

        const allPoints = segments.flat();
        if (allPoints.length < 2) return;

        const zValues = allPoints.map(p => p.z);
        const minZ = Math.min(...zValues);
        const maxZ = Math.max(...zValues);
        const zRange = maxZ - minZ || 1;

        const primaryHex = getTheme()?.colors?.primary || '#32D74B';
        const baseColor = this.hexToRgb(primaryHex);
        const tiltColor = { r: 0.0, g: 0.686, b: 0.894 };

        const group = new THREE.Group();

        for (const segment of segments) {
            if (segment.length < 2) continue;

            const points = segment.map(p => p.point);
            const geometry = new THREE.BufferGeometry().setFromPoints(points);

            const colors = [];
            for (const p of segment) {
                const bNormalized = Math.min(p.b / 45, 1);
                const zNormalized = (p.z - minZ) / zRange;
                const brightness = 0.5 + zNormalized * 0.5;

                const r = (baseColor.r * (1 - bNormalized) + tiltColor.r * bNormalized) * brightness;
                const g = (baseColor.g * (1 - bNormalized) + tiltColor.g * bNormalized) * brightness;
                const b = (baseColor.b * (1 - bNormalized) + tiltColor.b * bNormalized) * brightness;

                colors.push(r, g, b);
            }

            geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
            const material = new THREE.LineBasicMaterial({ vertexColors: true, linewidth: 3 });
            const line = new THREE.Line(geometry, material);
            group.add(line);
        }

        this.printPath = group;
        this.scene.add(this.printPath);
    }

    updateTravelPath() {
        if (this.travelPath) this.scene.remove(this.travelPath);
        if (!this.showTravelMoves || this.travelMoves.length === 0) {
            console.log('Travel path: showTravelMoves =', this.showTravelMoves, ', travelMoves.length =', this.travelMoves.length);
            return;
        }

        console.log('Drawing', this.travelMoves.length, 'travel moves');

        const group = new THREE.Group();
        const material = new THREE.LineDashedMaterial({
            color: 0xff6600,  // Orange for visibility
            transparent: true,
            opacity: 0.8,
            dashSize: 3,
            gapSize: 2
        });

        for (const travel of this.travelMoves) {
            const geometry = new THREE.BufferGeometry().setFromPoints([travel.from, travel.to]);
            const line = new THREE.Line(geometry, material);
            line.computeLineDistances();  // Required for dashed lines
            group.add(line);
        }

        this.travelPath = group;
        this.scene.add(this.travelPath);
    }

    setShowTravelMoves(show) {
        this.showTravelMoves = show;
        this.updateTravelPath();
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
