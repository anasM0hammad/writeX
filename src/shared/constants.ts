// WebLLM model configuration
export const MODEL_ID = 'Phi-3.5-mini-instruct-q4f16_1-MLC';

// System prompt for rewriting
export const SYSTEM_PROMPT = `You are a tweet rewriting assistant. You rewrite tweets based on the given tone.

Rules:
- Keep the output under 280 characters.
- Maintain the original meaning.
- Do not add hashtags unless the original has them.
- Do not add quotes around the output.
- Output ONLY the rewritten tweet, nothing else. No explanations, no prefixes.`;

// Build the rewrite prompt
export function buildRewritePrompt(text: string, tonePrompt: string): string {
  return `Tone: ${tonePrompt}

Original tweet:
${text}

Rewritten tweet:`;
}

// DOM observation config
export const OBSERVER_CONFIG: MutationObserverInit = {
  childList: true,
  subtree: true,
};

// Debounce delay for DOM observation (ms)
export const OBSERVER_DEBOUNCE_MS = 300;

// Extension element prefix to avoid conflicts
export const EL_PREFIX = 'writex';
