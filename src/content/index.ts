import { observeComposeBoxes, extractPostText, replacePostText } from './observer';
import { injectRewriteUI, UIState } from './ui';
import { Tone, ExtensionMessage, ModelStatus } from '@shared/types';
import './styles.css';

// Track inline UI instances per compose box
const activeInstances = new Map<HTMLElement, ReturnType<typeof injectRewriteUI>>();

let modelStatus: ModelStatus = 'not_loaded';
let pendingRewrite: { composeBox: HTMLElement; tone: Tone } | null = null;

function init() {
  // Listen for messages from background
  chrome.runtime.onMessage.addListener((message: ExtensionMessage) => {
    handleMessage(message);
  });

  // Get initial model status
  chrome.runtime.sendMessage({ type: 'MODEL_STATUS' } as ExtensionMessage);

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
}

/**
 * Shared rewrite logic — used by both inline UI clicks and context menu.
 */
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
    chrome.runtime.sendMessage({ type: 'MODEL_LOAD_REQUEST' } as ExtensionMessage);
    return;
  }

  ui?.update({ type: 'loading' });
  chrome.runtime.sendMessage({
    type: 'REWRITE_REQUEST',
    text,
    tone,
  } as ExtensionMessage);
}

/**
 * Handle context menu rewrite — find the focused compose box and trigger rewrite.
 */
function handleContextMenuRewrite(tone: Tone) {
  // Find the compose box that contains the currently focused element
  const active = document.activeElement as HTMLElement | null;
  if (!active) return;

  for (const [composeBox] of activeInstances) {
    if (composeBox.contains(active)) {
      requestRewrite(composeBox, tone);
      return;
    }
  }

  // Fallback: try using the active element to get text directly
  const textbox = active.closest('[role="textbox"]') as HTMLElement;
  if (textbox) {
    const text = textbox.innerText?.trim();
    if (!text) return;

    if (modelStatus !== 'ready') {
      chrome.runtime.sendMessage({ type: 'MODEL_LOAD_REQUEST' } as ExtensionMessage);
      return;
    }

    chrome.runtime.sendMessage({
      type: 'REWRITE_REQUEST',
      text,
      tone,
    } as ExtensionMessage);
  }
}

function handleMessage(message: ExtensionMessage) {
  switch (message.type) {
    case 'CONTEXT_MENU_REWRITE':
      handleContextMenuRewrite(message.tone);
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

    case 'MODEL_STATUS':
      modelStatus = message.status;
      if (message.status === 'ready' && pendingRewrite) {
        const { composeBox, tone } = pendingRewrite;
        pendingRewrite = null;
        requestRewrite(composeBox, tone);
      } else {
        activeInstances.forEach((ui) => {
          if (message.status === 'ready') {
            ui.update({ type: 'idle' });
          } else if (message.status === 'no_webgpu') {
            ui.update({ type: 'error', message: 'WebGPU not supported. Use Chrome 113+.' });
          } else if (message.status === 'downloading' || message.status === 'loading') {
            ui.update({ type: 'model_loading', message: 'Loading AI model...' });
          }
        });
      }
      break;

    case 'MODEL_PROGRESS':
      activeInstances.forEach((ui) => {
        ui.update({
          type: 'model_loading',
          message: message.message || `Downloading model... ${Math.round(message.progress)}%`,
        });
      });
      break;
  }
}

init();
