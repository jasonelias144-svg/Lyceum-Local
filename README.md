# Lyceum Local

**A private AI that runs entirely on your own device.** A small open-source language model runs inside your web browser, on your phone's or computer's GPU. There is no server, no account and no cost, and what you write never leaves the device.

It is a sibling of [Lyceum Commons](https://lyceum-commons-production.up.railway.app). The Commons is a shared place where people and AIs from different companies work on questions together. Local is a personal tool that lives on your own device.

**Status:** milestone 1, a working chat. Once GitHub Pages is switched on (see [Hosting](#hosting-on-github-pages-free)), it runs at **https://jasonelias144-svg.github.io/Lyceum-Local/**.

**Direction: an iPhone app.** The web app is the first step toward a native iPhone app ([the path](#where-this-is-going-an-iphone-app)). It costs nothing to build or try, and it answers what an app needs to know first: which models fit in a phone's memory, how fast they run, and what people use them for.

## What it is good for, and what it is not

A small model is far weaker than Claude, Grok or ChatGPT. Choose tasks to match.

| Good at | Weak at |
|---|---|
| Summarizing and rewriting text you paste in | Deep reasoning and long chains of logic |
| Translating short passages | Facts: it makes things up, confidently |
| Brainstorming, lists, first drafts | Recent events: it knows nothing after its training |
| Simple questions and explanations | Long documents: it holds about 1,500 words at once on a phone |
| Working **offline** and **privately** | Links and quotes: it invents them |

Check anything that matters.

## How it works

```
Your browser (phone or computer)
 ├─ the app: index.html, css/, js/           from GitHub Pages; kept offline by sw.js
 ├─ WebLLM 0.2.85: the engine                 from jsDelivr; runs the model on the GPU (WebGPU)
 └─ the model: 0.2–1.1 GB, downloaded once    from Hugging Face; stored in the browser
```

1. **Checks the device.** It needs WebGPU. If the GPU supports half precision (`shader-f16`), the app uses the faster f16 build of the model ("fast mode"); otherwise the f32 build ("compatibility mode").
2. **Downloads the model once.** WebLLM keeps it in the browser's storage, so later visits load it from the device in seconds, even offline.
3. **Runs it in the background.** The model runs in a Web Worker where the browser allows, so the page stays responsive, or on the page itself where it doesn't. Replies stream in as they are written; ■ stops one.
4. **Keeps the conversation on the device.** The last 60 messages are saved in this browser only. When a chat grows longer than the model can hold, it sees only the most recent part, and the app says so.

## Privacy

- **Your messages never leave the device.** No server receives them; there are no accounts and no analytics.
- **What the network sees:** the downloads of the app (GitHub Pages), the WebLLM engine (jsDelivr), and the model and its code (Hugging Face and raw.githubusercontent.com). Those services see your IP address when you download, as any website does. Nothing is sent after that.
- **Deleting:** "New chat" (＋) clears the conversation. Each downloaded model has a Delete link on the setup screen. Clearing this site's data in your browser removes everything.

## Requirements

- **iPhone and iPad:** Safari on **iOS 26 or later**, the first version with WebGPU. Update under Settings → General → Software Update.
- **Android:** a recent Chrome on Android 12 or later.
- **Computers:** a recent Chrome or Edge, or Safari 26 on a Mac. Firefox has WebGPU on Windows, and other systems are following.
- **Storage:** 0.2–1.1 GB free, depending on the model.
- **Memory:** see the table below. Phones are the likeliest to run short; if a model doesn't fit, the app offers a smaller one.

## Models

All three are **Apache-2.0**, so licensing stays simple. Builds are 4-bit versions by the MLC project (the `mlc-ai` organization on Hugging Face).

| Model | Download | Memory, up to | Maker | Best for |
|---|---:|---:|---|---|
| SmolLM2 360M | 207 MB | 0.4–0.6 GB | Hugging Face | Older phones; short answers and simple rewrites |
| **Qwen3.5 0.8B** (default) | 447 MB | 1.6–1.9 GB | Qwen (Alibaba), Feb 2026 | Phones: the best balance of size and quality |
| Qwen3.5 2B | 1.1 GB | 2.2–2.6 GB | Qwen (Alibaba), Feb 2026 | Recent phones and computers: noticeably smarter |

- **Memory:** "Up to" is WebLLM's estimate at a 4,096-token context (the lower figure is fast mode, the higher is compatibility mode). On phones the app loads models with a 2,048-token context, which needs less.
- **Think first:** the Qwen models can reason step by step before answering. It's better on tricky questions and slower. The reasoning is shown folded above the answer.
- **Other models:** WebLLM offers others, including Llama 3.2, Gemma 3 and Phi. They can be added in `js/models.js`. Note that Llama and Gemma come with their own license terms rather than a standard open license.

## Limits, honestly

- **Quality:** see the table at the top. These models are small by design, so they fit on a phone.
- **First download:** 0.2–1.1 GB. Use Wi-Fi. If it's interrupted, the parts already downloaded are kept.
- **iPhone storage:** Safari can clear a website's stored data after about a week without a visit. **Add the page to your Home Screen** (Share → Add to Home Screen): Home Screen apps keep their data.
- **Speed:** depends on the device. Each reply shows its measured speed in tokens per second (a token is about three quarters of a word).
- **Not yet tested on a real iPhone.** It has been tested in desktop Chromium, with the GPU emulated in software. Real-device results will shape the next step toward the app.

## Run it yourself

No build step and no dependencies:

```sh
git clone https://github.com/jasonelias144-svg/Lyceum-Local
cd Lyceum-Local
python3 -m http.server 8080   # or any static file server
# open http://localhost:8080
```

`localhost` counts as a secure context, which WebGPU requires. From another device, serve it over HTTPS.

`npm test` runs the unit tests (Node 20 or later). They cover the model choice, the device check, how much history fits, reading the model's thinking, safe formatting of replies, progress and error wording, and the offline file list.

## Hosting on GitHub Pages (free)

On GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main`, folder `/ (root)` → Save.** After a minute or two, the app is at https://jasonelias144-svg.github.io/Lyceum-Local/. Pages serves over HTTPS, as WebGPU requires. Every merge to `main` updates the site.

Free Pages hosting needs a public repository.

## Files

| Path | What it does |
|---|---|
| `index.html`, `css/app.css` | The page: setup screen and full-screen chat, in Lyceum's black-and-grey look |
| `js/app.js` | The controller: device check, model choice, download progress, chat |
| `js/engine.js`, `js/worker.js` | WebLLM: load in a worker (or the page), stream replies, stop, delete downloads |
| `js/webllm.js` | The one place WebLLM's pinned version is imported |
| `js/models.js` | The models on offer, and which build to use |
| `js/device.js` | WebGPU and half-precision check; plain-language guidance when unsupported |
| `js/chat.js` | Pure helpers: history that fits, thinking vs. answer, safe Markdown, progress and error wording |
| `sw.js`, `manifest.webmanifest`, `img/` | Offline app shell, Home Screen app, icons |
| `test/` | Unit tests (`npm test`) |

## Where this is going: an iPhone app

The goal is a native iPhone app. Each step below ships something usable and teaches the next.

1. **Web app (done).** Runs in Safari on iOS 26+. Add it to the Home Screen for an app icon, full screen and offline use.
2. **Real iPhones.** Measure memory, speed and answer quality on actual devices, and set the default model and context from that.
3. **The same app in an App Store shell.** Wrap this web app in a native iPhone shell such as Capacitor, which uses the iPhone's own WebKit, and ship it through TestFlight and the App Store.
   - Apple says WebGPU is on by default in iOS 26 for apps' web views too, not only Safari. To be checked on a device.
   - GitHub's free macOS build machines can build the app, so no Mac is needed.
   - TestFlight and the App Store need an Apple Developer account ($99 a year).
4. **A native engine.** Swap the browser engine for one built for the iPhone: MLX Swift (Apple's open-source framework) or llama.cpp. That brings more speed, more memory headroom and background downloads. Optionally, Apple's built-in Foundation Models as a no-download choice on newer iPhones.
5. **Then features:** Lyceum helpers (read a Lyceum Commons room through its public API, then summarize it, draft a reply or translate it), and voice with several models working together: speech-to-text (Whisper), then the language model, then speech (Kokoro or Piper), all on the device.

**Choices made now to keep that path open:**
- **The models travel.** All three have builds for MLX (`mlx-community`) and llama.cpp (GGUF) as well as for the browser, so the native app can keep the same models.
- **The logic travels.** The pure parts (`js/models.js`, `js/chat.js`, most of `js/device.js`) use no browser APIs, and their tests describe the behavior a Swift version must match.
- **The interface is already iPhone-shaped:** full screen, composer above the keyboard, safe areas, and Home Screen install.

## Prior art

- **[WebLLM](https://github.com/mlc-ai/web-llm) and WebLLM Chat** (MLC): the engine this app uses, and its own demo chat.
- **MLC Chat, [PocketPal AI](https://github.com/a-ghorbani/pocketpal-ai), Google AI Edge Gallery:** native phone apps that run small models on the device.
- **llama.cpp, Transformers.js, wllama:** other ways to run models locally. wllama runs llama.cpp in WebAssembly on the CPU, a possible fallback for browsers without WebGPU.
- **Apple's Foundation Models framework and Google's Gemini Nano:** models built into the phone, free to use, but not open.
- **For the iPhone app:** [MLX Swift](https://github.com/ml-explore/mlx-swift) (Apple), llama.cpp's Swift package, and Capacitor (web apps in a native shell).

What this app adds: a plain, free, no-account web app in the Lyceum family, honest about its limits, with a path to helping in Lyceum rooms.

## License

The code is under the MIT license (see `LICENSE`). The models are not part of this repository. They are downloaded from their publishers' builds under their own licenses: Apache-2.0 for all three offered here.
