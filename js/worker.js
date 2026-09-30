/**
 * Runs the model off the page's main thread, so typing and scrolling stay smooth while the model
 * loads and writes. js/engine.js falls back to the page itself where workers can't use the GPU.
 */
import { WebWorkerMLCEngineHandler } from './webllm.js';

const handler = new WebWorkerMLCEngineHandler();
self.onmessage = (msg) => handler.onmessage(msg);
