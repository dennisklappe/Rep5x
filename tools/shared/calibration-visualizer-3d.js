/**
 * 3D Calibration Visualizer
 * Shows nozzle tip position error in 3D space as axes rotate
 * Uses Three.js for rendering
 *
 * Used by: Calibrator, G-code Corrector
 */

class CalibrationVisualizer3D {
    constructor(container) {
        this.container = typeof container === 'string'
            ? document.getElementById(container)
            : container;

        // Corrector reference
        this.corrector = null;

        // Scene setup
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;

        // Objects
        this.nozzleC = null;       // Nozzle for C sweep
        this.nozzleB = null;       // Nozzle for B sweep (only in 'both' mode)
        this.gridHelper = null;
        this.axisHelper = null;
        this.centerMarker = null;

        // Animation state
        this.animating = false;
        this.animationId = null;
        this.currentC = 0;
        this.currentB = 0;
        this.sweepMode = 'both';  // 'c', 'b', 'both' (separate C+B), 'combined'
        this.animationSpeed = 2;

        // Mode
        this.mode = 'uncalibrated';

        // Trail (primary - C sweep or combined)
        this.trailPointsC = [];
        this.maxTrailPoints = 200;

        // Trail for B sweep (only in 'both' mode)
        this.trailPointsB = [];

        // Scale (error amplification for visibility)
        this.scale = 120;

        this.init();
    }

    init() {
        const width = this.container.clientWidth || 400;
        const height = this.container.clientHeight || 256;

        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a1a2e);

        // Camera - positioned similar to gcode-viewer (looking at XY plane with Z up)
        this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 3000);
        this.camera.position.set(300, 300, 300);  // Above and to the side
        this.camera.lookAt(0, 0, 0);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.container.appendChild(this.renderer.domElement);

        // Controls
        if (typeof THREE.OrbitControls !== 'undefined') {
            this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
            this.controls.enableDamping = true;
            this.controls.dampingFactor = 0.05;
        }

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(10, 20, 10);
        this.scene.add(directionalLight);

        // Grid on horizontal plane (Three.js XZ = Printer XY)
        // In Three.js: Y is up. We'll use: Three.js Y = Printer Z (height)
        // Large grid (400 units) with fewer divisions (8) for better visibility
        this.gridHelper = new THREE.GridHelper(400, 8, 0x444444, 0x222222);
        this.scene.add(this.gridHelper);

        // Create custom axes with printer colors (matching gcode-viewer)
        // X=red, Y=green, Z=blue(up)
        this.createPrinterAxes();

        // Center marker (where nozzle should be)
        const centerGeometry = new THREE.SphereGeometry(3, 16, 16);
        const centerMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.5
        });
        this.centerMarker = new THREE.Mesh(centerGeometry, centerMaterial);
        this.scene.add(this.centerMarker);

        // Nozzle C (C sweep or combined - red/teal)
        const nozzleGeometry = new THREE.SphereGeometry(5, 32, 32);
        this.nozzleMaterialC = new THREE.MeshPhongMaterial({
            color: 0xff6b6b,
            emissive: 0x331111
        });
        this.nozzleC = new THREE.Mesh(nozzleGeometry, this.nozzleMaterialC);
        this.scene.add(this.nozzleC);

        // Nozzle B (B sweep only in 'both' mode - orange/cyan)
        this.nozzleMaterialB = new THREE.MeshPhongMaterial({
            color: 0xffa500,
            emissive: 0x332200
        });
        this.nozzleB = new THREE.Mesh(nozzleGeometry.clone(), this.nozzleMaterialB);
        this.nozzleB.visible = false;  // Hidden by default
        this.scene.add(this.nozzleB);

        // Trail for C sweep (red/teal)
        this.trailMaterialC = new THREE.MeshBasicMaterial({
            color: 0xff6b6b,
            transparent: true,
            opacity: 0.7
        });
        this.trailGroupC = new THREE.Group();
        this.scene.add(this.trailGroupC);

        // Trail for B sweep (orange/cyan - only in 'both' mode)
        this.trailMaterialB = new THREE.MeshBasicMaterial({
            color: 0xffa500,
            transparent: true,
            opacity: 0.7
        });
        this.trailGroupB = new THREE.Group();
        this.trailGroupB.visible = false;  // Hidden by default
        this.scene.add(this.trailGroupB);

        // Labels
        this.addLabels();

        // Handle resize
        window.addEventListener('resize', () => this.handleResize());

        // Start render loop
        this.renderLoop();
    }

    createPrinterAxes() {
        // Create custom axes matching gcode-viewer conventions
        // Three.js X = Printer X (red)
        // Three.js Y = Printer Z (blue, up)
        // Three.js Z = Printer Y (green)
        const axesGroup = new THREE.Group();
        const axisLength = 200;
        const axisRadius = 2;

        // X-axis (red) - along Three.js X
        const xMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        const xShaft = new THREE.Mesh(
            new THREE.CylinderGeometry(axisRadius, axisRadius, axisLength * 0.85),
            xMaterial
        );
        const xHead = new THREE.Mesh(
            new THREE.ConeGeometry(axisRadius * 3, axisLength * 0.15),
            xMaterial
        );
        xShaft.rotation.z = -Math.PI / 2;
        xShaft.position.x = axisLength * 0.425;
        xHead.rotation.z = -Math.PI / 2;
        xHead.position.x = axisLength * 0.925;
        axesGroup.add(xShaft);
        axesGroup.add(xHead);

        // Printer Y-axis (green) - along Three.js Z
        const yMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
        const yShaft = new THREE.Mesh(
            new THREE.CylinderGeometry(axisRadius, axisRadius, axisLength * 0.85),
            yMaterial
        );
        const yHead = new THREE.Mesh(
            new THREE.ConeGeometry(axisRadius * 3, axisLength * 0.15),
            yMaterial
        );
        yShaft.rotation.x = Math.PI / 2;
        yShaft.position.z = axisLength * 0.425;
        yHead.rotation.x = Math.PI / 2;
        yHead.position.z = axisLength * 0.925;
        axesGroup.add(yShaft);
        axesGroup.add(yHead);

        // Printer Z-axis (blue) - along Three.js Y (up)
        const zMaterial = new THREE.MeshBasicMaterial({ color: 0x0000ff });
        const zShaft = new THREE.Mesh(
            new THREE.CylinderGeometry(axisRadius, axisRadius, axisLength * 0.85),
            zMaterial
        );
        const zHead = new THREE.Mesh(
            new THREE.ConeGeometry(axisRadius * 3, axisLength * 0.15),
            zMaterial
        );
        zShaft.position.y = axisLength * 0.425;
        zHead.position.y = axisLength * 0.925;
        axesGroup.add(zShaft);
        axesGroup.add(zHead);

        this.scene.add(axesGroup);
    }

    addLabels() {
        // Add axis labels using sprites
        const createLabel = (text, position, color) => {
            const canvas = document.createElement('canvas');
            canvas.width = 128;
            canvas.height = 128;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = color;
            ctx.font = 'bold 96px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, 64, 64);

            const texture = new THREE.CanvasTexture(canvas);
            const material = new THREE.SpriteMaterial({ map: texture });
            const sprite = new THREE.Sprite(material);
            sprite.position.copy(position);
            sprite.scale.set(12, 12, 1);
            this.scene.add(sprite);
        };

        // Labels for PRINTER coordinates
        // Three.js X = Printer X (red)
        // Three.js Y = Printer Z (up, blue)
        // Three.js Z = Printer Y (green)
        createLabel('X', new THREE.Vector3(220, 0, 0), '#ff4444');
        createLabel('Y', new THREE.Vector3(0, 0, 220), '#44ff44');  // Printer Y along Three.js Z
        createLabel('Z', new THREE.Vector3(0, 220, 0), '#4444ff');  // Printer Z (up) along Three.js Y
    }

    setCorrector(corrector) {
        this.corrector = corrector;
        this.trailPointsC = [];
        this.trailPointsB = [];
        this.updateTrail();
    }

    setMode(mode) {
        this.mode = mode;
        this.trailPointsC = [];
        this.trailPointsB = [];
        this.updateTrail();
    }

    setSweepMode(mode) {
        this.sweepMode = mode;
        this.trailPointsC = [];
        this.trailPointsB = [];
        this.currentC = 0;
        this.currentB = 0;

        // Show/hide B nozzle and trail based on mode
        const showBoth = (mode === 'both');
        if (this.nozzleB) this.nozzleB.visible = showBoth;
        if (this.trailGroupB) this.trailGroupB.visible = showBoth;

        this.updateTrail();
    }

    getError(c, b) {
        if (!this.corrector || !this.corrector.loaded) {
            return { x: 0, y: 0, z: 0 };
        }

        // Get the fitted correction
        const correction = this.corrector.getCorrection(c, b);

        if (this.mode === 'calibrated') {
            // Show residual error (difference between raw measurement and fitted curve)
            // This shows how much error remains after calibration correction
            const residual = this.corrector.getResidual ?
                this.corrector.getResidual(c, b) :
                { x: 0, y: 0, z: 0 };

            // Map to Three.js coordinates:
            // Three.js X = Printer X, Three.js Y = Printer Z (up), Three.js Z = Printer Y
            return {
                x: -residual.x * this.scale,
                y: -residual.z * this.scale,  // Printer Z -> Three.js Y (up)
                z: -residual.y * this.scale   // Printer Y -> Three.js Z
            };
        } else {
            // Uncalibrated: show full error (what the fitted curve predicts)
            // Map to Three.js coordinates
            return {
                x: -correction.x * this.scale,
                y: -correction.z * this.scale,  // Printer Z -> Three.js Y (up)
                z: -correction.y * this.scale   // Printer Y -> Three.js Z
            };
        }
    }

    updateNozzle() {
        if (this.sweepMode === 'both') {
            // C sweep at B=0
            const errorC = this.getError(this.currentC, 0);
            if (this.nozzleC) {
                this.nozzleC.position.set(errorC.x, errorC.y, errorC.z);
            }
            // B sweep at C=0
            const errorB = this.getError(0, this.currentB);
            if (this.nozzleB) {
                this.nozzleB.position.set(errorB.x, errorB.y, errorB.z);
            }
        } else {
            const error = this.getError(this.currentC, this.currentB);
            if (this.nozzleC) {
                this.nozzleC.position.set(error.x, error.y, error.z);
            }
        }
    }

    clearTrailGroup(group) {
        if (!group) return;
        while (group.children.length > 0) {
            const child = group.children[0];
            if (child.geometry) child.geometry.dispose();
            group.remove(child);
        }
    }

    buildTrailFromPoints(points, group, material) {
        if (!group || !material) return;

        // Create tube segments between points
        const tubeRadius = 1.5;
        for (let i = 1; i < points.length; i++) {
            const p1 = points[i - 1];
            const p2 = points[i];

            // Calculate segment
            const start = new THREE.Vector3(p1.x, p1.y, p1.z);
            const end = new THREE.Vector3(p2.x, p2.y, p2.z);
            const direction = new THREE.Vector3().subVectors(end, start);
            const length = direction.length();

            if (length < 0.01) continue;

            // Create cylinder for segment
            const geometry = new THREE.CylinderGeometry(tubeRadius, tubeRadius, length, 8);
            const segment = new THREE.Mesh(geometry, material);

            // Position and orient
            segment.position.copy(start.add(direction.multiplyScalar(0.5)));
            segment.quaternion.setFromUnitVectors(
                new THREE.Vector3(0, 1, 0),
                direction.clone().normalize()
            );

            group.add(segment);
        }
    }

    updateTrail() {
        // Clear both trails
        this.clearTrailGroup(this.trailGroupC);
        this.clearTrailGroup(this.trailGroupB);

        // Build trail C
        this.buildTrailFromPoints(this.trailPointsC, this.trailGroupC, this.trailMaterialC);

        // Build trail B (only in 'both' mode)
        if (this.sweepMode === 'both') {
            this.buildTrailFromPoints(this.trailPointsB, this.trailGroupB, this.trailMaterialB);
        }
    }

    animate() {
        if (!this.animating) return;

        if (this.sweepMode === 'both') {
            // Both mode: C and B sweep simultaneously, synchronized timing
            // C goes 0->360 while B goes -90->90 in the same time
            this.currentC += this.animationSpeed;
            if (this.currentC >= 360) this.currentC = 0;

            // B is synchronized: maps C 0->360 to B -90->90
            // Using sine for smooth back-and-forth: B = 90 * sin(C * pi / 180)
            // This makes B go from 0 -> 90 -> 0 -> -90 -> 0 as C goes 0 -> 360
            this.currentB = 90 * Math.sin(this.currentC * Math.PI / 180);

            // Update nozzle positions
            this.updateNozzle();

            // Add to trails - C trail (red/teal) shows C sweep at B=0
            const errorC = this.getError(this.currentC, 0);
            this.trailPointsC.push({ x: errorC.x, y: errorC.y, z: errorC.z });
            if (this.trailPointsC.length > this.maxTrailPoints) {
                this.trailPointsC.shift();
            }

            // B trail (orange/cyan) shows B sweep at C=0
            const errorB = this.getError(0, this.currentB);
            this.trailPointsB.push({ x: errorB.x, y: errorB.y, z: errorB.z });
            if (this.trailPointsB.length > this.maxTrailPoints) {
                this.trailPointsB.shift();
            }
        } else if (this.sweepMode === 'combined') {
            // Combined mode: C and B vary together in a smooth pattern
            this.currentC += this.animationSpeed;
            if (this.currentC >= 360) this.currentC = 0;
            this.currentB = Math.sin(this.currentC * Math.PI / 180) * 60;

            this.updateNozzle();

            const error = this.getError(this.currentC, this.currentB);
            this.trailPointsC.push({ x: error.x, y: error.y, z: error.z });
            if (this.trailPointsC.length > this.maxTrailPoints) {
                this.trailPointsC.shift();
            }
        } else if (this.sweepMode === 'c') {
            // C sweep only at B=0
            this.currentC += this.animationSpeed;
            if (this.currentC >= 360) this.currentC = 0;
            this.currentB = 0;

            this.updateNozzle();

            const error = this.getError(this.currentC, this.currentB);
            this.trailPointsC.push({ x: error.x, y: error.y, z: error.z });
            if (this.trailPointsC.length > this.maxTrailPoints) {
                this.trailPointsC.shift();
            }
        } else if (this.sweepMode === 'b') {
            // B sweep only at C=0, oscillates -90 to 90
            this.currentC = 0;
            this.currentB += (this.bDirection || 1) * this.animationSpeed;
            if (this.currentB >= 90) {
                this.currentB = 90;
                this.bDirection = -1;
            } else if (this.currentB <= -90) {
                this.currentB = -90;
                this.bDirection = 1;
            }

            this.updateNozzle();

            const error = this.getError(this.currentC, this.currentB);
            this.trailPointsC.push({ x: error.x, y: error.y, z: error.z });
            if (this.trailPointsC.length > this.maxTrailPoints) {
                this.trailPointsC.shift();
            }
        }

        this.updateTrail();
    }

    renderLoop() {
        this.animationId = requestAnimationFrame(() => this.renderLoop());

        if (this.animating) {
            this.animate();
        }

        if (this.controls) {
            this.controls.update();
        }

        this.renderer.render(this.scene, this.camera);
    }

    start() {
        this.animating = true;
    }

    stop() {
        this.animating = false;
    }

    toggle() {
        if (this.animating) {
            this.stop();
        } else {
            this.start();
        }
    }

    reset() {
        this.stop();
        this.currentC = 0;
        this.currentB = 0;
        this.bDirection = 1;
        this.trailPointsC = [];
        this.trailPointsB = [];
        this.updateNozzle();
        this.updateTrail();
    }

    handleResize() {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight || 300;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    /**
     * Generate G-code for printer demo
     * Creates a smooth continuous motion that holds the nozzle at center while sweeping C/B
     */
    generateDemoGcode(options = {}) {
        if (!this.corrector || !this.corrector.loaded) {
            throw new Error('No calibration data loaded');
        }

        const {
            centerX = 100.7,
            centerY = 99.5,
            centerZ = 141.3,
            mode = this.mode,
            sweepMode = 'both',   // 'c', 'b', or 'both' (combined C+B)
            speed = 600,          // Smooth continuous motion
            rotations = 2,        // Number of full C rotations
            angleStep = 1,        // Degrees per step for smooth motion (smaller = slower)
            maxB = 60,            // Maximum B angle amplitude
            applyIK = true,
            lc = this.corrector.lc || 0,
            lb = this.corrector.lb || 47
        } = options;

        const gcode = [];

        // Header - matching format expected by gcode-corrector for detection
        gcode.push('; Rep5x Calibration Demo');
        gcode.push('; Generated by Rep5x Calibration Visualizer');
        gcode.push(`; Generated: ${new Date().toISOString()}`);
        gcode.push(';');
        gcode.push(`; Inverse Kinematics: ${applyIK ? 'enabled (software)' : 'disabled'}`);
        gcode.push(`; LC Parameter: ${lc}`);
        gcode.push(`; LB Parameter: ${lb}`);
        gcode.push(`; Calibration Correction: ${mode === 'calibrated' ? 'enabled' : 'disabled'}`);
        gcode.push(';');
        gcode.push(`; Demo Settings:`);
        gcode.push(`; Sweep Mode: ${sweepMode}`);
        gcode.push(`; Center (tip): X${centerX} Y${centerY} Z${centerZ}`);
        gcode.push(`; Rotations: ${rotations}, Step: ${angleStep}°, Speed: ${speed}mm/min`);
        gcode.push(';');
        gcode.push('; Smooth continuous motion demo');
        gcode.push('; The nozzle tip should stay at the same point');
        gcode.push('; while C/B axes rotate smoothly');
        gcode.push('');

        // IK function (matches firmware IK formulas)
        const applyIKTransform = (tipX, tipY, tipZ, cDeg, bDeg) => {
            const cRad = cDeg * Math.PI / 180;
            const bRad = bDeg * Math.PI / 180;

            return {
                x: tipX + Math.sin(cRad) * lc + Math.cos(cRad) * Math.sin(bRad) * lb,
                y: tipY - lc + Math.cos(cRad) * lc - Math.sin(cRad) * Math.sin(bRad) * lb,
                z: tipZ + Math.cos(bRad) * lb - lb
            };
        };

        // Helper to generate a move command
        // Output continuous C values, optimizer wraps to 0-360 and adds G92
        const generateMove = (c, b) => {
            const tipX = centerX;
            const tipY = centerY;
            const tipZ = centerZ;

            // Wrap C for calibration/IK calculations (physical angle is 0-360)
            const cWrapped = ((c % 360) + 360) % 360;

            // Apply IK first (uses wrapped angle for physical position)
            let machinePos = { x: tipX, y: tipY, z: tipZ };
            if (applyIK) {
                machinePos = applyIKTransform(tipX, tipY, tipZ, cWrapped, b);
            }

            // Apply calibration correction AFTER IK (correction is in machine coordinates)
            if (mode === 'calibrated') {
                const correction = this.corrector.getCorrection(cWrapped, b);
                machinePos.x -= correction.x;
                machinePos.y -= correction.y;
                machinePos.z -= correction.z;
            }

            // Output CONTINUOUS C value - optimizer wraps to 0-360 and adds G92
            return `G1 X${machinePos.x.toFixed(3)} Y${machinePos.y.toFixed(3)} Z${machinePos.z.toFixed(3)} C${c.toFixed(1)} B${b.toFixed(1)} F${speed}`;
        };

        // Start sequence - matching vase-generator style (homing only, no heating)
        gcode.push('G28 X ;Home X to prevent cable blocking Z homing');
        gcode.push('G28 ;Home all axes');
        gcode.push('G91 ;Relative positioning');
        gcode.push('G0 Z-20 F3000 ;Move Z down 20mm from top for bowden tube alignment');
        gcode.push('G90 ;Absolute positioning');
        gcode.push('M211 S0 ;Disable soft endstops (allows G92 with negative A values)');
        gcode.push('');

        // Move to demo position - all axes at once
        // NOTE: Don't apply calibration to G0 positioning move, only to G1 movements
        const startPos = applyIK
            ? applyIKTransform(centerX, centerY, centerZ, 0, 0)
            : { x: centerX, y: centerY, z: centerZ };
        gcode.push(`G0 X${startPos.x.toFixed(3)} Y${startPos.y.toFixed(3)} Z${startPos.z.toFixed(3)} C0.0 B0.0 F3000 ;Move to demo position`);
        gcode.push('G4 P500 ;Brief pause before starting');
        gcode.push('');

        // Generate smooth continuous sweep pattern
        const totalCDegrees = 360 * rotations;

        if (sweepMode === 'c') {
            // Pure C rotation at B=0
            gcode.push('; Smooth C-axis rotation at B=0');
            for (let c = 0; c <= totalCDegrees; c += angleStep) {
                gcode.push(generateMove(c, 0));
            }
        } else if (sweepMode === 'b') {
            // Smooth B sweep from -maxB to +maxB and back, multiple times
            gcode.push('; Smooth B-axis sweep at C=0');
            const bCycles = rotations;
            for (let cycle = 0; cycle < bCycles; cycle++) {
                // Forward: -maxB to +maxB
                for (let b = -maxB; b <= maxB; b += angleStep) {
                    gcode.push(generateMove(0, b));
                }
                // Backward: +maxB to -maxB
                for (let b = maxB; b >= -maxB; b -= angleStep) {
                    gcode.push(generateMove(0, b));
                }
            }
        } else if (sweepMode === 'both' || sweepMode === 'combined') {
            // Combined: C rotates while B oscillates sinusoidally
            // C does 360° while B does one half-oscillation (e.g., -60 to +60)
            gcode.push('; Combined C+B sweep');
            gcode.push('; C rotates 360 while B goes from min to max (or max to min)');

            // B does half an oscillation per C rotation
            // So for 3 C rotations, B does 1.5 full oscillations (3 half-cycles)
            const bOscillations = rotations / 2;
            for (let c = 0; c <= totalCDegrees; c += angleStep) {
                // B varies sinusoidally with C
                const bPhase = (c / totalCDegrees) * bOscillations * 2 * Math.PI;
                const b = Math.sin(bPhase) * maxB;
                gcode.push(generateMove(c, b));
            }
        }

        // Return to neutral
        gcode.push('');
        gcode.push('; Return to neutral position');
        gcode.push(generateMove(0, 0));

        // End sequence - matching vase-generator style
        gcode.push('');
        gcode.push(';End sequence');
        gcode.push('G4 P500 ;Brief pause');
        gcode.push('G91 ;Relative positioning');
        gcode.push('G1 Z10 F1000 ;Lift Z a bit');
        gcode.push('G90 ;Absolute positioning');
        gcode.push('G28 Z ;Home Z to max height');
        gcode.push('G4 P1000 ;Wait for Z axis to settle');
        gcode.push('');
        gcode.push('G0 X110 Y200 F3000 ;Move bed to back for easy access');
        gcode.push('G0 C0 B0 ;Return C and B to 0 degrees');
        gcode.push('');
        gcode.push('M211 S1 ;Re-enable soft endstops');
        gcode.push('M84 X Y C B ;Disable all steppers except Z');
        gcode.push('M117 Demo complete');

        // Apply C-axis shortest route optimization for smooth continuous rotation
        let result = gcode.join('\n');
        if (typeof optimizeCAxisRotation === 'function') {
            result = optimizeCAxisRotation(result, true);
        }

        return result;
    }

    dispose() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }

        if (this.renderer) {
            this.renderer.dispose();
            this.container.removeChild(this.renderer.domElement);
        }

        if (this.controls) {
            this.controls.dispose();
        }
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CalibrationVisualizer3D };
}
