/**
 * Rep5x Firmware Builder - Board Pin Maps
 *
 * Single source of truth for board pinouts used by the advanced
 * pin-assignment panel. Pin values are taken from the Marlin pin files:
 *   Marlin/src/pins/stm32f4/pins_BTT_OCTOPUS_V1_common.h
 *   Marlin/src/pins/stm32h7/pins_BTT_OCTOPUS_PRO_V1_common.h
 * (Both Octopus variants share the same endstop and fan pins.)
 *
 * The panel works in raw MCU pin names. Which pin a given axis uses is a
 * wiring choice, not a fixed fact - the Rep5x tutorial happens to wire X
 * to PG6, Y to PG9, etc., and those are the defaults below.
 */

// Endstop-capable pins on the BTT Octopus (the DIAG / *DET headers).
const octopusEndstopPins = ['PG6', 'PG9', 'PG10', 'PG11', 'PG12', 'PG13', 'PG14', 'PG15'];

// Fan header pins on the BTT Octopus (Fan0..Fan5).
const octopusFanPins = ['PA8', 'PE5', 'PD12', 'PD13', 'PD14', 'PD15'];

// MOTOR slot -> driver pins on the BTT Octopus (step / dir / enable / TMC UART).
const octopusMotorSlots = {
    MOTOR0:   { step: 'PF13', dir: 'PF12', enable: 'PF14', uart: 'PC4'  },
    MOTOR1:   { step: 'PG0',  dir: 'PG1',  enable: 'PF15', uart: 'PD11' },
    MOTOR2:   { step: 'PF11', dir: 'PG3',  enable: 'PG5',  uart: 'PC6'  },
    MOTOR2_1: { step: 'PF11', dir: 'PG3',  enable: 'PG5',  uart: 'PC6'  },
    MOTOR3:   { step: 'PG4',  dir: 'PC1',  enable: 'PA0',  uart: 'PC7'  },
    MOTOR4:   { step: 'PF9',  dir: 'PF10', enable: 'PG2',  uart: 'PF2'  },
    MOTOR5:   { step: 'PC13', dir: 'PF0',  enable: 'PF1',  uart: 'PE4'  },
    MOTOR6:   { step: 'PE2',  dir: 'PE3',  enable: 'PD4',  uart: 'PE1'  },
    MOTOR7:   { step: 'PE6',  dir: 'PA14', enable: 'PE0',  uart: 'PD3'  }
};

// Default pin per assignable function (Rep5x tutorial wiring). Endstop C/B
// match the base config's I_MIN_PIN (PG13) and J_MIN_PIN (PG14).
const octopusDefaults = {
    endstopX: 'PG6', endstopY: 'PG9', endstopZ: 'PG10',
    endstopC: 'PG13', endstopB: 'PG14',
    fanHotend: 'PE5', fanController: 'PD12'
};

const BoardPins = {
    motorSlots: octopusMotorSlots,

    boards: {
        'octopus_v1.1': {
            endstopPins: octopusEndstopPins,
            fanPins: octopusFanPins,
            defaults: octopusDefaults
        },
        'octopus_pro': {
            endstopPins: octopusEndstopPins,
            fanPins: octopusFanPins,
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
     * Find functions that resolve to the same pin.
     * @param {Object} resolved  map of functionName -> pin string
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
