import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MODELS,
  DEFAULT_KEY,
  availableModels,
  formatMB,
  initialKey,
  modelByKey,
  modelIdFor,
  precisionFor,
  smallerThan,
} from '../js/models.js';

test('every model has both builds, sizes, a license and a summary', () => {
  for (const m of MODELS) {
    assert.match(m.ids.f16, /q4f16_1-MLC$/, m.key);
    assert.match(m.ids.f32, /q4f32_1-MLC$/, m.key);
    assert.ok(m.downloadMB > 0 && m.memoryMB.f16 > 0 && m.memoryMB.f32 > 0, m.key);
    assert.equal(m.license, 'Apache-2.0', m.key);
    assert.ok(m.summary.length > 10, m.key);
  }
  assert.ok(modelByKey(DEFAULT_KEY), 'the default is on offer');
});

test('f16 builds only where the GPU has half precision', () => {
  const qwen = modelByKey('qwen3.5-0.8b');
  assert.equal(precisionFor({ f16: true }), 'f16');
  assert.equal(precisionFor({ f16: false }), 'f32');
  assert.equal(precisionFor(null), 'f32');
  assert.equal(modelIdFor(qwen, { f16: true }), 'Qwen3.5-0.8B-q4f16_1-MLC');
  assert.equal(modelIdFor(qwen, { f16: false }), 'Qwen3.5-0.8B-q4f32_1-MLC');
});

test('models missing from the WebLLM catalog are hidden', () => {
  const catalog = ['SmolLM2-360M-Instruct-q4f16_1-MLC', 'SmolLM2-360M-Instruct-q4f32_1-MLC', 'Qwen3.5-0.8B-q4f16_1-MLC'];
  assert.deepEqual(availableModels(catalog).map((m) => m.key), ['smollm2-360m']);
});

test('preselects the last model used, else the default, else the smallest', () => {
  assert.equal(initialKey('qwen3.5-2b'), 'qwen3.5-2b');
  assert.equal(initialKey('gone-model'), DEFAULT_KEY);
  assert.equal(initialKey(undefined), DEFAULT_KEY);
  const withoutDefault = MODELS.filter((m) => m.key !== DEFAULT_KEY);
  assert.equal(initialKey(undefined, withoutDefault), 'smollm2-360m');
  assert.equal(initialKey(undefined, []), null);
});

test('offers the next smaller model after running out of memory', () => {
  assert.equal(smallerThan('qwen3.5-2b').key, 'qwen3.5-0.8b');
  assert.equal(smallerThan('qwen3.5-0.8b').key, 'smollm2-360m');
  assert.equal(smallerThan('smollm2-360m'), null);
  assert.equal(smallerThan('unknown'), null);
});

test('sizes read naturally', () => {
  assert.equal(formatMB(207), '207 MB');
  assert.equal(formatMB(1083), '1.1 GB');
  assert.equal(formatMB(2592), '2.6 GB');
});
