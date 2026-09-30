/**
 * The models this app offers. All are Apache-2.0 licensed, so the app's licensing stays simple.
 *
 * Each model comes in two builds from WebLLM's catalog:
 *   f16 — faster and lighter; needs the GPU's half-precision feature ("shader-f16").
 *   f32 — works on any WebGPU device (the fallback).
 * downloadMB is the one-time download (Hugging Face, September 2026). memoryMB is WebLLM's own
 * estimate at a 4,096-token context; on phones this app uses a 2,048-token context, which needs less.
 */
export const MODELS = [
  {
    key: 'smollm2-360m',
    name: 'SmolLM2 360M',
    maker: 'Hugging Face',
    license: 'Apache-2.0',
    downloadMB: 207,
    memoryMB: { f16: 376, f32: 580 },
    thinking: false,
    ids: { f16: 'SmolLM2-360M-Instruct-q4f16_1-MLC', f32: 'SmolLM2-360M-Instruct-q4f32_1-MLC' },
    summary: 'Tiny and quick. Runs almost anywhere; fine for short answers and simple rewrites.',
  },
  {
    key: 'qwen3.5-0.8b',
    name: 'Qwen3.5 0.8B',
    maker: 'Qwen (Alibaba)',
    license: 'Apache-2.0',
    downloadMB: 447,
    memoryMB: { f16: 1629, f32: 1894 },
    thinking: true,
    ids: { f16: 'Qwen3.5-0.8B-q4f16_1-MLC', f32: 'Qwen3.5-0.8B-q4f32_1-MLC' },
    summary: 'The balance for phones: a recent small model (2026) that answers in seconds.',
  },
  {
    key: 'qwen3.5-2b',
    name: 'Qwen3.5 2B',
    maker: 'Qwen (Alibaba)',
    license: 'Apache-2.0',
    downloadMB: 1083,
    memoryMB: { f16: 2245, f32: 2592 },
    thinking: true,
    ids: { f16: 'Qwen3.5-2B-q4f16_1-MLC', f32: 'Qwen3.5-2B-q4f32_1-MLC' },
    summary: 'Noticeably smarter, and a bigger download. For recent phones and computers.',
  },
];

export const DEFAULT_KEY = 'qwen3.5-0.8b';

export function modelByKey(key) {
  return MODELS.find((m) => m.key === key) || null;
}

/** f16 when the GPU supports half precision, otherwise the f32 build that runs everywhere. */
export function precisionFor(device) {
  return device && device.f16 ? 'f16' : 'f32';
}

export function modelIdFor(model, device) {
  return model.ids[precisionFor(device)];
}

/**
 * Keep only models whose builds exist in the WebLLM catalog this app loaded, so a future WebLLM
 * version that renames a build hides that model instead of failing at download time.
 */
export function availableModels(catalogIds, models = MODELS) {
  const ids = new Set(catalogIds);
  return models.filter((m) => ids.has(m.ids.f16) && ids.has(m.ids.f32));
}

/**
 * The model to preselect: the one the person used last if it is still offered, else the default,
 * else the smallest on offer.
 */
export function initialKey(savedKey, models = MODELS) {
  if (savedKey && models.some((m) => m.key === savedKey)) return savedKey;
  if (models.some((m) => m.key === DEFAULT_KEY)) return DEFAULT_KEY;
  return models.length ? smallest(models).key : null;
}

/** The next smaller model than `key`, offered when a model runs out of memory. */
export function smallerThan(key, models = MODELS) {
  const current = modelByKey(key);
  if (!current) return null;
  const smaller = models
    .filter((m) => m.downloadMB < current.downloadMB)
    .sort((a, b) => b.downloadMB - a.downloadMB);
  return smaller[0] || null;
}

function smallest(models) {
  return models.reduce((a, b) => (b.downloadMB < a.downloadMB ? b : a));
}

/** "207 MB" / "1.1 GB" */
export function formatMB(mb) {
  if (mb >= 1000) return `${(mb / 1000).toFixed(1)} GB`;
  return `${Math.round(mb)} MB`;
}
