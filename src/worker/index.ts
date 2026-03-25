import {
  ExtensionMessage,
  RewriteRequest,
  TONE_PRESETS,
} from '@shared/types';
import { MODEL_ID, SYSTEM_PROMPT, buildRewritePrompt } from '@shared/constants';

/**
 * Offscreen document script.
 * Handles WebLLM model loading and inference.
 * Runs in an offscreen document to avoid blocking the service worker.
 */

let engine: any = null;
let isLoading = false;

// Listen for messages from background
chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, _sender, _sendResponse) => {
    switch (message.type) {
      case 'MODEL_LOAD_REQUEST':
        loadModel();
        break;
      case 'REWRITE_REQUEST':
        handleRewrite(message as RewriteRequest);
        break;
    }
  }
);

/**
 * Load the WebLLM model with progress reporting.
 */
async function loadModel() {
  if (engine || isLoading) return;
  isLoading = true;

  try {
    sendStatus('downloading');

    // Dynamic import to keep initial bundle small
    const webllm = await import('@mlc-ai/web-llm');

    engine = await webllm.CreateMLCEngine(MODEL_ID, {
      initProgressCallback: (report: any) => {
        const progress = report.progress ?? 0;
        const text = report.text ?? 'Loading model...';

        chrome.runtime.sendMessage({
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
      chrome.runtime.sendMessage({
        type: 'REWRITE_ERROR',
        error: `Failed to load AI model: ${err?.message || 'Unknown error'}`,
      } as ExtensionMessage);
    }
  } finally {
    isLoading = false;
  }
}

/**
 * Run inference to rewrite a tweet.
 */
async function handleRewrite(request: RewriteRequest) {
  if (!engine) {
    chrome.runtime.sendMessage({
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
      chrome.runtime.sendMessage({
        type: 'REWRITE_ERROR',
        error: 'AI returned an empty response. Try again.',
      } as ExtensionMessage);
      return;
    }

    // Clean up any quotes the model might add
    const cleaned = rewritten.replace(/^["']|["']$/g, '');

    chrome.runtime.sendMessage({
      type: 'REWRITE_RESPONSE',
      original: request.text,
      rewritten: cleaned,
      tone: request.tone,
    } as ExtensionMessage);
  } catch (err: any) {
    console.error('[WriteX] Inference error:', err);
    chrome.runtime.sendMessage({
      type: 'REWRITE_ERROR',
      error: `Rewrite failed: ${err?.message || 'Unknown error'}`,
    } as ExtensionMessage);
  }
}

function sendStatus(status: ExtensionMessage['type'] extends 'MODEL_STATUS' ? any : any) {
  chrome.runtime.sendMessage({
    type: 'MODEL_STATUS',
    status,
  } as ExtensionMessage);
}
