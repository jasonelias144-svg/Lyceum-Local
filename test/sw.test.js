import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');

test('the service worker and js/webllm.js pin the same WebLLM version', () => {
  const inWorker = read('sw.js').match(/const WEBLLM_URL = '([^']+)'/)[1];
  const inModule = read('js/webllm.js').match(/from '([^']+)'/)[1];
  assert.equal(inWorker, inModule);
  assert.match(inModule, /@mlc-ai\/web-llm@\d+\.\d+\.\d+\//, 'pinned to an exact version');
});

test('every file the service worker keeps offline exists, and the page uses nothing else', () => {
  const shell = [...read('sw.js').matchAll(/^\s+'\.\/([^']*)',$/gm)].map((m) => m[1]);
  for (const file of shell.filter(Boolean)) assert.ok(existsSync(new URL(file, root)), `missing ${file}`);
  const html = read('index.html');
  const used = [...html.matchAll(/(?:href|src)="([^"#:]+)"/g)].map((m) => m[1]);
  for (const file of used) assert.ok(shell.includes(file), `index.html uses ${file}, which is not kept offline`);
  const scripts = [...read('js/app.js').matchAll(/from '\.\/([^']+)'|import\('\.\/([^']+)'\)/g)].map((m) => `js/${m[1] || m[2]}`);
  for (const file of scripts) assert.ok(shell.includes(file), `app.js imports ${file}, which is not kept offline`);
});
