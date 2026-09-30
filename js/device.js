/**
 * What this device can do. The model runs on the GPU through WebGPU, so everything hinges on
 * whether the browser exposes it and whether the GPU has half precision ("shader-f16").
 */

export function isIOS(nav) {
  const ua = (nav && nav.userAgent) || '';
  // iPadOS reports itself as a Mac; touch points give it away.
  return /iPad|iPhone|iPod/.test(ua) || (nav && nav.platform === 'MacIntel' && nav.maxTouchPoints > 1);
}

export function isMobile(nav) {
  const ua = (nav && nav.userAgent) || '';
  return isIOS(nav) || /Android|Mobi/i.test(ua);
}

/** Probe WebGPU. Never throws: a failure becomes `reason`. */
export async function probeDevice(nav = globalThis.navigator) {
  const device = {
    webgpu: false,
    f16: false,
    gpu: '',
    maxBufferMB: 0,
    ios: isIOS(nav),
    mobile: isMobile(nav),
    deviceMemoryGB: (nav && nav.deviceMemory) || null,
    reason: '',
  };
  if (!nav || !nav.gpu) {
    device.reason = 'no-webgpu';
    return device;
  }
  let adapter = null;
  try {
    adapter = await nav.gpu.requestAdapter({ powerPreference: 'high-performance' });
  } catch {
    adapter = null;
  }
  if (!adapter) {
    device.reason = 'no-adapter';
    return device;
  }
  device.webgpu = true;
  device.f16 = adapter.features.has('shader-f16');
  device.maxBufferMB = Math.round(adapter.limits.maxBufferSize / (1024 * 1024));
  const info = adapter.info || {};
  device.gpu = [info.vendor, info.architecture].filter(Boolean).join(' ');
  return device;
}

/**
 * Context window (in tokens) the model is loaded with. Phones get a smaller one: it needs less
 * memory, and phone browsers are the likeliest to run out.
 */
export function contextTokensFor(device) {
  return device && device.mobile ? 2048 : 4096;
}

/** One plain sentence about whether this device can run the models, and how to fix it if not. */
export function describeDevice(device) {
  if (device.webgpu) {
    const mode = device.f16 ? 'fast mode' : 'compatibility mode';
    return { ok: true, text: `Ready: this browser can run models on its GPU (${mode}).` };
  }
  if (device.ios) {
    return {
      ok: false,
      text:
        'This needs Safari on iOS 26 or later, which can use the GPU. ' +
        'Update under Settings → General → Software Update, then open this page in Safari.',
    };
  }
  if (device.reason === 'no-adapter') {
    return {
      ok: false,
      text:
        "This browser supports WebGPU but couldn't reach a GPU. " +
        'Try Chrome or Edge with hardware acceleration turned on, or another device.',
    };
  }
  return {
    ok: false,
    text:
      "This browser can't run models on the GPU. Use a recent Chrome or Edge on a computer or " +
      'Android phone, or Safari on iOS 26 or later.',
  };
}
