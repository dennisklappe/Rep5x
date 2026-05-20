/**
 * Baud rate selector for Rep5x tools.
 *
 * Renders a small dropdown that lets the user pick the serial baud rate used
 * by PrinterInterface. The choice is persisted in localStorage under the same
 * key PrinterInterface reads (`rep5x.baudRate`), so any tool sharing
 * PrinterInterface picks up the value automatically on next connect.
 *
 * Usage:
 *   <span id="baudSelector"></span>
 *   <script src="../shared/baud-selector.js"></script>
 *   <script>BaudSelector.mount('baudSelector');</script>
 */

const BaudSelector = (() => {
    const STORAGE_KEY = 'rep5x.baudRate';
    const DEFAULT_BAUD = 250000;
    const COMMON_RATES = [250000, 115200, 230400, 57600, 38400, 19200, 9600];
    const CUSTOM_VALUE = 'custom';

    function readStored() {
        try {
            const v = parseInt(localStorage.getItem(STORAGE_KEY), 10);
            if (Number.isFinite(v) && v > 0) return v;
        } catch (_) { /* localStorage may be unavailable */ }
        return DEFAULT_BAUD;
    }

    function writeStored(value) {
        try {
            localStorage.setItem(STORAGE_KEY, String(value));
        } catch (_) { /* ignore */ }
    }

    function getBaudRate() {
        return readStored();
    }

    function mount(elementId) {
        const host = document.getElementById(elementId);
        if (!host) {
            console.warn(`[BaudSelector] element #${elementId} not found`);
            return null;
        }

        const current = readStored();
        const isCustom = !COMMON_RATES.includes(current);

        host.innerHTML = `
            <label class="flex items-center gap-2 text-xs text-gray-600">
                <span>Baud</span>
                <select class="baud-selector-select px-2 py-1 border border-gray-300 rounded text-xs font-mono bg-white focus:outline-none focus:border-primary">
                    ${COMMON_RATES.map(r =>
                        `<option value="${r}"${!isCustom && r === current ? ' selected' : ''}>${r}</option>`
                    ).join('')}
                    <option value="${CUSTOM_VALUE}"${isCustom ? ' selected' : ''}>Custom…</option>
                </select>
                <input type="number" min="1" step="1" value="${current}"
                    class="baud-selector-custom px-2 py-1 border border-gray-300 rounded text-xs font-mono bg-white focus:outline-none focus:border-primary w-24${isCustom ? '' : ' hidden'}"
                    placeholder="baud">
            </label>
        `;

        const select = host.querySelector('.baud-selector-select');
        const custom = host.querySelector('.baud-selector-custom');

        const persist = (raw) => {
            const v = parseInt(raw, 10);
            if (Number.isFinite(v) && v > 0) writeStored(v);
        };

        select.addEventListener('change', () => {
            if (select.value === CUSTOM_VALUE) {
                custom.classList.remove('hidden');
                custom.focus();
                persist(custom.value);
            } else {
                custom.classList.add('hidden');
                persist(select.value);
            }
        });

        custom.addEventListener('input', () => persist(custom.value));

        return { getBaudRate };
    }

    return { mount, getBaudRate, STORAGE_KEY, DEFAULT_BAUD };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = BaudSelector;
}
