// Base class for printhead definitions
// Extend this class to add new printhead types

class PrintheadBase {
    constructor() {
        // Override these in subclasses
        this.id = 'base';
        this.name = 'Base Printhead';
        this.description = 'Base printhead class';

        // Collision detection dimensions (in local space, nozzle tip at origin)
        // Override these in subclasses to match actual printhead geometry
        this.collision = {
            heatblock: {
                halfSize: { x: 12, y: 10, z: 12 },
                center: { x: 0, y: 18, z: 0 }
            },
            nozzle: {
                radius: 4.5,
                bottom: 2,
                top: 8
            },
            cable: null
        };
    }

    // Create Three.js group for this printhead
    // Override in subclasses
    createMesh() {
        const group = new THREE.Group();

        // Default simple printhead
        const heatblockGeometry = new THREE.BoxGeometry(24, 20, 24);
        const heatblockMaterial = new THREE.MeshPhongMaterial({
            color: 0x888888,
            transparent: true,
            opacity: 0.7
        });
        const heatblock = new THREE.Mesh(heatblockGeometry, heatblockMaterial);
        heatblock.position.set(0, 18, 0);
        group.add(heatblock);

        return group;
    }

    // Get collision parameters for CollisionDetector
    getCollisionParams() {
        return this.collision;
    }
}

// Registry for all available printheads
const PrintheadRegistry = {
    printheads: {},

    register(printhead) {
        this.printheads[printhead.id] = printhead;
    },

    get(id) {
        return this.printheads[id] || null;
    },

    getAll() {
        return Object.values(this.printheads);
    },

    getList() {
        return Object.values(this.printheads).map(p => ({
            id: p.id,
            name: p.name,
            description: p.description
        }));
    }
};
