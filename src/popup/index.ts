import { ExtensionMessage, ModelStatus } from '@shared/types';
import './styles.css';

/**
 * Popup script.
 * Shows model status, WebGPU support, and handles model loading.
 */

const webgpuBadge = document.getElementById('webgpu-badge')!;
const modelBadge = document.getElementById('model-badge')!;
const progressContainer = document.getElementById('progress-container')!;
const progressFill = document.getElementById('progress-fill')!;
const progressText = document.getElementById('progress-text')!;
const modelHint = document.getElementById('model-hint')!;
const btnLoadModel = document.getElementById('btn-load-model')!;

// Check WebGPU support
async function checkWebGPU() {
  if ('gpu' in navigator) {
    try {
      const adapter = await (navigator as any).gpu.requestAdapter();
      if (adapter) {
        updateWebGPUStatus(true);
        return true;
      }
    } catch {
      // Fall through
    }
  }
  updateWebGPUStatus(false);
  return false;
}

function updateWebGPUStatus(supported: boolean) {
  webgpuBadge.textContent = supported ? 'Supported' : 'Not Available';
  webgpuBadge.className = `wx-status-badge ${supported ? 'wx-badge-success' : 'wx-badge-error'}`;

  if (!supported) {
    btnLoadModel.setAttribute('disabled', 'true');
    btnLoadModel.textContent = 'WebGPU Required';
    modelHint.textContent = 'WebGPU is required. Use Chrome 113+ with WebGPU enabled.';
  }
}

function updateModelStatus(status: ModelStatus) {
  switch (status) {
    case 'not_loaded':
      modelBadge.textContent = 'Not loaded';
      modelBadge.className = 'wx-status-badge wx-badge-neutral';
      btnLoadModel.style.display = 'block';
      progressContainer.style.display = 'none';
      modelHint.textContent = 'Click below to load the AI model, or open x.com to auto-load.';
      break;

    case 'downloading':
      modelBadge.textContent = 'Downloading...';
      modelBadge.className = 'wx-status-badge wx-badge-loading';
      btnLoadModel.style.display = 'none';
      progressContainer.style.display = 'flex';
      modelHint.textContent = 'Downloading AI model. This only happens once.';
      break;

    case 'loading':
      modelBadge.textContent = 'Loading...';
      modelBadge.className = 'wx-status-badge wx-badge-loading';
      btnLoadModel.style.display = 'none';
      progressContainer.style.display = 'flex';
      modelHint.textContent = 'Initializing AI model...';
      break;

    case 'ready':
      modelBadge.textContent = 'Ready';
      modelBadge.className = 'wx-status-badge wx-badge-success';
      btnLoadModel.style.display = 'none';
      progressContainer.style.display = 'none';
      modelHint.textContent = 'AI model loaded and ready. Right-click in any post box to enhance!';
      break;

    case 'error':
      modelBadge.textContent = 'Error';
      modelBadge.className = 'wx-status-badge wx-badge-error';
      btnLoadModel.style.display = 'block';
      btnLoadModel.textContent = 'Retry Loading';
      progressContainer.style.display = 'none';
      modelHint.textContent = 'Failed to load model. Click below to retry.';
      break;

    case 'no_webgpu':
      modelBadge.textContent = 'Unavailable';
      modelBadge.className = 'wx-status-badge wx-badge-error';
      btnLoadModel.style.display = 'none';
      progressContainer.style.display = 'none';
      modelHint.textContent = 'WebGPU is required but not available in your browser.';
      break;
  }
}

// Connect to background to get/set model status
const port = chrome.runtime.connect({ name: 'popup' });

port.onMessage.addListener((message: ExtensionMessage) => {
  if (message.type === 'MODEL_STATUS') {
    updateModelStatus(message.status);
  } else if (message.type === 'MODEL_PROGRESS') {
    progressFill.style.width = `${message.progress}%`;
    progressText.textContent = `${Math.round(message.progress)}%`;
  }
});

// Request current status
port.postMessage({ type: 'MODEL_STATUS' });

// Load model button
btnLoadModel.addEventListener('click', () => {
  port.postMessage({ type: 'MODEL_LOAD_REQUEST' });
  btnLoadModel.style.display = 'none';
});

// Init
checkWebGPU();
