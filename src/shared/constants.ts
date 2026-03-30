// WebLLM model configuration
export const MODEL_ID = 'Phi-3.5-mini-instruct-q4f16_1-MLC';

// System prompt for rewriting
export const SYSTEM_PROMPT = `You are a post rewriting assistant for X (formerly Twitter).

STRICT RULES:
- Output ONLY the rewritten post text. Nothing else.
- Do NOT add any notes, explanations, comments, or disclaimers.
- Do NOT prefix with "Here is", "Sure", "Rewritten:", or similar.
- Do NOT add hashtags unless the original has them.
- Do NOT wrap output in quotes.
- Keep under 280 characters.
- Maintain the original meaning.`;

// Build the rewrite prompt
export function buildRewritePrompt(text: string, tonePrompt: string): string {
  return `Tone: ${tonePrompt}

Original post:
${text}

Rewritten post:`;
}

// Extension element prefix to avoid conflicts
export const EL_PREFIX = 'writex';
