import { observeComposeBoxes, extractPostText, replacePostText } from './observer';
import { injectRewriteUI } from './ui';
import { Tone, ExtensionMessage, ModelStatus } from '@shared/types';
import './styles.css';

// Track inline UI instances per compose box
const activeInstances = new Map<HTMLElement, ReturnType<typeof injectRewriteUI>>();

let modelStatus: ModelStatus = 'not_loaded';
let pendingRewrite: { composeBox: HTMLElement; tone: Tone } | null = null;
let worker: Worker | null = null;

function init() {
  // Listen for messages from background (context menu clicks, status queries)
  chrome.runtime.onMessage.addListener((message: ExtensionMessage) => {
    if (message.type === 'CONTEXT_MENU_REWRITE') {
      handleContextMenuRewrite(message.tone);
    }
  });

  // Observe for compose boxes and inject inline UI
  observeComposeBoxes((composeBox) => {
    if (activeInstances.has(composeBox)) return;

    const ui = injectRewriteUI(composeBox, {
      onRewrite: (tone: Tone) => requestRewrite(composeBox, tone),
      onReplace: (text: string) => {
        replacePostText(composeBox, text);
        ui.update({ type: 'idle' });
      },
      onRetry: (tone: Tone) => requestRewrite(composeBox, tone),
      onDismiss: () => ui.update({ type: 'idle' }),
    });

    activeInstances.set(composeBox, ui);

    if (modelStatus === 'downloading' || modelStatus === 'loading') {
      ui.update({ type: 'model_loading', message: 'AI model is loading...' });
    }
  });

  // Start loading the model proactively
  initWorkerAndLoadModel();
}

// --- Web Worker lifecycle ---

function initWorkerAndLoadModel() {
  if (worker) return;

  try {
    const workerUrl = chrome.runtime.getURL('worker.js');
    worker = new Worker(workerUrl, { type: 'module' });

    worker.onmessage = (e: MessageEvent) => {
      handleWorkerMessage(e.data);
    };

    worker.onerror = (e) => {
      console.error('[WriteX] Worker error:', e);
      setModelStatus('error');
    };

    // Tell worker to start loading the model
    worker.postMessage({ type: 'MODEL_LOAD_REQUEST' });
  } catch (err) {
    console.error('[WriteX] Failed to create worker:', err);
    setModelStatus('error');
  }
}

function handleWorkerMessage(message: any) {
  switch (message.type) {
    case 'MODEL_STATUS':
      setModelStatus(message.status);
      break;

    case 'MODEL_PROGRESS':
      // Update badge via background
      chrome.runtime.sendMessage({
        type: 'MODEL_PROGRESS',
        progress: message.progress,
        message: message.message,
      } as ExtensionMessage).catch(() => {});

      // Update inline UIs
      activeInstances.forEach((ui) => {
        ui.update({
          type: 'model_loading',
          message: message.message || `Downloading model... ${Math.round(message.progress)}%`,
        });
      });
      break;

    case 'REWRITE_RESPONSE':
      activeInstances.forEach((ui) => {
        ui.update({ type: 'result', text: message.rewritten });
      });
      break;

    case 'REWRITE_ERROR':
      activeInstances.forEach((ui) => {
        ui.update({ type: 'error', message: message.error });
      });
      break;
  }
}

function setModelStatus(status: ModelStatus) {
  modelStatus = status;

  // Notify background for badge updates
  chrome.runtime.sendMessage({
    type: 'MODEL_STATUS',
    status,
  } as ExtensionMessage).catch(() => {});

  if (status === 'ready' && pendingRewrite) {
    const { composeBox, tone } = pendingRewrite;
    pendingRewrite = null;
    requestRewrite(composeBox, tone);
    return;
  }

  activeInstances.forEach((ui) => {
    if (status === 'ready') {
      ui.update({ type: 'idle' });
    } else if (status === 'no_webgpu') {
      ui.update({ type: 'error', message: 'WebGPU not supported. Use Chrome 113+.' });
    } else if (status === 'downloading' || status === 'loading') {
      ui.update({ type: 'model_loading', message: 'Loading AI model...' });
    } else if (status === 'error') {
      ui.update({ type: 'error', message: 'Failed to load AI model.' });
    }
  });
}

// --- Rewrite logic ---

function requestRewrite(composeBox: HTMLElement, tone: Tone) {
  const ui = activeInstances.get(composeBox);
  const text = extractPostText(composeBox);

  if (!text) {
    ui?.update({ type: 'error', message: 'Write something first, then hit Rewrite.' });
    return;
  }

  if (modelStatus === 'no_webgpu') {
    ui?.update({ type: 'error', message: 'WebGPU is not supported. Please use Chrome 113+.' });
    return;
  }

  if (modelStatus !== 'ready') {
    pendingRewrite = { composeBox, tone };
    ui?.update({ type: 'model_loading', message: 'Loading AI model for first use...' });
    initWorkerAndLoadModel();
    return;
  }

  ui?.update({ type: 'loading' });
  worker?.postMessage({ type: 'REWRITE_REQUEST', text, tone });
}

function handleContextMenuRewrite(tone: Tone) {
  const active = document.activeElement as HTMLElement | null;
  if (!active) return;

  for (const [composeBox] of activeInstances) {
    if (composeBox.contains(active)) {
      requestRewrite(composeBox, tone);
      return;
    }
  }

  // Fallback: use active element directly
  const textbox = active.closest('[role="textbox"]') as HTMLElement;
  if (textbox) {
    const text = textbox.innerText?.trim();
    if (!text) return;

    if (modelStatus !== 'ready') {
      initWorkerAndLoadModel();
      return;
    }

    worker?.postMessage({ type: 'REWRITE_REQUEST', text, tone });
  }
}

init();
