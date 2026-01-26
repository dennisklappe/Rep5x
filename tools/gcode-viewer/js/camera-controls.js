// Camera controls for Rep5x G-code viewer
// Handles orbit, pan, and zoom with mouse

class CameraControls {
    constructor(camera, canvas, target = new THREE.Vector3(0, 40, 0)) {
        this.camera = camera;
        this.canvas = canvas;
        this.target = target;

        this.isMouseDown = false;
        this.mouseButton = null;
        this.mouseX = 0;
        this.mouseY = 0;

        this.setupEventListeners();
    }

    setupEventListeners() {
        // Left click: orbit, Right click: pan
        const defaultCursor = 'default';
        const activeCursor = 'move';
        const panCursor = 'all-scroll';

        this.canvas.addEventListener('mousedown', (e) => {
            this.isMouseDown = true;
            this.mouseButton = e.button;
            this.mouseX = e.clientX;
            this.mouseY = e.clientY;

            if (e.button === 0) {
                this.canvas.style.cursor = activeCursor;
            } else if (e.button === 2) {
                this.canvas.style.cursor = panCursor;
            }
            e.preventDefault();
        });

        document.addEventListener('mouseup', () => {
            this.isMouseDown = false;
            this.mouseButton = null;
            this.canvas.style.cursor = defaultCursor;
        });

        document.addEventListener('mousemove', (e) => {
            if (!this.isMouseDown) return;

            const deltaX = e.clientX - this.mouseX;
            const deltaY = e.clientY - this.mouseY;

            this.mouseX = e.clientX;
            this.mouseY = e.clientY;

            if (this.mouseButton === 0) {
                this.orbit(deltaX, deltaY);
            } else if (this.mouseButton === 2) {
                this.pan(deltaX, deltaY);
            }
        });

        this.canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });

        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            this.zoom(e.deltaY);
        });

        this.canvas.style.cursor = defaultCursor;
    }

    orbit(deltaX, deltaY) {
        const spherical = new THREE.Spherical();
        spherical.setFromVector3(this.camera.position.clone().sub(this.target));

        spherical.theta -= deltaX * 0.01;
        spherical.phi += deltaY * 0.01;
        spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));

        this.camera.position.copy(this.target).add(new THREE.Vector3().setFromSpherical(spherical));
        this.camera.lookAt(this.target);
    }

    pan(deltaX, deltaY) {
        const distance = this.camera.position.distanceTo(this.target);
        const panSpeed = distance * 0.001;

        const left = new THREE.Vector3();
        const up = new THREE.Vector3();

        left.setFromMatrixColumn(this.camera.matrix, 0);
        up.setFromMatrixColumn(this.camera.matrix, 1);

        const panOffset = new THREE.Vector3();
        panOffset.addScaledVector(left, -deltaX * panSpeed);
        panOffset.addScaledVector(up, deltaY * panSpeed);

        this.camera.position.add(panOffset);
        this.target.add(panOffset);
        this.camera.lookAt(this.target);
    }

    zoom(delta) {
        const spherical = new THREE.Spherical();
        spherical.setFromVector3(this.camera.position.clone().sub(this.target));

        spherical.radius += delta * 0.1;
        spherical.radius = Math.max(10, Math.min(1000, spherical.radius));

        this.camera.position.copy(this.target).add(new THREE.Vector3().setFromSpherical(spherical));
        this.camera.lookAt(this.target);
    }
}
