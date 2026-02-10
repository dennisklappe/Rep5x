// STL handler for Rep5x Spline Slicer - loads STL files and extracts triangle data

class STLHandler {
    constructor() {
        this.geometry = null;
        this.triangles = [];
        this.modelInfo = null;
    }

    /**
     * Load an STL file from a File object
     * @param {File} file - The STL file to load
     * @returns {Promise<THREE.BufferGeometry>} The loaded geometry
     */
    loadFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const loader = new THREE.STLLoader();
                    const geometry = loader.parse(e.target.result);
                    this.geometry = geometry;
                    this.autoCentre(geometry);
                    this.triangles = this.extractTriangles(geometry);
                    this.modelInfo = this.getModelInfo(geometry, file);
                    resolve(geometry);
                } catch (error) {
                    reject(new Error('Failed to parse STL file: ' + error.message));
                }
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsArrayBuffer(file);
        });
    }

    /**
     * Extract triangles from geometry as array of {v0, v1, v2} objects
     * @param {THREE.BufferGeometry} geometry
     * @returns {Array} Array of triangle objects
     */
    extractTriangles(geometry) {
        const position = geometry.getAttribute('position');
        const index = geometry.getIndex();
        const triangles = [];

        if (index) {
            for (let i = 0; i < index.count; i += 3) {
                const i0 = index.getX(i);
                const i1 = index.getX(i + 1);
                const i2 = index.getX(i + 2);
                triangles.push({
                    v0: new THREE.Vector3(position.getX(i0), position.getY(i0), position.getZ(i0)),
                    v1: new THREE.Vector3(position.getX(i1), position.getY(i1), position.getZ(i1)),
                    v2: new THREE.Vector3(position.getX(i2), position.getY(i2), position.getZ(i2))
                });
            }
        } else {
            for (let i = 0; i < position.count; i += 3) {
                triangles.push({
                    v0: new THREE.Vector3(position.getX(i), position.getY(i), position.getZ(i)),
                    v1: new THREE.Vector3(position.getX(i + 1), position.getY(i + 1), position.getZ(i + 1)),
                    v2: new THREE.Vector3(position.getX(i + 2), position.getY(i + 2), position.getZ(i + 2))
                });
            }
        }

        return triangles;
    }

    /**
     * Auto-centre geometry: bottom at Y=0, XZ centred at origin
     * @param {THREE.BufferGeometry} geometry
     */
    autoCentre(geometry) {
        geometry.computeBoundingBox();
        const box = geometry.boundingBox;
        const centreX = (box.min.x + box.max.x) / 2;
        const centreZ = (box.min.z + box.max.z) / 2;
        const minY = box.min.y;

        geometry.translate(-centreX, -minY, -centreZ);
        geometry.computeBoundingBox();
    }

    /**
     * Get model information
     * @param {THREE.BufferGeometry} geometry
     * @param {File} file
     * @returns {object} Model info
     */
    getModelInfo(geometry, file) {
        geometry.computeBoundingBox();
        const box = geometry.boundingBox;
        const size = new THREE.Vector3();
        box.getSize(size);

        const position = geometry.getAttribute('position');
        const index = geometry.getIndex();
        const triangleCount = index ? index.count / 3 : position.count / 3;

        return {
            triangleCount,
            dimensions: {
                x: size.x.toFixed(1),
                y: size.y.toFixed(1),
                z: size.z.toFixed(1)
            },
            fileSize: file.size,
            fileName: file.name
        };
    }

    /**
     * Rotate the geometry by 90 degrees around an axis, then re-centre and re-extract triangles
     * @param {string} axis - 'x', 'y', or 'z'
     * @param {number} direction - 1 for positive, -1 for negative
     */
    rotate90(axis, direction = 1) {
        if (!this.geometry) return;

        const angle = direction * Math.PI / 2;

        // Apply rotation to the geometry buffer directly
        const matrix = new THREE.Matrix4();
        if (axis === 'x') matrix.makeRotationX(angle);
        else if (axis === 'y') matrix.makeRotationY(angle);
        else if (axis === 'z') matrix.makeRotationZ(angle);

        this.geometry.applyMatrix4(matrix);

        // Re-centre after rotation
        this.autoCentre(this.geometry);

        // Re-extract triangles from the rotated geometry
        this.triangles = this.extractTriangles(this.geometry);

        // Update dimensions in model info
        if (this.modelInfo) {
            this.geometry.computeBoundingBox();
            const size = new THREE.Vector3();
            this.geometry.boundingBox.getSize(size);
            this.modelInfo.dimensions = {
                x: size.x.toFixed(1),
                y: size.y.toFixed(1),
                z: size.z.toFixed(1)
            };
        }
    }

    /**
     * Get the loaded geometry
     * @returns {THREE.BufferGeometry|null}
     */
    getGeometry() {
        return this.geometry;
    }

    /**
     * Get the extracted triangles
     * @returns {Array}
     */
    getTriangles() {
        return this.triangles;
    }

    /**
     * Get model info
     * @returns {object|null}
     */
    getInfo() {
        return this.modelInfo;
    }
}
