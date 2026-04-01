import { EL_PREFIX } from '@shared/constants';
import { Tone, ToneConfig, TONE_PRESETS } from '@shared/types';

export interface RewriteUICallbacks {
  onRewrite: (tone: Tone) => void;
  onReplace: (text: string) => void;
  onRetry: (tone: Tone) => void;
  onDismiss: () => void;
}

export type UIState =
  | { type: 'idle' }
  | { type: 'loading' }
  | { type: 'result'; text: string }
  | { type: 'error'; message: string }
  | { type: 'model_loading'; message?: string };

/**
 * Injects the WriteX rewrite UI into a post compose container.
 */
export function injectRewriteUI(
  composeBox: HTMLElement,
  callbacks: RewriteUICallbacks
): { update: (state: UIState) => void; destroy: () => void } {
  const container = el('div', `${EL_PREFIX}-container`);

  // --- Trigger bar: rewrite button + tone pills ---
  const triggerBar = el('div', `${EL_PREFIX}-trigger-bar`);

  const rewriteBtn = el('button', `${EL_PREFIX}-btn-rewrite`);
  rewriteBtn.innerHTML = `<span class="${EL_PREFIX}-btn-icon">\u2728</span><span>Rewrite</span>`;

  const toneSelector = createToneSelector();

  triggerBar.appendChild(rewriteBtn);
  triggerBar.appendChild(toneSelector.element);
  container.appendChild(triggerBar);

  // --- Result panel (hidden by default) ---
  const resultPanel = el('div', `${EL_PREFIX}-result-panel`);
  resultPanel.style.display = 'none';

  const resultText = el('div', `${EL_PREFIX}-result-text`);
  const resultActions = el('div', `${EL_PREFIX}-result-actions`);

  const replaceBtn = el('button', `${EL_PREFIX}-btn ${EL_PREFIX}-btn-replace`);
  replaceBtn.textContent = 'Replace';

  const retryBtn = el('button', `${EL_PREFIX}-btn ${EL_PREFIX}-btn-retry`);
  retryBtn.textContent = 'Retry';

  const dismissBtn = el('button', `${EL_PREFIX}-btn ${EL_PREFIX}-btn-dismiss`);
  dismissBtn.innerHTML = '&times;';

  resultActions.appendChild(replaceBtn);
  resultActions.appendChild(retryBtn);
  resultActions.appendChild(dismissBtn);

  resultPanel.appendChild(resultText);
  resultPanel.appendChild(resultActions);
  container.appendChild(resultPanel);

  // --- Loader ---
  const loader = el('div', `${EL_PREFIX}-loader`);
  loader.style.display = 'none';
  loader.innerHTML = `
    <div class="${EL_PREFIX}-loader-spinner"></div>
    <span class="${EL_PREFIX}-loader-text">Rewriting...</span>
  `;
  container.appendChild(loader);

  // --- Events ---
  let currentRewrite = '';

  rewriteBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    callbacks.onRewrite(toneSelector.getSelected());
  });

  replaceBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (currentRewrite) callbacks.onReplace(currentRewrite);
  });

  retryBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    callbacks.onRetry(toneSelector.getSelected());
  });

  dismissBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    callbacks.onDismiss();
  });

  // --- Show/hide based on textbox content ---
  const textbox = composeBox.querySelector('[role="textbox"]') as HTMLElement | null;

  // Mount — insert directly after the textbox element.
  // This is the only reliable anchor point. Searching for toolbar via
  // querySelector on a large compose root finds the wrong one.
  if (textbox) {
    // Walk up from textbox to find the right insertion level —
    // the direct child of composeBox that contains the textbox
    let anchor: HTMLElement = textbox;
    while (anchor.parentElement && anchor.parentElement !== composeBox) {
      anchor = anchor.parentElement;
    }
    anchor.insertAdjacentElement('afterend', container);
  } else {
    composeBox.appendChild(container);
  }
  let hasText = !!(textbox && textbox.innerText?.trim());
  container.style.display = hasText ? '' : 'none';

  function checkTextVisibility() {
    const text = textbox?.innerText?.trim() ?? '';
    const nowHasText = text.length > 0;
    if (nowHasText !== hasText) {
      hasText = nowHasText;
      container.style.display = hasText ? '' : 'none';
    }
  }

  let textObserver: MutationObserver | null = null;
  if (textbox) {
    textbox.addEventListener('input', checkTextVisibility);
    textbox.addEventListener('focus', checkTextVisibility);
    // MutationObserver catches programmatic changes and paste
    textObserver = new MutationObserver(checkTextVisibility);
    textObserver.observe(textbox, { childList: true, subtree: true, characterData: true });
  }

  function update(state: UIState) {
    // Reset error class
    resultText.classList.remove(`${EL_PREFIX}-error`);

    switch (state.type) {
      case 'idle':
        triggerBar.style.display = 'flex';
        resultPanel.style.display = 'none';
        loader.style.display = 'none';
        rewriteBtn.removeAttribute('disabled');
        break;

      case 'loading':
        triggerBar.style.display = 'flex';
        resultPanel.style.display = 'none';
        loader.style.display = 'flex';
        setLoaderText('Rewriting...');
        rewriteBtn.setAttribute('disabled', 'true');
        break;

      case 'result':
        triggerBar.style.display = 'flex';
        loader.style.display = 'none';
        resultPanel.style.display = 'block';
        resultText.textContent = state.text;
        currentRewrite = state.text;
        rewriteBtn.removeAttribute('disabled');
        break;

      case 'error':
        triggerBar.style.display = 'flex';
        loader.style.display = 'none';
        resultPanel.style.display = 'block';
        resultText.textContent = state.message;
        resultText.classList.add(`${EL_PREFIX}-error`);
        currentRewrite = '';
        rewriteBtn.removeAttribute('disabled');
        break;

      case 'model_loading':
        triggerBar.style.display = 'flex';
        resultPanel.style.display = 'none';
        loader.style.display = 'flex';
        setLoaderText(state.message || 'Loading AI model...');
        rewriteBtn.setAttribute('disabled', 'true');
        break;
    }
  }

  function setLoaderText(text: string) {
    const span = loader.querySelector(`.${EL_PREFIX}-loader-text`);
    if (span) span.textContent = text;
  }

  function destroy() {
    textObserver?.disconnect();
    if (textbox) {
      textbox.removeEventListener('input', checkTextVisibility);
      textbox.removeEventListener('focus', checkTextVisibility);
    }
    container.remove();
  }

  return { update, destroy };
}

// --- Tone selector ---
function createToneSelector(): { element: HTMLElement; getSelected: () => Tone } {
  let selected: Tone = 'improve';
  const wrapper = el('div', `${EL_PREFIX}-tone-selector`);

  TONE_PRESETS.forEach((preset: ToneConfig) => {
    const btn = el('button', `${EL_PREFIX}-tone-btn`);
    btn.setAttribute('data-tone', preset.id);
    btn.textContent = `${preset.emoji} ${preset.label}`;
    if (preset.id === selected) btn.classList.add(`${EL_PREFIX}-tone-active`);

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      selected = preset.id;
      wrapper.querySelectorAll(`.${EL_PREFIX}-tone-btn`).forEach((b) => {
        b.classList.toggle(`${EL_PREFIX}-tone-active`, b.getAttribute('data-tone') === selected);
      });
    });

    wrapper.appendChild(btn);
  });

  return { element: wrapper, getSelected: () => selected };
}

function el(tag: string, className: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}
