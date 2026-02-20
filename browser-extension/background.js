// background.js – Service Worker for Kiosk Browser Command
// Manages: Browser ID, Kiosk Manager polling, playlist rotation, script execution

const ALARM_POLL      = 'pollKioskManager';
const ALARM_ROTATION  = 'playlistRotation';

// ─── Browser ID ─────────────────────────────────────────────────────────────

async function getBrowserId() {
  const result = await chrome.storage.local.get('browserId');
  if (result.browserId) return result.browserId;
  const id = crypto.randomUUID();
  await chrome.storage.local.set({ browserId: id });
  return id;
}

// ─── Kiosk Manager Polling ───────────────────────────────────────────────────

async function pollKioskManager() {
  const settings = await chrome.storage.sync.get({
    kioskManagerUrl: '',
    kioskEnabled: true,
    pollInterval: 1
  });

  if (!settings.kioskManagerUrl || !settings.kioskEnabled) {
    await chrome.storage.local.set({ connectionStatus: 'disabled' });
    return;
  }

  const browserId = await getBrowserId();
  const url = `${settings.kioskManagerUrl}/api/playlist/?browser_id=${browserId}`;

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: { 'Accept': 'application/json' }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

    const data = await response.json();
    const websites = (data.playlist || []).filter(i => i.type === 'website');

    // Scripts now come per playlist item – merge all of them
    const remoteScripts = websites.flatMap(item =>
      (item.scripts || []).map(s => ({ ...s, _source: 'remote' }))
    );

    await chrome.storage.local.set({
      lastPoll:         new Date().toISOString(),
      connectionError:  null,
      connectionStatus: 'ok',
      groupName:        data.group_name || null,
      playlist:         websites,
      remoteScripts,
    });

    // Update playlist if the content has changed
    await syncPlaylist(websites);

  } catch (err) {
    await chrome.storage.local.set({
      lastPoll:         new Date().toISOString(),
      connectionError:  err.message,
      connectionStatus: 'error'
    });
    console.warn('[KioskCmd] Poll failed:', err.message);
  }
}

// ─── Playlist Rotation ───────────────────────────────────────────────────────

async function syncPlaylist(websites) {
  if (!websites.length) return;

  const state = await chrome.storage.local.get({
    playlistActive: false,
    playlistTabId:  null,
    playlist:       []
  });

  if (!state.playlistTabId) return; // No tab known yet – waiting for setPlayerBrowserId

  const oldUrls = (state.playlist || []).map(i => i.url).join(',');
  const newUrls = websites.map(i => i.url).join(',');

  if (!state.playlistActive) {
    // Not started yet → start automatically
    await startRotation(websites, state.playlistTabId);
  } else if (oldUrls !== newUrls) {
    // Already running, but playlist has changed → restart
    await startRotation(websites, state.playlistTabId);
  }
}

async function startRotation(playlist, tabId) {
  if (!playlist || playlist.length === 0) return;

  await chrome.alarms.clear(ALARM_ROTATION);
  await chrome.storage.local.set({
    playlistActive:  true,
    playlistTabId:   tabId,
    playlist:        playlist,
    currentIndex:    0
  });

  await navigateTo(playlist, 0, tabId);
}

async function stopRotation() {
  await chrome.alarms.clear(ALARM_ROTATION);
  await chrome.storage.local.set({ playlistActive: false });
}

async function navigateTo(playlist, index, tabId) {
  const item = playlist[index];
  if (!item) return;

  await chrome.storage.local.set({
    currentIndex:        index,
    currentItemStart:    Date.now(),
    currentItemDuration: item.duration
  });

  try {
    await chrome.tabs.update(tabId, { url: item.url });
  } catch (err) {
    console.warn('[KioskCmd] Tab navigation failed:', err.message);
    await stopRotation();
    return;
  }

  // Alarm for next item – only if playlist has more than one entry
  if (playlist.length > 1) {
    chrome.alarms.create(ALARM_ROTATION, {
      delayInMinutes: Math.max(0.1, item.duration / 60)
    });
  }
}

// ─── Alarm Handler ───────────────────────────────────────────────────────────

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_POLL) {
    await pollKioskManager();
  }

  if (alarm.name === ALARM_ROTATION) {
    const state = await chrome.storage.local.get({
      playlistActive: false,
      playlist:       [],
      currentIndex:   0,
      playlistTabId:  null
    });
    if (!state.playlistActive || !state.playlist.length || !state.playlistTabId) return;

    const nextIndex = (state.currentIndex + 1) % state.playlist.length;
    await navigateTo(state.playlist, nextIndex, state.playlistTabId);
  }
});

// ─── Auto-Detection ──────────────────────────────────────────────────────────

// Reads the browser ID directly from the localStorage of the /play/ page via scripting.executeScript
async function readPlayerBrowserId(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => localStorage.getItem('browserDisplayIdentifier'),
    });
    return results?.[0]?.result || null;
  } catch {
    return null;
  }
}

// Listen for tab navigations – detects /play/ pages of the Kiosk Manager
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !tab.url) return;

  let origin, pathname;
  try {
    const u = new URL(tab.url);
    origin   = u.origin;
    pathname = u.pathname.replace(/\/$/, '');
  } catch { return; }

  if (!pathname.endsWith('/play')) return;

  // Read browser ID directly from the page's localStorage
  const playerId = await readPlayerBrowserId(tabId);
  const browserId = playerId || (await getBrowserId());

  // Remember browser ID and tab
  const current = await chrome.storage.local.get({ browserId: null });
  if (current.browserId !== browserId) {
    console.log('[KioskCmd] Adopting player browser ID:', browserId.substring(0, 8) + '…');
    await chrome.storage.local.set({ browserId, playlistTabId: tabId, playlistActive: false });
  } else {
    await chrome.storage.local.set({ playlistTabId: tabId });
  }

  // Save Kiosk Manager URL if not yet known
  const settings = await chrome.storage.sync.get({ kioskManagerUrl: '', pollInterval: 1 });
  if (!settings.kioskManagerUrl) {
    await chrome.storage.sync.set({ kioskManagerUrl: origin, kioskEnabled: true });
    await setupAlarm(settings.pollInterval);
  }

  // Poll immediately → loads playlist with correct ID → syncPlaylist starts automatically
  await pollKioskManager();
});

// ─── Startup ─────────────────────────────────────────────────────────────────

async function setupAlarm(intervalMinutes) {
  await chrome.alarms.clear(ALARM_POLL);
  chrome.alarms.create(ALARM_POLL, {
    delayInMinutes:  0.1,
    periodInMinutes: Math.max(1, intervalMinutes || 1)
  });
}

chrome.runtime.onStartup.addListener(async () => {
  const settings = await chrome.storage.sync.get({ pollInterval: 1 });
  await setupAlarm(settings.pollInterval);
  await pollKioskManager();
});

chrome.runtime.onInstalled.addListener(async () => {
  const settings = await chrome.storage.sync.get({ pollInterval: 1 });
  await setupAlarm(settings.pollInterval);

  // Demo script on first start
  const data = await chrome.storage.local.get({ scripts: [] });
  if (data.scripts.length === 0) {
    await chrome.storage.local.set({
      scripts: [{
        id: 'example-powerbi',
        name: 'PowerBI Login (Beispiel)',
        urlPattern: '*://login.microsoftonline.com/*',
        enabled: false,
        content: [
          '// PowerBI / Microsoft Login',
          '// URL-Muster: *://login.microsoftonline.com/*',
          '',
          'cy.log("Starte Microsoft Login...");',
          '',
          'cy.get(\'input[name="loginfmt"]\').type("IHR_LOGIN@example.com");',
          'cy.get(\'#idSIButton9\').click();',
          'cy.wait(2000);',
          '',
          'cy.get(\'input[name="passwd"]\').type("IHR_PASSWORT");',
          'cy.get(\'#idSIButton9\').click();',
          'cy.wait(3000);',
          '',
          'cy.get(\'#idBtn_Back\').click();',
          '',
          'cy.log("Login abgeschlossen ✓");'
        ].join('\n')
      }]
    });
  }
});

// ─── Message Handler ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      switch (message.action) {

        case 'getStatus': {
          const local = await chrome.storage.local.get([
            'browserId', 'lastPoll', 'connectionError', 'connectionStatus',
            'groupName', 'playlist', 'currentIndex', 'currentItemStart',
            'currentItemDuration', 'playlistActive', 'playlistTabId'
          ]);
          const sync = await chrome.storage.sync.get({
            kioskManagerUrl: '', kioskEnabled: true, pollInterval: 1
          });
          sendResponse({ success: true, ...local, settings: sync });
          break;
        }

        case 'pollNow':
          await pollKioskManager();
          sendResponse({ success: true });
          break;

        case 'updateAlarm':
          await setupAlarm(message.interval);
          sendResponse({ success: true });
          break;

        case 'startPlaylist': {
          const state = await chrome.storage.local.get({ playlist: [] });
          if (!state.playlist.length) {
            sendResponse({ success: false, error: 'No playlist – configure Kiosk Manager first' });
            break;
          }
          await startRotation(state.playlist, message.tabId);
          sendResponse({ success: true });
          break;
        }

        case 'stopPlaylist':
          await stopRotation();
          sendResponse({ success: true });
          break;

        case 'playlistNext': {
          const state = await chrome.storage.local.get({
            playlist: [], currentIndex: 0, playlistTabId: null
          });
          if (!state.playlist.length) break;
          const next = (state.currentIndex + 1) % state.playlist.length;
          await navigateTo(state.playlist, next, message.tabId || state.playlistTabId);
          sendResponse({ success: true });
          break;
        }

        case 'playlistPrev': {
          const state = await chrome.storage.local.get({
            playlist: [], currentIndex: 0, playlistTabId: null
          });
          if (!state.playlist.length) break;
          const prev = (state.currentIndex - 1 + state.playlist.length) % state.playlist.length;
          await navigateTo(state.playlist, prev, message.tabId || state.playlistTabId);
          sendResponse({ success: true });
          break;
        }

        case 'scriptCompleted':
          console.log(`[KioskCmd] Script "${message.scriptName}":`, message.success ? 'OK' : message.error);
          sendResponse({ success: true });
          break;

        default:
          sendResponse({ success: false, error: 'Unknown action: ' + message.action });
      }
    } catch (err) {
      sendResponse({ success: false, error: err.message });
    }
  })();
  return true;
});
