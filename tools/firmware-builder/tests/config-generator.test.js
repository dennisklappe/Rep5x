const assert = require('assert');
const ConfigGenerator = require('../js/config-generator.js');

function baseConfig(overrides) {
  return Object.assign({
    board: 'octopus_v1.1', xBedSize: 200, yBedSize: 200, zMaxPos: 170,
    xHomeDir: 1, yHomeDir: -1, zHomeDir: 1, display: 'none',
    stepsX: 80, stepsY: 80, stepsZ: 400, stepsC: 26.6, stepsB: 26.6, stepsE: 415,
    ikLC: 2.3, ikLB: 52.87, cHomePos: 0, bRange: 135, segmentsPerSecond: 200
  }, overrides || {});
}

let passed = 0, failed = 0;
function check(name, fn) {
  try { fn(); passed++; console.log('PASS ' + name); }
  catch (e) { failed++; console.log('FAIL ' + name + ': ' + e.message); }
}

check('sensorless mode emits SENSORLESS_HOMING', () => {
  const out = ConfigGenerator.generateConfigurationAdvH(baseConfig({
    xyHomingMode: 'sensorless', stallSensitivityX: 12, stallSensitivityY: 9
  }));
  assert.ok(out.includes('#define SENSORLESS_HOMING'), 'missing SENSORLESS_HOMING');
  assert.ok(out.includes('#define X_STALL_SENSITIVITY 12'), 'missing X sensitivity');
  assert.ok(out.includes('#define Y_STALL_SENSITIVITY 9'), 'missing Y sensitivity');
  assert.ok(out.includes('{ 0, 0, 3, 5, 2 }'), 'HOMING_BUMP_MM not zeroed for XY');
});

check('endstop mode omits SENSORLESS_HOMING', () => {
  const out = ConfigGenerator.generateConfigurationAdvH(baseConfig({ xyHomingMode: 'endstops' }));
  assert.ok(!out.includes('#define SENSORLESS_HOMING'), 'should not enable sensorless');
  assert.ok(out.includes('{ 5, 5, 3, 5, 2 }'), 'HOMING_BUMP_MM should be default');
});

check('preview shows sensorless defines when sensorless', () => {
  const out = ConfigGenerator.generatePreview(baseConfig({
    xyHomingMode: 'sensorless', stallSensitivityX: 5, stallSensitivityY: 7
  }));
  assert.ok(out.includes('#define SENSORLESS_HOMING'), 'preview missing SENSORLESS_HOMING');
  assert.ok(out.includes('#define X_STALL_SENSITIVITY 5'), 'preview missing X sensitivity');
  assert.ok(out.includes('#define Y_STALL_SENSITIVITY 7'), 'preview missing Y sensitivity');
});

check('preview omits sensorless defines when endstops', () => {
  const out = ConfigGenerator.generatePreview(baseConfig({ xyHomingMode: 'endstops' }));
  assert.ok(!out.includes('#define SENSORLESS_HOMING'), 'preview should not show sensorless');
});

check('stall sensitivity defaults to 8 when omitted', () => {
  const out = ConfigGenerator.generateConfigurationAdvH(baseConfig({ xyHomingMode: 'sensorless' }));
  assert.ok(out.includes('#define X_STALL_SENSITIVITY 8'), 'X sensitivity should default to 8');
  assert.ok(out.includes('#define Y_STALL_SENSITIVITY 8'), 'Y sensitivity should default to 8');
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
