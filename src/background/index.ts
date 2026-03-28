import { ExtensionMessage, ModelStatus, Tone, TONE_PRESETS } from '@shared/types';

let modelStatus: ModelStatus = 'not_loaded';
let offscreenPort: chrome.runtime.Port | null = null;

// --- Context menu setup ---
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'writex-enhance',
    title: 'Enhance Post',
    contexts: ['editable'],
    documentUrlPatterns: ['https://x.com/*', 'https://twitter.com/*'],
  });

  TONE_PRESETS.forEach((preset) => {
    chrome.contextMenus.create({
      id: `writex-tone-${preset.id}`,
      parentId: 'writex-enhance',
      title: `${preset.emoji} ${preset.label}`,
      contexts: ['editable'],
      documentUrlPatterns: ['https://x.com/*', 'https://twitter.com/*'],
    });
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab?.id) return;
  const menuId = info.menuItemId as string;
  if (!menuId.startsWith('writex-tone-')) return;

  const tone = menuId.replace('writex-tone-', '') as Tone;
  chrome.tabs.sendMessage(tab.id, {
    type: 'CONTEXT_MENU_REWRITE',
    tone,
  } as ExtensionMessage);
});

// --- Badge management ---
function updateBadge(status: ModelStatus) {
  switch (status) {
    case 'downloading':
    case 'loading':
      chrome.action.setBadgeText({ text: '...' });
      chrome.action.setBadgeBackgroundColor({ color: '#F59E0B' });
      break;
    case 'ready':
      chrome.action.setBadgeText({ text: '' });
      break;
    case 'error':
    case 'no_webgpu':
      chrome.action.setBadgeText({ text: '!' });
      chrome.action.setBadgeBackgroundColor({ color: '#F4212E' });
      break;
    default:
      chrome.action.setBadgeText({ text: '' });
  }
}

function updateBadgeProgress(progress: number) {
  chrome.action.setBadgeText({ text: `${Math.round(progress)}%` });
  chrome.action.setBadgeBackgroundColor({ color: '#F59E0B' });
}

// --- Message handling from content scripts (have sender.tab) ---
chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, sender, _sendResponse) => {
    // Only handle messages from content scripts (tabs)
    if (!sender.tab) return;

    switch (message.type) {
      case 'REWRITE_REQUEST':
        sendToWorker(message);
        break;

      case 'MODEL_STATUS':
        // Content script asking for current status
        if (sender.tab.id) {
          chrome.tabs.sendMessage(sender.tab.id, {
            type: 'MODEL_STATUS',
            status: modelStatus,
          } as ExtensionMessage);
        }
        break;

      case 'MODEL_LOAD_REQUEST':
        if (modelStatus === 'not_loaded' || modelStatus === 'error') {
          loadModel();
        }
        break;
    }

    return true;
  }
);

// --- Offscreen worker communication via ports ---
// The offscreen document connects via chrome.runtime.connect when it's ready.
// This solves the race condition — we know the worker is loaded when it connects.
let pendingWorkerMessages: ExtensionMessage[] = [];

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'offscreen-worker') {
    offscreenPort = port;

    port.onMessage.addListener((message: ExtensionMessage) => {
      switch (message.type) {
        case 'MODEL_STATUS':
          modelStatus = message.status;
          updateBadge(modelStatus);
          broadcastToTabs(message);
          break;
        case 'MODEL_PROGRESS':
          updateBadgeProgress(message.progress);
          broadcastToTabs(message);
          break;
        case 'REWRITE_RESPONSE':
        case 'REWRITE_ERROR':
          broadcastToTabs(message);
          break;
      }
    });

    port.onDisconnect.addListener(() => {
      offscreenPort = null;
    });

    // Flush any messages that were queued before the worker connected
    pendingWorkerMessages.forEach((msg) => port.postMessage(msg));
    pendingWorkerMessages = [];
  }

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

// --- Offscreen document & model loading ---
let offscreenCreated = false;

async function loadModel() {
  modelStatus = 'loading';
  updateBadge(modelStatus);
  broadcastToTabs({ type: 'MODEL_STATUS', status: modelStatus });

  try {
    await ensureOffscreenDocument();
    sendToWorker({ type: 'MODEL_LOAD_REQUEST' });
  } catch (err) {
    console.error('[WriteX] Failed to create offscreen document:', err);
    modelStatus = 'error';
    updateBadge(modelStatus);
    broadcastToTabs({ type: 'MODEL_STATUS', status: modelStatus });
  }
}

function sendToWorker(message: ExtensionMessage) {
  if (offscreenPort) {
    offscreenPort.postMessage(message);
  } else {
    // Queue message — will be sent when worker connects
    pendingWorkerMessages.push(message);
  }
}

async function ensureOffscreenDocument() {
  if (offscreenCreated) return;

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

// --- Broadcasting ---
function broadcastToTabs(message: ExtensionMessage) {
  chrome.tabs.query({ url: ['https://x.com/*', 'https://twitter.com/*'] }, (tabs) => {
    tabs.forEach((tab) => {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, message).catch(() => {});
      }
    });
  });
}

// Auto-load model when user visits X
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (
    changeInfo.status === 'complete' &&
    tab.url &&
    (tab.url.includes('x.com') || tab.url.includes('twitter.com'))
  ) {
    if (modelStatus === 'not_loaded') {
      loadModel();
    }
  }
});
