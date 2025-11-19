/**
 * Shared Footer Component for Rep5x Tools
 * Usage: Include this script after storage-manager.js, then call SharedFooter.init()
 */

const SharedFooter = {
    /**
     * Generate footer HTML
     * @returns {string} Footer HTML
     */
    getHTML() {
        return `
        <footer class="bg-white border-t border-gray-200 mt-16">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div class="text-center text-sm text-gray-500">
                    <!-- Saved LA/LB display (editable) -->
                    <div id="savedKinematicsDisplay" class="mb-3">
                        <div class="inline-flex items-center px-3 py-2 rounded-lg status-success border text-sm gap-2">
                            <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                            </svg>
                            <span>Saved:</span>
                            <label class="flex items-center gap-1">
                                LA =
                                <input type="number" id="savedLaValue" step="0.01" class="w-16 px-1 py-0.5 text-center border border-primary rounded text-xs bg-white" value="0">
                                mm
                            </label>
                            <label class="flex items-center gap-1">
                                LB =
                                <input type="number" id="savedLbValue" step="0.01" class="w-16 px-1 py-0.5 text-center border border-primary rounded text-xs bg-white" value="47">
                                mm
                            </label>
                            <button id="saveFooterValues" class="ml-1 px-2 py-0.5 btn-success rounded text-xs">Save</button>
                        </div>
                    </div>
                    <p>Part of the <a href="https://rep5x.com" class="text-primary hover:opacity-80">Rep5x</a> open-source 5-axis printer project</p>
                    <p class="mt-1">
                        <a href="https://github.com/dennisklappe/Rep5x" class="text-primary hover:opacity-80">GitHub</a>
                        &middot;
                        <a href="https://discord.gg/pfTrx9uy8H" class="text-primary hover:opacity-80">Discord</a>
                    </p>
                </div>
            </div>
        </footer>`;
    },

    /**
     * Initialize footer functionality
     */
    initEventListeners() {
        const laInput = document.getElementById('savedLaValue');
        const lbInput = document.getElementById('savedLbValue');
        const saveBtn = document.getElementById('saveFooterValues');

        if (!laInput || !lbInput || !saveBtn) return;

        // Load saved calibration values
        if (typeof StorageManager !== 'undefined') {
            const savedResults = StorageManager.loadCalibrationResults();
            if (savedResults) {
                if (savedResults.la !== undefined) laInput.value = savedResults.la.toFixed(2);
                if (savedResults.lb !== undefined) lbInput.value = savedResults.lb.toFixed(2);
            }
        }

        // Save button handler
        saveBtn.addEventListener('click', () => {
            const la = parseFloat(laInput.value) || 0;
            const lb = parseFloat(lbInput.value) || 47;

            if (typeof StorageManager !== 'undefined') {
                StorageManager.saveCalibrationResults(la, lb, {
                    method: 'manual',
                    testMode: false
                });
            }

            // Dispatch event so other components can update
            document.dispatchEvent(new CustomEvent('laLbUpdated', {
                detail: { la, lb, source: 'footer' }
            }));

            // Visual feedback
            const originalText = saveBtn.textContent;
            saveBtn.textContent = 'Saved!';
            setTimeout(() => {
                saveBtn.textContent = originalText;
            }, 1500);
        });

        // Listen for updates from other components
        document.addEventListener('laLbUpdated', (e) => {
            if (e.detail.source !== 'footer') {
                if (e.detail.la !== undefined) laInput.value = e.detail.la.toFixed(2);
                if (e.detail.lb !== undefined) lbInput.value = e.detail.lb.toFixed(2);
            }
        });
    },

    /**
     * Initialize footer
     */
    init() {
        const container = document.getElementById('shared-footer');
        if (container) {
            container.innerHTML = this.getHTML();
            this.initEventListeners();
        }
    }
};

// Auto-init on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    SharedFooter.init();
});
