/**
 * Shared toast notification utilities for Rep5x tools
 * Consolidates duplicated notification patterns across multiple tools
 */

/**
 * Show a toast notification
 * @param {string} message - The message to display
 * @param {string} type - The type of notification ('success', 'error', 'warning', 'info', 'save', 'load')
 * @param {object} options - Optional configuration
 * @param {number} options.duration - Duration in milliseconds before auto-dismiss (default: 2500)
 * @param {string} options.className - Additional CSS class for the toast
 */
function showToast(message, type = 'success', options = {}) {
    const duration = options.duration || 2500;

    // Remove existing toast if any
    const existingToast = document.querySelector('.rep5x-toast');
    if (existingToast) {
        existingToast.remove();
    }

    // Create toast element
    const toast = document.createElement('div');
    toast.className = 'rep5x-toast config-toast';
    if (options.className) {
        toast.className += ' ' + options.className;
    }

    // Get icon and background colour based on type
    const { iconSvg, iconStyle } = getToastIconConfig(type);

    toast.innerHTML = `
        <div class="toast-icon" style="${iconStyle}">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">${iconSvg}</svg>
        </div>
        <span>${message}</span>
    `;

    document.body.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(function() {
        toast.classList.add('show');
    });

    // Auto-remove after delay
    setTimeout(function() {
        toast.classList.remove('show');
        setTimeout(function() {
            toast.remove();
        }, 300);
    }, duration);
}

/**
 * Get icon configuration for toast type
 * @param {string} type - The notification type
 * @returns {object} Object with iconSvg and iconStyle
 */
function getToastIconConfig(type) {
    const configs = {
        success: {
            iconSvg: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>',
            iconStyle: ''
        },
        error: {
            iconSvg: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>',
            iconStyle: 'background: #ef4444;'
        },
        warning: {
            iconSvg: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>',
            iconStyle: 'background: #f59e0b;'
        },
        info: {
            iconSvg: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>',
            iconStyle: 'background: #3b82f6;'
        },
        save: {
            iconSvg: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>',
            iconStyle: ''
        },
        load: {
            iconSvg: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>',
            iconStyle: ''
        }
    };

    return configs[type] || configs.success;
}

/**
 * Show a status message in an element
 * @param {string} elementId - The ID of the element to show status in
 * @param {string} message - The message to display
 * @param {string} type - The type of status ('success', 'error', 'warning', 'info')
 */
function showStatus(elementId, message, type = 'info') {
    const el = document.getElementById(elementId);
    if (!el) return;

    el.textContent = message;
    el.className = 'text-sm mt-2 ';

    const typeClasses = {
        success: 'text-green-600',
        error: 'text-red-600',
        warning: 'text-yellow-600',
        info: 'text-gray-600'
    };

    el.className += typeClasses[type] || typeClasses.info;
}

/**
 * Convenience function for showing a success toast
 * @param {string} message - The message to display
 * @param {object} options - Optional configuration
 */
function showSuccessToast(message, options = {}) {
    showToast(message, 'success', options);
}

/**
 * Convenience function for showing an error toast
 * @param {string} message - The message to display
 * @param {object} options - Optional configuration
 */
function showErrorToast(message, options = {}) {
    showToast(message, 'error', options);
}

/**
 * Convenience function for showing a warning toast
 * @param {string} message - The message to display
 * @param {object} options - Optional configuration
 */
function showWarningToast(message, options = {}) {
    showToast(message, 'warning', options);
}
