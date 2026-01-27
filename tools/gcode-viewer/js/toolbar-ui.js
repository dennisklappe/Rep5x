// Toolbar UI interactions for Rep5x G-code viewer
// Handles settings panel, progress bar, drag-drop, and other UI interactions

function initSettingsPanel() {
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsPanel = document.getElementById('settingsPanel');
    const closeSettings = document.getElementById('closeSettings');

    settingsBtn?.addEventListener('click', () => {
        settingsPanel?.classList.toggle('open');
        settingsBtn?.classList.toggle('active');
    });

    closeSettings?.addEventListener('click', () => {
        settingsPanel?.classList.remove('open');
        settingsBtn?.classList.remove('active');
    });
}

function initProgressBarDrag() {
    const progressBar = document.getElementById('progressBar');
    const progressInput = document.getElementById('progress');
    const progressFill = document.getElementById('progressFill');
    const progressThumb = document.getElementById('progressThumb');
    let isDraggingProgress = false;

    const updateProgressUI = (percent) => {
        const clampedPercent = Math.max(0, Math.min(100, percent));
        if (progressFill) progressFill.style.width = clampedPercent + '%';
        if (progressThumb) progressThumb.style.left = clampedPercent + '%';
    };

    const handleProgressDrag = (e) => {
        if (!progressBar) return;
        const rect = progressBar.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const percent = ((clientX - rect.left) / rect.width) * 100;
        const clampedPercent = Math.max(0, Math.min(100, percent));
        progressInput.value = clampedPercent;
        updateProgressUI(clampedPercent);
        progressInput.dispatchEvent(new Event('input'));
    };

    // Click on bar
    progressBar?.addEventListener('click', (e) => {
        if (e.target === progressThumb) return;
        handleProgressDrag(e);
    });

    // Drag thumb - mouse
    progressThumb?.addEventListener('mousedown', (e) => {
        e.preventDefault();
        isDraggingProgress = true;
        progressThumb.classList.add('dragging');
    });

    // Drag thumb - touch
    progressThumb?.addEventListener('touchstart', (e) => {
        isDraggingProgress = true;
        progressThumb.classList.add('dragging');
    }, { passive: true });

    document.addEventListener('mousemove', (e) => {
        if (isDraggingProgress) handleProgressDrag(e);
    });

    document.addEventListener('touchmove', (e) => {
        if (isDraggingProgress) handleProgressDrag(e);
    }, { passive: true });

    document.addEventListener('mouseup', () => {
        if (isDraggingProgress) {
            isDraggingProgress = false;
            progressThumb?.classList.remove('dragging');
        }
    });

    document.addEventListener('touchend', () => {
        if (isDraggingProgress) {
            isDraggingProgress = false;
            progressThumb?.classList.remove('dragging');
        }
    });

    // Sync progress fill and thumb with slider
    progressInput?.addEventListener('input', () => {
        updateProgressUI(progressInput.value);
    });
}

function initFileZoneUpdates() {
    const fileZone = document.getElementById('dropZone');
    const fileZoneText = document.getElementById('fileZoneText');
    const gcodeFile = document.getElementById('gcodeFile');

    gcodeFile?.addEventListener('change', (e) => {
        if (e.target.files?.length > 0) {
            const fileName = e.target.files[0].name;
            fileZoneText.textContent = fileName.length > 20
                ? fileName.substring(0, 17) + '...'
                : fileName;
            fileZone.classList.add('has-file');
        }
    });
}

function initCollisionBadgeObserver() {
    const collisionBadge = document.getElementById('collisionInfo');
    const collisionCount = document.getElementById('collisionCount');

    if (collisionCount) {
        const observer = new MutationObserver(() => {
            const count = parseInt(collisionCount.textContent) || 0;
            collisionBadge?.classList.toggle('visible', count > 0);
        });
        observer.observe(collisionCount, {
            childList: true,
            characterData: true,
            subtree: true
        });
    }
}

function initCanvasDragDrop() {
    const canvasContainer = document.querySelector('.canvas-container');
    const fileZone = document.getElementById('dropZone');
    const fileZoneText = document.getElementById('fileZoneText');
    const gcodeFile = document.getElementById('gcodeFile');

    if (!canvasContainer) return;

    // Create drop overlay element
    const dropOverlay = document.createElement('div');
    dropOverlay.className = 'canvas-drop-overlay';
    dropOverlay.innerHTML = `
        <div class="canvas-drop-content">
            <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
            <p>Drop G-code file here</p>
        </div>
    `;
    canvasContainer.appendChild(dropOverlay);

    let dragCounter = 0;

    canvasContainer.addEventListener('dragenter', (e) => {
        e.preventDefault();
        dragCounter++;
        dropOverlay.classList.add('active');
    });

    canvasContainer.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dragCounter--;
        if (dragCounter === 0) {
            dropOverlay.classList.remove('active');
        }
    });

    canvasContainer.addEventListener('dragover', (e) => {
        e.preventDefault();
    });

    canvasContainer.addEventListener('drop', (e) => {
        e.preventDefault();
        dragCounter = 0;
        dropOverlay.classList.remove('active');

        const files = e.dataTransfer?.files;
        if (files?.length > 0) {
            const file = files[0];
            // Check if it's a valid G-code file
            if (file.name.match(/\.(gcode|nc|txt|g)$/i)) {
                // Update the file input and trigger the change event
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(file);
                gcodeFile.files = dataTransfer.files;
                gcodeFile.dispatchEvent(new Event('change', { bubbles: true }));

                // Update file zone UI
                fileZoneText.textContent = file.name.length > 20
                    ? file.name.substring(0, 17) + '...'
                    : file.name;
                fileZone.classList.add('has-file');
            }
        }
    });
}

function initBedSizeSettings() {
    const applyBedSizeBtn = document.getElementById('applyBedSize');
    const bedSizeXInput = document.getElementById('bedSizeX');
    const bedSizeYInput = document.getElementById('bedSizeY');

    applyBedSizeBtn?.addEventListener('click', () => {
        const sizeX = parseInt(bedSizeXInput?.value) || 220;
        const sizeY = parseInt(bedSizeYInput?.value) || 220;

        // Access the app's animation engine and update bed size
        if (window.gcodeApp && window.gcodeApp.engine) {
            window.gcodeApp.engine.setBedSize(sizeX, sizeY);
        }
    });
}

function initToolbarUI() {
    initSettingsPanel();
    initProgressBarDrag();
    initFileZoneUpdates();
    initCollisionBadgeObserver();
    initCanvasDragDrop();
    initBedSizeSettings();
}

document.addEventListener('DOMContentLoaded', initToolbarUI);
