import { ExtensionMessage, ModelStatus, Tone, TONE_PRESETS } from '@shared/types';

let modelStatus: ModelStatus = 'not_loaded';

// --- Context menu setup ---
chrome.runtime.onInstalled.addListener(() => {
  // Parent menu
  chrome.contextMenus.create({
    id: 'writex-enhance',
    title: 'Enhance Post',
    contexts: ['editable'],
    documentUrlPatterns: ['https://x.com/*', 'https://twitter.com/*'],
  });

  // Tone sub-menus
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

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab?.id) return;
  const menuId = info.menuItemId as string;
  if (!menuId.startsWith('writex-tone-')) return;

  const tone = menuId.replace('writex-tone-', '') as Tone;

  // Ask content script to get selected text and handle the rewrite
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
      chrome.action.setBadgeBackgroundColor({ color: '#F59E0B' }); // amber/orange
      break;
    case 'ready':
      chrome.action.setBadgeText({ text: '' });
      break;
    case 'error':
      chrome.action.setBadgeText({ text: '!' });
      chrome.action.setBadgeBackgroundColor({ color: '#F4212E' });
      break;
    case 'no_webgpu':
      chrome.action.setBadgeText({ text: '!' });
      chrome.action.setBadgeBackgroundColor({ color: '#F4212E' });
      break;
    default:
      chrome.action.setBadgeText({ text: '' });
  }
}

function updateBadgeProgress(progress: number) {
  const pct = Math.round(progress);
  chrome.action.setBadgeText({ text: `${pct}%` });
  chrome.action.setBadgeBackgroundColor({ color: '#F59E0B' });
}

// --- Message handling ---
chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, sender, sendResponse) => {
    switch (message.type) {
      case 'REWRITE_REQUEST':
        forwardToWorker(message);
        break;

      case 'MODEL_STATUS':
        if (sender.tab) {
          // Content script asking for status
          if (sender.tab.id) {
            chrome.tabs.sendMessage(sender.tab.id, { type: 'MODEL_STATUS', status: modelStatus });
          }
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

// --- Offscreen document & model loading ---
let offscreenCreated = false;

async function loadModel() {
  modelStatus = 'loading';
  updateBadge(modelStatus);
  broadcastStatus();

  try {
    await ensureOffscreenDocument();
    sendToOffscreen({ type: 'MODEL_LOAD_REQUEST' });
  } catch (err) {
    modelStatus = 'error';
    updateBadge(modelStatus);
    broadcastStatus();
  }
}

function forwardToWorker(message: ExtensionMessage) {
  sendToOffscreen(message);
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

function sendToOffscreen(message: ExtensionMessage) {
  chrome.runtime.sendMessage(message);
}

// --- Broadcasting ---
function broadcastStatus() {
  broadcastToTabs({ type: 'MODEL_STATUS', status: modelStatus });
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

// Listen for status updates from offscreen document
chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender) => {
  if (!sender.tab) {
    switch (message.type) {
      case 'MODEL_STATUS':
        modelStatus = message.status;
        updateBadge(modelStatus);
        broadcastStatus();
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
  }
});

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
