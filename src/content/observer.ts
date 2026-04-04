type ComposeBoxCallback = (composeBox: HTMLElement) => void;

const OBSERVER_DEBOUNCE_MS = 300;

export function observeComposeBoxes(onFound: ComposeBoxCallback): MutationObserver {
  const processed = new WeakSet<HTMLElement>();
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  function scan() {
    const textboxes = document.querySelectorAll<HTMLElement>('[role="textbox"]');

    textboxes.forEach((textbox) => {
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

  // Initial scan + delayed rescan for late-loading compose areas
  scan();
  setTimeout(scan, 1500);

  return observer;
}

/**
 * Walk up from textbox to find the compose root.
 * Strategy: find the nearest ancestor that contains both the textbox AND a toolbar/button.
 * Fallback: if not found, walk up a fixed number of levels from the textbox.
 */
function findComposeRoot(textbox: HTMLElement): HTMLElement | null {
  let current: HTMLElement | null = textbox;

  for (let depth = 0; current && depth < 20; depth++) {
    if (
      current.querySelector('[data-testid="toolBar"]') ||
      current.querySelector('[data-testid="tweetButton"]') ||
      current.querySelector('[data-testid="tweetButtonInline"]')
    ) {
      return current;
    }
    current = current.parentElement;
  }

  // Fallback: no toolbar found — walk up 5 levels from textbox as a reasonable container
  current = textbox;
  for (let i = 0; i < 5 && current?.parentElement; i++) {
    current = current.parentElement;
  }
  return current;
}

export function extractPostText(composeBox: HTMLElement): string {
  const textbox = composeBox.querySelector('[role="textbox"]') as HTMLElement;
  if (!textbox) return '';
  return textbox.innerText?.trim() ?? '';
}

export function replacePostText(composeBox: HTMLElement, newText: string): void {
  const textbox = composeBox.querySelector('[role="textbox"]') as HTMLElement;
  if (!textbox) return;

  // Step 1: Focus the textbox
  textbox.focus();

  // Step 2: Select all text. execCommand('selectAll') scopes to the
  // focused contenteditable element automatically.
  document.execCommand('selectAll');

  // Step 3: Replace with new text via insertText. This fires trusted
  // beforeinput/input events that Lexical processes.
  document.execCommand('insertText', false, newText);

  // Step 4: Collapse cursor to end so keyboard works immediately after.
  const selection = window.getSelection();
  if (selection && selection.rangeCount > 0) {
    selection.collapseToEnd();
  }
}
