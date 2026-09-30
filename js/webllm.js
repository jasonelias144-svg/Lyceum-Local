/**
 * The one place WebLLM is loaded from. The version is pinned; when you change it, change
 * WEBLLM_URL in sw.js to match (test/sw.test.js checks the two agree).
 */
export * from 'https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.85/lib/index.js';
