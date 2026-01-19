/**
 * Shared Camera Manager
 * Handles camera access and overlay rendering (crosshair and line modes)
 * Used by: Calibrator, LC/LB Measure
 */

class CameraManager {
    constructor() {
        this.stream = null;
        this.videoElements = [];
        this.canvasElements = [];
        this.animationFrameId = null;
        this.reconnecting = false;

        // Overlay settings
        this.mode = 'crosshair'; // 'crosshair' or 'line'
        this.primaryColour = '#32D74B';
        this.shadowColour = 'rgba(0, 0, 0, 0.5)';
        this.lineWidth = 1;

        // Track stream end events for auto-reconnect
        this.onStreamEnded = null;
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

            // Listen for stream ending (browser may stop it)
            const videoTrack = this.stream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.addEventListener('ended', () => {
                    console.warn('Camera stream ended unexpectedly');
                    this.handleStreamEnded();
                });
            }

            return this.stream;
        } catch (error) {
            console.error('Camera access error:', error);
            throw new Error(`Camera access denied: ${error.message}`);
        }
    }

    /**
     * Handle stream ended event - attempt reconnection
     */
    async handleStreamEnded() {
        if (this.reconnecting) return;
        this.reconnecting = true;

        console.log('Attempting to reconnect camera...');

        try {
            // Wait a moment before reconnecting
            await new Promise(resolve => setTimeout(resolve, 500));

            // Request new stream
            await this.requestAccess();

            // Re-attach to all tracked video elements
            for (const video of this.videoElements) {
                if (this.stream) {
                    video.srcObject = this.stream;
                    video.play().catch(e => console.warn('Video autoplay blocked:', e));
                }
            }

            console.log('Camera reconnected successfully');
        } catch (error) {
            console.error('Failed to reconnect camera:', error);
        } finally {
            this.reconnecting = false;
        }
    }

    /**
     * Ensure camera is active, reconnect if needed
     */
    async ensureActive() {
        if (!this.isActive()) {
            console.log('Camera not active, requesting access...');
            await this.requestAccess();
        }
        return this.isActive();
    }

    /**
     * Check if camera is active
     * @returns {boolean}
     */
    isActive() {
        return this.stream !== null && this.stream.active;
    }

    /**
     * Set overlay mode
     * @param {string} mode - 'crosshair' or 'line'
     */
    setMode(mode) {
        this.mode = mode;
    }

    /**
     * Attach camera stream to a video element and optional canvas for overlay
     * @param {string|HTMLVideoElement} videoElement - Video element or ID
     * @param {string|HTMLCanvasElement} canvasElement - Canvas for overlay (optional)
     */
    async attachToElement(videoElement, canvasElement = null) {
        const video = typeof videoElement === 'string'
            ? document.getElementById(videoElement)
            : videoElement;

        if (!video) {
            console.error('Video element not found');
            return;
        }

        // Ensure camera is active before attaching
        if (!this.isActive()) {
            console.log('Camera not active, requesting access...');
            try {
                await this.requestAccess();
            } catch (error) {
                console.error('Failed to get camera access:', error);
                return;
            }
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

        // Handle canvas for overlay
        if (canvasElement) {
            const canvas = typeof canvasElement === 'string'
                ? document.getElementById(canvasElement)
                : canvasElement;

            if (canvas) {
                if (!this.canvasElements.includes(canvas)) {
                    this.canvasElements.push(canvas);
                }

                // Set up canvas sizing
                const resize = () => this.resizeCanvas(video, canvas);

                video.addEventListener('loadedmetadata', resize);
                window.addEventListener('resize', resize);

                // Initial resize attempt
                resize();

                // Start rendering loop if not already running
                this.startRendering();
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
            // Check if dimensions changed to avoid unnecessary clears
            if (canvas.width !== container.clientWidth || canvas.height !== container.clientHeight) {
                canvas.width = container.clientWidth;
                canvas.height = container.clientHeight;
            }
        }
    }

    /**
     * Start continuous rendering
     */
    startRendering() {
        if (this.animationFrameId) return;

        const render = () => {
            for (const canvas of this.canvasElements) {
                this.renderOverlay(canvas);
            }
            this.animationFrameId = requestAnimationFrame(render);
        };

        render();
    }

    /**
     * Stop rendering
     */
    stopRendering() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    /**
     * Render overlay on specific canvas
     * @param {HTMLCanvasElement} canvas
     */
    renderOverlay(canvas) {
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        if (this.mode === 'crosshair') {
            this.renderCrosshair(ctx, width, height);
        } else if (this.mode === 'line') {
            this.renderLine(ctx, width, height);
        }
    }

    /**
     * Render crosshair overlay
     */
    renderCrosshair(ctx, width, height) {
        const centerX = width / 2;
        const centerY = height / 2;
        const size = Math.min(width, height) * 0.15;
        const circleRadius = size * 0.6;
        const gap = circleRadius * 0.4; // Gap for the center circle

        ctx.save();

        // Draw shadow for visibility
        ctx.strokeStyle = this.shadowColour;
        ctx.lineWidth = this.lineWidth + 2;
        this.drawCrosshairPath(ctx, centerX, centerY, size, gap, circleRadius);

        // Draw main crosshair
        ctx.strokeStyle = this.primaryColour;
        ctx.lineWidth = this.lineWidth;
        this.drawCrosshairPath(ctx, centerX, centerY, size, gap, circleRadius);

        // Centre dot
        ctx.fillStyle = this.primaryColour;
        ctx.beginPath();
        ctx.arc(centerX, centerY, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    drawCrosshairPath(ctx, cx, cy, size, gap, radius) {
        // Horizontal line
        ctx.beginPath();
        ctx.moveTo(cx - size, cy);
        ctx.lineTo(cx - gap, cy);
        ctx.moveTo(cx + gap, cy);
        ctx.lineTo(cx + size, cy);
        ctx.stroke();

        // Vertical line
        ctx.beginPath();
        ctx.moveTo(cx, cy - size);
        ctx.lineTo(cx, cy - gap);
        ctx.moveTo(cx, cy + gap);
        ctx.lineTo(cx, cy + size);
        ctx.stroke();

        // Circle
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.stroke();
    }

    /**
     * Render horizontal line overlay (for Z calibration)
     */
    renderLine(ctx, width, height) {
        const centerY = height / 2;

        ctx.save();

        // Draw shadow
        ctx.strokeStyle = this.shadowColour;
        ctx.lineWidth = this.lineWidth + 2;
        ctx.beginPath();
        ctx.moveTo(0, centerY);
        ctx.lineTo(width, centerY);
        ctx.stroke();

        // Draw main line
        ctx.strokeStyle = this.primaryColour;
        ctx.lineWidth = this.lineWidth;
        ctx.beginPath();
        ctx.moveTo(0, centerY);
        ctx.lineTo(width, centerY);
        ctx.stroke();

        // Draw small vertical markers at edges
        const markerHeight = 10;
        ctx.beginPath();
        ctx.moveTo(width * 0.1, centerY - markerHeight);
        ctx.lineTo(width * 0.1, centerY + markerHeight);
        ctx.moveTo(width * 0.9, centerY - markerHeight);
        ctx.lineTo(width * 0.9, centerY + markerHeight);
        ctx.stroke();

        // Draw label
        ctx.fillStyle = this.primaryColour;
        ctx.font = '12px system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText('Align nozzle tip with line', 10, centerY - 15);

        ctx.restore();
    }

    /**
     * Stop camera stream and clean up
     */
    stop() {
        // Stop rendering
        this.stopRendering();

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
} else {
    // Make available globally if loaded via script tag
    window.CameraManager = CameraManager;
}
