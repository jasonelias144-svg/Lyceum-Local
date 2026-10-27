# Working in Lyceum Local

This repository follows the policy handbook at
https://github.com/jasonelias144-svg/policy-handbook. Read its orientation
(README.md) before your first session here. The rules below add to the
handbook; they never loosen it.

## Every session

1. Read `STATUS.md` and the open pull requests (handbook P1).
2. Work on a branch; never push to `main` (P3).
3. End by pushing, updating `STATUS.md` on your branch, and opening or updating
   the pull request (P1).

## Who decides

The founder decides what this project is for and who works on it. The technical
lead (Claude) decides everything about the code, and records an approval on
every pull request before it merges (P4). Intent questions go to the founder (P5).

## This repository

- **What it is:** a private AI chat that runs entirely in the browser, with a
  small open model on the device's GPU (WebLLM over WebGPU). It is the first
  step toward a native iPhone app.
- **Run:** `npm start` (a static file server on port 8080), then open
  http://localhost:8080 in a browser with WebGPU
- **Test:** `npm test` (Node's built-in test runner, no dependencies). It must
  pass before a pull request is marked ready. CI runs it.
- **Merge method:** squash
- **Release:** merging to `main` publishes the site through GitHub Pages
  (https://jasonelias144-svg.github.io/Lyceum-Local/). Check afterwards that
  the page loads, and that a short chat works in a browser with WebGPU (P6).
- **Data:** none on any server. Conversations and downloaded models stay in the
  user's browser.

## Rules specific to this repository

- **Prior art first.** Before building, look at how others do it: WebLLM's own
  examples, WebLLM Chat, PocketPal AI, MLC Chat, Transformers.js, wllama.
  Borrow what works; say what is ours (P2).
- **Direction: an iPhone app.** Keep that path open:
  - iPhone Safari (iOS 26 and later) is the primary target. Test with a
    phone-sized viewport and an iPhone user agent, and say plainly what has not
    been tried on a real device.
  - Choose models that also ship for MLX (`mlx-community`) and llama.cpp (GGUF),
    so the native app can keep them.
  - Keep pure logic free of browser APIs (`js/models.js`, `js/chat.js`) and
    covered by tests; the tests are the spec a Swift port must match.
- **Free and private.** No server, no accounts, no analytics. Messages never
  leave the device. The only network traffic is downloading the app, the
  WebLLM engine and the model. Changing any of this is a founder decision (P5).
- **No build step.** Plain HTML, CSS and ES modules, served as static files.
  No npm dependencies at runtime; `npm test` uses only Node's built-in runner.
- **Honest about limits.** Small models are weak at facts and reasoning. The
  page and the README say so.
- **Models:** only builds that exist in the pinned WebLLM catalogue
  (`js/models.js`). Prefer Apache-2.0 or MIT models; if you add one with custom
  terms (Llama, Gemma), say so in the README. Never commit model files.
- **WebLLM version:** pinned in `js/webllm.js` and `sw.js` together (a test
  checks they match). When upgrading, re-check the model ids and the progress
  messages that `js/chat.js` parses.
- **Test before marking ready:** `npm test`, then load the page in a browser
  with WebGPU and run a short chat. Say what was and wasn't tested on a device.
- **Look:** Lyceum Commons' black, white and greys (tokens at the top of
  `css/app.css`), people on the left and the AI on the right.

## Always

- Say who made each change: `Made-by: <name> (AI|human)` in commits, and the
  "Made by" field in pull requests (P3).
- No secrets or personal data anywhere in the repository (P8).
- Report outcomes honestly: what you checked, and what you did not.
