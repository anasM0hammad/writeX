// WebLLM model configuration
export const MODEL_ID = 'Phi-3.5-mini-instruct-q4f16_1-MLC';

// System prompt for rewriting
export const SYSTEM_PROMPT = `You rewrite X posts. Output ONLY the rewritten post. No notes, no explanations, no "Here is", no "Sure", no quotes around output. Just the post text and nothing else.

Rules:
- Under 280 characters
- Keep original meaning
- No hashtags unless original has them`;

// Build the rewrite prompt
export function buildRewritePrompt(text: string, tonePrompt: string): string {
  return `Tone: ${tonePrompt}

Original post:
${text}

Rewritten post:`;
}

// Extension element prefix to avoid conflicts
export const EL_PREFIX = 'writex';
