import { Tone, ExtensionMessage, ModelStatus } from '@shared/types';

let modelStatus: ModelStatus = 'not_loaded';

function init() {
  chrome.runtime.onMessage.addListener((message: ExtensionMessage) => {
    switch (message.type) {
      case 'CONTEXT_MENU_REWRITE':
        handleContextMenuRewrite(message.tone);
        break;

      case 'REWRITE_RESPONSE':
        replaceActiveText(message.rewritten);
        break;

      case 'REWRITE_ERROR':
        console.warn('[WriteX]', message.error);
        break;

      case 'MODEL_STATUS':
        modelStatus = message.status;
        // If model just became ready and we have a pending rewrite, fire it
        if (message.status === 'ready' && pendingRewrite) {
          const { text, tone } = pendingRewrite;
          pendingRewrite = null;
          sendRewriteRequest(text, tone);
        }
        break;
    }
  });

  // Get initial model status
  chrome.runtime.sendMessage({ type: 'MODEL_STATUS' } as ExtensionMessage);
}

let pendingRewrite: { text: string; tone: Tone } | null = null;

function handleContextMenuRewrite(tone: Tone) {
  const text = getActiveEditableText();
  if (!text) return;

  if (modelStatus !== 'ready') {
    // Queue the rewrite and trigger model load
    pendingRewrite = { text, tone };
    chrome.runtime.sendMessage({ type: 'MODEL_LOAD_REQUEST' } as ExtensionMessage);
    return;
  }

  sendRewriteRequest(text, tone);
}

function sendRewriteRequest(text: string, tone: Tone) {
  chrome.runtime.sendMessage({
    type: 'REWRITE_REQUEST',
    text,
    tone,
  } as ExtensionMessage);
}

function getActiveEditableText(): string {
  const active = document.activeElement;
  if (!active) return '';

  // X uses contenteditable divs with role="textbox"
  const textbox = active.closest('[role="textbox"]') as HTMLElement
    ?? (active.querySelector('[role="textbox"]') as HTMLElement);

  if (textbox) {
    return textbox.innerText?.trim() ?? '';
  }

  // Fallback: standard textarea/input
  if (active instanceof HTMLTextAreaElement || active instanceof HTMLInputElement) {
    return active.value.trim();
  }

  return '';
}

function replaceActiveText(newText: string) {
  const active = document.activeElement;
  if (!active) return;

  const textbox = active.closest('[role="textbox"]') as HTMLElement
    ?? (active.querySelector('[role="textbox"]') as HTMLElement);

  if (textbox) {
    textbox.focus();

    // Select all existing text
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(textbox);
    selection?.removeAllRanges();
    selection?.addRange(range);

    // Use insertText to work with X's React-managed state
    document.execCommand('insertText', false, newText);
    textbox.dispatchEvent(new Event('input', { bubbles: true }));
    return;
  }

  // Fallback: standard textarea/input
  if (active instanceof HTMLTextAreaElement || active instanceof HTMLInputElement) {
    active.value = newText;
    active.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

init();
