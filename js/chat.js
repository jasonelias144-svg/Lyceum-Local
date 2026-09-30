/**
 * Pure helpers for the chat: how much history fits, splitting a model's thinking from its answer,
 * safe formatting of replies, progress and error wording. No browser APIs, so all of it is tested
 * under Node (see test/).
 */

/**
 * A conservative token estimate. English runs about 4 characters per token; other scripts and
 * emoji can be one token per character or worse, so those count as one each.
 */
export function estimateTokens(text) {
  const s = String(text || '');
  const ascii = s.replace(/[^\x00-\x7f]/g, '').length;
  return Math.ceil(ascii / 3.5) + (s.length - ascii);
}

/**
 * The most recent turns that fit the model's context, after the system prompt and the room kept
 * for the answer. `turns` are { role: 'user' | 'assistant', content }, ending with the new message.
 * Returns { messages, dropped } — or { tooLong: true } when the new message alone doesn't fit.
 */
export function fitHistory({ system, turns, contextTokens, reserveTokens, estimate = estimateTokens }) {
  const perMessage = 8; // role markers and separators
  const budget = contextTokens - reserveTokens - estimate(system) - perMessage;
  const last = turns[turns.length - 1];
  if (!last || estimate(last.content) + perMessage > budget) {
    return { tooLong: true, messages: [], dropped: turns.length };
  }
  let used = 0;
  let start = turns.length;
  for (let i = turns.length - 1; i >= 0; i--) {
    const cost = estimate(turns[i].content) + perMessage;
    if (used + cost > budget) break;
    used += cost;
    start = i;
  }
  // The conversation the model sees must open with the person, not with a reply.
  while (start < turns.length - 1 && turns[start].role !== 'user') start++;
  return {
    messages: [{ role: 'system', content: system }, ...turns.slice(start)],
    dropped: start,
  };
}

/**
 * Separate a reasoning model's thinking from its answer. Qwen models write their thinking between
 * <think> and </think>; some chat templates open the block themselves, so only </think> appears.
 * While streaming (`final` false) with thinking expected, text before </think> is still thinking.
 */
export function splitThinking(text, { expectThinking = false, final = false } = {}) {
  const s = String(text || '');
  const open = s.indexOf('<think>');
  const close = s.indexOf('</think>');
  if (close !== -1) {
    const start = open !== -1 && open < close ? open + '<think>'.length : 0;
    return {
      thinking: s.slice(start, close).trim(),
      answer: s.slice(close + '</think>'.length).trim(),
      thinkingDone: true,
    };
  }
  if (!final && (open !== -1 || expectThinking)) {
    return { thinking: s.slice(open !== -1 ? open + '<think>'.length : 0).trim(), answer: '', thinkingDone: false };
  }
  // Finished without closing its thinking, or never thought: treat it all as the answer.
  return { thinking: '', answer: s.replace('<think>', '').trim(), thinkingDone: true };
}

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Inline formatting on escaped text: `code`, **bold**, *italic*. */
function inline(raw) {
  return String(raw)
    .split('`')
    .map((seg, i) => {
      if (i % 2) return `<code>${escapeHtml(seg)}</code>`;
      return escapeHtml(seg)
        .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
        .replace(/(^|[\s(])\*([^*\s][^*\n]*?)\*(?=$|[\s).,!?:;])/g, '$1<em>$2</em>');
    })
    .join('');
}

function blocks(text) {
  const out = [];
  let para = [];
  let list = null;
  const flushPara = () => {
    if (para.length) out.push(`<p>${para.map(inline).join('<br>')}</p>`);
    para = [];
  };
  const flushList = () => {
    if (list) out.push(`<${list.tag}>${list.items.map((i) => `<li>${inline(i)}</li>`).join('')}</${list.tag}>`);
    list = null;
  };
  for (const line of text.split('\n')) {
    let m;
    if (!line.trim()) {
      flushPara();
      flushList();
    } else if ((m = line.match(/^\s*#{1,6}\s+(.*)$/))) {
      flushPara();
      flushList();
      out.push(`<p class="heading">${inline(m[1])}</p>`);
    } else if ((m = line.match(/^\s*[-*•]\s+(.*)$/)) || (m = line.match(/^\s*\d+[.)]\s+(.*)$/))) {
      flushPara();
      const tag = /^\s*\d/.test(line) ? 'ol' : 'ul';
      if (!list || list.tag !== tag) {
        flushList();
        list = { tag, items: [] };
      }
      list.items.push(m[1]);
    } else if (list && /^\s{2,}\S/.test(line)) {
      list.items[list.items.length - 1] += ` ${line.trim()}`;
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara();
  flushList();
  return out.join('');
}

/**
 * The small Markdown subset models actually use: paragraphs, lists, headings, code blocks and
 * inline code, bold and italic. Everything is escaped first, so a reply can never inject markup.
 * Links are left as plain text on purpose: small models invent URLs.
 */
export function renderMarkdown(src) {
  const parts = String(src || '').split('```');
  return parts
    .map((part, i) => {
      if (i % 2 === 0) return blocks(part);
      const code = part.replace(/^[\w+#.-]*\n/, ''); // drop a language tag on the opening fence
      return `<pre><code>${escapeHtml(code.replace(/\n$/, ''))}</code></pre>`;
    })
    .join('');
}

/**
 * WebLLM's progress reports ("Fetching param cache[3/12]: 120MB fetched. 25% completed, …") in
 * plain words, with a percentage for the bar.
 */
export function describeProgress(report) {
  const text = (report && report.text) || '';
  const progress = Math.max(0, Math.min(1, Number((report && report.progress) || 0)));
  const percent = Math.round(progress * 100);
  const seconds = Math.round(Number((report && report.timeElapsed) || 0));
  const elapsed = seconds ? `${seconds} s` : '';
  let m;
  if ((m = text.match(/^Fetching param cache\[\d+\/\d+\]:\s*(\d+)MB fetched/))) {
    const fetched = Number(m[1]);
    const total = progress > 0.02 ? Math.round(fetched / progress) : null;
    const detail = [total ? `${fetched} of ${total} MB` : `${fetched} MB`, elapsed].filter(Boolean).join(' · ');
    return { stage: 'download', label: 'Downloading the model (one time only)', percent, detail };
  }
  if (text.startsWith('Start to fetch params')) {
    return { stage: 'download', label: 'Starting the download', percent: 0, detail: '' };
  }
  if (text.startsWith('Loading model from cache')) {
    return { stage: 'load', label: 'Loading the model from this device', percent, detail: elapsed };
  }
  if (text.startsWith('Loading GPU shader modules')) {
    return { stage: 'compile', label: 'Preparing the GPU', percent, detail: elapsed };
  }
  if (text.startsWith('Finish loading')) {
    return { stage: 'done', label: 'Ready', percent: 100, detail: '' };
  }
  return { stage: 'other', label: 'Getting ready', percent, detail: elapsed };
}

/** What went wrong, in plain words, and what kind of problem it is. */
export function classifyError(err) {
  const msg = `${(err && err.name) || ''} ${(err && err.message) || err || ''}`;
  if (/DeviceLost|device was lost|out of memory|\bOOM\b|OutOfMemory/i.test(msg)) {
    return {
      kind: 'memory',
      text: 'This model needed more memory than this device could give the browser.',
    };
  }
  if (/QuotaExceeded|quota|storage/i.test(msg)) {
    return { kind: 'storage', text: "There isn't enough free storage on this device for the model." };
  }
  if (/exceed context window|context window size/i.test(msg)) {
    return { kind: 'context', text: 'The conversation got too long for this model to hold at once.' };
  }
  if (/Failed to fetch|NetworkError|Load failed|network|fetch/i.test(msg)) {
    return {
      kind: 'network',
      text: 'The download was interrupted. Check the connection and try again; the parts already downloaded are kept.',
    };
  }
  if (/WebGPU|shader-f16|adapter|GPU/i.test(msg)) {
    return { kind: 'webgpu', text: "This browser couldn't start the model on its GPU." };
  }
  return { kind: 'other', text: `Something went wrong: ${String((err && err.message) || err).slice(0, 200)}` };
}

/** "18 tokens/s · 142 tokens" from WebLLM's usage report. */
export function describeUsage(usage) {
  if (!usage) return '';
  const speed = usage.extra && Number(usage.extra.decode_tokens_per_s);
  const parts = [];
  if (speed) parts.push(`${speed >= 10 ? Math.round(speed) : speed.toFixed(1)} tokens/s`);
  if (usage.completion_tokens) parts.push(`${usage.completion_tokens} tokens`);
  return parts.join(' · ');
}
