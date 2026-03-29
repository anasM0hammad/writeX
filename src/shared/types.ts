// Tone presets for MVP 1
export type Tone = 'improve' | 'viral' | 'short';

export interface ToneConfig {
  id: Tone;
  label: string;
  emoji: string;
  prompt: string;
}

export const TONE_PRESETS: ToneConfig[] = [
  {
    id: 'improve',
    label: 'Improve',
    emoji: '\u2728',
    prompt: 'Improve clarity and readability. Make it more engaging while keeping the original meaning.',
  },
  {
    id: 'viral',
    label: 'Viral',
    emoji: '\uD83D\uDE80',
    prompt: 'Make it engaging, hook-driven, and optimized for social media virality. Use punchy language.',
  },
  {
    id: 'short',
    label: 'Short',
    emoji: '\u2702\uFE0F',
    prompt: 'Make it shorter and more concise while preserving the core meaning.',
  },
];

// Message types between content script <-> background <-> worker
export type MessageType =
  | 'REWRITE_REQUEST'
  | 'REWRITE_RESPONSE'
  | 'REWRITE_ERROR'
  | 'MODEL_STATUS'
  | 'MODEL_STATUS_CHECK'
  | 'MODEL_LOAD_REQUEST'
  | 'MODEL_PROGRESS'
  | 'WEBGPU_CHECK'
  | 'WEBGPU_RESULT'
  | 'CONTEXT_MENU_REWRITE';

export interface RewriteRequest {
  type: 'REWRITE_REQUEST';
  text: string;
  tone: Tone;
}

export interface RewriteResponse {
  type: 'REWRITE_RESPONSE';
  original: string;
  rewritten: string;
  tone: Tone;
}

export interface RewriteError {
  type: 'REWRITE_ERROR';
  error: string;
}

export interface ModelStatusMessage {
  type: 'MODEL_STATUS';
  status: ModelStatus;
}

export interface ModelLoadRequest {
  type: 'MODEL_LOAD_REQUEST';
}

export interface ModelProgress {
  type: 'MODEL_PROGRESS';
  progress: number;
  message: string;
}

export interface WebGPUCheck {
  type: 'WEBGPU_CHECK';
}

export interface WebGPUResult {
  type: 'WEBGPU_RESULT';
  supported: boolean;
}

export interface ModelStatusCheck {
  type: 'MODEL_STATUS_CHECK';
}

export interface ContextMenuRewrite {
  type: 'CONTEXT_MENU_REWRITE';
  tone: Tone;
}

export type ExtensionMessage =
  | RewriteRequest
  | RewriteResponse
  | RewriteError
  | ModelStatusMessage
  | ModelLoadRequest
  | ModelProgress
  | ModelStatusCheck
  | WebGPUCheck
  | WebGPUResult
  | ContextMenuRewrite;

// Model states
export type ModelStatus =
  | 'not_loaded'
  | 'downloading'
  | 'loading'
  | 'ready'
  | 'error'
  | 'no_webgpu';
