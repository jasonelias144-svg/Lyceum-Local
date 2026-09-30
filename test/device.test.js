import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contextTokensFor, describeDevice, isIOS, isMobile, probeDevice } from '../js/device.js';

const IPHONE = { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 Version/26.0 Mobile/15E148 Safari/604.1' };
const IPAD = { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/26.0 Safari/605.1.15', platform: 'MacIntel', maxTouchPoints: 5 };
const MAC = { userAgent: IPAD.userAgent, platform: 'MacIntel', maxTouchPoints: 0 };
const ANDROID = { userAgent: 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/140.0 Mobile Safari/537.36' };

function gpu(adapter) {
  return { requestAdapter: async () => adapter };
}
function adapter({ f16 = true, maxBufferSize = 2 ** 31 } = {}) {
  return { features: new Set(f16 ? ['shader-f16'] : []), limits: { maxBufferSize }, info: { vendor: 'apple', architecture: 'common-3' } };
}

test('recognises iPhone, iPad (which reports itself as a Mac), Android and desktop', () => {
  assert.equal(isIOS(IPHONE), true);
  assert.equal(isIOS(IPAD), true);
  assert.equal(isIOS(MAC), false);
  assert.equal(isMobile(ANDROID), true);
  assert.equal(isMobile(MAC), false);
});

test('no WebGPU: says what to do, per platform', async () => {
  const iphone = await probeDevice({ ...IPHONE });
  assert.equal(iphone.webgpu, false);
  assert.equal(iphone.reason, 'no-webgpu');
  assert.match(describeDevice(iphone).text, /iOS 26/);
  const mac = await probeDevice({ ...MAC });
  assert.equal(describeDevice(mac).ok, false);
  assert.match(describeDevice(mac).text, /Chrome or Edge/);
});

test('WebGPU without an adapter is reported as such', async () => {
  const d = await probeDevice({ ...MAC, gpu: gpu(null) });
  assert.equal(d.reason, 'no-adapter');
  assert.match(describeDevice(d).text, /couldn't reach a GPU/);
});

test('a throwing requestAdapter is treated as no adapter', async () => {
  const d = await probeDevice({ ...MAC, gpu: { requestAdapter: async () => { throw new Error('boom'); } } });
  assert.equal(d.webgpu, false);
  assert.equal(d.reason, 'no-adapter');
});

test('half precision decides fast mode vs compatibility mode', async () => {
  const fast = await probeDevice({ ...IPHONE, gpu: gpu(adapter({ f16: true })) });
  assert.equal(fast.webgpu, true);
  assert.equal(fast.f16, true);
  assert.equal(fast.gpu, 'apple common-3');
  assert.equal(fast.maxBufferMB, 2048);
  assert.match(describeDevice(fast).text, /fast mode/);
  const compat = await probeDevice({ ...MAC, gpu: gpu(adapter({ f16: false })) });
  assert.equal(compat.f16, false);
  assert.match(describeDevice(compat).text, /compatibility mode/);
});

test('phones hold a smaller context than computers', () => {
  assert.equal(contextTokensFor({ mobile: true }), 2048);
  assert.equal(contextTokensFor({ mobile: false }), 4096);
});
