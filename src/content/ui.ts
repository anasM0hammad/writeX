import { EL_PREFIX } from '@shared/constants';
import { Tone, ToneConfig, TONE_PRESETS } from '@shared/types';

export interface RewriteUICallbacks {
  onRewrite: (tone: Tone) => void;
  onReplace: (text: string) => void;
  onRetry: (tone: Tone) => void;
  onDismiss: () => void;
}

/**
 * Injects the WriteX rewrite button and UI into a tweet compose container.
 */
export function injectRewriteUI(
  composeBox: HTMLElement,
  callbacks: RewriteUICallbacks
): { update: (state: UIState) => void; destroy: () => void } {
  // Create the main container
  const container = createElement('div', `${EL_PREFIX}-container`);

  // --- Trigger bar: rewrite button + tone selector ---
  const triggerBar = createElement('div', `${EL_PREFIX}-trigger-bar`);

  const rewriteBtn = createElement('button', `${EL_PREFIX}-btn ${EL_PREFIX}-btn-rewrite`);
  rewriteBtn.innerHTML = `<span class="${EL_PREFIX}-btn-icon">\u2728</span><span>Rewrite</span>`;

  const toneSelector = createToneSelector();

  triggerBar.appendChild(rewriteBtn);
  triggerBar.appendChild(toneSelector.element);
  container.appendChild(triggerBar);

  // --- Result panel (hidden by default) ---
  const resultPanel = createElement('div', `${EL_PREFIX}-result-panel`);
  resultPanel.style.display = 'none';

  const resultText = createElement('div', `${EL_PREFIX}-result-text`);
  const resultActions = createElement('div', `${EL_PREFIX}-result-actions`);

  const replaceBtn = createElement('button', `${EL_PREFIX}-btn ${EL_PREFIX}-btn-replace`);
  replaceBtn.textContent = 'Replace';

  const retryBtn = createElement('button', `${EL_PREFIX}-btn ${EL_PREFIX}-btn-retry`);
  retryBtn.textContent = 'Retry';

  const dismissBtn = createElement('button', `${EL_PREFIX}-btn ${EL_PREFIX}-btn-dismiss`);
  dismissBtn.textContent = '\u2715';

  resultActions.appendChild(replaceBtn);
  resultActions.appendChild(retryBtn);
  resultActions.appendChild(dismissBtn);

  resultPanel.appendChild(resultText);
  resultPanel.appendChild(resultActions);
  container.appendChild(resultPanel);

  // --- Loading indicator ---
  const loader = createElement('div', `${EL_PREFIX}-loader`);
  loader.style.display = 'none';
  loader.innerHTML = `
    <div class="${EL_PREFIX}-loader-spinner"></div>
    <span class="${EL_PREFIX}-loader-text">Rewriting...</span>
  `;
  container.appendChild(loader);

  // --- Event handlers ---
  let currentRewrite = '';

  rewriteBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    callbacks.onRewrite(toneSelector.getSelected());
  });

  replaceBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (currentRewrite) {
      callbacks.onReplace(currentRewrite);
    }
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

  // Mount into the compose box
  composeBox.appendChild(container);

  // --- State management ---
  function update(state: UIState) {
    switch (state.type) {
      case 'idle':
        triggerBar.style.display = 'flex';
        resultPanel.style.display = 'none';
        loader.style.display = 'none';
        break;

      case 'loading':
        triggerBar.style.display = 'flex';
        resultPanel.style.display = 'none';
        loader.style.display = 'flex';
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
        const loaderText = loader.querySelector(`.${EL_PREFIX}-loader-text`);
        if (loaderText) {
          loaderText.textContent = state.message || 'Loading AI model...';
        }
        rewriteBtn.setAttribute('disabled', 'true');
        break;
    }
  }

  function destroy() {
    container.remove();
  }

  return { update, destroy };
}

// --- UI State types ---
export type UIState =
  | { type: 'idle' }
  | { type: 'loading' }
  | { type: 'result'; text: string }
  | { type: 'error'; message: string }
  | { type: 'model_loading'; message?: string };

// --- Tone Selector ---
function createToneSelector(): { element: HTMLElement; getSelected: () => Tone } {
  let selected: Tone = 'improve';

  const wrapper = createElement('div', `${EL_PREFIX}-tone-selector`);

  TONE_PRESETS.forEach((preset: ToneConfig) => {
    const btn = createElement('button', `${EL_PREFIX}-tone-btn`);
    btn.setAttribute('data-tone', preset.id);
    btn.textContent = `${preset.emoji} ${preset.label}`;
    if (preset.id === selected) {
      btn.classList.add(`${EL_PREFIX}-tone-active`);
    }

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      selected = preset.id;
      // Update active state
      wrapper.querySelectorAll(`.${EL_PREFIX}-tone-btn`).forEach((b) => {
        b.classList.toggle(`${EL_PREFIX}-tone-active`, b.getAttribute('data-tone') === selected);
      });
    });

    wrapper.appendChild(btn);
  });

  return {
    element: wrapper,
    getSelected: () => selected,
  };
}

// --- Helpers ---
function createElement(tag: string, className: string): HTMLElement {
  const el = document.createElement(tag);
  el.className = className;
  return el;
}
