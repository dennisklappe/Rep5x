/**
 * Camera Manager for Rep5x Kinematic Calibrator
 * Handles camera access and crosshair overlay rendering
 */

class CameraManager {
    constructor() {
        this.stream = null;
        this.videoElements = [];
        this.canvasElements = [];
        this.animationFrameId = null;
    }

    /**
     * Check if camera API is available
     * @returns {boolean}
     */
    static isSupported() {
        return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    }

    /**
     * Request camera access
     * @returns {Promise<MediaStream>}
     */
    async requestAccess() {
        if (!CameraManager.isSupported()) {
            throw new Error('Camera API not supported in this browser');
        }

        try {
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment',
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
                audio: false
            });

            return this.stream;
        } catch (error) {
            console.error('Camera access error:', error);
            throw new Error(`Camera access denied: ${error.message}`);
        }
    }

    /**
     * Check if camera is active
     * @returns {boolean}
     */
    isActive() {
        return this.stream !== null && this.stream.active;
    }

    /**
     * Attach camera stream to a video element
     * @param {string|HTMLVideoElement} videoElement - Video element or ID
     * @param {string|HTMLCanvasElement} canvasElement - Canvas for crosshair overlay
     */
    attachToElement(videoElement, canvasElement = null) {
        const video = typeof videoElement === 'string'
            ? document.getElementById(videoElement)
            : videoElement;

        if (!video) {
            console.error('Video element not found');
            return;
        }

        if (!this.stream) {
            console.error('No camera stream available');
            return;
        }

        video.srcObject = this.stream;
        video.play().catch(e => console.warn('Video autoplay blocked:', e));

        // Track video element for cleanup
        if (!this.videoElements.includes(video)) {
            this.videoElements.push(video);
        }

        // Handle canvas for crosshair
        if (canvasElement) {
            const canvas = typeof canvasElement === 'string'
                ? document.getElementById(canvasElement)
                : canvasElement;

            if (canvas) {
                if (!this.canvasElements.includes(canvas)) {
                    this.canvasElements.push(canvas);
                }

                // Set up canvas sizing
                video.addEventListener('loadedmetadata', () => {
                    this.resizeCanvas(video, canvas);
                });

                // Resize on window resize
                window.addEventListener('resize', () => {
                    this.resizeCanvas(video, canvas);
                });

                // Start crosshair rendering
                this.startCrosshairRendering();
            }
        }
    }

    /**
     * Resize canvas to match video container
     * @param {HTMLVideoElement} video
     * @param {HTMLCanvasElement} canvas
     */
    resizeCanvas(video, canvas) {
        const container = video.parentElement;
        if (container) {
            canvas.width = container.clientWidth;
            canvas.height = container.clientHeight;
        }
    }

    /**
     * Start continuous crosshair rendering
     */
    startCrosshairRendering() {
        if (this.animationFrameId) return;

        const render = () => {
            for (const canvas of this.canvasElements) {
                this.renderCrosshair(canvas);
            }
            this.animationFrameId = requestAnimationFrame(render);
        };

        render();
    }

    /**
     * Stop crosshair rendering
     */
    stopCrosshairRendering() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    /**
     * Render crosshair overlay on canvas
     * @param {HTMLCanvasElement} canvas
     */
    renderCrosshair(canvas) {
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        const centerX = width / 2;
        const centerY = height / 2;

        // Settings
        const crosshairSize = Math.min(width, height) * 0.15;
        const circleRadius = crosshairSize * 0.6;
        const lineWidth = 2;
        const color = '#32D74B'; // Primary green
        const shadowColor = 'rgba(0, 0, 0, 0.5)';

        ctx.save();

        // Draw shadow for visibility
        ctx.strokeStyle = shadowColor;
        ctx.lineWidth = lineWidth + 2;

        // Shadow - horizontal line
        ctx.beginPath();
        ctx.moveTo(centerX - crosshairSize, centerY);
        ctx.lineTo(centerX + crosshairSize, centerY);
        ctx.stroke();

        // Shadow - vertical line
        ctx.beginPath();
        ctx.moveTo(centerX, centerY - crosshairSize);
        ctx.lineTo(centerX, centerY + crosshairSize);
        ctx.stroke();

        // Shadow - circle
        ctx.beginPath();
        ctx.arc(centerX, centerY, circleRadius, 0, Math.PI * 2);
        ctx.stroke();

        // Draw main crosshair
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;

        // Horizontal line (with gap in center)
        ctx.beginPath();
        ctx.moveTo(centerX - crosshairSize, centerY);
        ctx.lineTo(centerX - circleRadius * 0.5, centerY);
        ctx.moveTo(centerX + circleRadius * 0.5, centerY);
        ctx.lineTo(centerX + crosshairSize, centerY);
        ctx.stroke();

        // Vertical line (with gap in center)
        ctx.beginPath();
        ctx.moveTo(centerX, centerY - crosshairSize);
        ctx.lineTo(centerX, centerY - circleRadius * 0.5);
        ctx.moveTo(centerX, centerY + circleRadius * 0.5);
        ctx.lineTo(centerX, centerY + crosshairSize);
        ctx.stroke();

        // Centre circle
        ctx.beginPath();
        ctx.arc(centerX, centerY, circleRadius, 0, Math.PI * 2);
        ctx.stroke();

        // Centre dot
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(centerX, centerY, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    /**
     * Stop camera stream and clean up
     */
    stop() {
        // Stop rendering
        this.stopCrosshairRendering();

        // Stop all tracks
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }

        // Clear video sources
        for (const video of this.videoElements) {
            video.srcObject = null;
        }
        this.videoElements = [];

        // Clear canvases
        for (const canvas of this.canvasElements) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        this.canvasElements = [];

    }
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CameraManager;
}
