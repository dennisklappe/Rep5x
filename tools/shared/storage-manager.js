/**
 * Storage Manager for Rep5x Tools
 * Handles persistence of calibration data, LC/LB values, and settings using localStorage
 *
 * Used by: All tools (Calibrator, LC/LB Measure, Printer Setup, Printer Control, Vase Generator, G-code Corrector, G-code Viewer)
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
     * Save calibration results
     * @param {number} lc - LC parameter value
     * @param {number} lb - LB parameter value
     * @param {object} metadata - Additional calibration metadata
     */
    static saveCalibrationResults(lc, lb, metadata = {}) {
        const data = {
            lc: lc,
            lb: lb,
            timestamp: new Date().toISOString(),
            ...metadata
        };
        StorageManager.save('results', data);

        // Also save individual values for easy access
        StorageManager.save('lc', lc);
        StorageManager.save('lb', lb);
    }

    /**
     * Load saved calibration results
     * @returns {object|null} Calibration results or null
     */
    static loadCalibrationResults() {
        return StorageManager.load('results', null);
    }

    /**
     * Export all calibration data as JSON string
     * @returns {string} JSON string of calibration data
     */
    static exportJSON() {
        const results = StorageManager.loadCalibrationResults();
        if (!results) {
            return JSON.stringify({ error: 'No calibration data found' }, null, 2);
        }
        return JSON.stringify({
            rep5x_kinematic_calibration: results,
            exported_at: new Date().toISOString()
        }, null, 2);
    }

    /**
     * Download calibration data as JSON file
     */
    static downloadJSON() {
        const json = StorageManager.exportJSON();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rep5x-calibration-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Load LC value directly
     * @returns {number|null} LC value or null
     */
    static loadLc() {
        return StorageManager.load('lc', null);
    }

    /**
     * Load LB value directly
     * @returns {number|null} LB value or null
     */
    static loadLb() {
        return StorageManager.load('lb', null);
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
     * Clear all calibration data
     */
    static clearCalibration() {
        const keys = ['results', 'lc', 'lb', 'calibration_data'];
        keys.forEach(key => {
            const fullKey = StorageManager.PREFIX + key;
            try {
                localStorage.removeItem(fullKey);
            } catch (e) {
                StorageManager.setCookie(fullKey, '', -1);
            }
        });
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
