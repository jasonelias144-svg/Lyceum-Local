/**
 * Lyceum Local: the page controller. Setup screen (device check, model choice, download) and the
 * full-screen chat. The model itself lives in js/engine.js; pure logic in models.js, device.js
 * and chat.js.
 */
import {
  DEFAULT_KEY,
  availableModels,
  formatMB,
  initialKey,
  MODELS,
  modelByKey,
  modelIdFor,
  precisionFor,
  smallerThan,
} from './models.js';
import { contextTokensFor, describeDevice, probeDevice } from './device.js';
import {
  classifyError,
  describeProgress,
  describeUsage,
  escapeHtml,
  fitHistory,
  renderMarkdown,
  splitThinking,
} from './chat.js';

const $ = (id) => document.getElementById(id);
const STORE_KEY = 'lyceum-local';
/** Set while a model loads and cleared when it succeeds or fails normally. Still set on the next
 *  visit means the page crashed mid-load (usually out of memory), so we don't auto-start again. */
const LOADING_FLAG = 'lyceum-local.loading';
const MAX_SAVED_TURNS = 60;

const state = {
  device: null,
  engine: null,
  models: MODELS,
  downloaded: new Set(),
  selectedKey: null,
  loadedKey: null,
  busy: false,
  generating: false,
  stopRequested: false,
  notedTrim: false,
  think: false,
  turns: [],
};

// ── Storage (this device only) ─────────────────────────────────────────

function readSaved() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
    return saved && typeof saved === 'object' ? saved : {};
  } catch {
    return {};
  }
}

function save() {
  try {
    localStorage.setItem(
      STORE_KEY,
      JSON.stringify({ modelKey: state.selectedKey, think: state.think, turns: state.turns.slice(-MAX_SAVED_TURNS) })
    );
  } catch {
    /* private mode or storage full: the chat still works, it just isn't kept */
  }
}

function flag(name, on) {
  try {
    if (on) localStorage.setItem(name, String(Date.now()));
    else localStorage.removeItem(name);
  } catch {
    /* ignore */
  }
}

function flagSet(name) {
  try {
    return localStorage.getItem(name) !== null;
  } catch {
    return false;
  }
}

// ── Setup screen ───────────────────────────────────────────────────────

function renderModels() {
  const precision = precisionFor(state.device);
  $('models').innerHTML = state.models
    .map((m) => {
      const id = `model-${m.key}`;
      const onDevice = state.downloaded.has(m.key);
      const size = onDevice ? 'Downloaded' : `${formatMB(m.downloadMB)} download`;
      return `<div class="model-row${onDevice ? ' has-delete' : ''}">
        <label class="model" for="${id}">
          <input type="radio" name="model" id="${id}" value="${escapeHtml(m.key)}"${m.key === state.selectedKey ? ' checked' : ''} />
          <span class="model-main">
            <span class="model-name">${escapeHtml(m.name)}${
              m.key === DEFAULT_KEY ? ' <span class="badge">Recommended</span>' : ''
            }${onDevice ? ' <span class="badge ok">On this device</span>' : ''}</span>
            <span class="model-summary">${escapeHtml(m.summary)}</span>
            <span class="model-meta">${size} · up to ${formatMB(m.memoryMB[precision])} of memory · ${escapeHtml(
              m.license
            )} · ${escapeHtml(m.maker)}</span>
          </span>
        </label>
        ${onDevice ? `<button type="button" class="linkish delete" data-delete="${escapeHtml(m.key)}">Delete</button>` : ''}
      </div>`;
    })
    .join('');
  updateStart();
}

function updateStart() {
  const model = modelByKey(state.selectedKey);
  const button = $('start');
  const canRun = Boolean(state.device && state.device.webgpu && state.engine);
  button.disabled = !model || !canRun || state.busy;
  const loaded = model && state.loadedKey === model.key;
  if (model) {
    button.textContent = loaded
      ? 'Back to the chat'
      : state.downloaded.has(model.key)
        ? 'Start'
        : `Download ${formatMB(model.downloadMB)} and start`;
  }
  // Another model is still loaded: offer the way back to its chat without switching.
  $('resume').classList.toggle('hidden', !state.loadedKey || loaded || state.busy);
  let note = '';
  if (model && canRun && !loaded) {
    if (!state.downloaded.has(model.key)) note = 'Downloads once from Hugging Face, then stays on this device.';
    if (state.device.mobile && model.memoryMB[precisionFor(state.device)] > 2000) {
      note += `${note ? ' ' : ''}This one needs a lot of memory; if it fails, pick a smaller model.`;
    }
  }
  $('start-note').textContent = note;
}

function showProgress({ label, percent, detail }) {
  $('progress').classList.remove('hidden');
  $('progress-label').textContent = label;
  $('progress-detail').textContent = detail || (percent ? `${percent}%` : '');
  const bar = $('progress-bar');
  bar.setAttribute('aria-valuenow', String(percent || 0));
  bar.firstElementChild.style.width = `${percent || 0}%`;
}

function hideProgress() {
  $('progress').classList.add('hidden');
}

function actionButton(label, onClick) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'secondary';
  b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}

function showSetupError(text, actions = []) {
  const box = $('setup-error');
  box.replaceChildren();
  const p = document.createElement('p');
  p.style.margin = '0';
  p.textContent = text;
  box.append(p, ...actions);
  box.classList.remove('hidden');
}

function hideSetupError() {
  $('setup-error').classList.add('hidden');
}

function select(key) {
  state.selectedKey = key;
  save();
  renderModels();
}

async function refreshDownloaded() {
  if (!state.engine || !state.device) return;
  for (const m of state.models) {
    if (await state.engine.isDownloaded(modelIdFor(m, state.device))) state.downloaded.add(m.key);
    else state.downloaded.delete(m.key);
  }
  renderModels();
}

async function start() {
  const model = modelByKey(state.selectedKey);
  if (!model || state.busy || !state.engine) return;
  if (state.loadedKey === model.key) {
    openChat();
    return;
  }
  const switching = Boolean(state.loadedKey);
  state.busy = true;
  hideSetupError();
  updateStart();
  showProgress({ label: 'Starting', percent: 0, detail: '' });
  try {
    // Ask the browser not to clear the downloaded model when storage runs low.
    if (navigator.storage && navigator.storage.persist) await navigator.storage.persist();
  } catch {
    /* not supported: downloads may be cleared under storage pressure */
  }
  flag(LOADING_FLAG, true);
  try {
    await state.engine.load(modelIdFor(model, state.device), {
      contextTokens: contextTokensFor(state.device),
      onProgress: (report) => showProgress(describeProgress(report)),
    });
    flag(LOADING_FLAG, false);
    state.loadedKey = model.key;
    state.downloaded.add(model.key);
    hideProgress();
    renderModels();
    openChat(switching ? `Switched to ${model.name}.` : '');
  } catch (err) {
    flag(LOADING_FLAG, false);
    console.error(err);
    state.loadedKey = null;
    hideProgress();
    await state.engine.unload();
    const info = classifyError(err);
    const actions = [];
    if (info.kind === 'memory' || info.kind === 'storage') {
      const smaller = smallerThan(model.key, state.models);
      if (smaller) {
        actions.push(
          actionButton(`Try ${smaller.name} instead (${formatMB(smaller.downloadMB)})`, () => {
            select(smaller.key);
            start();
          })
        );
      }
    } else if (info.kind === 'network') {
      actions.push(actionButton('Try again', start));
    }
    showSetupError(info.text, actions);
    refreshDownloaded();
  } finally {
    state.busy = false;
    updateStart();
  }
}

async function deleteModel(key) {
  const model = modelByKey(key);
  if (!model || state.busy) return;
  if (!window.confirm(`Delete ${model.name} from this device? You can download it again later.`)) return;
  try {
    await state.engine.deleteDownload(modelIdFor(model, state.device));
    if (state.loadedKey === key) state.loadedKey = null;
  } catch (err) {
    showSetupError(`Couldn't delete it: ${err.message || err}`);
  }
  await refreshDownloaded();
}

// ── Chat screen ────────────────────────────────────────────────────────

function openChat(note = '') {
  document.body.classList.add('in-chat');
  $('setup').classList.add('hidden');
  $('chat').classList.remove('hidden');
  const model = modelByKey(state.loadedKey);
  $('model-line').textContent = `${model.name} · on this device`;
  $('think-wrap').classList.toggle('hidden', !model.thinking);
  $('think').checked = state.think;
  renderThread();
  if (note) addNote(note);
  fitViewport();
  scrollToEnd();
  if (!state.device.mobile) $('input').focus();
}

function closeChat() {
  document.body.classList.remove('in-chat');
  $('chat').classList.add('hidden');
  $('setup').classList.remove('hidden');
  renderModels();
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function personBubble(text) {
  const box = el('div', 'msg from-person');
  box.append(el('div', 'msg-body', text));
  return box;
}

function aiBubble(text, meta) {
  const box = el('div', 'msg from-ai');
  const body = el('div', 'msg-body');
  body.innerHTML = renderMarkdown(text);
  box.append(body);
  if (meta) box.append(el('div', 'msg-meta', meta));
  return box;
}

function emptyState() {
  const box = el('div', 'empty');
  box.append(el('p', '', 'Everything here runs on this device. Try:'));
  const row = el('div', 'suggestions');
  for (const s of ['Summarize this: ', 'Rewrite this more simply: ', 'Give me three ideas for ']) {
    const b = el('button', '', s.replace(/: $/, '').replace(/ $/, '…'));
    b.type = 'button';
    b.addEventListener('click', () => {
      const input = $('input');
      input.value = s;
      input.focus();
      autosize();
      updateSend();
    });
    row.append(b);
  }
  box.append(row);
  return box;
}

function renderThread() {
  const thread = $('thread');
  thread.replaceChildren();
  if (!state.turns.length) {
    thread.append(emptyState());
    return;
  }
  thread.append(el('p', 'legend', 'You ←  ·  → AI on this device'));
  for (const t of state.turns) thread.append(t.role === 'user' ? personBubble(t.content) : aiBubble(t.content, t.meta));
}

function addNote(text, bad = false) {
  $('thread').append(el('p', `system-note${bad ? ' bad' : ''}`, text));
  scrollToEnd();
}

/** A reply being written: thinking (if any) in a fold, the answer below, redrawn once per frame. */
function streamingBubble() {
  const box = el('div', 'msg from-ai writing');
  const thoughts = el('details', 'thoughts hidden');
  const summary = el('summary', '', 'Thinking…');
  const thoughtText = el('div', '');
  thoughts.append(summary, thoughtText);
  const body = el('div', 'msg-body');
  const meta = el('div', 'msg-meta hidden');
  box.append(thoughts, body, meta);
  let pending = null;
  let frame = 0;
  const draw = () => {
    frame = 0;
    const { parts, seconds } = pending;
    if (parts.thinking) {
      thoughts.classList.remove('hidden');
      thoughtText.textContent = parts.thinking;
      summary.textContent = parts.thinkingDone ? `Thought for ${seconds} s` : 'Thinking…';
    }
    body.innerHTML = renderMarkdown(parts.answer);
    keepAtEnd();
  };
  return {
    box,
    update(parts, seconds) {
      pending = { parts, seconds };
      if (!frame) frame = requestAnimationFrame(draw);
    },
    finish(parts, seconds, metaText) {
      if (frame) cancelAnimationFrame(frame);
      pending = { parts, seconds };
      draw();
      box.classList.remove('writing');
      if (!parts.answer) body.textContent = '(no answer)';
      if (metaText) {
        meta.textContent = metaText;
        meta.classList.remove('hidden');
      }
    },
  };
}

function systemPrompt(model) {
  const today = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  return (
    `You are ${model.name}, a small AI model running entirely on the user's own device in the ` +
    `Lyceum Local app; nothing they write leaves the device. Keep answers short and clear. ` +
    `Say so when you are unsure, and never make up facts, quotes or links. Today is ${today}.`
  );
}

async function send(text) {
  const model = modelByKey(state.loadedKey);
  if (!model || state.generating || !text.trim()) return;
  const thinking = Boolean(model.thinking && state.think);
  const maxTokens = thinking ? 1024 : 512;
  const contextTokens = contextTokensFor(state.device);
  const turns = [...state.turns, { role: 'user', content: text }];
  const fit = fitHistory({
    system: systemPrompt(model),
    turns: turns.map(({ role, content }) => ({ role, content })),
    contextTokens,
    reserveTokens: maxTokens,
  });
  if (fit.tooLong) {
    // About three quarters of a word per token, after the system prompt's share.
    const words = Math.max(50, Math.round(((contextTokens - maxTokens - 150) * 0.75) / 10) * 10);
    addNote(`That's too long for this model to read at once. Try about ${words} words or fewer.`, true);
    return;
  }

  if (!state.turns.length) $('thread').replaceChildren(el('p', 'legend', 'You ←  ·  → AI on this device'));
  state.turns = turns;
  save();
  $('input').value = '';
  autosize();
  $('thread').append(personBubble(text));
  const view = streamingBubble();
  $('thread').append(view.box);
  scrollToEnd();

  state.generating = true;
  state.stopRequested = false;
  updateSend();
  $('stats').textContent = thinking ? 'Thinking…' : 'Writing…';
  const started = performance.now();
  let thoughtSeconds = 0;
  let raw = '';
  let usage = null;
  let failure = null;
  try {
    for await (const part of state.engine.reply(fit.messages, {
      thinking,
      supportsThinking: model.thinking,
      maxTokens,
    })) {
      if (part.delta) {
        raw += part.delta;
        const parts = splitThinking(raw, { expectThinking: thinking });
        if (thinking && parts.thinkingDone && !thoughtSeconds) {
          thoughtSeconds = Math.max(1, Math.round((performance.now() - started) / 1000));
          $('stats').textContent = 'Writing…';
        }
        view.update(parts, thoughtSeconds);
      }
      if (part.usage) usage = part.usage;
    }
  } catch (err) {
    failure = err;
    console.error(err);
  }
  state.generating = false;
  const parts = splitThinking(raw, { expectThinking: thinking, final: true });
  const metaText = [describeUsage(usage), state.stopRequested ? 'stopped' : ''].filter(Boolean).join(' · ');
  view.finish(parts, thoughtSeconds || Math.round((performance.now() - started) / 1000), metaText);
  $('stats').textContent = '';
  updateSend();
  if (parts.answer) {
    state.turns.push({ role: 'assistant', content: parts.answer, meta: metaText });
    save();
  }
  if (failure) {
    const info = classifyError(failure);
    addNote(info.text, true);
    if (info.kind === 'memory') {
      // The GPU is gone; the model has to be loaded again, or a smaller one chosen.
      state.loadedKey = null;
      await state.engine.unload();
      addNote('Go back (‹) to load it again or pick a smaller model.');
    }
  }
  if (fit.dropped > 0 && !state.notedTrim) {
    state.notedTrim = true;
    addNote('This chat is now longer than the model can hold at once, so it sees only the most recent part.');
  }
}

function stop() {
  if (!state.generating) return;
  state.stopRequested = true;
  state.engine.stop();
}

function newChat() {
  if (state.generating) stop();
  state.turns = [];
  state.notedTrim = false;
  save();
  renderThread();
  $('input').focus();
}

// ── Composer, scrolling and the keyboard ───────────────────────────────

function updateSend() {
  const send = $('send');
  if (state.generating) {
    send.disabled = false;
    send.textContent = '■';
    send.classList.add('stop');
    send.setAttribute('aria-label', 'Stop');
  } else {
    send.disabled = !$('input').value.trim() || !state.loadedKey;
    send.textContent = '↑';
    send.classList.remove('stop');
    send.setAttribute('aria-label', 'Send');
  }
}

function autosize() {
  const input = $('input');
  input.style.height = 'auto';
  input.style.height = `${input.scrollHeight}px`;
}

function atEnd() {
  const t = $('thread');
  return t.scrollHeight - t.scrollTop - t.clientHeight < 60;
}

function scrollToEnd() {
  const t = $('thread');
  t.scrollTop = t.scrollHeight;
  updateJump();
}

function keepAtEnd() {
  if (atEnd()) scrollToEnd();
  else updateJump();
}

function updateJump() {
  $('jump').classList.toggle('hidden', atEnd());
}

/** Size the chat to the visible screen, so the composer sits just above the iPhone keyboard. */
function fitViewport() {
  const vv = window.visualViewport;
  if (!vv) return;
  const root = document.documentElement.style;
  root.setProperty('--vvh', `${vv.height}px`);
  root.setProperty('--vvtop', `${vv.offsetTop}px`);
}

function wire() {
  $('models').addEventListener('change', (e) => {
    if (e.target.name === 'model') select(e.target.value);
  });
  $('models').addEventListener('click', (e) => {
    const del = e.target.closest('button[data-delete]');
    if (del) deleteModel(del.dataset.delete);
  });
  $('start').addEventListener('click', start);
  $('resume').addEventListener('click', () => openChat());
  $('back').addEventListener('click', closeChat);
  $('new-chat').addEventListener('click', newChat);
  $('think').addEventListener('change', (e) => {
    state.think = e.target.checked;
    save();
  });
  $('composer').addEventListener('submit', (e) => {
    e.preventDefault();
    if (state.generating) stop();
    else send($('input').value);
  });
  $('input').addEventListener('input', () => {
    autosize();
    updateSend();
  });
  $('input').addEventListener('keydown', (e) => {
    // On a keyboard, Enter sends and Shift+Enter starts a new line. On phones, Enter is a new line.
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && state.device && !state.device.mobile) {
      e.preventDefault();
      $('composer').requestSubmit();
    }
  });
  $('input').addEventListener('focus', () => {
    const stick = atEnd();
    setTimeout(() => {
      fitViewport();
      if (stick) scrollToEnd();
    }, 250);
  });
  $('thread').addEventListener('scroll', updateJump, { passive: true });
  $('jump').addEventListener('click', scrollToEnd);
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', fitViewport);
    window.visualViewport.addEventListener('scroll', fitViewport);
  }
}

// ── Start-up ───────────────────────────────────────────────────────────

async function loadEngine() {
  try {
    const { LocalEngine } = await import('./engine.js');
    state.engine = new LocalEngine();
    return true;
  } catch (err) {
    console.error(err);
    return false;
  }
}

async function init() {
  const saved = readSaved();
  state.think = Boolean(saved.think);
  state.turns = (Array.isArray(saved.turns) ? saved.turns : []).filter(
    (t) => t && (t.role === 'user' || t.role === 'assistant') && typeof t.content === 'string'
  );
  wire();
  renderModels();

  const [device, engineReady] = await Promise.all([probeDevice(), loadEngine()]);
  state.device = device;
  const described = describeDevice(device);
  $('device').textContent = described.text;
  $('device').className = `device ${described.ok ? 'ok' : 'bad'}`;
  if (!engineReady) {
    showSetupError(
      "Couldn't load the model engine (from cdn.jsdelivr.net). Check the connection and reload the page.",
      [actionButton('Reload', () => window.location.reload())]
    );
  } else {
    state.models = availableModels(state.engine.catalogIds());
  }
  state.selectedKey = initialKey(saved.modelKey, state.models);
  renderModels();
  if (!engineReady || !device.webgpu) return;
  await refreshDownloaded();

  // Coming back to a model that is already on this device: open straight into the chat,
  // unless the last attempt crashed the page (then let the person choose).
  const crashed = flagSet(LOADING_FLAG);
  flag(LOADING_FLAG, false);
  if (crashed) {
    const smaller = smallerThan(state.selectedKey, state.models);
    showSetupError(
      "Last time the model didn't finish loading; this device may not have enough memory for it.",
      smaller ? [actionButton(`Try ${smaller.name} instead`, () => { select(smaller.key); start(); })] : []
    );
  } else if (state.downloaded.has(state.selectedKey)) {
    start();
  }
}

if ('serviceWorker' in navigator) {
  // Keeps the app itself available offline; the model files are kept by WebLLM.
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

init();
