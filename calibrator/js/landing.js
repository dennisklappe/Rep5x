// Landing page functionality
class LandingPage {
    constructor() {
        this.init();
    }
    
    // UI styling constants
    static get DISABLED_OPACITY() { return '0.5'; }
    static get ENABLED_OPACITY() { return '1'; }
    static get DISABLED_POINTER_EVENTS() { return 'none'; }
    static get ENABLED_POINTER_EVENTS() { return 'auto'; }
    
    // Validation constants
    static get MIN_LA_VALUE() { return 0; }
    static get MIN_LB_VALUE() { return 0; }

    init() {
        this.checkBrowserCompatibility();
        this.checkKinematicParams();
        this.addEventListeners();
    }

    addEventListeners() {
        // Test camera access
        document.getElementById('cameraStatus').addEventListener('click', () => {
            this.testCamera();
        });

        // Test serial access
        document.getElementById('serialStatus').addEventListener('click', () => {
            this.testSerial();
        });
    }

    checkBrowserCompatibility() {
        const browserStatus = document.getElementById('browserStatus');
        const browserText = document.getElementById('browserText');

        // Check for required APIs
        const hasSerial = 'serial' in navigator;
        const hasGetUserMedia = 'mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices;

        if (hasSerial && hasGetUserMedia) {
            browserStatus.textContent = '✅';
            browserText.textContent = 'Compatible';
        } else {
            browserStatus.textContent = '❌';
            browserText.textContent = 'Incompatible - Use Chrome/Edge';
        }
    }

    async testCamera() {
        const cameraStatus = document.getElementById('cameraStatus');
        const cameraText = document.getElementById('cameraText');

        cameraStatus.textContent = '⏳';
        cameraText.textContent = 'Testing...';

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'environment' } 
            });
            
            // Stop the stream immediately
            stream.getTracks().forEach(track => track.stop());
            
            cameraStatus.textContent = '✅';
            cameraText.textContent = 'Available';
        } catch (err) {
            cameraStatus.textContent = '❌';
            cameraText.textContent = 'Access denied';
        }
    }

    async testSerial() {
        const serialStatus = document.getElementById('serialStatus');
        const serialText = document.getElementById('serialText');

        if (!('serial' in navigator)) {
            serialStatus.textContent = '❌';
            serialText.textContent = 'Not supported';
            return;
        }

        serialStatus.textContent = '⏳';
        serialText.textContent = 'Testing...';

        try {
            // Just check if we can request a port (user can cancel)
            await navigator.serial.requestPort();
            serialStatus.textContent = '✅';
            serialText.textContent = 'Available';
        } catch (err) {
            if (err.name === 'NotFoundError') {
                serialStatus.textContent = '⚠️';
                serialText.textContent = 'No device selected';
            } else {
                serialStatus.textContent = '❌';
                serialText.textContent = 'Access denied';
            }
        }
    }

    getCookie(name) {
        // Try localStorage first (better for file:// protocol)
        const localValue = localStorage.getItem(name);
        if (localValue !== null) {
            return localValue;
        }
        
        // Fallback to cookies
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) {
            return parts.pop().split(';').shift();
        }
        
        return null;
    }

    checkKinematicParams() {
        const la = this.getCookie('rep5x_la');
        const lb = this.getCookie('rep5x_lb');
        
        const cameraBtn = document.getElementById('cameraModeBtn');
        const coneBtn = document.getElementById('coneModeBtn');
        
        if (!la || !lb || parseFloat(la) < LandingPage.MIN_LA_VALUE || parseFloat(lb) <= LandingPage.MIN_LB_VALUE) {
            // Disable calibration buttons if kinematic params not set
            cameraBtn.style.opacity = LandingPage.DISABLED_OPACITY;
            cameraBtn.style.pointerEvents = LandingPage.DISABLED_POINTER_EVENTS;
            cameraBtn.textContent = 'Setup Required';
            
            coneBtn.style.opacity = LandingPage.DISABLED_OPACITY;
            coneBtn.style.pointerEvents = LandingPage.DISABLED_POINTER_EVENTS;
            coneBtn.textContent = 'Setup Required';
        } else {
            // Enable calibration buttons
            cameraBtn.style.opacity = LandingPage.ENABLED_OPACITY;
            cameraBtn.style.pointerEvents = LandingPage.ENABLED_POINTER_EVENTS;
            cameraBtn.textContent = 'Camera Mode';
            
            coneBtn.style.opacity = LandingPage.ENABLED_OPACITY;
            coneBtn.style.pointerEvents = LandingPage.ENABLED_POINTER_EVENTS;
            coneBtn.textContent = 'Cone Mode';
        }
    }
}

// Initialize landing page
new LandingPage();