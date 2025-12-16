// Scene objects for Rep5x G-code viewer
// Creates build platform, axes, and schematic printhead

class SceneObjects {
    static createBuildPlatform(scene) {
        const platformGeometry = new THREE.PlaneGeometry(220, 220);
        const platformMaterial = new THREE.MeshLambertMaterial({
            color: 0xe2e8f0,
            transparent: true,
            opacity: 0.5
        });
        const platform = new THREE.Mesh(platformGeometry, platformMaterial);
        platform.rotation.x = -Math.PI / 2;
        platform.position.y = 0;
        platform.receiveShadow = true;
        scene.add(platform);

        const gridHelper = new THREE.GridHelper(220, 22, 0x94a3b8, 0xd1d5db);
        gridHelper.position.y = 0;
        scene.add(gridHelper);

        return platform;
    }

    static createSchematicPrinthead() {
        const group = new THREE.Group();

        // Nozzle cylinder
        const nozzleGeometry = new THREE.CylinderGeometry(2, 2, 12, 8);
        const nozzleMaterial = new THREE.MeshPhongMaterial({ color: 0x333333 });
        const nozzle = new THREE.Mesh(nozzleGeometry, nozzleMaterial);
        nozzle.position.set(0, 14, 0);
        group.add(nozzle);

        // Hotend block
        const hotendGeometry = new THREE.BoxGeometry(15, 10, 15);
        const hotendMaterial = new THREE.MeshPhongMaterial({ color: 0x666666 });
        const hotend = new THREE.Mesh(hotendGeometry, hotendMaterial);
        hotend.position.set(0, 25, 0);
        group.add(hotend);

        // Direction indicator (red cone with tip at nozzle)
        const arrowGeometry = new THREE.ConeGeometry(3, 8, 8);
        const arrowMaterial = new THREE.MeshPhongMaterial({ color: 0xff6b6b });
        const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
        arrow.rotation.x = Math.PI;
        arrow.position.set(0, 4, 0);
        group.add(arrow);

        // A-axis rotation indicator (green arrow)
        const markerGeometry = new THREE.ConeGeometry(2, 8, 4);
        const markerMaterial = new THREE.MeshPhongMaterial({ color: 0x00ff00 });
        const marker = new THREE.Mesh(markerGeometry, markerMaterial);
        marker.rotation.z = Math.PI / 2;
        marker.position.set(-10, 15, 0);
        group.add(marker);

        group.nozzle = nozzle;
        group.hotend = hotend;
        group.arrow = arrow;
        group.marker = marker;

        return group;
    }

    static createAxes() {
        const axesGroup = new THREE.Group();
        const axisLength = 50;
        const axisRadius = 1;

        // X-axis (red)
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

        // Y-axis (green)
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

        // Z-axis (blue)
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

    static createLighting(scene) {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
        scene.add(ambientLight);

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
        scene.add(directionalLight);
    }
}
