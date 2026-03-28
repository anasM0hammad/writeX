import {
  ExtensionMessage,
  RewriteRequest,
  TONE_PRESETS,
} from '@shared/types';
import { MODEL_ID, SYSTEM_PROMPT, buildRewritePrompt } from '@shared/constants';

/**
 * Offscreen document script.
 * Connects to background via a port (no race conditions).
 * Handles WebLLM model loading and inference.
 */

let engine: any = null;
let isLoading = false;

// Connect to background immediately — this signals "worker is ready"
const port = chrome.runtime.connect({ name: 'offscreen-worker' });

// Listen for messages from background via port
port.onMessage.addListener((message: ExtensionMessage) => {
  switch (message.type) {
    case 'MODEL_LOAD_REQUEST':
      loadModel();
      break;
    case 'REWRITE_REQUEST':
      handleRewrite(message as RewriteRequest);
      break;
  }
});

function send(message: ExtensionMessage) {
  port.postMessage(message);
}

function sendStatus(status: string) {
  send({ type: 'MODEL_STATUS', status } as ExtensionMessage);
}

async function loadModel() {
  if (engine || isLoading) return;
  isLoading = true;

  try {
    sendStatus('downloading');

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

    sendStatus('ready');
  } catch (err: any) {
    console.error('[WriteX] Model load error:', err);

    if (err?.message?.includes('WebGPU')) {
      sendStatus('no_webgpu');
    } else {
      sendStatus('error');
      send({
        type: 'REWRITE_ERROR',
        error: `Failed to load AI model: ${err?.message || 'Unknown error'}`,
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
    console.error('[WriteX] Inference error:', err);
    send({
      type: 'REWRITE_ERROR',
      error: `Rewrite failed: ${err?.message || 'Unknown error'}`,
    } as ExtensionMessage);
  }
}
