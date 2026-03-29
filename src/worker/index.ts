import {
  TONE_PRESETS,
} from '@shared/types';
import { MODEL_ID, SYSTEM_PROMPT, buildRewritePrompt } from '@shared/constants';

/**
 * Web Worker for WebLLM inference.
 * Runs in the content script's page context (has WebGPU access).
 * Communicates with content script via postMessage.
 */

let engine: any = null;
let isLoading = false;

self.onmessage = (e: MessageEvent) => {
  const { type } = e.data;

  switch (type) {
    case 'MODEL_LOAD_REQUEST':
      loadModel();
      break;
    case 'REWRITE_REQUEST':
      handleRewrite(e.data);
      break;
  }
};

function send(message: any) {
  self.postMessage(message);
}

async function loadModel() {
  if (engine || isLoading) return;
  isLoading = true;

  try {
    send({ type: 'MODEL_STATUS', status: 'downloading' });

    const webllm = await import('@mlc-ai/web-llm');

    engine = await webllm.CreateMLCEngine(MODEL_ID, {
      initProgressCallback: (report: any) => {
        const progress = report.progress ?? 0;
        const text = report.text ?? 'Loading model...';

        send({
          type: 'MODEL_PROGRESS',
          progress: progress * 100,
          message: text,
        });
      },
    });

    send({ type: 'MODEL_STATUS', status: 'ready' });
  } catch (err: any) {
    console.error('[WriteX Worker] Model load error:', err);

    if (err?.message?.includes('WebGPU') || err?.message?.includes('gpu')) {
      send({ type: 'MODEL_STATUS', status: 'no_webgpu' });
    } else {
      send({ type: 'MODEL_STATUS', status: 'error' });
      send({
        type: 'REWRITE_ERROR',
        error: `Failed to load AI model: ${err?.message || 'Unknown error'}`,
      });
    }
  } finally {
    isLoading = false;
  }
}

async function handleRewrite(request: { text: string; tone: string }) {
  if (!engine) {
    send({
      type: 'REWRITE_ERROR',
      error: 'AI model is not loaded yet. Please wait.',
    });
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
      });
      return;
    }

    const cleaned = rewritten.replace(/^["']|["']$/g, '');

    send({
      type: 'REWRITE_RESPONSE',
      original: request.text,
      rewritten: cleaned,
      tone: request.tone,
    });
  } catch (err: any) {
    console.error('[WriteX Worker] Inference error:', err);
    send({
      type: 'REWRITE_ERROR',
      error: `Rewrite failed: ${err?.message || 'Unknown error'}`,
    });
  }
}
