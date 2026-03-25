# WriteX - Chrome Extension for AI Tweet Rewriting

## Project Overview
WriteX is a Chrome extension that rewrites tweets directly inside X (twitter.com / x.com) using local AI inference via WebLLM + Phi-2. Privacy-first, free, no cloud dependency.

## Tech Stack
- TypeScript (strict mode)
- Manifest V3 Chrome Extension
- WebLLM with Phi-2 (quantized) for local inference
- Webpack for bundling
- Vanilla CSS (no frameworks)

## Architecture
- `src/content/` — Content script: MutationObserver-based UI injection, text capture, DOM manipulation
- `src/background/` — Service worker: message routing, lifecycle management
- `src/worker/` — Web worker: WebLLM inference (off main thread, fully async)
- `src/popup/` — Extension popup: onboarding, model status, WebGPU check
- `src/shared/` — Shared types, constants, utilities

## Design Principles
- **Premium & Minimalist UI** — Clean, smooth, silk-like experience. UI/UX is the top priority.
- **Async-first architecture** — Local LLM inference is heavy; every interaction must be non-blocking.
- **Performance** — Async model loading, cached in browser storage, progressive download on install.
- **Privacy-first** — All inference runs locally. No data leaves the browser.

## MVP 1 Scope
- 3 tone presets: Improve, Viral, Short
- Inline rewrite button near tweet box
- Simple rewrite preview with Replace/Retry (no diff view)
- MutationObserver-based DOM detection (no hardcoded selectors)
- WebLLM + Phi-2 local inference
- Popup with onboarding + model download status
- Graceful WebGPU fallback messaging

## Guidelines
- For any asset/icon/image requirement: provide Grok and DALL-E prompts with the file path to place the asset in, rather than generating placeholder images.
- Keep the UI premium and minimalistic. Every pixel matters.
- All inference and heavy computation must run in Web Workers — never block the main thread.
- Use MutationObserver for DOM detection — never rely on hardcoded X/Twitter selectors alone.
