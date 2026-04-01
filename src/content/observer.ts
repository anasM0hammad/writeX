type ComposeBoxCallback = (composeBox: HTMLElement) => void;

const OBSERVER_DEBOUNCE_MS = 300;

export function observeComposeBoxes(onFound: ComposeBoxCallback): MutationObserver {
  const processed = new WeakSet<HTMLElement>();
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  function scan() {
    const textboxes = document.querySelectorAll<HTMLElement>(
      'div[role="textbox"][contenteditable="true"]'
    );

    textboxes.forEach((textbox) => {
      // Deduplicate by textbox, not compose root
      if (processed.has(textbox)) return;

      const composeBox = findComposeRoot(textbox);
      if (composeBox) {
        processed.add(textbox);
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
 * Strategy: at each ancestor, check if a SIBLING (not deep descendant) is
 * or contains a toolbar. This prevents matching a toolbar in a completely
 * different branch of the DOM (e.g. sidebar, other compose areas).
 */
function findComposeRoot(textbox: HTMLElement): HTMLElement | null {
  let current: HTMLElement | null = textbox;

  for (let depth = 0; current?.parentElement && depth < 10; depth++) {
    const parent: HTMLElement = current.parentElement;

    // Check siblings of the current node for toolbar elements
    const siblings = Array.from(parent.children) as HTMLElement[];
    const hasSiblingToolbar = siblings.some((child: HTMLElement) => {
      if (child === current) return false;
      const testId = child.getAttribute('data-testid');
      return (
        testId === 'toolBar' ||
        testId === 'tweetButton' ||
        testId === 'tweetButtonInline' ||
        child.querySelector(':scope > [data-testid="toolBar"]') !== null
      );
    });

    if (hasSiblingToolbar) return parent;
    current = parent;
  }

  return null;
}

export function extractPostText(composeBox: HTMLElement): string {
  const textbox = composeBox.querySelector('[role="textbox"]') as HTMLElement;
  if (!textbox) return '';
  return textbox.innerText?.trim() ?? '';
}

export function replacePostText(composeBox: HTMLElement, newText: string): void {
  const textbox = composeBox.querySelector('[role="textbox"]') as HTMLElement;
  if (!textbox) return;

  textbox.focus();

  const selection = window.getSelection();
  if (!selection) return;
  selection.selectAllChildren(textbox);

  // Simulate a paste via beforeinput event with insertFromPaste.
  // X's editor (Lexical) handles paste events by reading from dataTransfer
  // and updating its internal state — unlike execCommand('insertText')
  // which only mutates the DOM, causing the editor state to desync.
  // This ensures what you see in the box is what actually gets posted.
  const dt = new DataTransfer();
  dt.setData('text/plain', newText);

  const beforeInput = new InputEvent('beforeinput', {
    inputType: 'insertFromPaste',
    dataTransfer: dt,
    bubbles: true,
    cancelable: true,
    composed: true,
  } as any);

  const wasIntercepted = !textbox.dispatchEvent(beforeInput);

  if (!wasIntercepted) {
    // Editor didn't handle the synthetic paste — fall back to execCommand
    document.execCommand('insertText', false, newText);
  }
}
