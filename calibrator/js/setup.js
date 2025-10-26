// Setup page functionality
class SetupPage {
    constructor() {
        try {
            this.kinematicData = { la: null, lb: null };
            this.init();
            this.loadSavedValues();
            
            // Add global error handlers
            window.addEventListener('error', this.handleGlobalError.bind(this));
            window.addEventListener('unhandledrejection', this.handleUnhandledRejection.bind(this));
            
        } catch (error) {
            this.handleError('INITIALIZATION_ERROR', 'Failed to initialize setup page', error);
            console.error('Setup page initialization error:', error);
        }
    }
    
    // Validation constants
    static get MAX_LA_VALUE() { return 500; }  // Maximum La value in mm
    static get MAX_LB_VALUE() { return 500; }  // Maximum Lb value in mm
    static get MIN_LA_VALUE() { return 0; }    // Minimum La value
    static get MIN_LB_VALUE() { return 0; }    // Minimum Lb value (exclusive)
    
    // Display constants
    static get DECIMAL_PLACES() { return 1; }
    
    // Cookie storage constants
    static get COOKIE_MAX_AGE() { return 86400; }  // 24 hours in seconds
    static get STORAGE_EXPIRY_DAYS() { return 365; }
    
    // UI styling constants
    static get ERROR_TEXT_COLOR() { return 'red'; }
    static get ERROR_FONT_SIZE() { return '14px'; }
    static get ERROR_MARGIN_TOP() { return '10px'; }
    
    // Storage key constants
    static get STORAGE_KEYS_TO_KEEP() { return ['rep5x_la', 'rep5x_lb']; }
    
    // Global error handlers
    handleGlobalError(event) {
        console.error('Global error:', event.error);
        this.showError(`Global error: ${event.error?.message || 'Unknown error'}`);
    }
    
    handleUnhandledRejection(event) {
        console.error('Unhandled promise rejection:', event.reason);
        this.showError(`Unhandled promise rejection: ${event.reason?.message || 'Unknown rejection'}`);
        event.preventDefault();
    }
    
    // Central error handler
    handleError(errorType, message, details = null) {
        const timestamp = new Date().toISOString();
        const errorInfo = {
            type: errorType,
            message: message,
            timestamp: timestamp,
            details: details
        };
        
        console.error('Setup page error:', errorInfo);
        this.showError(`ERROR [${errorType}]: ${message}`);
    }
    
    showError(message) {
        try {
            // Try to show error in the UI if possible
            const errorContainer = document.getElementById('errorContainer');
            if (errorContainer) {
                errorContainer.textContent = message;
                errorContainer.style.display = 'block';
            } else {
                // Fallback to alert
                alert(message);
            }
        } catch (e) {
            // Last resort - console only
            console.error('Failed to display error:', e);
            console.error('Original error message:', message);
        }
    }

    init() {
        try {
            // Input validation with error handling
            this.addEventListenerSafe('laInput', 'input', () => this.checkInputs());
            this.addEventListenerSafe('lbInput', 'input', () => this.checkInputs());
            
            // Continue button with error handling
            this.addEventListenerSafe('continueCalibrationBtn', 'click', () => {
                try {
                    this.saveValues();
                    this.redirectToCalibration();
                } catch (error) {
                    this.handleError('CONTINUE_ERROR', 'Failed to continue to calibration', error);
                }
            });

            // Manual measurement instructions with error handling
            this.addEventListenerSafe('manualMeasureBtn', 'click', () => {
                try {
                    this.showManualInstructions();
                } catch (error) {
                    this.handleError('MANUAL_INSTRUCTIONS_ERROR', 'Failed to show manual instructions', error);
                }
            });
            
        } catch (error) {
            this.handleError('INIT_ERROR', 'Failed to initialize UI', error);
        }
    }
    
    addEventListenerSafe(elementId, event, handler) {
        try {
            const element = document.getElementById(elementId);
            if (element) {
                element.addEventListener(event, handler);
            } else {
                console.warn(`Element '${elementId}' not found for event '${event}'`);
            }
        } catch (error) {
            console.error(`Error adding event listener to '${elementId}':`, error);
        }
    }

    getCookie(name) {
        try {
            if (!name || typeof name !== 'string') {
                throw new Error('Invalid cookie name');
            }
            
            // Try localStorage first (better for file:// protocol)
            try {
                const localValue = localStorage.getItem(name);
                if (localValue !== null) {
                    return localValue;
                }
            } catch (storageError) {
                console.warn(`localStorage access failed: ${storageError.message}`);
            }
            
            // Fallback to cookies
            try {
                const value = `; ${document.cookie}`;
                const parts = value.split(`; ${name}=`);
                if (parts.length === 2) {
                    const cookieValue = parts.pop().split(';').shift();
                    return cookieValue;
                }
            } catch (cookieError) {
                console.warn(`Cookie access failed: ${cookieError.message}`);
            }
            
            return null;
        } catch (error) {
            this.handleError('STORAGE_READ_ERROR', `Failed to get cookie '${name}': ${error.message}`, error);
            return null;
        }
    }

    setCookie(name, value) {
        try {
            if (!name || typeof name !== 'string') {
                throw new Error('Invalid cookie name');
            }
            
            if (value === null || value === undefined) {
                throw new Error('Invalid cookie value');
            }
            
            const valueStr = String(value);
            
            // Use localStorage instead of cookies for local file access
            try {
                localStorage.setItem(name, valueStr);
            } catch (storageError) {
                if (storageError.name === 'QuotaExceededError') {
                    this.handleError('STORAGE_QUOTA_EXCEEDED', 'localStorage quota exceeded', storageError);
                    // Try to clear some space
                    try {
                        this.clearOldStorageData();
                        localStorage.setItem(name, valueStr); // Retry
                    } catch (retryError) {
                        console.error('Failed to save after clearing storage:', retryError);
                    }
                } else {
                    console.warn(`localStorage write failed: ${storageError.message}`);
                }
            }
            
            // Also try cookie as fallback
            try {
                const cookieString = `${name}=${valueStr}; path=/; max-age=${SetupPage.COOKIE_MAX_AGE}`; // 24 hours
                document.cookie = cookieString;
            } catch (cookieError) {
                console.warn(`Cookie write failed: ${cookieError.message}`);
            }
            
        } catch (error) {
            this.handleError('STORAGE_WRITE_ERROR', `Failed to set cookie '${name}': ${error.message}`, error);
        }
    }
    
    clearOldStorageData() {
        try {
            const keysToKeep = SetupPage.STORAGE_KEYS_TO_KEEP;
            const allKeys = Object.keys(localStorage);
            
            allKeys.forEach(key => {
                if (!keysToKeep.includes(key)) {
                    localStorage.removeItem(key);
                }
            });
            
            console.log('Cleared old storage data');
        } catch (error) {
            console.error('Failed to clear storage data:', error);
        }
    }

    loadSavedValues() {
        try {
            const la = this.getCookie('rep5x_la');
            const lb = this.getCookie('rep5x_lb');
            
            if (la !== null && lb !== null) {
                const laValue = parseFloat(la);
                const lbValue = parseFloat(lb);
                
                // Validate loaded values
                if (isNaN(laValue) || isNaN(lbValue)) {
                    this.handleError('INVALID_SAVED_VALUES', `Invalid saved values: la=${la}, lb=${lb}`);
                    return;
                }
                
                // Update inputs safely
                this.setInputValueSafe('laInput', la);
                this.setInputValueSafe('lbInput', lb);
                
                this.kinematicData.la = laValue;
                this.kinematicData.lb = lbValue;
                
                this.checkInputs();
                this.updateDisplay();
            }
        } catch (error) {
            this.handleError('LOAD_VALUES_ERROR', 'Failed to load saved values', error);
        }
    }
    
    setInputValueSafe(elementId, value) {
        try {
            const element = document.getElementById(elementId);
            if (element) {
                element.value = value;
            } else {
                console.warn(`Input element '${elementId}' not found`);
            }
        } catch (error) {
            console.error(`Error setting value for '${elementId}':`, error);
        }
    }

    checkInputs() {
        try {
            const laInput = document.getElementById('laInput');
            const lbInput = document.getElementById('lbInput');
            const continueBtn = document.getElementById('continueCalibrationBtn');
            
            if (!laInput || !lbInput || !continueBtn) {
                console.warn('Required input elements not found');
                return;
            }
            
            const laValue = laInput.value.trim();
            const lbValue = lbInput.value.trim();
            
            const la = parseFloat(laValue);
            const lb = parseFloat(lbValue);
            
            // Validate inputs
            let isValid = true;
            let errorMessage = '';
            
            if (laValue === '' || isNaN(la)) {
                isValid = false;
                errorMessage = 'La value must be a valid number';
            } else if (la < SetupPage.MIN_LA_VALUE) {
                isValid = false;
                errorMessage = `La value must be >= ${SetupPage.MIN_LA_VALUE}`;
            } else if (la > SetupPage.MAX_LA_VALUE) {
                isValid = false;
                errorMessage = `La value seems too large (>${SetupPage.MAX_LA_VALUE}mm)`;
            }
            
            if (isValid && (lbValue === '' || isNaN(lb))) {
                isValid = false;
                errorMessage = 'Lb value must be a valid number';
            } else if (isValid && lb <= SetupPage.MIN_LB_VALUE) {
                isValid = false;
                errorMessage = `Lb value must be > ${SetupPage.MIN_LB_VALUE}`;
            } else if (isValid && lb > SetupPage.MAX_LB_VALUE) {
                isValid = false;
                errorMessage = `Lb value seems too large (>${SetupPage.MAX_LB_VALUE}mm)`;
            }
            
            // Update button state and data
            continueBtn.disabled = !isValid;
            
            if (isValid) {
                this.kinematicData.la = la;
                this.kinematicData.lb = lb;
                this.clearValidationError();
            } else {
                this.showValidationError(errorMessage);
            }
            
            this.updateDisplay();
            
        } catch (error) {
            this.handleError('INPUT_VALIDATION_ERROR', 'Failed to validate inputs', error);
        }
    }
    
    showValidationError(message) {
        try {
            let errorElement = document.getElementById('validationError');
            if (!errorElement) {
                // Create error element if it doesn't exist
                errorElement = document.createElement('div');
                errorElement.id = 'validationError';
                errorElement.style.color = SetupPage.ERROR_TEXT_COLOR;
                errorElement.style.fontSize = SetupPage.ERROR_FONT_SIZE;
                errorElement.style.marginTop = SetupPage.ERROR_MARGIN_TOP;
                
                const continueBtn = document.getElementById('continueCalibrationBtn');
                if (continueBtn && continueBtn.parentNode) {
                    continueBtn.parentNode.insertBefore(errorElement, continueBtn);
                }
            }
            
            errorElement.textContent = message;
            errorElement.style.display = 'block';
        } catch (error) {
            console.error('Error showing validation error:', error);
        }
    }
    
    clearValidationError() {
        try {
            const errorElement = document.getElementById('validationError');
            if (errorElement) {
                errorElement.style.display = 'none';
            }
        } catch (error) {
            console.error('Error clearing validation error:', error);
        }
    }

    updateDisplay() {
        try {
            const display = document.getElementById('kinematicValues');
            if (!display) {
                console.warn('Kinematic values display element not found');
                return;
            }
            
            if (this.kinematicData.la !== null && this.kinematicData.lb !== null) {
                // Validate values before displaying
                if (typeof this.kinematicData.la === 'number' && 
                    typeof this.kinematicData.lb === 'number' && 
                    !isNaN(this.kinematicData.la) && 
                    !isNaN(this.kinematicData.lb)) {
                    display.textContent = `la: ${this.kinematicData.la.toFixed(SetupPage.DECIMAL_PLACES)}mm lb: ${this.kinematicData.lb.toFixed(SetupPage.DECIMAL_PLACES)}mm`;
                } else {
                    display.textContent = 'la: invalid lb: invalid';
                }
            } else {
                display.textContent = 'la: -- lb: --';
            }
        } catch (error) {
            console.error('Error updating display:', error);
        }
    }

    saveValues() {
        try {
            if (this.kinematicData.la === null || this.kinematicData.lb === null) {
                throw new Error('Cannot save null kinematic data');
            }
            
            if (typeof this.kinematicData.la !== 'number' || typeof this.kinematicData.lb !== 'number') {
                throw new Error('Kinematic data must be numbers');
            }
            
            if (isNaN(this.kinematicData.la) || isNaN(this.kinematicData.lb)) {
                throw new Error('Kinematic data contains NaN values');
            }
            
            this.setCookie('rep5x_la', this.kinematicData.la);
            this.setCookie('rep5x_lb', this.kinematicData.lb);
            
            // Verify cookies were saved
            const savedLa = this.getCookie('rep5x_la');
            const savedLb = this.getCookie('rep5x_lb');
            
            if (savedLa === null || savedLb === null) {
                throw new Error('Failed to save kinematic parameters');
            }
            
            console.log('Kinematic parameters saved successfully:', { la: savedLa, lb: savedLb });
            
        } catch (error) {
            this.handleError('SAVE_VALUES_ERROR', 'Failed to save kinematic values', error);
            throw error; // Re-throw to prevent navigation
        }
    }

    redirectToCalibration() {
        try {
            // Create custom dialog for calibration method selection
            const dialog = document.createElement('div');
            dialog.className = 'calibration-choice-dialog';
            dialog.innerHTML = `
                <div class="dialog-content">
                    <h3>Choose Calibration Method</h3>
                    <p>Select your preferred calibration approach:</p>
                    <div class="choice-buttons">
                        <button class="choice-btn camera-btn">
                            <div class="choice-icon">📷</div>
                            <div class="choice-text">
                                <h4>Camera Calibration</h4>
                                <p>Automated with USB camera</p>
                            </div>
                        </button>
                        <button class="choice-btn cone-btn">
                            <div class="choice-icon">📍</div>
                            <div class="choice-text">
                                <h4>Cone Calibration</h4>
                                <p>Manual with physical reference</p>
                            </div>
                        </button>
                    </div>
                </div>
            `;
            
            if (!document.body) {
                throw new Error('Document body not available');
            }
            
            document.body.appendChild(dialog);
            
            // Add event listeners with error handling
            try {
                const cameraBtn = dialog.querySelector('.camera-btn');
                const coneBtn = dialog.querySelector('.cone-btn');
                
                if (!cameraBtn || !coneBtn) {
                    throw new Error('Dialog buttons not found');
                }
                
                cameraBtn.addEventListener('click', () => {
                    try {
                        document.body.removeChild(dialog);
                        window.location.href = 'camera.html';
                    } catch (error) {
                        this.handleError('NAVIGATION_ERROR', 'Failed to navigate to camera calibration', error);
                    }
                });
                
                coneBtn.addEventListener('click', () => {
                    try {
                        document.body.removeChild(dialog);
                        window.location.href = 'cone.html';
                    } catch (error) {
                        this.handleError('NAVIGATION_ERROR', 'Failed to navigate to cone calibration', error);
                    }
                });
                
                // Add escape key handler
                const handleEscape = (event) => {
                    if (event.key === 'Escape') {
                        try {
                            if (document.body.contains(dialog)) {
                                document.body.removeChild(dialog);
                            }
                            document.removeEventListener('keydown', handleEscape);
                        } catch (error) {
                            console.error('Error closing dialog with escape:', error);
                        }
                    }
                };
                
                document.addEventListener('keydown', handleEscape);
                
            } catch (error) {
                // Clean up dialog if button setup fails
                try {
                    if (document.body.contains(dialog)) {
                        document.body.removeChild(dialog);
                    }
                } catch (cleanupError) {
                    console.error('Error cleaning up dialog:', cleanupError);
                }
                throw error;
            }
            
        } catch (error) {
            this.handleError('DIALOG_ERROR', 'Failed to show calibration method dialog', error);
            
            // Fallback: direct navigation to camera mode
            try {
                if (confirm('Failed to show selection dialog. Go to camera calibration?')) {
                    window.location.href = 'camera.html';
                }
            } catch (fallbackError) {
                console.error('Fallback navigation failed:', fallbackError);
            }
        }
    }

    showManualInstructions() {
        try {
            const dialog = document.createElement('div');
            dialog.className = 'instruction-dialog';
            dialog.innerHTML = `
                <div class="instruction-content">
                    <h3>Manual Measurement Instructions</h3>
                    <div class="instruction-steps">
                        <div class="step">
                            <h4>1. Measure la (A-axis link length)</h4>
                            <ul>
                                <li>Set B=0° (nozzle pointing straight down)</li>
                                <li>Measure from A-axis rotation center to nozzle tip</li>
                                <li>If nozzle is perfectly centered on A-axis, la = 0</li>
                            </ul>
                        </div>
                        <div class="step">
                            <h4>2. Measure lb (B-axis link length)</h4>
                            <ul>
                                <li>Measure from B-axis rotation center to nozzle tip</li>
                                <li>This is typically 40-60mm depending on design</li>
                            </ul>
                        </div>
                        <div class="step">
                            <h4>3. Enter Values</h4>
                            <p>Enter the measured values above and click "Continue to Calibration"</p>
                        </div>
                    </div>
                    <button class="close-dialog primary-btn">Got it</button>
                </div>
            `;
            
            if (!document.body) {
                throw new Error('Document body not available');
            }
            
            document.body.appendChild(dialog);
            
            try {
                const closeBtn = dialog.querySelector('.close-dialog');
                if (!closeBtn) {
                    throw new Error('Close button not found');
                }
                
                closeBtn.addEventListener('click', () => {
                    try {
                        document.body.removeChild(dialog);
                    } catch (error) {
                        console.error('Error closing instruction dialog:', error);
                    }
                });
                
                // Add escape key handler
                const handleEscape = (event) => {
                    if (event.key === 'Escape') {
                        try {
                            if (document.body.contains(dialog)) {
                                document.body.removeChild(dialog);
                            }
                            document.removeEventListener('keydown', handleEscape);
                        } catch (error) {
                            console.error('Error closing dialog with escape:', error);
                        }
                    }
                };
                
                document.addEventListener('keydown', handleEscape);
                
            } catch (error) {
                // Clean up dialog if button setup fails
                try {
                    if (document.body.contains(dialog)) {
                        document.body.removeChild(dialog);
                    }
                } catch (cleanupError) {
                    console.error('Error cleaning up instruction dialog:', cleanupError);
                }
                throw error;
            }
            
        } catch (error) {
            this.handleError('INSTRUCTION_DIALOG_ERROR', 'Failed to show manual instructions', error);
        }
    }
}

// Initialize setup page
new SetupPage();