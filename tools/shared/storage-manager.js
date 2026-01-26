/**
 * Storage Manager for Rep5x Tools
 * Handles persistence of calibration data and settings using localStorage
 *
 * Used by: Calibrator, Vase Generator (for calibration correction)
 */

class StorageManager {
    static PREFIX = 'rep5x_calibrator_';

    /**
     * Save a value to storage
     * @param {string} key - Storage key
     * @param {any} value - Value to store (will be JSON stringified if object)
     */
    static save(key, value) {
        const fullKey = StorageManager.PREFIX + key;
        const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);

        try {
            localStorage.setItem(fullKey, stringValue);
        } catch (e) {
            // Fallback to cookies if localStorage unavailable
            console.warn('localStorage unavailable, using cookies:', e);
            StorageManager.setCookie(fullKey, stringValue, 365);
        }
    }

    /**
     * Load a value from storage
     * @param {string} key - Storage key
     * @param {any} defaultValue - Default value if not found
     * @returns {any} Retrieved value or default
     */
    static load(key, defaultValue = null) {
        const fullKey = StorageManager.PREFIX + key;

        try {
            const value = localStorage.getItem(fullKey);
            if (value === null) {
                // Try cookies as fallback
                const cookieValue = StorageManager.getCookie(fullKey);
                if (cookieValue === null) return defaultValue;
                return StorageManager.parseValue(cookieValue);
            }
            return StorageManager.parseValue(value);
        } catch (e) {
            console.warn('Error reading from storage:', e);
            return defaultValue;
        }
    }

    /**
     * Parse a stored value (try JSON first)
     * @param {string} value - Stored string value
     * @returns {any} Parsed value
     */
    static parseValue(value) {
        try {
            return JSON.parse(value);
        } catch {
            return value;
        }
    }

    /**
     * Save full calibration data (error curves, measurements, etc.)
     * @param {object} data - Full calibration data object
     */
    static saveCalibrationData(data) {
        StorageManager.save('calibration_data', {
            ...data,
            savedAt: new Date().toISOString()
        });
    }

    /**
     * Load full calibration data
     * @returns {object|null} Calibration data or null
     */
    static loadCalibrationData() {
        return StorageManager.load('calibration_data', null);
    }

    /**
     * Clear calibration data
     */
    static clearCalibration() {
        const fullKey = StorageManager.PREFIX + 'calibration_data';
        try {
            localStorage.removeItem(fullKey);
        } catch (e) {
            StorageManager.setCookie(fullKey, '', -1);
        }
    }

    /**
     * Save calibration results (LC, LB, and optional fit data)
     * @param {number} lc - LC value
     * @param {number} lb - LB value
     * @param {Object} fitData - Optional fit data
     */
    static saveCalibrationResults(lc, lb, fitData = null) {
        const data = { lc, lb, fitData, timestamp: Date.now() };
        StorageManager.save('calibration_results', data);
    }

    /**
     * Load calibration results
     * @returns {Object|null} - { lc, lb, fitData, timestamp } or null
     */
    static loadCalibrationResults() {
        return StorageManager.load('calibration_results');
    }

    /**
     * Clear calibration results
     */
    static clearCalibrationResults() {
        const fullKey = StorageManager.PREFIX + 'calibration_results';
        try {
            localStorage.removeItem(fullKey);
        } catch (e) {
            StorageManager.setCookie(fullKey, '', -1);
        }
    }

    /**
     * Set a cookie
     * @param {string} name - Cookie name
     * @param {string} value - Cookie value
     * @param {number} days - Days until expiry
     */
    static setCookie(name, value, days) {
        const expires = new Date();
        expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
        document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires.toUTCString()};path=/;SameSite=Strict`;
    }

    /**
     * Get a cookie value
     * @param {string} name - Cookie name
     * @returns {string|null} Cookie value or null
     */
    static getCookie(name) {
        const nameEQ = name + '=';
        const ca = document.cookie.split(';');
        for (let i = 0; i < ca.length; i++) {
            let c = ca[i].trim();
            if (c.indexOf(nameEQ) === 0) {
                return decodeURIComponent(c.substring(nameEQ.length));
            }
        }
        return null;
    }
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StorageManager;
}
