import { ExtensionMessage, ModelStatus } from '@shared/types';

let modelStatus: ModelStatus = 'not_loaded';
let workerPort: chrome.runtime.Port | null = null;

/**
 * Background service worker.
 * Routes messages between content scripts and the inference worker.
 */

// Handle messages from content scripts
chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, sender, sendResponse) => {
    switch (message.type) {
      case 'REWRITE_REQUEST':
        forwardToWorker(message);
        break;

      case 'MODEL_STATUS':
        // Content script asking for current status
        broadcastToTabs({ type: 'MODEL_STATUS', status: modelStatus });
        break;

      case 'MODEL_LOAD_REQUEST':
        if (modelStatus === 'not_loaded' || modelStatus === 'error') {
          loadModel();
        }
        break;

      case 'WEBGPU_CHECK':
        // WebGPU check is done in the popup/content context
        break;
    }

    return true; // Keep the message channel open for async
  }
);

// Handle connections from popup
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'popup') {
    port.onMessage.addListener((message: ExtensionMessage) => {
      if (message.type === 'MODEL_STATUS') {
        port.postMessage({ type: 'MODEL_STATUS', status: modelStatus });
      } else if (message.type === 'MODEL_LOAD_REQUEST') {
        if (modelStatus === 'not_loaded' || modelStatus === 'error') {
          loadModel();
        }
        port.postMessage({ type: 'MODEL_STATUS', status: modelStatus });
      }
    });
  }
});

/**
 * Initialize and manage the offscreen document / worker for inference.
 * In Manifest V3, we use an offscreen document to run WebLLM.
 */
async function loadModel() {
  modelStatus = 'loading';
  broadcastStatus();

  try {
    // Create offscreen document for WebLLM inference
    await ensureOffscreenDocument();
    sendToOffscreen({ type: 'MODEL_LOAD_REQUEST' });
  } catch (err) {
    modelStatus = 'error';
    broadcastStatus();
  }
}

function forwardToWorker(message: ExtensionMessage) {
  sendToOffscreen(message);
}

// --- Offscreen document management ---
let offscreenCreated = false;

async function ensureOffscreenDocument() {
  if (offscreenCreated) return;

  // Check if already exists
  const existingContexts = await (chrome as any).runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
  });

  if (existingContexts.length > 0) {
    offscreenCreated = true;
    return;
  }

  await (chrome as any).offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['WORKERS'],
    justification: 'Run WebLLM inference in a web worker',
  });

  offscreenCreated = true;
}

function sendToOffscreen(message: ExtensionMessage) {
  chrome.runtime.sendMessage(message);
}

/**
 * Broadcast model status to all X tabs
 */
function broadcastStatus() {
  broadcastToTabs({ type: 'MODEL_STATUS', status: modelStatus });
}

function broadcastToTabs(message: ExtensionMessage) {
  chrome.tabs.query({ url: ['https://x.com/*', 'https://twitter.com/*'] }, (tabs) => {
    tabs.forEach((tab) => {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, message).catch(() => {
          // Tab might not have content script loaded yet
        });
      }
    });
  });
}

// Listen for status updates from offscreen document
chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender) => {
  // Messages from offscreen document (same extension, no tab)
  if (!sender.tab) {
    switch (message.type) {
      case 'MODEL_STATUS':
        modelStatus = message.status;
        broadcastStatus();
        break;
      case 'MODEL_PROGRESS':
        broadcastToTabs(message);
        break;
      case 'REWRITE_RESPONSE':
      case 'REWRITE_ERROR':
        broadcastToTabs(message);
        break;
    }
  }
});

// Auto-load model when extension starts on X
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (
    changeInfo.status === 'complete' &&
    tab.url &&
    (tab.url.includes('x.com') || tab.url.includes('twitter.com'))
  ) {
    if (modelStatus === 'not_loaded') {
      // Proactively start loading model when user visits X
      loadModel();
    }
  }
});
