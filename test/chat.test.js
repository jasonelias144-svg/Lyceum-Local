import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyError,
  describeProgress,
  describeUsage,
  estimateTokens,
  fitHistory,
  renderMarkdown,
  splitThinking,
} from '../js/chat.js';

test('token estimate is conservative for English and counts other scripts per character', () => {
  assert.equal(estimateTokens(''), 0);
  assert.equal(estimateTokens('a'.repeat(35)), 10);
  assert.equal(estimateTokens('日本語'), 3);
  assert.equal(estimateTokens('hi 👋'), Math.ceil(3 / 3.5) + 2); // the emoji is two UTF-16 units
});

const say = (role, n) => ({ role, content: 'x'.repeat(n) });

test('keeps the whole conversation when it fits', () => {
  const turns = [say('user', 35), say('assistant', 35), say('user', 35)];
  const fit = fitHistory({ system: 'sys', turns, contextTokens: 2048, reserveTokens: 512 });
  assert.equal(fit.dropped, 0);
  assert.equal(fit.messages.length, 4);
  assert.deepEqual(fit.messages[0], { role: 'system', content: 'sys' });
});

test('drops the oldest turns first and never opens with a reply', () => {
  // Each turn costs 100 + 8 tokens; the budget holds about three.
  const turns = [say('user', 350), say('assistant', 350), say('user', 350), say('assistant', 350), say('user', 350)];
  const fit = fitHistory({ system: '', turns, contextTokens: 900, reserveTokens: 550, estimate: (s) => s.length / 3.5 });
  assert.ok(fit.dropped > 0);
  assert.equal(fit.messages[1].role, 'user', 'the first turn the model sees is the person');
  assert.equal(fit.messages.at(-1), turns.at(-1), 'the new message is always included');
});

test('a message too long on its own is refused rather than cut', () => {
  const fit = fitHistory({ system: 'sys', turns: [say('user', 20000)], contextTokens: 2048, reserveTokens: 512 });
  assert.equal(fit.tooLong, true);
});

test('splits thinking from the answer, while streaming and when finished', () => {
  assert.deepEqual(splitThinking('<think>hmm</think>\n\nYes.'), { thinking: 'hmm', answer: 'Yes.', thinkingDone: true });
  // Template opened the block itself: only the closing tag appears.
  assert.deepEqual(splitThinking('hmm, so\n</think>\nNo.'), { thinking: 'hmm, so', answer: 'No.', thinkingDone: true });
  // Mid-stream with thinking on: everything so far is thinking.
  assert.deepEqual(splitThinking('let me see', { expectThinking: true }), { thinking: 'let me see', answer: '', thinkingDone: false });
  assert.equal(splitThinking('<think>still going').thinkingDone, false);
  // Finished without closing: it all counts as the answer.
  assert.deepEqual(splitThinking('just an answer', { expectThinking: true, final: true }), {
    thinking: '',
    answer: 'just an answer',
    thinkingDone: true,
  });
  // Thinking off: plain text is the answer.
  assert.equal(splitThinking('Paris.').answer, 'Paris.');
});

test('markdown: model text can never inject markup', () => {
  const html = renderMarkdown('<img src=x onerror=alert(1)> **<b>hi</b>** `<script>` [link](javascript:alert(1))');
  assert.doesNotMatch(html, /<img|<script|<b>/);
  assert.match(html, /&lt;img/);
  assert.match(html, /<strong>&lt;b&gt;hi&lt;\/b&gt;<\/strong>/);
  assert.match(html, /<code>&lt;script&gt;<\/code>/);
  assert.doesNotMatch(html, /<a /, 'links stay plain text');
});

test('markdown: paragraphs, lists, headings and code blocks', () => {
  assert.equal(renderMarkdown('One\ntwo\n\nThree'), '<p>One<br>two</p><p>Three</p>');
  assert.equal(renderMarkdown('- a\n- *b*\n\n1. c\n2. d'), '<ul><li>a</li><li><em>b</em></li></ul><ol><li>c</li><li>d</li></ol>');
  assert.equal(renderMarkdown('## Title\ntext'), '<p class="heading">Title</p><p>text</p>');
  assert.equal(renderMarkdown('```js\nconst a = "<x>";\n```'), '<pre><code>const a = &quot;&lt;x&gt;&quot;;</code></pre>');
  assert.equal(renderMarkdown('2 * 3 * 4'), '<p>2 * 3 * 4</p>', 'arithmetic is not italics');
});

test('progress reports read as plain words (strings as WebLLM 0.2.85 writes them)', () => {
  const dl = describeProgress({
    progress: 0.25,
    timeElapsed: 12,
    text: 'Fetching param cache[3/12]: 107MB fetched. 25% completed, 12 secs elapsed. It can take a while when we first visit this page to populate the cache. Later refreshes will become faster.',
  });
  assert.deepEqual(dl, { stage: 'download', label: 'Downloading the model (one time only)', percent: 25, detail: '107 of 428 MB · 12 s' });
  assert.equal(describeProgress({ progress: 0.5, timeElapsed: 2, text: 'Loading model from cache[6/12]: 214MB loaded. 50% completed, 2 secs elapsed.' }).stage, 'load');
  assert.equal(describeProgress({ progress: 0.4, text: 'Loading GPU shader modules[40/100]: 40% completed, 3 secs elapsed.' }).label, 'Preparing the GPU');
  assert.equal(describeProgress({ progress: 1, text: 'Finish loading on WebGPU - apple' }).stage, 'done');
  assert.equal(describeProgress({ progress: 0, text: 'Start to fetch params' }).percent, 0);
  assert.equal(describeProgress(undefined).stage, 'other');
});

test('errors are sorted into what the person can do about them', () => {
  const lost = new Error('The WebGPU device was lost while loading the model. This issue often occurs due to running out of memory (OOM).');
  lost.name = 'DeviceLostError';
  assert.equal(classifyError(lost).kind, 'memory');
  assert.equal(classifyError(new TypeError('Failed to fetch')).kind, 'network');
  assert.equal(classifyError(new TypeError('Load failed')).kind, 'network', 'Safari wording');
  assert.equal(classifyError(new Error('QuotaExceededError: The quota has been exceeded.')).kind, 'storage');
  assert.equal(classifyError(new Error('Prompt tokens exceed context window size: number of prompt tokens: 3000; context window size: 2048')).kind, 'context');
  assert.equal(classifyError(new Error('Cannot find WebGPU in the environment')).kind, 'webgpu');
  assert.equal(classifyError(new Error('weird')).kind, 'other');
  assert.equal(classifyError('plain string').kind, 'other');
});

test('usage line shows speed and length', () => {
  assert.equal(describeUsage({ completion_tokens: 42, extra: { decode_tokens_per_s: 18.4 } }), '18 tokens/s · 42 tokens');
  assert.equal(describeUsage({ completion_tokens: 5, extra: { decode_tokens_per_s: 2.46 } }), '2.5 tokens/s · 5 tokens');
  assert.equal(describeUsage(null), '');
});
