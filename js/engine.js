/**
 * A thin wrapper around WebLLM: load a model (in a Web Worker when this browser lets workers use
 * the GPU, otherwise on the page), stream replies, stop, unload, and manage downloaded models.
 */
import * as webllm from './webllm.js';

/** Errors that mean "the worker couldn't start WebGPU", after which the page itself is tried. */
const WORKER_GPU_FAILURE = /WebGPU|adapter|Cannot find WebGPU|navigator\.gpu/i;

/** Some browsers expose WebGPU on the page but not in workers. Ask a throwaway worker. */
async function workerHasWebGPU() {
  let url = '';
  let worker = null;
  try {
    url = URL.createObjectURL(
      new Blob(['postMessage(Boolean(self.navigator && self.navigator.gpu))'], { type: 'text/javascript' })
    );
    worker = new Worker(url);
    return await new Promise((resolve) => {
      const timer = setTimeout(() => resolve(false), 3000);
      worker.onmessage = (e) => {
        clearTimeout(timer);
        resolve(e.data === true);
      };
      worker.onerror = () => {
        clearTimeout(timer);
        resolve(false);
      };
    });
  } catch {
    return false;
  } finally {
    if (worker) worker.terminate();
    if (url) URL.revokeObjectURL(url);
  }
}

export class LocalEngine {
  constructor() {
    this.engine = null;
    this.worker = null;
    this.modelId = null;
    /** 'worker' or 'page': where the model runs. */
    this.mode = '';
  }

  /** Every model id in the WebLLM catalog this version ships with. */
  catalogIds() {
    return webllm.prebuiltAppConfig.model_list.map((m) => m.model_id);
  }

  async isDownloaded(modelId) {
    try {
      return await webllm.hasModelInCache(modelId, webllm.prebuiltAppConfig);
    } catch {
      return false;
    }
  }

  /** Remove a model's files from this device (unloading it first if it is running). */
  async deleteDownload(modelId) {
    if (this.modelId === modelId) await this.unload();
    await webllm.deleteModelAllInfoInCache(modelId, webllm.prebuiltAppConfig);
  }

  /**
   * Load a model, downloading it the first time. `onProgress` receives WebLLM's progress reports.
   * `contextTokens` sets how much conversation the model holds at once (less needs less memory).
   */
  async load(modelId, { onProgress, contextTokens }) {
    if (this.engine && this.modelId === modelId) return;
    await this.unload();
    const engineConfig = { appConfig: webllm.prebuiltAppConfig, initProgressCallback: onProgress };
    const chatOpts = contextTokens ? { context_window_size: contextTokens } : undefined;
    if (await workerHasWebGPU()) {
      const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
      try {
        this.engine = await webllm.CreateWebWorkerMLCEngine(worker, modelId, engineConfig, chatOpts);
        this.worker = worker;
        this.mode = 'worker';
      } catch (err) {
        worker.terminate();
        if (!WORKER_GPU_FAILURE.test(String((err && err.message) || err))) throw err;
      }
    }
    if (!this.engine) {
      this.engine = await webllm.CreateMLCEngine(modelId, engineConfig, chatOpts);
      this.mode = 'page';
    }
    this.modelId = modelId;
  }

  /**
   * Stream a reply to `messages` (OpenAI-style). Yields { delta } as text arrives and { usage }
   * at the end. `thinking` only applies to models that can think first (Qwen).
   */
  async *reply(messages, { thinking = false, supportsThinking = false, maxTokens = 512 } = {}) {
    const request = {
      messages,
      stream: true,
      stream_options: { include_usage: true },
      max_tokens: maxTokens,
      // Qwen's suggested settings: a little cooler when thinking, a little warmer when not.
      temperature: thinking ? 0.6 : 0.7,
      top_p: thinking ? 0.95 : 0.8,
    };
    if (supportsThinking) request.extra_body = { enable_thinking: Boolean(thinking) };
    const stream = await this.engine.chat.completions.create(request);
    for await (const chunk of stream) {
      const choice = chunk.choices && chunk.choices[0];
      const delta = choice && choice.delta && choice.delta.content;
      if (delta) yield { delta };
      if (chunk.usage) yield { usage: chunk.usage };
    }
  }

  /** Stop the reply being written; what was written so far is kept. */
  stop() {
    if (this.engine) this.engine.interruptGenerate();
  }

  async unload() {
    const { engine, worker } = this;
    this.engine = null;
    this.worker = null;
    this.modelId = null;
    this.mode = '';
    if (engine) {
      try {
        await engine.unload();
      } catch {
        /* already gone (e.g. the GPU was lost) */
      }
    }
    if (worker) worker.terminate();
  }
}
