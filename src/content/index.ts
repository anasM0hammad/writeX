import { observeTweetBoxes, extractTweetText, replaceTweetText } from './observer';
import { injectRewriteUI, UIState } from './ui';
import { Tone, TONE_PRESETS, ExtensionMessage, ModelStatus } from '@shared/types';
import './styles.css';

// Track active UI instances per compose box
const activeInstances = new Map<HTMLElement, ReturnType<typeof injectRewriteUI>>();

// Current model status
let modelStatus: ModelStatus = 'not_loaded';

/**
 * Initialize the content script.
 * Sets up DOM observation and message handling.
 */
function init() {
  // Listen for messages from background/worker
  chrome.runtime.onMessage.addListener((message: ExtensionMessage) => {
    handleBackgroundMessage(message);
  });

  // Check initial model status
  chrome.runtime.sendMessage({ type: 'MODEL_STATUS' } as ExtensionMessage);

  // Start observing for tweet compose boxes
  observeTweetBoxes((composeBox) => {
    if (activeInstances.has(composeBox)) return;

    const ui = injectRewriteUI(composeBox, {
      onRewrite: (tone: Tone) => handleRewrite(composeBox, tone),
      onReplace: (text: string) => handleReplace(composeBox, text),
      onRetry: (tone: Tone) => handleRewrite(composeBox, tone),
      onDismiss: () => handleDismiss(composeBox),
    });

    activeInstances.set(composeBox, ui);

    // If model isn't ready, show status
    if (modelStatus === 'not_loaded') {
      ui.update({ type: 'idle' });
    } else if (modelStatus === 'downloading' || modelStatus === 'loading') {
      ui.update({ type: 'model_loading', message: 'AI model is loading...' });
    }
  });
}

/**
 * Handle rewrite request from UI
 */
async function handleRewrite(composeBox: HTMLElement, tone: Tone) {
  const ui = activeInstances.get(composeBox);
  if (!ui) return;

  const text = extractTweetText(composeBox);
  if (!text) {
    ui.update({ type: 'error', message: 'Write something first, then hit Rewrite.' });
    return;
  }

  if (modelStatus === 'no_webgpu') {
    ui.update({
      type: 'error',
      message: 'WebGPU is not supported in your browser. Please use Chrome 113+.',
    });
    return;
  }

  if (modelStatus !== 'ready') {
    // Trigger model load and queue the rewrite
    ui.update({ type: 'model_loading', message: 'Loading AI model for first use...' });
    chrome.runtime.sendMessage({ type: 'MODEL_LOAD_REQUEST' } as ExtensionMessage);
    // Store pending rewrite
    composeBox.setAttribute('data-writex-pending-tone', tone);
    return;
  }

  // Model is ready, do the rewrite
  ui.update({ type: 'loading' });

  chrome.runtime.sendMessage({
    type: 'REWRITE_REQUEST',
    text,
    tone,
  } as ExtensionMessage);
}

/**
 * Handle replace action
 */
function handleReplace(composeBox: HTMLElement, text: string) {
  replaceTweetText(composeBox, text);
  const ui = activeInstances.get(composeBox);
  if (ui) {
    ui.update({ type: 'idle' });
  }
}

/**
 * Handle dismiss action
 */
function handleDismiss(composeBox: HTMLElement) {
  const ui = activeInstances.get(composeBox);
  if (ui) {
    ui.update({ type: 'idle' });
  }
}

/**
 * Handle messages from background script
 */
function handleBackgroundMessage(message: ExtensionMessage) {
  switch (message.type) {
    case 'REWRITE_RESPONSE': {
      // Update all active UIs with the result
      activeInstances.forEach((ui) => {
        ui.update({ type: 'result', text: message.rewritten });
      });
      break;
    }

    case 'REWRITE_ERROR': {
      activeInstances.forEach((ui) => {
        ui.update({ type: 'error', message: message.error });
      });
      break;
    }

    case 'MODEL_STATUS': {
      modelStatus = message.status;
      activeInstances.forEach((ui, composeBox) => {
        if (message.status === 'ready') {
          // Check if there's a pending rewrite
          const pendingTone = composeBox.getAttribute('data-writex-pending-tone') as Tone | null;
          if (pendingTone) {
            composeBox.removeAttribute('data-writex-pending-tone');
            handleRewrite(composeBox, pendingTone);
          } else {
            ui.update({ type: 'idle' });
          }
        } else if (message.status === 'no_webgpu') {
          ui.update({
            type: 'error',
            message: 'WebGPU not supported. Please use Chrome 113+ with WebGPU enabled.',
          });
        } else if (message.status === 'downloading' || message.status === 'loading') {
          ui.update({ type: 'model_loading', message: 'Loading AI model...' });
        }
      });
      break;
    }

    case 'MODEL_PROGRESS': {
      activeInstances.forEach((ui) => {
        ui.update({
          type: 'model_loading',
          message: message.message || `Downloading model... ${Math.round(message.progress)}%`,
        });
      });
      break;
    }
  }
}

// Boot
init();
