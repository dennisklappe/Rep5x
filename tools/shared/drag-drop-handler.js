/**
 * Shared drag-drop handler utilities for Rep5x tools
 * Consolidates duplicated drag-drop patterns across multiple tools
 */

/**
 * Set up a drop zone for file uploads
 * @param {HTMLElement} dropZone - The drop zone element
 * @param {HTMLInputElement} fileInput - The file input element
 * @param {Function} handler - The handler function to call with the file event
 * @param {object} options - Optional configuration
 * @param {string} options.activeClass - CSS class to add when dragging over (default: 'border-primary')
 * @param {string} options.activeBgClass - Background CSS class when dragging over (default: 'bg-blue-50')
 */
function setupDropZone(dropZone, fileInput, handler, options = {}) {
    const activeClass = options.activeClass || 'border-primary';
    const activeBgClass = options.activeBgClass || 'bg-blue-50';

    dropZone.addEventListener('dragover', function(e) {
        e.preventDefault();
        dropZone.classList.add(activeClass, activeBgClass);
    });

    dropZone.addEventListener('dragleave', function(e) {
        e.preventDefault();
        dropZone.classList.remove(activeClass, activeBgClass);
    });

    dropZone.addEventListener('drop', function(e) {
        e.preventDefault();
        dropZone.classList.remove(activeClass, activeBgClass);
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            fileInput.files = files;
            handler({ target: fileInput });
        }
    });
}

/**
 * Create a complete drop zone with visual feedback
 * @param {HTMLElement} dropZone - The drop zone element
 * @param {HTMLInputElement} fileInput - The file input element
 * @param {Function} handler - The handler function to call with the file event
 * @param {object} options - Optional configuration
 * @param {HTMLElement} options.contentElement - Element to hide when file is selected
 * @param {HTMLElement} options.selectedElement - Element to show when file is selected
 * @param {HTMLElement} options.fileNameElement - Element to display the filename
 * @param {HTMLElement} options.fileSizeElement - Element to display file size (optional)
 */
function setupDropZoneWithFeedback(dropZone, fileInput, handler, options = {}) {
    // Set up basic drop zone behaviour
    setupDropZone(dropZone, fileInput, handler, options);

    // Add file input change listener with visual feedback
    fileInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file && options.contentElement && options.selectedElement && options.fileNameElement) {
            options.contentElement.classList.add('hidden');
            options.selectedElement.classList.remove('hidden');
            options.fileNameElement.textContent = file.name;

            if (options.fileSizeElement) {
                options.fileSizeElement.textContent = formatFileSize(file.size);
            }
        }
        handler(e);
    });
}

/**
 * Format file size for display
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted file size string
 */
function formatFileSize(bytes) {
    if (bytes < 1024) {
        return bytes + ' B';
    }
    if (bytes < 1024 * 1024) {
        return (bytes / 1024).toFixed(1) + ' KB';
    }
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
