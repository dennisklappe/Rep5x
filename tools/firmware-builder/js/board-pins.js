/**
 * Rep5x Firmware Builder - Board Pin Maps
 *
 * Single source of truth for board pinouts used by the advanced
 * pin-assignment panel. Header labels match the silkscreen on the board.
 * Pin values are taken from the Marlin pin files:
 *   Marlin/src/pins/stm32f4/pins_BTT_OCTOPUS_V1_common.h
 *   Marlin/src/pins/stm32h7/pins_BTT_OCTOPUS_PRO_V1_common.h
 * (Both Octopus variants share the same endstop and fan headers/pins.)
 */

// Octopus V1.1 and Pro expose identical endstop and fan headers.
const octopusEndstopHeaders = {
    'X-STOP': 'PG6', 'Y-STOP': 'PG9', 'Z-STOP': 'PG10', 'Z2-STOP': 'PG11',
    'E0DET': 'PG12', 'E1DET': 'PG13', 'E2DET': 'PG14', 'E3DET': 'PG15'
};

const octopusFanHeaders = {
    'Fan0': 'PA8', 'Fan1': 'PE5', 'Fan2': 'PD12',
    'Fan3': 'PD13', 'Fan4': 'PD14', 'Fan5': 'PD15'
};

// Default header per assignable function. Endstop C/B match the base
// config's I_MIN_PIN (PG13 / E1DET) and J_MIN_PIN (PG14 / E2DET).
const octopusDefaults = {
    endstopX: 'X-STOP', endstopY: 'Y-STOP', endstopZ: 'Z-STOP',
    endstopC: 'E1DET', endstopB: 'E2DET',
    fanHotend: 'Fan1', fanController: 'Fan2',
    led: 'Fan3'
};

const BoardPins = {
    boards: {
        'octopus_v1.1': {
            endstopHeaders: octopusEndstopHeaders,
            fanHeaders: octopusFanHeaders,
            defaults: octopusDefaults
        },
        'octopus_pro': {
            endstopHeaders: octopusEndstopHeaders,
            fanHeaders: octopusFanHeaders,
            defaults: octopusDefaults
        }
    },

    /**
     * Return the defaults object for a board (falls back to octopus_v1.1).
     */
    getDefaults(boardId) {
        const board = this.boards[boardId] || this.boards['octopus_v1.1'];
        return board.defaults;
    },

    /**
     * Resolve a function's pin. A non-empty raw override always wins;
     * otherwise the header label is looked up in the board's map.
     * @param {string} boardId  e.g. 'octopus_v1.1'
     * @param {string} kind     'endstop' or 'fan'
     * @param {string} header   header label, e.g. 'Z-STOP'
     * @param {string} rawPin   optional raw MCU pin override
     * @returns {string} resolved pin, or '' if unresolved
     */
    resolvePin(boardId, kind, header, rawPin) {
        if (rawPin && rawPin.trim()) {
            return rawPin.trim();
        }
        const board = this.boards[boardId] || this.boards['octopus_v1.1'];
        const map = kind === 'fan' ? board.fanHeaders : board.endstopHeaders;
        return map[header] || '';
    },

    /**
     * Find functions that resolve to the same pin.
     * @param {Object} resolved  map of functionName -> resolved pin string
     * @returns {Array<Array<string>>} groups of 2+ function names sharing a pin
     */
    findConflicts(resolved) {
        const byPin = {};
        Object.keys(resolved).forEach(fn => {
            const pin = resolved[fn];
            if (!pin) return;
            (byPin[pin] = byPin[pin] || []).push(fn);
        });
        return Object.keys(byPin)
            .map(pin => byPin[pin])
            .filter(group => group.length > 1);
    }
};

// Export for use in app.js (browser) and Node tests
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BoardPins;
}
