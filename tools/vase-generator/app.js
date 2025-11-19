// Three.js Scene Setup
let scene, camera, renderer, mesh, wireframeMesh, pathLine;
let platform, gridHelper;
let animationId;

// Shape information
const shapeInfo = {
    "elbow-pipe": "Elbow pipe demonstrates the pitch axis printing capability."
};

function initThreeJS() {
    const canvas = document.getElementById('canvas3d');
    const loadingDiv = document.getElementById('loading');
    
    // Scene setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf8fafc);
    
    // Camera
    camera = new THREE.PerspectiveCamera(
        45,
        canvas.offsetWidth / canvas.offsetHeight,
        0.1,
        1000
    );
    camera.position.set(120, 80, 120);
    camera.lookAt(0, 40, 0);

    // Renderer
    renderer = new THREE.WebGLRenderer({ 
        canvas, 
        antialias: true,
        alpha: true 
    });
    renderer.setSize(canvas.offsetWidth, canvas.offsetHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Lighting
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

    // Build platform - will be updated based on bed size
    updateBuildPlatform();

    // Mouse controls
    setupMouseControls();
    
    // Initial preview
    updatePreview();
    
    // Hide loading indicator
    loadingDiv.style.display = 'none';
    
    // Start animation loop
    animate();
}

function setupMouseControls() {
    const canvas = document.getElementById('canvas3d');
    let isMouseDown = false;
    let mouseButton = null;
    let mouseX = 0, mouseY = 0;
    let cameraTarget = new THREE.Vector3(0, 40, 0);

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
            spherical.setFromVector3(camera.position.clone().sub(cameraTarget));
            
            spherical.theta -= deltaX * 0.01;
            spherical.phi += deltaY * 0.01;
            spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));
            
            camera.position.copy(cameraTarget).add(new THREE.Vector3().setFromSpherical(spherical));
            camera.lookAt(cameraTarget);
            
        } else if (mouseButton === 2) {
            // Right button: pan
            const distance = camera.position.distanceTo(cameraTarget);
            const panSpeed = distance * 0.001;
            
            const left = new THREE.Vector3();
            const up = new THREE.Vector3();
            
            left.setFromMatrixColumn(camera.matrix, 0);
            up.setFromMatrixColumn(camera.matrix, 1);
            
            const panOffset = new THREE.Vector3();
            panOffset.addScaledVector(left, -deltaX * panSpeed);
            panOffset.addScaledVector(up, deltaY * panSpeed);
            
            camera.position.add(panOffset);
            cameraTarget.add(panOffset);
            camera.lookAt(cameraTarget);
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
        spherical.setFromVector3(camera.position);
        
        spherical.theta -= deltaX * 0.01;
        spherical.phi += deltaY * 0.01;
        spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));
        
        camera.position.setFromSpherical(spherical);
        camera.lookAt(0, 40, 0);
    });

    // Mouse wheel zoom
    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        
        const spherical = new THREE.Spherical();
        spherical.setFromVector3(camera.position.clone().sub(cameraTarget));
        
        // Zoom in/out
        const zoomSpeed = 0.1;
        spherical.radius += e.deltaY * zoomSpeed;
        
        // Constrain zoom
        spherical.radius = Math.max(10, Math.min(1000, spherical.radius));
        
        camera.position.copy(cameraTarget).add(new THREE.Vector3().setFromSpherical(spherical));
        camera.lookAt(cameraTarget);
    });

    canvas.style.cursor = 'grab';
}

function animate() {
    animationId = requestAnimationFrame(animate);
    renderer.render(scene, camera);
}

function updatePreview() {
    // Remove existing meshes
    if (mesh) {
        scene.remove(mesh);
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) mesh.material.dispose();
        mesh = null;
    }
    
    if (wireframeMesh) {
        scene.remove(wireframeMesh);
        if (wireframeMesh.geometry) wireframeMesh.geometry.dispose();
        if (wireframeMesh.material) wireframeMesh.material.dispose();
        wireframeMesh = null;
    }
    
    if (pathLine) {
        if (pathLine.lines) {
            // Handle multiple lines
            pathLine.lines.forEach(line => {
                scene.remove(line);
                if (line.geometry) line.geometry.dispose();
                if (line.material) line.material.dispose();
            });
        } else {
            // Handle single line (fallback)
            scene.remove(pathLine);
            if (pathLine.geometry) pathLine.geometry.dispose();
            if (pathLine.material) pathLine.material.dispose();
        }
        pathLine = null;
    }

    const shape = document.getElementById('shape').value;
    const diameter = parseFloat(document.getElementById('diameter').value);
    const vertical = parseFloat(document.getElementById('vertical').value);
    const horizontal = parseFloat(document.getElementById('horizontal').value);
    const tilt = parseFloat(document.getElementById('tilt').value);

    // Update shape info
    document.getElementById('shapeInfo').innerHTML = `<p>${shapeInfo[shape]}</p>`;

    // Create geometry based on shape
    let geometry;
    
    try {
        // Only elbow pipe supported
        geometry = createElbowPipe(diameter/2, vertical, horizontal, tilt);

        // Use theme colors for the material
        const theme = getTheme();
        const primaryColor = new THREE.Color(theme.colors.primary);
        
        const material = new THREE.MeshPhongMaterial({
            color: primaryColor,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.9,
            shininess: 100
        });

        mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);
        
        // Add wireframe for better visualization
        const wireframeGeometry = geometry.clone();
        const wireframeColor = new THREE.Color(theme.colors.primary).multiplyScalar(0.7); // Darker version
        
        const wireframeMaterial = new THREE.MeshBasicMaterial({
            color: wireframeColor,
            wireframe: true,
            transparent: true,
            opacity: 0.1
        });
        wireframeMesh = new THREE.Mesh(wireframeGeometry, wireframeMaterial);
        scene.add(wireframeMesh);
        
        // Add spiral print path visualization
        createPrintPath(shape, diameter/2, vertical, horizontal, tilt);
        
    } catch (error) {
        console.error('Error creating geometry:', error);
    }
}

// Shape generation is now handled by individual shape modules

function updateBuildPlatform() {
    // Remove existing platform and grid
    if (platform) {
        scene.remove(platform);
        if (platform.geometry) platform.geometry.dispose();
        if (platform.material) platform.material.dispose();
    }
    if (gridHelper) {
        scene.remove(gridHelper);
        if (gridHelper.geometry) gridHelper.geometry.dispose();
        if (gridHelper.material) gridHelper.material.dispose();
    }
    
    // Get bed size from UI
    const bedWidth = parseFloat(document.getElementById('bedWidth').value) || 200;
    const bedDepth = parseFloat(document.getElementById('bedDepth').value) || 200;
    
    // Create new platform
    const platformGeometry = new THREE.PlaneGeometry(bedWidth, bedDepth);
    const platformMaterial = new THREE.MeshLambertMaterial({ 
        color: 0xe2e8f0,
        transparent: true,
        opacity: 0.5 
    });
    platform = new THREE.Mesh(platformGeometry, platformMaterial);
    platform.rotation.x = -Math.PI / 2;
    platform.receiveShadow = true;
    scene.add(platform);

    // Create new grid
    const gridSize = Math.max(bedWidth, bedDepth);
    const gridDivisions = Math.max(10, Math.floor(gridSize / 20));
    gridHelper = new THREE.GridHelper(gridSize, gridDivisions, 0x94a3b8, 0xd1d5db);
    gridHelper.position.y = 0.1;
    scene.add(gridHelper);
    
    // Add coordinate system arrows at origin (0,0,0) - same style as G-code previewer
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
    
    scene.add(axesGroup);
}

function createPrintPath(shape, radius, verticalHeight, horizontalLength, tilt) {
    let pathPoints = [];
    
    // Let the shape module handle the path generation
    if (shape === 'elbow-pipe') {
        pathPoints = createElbowPipePath(radius, verticalHeight, horizontalLength, tilt);
    } else {
        // Fallback for other shapes (if any)
        const totalPoints = 300;
        
        for (let i = 0; i < totalPoints; i++) {
            const t = i / totalPoints;
            const angle = (i * 360 / 30) % 360;
            const rad = angle * Math.PI / 180;
            
            const x = radius * Math.cos(rad);
            const y = t * verticalHeight;
            const z = radius * Math.sin(rad);
            
            pathPoints.push(new THREE.Vector3(x, y, z));
        }
    }
    
    // Create single continuous line
    const pathGeometry = new THREE.BufferGeometry().setFromPoints(pathPoints);
    const pathMaterial = new THREE.LineBasicMaterial({ 
        color: 0x000000, // Black
        linewidth: 3,
        transparent: true,
        opacity: 0.8
    });
    
    const spiralLine = new THREE.Line(pathGeometry, pathMaterial); // Single continuous line
    scene.add(spiralLine);
    
    // Store reference for cleanup
    pathLine = { lines: [spiralLine] };
}

// G-code generation
function generateGcode() {
    const button = document.getElementById('generate');
    const originalText = button.innerHTML;
    
    // Show loading state
    button.innerHTML = '<div class="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>Generating...';
    button.disabled = true;
    
    setTimeout(() => {
        try {
            const shape = document.getElementById('shape').value;
            const diameter = parseFloat(document.getElementById('diameter').value);
            const vertical = parseFloat(document.getElementById('vertical').value);
            const horizontal = parseFloat(document.getElementById('horizontal').value);
            const layerHeight = parseFloat(document.getElementById('layerHeight').value);
            const speed = parseFloat(document.getElementById('speed').value) * 60; // mm/min
            const tilt = parseFloat(document.getElementById('tilt').value);

            // Get bed size
            const bedWidth = parseFloat(document.getElementById('bedWidth').value);
            const bedDepth = parseFloat(document.getElementById('bedDepth').value);

            // Get temperature settings
            const nozzleTemp = parseFloat(document.getElementById('nozzleTemp').value);
            const bedTemp = parseFloat(document.getElementById('bedTemp').value);
            const nozzleDiameter = getNozzleDiameter();

            // Get custom G-code and replace temperature placeholders
            let startGcode = document.getElementById('startGcode').value;
            let endGcode = document.getElementById('endGcode').value;

            // Calculate bed center
            const bedCenterX = bedWidth / 2;
            const bedCenterY = bedDepth / 2;

            // Replace temperature placeholders in start/end G-code
            // Handle OrcaSlicer/BambuStudio style placeholders
            startGcode = startGcode.replace(/\[nozzle_temperature_initial_layer\]/g, nozzleTemp);
            startGcode = startGcode.replace(/\[bed_temperature_initial_layer_single\]/g, bedTemp);
            startGcode = startGcode.replace(/\[bed_center_x\]/g, bedCenterX);
            startGcode = startGcode.replace(/\[bed_center_y\]/g, bedCenterY);
            endGcode = endGcode.replace(/\[nozzle_temperature_initial_layer\]/g, nozzleTemp);
            endGcode = endGcode.replace(/\[bed_temperature_initial_layer_single\]/g, bedTemp);

            // Handle hardcoded M-codes (fallback for older start/end gcode)
            startGcode = startGcode.replace(/M104 S\d+/g, `M104 S${nozzleTemp}`);
            startGcode = startGcode.replace(/M109 S\d+/g, `M109 S${nozzleTemp}`);
            startGcode = startGcode.replace(/M140 S\d+/g, `M140 S${bedTemp}`);
            startGcode = startGcode.replace(/M190 S\d+/g, `M190 S${bedTemp}`);
            
            // Get kinematic settings
            const enableKinematics = document.getElementById('enableKinematics').checked;
            const laParam = parseFloat(document.getElementById('laParam').value);
            const lbParam = parseFloat(document.getElementById('lbParam').value);
            
            // Get A-axis optimization setting
            const enableAAxisOptimization = document.getElementById('enableAAxisOptimization').checked;
            

            let gcode = generateShapeGcode(shape, diameter, vertical, horizontal, layerHeight, speed, tilt, nozzleDiameter, startGcode, endGcode, enableKinematics, laParam, lbParam, enableAAxisOptimization);
            
            // Apply inverse kinematics if enabled
            if (enableKinematics) {
                gcode = processInverseKinematics(gcode, enableKinematics, laParam, lbParam);
            }
            
            // Apply A-axis optimization if enabled
            if (enableAAxisOptimization) {
                gcode = optimizeAAxisRotation(gcode, enableAAxisOptimization);
                gcode = addAAxisOptimizationComment(gcode);
            }
            
            // Create and download file
            const blob = new Blob([gcode], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `rep5x_${shape}_vase_${diameter}x${vertical}x${horizontal}mm.gcode`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
        } catch (error) {
            alert('Error generating G-code: ' + error.message);
            console.error(error);
        } finally {
            // Restore button
            button.innerHTML = originalText;
            button.disabled = false;
        }
    }, 100);
}

function generateShapeGcode(shape, diameter, verticalHeight, horizontalLength, layerHeight, speed, tilt, nozzleDiameter, startGcode = '', endGcode = '', enableKinematics = false, laParam = 0, lbParam = 46, enableAAxisOptimization = false) {
    const gcode = [];
    const radius = diameter / 2;
    const totalHeight = verticalHeight + horizontalLength; // Approximate total height
    const layers = Math.floor(totalHeight / layerHeight);
    let e = 0; // Extruder position
    
    // Header
    gcode.push('; Generated by Rep5x Vase Generator');
    gcode.push(`; Shape: ${shape}`);
    gcode.push(`; Diameter: ${diameter}mm`);
    gcode.push(`; Vertical Section: ${verticalHeight}mm`);
    gcode.push(`; Horizontal Section: ${horizontalLength}mm`);
    gcode.push(`; Bend Angle: ${tilt}°`);
    gcode.push(`; Nozzle Diameter: ${nozzleDiameter}mm`);
    gcode.push(`; Layer Height: ${layerHeight}mm`);
    gcode.push(`; Print Speed: ${speed/60}mm/s`);
    gcode.push(`; Generated on: ${new Date().toISOString()}`);
    gcode.push('');
    
    // 5-axis and IK parameters for previewer
    gcode.push('; === Rep5x Parameters ===');
    gcode.push(`; Inverse Kinematics: ${enableKinematics ? 'enabled' : 'disabled'}`);
    if (enableKinematics) {
        gcode.push(`; LA Parameter: ${laParam}`);
        gcode.push(`; LB Parameter: ${lbParam}`);
        gcode.push('; IK Formulas:');
        gcode.push("; X = X' + sin(A') × LA + cos(A') × sin(B') × LB");
        gcode.push("; Y = Y' - LA + cos(A') × LA - sin(A') × sin(B') × LB");
        gcode.push("; Z = Z' + cos(B') × LB - LB");
    }
    gcode.push(`; A-axis Optimization: ${enableAAxisOptimization ? 'enabled' : 'disabled'}`);
    gcode.push('');
    
    // Start sequence
    gcode.push('; Start sequence');
    if (startGcode.trim()) {
        gcode.push(...startGcode.split('\n'));
    } else {
        // Default start G-code
        gcode.push('G28 ; Home all axes');
        gcode.push('G1 Z5 F300 ; Lift Z');
        gcode.push('M104 S210 ; Set hotend temp');
        gcode.push('M140 S60 ; Set bed temp');
        gcode.push('M190 S60 ; Wait for bed');
        gcode.push('M109 S210 ; Wait for hotend');
        gcode.push('G92 E0 ; Reset extruder');
        gcode.push('G1 E10 F200 ; Prime extruder');
        gcode.push('G92 E0 ; Reset extruder');
        gcode.push('G21 ; Set units to millimeters');
        gcode.push('G90 ; Use absolute coordinates');
        gcode.push('M83 ; Use relative extrusion');
    }
    gcode.push('');
    
    let lastX = 0, lastY = 0, lastZ = 0;
    
    // Generate elbow pipe G-code
    const shapeGcode = generateElbowPipeGcode(diameter, verticalHeight, horizontalLength, layerHeight, speed, tilt);
    gcode.push(...shapeGcode);
    
    // End sequence
    gcode.push('');
    gcode.push('; End sequence');
    if (endGcode.trim()) {
        // Replace placeholder in end G-code
        const processedEndGcode = endGcode.replace(/{print_height}/g, totalHeight);
        gcode.push(...processedEndGcode.split('\n'));
    } else {
        // Default end G-code
        gcode.push('G1 E-2 F1800 ; Retract filament');
        gcode.push(`G1 Z${totalHeight + 10} F300 ; Lift Z`);
        gcode.push('G28 X Y ; Home X Y');
        gcode.push('M104 S0 ; Turn off hotend');
        gcode.push('M140 S0 ; Turn off bed');
        gcode.push('M84 ; Disable motors');
        gcode.push('M117 Print Complete! ; Display message');
    }
    
    return gcode.join('\n');
}

// Event Listeners
document.querySelectorAll('input[type="range"]').forEach(input => {
    input.addEventListener('input', (e) => {
        const valueSpan = document.getElementById(e.target.id + 'Value');
        if (valueSpan) {
            // Special handling for nozzle diameter (uses mapped values)
            if (e.target.id === 'nozzleDiameter') {
                // Skip - handled by dedicated listener
            } else {
                valueSpan.textContent = e.target.value;
            }
        }
        updatePreview();
    });
});

document.getElementById('shape').addEventListener('change', updatePreview);
document.getElementById('generate').addEventListener('click', generateGcode);


// Handle bed size changes
document.getElementById('bedWidth').addEventListener('input', updateBuildPlatform);
document.getElementById('bedDepth').addEventListener('input', updateBuildPlatform);

// Update shape when parameters change
document.getElementById('vertical').addEventListener('input', updatePreview);
document.getElementById('horizontal').addEventListener('input', updatePreview);

// Update displayed values for new sliders
document.getElementById('vertical').addEventListener('input', (e) => {
    document.getElementById('verticalValue').textContent = e.target.value;
});

document.getElementById('horizontal').addEventListener('input', (e) => {
    document.getElementById('horizontalValue').textContent = e.target.value;
});

// No special handling needed for number inputs - values are read directly

// Handle kinematic enable/disable
document.getElementById('enableKinematics').addEventListener('change', (e) => {
    const paramsDiv = document.getElementById('kinematicParams');
    if (e.target.checked) {
        paramsDiv.style.opacity = '1';
        paramsDiv.style.pointerEvents = 'auto';
    } else {
        paramsDiv.style.opacity = '0.5';
        paramsDiv.style.pointerEvents = 'none';
    }
});

// Tab switching functionality
function switchTab(tabName) {
    // Hide all tab contents
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.add('hidden');
    });

    // Remove active state from all tabs
    document.querySelectorAll('.tab-button').forEach(button => {
        button.classList.remove('border-primary', 'text-primary');
        button.classList.add('border-transparent', 'text-gray-500');
    });

    // Show selected tab content
    document.getElementById('content' + tabName).classList.remove('hidden');

    // Activate selected tab button
    const activeButton = document.getElementById('tab' + tabName);
    activeButton.classList.add('border-primary', 'text-primary');
    activeButton.classList.remove('border-transparent', 'text-gray-500');
}

// Tab button event listeners
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('tabShape').addEventListener('click', () => switchTab('Shape'));
    document.getElementById('tabPrintSettings').addEventListener('click', () => switchTab('PrintSettings'));
    document.getElementById('tabAdvanced').addEventListener('click', () => switchTab('Advanced'));
});

// Material preset configurations
const materialPresets = {
    pla: {
        nozzleTemp: 210,
        bedTemp: 60,
        speed: 50
    },
    petg: {
        nozzleTemp: 240,
        bedTemp: 80,
        speed: 40
    },
    abs: {
        nozzleTemp: 245,
        bedTemp: 100,
        speed: 45
    }
};

// Map slider value to actual nozzle diameter
const nozzleSizes = [0.2, 0.3, 0.4, 0.6, 0.8, 1.0];

function getNozzleDiameter() {
    const slider = document.getElementById('nozzleDiameter');
    if (!slider) return 0.4; // Default fallback
    const sliderValue = parseInt(slider.value);
    return nozzleSizes[sliderValue] || 0.4;
}

// Update nozzle diameter display
function updateNozzleDiameterDisplay() {
    const diameter = getNozzleDiameter();
    const displayElement = document.getElementById('nozzleDiameterValue');
    if (displayElement) {
        displayElement.textContent = diameter;
    }
}

// Validate layer height against nozzle diameter
function validateLayerHeight() {
    const nozzleDiameter = getNozzleDiameter();
    const layerHeight = parseFloat(document.getElementById('layerHeight').value);
    const warning = document.getElementById('layerHeightWarning');

    const minLayerHeight = nozzleDiameter * 0.2;
    const maxLayerHeight = nozzleDiameter * 0.8;

    if (layerHeight < minLayerHeight || layerHeight > maxLayerHeight) {
        warning.textContent = `⚠ Recommended layer height for ${nozzleDiameter}mm nozzle: ${minLayerHeight.toFixed(2)}-${maxLayerHeight.toFixed(2)}mm`;
        warning.classList.remove('hidden');
    } else {
        warning.classList.add('hidden');
    }
}

// Material preset selector
document.addEventListener('DOMContentLoaded', () => {
    const materialSelect = document.getElementById('materialPreset');
    const nozzleTempSlider = document.getElementById('nozzleTemp');
    const bedTempSlider = document.getElementById('bedTemp');
    const speedSlider = document.getElementById('speed');
    const nozzleTempValue = document.getElementById('nozzleTempValue');
    const bedTempValue = document.getElementById('bedTempValue');
    const speedValue = document.getElementById('speedValue');

    materialSelect.addEventListener('change', (e) => {
        const preset = materialPresets[e.target.value];
        if (preset) {
            // Update sliders
            nozzleTempSlider.value = preset.nozzleTemp;
            bedTempSlider.value = preset.bedTemp;
            speedSlider.value = preset.speed;

            // Update display values
            nozzleTempValue.textContent = preset.nozzleTemp;
            bedTempValue.textContent = preset.bedTemp;
            speedValue.textContent = preset.speed;
        }
    });

    // Update material preset to 'custom' when sliders change
    function setCustomPreset() {
        materialSelect.value = 'custom';
    }

    nozzleTempSlider.addEventListener('input', setCustomPreset);
    bedTempSlider.addEventListener('input', setCustomPreset);
    speedSlider.addEventListener('input', setCustomPreset);

    // Validate layer height when either slider changes
    document.getElementById('nozzleDiameter').addEventListener('input', () => {
        updateNozzleDiameterDisplay();
        validateLayerHeight();
    });
    document.getElementById('layerHeight').addEventListener('input', validateLayerHeight);

    // Initial setup
    updateNozzleDiameterDisplay();
    validateLayerHeight();
});

// Handle window resize
window.addEventListener('resize', () => {
    if (!camera || !renderer) return;

    const canvas = document.getElementById('canvas3d');
    camera.aspect = canvas.offsetWidth / canvas.offsetHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(canvas.offsetWidth, canvas.offsetHeight);
});

// Initialize when page loads
document.addEventListener('DOMContentLoaded', async () => {
    // Wait for theme to load before initializing Three.js
    while (!getTheme()) {
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    // Small delay to ensure canvas is ready
    setTimeout(initThreeJS, 100);
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (animationId) {
        cancelAnimationFrame(animationId);
    }
    if (renderer) {
        renderer.dispose();
    }
});