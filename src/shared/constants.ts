// WebLLM model configuration
export const MODEL_ID = 'Phi-3.5-mini-instruct-q4f16_1-MLC';

// System prompt for rewriting
export const SYSTEM_PROMPT = `You are a post rewriting assistant. You rewrite X (formerly Twitter) posts based on the given tone.

Rules:
- Keep the output under 280 characters.
- Maintain the original meaning.
- Do not add hashtags unless the original has them.
- Do not add quotes around the output.
- Output ONLY the rewritten post, nothing else. No explanations, no prefixes.`;

// Build the rewrite prompt
export function buildRewritePrompt(text: string, tonePrompt: string): string {
  return `Tone: ${tonePrompt}

Original post:
${text}

Rewritten post:`;
}

// Extension element prefix to avoid conflicts
export const EL_PREFIX = 'writex';
