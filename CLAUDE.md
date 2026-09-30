# Working rules for Lyceum Local

## 1. Prior art first

Before designing or building anything, ask how others already do it: WebLLM's own examples,
WebLLM Chat, PocketPal AI, MLC Chat, Transformers.js, wllama. Borrow what works; say what is ours.

## 2. Direction: an iPhone app

The goal is a native iPhone app; this web app is step one (README, "Where this is going"). Every
change should keep that path open:

- **iPhone Safari (iOS 26+) is the primary target.** Test with a phone-sized viewport and an iPhone
  user agent, and say plainly what has not been tried on a real device.
- **Models:** choose ones that also ship for MLX (`mlx-community`) and llama.cpp (GGUF), so the
  native app can keep them.
- **Logic:** keep pure logic free of browser APIs (`js/models.js`, `js/chat.js`) and covered by
  tests; the tests are the spec a Swift port must match.

## 3. The rest

- **Free and private.** No server, no accounts, no analytics. Messages never leave the device.
  The only network traffic is downloading the app, the WebLLM engine and the model.
- **No build step.** Plain HTML, CSS and ES modules, served as static files (GitHub Pages).
  No npm dependencies at runtime; `npm test` uses only Node's built-in test runner.
- **Honest about limits.** Small models are weak at facts and reasoning. The page and README say so.
- **Models:** only builds that exist in the pinned WebLLM catalog (`js/models.js`). Prefer
  Apache-2.0 or MIT models; if you add one with custom terms (Llama, Gemma), say so in the README.
  Never commit model files.
- **WebLLM version:** pinned in `js/webllm.js` and `sw.js` together (a test checks they match).
  When upgrading, re-check the model ids and progress messages (`js/chat.js` parses them).
- **Test before pushing:** `npm test`, then load the page in a browser with WebGPU and run a
  short chat. Phones are the real target: say what was and wasn't tested on a device.
- **Look:** Lyceum Commons' black, white and greys (tokens at the top of `css/app.css`), people on
  the left and the AI on the right.
