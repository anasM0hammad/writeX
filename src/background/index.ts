import { ExtensionMessage, ModelStatus, Tone, TONE_PRESETS } from '@shared/types';

let modelStatus: ModelStatus = 'not_loaded';
let offscreenPort: chrome.runtime.Port | null = null;
let popupPorts: Set<chrome.runtime.Port> = new Set();
let pendingWorkerMessages: ExtensionMessage[] = [];
let offscreenCreated = false;

// ─── Context menu ───

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

// ─── Badge ───

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

// ─── Messages from content scripts (sender.tab is set) ───

chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, sender, _sendResponse) => {
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
        triggerModelLoad();
        break;
    }

    return true;
  }
);

// ─── Port connections (offscreen worker + popup) ───

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'offscreen-worker') {
    offscreenPort = port;

    // Worker is ready — flush queued messages
    pendingWorkerMessages.forEach((msg) => port.postMessage(msg));
    pendingWorkerMessages = [];

    port.onMessage.addListener((message: ExtensionMessage) => {
      switch (message.type) {
        case 'MODEL_STATUS':
          modelStatus = message.status;
          updateBadge(modelStatus);
          broadcastToTabs(message);
          broadcastToPopups(message);
          break;
        case 'MODEL_PROGRESS':
          chrome.action.setBadgeText({ text: `${Math.round(message.progress)}%` });
          chrome.action.setBadgeTextColor({ color: '#FFFFFF' });
          chrome.action.setBadgeBackgroundColor({ color: '#F59E0B' });
          broadcastToTabs(message);
          broadcastToPopups(message);
          break;
        case 'REWRITE_RESPONSE':
        case 'REWRITE_ERROR':
          broadcastToTabs(message);
          break;
      }
    });

    port.onDisconnect.addListener(() => {
      offscreenPort = null;
      offscreenCreated = false;
      // If model was loading, mark as error
      if (modelStatus === 'downloading' || modelStatus === 'loading') {
        modelStatus = 'error';
        updateBadge(modelStatus);
        broadcastToTabs({ type: 'MODEL_STATUS', status: modelStatus } as ExtensionMessage);
        broadcastToPopups({ type: 'MODEL_STATUS', status: modelStatus } as ExtensionMessage);
      }
    });
  }

  if (port.name === 'popup') {
    popupPorts.add(port);

    port.onDisconnect.addListener(() => {
      popupPorts.delete(port);
    });

    port.onMessage.addListener((message: ExtensionMessage) => {
      if (message.type === 'MODEL_STATUS') {
        port.postMessage({ type: 'MODEL_STATUS', status: modelStatus });
      } else if (message.type === 'MODEL_LOAD_REQUEST') {
        triggerModelLoad();
        port.postMessage({ type: 'MODEL_STATUS', status: modelStatus });
      }
    });
  }
});

// ─── Model loading ───

function triggerModelLoad() {
  if (modelStatus !== 'not_loaded' && modelStatus !== 'error') return;

  modelStatus = 'loading';
  updateBadge(modelStatus);
  broadcastToTabs({ type: 'MODEL_STATUS', status: modelStatus } as ExtensionMessage);
  broadcastToPopups({ type: 'MODEL_STATUS', status: modelStatus } as ExtensionMessage);

  loadModel();
}

async function loadModel() {
  try {
    await ensureOffscreenDocument();
    sendToWorker({ type: 'MODEL_LOAD_REQUEST' } as ExtensionMessage);
  } catch (err) {
    console.error('[WriteX] Failed to create offscreen document:', err);
    modelStatus = 'error';
    updateBadge(modelStatus);
    broadcastToTabs({ type: 'MODEL_STATUS', status: modelStatus } as ExtensionMessage);
    broadcastToPopups({ type: 'MODEL_STATUS', status: modelStatus } as ExtensionMessage);
  }
}

function sendToWorker(message: ExtensionMessage) {
  if (offscreenPort) {
    offscreenPort.postMessage(message);
  } else {
    pendingWorkerMessages.push(message);
  }
}

async function ensureOffscreenDocument() {
  if (offscreenCreated) return;

  try {
    const existingContexts = await (chrome as any).runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT'],
    });

    if (existingContexts.length > 0) {
      offscreenCreated = true;
      return;
    }
  } catch {
    // getContexts not available — proceed to create
  }

  await (chrome as any).offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['WORKERS'],
    justification: 'Run WebLLM inference with WebGPU access',
  });

  offscreenCreated = true;
}

// ─── Broadcasting ───

function broadcastToPopups(message: ExtensionMessage) {
  popupPorts.forEach((p) => {
    try { p.postMessage(message); } catch { /* closed */ }
  });
}

function broadcastToTabs(message: ExtensionMessage) {
  chrome.tabs.query({ url: ['https://x.com/*', 'https://twitter.com/*'] }, (tabs) => {
    tabs.forEach((tab) => {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, message).catch(() => {});
      }
    });
  });
}

// ─── Auto-load when user visits X ───

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (
    changeInfo.status === 'complete' &&
    tab.url &&
    (tab.url.includes('x.com') || tab.url.includes('twitter.com'))
  ) {
    triggerModelLoad();
  }
});
