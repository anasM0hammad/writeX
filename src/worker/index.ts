import {
  ExtensionMessage,
  RewriteRequest,
  TONE_PRESETS,
} from '@shared/types';
import { MODEL_ID, SYSTEM_PROMPT, buildRewritePrompt } from '@shared/constants';

/**
 * Offscreen document script.
 * Runs inside offscreen.html which has full DOM + WebGPU access.
 * Connects to background via port. Reconnects if service worker restarts.
 */

let engine: any = null;
let isLoading = false;
let port: chrome.runtime.Port | null = null;

function connectPort() {
  port = chrome.runtime.connect({ name: 'offscreen-worker' });

  port.onMessage.addListener((message: ExtensionMessage) => {
    switch (message.type) {
      case 'MODEL_LOAD_REQUEST':
        loadModel();
        break;
      case 'REWRITE_REQUEST':
        handleRewrite(message as RewriteRequest);
        break;
      case 'MODEL_STATUS_CHECK':
        // Background is asking if model is already loaded
        if (engine) {
          send({ type: 'MODEL_STATUS', status: 'ready' } as ExtensionMessage);
        }
        break;
    }
  });

  port.onDisconnect.addListener(() => {
    port = null;
    // Service worker died — reconnect after a short delay
    setTimeout(connectPort, 500);
  });

  // If model is already loaded, notify the new background immediately
  if (engine) {
    send({ type: 'MODEL_STATUS', status: 'ready' } as ExtensionMessage);
  }
}

connectPort();

function send(message: ExtensionMessage) {
  try {
    port?.postMessage(message);
  } catch (err) {
    console.error('[WriteX Worker] Failed to send message:', err);
  }
}

async function loadModel() {
  if (engine || isLoading) return;
  isLoading = true;

  try {
    send({ type: 'MODEL_STATUS', status: 'downloading' } as ExtensionMessage);

    const webllm = await import('@mlc-ai/web-llm');

    engine = await webllm.CreateMLCEngine(MODEL_ID, {
      initProgressCallback: (report: any) => {
        const progress = report.progress ?? 0;
        const text = report.text ?? 'Loading model...';

        send({
          type: 'MODEL_PROGRESS',
          progress: progress * 100,
          message: text,
        } as ExtensionMessage);
      },
    });

    send({ type: 'MODEL_STATUS', status: 'ready' } as ExtensionMessage);
  } catch (err: any) {
    console.error('[WriteX Worker] Model load error:', err);

    const msg = err?.message || String(err);
    if (msg.toLowerCase().includes('webgpu') || msg.toLowerCase().includes('gpu')) {
      send({ type: 'MODEL_STATUS', status: 'no_webgpu' } as ExtensionMessage);
    } else {
      send({ type: 'MODEL_STATUS', status: 'error' } as ExtensionMessage);
      send({
        type: 'REWRITE_ERROR',
        error: `Failed to load AI model: ${msg}`,
      } as ExtensionMessage);
    }
  } finally {
    isLoading = false;
  }
}

async function handleRewrite(request: RewriteRequest) {
  if (!engine) {
    send({
      type: 'REWRITE_ERROR',
      error: 'AI model is not loaded yet. Please wait.',
    } as ExtensionMessage);
    return;
  }

  try {
    const toneConfig = TONE_PRESETS.find((t) => t.id === request.tone);
    if (!toneConfig) return;

    const userPrompt = buildRewritePrompt(request.text, toneConfig.prompt);

    const response = await engine.chat.completions.create({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 150,
      temperature: 0.7,
      top_p: 0.9,
    });

    const rewritten = response.choices?.[0]?.message?.content?.trim() ?? '';

    if (!rewritten) {
      send({
        type: 'REWRITE_ERROR',
        error: 'AI returned an empty response. Try again.',
      } as ExtensionMessage);
      return;
    }

    const cleaned = rewritten.replace(/^["']|["']$/g, '');

    send({
      type: 'REWRITE_RESPONSE',
      original: request.text,
      rewritten: cleaned,
      tone: request.tone,
    } as ExtensionMessage);
  } catch (err: any) {
    console.error('[WriteX Worker] Inference error:', err);
    send({
      type: 'REWRITE_ERROR',
      error: `Rewrite failed: ${err?.message || 'Unknown error'}`,
    } as ExtensionMessage);
  }
}
