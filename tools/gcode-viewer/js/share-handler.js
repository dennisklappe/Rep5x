// Share handler for Rep5x G-code viewer
// Sends uploaded gcode files to Rep5x for 5-axis printing research (when enabled)

class ShareHandler {
    constructor() {
        this.endpoint = 'https://rep5x.com/gcode-share';
        this.storageKey = 'gcodeViewer_shareForResearch';
    }

    isEnabled() {
        const stored = localStorage.getItem(this.storageKey);
        return stored === null ? true : stored === 'true';
    }

    setEnabled(enabled) {
        localStorage.setItem(this.storageKey, String(enabled));
    }

    share(file, metadata, statistics) {
        if (!this.isEnabled()) return;

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('metadata', JSON.stringify({
                ...metadata,
                totalCommands: statistics?.totalCommands,
                layers: statistics?.layers,
                printDistance: statistics?.printDistance,
                estimatedTime: statistics?.estimatedTime,
            }));

            fetch(this.endpoint, {
                method: 'POST',
                body: formData,
            }).catch(err => console.warn('Gcode share failed:', err));
        } catch (err) {
            console.warn('Gcode share failed:', err);
        }
    }
}
