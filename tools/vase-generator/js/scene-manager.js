// Scene manager for Rep5x vase generator - handles Three.js setup and rendering

class SceneManager {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.animationId = null;

        // Scene objects
        this.mesh = null;
        this.wireframeMesh = null;
        this.pathLine = null;
        this.platform = null;
        this.gridHelper = null;
        this.axesGroup = null;

        // Camera control state
        this.cameraTarget = new THREE.Vector3(0, 40, 0);
    }

    init(canvasId = 'canvas3d') {
        const canvas = document.getElementById(canvasId);

        // Scene setup
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xf8fafc);

        // Camera
        this.camera = new THREE.PerspectiveCamera(
            45,
            canvas.offsetWidth / canvas.offsetHeight,
            0.1,
            1000
        );
        this.camera.position.set(120, 80, 120);
        this.camera.lookAt(0, 40, 0);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({
            canvas,
            antialias: true,
            alpha: true
        });
        this.renderer.setSize(canvas.offsetWidth, canvas.offsetHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // Lighting
        this.setupLighting();

        // Mouse controls
        this.setupMouseControls(canvas);

        // Handle window resize
        window.addEventListener('resize', () => this.handleResize());
    }

    setupLighting() {
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
    }

    setupMouseControls(canvas) {
        let isMouseDown = false;
        let mouseButton = null;
        let mouseX = 0, mouseY = 0;

        canvas.addEventListener('mousedown', (e) => {
            isMouseDown = true;
            mouseButton = e.button;
            mouseX = e.clientX;
            mouseY = e.clientY;

            if (e.button === 0) {
                canvas.style.cursor = 'grabbing';
            } else if (e.button === 2) {
                canvas.style.cursor = 'move';
            }
            e.preventDefault();
        });

        document.addEventListener('mouseup', () => {
            isMouseDown = false;
            mouseButton = null;
            canvas.style.cursor = 'grab';
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
                spherical.setFromVector3(this.camera.position.clone().sub(this.cameraTarget));

                spherical.theta -= deltaX * 0.01;
                spherical.phi += deltaY * 0.01;
                spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));

                this.camera.position.copy(this.cameraTarget).add(new THREE.Vector3().setFromSpherical(spherical));
                this.camera.lookAt(this.cameraTarget);

            } else if (mouseButton === 2) {
                // Right button: pan
                const distance = this.camera.position.distanceTo(this.cameraTarget);
                const panSpeed = distance * 0.001;

                const left = new THREE.Vector3();
                const up = new THREE.Vector3();

                left.setFromMatrixColumn(this.camera.matrix, 0);
                up.setFromMatrixColumn(this.camera.matrix, 1);

                const panOffset = new THREE.Vector3();
                panOffset.addScaledVector(left, -deltaX * panSpeed);
                panOffset.addScaledVector(up, deltaY * panSpeed);

                this.camera.position.add(panOffset);
                this.cameraTarget.add(panOffset);
                this.camera.lookAt(this.cameraTarget);
            }
        });

        // Disable context menu on right click
        canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });

        // Touch support for mobile
        let touchStartX, touchStartY;

        canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            touchStartX = touch.clientX;
            touchStartY = touch.clientY;
        });

        canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (e.touches.length !== 1) return;

            const touch = e.touches[0];
            const deltaX = touch.clientX - touchStartX;
            const deltaY = touch.clientY - touchStartY;

            touchStartX = touch.clientX;
            touchStartY = touch.clientY;

            const spherical = new THREE.Spherical();
            spherical.setFromVector3(this.camera.position);

            spherical.theta -= deltaX * 0.01;
            spherical.phi += deltaY * 0.01;
            spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));

            this.camera.position.setFromSpherical(spherical);
            this.camera.lookAt(0, 40, 0);
        });

        // Mouse wheel zoom
        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();

            const spherical = new THREE.Spherical();
            spherical.setFromVector3(this.camera.position.clone().sub(this.cameraTarget));

            // Zoom in/out
            const zoomSpeed = 0.1;
            spherical.radius += e.deltaY * zoomSpeed;

            // Constrain zoom
            spherical.radius = Math.max(10, Math.min(1000, spherical.radius));

            this.camera.position.copy(this.cameraTarget).add(new THREE.Vector3().setFromSpherical(spherical));
            this.camera.lookAt(this.cameraTarget);
        });

        canvas.style.cursor = 'grab';
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
        if (!this.camera || !this.renderer) return;

        const canvas = document.getElementById('canvas3d');
        this.camera.aspect = canvas.offsetWidth / canvas.offsetHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(canvas.offsetWidth, canvas.offsetHeight);
    }

    updateBuildPlatform(bedWidth = 200, bedDepth = 200) {
        // Remove existing platform and grid
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

        // Create new platform
        const platformGeometry = new THREE.PlaneGeometry(bedWidth, bedDepth);
        const platformMaterial = new THREE.MeshLambertMaterial({
            color: 0xe2e8f0,
            transparent: true,
            opacity: 0.5
        });
        this.platform = new THREE.Mesh(platformGeometry, platformMaterial);
        this.platform.rotation.x = -Math.PI / 2;
        this.platform.receiveShadow = true;
        this.scene.add(this.platform);

        // Create new grid
        const gridSize = Math.max(bedWidth, bedDepth);
        const gridDivisions = Math.max(10, Math.floor(gridSize / 20));
        this.gridHelper = new THREE.GridHelper(gridSize, gridDivisions, 0x94a3b8, 0xd1d5db);
        this.gridHelper.position.y = 0.1;
        this.scene.add(this.gridHelper);

        // Add coordinate system arrows at origin
        this.axesGroup = this.createAxes();
        this.scene.add(this.axesGroup);
    }

    createAxes() {
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

        return axesGroup;
    }

    clearMesh() {
        if (this.mesh) {
            this.scene.remove(this.mesh);
            if (this.mesh.geometry) this.mesh.geometry.dispose();
            if (this.mesh.material) this.mesh.material.dispose();
            this.mesh = null;
        }

        if (this.wireframeMesh) {
            this.scene.remove(this.wireframeMesh);
            if (this.wireframeMesh.geometry) this.wireframeMesh.geometry.dispose();
            if (this.wireframeMesh.material) this.wireframeMesh.material.dispose();
            this.wireframeMesh = null;
        }
    }

    clearPath() {
        if (this.pathLine) {
            if (this.pathLine.lines) {
                this.pathLine.lines.forEach(line => {
                    this.scene.remove(line);
                    if (line.geometry) line.geometry.dispose();
                    if (line.material) line.material.dispose();
                });
            } else {
                this.scene.remove(this.pathLine);
                if (this.pathLine.geometry) this.pathLine.geometry.dispose();
                if (this.pathLine.material) this.pathLine.material.dispose();
            }
            this.pathLine = null;
        }
    }

    setMesh(geometry, primaryColor) {
        this.clearMesh();

        const material = new THREE.MeshPhongMaterial({
            color: primaryColor,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.9,
            shininess: 100
        });

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        this.scene.add(this.mesh);

        // Add wireframe for better visualisation
        const wireframeGeometry = geometry.clone();
        const wireframeColor = new THREE.Color(primaryColor).multiplyScalar(0.7);

        const wireframeMaterial = new THREE.MeshBasicMaterial({
            color: wireframeColor,
            wireframe: true,
            transparent: true,
            opacity: 0.1
        });
        this.wireframeMesh = new THREE.Mesh(wireframeGeometry, wireframeMaterial);
        this.scene.add(this.wireframeMesh);
    }

    setPath(pathPoints) {
        this.clearPath();

        const pathGeometry = new THREE.BufferGeometry().setFromPoints(pathPoints);
        const pathMaterial = new THREE.LineBasicMaterial({
            color: 0x000000,
            linewidth: 3,
            transparent: true,
            opacity: 0.8
        });

        const spiralLine = new THREE.Line(pathGeometry, pathMaterial);
        this.scene.add(spiralLine);

        this.pathLine = { lines: [spiralLine] };
    }

    dispose() {
        this.stopRenderLoop();
        this.clearMesh();
        this.clearPath();

        if (this.renderer) {
            this.renderer.dispose();
        }
    }
}
