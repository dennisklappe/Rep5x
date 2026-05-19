const assert = require('assert');
const BoardPins = require('../js/board-pins.js');

let passed = 0, failed = 0;
function check(name, fn) {
  try { fn(); passed++; console.log('PASS ' + name); }
  catch (e) { failed++; console.log('FAIL ' + name + ': ' + e.message); }
}

check('octopus_v1.1 board exists with header maps', () => {
  const b = BoardPins.boards['octopus_v1.1'];
  assert.ok(b, 'board missing');
  assert.strictEqual(b.endstopHeaders['X-STOP'], 'PG6');
  assert.strictEqual(b.fanHeaders['Fan0'], 'PA8');
});

check('resolvePin uses the header map', () => {
  const pin = BoardPins.resolvePin('octopus_v1.1', 'endstop', 'Z-STOP', '');
  assert.strictEqual(pin, 'PG10');
});

check('resolvePin raw override wins over the header', () => {
  const pin = BoardPins.resolvePin('octopus_v1.1', 'endstop', 'Z-STOP', 'PB7');
  assert.strictEqual(pin, 'PB7');
});

check('getDefaults returns per-function header defaults', () => {
  const d = BoardPins.getDefaults('octopus_v1.1');
  assert.strictEqual(d.endstopC, 'E1DET');
  assert.strictEqual(d.endstopB, 'E2DET');
});

check('findConflicts flags two functions on the same pin', () => {
  const conflicts = BoardPins.findConflicts({ endstopX: 'PG6', endstopY: 'PG6', fanPart: 'PA8' });
  assert.strictEqual(conflicts.length, 1);
  assert.deepStrictEqual(conflicts[0].sort(), ['endstopX', 'endstopY']);
});

check('findConflicts returns empty when all pins differ', () => {
  const conflicts = BoardPins.findConflicts({ endstopX: 'PG6', endstopY: 'PG9' });
  assert.strictEqual(conflicts.length, 0);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
