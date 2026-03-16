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

        // Add subtle fog for depth perception
        this.scene.fog = new THREE.FogExp2(0xf8fafc, 0.0008);

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

    // Professional colormap inspired by Viridis - perceptually uniform, colorblind-friendly
    // Returns RGB values 0-1 for a normalized input t (0-1)
    viridisColor(t) {
        // Attempt at customized Rep5x colors - deep teal to bright green
        const stops = [
            { t: 0.0, r: 0.15, g: 0.25, b: 0.35 },   // Dark steel blue
            { t: 0.25, r: 0.10, g: 0.45, b: 0.50 },  // Teal
            { t: 0.5, r: 0.12, g: 0.60, b: 0.45 },   // Sea green
            { t: 0.75, r: 0.20, g: 0.75, b: 0.35 },  // Green
            { t: 1.0, r: 0.45, g: 0.90, b: 0.40 }    // Bright lime green
        ];

        // Find the two stops to interpolate between
        let lower = stops[0], upper = stops[stops.length - 1];
        for (let i = 0; i < stops.length - 1; i++) {
            if (t >= stops[i].t && t <= stops[i + 1].t) {
                lower = stops[i];
                upper = stops[i + 1];
                break;
            }
        }

        // Interpolate
        const range = upper.t - lower.t || 1;
        const f = (t - lower.t) / range;

        return {
            r: lower.r + (upper.r - lower.r) * f,
            g: lower.g + (upper.g - lower.g) * f,
            b: lower.b + (upper.b - lower.b) * f
        };
    }

    // Calculate direction-based shading (simulates lighting)
    // Returns a brightness multiplier based on segment direction
    calculateDirectionalShading(prevPoint, currPoint) {
        if (!prevPoint) return 1.0;

        // Calculate direction vector
        const dx = currPoint.x - prevPoint.x;
        const dy = currPoint.y - prevPoint.y;
        const dz = currPoint.z - prevPoint.z;
        const len = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (len < 0.001) return 1.0;

        // Normalize
        const nx = dx / len;
        const ny = dy / len;
        const nz = dz / len;

        // Light direction (from top-right-front)
        const lightX = 0.5, lightY = 0.3, lightZ = 0.8;
        const lightLen = Math.sqrt(lightX * lightX + lightY * lightY + lightZ * lightZ);

        // Dot product for diffuse lighting
        const dot = (nx * lightX + ny * lightY + nz * lightZ) / lightLen;

        // Map to brightness range (0.6 to 1.0 to avoid too dark areas)
        return 0.6 + Math.abs(dot) * 0.4;
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
        this.disposeGroup(this.printPath);
        this.disposeGroup(this.travelPath);
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
            this.disposeGroup(this.printPath);
            this.disposeGroup(this.travelPath);
            this.printPath = null;
            this.travelPath = null;
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
        this.disposeGroup(this.printPath);
        this.disposeGroup(this.travelPath);
        this.printPath = null;
        this.travelPath = null;
        this.position = { x: 0, y: 0, z: 0, c: 0, b: 0 };
        this.updatePrinthead();
        this.updateProgressCallback(0);
    }

    setSpeed(speed) { this.speed = Math.max(1, Math.min(20, speed)); }

    setProgress(percentage) {
        this.currentStep = Math.floor((percentage / 100) * this.commands.length);
        this.currentStep = Math.max(0, Math.min(this.currentStep, this.commands.length - 1));
        this.currentSegment = [];
        this.lastExtrusionPos = null;
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

    // Dispose all geometries and materials in a Three.js group
    disposeGroup(group) {
        if (!group) return;
        this.scene.remove(group);
        group.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => m.dispose());
                } else {
                    child.material.dispose();
                }
            }
        });
    }

    // Build tube geometry for an extrusion segment
    buildTubeGeometry(segment, minZ, zRange) {
        if (segment.length < 2) return null;

        const lineWidth = 0.45;
        const layerHeight = 0.2;
        const hw = lineWidth / 2;
        const hh = layerHeight / 2;

        const vertCount = segment.length * 4;
        const triCount = (segment.length - 1) * 8;
        const positions = new Float32Array(vertCount * 3);
        const normals = new Float32Array(vertCount * 3);
        const colors = new Float32Array(vertCount * 3);
        const indices = new Uint32Array(triCount * 3);

        const up = new THREE.Vector3(0, 1, 0);
        const tmpDir = new THREE.Vector3();
        const tmpSide = new THREE.Vector3();

        for (let i = 0; i < segment.length; i++) {
            const p = segment[i];
            const pt = p.point;

            // Direction vector
            if (i < segment.length - 1) {
                tmpDir.subVectors(segment[i + 1].point, pt).normalize();
            } // else reuse previous direction

            // Side vector perpendicular to direction and up
            tmpSide.crossVectors(tmpDir, up).normalize();
            if (tmpSide.lengthSq() < 0.001) {
                tmpSide.set(1, 0, 0);
            }

            // 4 vertices per point: top, right, bottom, left
            const base = i * 4;
            // top
            positions[base * 3]     = pt.x;
            positions[base * 3 + 1] = pt.y + hh;
            positions[base * 3 + 2] = pt.z;
            normals[base * 3 + 1] = 1;
            // right
            positions[(base + 1) * 3]     = pt.x + tmpSide.x * hw;
            positions[(base + 1) * 3 + 1] = pt.y;
            positions[(base + 1) * 3 + 2] = pt.z + tmpSide.z * hw;
            normals[(base + 1) * 3] = tmpSide.x;
            normals[(base + 1) * 3 + 2] = tmpSide.z;
            // bottom
            positions[(base + 2) * 3]     = pt.x;
            positions[(base + 2) * 3 + 1] = pt.y - hh;
            positions[(base + 2) * 3 + 2] = pt.z;
            normals[(base + 2) * 3 + 1] = -1;
            // left
            positions[(base + 3) * 3]     = pt.x - tmpSide.x * hw;
            positions[(base + 3) * 3 + 1] = pt.y;
            positions[(base + 3) * 3 + 2] = pt.z - tmpSide.z * hw;
            normals[(base + 3) * 3] = -tmpSide.x;
            normals[(base + 3) * 3 + 2] = -tmpSide.z;

            // Color based on Z height
            const zNormalized = (p.z - minZ) / zRange;
            const c = this.viridisColor(zNormalized);
            for (let v = 0; v < 4; v++) {
                colors[(base + v) * 3]     = c.r;
                colors[(base + v) * 3 + 1] = c.g;
                colors[(base + v) * 3 + 2] = c.b;
            }

            // Indices: connect this ring to the next
            if (i < segment.length - 1) {
                const a = base;
                const b = base + 4;
                let idx = i * 24; // 8 triangles × 3 indices
                for (let face = 0; face < 4; face++) {
                    const v0 = a + face;
                    const v1 = a + (face + 1) % 4;
                    const v2 = b + face;
                    const v3 = b + (face + 1) % 4;
                    indices[idx++] = v0; indices[idx++] = v2; indices[idx++] = v1;
                    indices[idx++] = v1; indices[idx++] = v2; indices[idx++] = v3;
                }
            }
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geo.setIndex(new THREE.BufferAttribute(indices, 1));
        return geo;
    }

    buildPathFromSegments(segments) {
        // Find global Z range
        let minZ = Infinity, maxZ = -Infinity, pointCount = 0;
        for (const segment of segments) {
            for (const p of segment) {
                if (p.z < minZ) minZ = p.z;
                if (p.z > maxZ) maxZ = p.z;
                pointCount++;
            }
        }
        if (pointCount < 2) return null;
        const zRange = maxZ - minZ || 1;

        const group = new THREE.Group();
        const material = new THREE.MeshLambertMaterial({
            vertexColors: true,
            side: THREE.DoubleSide,
        });

        for (const segment of segments) {
            const geo = this.buildTubeGeometry(segment, minZ, zRange);
            if (geo) {
                group.add(new THREE.Mesh(geo, material));
            }
        }

        return group;
    }

    updatePrintPath() {
        this.disposeGroup(this.printPath);
        this.printPath = this.buildPathFromSegments(this.printedPath);
        if (this.printPath) this.scene.add(this.printPath);
    }

    // Used during playback to include current segment
    updatePrintPathWithSegments(segments) {
        this.disposeGroup(this.printPath);
        this.printPath = this.buildPathFromSegments(segments);
        if (this.printPath) this.scene.add(this.printPath);
    }

    updateTravelPath() {
        this.disposeGroup(this.travelPath);
        if (!this.showTravelMoves || this.travelMoves.length === 0) return;

        const group = new THREE.Group();
        const material = new THREE.LineDashedMaterial({
            color: 0xff6600,  // Orange for visibility
            transparent: true,
            opacity: 0.6,
            dashSize: 3,
            gapSize: 2,
            fog: true
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
        const cRad = this.position.c * Math.PI / 180;
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
            this.disposeGroup(this.collisionMarkers);
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
