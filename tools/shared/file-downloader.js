/**
 * Shared file download utilities for Rep5x tools
 * Consolidates duplicated download patterns across multiple tools
 */

/**
 * Download text content as a file
 * @param {string} content - The text content to download
 * @param {string} filename - The filename for the download
 * @param {string} mimeType - The MIME type (default: 'text/plain')
 */
function downloadFile(content, filename, mimeType = 'text/plain') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Download a Blob as a file
 * @param {Blob} blob - The blob to download
 * @param {string} filename - The filename for the download
 */
function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Download JSON data as a file
 * @param {object} data - The data object to download as JSON
 * @param {string} filename - The filename for the download
 * @param {boolean} pretty - Whether to pretty-print the JSON (default: true)
 */
function downloadJSON(data, filename, pretty = true) {
    const content = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
    downloadFile(content, filename, 'application/json');
}

/**
 * Download CSV content as a file
 * @param {string} content - The CSV content to download
 * @param {string} filename - The filename for the download
 */
function downloadCSV(content, filename) {
    downloadFile(content, filename, 'text/csv');
}

/**
 * Download G-code content as a file
 * @param {string} content - The G-code content to download
 * @param {string} filename - The filename for the download
 */
function downloadGcode(content, filename) {
    downloadFile(content, filename, 'text/plain');
}
