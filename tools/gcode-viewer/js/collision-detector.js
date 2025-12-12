// Collision detection for Rep5x G-code viewer
// Detects collisions between printhead components and printed path/build plate

class CollisionDetector {
    constructor() {
        // Default printhead dimensions (in local space, nozzle tip at origin)
        this.heatblock = {
            halfSize: { x: 12, y: 10, z: 12 },
            center: { x: 2, y: 18, z: 0 }
        };

        this.nozzle = {
            radius: 4.5,
            bottom: 2,
            top: 8
        };

        this.cable = null;

        this.collisionPoints = [];
    }

    setParams(params) {
        if (params.heatblock) {
            this.heatblock = params.heatblock;
        }
        if (params.nozzle) {
            this.nozzle = params.nozzle;
        }
        this.cable = params.cable || null;
    }

    analyzeCollisions(commands) {
        this.collisionPoints = [];
        let tempPath = [];
        let position = { x: 0, y: 0, z: 0, a: 0, b: 0 };
        let lastCollisionStep = -100;

        for (let i = 0; i < commands.length; i++) {
            const command = commands[i];
            if (!command || command.type === 'reset') continue;

            if (command.x !== null) position.x = command.x;
            if (command.y !== null) position.y = command.y;
            if (command.z !== null) position.z = command.z;
            if (command.a !== null) position.a = command.a;
            if (command.b !== null) position.b = command.b;

            if (tempPath.length > 20 && i - lastCollisionStep > 10) {
                const hasCollision = this.checkCollisionWithPath(position, tempPath);
                if (hasCollision) {
                    this.collisionPoints.push({
                        step: i,
                        position: { ...position }
                    });
                    lastCollisionStep = i;
                }
            }

            if (command.e !== null && command.e > 0) {
                tempPath.push(new THREE.Vector3(
                    position.x,
                    position.z,
                    -position.y
                ));
            }
        }

        return this.collisionPoints;
    }

    checkCollisionWithPath(position, path) {
        const nozzleTip = new THREE.Vector3(
            position.x,
            position.z,
            -position.y
        );

        const aRad = -position.a * Math.PI / 180;
        const bRad = -position.b * Math.PI / 180;

        // Build rotation matrix matching printhead orientation
        const matrix = new THREE.Matrix4();
        matrix.makeRotationY(aRad);
        const matrixZ = new THREE.Matrix4();
        matrixZ.makeRotationZ(bRad);
        matrix.multiply(matrixZ);

        // Check components against build plate
        if (this.checkBuildPlateCollision(nozzleTip, matrix)) {
            return true;
        }

        // Check path points against printhead components
        const inverseMatrix = matrix.clone().invert();

        for (let i = 0; i < path.length - 5; i++) {
            const point = path[i];

            const toPoint = new THREE.Vector3(
                point.x - nozzleTip.x,
                point.y - nozzleTip.y,
                point.z - nozzleTip.z
            );

            if (toPoint.length() < 3) continue;

            const localPoint = toPoint.clone().applyMatrix4(inverseMatrix);

            if (this.checkNozzleCollision(localPoint)) return true;
            if (this.checkHeatblockCollision(localPoint)) return true;
            if (this.checkCableCollision(localPoint)) return true;
        }

        return false;
    }

    checkBuildPlateCollision(nozzleTip, matrix) {
        const hb = this.heatblock;

        // Check heatblock corners
        const corners = [
            new THREE.Vector3(hb.center.x - hb.halfSize.x, hb.center.y - hb.halfSize.y, hb.center.z - hb.halfSize.z),
            new THREE.Vector3(hb.center.x + hb.halfSize.x, hb.center.y - hb.halfSize.y, hb.center.z - hb.halfSize.z),
            new THREE.Vector3(hb.center.x - hb.halfSize.x, hb.center.y - hb.halfSize.y, hb.center.z + hb.halfSize.z),
            new THREE.Vector3(hb.center.x + hb.halfSize.x, hb.center.y - hb.halfSize.y, hb.center.z + hb.halfSize.z),
            new THREE.Vector3(hb.center.x - hb.halfSize.x, hb.center.y + hb.halfSize.y, hb.center.z - hb.halfSize.z),
            new THREE.Vector3(hb.center.x + hb.halfSize.x, hb.center.y + hb.halfSize.y, hb.center.z - hb.halfSize.z),
            new THREE.Vector3(hb.center.x - hb.halfSize.x, hb.center.y + hb.halfSize.y, hb.center.z + hb.halfSize.z),
            new THREE.Vector3(hb.center.x + hb.halfSize.x, hb.center.y + hb.halfSize.y, hb.center.z + hb.halfSize.z),
        ];

        for (const corner of corners) {
            const worldCorner = corner.clone().applyMatrix4(matrix).add(nozzleTip);
            if (worldCorner.y < 0) return true;
        }

        // Check nozzle cylinder (bottom edge only)
        for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
            const nozzlePoint = new THREE.Vector3(
                this.nozzle.radius * Math.cos(angle),
                this.nozzle.bottom,
                this.nozzle.radius * Math.sin(angle)
            );
            if (nozzlePoint.clone().applyMatrix4(matrix).add(nozzleTip).y < 0) return true;
        }

        // Check cable (outer end only) - if present
        if (this.cable) {
            for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
                const cablePoint = new THREE.Vector3(
                    this.cable.center.x - this.cable.halfLength,
                    this.cable.center.y + this.cable.radius * Math.cos(angle),
                    this.cable.center.z + this.cable.radius * Math.sin(angle)
                );
                if (cablePoint.clone().applyMatrix4(matrix).add(nozzleTip).y < 0) return true;
            }
        }

        return false;
    }

    checkNozzleCollision(localPoint) {
        const distFromAxis = Math.sqrt(localPoint.x * localPoint.x + localPoint.z * localPoint.z);
        return distFromAxis < this.nozzle.radius &&
               localPoint.y > this.nozzle.bottom &&
               localPoint.y < this.nozzle.top;
    }

    checkHeatblockCollision(localPoint) {
        const hb = this.heatblock;
        const relX = localPoint.x - hb.center.x;
        const relY = localPoint.y - hb.center.y;
        const relZ = localPoint.z - hb.center.z;

        return Math.abs(relX) < hb.halfSize.x &&
               Math.abs(relY) < hb.halfSize.y &&
               Math.abs(relZ) < hb.halfSize.z;
    }

    checkCableCollision(localPoint) {
        if (!this.cable) return false;

        const cable = this.cable;
        const relX = localPoint.x - cable.center.x;
        const relY = localPoint.y - cable.center.y;
        const relZ = localPoint.z - cable.center.z;
        const distFromCableAxis = Math.sqrt(relY * relY + relZ * relZ);

        return distFromCableAxis < cable.radius && Math.abs(relX) < cable.halfLength;
    }

    getCollisionPoints() {
        return this.collisionPoints;
    }

    getVisibleCollisions(currentStep) {
        return this.collisionPoints.filter(c => c.step <= currentStep);
    }
}
