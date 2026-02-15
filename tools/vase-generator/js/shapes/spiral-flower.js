// Spiral Flower shape for Rep5x vase generator

class SpiralFlower extends ShapeBase {
    constructor() {
        super(
            'spiral-flower',
            'Wavy spiral with flower flare demonstrating simultaneous non-planar C and B movement',
            'Spiral flower demonstrates simultaneous non-planar C-axis rotation and B-axis tilt. The toolpath spirals upward with sinusoidal Z oscillations while B keeps the nozzle perpendicular to the wall surface, tilting inward as the flower flares outward.'
        );
    }

    getDefaultParams() {
        return {
            flowerDiameter: 30,
            flowerHeight: 60,
            flowerWaves: 3,
            flowerWaveHeight: 3,
            flowerFlare: 15
        };
    }

    getTotalHeight(params) {
        return params.flowerHeight + params.flowerWaveHeight * 2;
    }

    getFilename(params) {
        return `rep5x_spiral-flower_${params.flowerDiameter}d_${params.flowerHeight}h_${params.flowerWaves}w_flare${params.flowerFlare}mm.gcode`;
    }

    /**
     * Smooth petal shape: rounded lobes with gentle valleys.
     * Slightly asymmetric via per-petal size variation.
     */
    petalShape(angle, waves) {
        const raw = 0.5 + 0.5 * Math.cos(waves * angle);
        const petal = Math.pow(raw, 1.3);
        const sizeVar = 1.0 + 0.25 * Math.sin(angle + 0.9);
        return petal * sizeVar;
    }

    /**
     * Compute radius at a given progress and angle.
     * Separated out so we can take the numerical derivative for wall angle.
     */
    getRadius(progress, angle, params) {
        const { flowerDiameter, flowerHeight, flowerWaves, flowerWaveHeight, flowerFlare } = params;
        const baseRadius = flowerDiameter / 2;

        // Wave envelope for stem ripple
        const waveEnvelope = Math.min(1, progress / 0.2);

        // --- Stem profile: wavy bulges along height ---
        // Creates wall angle changes that drive B movement on the stem.
        // Two undulations: bulge-narrow-bulge before the flare zone.
        const stemEnd = 0.65;
        let taper;
        if (progress < stemEnd) {
            const p = progress / stemEnd;
            // Two sine waves along the stem give bulge-narrow-bulge
            taper = 1.0 + 0.18 * Math.sin(p * Math.PI * 2);
        } else {
            taper = 1.0;
        }

        let radius = baseRadius * taper;

        // --- Subtle stem radial ripple ---
        const stemRipple = baseRadius * 0.06 * Math.sin(flowerWaves * angle) * waveEnvelope;

        // --- Flare zone (top 35%) ---
        let flareT = 0;
        if (progress > 0.65) {
            flareT = smoothstep((progress - 0.65) / 0.35);
        }

        // Stem ripple fades out, petal flare fades in
        radius += stemRipple * (1 - flareT);

        if (flareT > 0) {
            const petal = this.petalShape(angle, flowerWaves);
            const valleyFloor = 0.15;
            const flareAmount = flowerFlare * flareT * (valleyFloor + (1 - valleyFloor) * petal);
            radius += flareAmount;
        }

        return radius;
    }

    /**
     * Get the full profile at a given progress and angle.
     *
     * Nozzle orientation:
     *   C = angle (radial direction, pointing outward from vase center)
     *   B = -wall_angle (nozzle tilts inward to stay perpendicular to the wall surface)
     *
     * Wall angle is computed from the numerical derivative of radius with respect to height.
     * Where the wall flares outward (dr/dz > 0), B is negative (nozzle points inward).
     * Where the wall tapers inward (dr/dz < 0), B is positive (nozzle points outward).
     */
    getProfile(progress, angle, params) {
        const { flowerHeight, flowerWaves, flowerWaveHeight } = params;

        const radius = this.getRadius(progress, angle, params);

        // --- Z waves ---
        const waveEnvelope = Math.min(1, progress / 0.2);
        let flareT = 0;
        if (progress > 0.65) {
            flareT = smoothstep((progress - 0.65) / 0.35);
        }
        const waveAmp = flowerWaveHeight * (1 + flareT * 0.6);
        const waveZ = waveAmp * Math.sin(flowerWaves * angle) * waveEnvelope;
        const z = progress * flowerHeight + waveZ;

        // --- Wall angle from numerical derivative of radius vs height ---
        const dt = 0.002;
        const tPlus = Math.min(1, progress + dt);
        const tMinus = Math.max(0, progress - dt);
        const rPlus = this.getRadius(tPlus, angle, params);
        const rMinus = this.getRadius(tMinus, angle, params);
        const drdz = (rPlus - rMinus) / ((tPlus - tMinus) * flowerHeight);

        // Wall tilt angle from vertical (positive = wall goes outward)
        const wallAngle = Math.atan(drdz);

        // Nozzle perpendicular to wall: tilt inward when wall goes outward
        const bAngle = wallAngle;

        // C = radial direction (pointing outward from center)
        const cAngle = angle;

        return { radius, z, bAngle, cAngle };
    }

    createGeometry(params) {
        const geometry = new THREE.BufferGeometry();
        const vertices = [];
        const indices = [];
        const segments = 64;
        const layers = 80;

        for (let i = 0; i <= layers; i++) {
            const progress = i / layers;

            for (let j = 0; j <= segments; j++) {
                const theta = (j / segments) * Math.PI * 2;
                const profile = this.getProfile(progress, theta, params);

                vertices.push(
                    profile.radius * Math.cos(theta),
                    profile.z,
                    profile.radius * Math.sin(theta)
                );
            }
        }

        for (let i = 0; i < layers; i++) {
            for (let j = 0; j < segments; j++) {
                const a = i * (segments + 1) + j;
                const b = a + segments + 1;
                indices.push(a, b, a + 1, b, b + 1, a + 1);
            }
        }

        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();
        return geometry;
    }

    createPath(params) {
        const pathPoints = [];
        const totalPoints = 600;

        for (let i = 0; i < totalPoints; i++) {
            const progress = i / totalPoints;
            const angle = (i * 10) * Math.PI / 180;
            const profile = this.getProfile(progress, angle, params);
            const r = profile.radius * 1.02;

            pathPoints.push(new THREE.Vector3(
                r * Math.cos(angle),
                profile.z,
                r * Math.sin(angle)
            ));
        }

        return pathPoints;
    }

    generateGcode(params, layerHeight, speed) {
        const { flowerDiameter, flowerHeight, flowerWaves, flowerWaveHeight, flowerFlare } = params;
        const gcode = [];
        const resolution = 100;

        const filamentArea = Math.PI * Math.pow(1.75 / 2, 2);
        const extrusionMultiplier = (layerHeight * 0.4) / filamentArea;

        gcode.push("; === SPIRAL FLOWER VASE ===");
        gcode.push(`; Diameter: ${flowerDiameter}mm, Height: ${flowerHeight}mm`);
        gcode.push(`; Waves: ${flowerWaves}, Wave Height: ${flowerWaveHeight}mm`);
        gcode.push(`; Flare: ${flowerFlare}mm`);
        gcode.push("; Non-planar C + B axis demonstration");
        gcode.push("; C = radial, B = perpendicular to wall surface (inward on flare)");

        let prevPos = null;
        let totalAngle = 0;

        const addMove = (x, y, z, C, B, isFirst, speedMult = 1) => {
            let deltaE = 0;
            const pos = { x, y, z };
            if (prevPos) deltaE = distance3D(pos, prevPos) * extrusionMultiplier;

            if (isFirst) {
                gcode.push(`G0 X${x.toFixed(3)} Y${y.toFixed(3)} Z${z.toFixed(3)} C${C.toFixed(3)} B${B.toFixed(3)}`);
            } else {
                gcode.push(`G1 X${x.toFixed(3)} Y${y.toFixed(3)} Z${z.toFixed(3)} C${C.toFixed(3)} B${B.toFixed(3)} E${deltaE.toFixed(4)} F${Math.round(speed * speedMult)}`);
            }
            prevPos = pos;
        };

        // Wavy spiral body
        gcode.push("", "; === WAVY SPIRAL BODY ===");
        const totalRotations = flowerHeight / layerHeight;
        const totalSegments = Math.round(totalRotations * resolution);

        for (let i = 0; i <= totalSegments; i++) {
            const t = i / totalSegments;
            const angle = totalAngle + (i / resolution) * 2 * Math.PI;

            const profile = this.getProfile(t, angle, params);

            const x = profile.radius * Math.cos(angle);
            const y = profile.radius * Math.sin(angle);

            const B = profile.bAngle * 180 / Math.PI;
            const C = profile.cAngle * 180 / Math.PI;

            const speedMult = t > 0.65 ? 0.6 : 1.0;

            addMove(x, y, profile.z, C, B, i === 0, speedMult);
        }

        return gcode;
    }
}
