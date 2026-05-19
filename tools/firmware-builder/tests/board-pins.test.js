const assert = require('assert');
const BoardPins = require('../js/board-pins.js');

let passed = 0, failed = 0;
function check(name, fn) {
  try { fn(); passed++; console.log('PASS ' + name); }
  catch (e) { failed++; console.log('FAIL ' + name + ': ' + e.message); }
}

check('octopus_v1.1 board exposes endstop and fan pin lists', () => {
  const b = BoardPins.boards['octopus_v1.1'];
  assert.ok(b, 'board missing');
  assert.ok(b.endstopPins.includes('PG6'), 'endstop pins missing PG6');
  assert.ok(b.fanPins.includes('PA8'), 'fan pins missing PA8');
});

check('getDefaults returns per-function pin defaults', () => {
  const d = BoardPins.getDefaults('octopus_v1.1');
  assert.strictEqual(d.endstopX, 'PG6');
  assert.strictEqual(d.endstopC, 'PG13');
  assert.strictEqual(d.endstopB, 'PG14');
});

check('getDefaults falls back to octopus_v1.1 for an unknown board', () => {
  assert.strictEqual(BoardPins.getDefaults('nope').endstopX, 'PG6');
});

check('findConflicts flags two functions on the same pin', () => {
  const conflicts = BoardPins.findConflicts({ endstopX: 'PG6', endstopY: 'PG6', fanHotend: 'PE5' });
  assert.strictEqual(conflicts.length, 1);
  assert.deepStrictEqual(conflicts[0].sort(), ['endstopX', 'endstopY']);
});

check('findConflicts returns empty when all pins differ', () => {
  const conflicts = BoardPins.findConflicts({ endstopX: 'PG6', endstopY: 'PG9' });
  assert.strictEqual(conflicts.length, 0);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
