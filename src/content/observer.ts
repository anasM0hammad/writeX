import { EL_PREFIX } from '@shared/constants';

type ComposeBoxCallback = (composeBox: HTMLElement) => void;

const OBSERVER_DEBOUNCE_MS = 300;

/**
 * Observes the DOM for post compose areas.
 * Uses MutationObserver for resilience against X DOM changes.
 */
export function observeComposeBoxes(onFound: ComposeBoxCallback): MutationObserver {
  const processed = new WeakSet<HTMLElement>();
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  function scan() {
    // Find all textbox elements used for composing posts
    const textboxes = document.querySelectorAll<HTMLElement>('[role="textbox"]');

    textboxes.forEach((textbox) => {
      // Walk up to find the outermost compose form container
      const composeBox = findComposeRoot(textbox);
      if (composeBox && !processed.has(composeBox)) {
        processed.add(composeBox);
        onFound(composeBox);
      }
    });
  }

  function debouncedScan() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(scan, OBSERVER_DEBOUNCE_MS);
  }

  const observer = new MutationObserver(debouncedScan);
  observer.observe(document.body, { childList: true, subtree: true });

  // Initial scan
  scan();
  return observer;
}

/**
 * Walk up from a textbox to find the compose root container.
 * We look for the element that contains both the textbox and the toolbar/post button area.
 */
function findComposeRoot(textbox: HTMLElement): HTMLElement | null {
  let current: HTMLElement | null = textbox;
  let lastGoodContainer: HTMLElement | null = null;

  // Walk up to find a container that has both the textbox and a toolbar/post button
  for (let depth = 0; current && depth < 15; depth++) {
    // Check if this level contains the toolbar or post button
    if (
      current.querySelector('[data-testid="toolBar"]') ||
      current.querySelector('[data-testid="tweetButton"]') ||
      current.querySelector('[data-testid="tweetButtonInline"]')
    ) {
      lastGoodContainer = current;
      break;
    }
    current = current.parentElement;
  }

  return lastGoodContainer;
}

/**
 * Extract text from the compose box's textbox.
 */
export function extractPostText(composeBox: HTMLElement): string {
  const textbox = composeBox.querySelector('[role="textbox"]') as HTMLElement;
  if (!textbox) return '';
  return textbox.innerText?.trim() ?? '';
}

/**
 * Replace text in the compose box's textbox.
 * Uses execCommand to work with X's React-managed state.
 */
export function replacePostText(composeBox: HTMLElement, newText: string): void {
  const textbox = composeBox.querySelector('[role="textbox"]') as HTMLElement;
  if (!textbox) return;

  textbox.focus();

  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(textbox);
  selection?.removeAllRanges();
  selection?.addRange(range);

  document.execCommand('insertText', false, newText);
  textbox.dispatchEvent(new Event('input', { bubbles: true }));
}
