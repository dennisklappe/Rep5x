/**
 * Shared Footer Component for Rep5x Tools
 * Provides consistent footer across all tools
 * Usage: Include this script, then call SharedFooter.init()
 *
 * Used by: All tools
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
     * Initialize footer
     */
    init() {
        const container = document.getElementById('shared-footer');
        if (container) {
            container.innerHTML = this.getHTML();
        }
    }
};

// Auto-init on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    SharedFooter.init();
});
