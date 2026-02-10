// Scene manager for Rep5x Spline Slicer - Three.js scene, camera, raycasting, rendering

class SceneManager {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.animationId = null;

        // Scene objects
        this.stlMesh = null;
        this.splineLine = null;
        this.controlPointSpheres = [];
        this.sliceLines = [];
        this.platform = null;
        this.gridHelper = null;

        this.axesGroup = null;

        // Camera control state
        this.cameraTarget = new THREE.Vector3(0, 20, 0);

        // Interaction state
        this.mode = 'orbit'; // 'orbit', 'place', 'edit'
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.mouseDownStart = { x: 0, y: 0 }; // Initial mousedown position (for click detection)
        this.lastMousePos = { x: 0, y: 0 };    // Last mouse position (for delta calculation)
        this.isMouseDown = false;
        this.mouseButton = null;
        this.draggedPointIndex = -1;
        this.dragPlane = new THREE.Plane();
        this.canvas = null;

        // Callbacks
        this.onMeshClick = null;
        this.onPointDragStart = null;
        this.onPointDrag = null;
        this.onPointDragEnd = null;

        // Control point visuals
        this.CONTROL_POINT_RADIUS = 1.5;
        this.CONTROL_POINT_COLOR = 0xff3333;
        this.CONTROL_POINT_HOVER_COLOR = 0xff8800;
    }

    init(canvasId = 'canvas3d') {
        this.canvas = document.getElementById(canvasId);

        // Scene setup
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xf0f2f5);

        // Camera
        this.camera = new THREE.PerspectiveCamera(
            45,
            this.canvas.offsetWidth / this.canvas.offsetHeight,
            0.1,
            1000
        );
        this.camera.position.set(160, 160, 180);
        this.camera.lookAt(0, 20, 0);

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

        // Lighting (shared)
        SceneObjects.createLighting(this.scene);

        // Mouse controls (custom — extends orbit/pan/zoom with click-to-place and point dragging)
        this.setupMouseControls(this.canvas);

        // Handle window resize
        window.addEventListener('resize', () => this.handleResize());
    }

    setupMouseControls(canvas) {
        canvas.addEventListener('mousedown', (e) => {
            this.isMouseDown = true;
            this.mouseButton = e.button;
            this.mouseDownStart = { x: e.clientX, y: e.clientY };
            this.lastMousePos = { x: e.clientX, y: e.clientY };
            this._updateMouse(e);

            if (e.button === 0) {
                if (this.mode === 'edit') {
                    // Try to pick a control point
                    const hitIndex = this._pickControlPoint(e);
                    if (hitIndex >= 0) {
                        this.draggedPointIndex = hitIndex;
                        this._setupDragPlane(hitIndex);
                        canvas.style.cursor = 'grabbing';
                        if (this.onPointDragStart) this.onPointDragStart(hitIndex);
                        e.preventDefault();
                        return;
                    }
                }
                canvas.style.cursor = 'move';
            } else if (e.button === 2) {
                canvas.style.cursor = 'all-scroll';
            }
            e.preventDefault();
        });

        document.addEventListener('mouseup', (e) => {
            if (this.draggedPointIndex >= 0) {
                if (this.onPointDragEnd) this.onPointDragEnd(this.draggedPointIndex);
                this.draggedPointIndex = -1;
            }

            // Check for click (not drag) using initial mousedown position
            if (this.isMouseDown && e.button === 0) {
                const dx = e.clientX - this.mouseDownStart.x;
                const dy = e.clientY - this.mouseDownStart.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < 5) {
                    this._handleClick(e);
                }
            }

            this.isMouseDown = false;
            this.mouseButton = null;
            canvas.style.cursor = this.mode === 'place' ? 'crosshair' : 'default';
        });

        document.addEventListener('mousemove', (e) => {
            if (!this.isMouseDown) return;

            // Handle control point dragging
            if (this.draggedPointIndex >= 0) {
                this._handleDrag(e);
                return;
            }

            const moveDeltaX = e.clientX - this.lastMousePos.x;
            const moveDeltaY = e.clientY - this.lastMousePos.y;
            this.lastMousePos = { x: e.clientX, y: e.clientY };

            if (this.mouseButton === 0) {
                // Left button: orbit (click detected on mouseup)
                const spherical = new THREE.Spherical();
                spherical.setFromVector3(this.camera.position.clone().sub(this.cameraTarget));

                spherical.theta -= moveDeltaX * 0.01;
                spherical.phi += moveDeltaY * 0.01;
                spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));

                this.camera.position.copy(this.cameraTarget).add(new THREE.Vector3().setFromSpherical(spherical));
                this.camera.lookAt(this.cameraTarget);

            } else if (this.mouseButton === 2) {
                // Right button: pan
                const distance = this.camera.position.distanceTo(this.cameraTarget);
                const panSpeed = distance * 0.001;

                const left = new THREE.Vector3();
                const up = new THREE.Vector3();

                left.setFromMatrixColumn(this.camera.matrix, 0);
                up.setFromMatrixColumn(this.camera.matrix, 1);

                const panOffset = new THREE.Vector3();
                panOffset.addScaledVector(left, -moveDeltaX * panSpeed);
                panOffset.addScaledVector(up, moveDeltaY * panSpeed);

                this.camera.position.add(panOffset);
                this.cameraTarget.add(panOffset);
                this.camera.lookAt(this.cameraTarget);
            }
        });

        // Disable context menu on right click
        canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        // Mouse wheel zoom
        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const spherical = new THREE.Spherical();
            spherical.setFromVector3(this.camera.position.clone().sub(this.cameraTarget));

            const zoomSpeed = 0.1;
            spherical.radius += e.deltaY * zoomSpeed;
            spherical.radius = Math.max(10, Math.min(1000, spherical.radius));

            this.camera.position.copy(this.cameraTarget).add(new THREE.Vector3().setFromSpherical(spherical));
            this.camera.lookAt(this.cameraTarget);
        });

        canvas.style.cursor = 'default';
    }

    _updateMouse(e) {
        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    }

    _handleClick(e) {
        if (this.mode === 'place' && this.stlMesh) {
            this._updateMouse(e);
            this.raycaster.setFromCamera(this.mouse, this.camera);

            const intersects = this.raycaster.intersectObject(this.stlMesh);
            if (intersects.length > 0) {
                const point = intersects[0].point;
                if (this.onMeshClick) this.onMeshClick(point);
            }
        }
    }

    _pickControlPoint(e) {
        this._updateMouse(e);
        this.raycaster.setFromCamera(this.mouse, this.camera);

        if (this.controlPointSpheres.length === 0) return -1;

        const intersects = this.raycaster.intersectObjects(this.controlPointSpheres);
        if (intersects.length > 0) {
            return this.controlPointSpheres.indexOf(intersects[0].object);
        }
        return -1;
    }

    _setupDragPlane(pointIndex) {
        // Create a drag plane facing the camera through the control point
        const point = this.controlPointSpheres[pointIndex].position;
        const cameraDir = this.camera.getWorldDirection(new THREE.Vector3());
        this.dragPlane.setFromNormalAndCoplanarPoint(cameraDir, point);
    }

    _handleDrag(e) {
        this._updateMouse(e);
        this.raycaster.setFromCamera(this.mouse, this.camera);

        const intersection = new THREE.Vector3();
        if (this.raycaster.ray.intersectPlane(this.dragPlane, intersection)) {
            if (this.onPointDrag) this.onPointDrag(this.draggedPointIndex, intersection);
        }
    }

    setMode(mode) {
        this.mode = mode;
        if (this.canvas) {
            this.canvas.style.cursor = mode === 'place' ? 'crosshair' : 'default';
        }
    }

    startRenderLoop() {
        const animate = () => {
            this.animationId = requestAnimationFrame(animate);
            this.renderer.render(this.scene, this.camera);
        };
        animate();
    }

    stopRenderLoop() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    handleResize() {
        if (!this.camera || !this.renderer || !this.canvas) return;
        this.camera.aspect = this.canvas.offsetWidth / this.canvas.offsetHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.canvas.offsetWidth, this.canvas.offsetHeight);
    }

    updateBuildPlatform(bedWidth = 200, bedDepth = 200) {
        // Remove existing platform, grid, and axes
        if (this.platform) {
            this.scene.remove(this.platform);
            if (this.platform.geometry) this.platform.geometry.dispose();
            if (this.platform.material) this.platform.material.dispose();
        }
        if (this.gridHelper) {
            this.scene.remove(this.gridHelper);
            if (this.gridHelper.geometry) this.gridHelper.geometry.dispose();
            if (this.gridHelper.material) this.gridHelper.material.dispose();
        }
        if (this.axesGroup) {
            this.scene.remove(this.axesGroup);
        }

        // Use shared SceneObjects, then reposition so origin is at bed centre
        // (STL models are centred at origin in the spline slicer)
        const result = SceneObjects.createBuildPlatform(this.scene, bedWidth, bedDepth);
        this.platform = result.platform;
        this.gridHelper = result.grid;

        // SceneObjects places origin at corner (halfX, 0, -halfY).
        // Shift platform and grid so origin is at bed centre instead.
        const halfX = bedWidth / 2;
        const halfY = bedDepth / 2;
        this.platform.position.set(0, 0, 0);
        this.gridHelper.position.set(0, 0.1, 0);

        // Axes at front-left corner of the centred bed
        this.axesGroup = SceneObjects.createAxes();
        this.axesGroup.position.set(-halfX, 0, halfY);
        this.scene.add(this.axesGroup);
    }

    // === STL Mesh Display ===

    setSTLMesh(geometry) {
        this.clearSTLMesh();

        const material = new THREE.MeshPhongMaterial({
            color: 0x44bb66,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.6,
            shininess: 80
        });

        this.stlMesh = new THREE.Mesh(geometry, material);
        this.stlMesh.castShadow = true;
        this.stlMesh.receiveShadow = true;
        this.scene.add(this.stlMesh);

        // Auto-frame the camera to the model
        geometry.computeBoundingBox();
        const box = geometry.boundingBox;
        const centre = new THREE.Vector3();
        box.getCenter(centre);
        const size = new THREE.Vector3();
        box.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z);

        this.cameraTarget.copy(centre);
        this.camera.position.set(
            centre.x + maxDim * 2,
            centre.y + maxDim * 1,
            centre.z + maxDim * 2
        );
        this.camera.lookAt(this.cameraTarget);
    }

    clearSTLMesh() {
        if (this.stlMesh) {
            this.scene.remove(this.stlMesh);
            // Don't dispose geometry - it's owned by STLHandler and may be reused after rotation
            if (this.stlMesh.material) this.stlMesh.material.dispose();
            this.stlMesh = null;
        }
    }

    // === Spline Display ===

    setSpline(curvePoints) {
        this.clearSpline();
        if (curvePoints.length < 2) return;

        const geometry = new THREE.BufferGeometry().setFromPoints(curvePoints);
        const material = new THREE.LineBasicMaterial({
            color: 0xFFCC00,
            linewidth: 3
        });

        this.splineLine = new THREE.Line(geometry, material);
        this.scene.add(this.splineLine);
    }

    clearSpline() {
        if (this.splineLine) {
            this.scene.remove(this.splineLine);
            if (this.splineLine.geometry) this.splineLine.geometry.dispose();
            if (this.splineLine.material) this.splineLine.material.dispose();
            this.splineLine = null;
        }
    }

    // === Control Point Spheres ===

    setControlPoints(points) {
        this.clearControlPoints();

        const geometry = new THREE.SphereGeometry(this.CONTROL_POINT_RADIUS, 16, 16);

        for (const point of points) {
            const material = new THREE.MeshPhongMaterial({
                color: this.CONTROL_POINT_COLOR,
                shininess: 100
            });
            const sphere = new THREE.Mesh(geometry.clone(), material);
            sphere.position.copy(point);
            this.scene.add(sphere);
            this.controlPointSpheres.push(sphere);
        }
    }

    clearControlPoints() {
        for (const sphere of this.controlPointSpheres) {
            this.scene.remove(sphere);
            if (sphere.geometry) sphere.geometry.dispose();
            if (sphere.material) sphere.material.dispose();
        }
        this.controlPointSpheres = [];
    }

    // === Slice Contour Display ===

    setSliceContours(slices) {
        this.clearSliceContours();

        const material = new THREE.LineBasicMaterial({
            color: 0x00FFFF,
            linewidth: 2
        });

        for (const slice of slices) {
            for (const contour of slice.contours) {
                if (contour.length < 2) continue;
                // Close the contour loop
                const pts = [...contour, contour[0]];
                const geometry = new THREE.BufferGeometry().setFromPoints(pts);
                const line = new THREE.Line(geometry, material.clone());
                this.scene.add(line);
                this.sliceLines.push(line);
            }
        }
    }

    setSliceContoursVisible(visible) {
        for (const line of this.sliceLines) {
            line.visible = visible;
        }
    }

    clearSliceContours() {
        for (const line of this.sliceLines) {
            this.scene.remove(line);
            if (line.geometry) line.geometry.dispose();
            if (line.material) line.material.dispose();
        }
        this.sliceLines = [];
    }

    dispose() {
        this.stopRenderLoop();
        this.clearSTLMesh();
        this.clearSpline();
        this.clearControlPoints();
        this.clearSliceContours();

        if (this.renderer) {
            this.renderer.dispose();
        }
    }
}
