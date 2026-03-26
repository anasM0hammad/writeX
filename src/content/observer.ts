import { OBSERVER_CONFIG, OBSERVER_DEBOUNCE_MS } from '@shared/constants';

type TweetBoxCallback = (tweetBox: HTMLElement) => void;

/**
 * Observes the DOM for tweet compose areas appearing/disappearing.
 * Uses MutationObserver instead of hardcoded selectors for resilience.
 */
export function observeTweetBoxes(onFound: TweetBoxCallback): MutationObserver {
  const processed = new WeakSet<HTMLElement>();
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  function scanForTweetBoxes() {
    // Primary: data-testid based (current X DOM)
    const selectors = [
      '[data-testid="tweetTextarea_0"]',
      '[data-testid="tweetTextarea_1"]',
      '[role="textbox"][data-testid]',
      // Fallback: contenteditable divs inside the compose area
      '[data-testid="toolBar"]',
    ];

    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      elements.forEach((el) => {
        // Walk up to find the compose container
        const composeBox = findComposeContainer(el as HTMLElement);
        if (composeBox && !processed.has(composeBox)) {
          processed.add(composeBox);
          onFound(composeBox);
        }
      });
    }
  }

  function debouncedScan() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(scanForTweetBoxes, OBSERVER_DEBOUNCE_MS);
  }

  const observer = new MutationObserver(debouncedScan);
  observer.observe(document.body, OBSERVER_CONFIG);

  // Initial scan
  scanForTweetBoxes();

  return observer;
}

/**
 * Walk up the DOM tree to find the tweet compose container.
 * Looks for a reasonable ancestor that wraps both the textbox and toolbar.
 */
function findComposeContainer(el: HTMLElement): HTMLElement | null {
  let current: HTMLElement | null = el;
  let depth = 0;
  const maxDepth = 10;

  while (current && depth < maxDepth) {
    // Look for the compose form-like container
    if (
      current.getAttribute('data-testid') === 'tweetTextarea_0' ||
      current.getAttribute('data-testid') === 'tweetTextarea_1'
    ) {
      // For textareas, use their parent container
      return current.closest('[data-testid="tweetBoxToolbar"]')?.parentElement as HTMLElement
        ?? current.parentElement?.parentElement?.parentElement as HTMLElement
        ?? current;
    }

    if (current.getAttribute('data-testid') === 'toolBar') {
      return current.parentElement as HTMLElement ?? current;
    }

    current = current.parentElement;
    depth++;
  }

  return el;
}

/**
 * Extract text content from a tweet compose box.
 */
export function extractTweetText(composeBox: HTMLElement): string {
  // Find the actual editable area
  const textbox =
    composeBox.querySelector('[data-testid="tweetTextarea_0"] [role="textbox"]') ??
    composeBox.querySelector('[data-testid="tweetTextarea_1"] [role="textbox"]') ??
    composeBox.querySelector('[role="textbox"]');

  if (!textbox) return '';

  return (textbox as HTMLElement).innerText?.trim() ?? '';
}

/**
 * Replace text inside the tweet compose box.
 * Uses execCommand to trigger X's internal state management.
 */
export function replaceTweetText(composeBox: HTMLElement, newText: string): void {
  const textbox =
    composeBox.querySelector('[data-testid="tweetTextarea_0"] [role="textbox"]') as HTMLElement ??
    composeBox.querySelector('[data-testid="tweetTextarea_1"] [role="textbox"]') as HTMLElement ??
    composeBox.querySelector('[role="textbox"]') as HTMLElement;

  if (!textbox) return;

  // Focus the element
  textbox.focus();

  // Select all existing text
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(textbox);
  selection?.removeAllRanges();
  selection?.addRange(range);

  // Use insertText to work with X's React-managed state
  document.execCommand('insertText', false, newText);

  // Dispatch input event to notify X's framework
  textbox.dispatchEvent(new Event('input', { bubbles: true }));
}
