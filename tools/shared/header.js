/**
 * Shared Header Component for Rep5x Tools
 * Usage: Include this script and set data-tool-name on body or call SharedHeader.init('Tool Name')
 */

const SharedHeader = {
    /**
     * Generate header HTML
     * @param {string} toolName - Name of the tool to display
     * @returns {string} Header HTML
     */
    getHTML(toolName) {
        return `
        <header class="bg-white border-b border-gray-200">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex justify-between items-center h-16">
                    <div class="flex items-center">
                        <h1 class="text-xl font-bold text-gray-900">Rep5x Tools</h1>
                        <span class="ml-2 text-sm text-gray-500">${toolName}</span>
                    </div>
                    <a href="../" class="text-primary hover:opacity-80 text-sm">&larr; Rep5x Tools</a>
                </div>
            </div>
        </header>`;
    },

    /**
     * Initialize header
     * @param {string} toolName - Name of the tool to display
     */
    init(toolName) {
        const container = document.getElementById('shared-header');
        if (container) {
            container.innerHTML = this.getHTML(toolName);
        }
    }
};

// Auto-init if data attribute is present
document.addEventListener('DOMContentLoaded', () => {
    const toolName = document.body.dataset.toolName;
    if (toolName) {
        SharedHeader.init(toolName);
    }
});
