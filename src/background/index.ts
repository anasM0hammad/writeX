import { ExtensionMessage, ModelStatus, Tone, TONE_PRESETS } from '@shared/types';

let modelStatus: ModelStatus = 'not_loaded';
let popupPorts: Set<chrome.runtime.Port> = new Set();

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

// --- Message handling from content scripts ---
chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, sender, _sendResponse) => {
    if (!sender.tab) return;

    switch (message.type) {
      case 'MODEL_STATUS':
        modelStatus = message.status;
        updateBadge(modelStatus);
        broadcastToPopups(message);
        break;

      case 'MODEL_PROGRESS':
        chrome.action.setBadgeText({ text: `${Math.round(message.progress)}%` });
        chrome.action.setBadgeTextColor({ color: '#FFFFFF' });
        chrome.action.setBadgeBackgroundColor({ color: '#F59E0B' });
        broadcastToPopups(message);
        break;
    }

    return true;
  }
);

// --- Popup port management ---
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'popup') {
    popupPorts.add(port);

    port.onDisconnect.addListener(() => {
      popupPorts.delete(port);
    });

    port.onMessage.addListener((message: ExtensionMessage) => {
      if (message.type === 'MODEL_STATUS') {
        port.postMessage({ type: 'MODEL_STATUS', status: modelStatus });
      }
    });
  }
});

function broadcastToPopups(message: ExtensionMessage) {
  popupPorts.forEach((p) => {
    try { p.postMessage(message); } catch { /* popup closed */ }
  });
}
