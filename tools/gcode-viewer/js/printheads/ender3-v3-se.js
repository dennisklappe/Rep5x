// Ender 3 V3 SE printhead definition
// Sprite Extruder with copper-plated nozzle

class Ender3V3SEPrinthead extends PrintheadBase {
    constructor() {
        super();

        this.id = 'ender3-v3-se';
        this.name = 'Ender 3 V3 SE';
        this.description = 'Creality Sprite Extruder hotend';

        // Collision detection dimensions
        this.collision = {
            heatblock: {
                halfSize: { x: 12, y: 10, z: 12 },
                center: { x: 2, y: 18, z: 0 }
            },
            nozzle: {
                radius: 4.5,
                bottom: 2,
                top: 8
            },
            cable: {
                radius: 3,
                center: { x: -15, y: 18, z: 0 },
                halfLength: 5
            }
        };
    }

    createMesh() {
        const group = new THREE.Group();

        // Nozzle tip (copper colored cone)
        const tipGeometry = new THREE.ConeGeometry(1, 2, 8);
        const tipMaterial = new THREE.MeshPhongMaterial({
            color: 0xB87333,
            transparent: true,
            opacity: 0.8
        });
        const tip = new THREE.Mesh(tipGeometry, tipMaterial);
        tip.rotation.x = Math.PI;
        tip.position.set(0, 1, 0);
        group.add(tip);

        // Nozzle body (6mm height, 9mm diameter)
        const nozzleGeometry = new THREE.CylinderGeometry(4.5, 4.5, 6, 16);
        const nozzleMaterial = new THREE.MeshPhongMaterial({
            color: 0xB87333,
            transparent: true,
            opacity: 0.8
        });
        const nozzle = new THREE.Mesh(nozzleGeometry, nozzleMaterial);
        nozzle.position.set(0, 5, 0);
        group.add(nozzle);

        // Heatblock (24mm x 20mm x 24mm, offset +2 in X)
        const heatblockGeometry = new THREE.BoxGeometry(24, 20, 24);
        const heatblockMaterial = new THREE.MeshPhongMaterial({
            color: 0x888888,
            transparent: true,
            opacity: 0.7
        });
        const heatblock = new THREE.Mesh(heatblockGeometry, heatblockMaterial);
        heatblock.position.set(2, 18, 0);
        group.add(heatblock);

        // Heater cable (10mm length, 6mm diameter)
        const cableGeometry = new THREE.CylinderGeometry(3, 3, 10, 8);
        const cableMaterial = new THREE.MeshPhongMaterial({
            color: 0x333333,
            transparent: true,
            opacity: 0.6
        });
        const cable = new THREE.Mesh(cableGeometry, cableMaterial);
        cable.rotation.z = Math.PI / 2;
        cable.position.set(-15, 18, 0);
        group.add(cable);

        return group;
    }
}

// Register this printhead
PrintheadRegistry.register(new Ender3V3SEPrinthead());
