# Chrome Web Store Listing — Write𝕏

---

## Extension Name
```
Write𝕏 — Enhance X Posts with AI
```

## Short Description (132 chars max)
```
Rewrite and enhance your X posts with local AI. Three tones: Improve, Viral, Short. 100% private — no data leaves your browser.
```

## Detailed Description
```
Write𝕏 is a free Chrome extension that rewrites your X (Twitter) posts using AI — entirely on your device.

Pick a tone, click Rewrite, and get a polished post in seconds. No accounts. No API keys. No cloud. Your words never leave your browser.

✦ HOW IT WORKS
1. Start writing a post on X
2. Choose a tone — Improve, Viral, or Short
3. Click Rewrite
4. Review the result, then Replace or Retry

✦ THREE TONES
✨ Improve — Cleaner, clearer, more engaging
🚀 Viral — Hook-driven, punchy, optimized for reach
✂️ Short — Same meaning, fewer words

✦ TWO WAYS TO USE
• Inline UI — Rewrite button appears right inside the compose box
• Right-click — Context menu "Enhance Post" with tone options

✦ 100% PRIVATE
Write𝕏 runs a real AI model (Phi-3.5) directly in your browser using WebGPU. Your posts are never sent to any server. No cloud APIs, no data collection, no telemetry. What you write stays with you.

✦ COMPLETELY FREE
No subscription. No credits. No API key required. The AI model downloads once on first use (~2 GB) and is cached locally in your browser.

✦ REQUIREMENTS
• Chrome 113 or later (WebGPU support required)
• ~2 GB free storage for the AI model (one-time download)
• A GPU is recommended for fast inference

✦ WORKS ON
• x.com
• twitter.com

Write𝕏 — Write better posts. Privately. For free.
```

## Category
```
Productivity
```

## Language
```
English
```

## Tags / Keywords
```
twitter, x, ai, writing, rewrite, enhance, post, privacy, local, webgpu, llm, free
```

---

## Website
```
https://github.com/anasM0hammad/writeX
```

## Support URL
```
https://github.com/anasM0hammad/writeX/issues
```

## Privacy Policy
```
Write𝕏 does not collect, transmit, or store any user data. All AI inference runs locally in the browser via WebGPU. No analytics, no telemetry, no third-party services. The only network request is the one-time AI model download from the public MLC model hub, cached locally after first use.
```

## Single Purpose Description (Chrome policy requirement)
```
Rewrites and enhances X (Twitter) posts using a locally-running AI model.
```

## Permissions Justification

| Permission      | Justification |
|-----------------|---------------|
| `storage`       | Cache model download status and user preferences locally. |
| `activeTab`     | Read and replace post text in the active X/Twitter compose box. |
| `offscreen`     | Run the AI model (WebLLM/WebGPU) in an offscreen document to avoid blocking the UI. |
| `contextMenus`  | Add "Enhance Post" right-click menu with tone options on X/Twitter. |
| Host: `x.com/*`, `twitter.com/*` | Inject the rewrite UI into X/Twitter compose boxes and read post text for rewriting. |

---

## Store Assets

### Icon (128x128)
Already specified in manifest — `public/icons/icon-128.png`

See existing prompts in CLAUDE.md for icon generation.

---

### Screenshot Prompts (1280x800 or 640x400, min 1, max 5)

**Screenshot 1 — Hero: Rewrite in action**
> Show the X compose box with "Just launched my side project" as original text, the WriteX trigger bar with Rewrite button + Improve/Viral/Short pills visible below it, and a result panel showing a polished rewritten version. Dark theme, X's actual UI around it.

**Screenshot 2 — Tone selection**
> Close-up of the WriteX trigger bar showing the three tone pills (✨ Improve active in blue, 🚀 Viral, ✂️ Short) with the blue Rewrite button. Dark background matching X.

**Screenshot 3 — Context menu**
> X compose box with right-click context menu open showing "Enhance Post" with submenu: ✨ Improve, 🚀 Viral, ✂️ Short. Dark theme.

**Screenshot 4 — Popup / Model status**
> The WriteX popup open showing "Write𝕏" header, WebGPU status (green checkmark), Model status (Ready, green badge), and the footer "Local AI. Private. Free forever." Dark theme.

**Screenshot 5 — Privacy callout**
> Split view: left side shows WriteX working on a post, right side shows a simple graphic with a lock icon and text "Your words never leave your browser. Zero cloud. Zero tracking." Dark theme.

---

### Small Promo Tile (440x280)

**Grok Prompt:**
```
Design a Chrome Web Store small promo tile (440x280px) for "WriteX", an AI writing extension for X/Twitter. Dark background (#000000 to #0a0a0a gradient). Center a stylized "W" logo with a subtle sparkle/AI glow effect in Twitter blue (#1d9bf0). Below it, clean white text: "Write𝕏" in bold, and a tagline "Enhance your posts with local AI" in light gray (#71767b). Minimalist, premium feel. No busy backgrounds. Flat design, no 3D. The overall vibe should match X's dark mode aesthetic.
```

**DALL-E Prompt:**
```
A sleek Chrome Web Store promotional tile, 440x280 pixels. Pure dark background, nearly black. In the center, a minimalist stylized letter "W" with a small sparkle star accent, rendered in Twitter blue (#1d9bf0) with a subtle blue glow. Below the logo, the text "WriteX" in clean white sans-serif font, and underneath in smaller light gray text "Enhance your posts with local AI". Flat vector style, no gradients on the logo, ultra-clean edges. Premium and minimal, matching Twitter/X dark mode design language.
```

**File path:** `store-assets/small-tile-440x280.png`

---

### Marquee Promo Tile (1400x560)

**Grok Prompt:**
```
Design a Chrome Web Store marquee promo tile (1400x560px) for "WriteX", a privacy-first AI Chrome extension that rewrites X/Twitter posts locally. Dark background (#000000) with a very subtle radial gradient of dark blue (#0a1628) in the center. Left side: large "Write𝕏" wordmark in white with the X in Twitter blue (#1d9bf0) and a small sparkle accent. Below it, tagline in light gray: "Rewrite. Enhance. Post." and a smaller line: "100% local AI. Your words never leave your browser." Right side: a minimal, floating mockup of X's dark compose box with the WriteX rewrite UI (blue Rewrite button, tone pills) — stylized, not a literal screenshot. Clean, editorial, magazine-ad quality. No clutter, no stock photos, no 3D renders.
```

**DALL-E Prompt:**
```
A wide premium Chrome Web Store marquee banner, 1400x560 pixels. Deep dark background, almost black, with a subtle dark blue radial glow in the center. On the left third, large bold white text "WriteX" with the X character in bright Twitter blue (#1d9bf0), accompanied by a tiny sparkle star. Below in smaller light gray sans-serif text: "Rewrite. Enhance. Post." and an even smaller line "100% local AI. Private. Free forever." On the right side, a stylized minimal floating dark card resembling a tweet compose box with a blue "Rewrite" pill button and three small tone labels. Everything is flat vector style, ultra-clean, no photos, no 3D, no busy elements. The aesthetic is premium, editorial, and matches Twitter/X dark mode perfectly. Ample negative space.
```

**File path:** `store-assets/marquee-tile-1400x560.png`

---

## Review Notes (for Chrome Web Store reviewers)
```
WriteX uses the "offscreen" permission to run a local AI model (Phi-3.5 via WebLLM/WebGPU) in an offscreen document. This is necessary because service workers do not have WebGPU access. The model runs entirely client-side — no external API calls are made for inference. The only network request is the initial model download from the public MLC AI model hub (huggingface.co), which is cached in browser storage after first use. The "wasm-unsafe-eval" CSP directive is required by WebLLM's WebAssembly runtime.
```
