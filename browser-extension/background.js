// background.js - Service Worker für Kiosk Browser Command
// Verwaltet: Browser-ID, Kiosk Manager Polling, Script-Ausführung

// ─── Browser-ID ────────────────────────────────────────────────────────────

async function getBrowserId() {
  const result = await chrome.storage.local.get('browserId');
  if (result.browserId) return result.browserId;
  const id = crypto.randomUUID();
  await chrome.storage.local.set({ browserId: id });
  return id;
}

// ─── Kiosk Manager Polling ─────────────────────────────────────────────────

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

    await chrome.storage.local.set({
      lastPoll: new Date().toISOString(),
      connectionError: null,
      connectionStatus: 'ok',
      currentPlaylist: data,
      // Remote-Scripts aus Kiosk Manager speichern (überschreiben bei jedem Poll)
      remoteScripts: (data.scripts || []).map(s => ({ ...s, _source: 'remote' }))
    });

    await handlePlaylist(data);

  } catch (err) {
    await chrome.storage.local.set({
      lastPoll: new Date().toISOString(),
      connectionError: err.message,
      connectionStatus: 'error'
    });
    console.warn('[KioskCmd] Poll fehlgeschlagen:', err.message);
  }
}

async function handlePlaylist(data) {
  if (!data.playlist || data.playlist.length === 0) return;

  // Nur Website-Einträge verarbeiten
  const websites = data.playlist.filter(item => item.type === 'website');
  if (websites.length === 0) return;

  // Playlist-Status für den Player speichern (wird von content-script genutzt)
  await chrome.storage.local.set({
    playlistWebsites: websites,
    groupName: data.group_name
  });

  // Optional: Aktiven Tab auf erste Website navigieren, falls noch nicht dort
  // (nur wenn vom Nutzer aktiviert – erweiterbar)
}

// ─── Alarm-Setup ────────────────────────────────────────────────────────────

async function setupAlarm(intervalMinutes) {
  await chrome.alarms.clear('pollKioskManager');
  chrome.alarms.create('pollKioskManager', {
    delayInMinutes: 0.1,
    periodInMinutes: Math.max(1, intervalMinutes || 1)
  });
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'pollKioskManager') {
    await pollKioskManager();
  }
});

// ─── Startup ────────────────────────────────────────────────────────────────

chrome.runtime.onStartup.addListener(async () => {
  const settings = await chrome.storage.sync.get({ pollInterval: 1 });
  await setupAlarm(settings.pollInterval);
  await pollKioskManager();
});

chrome.runtime.onInstalled.addListener(async () => {
  const settings = await chrome.storage.sync.get({ pollInterval: 1 });
  await setupAlarm(settings.pollInterval);
  // Demo-Script beim ersten Start anlegen
  const data = await chrome.storage.local.get({ scripts: [] });
  if (data.scripts.length === 0) {
    await chrome.storage.local.set({
      scripts: [
        {
          id: 'example-powerbi',
          name: 'PowerBI Login (Beispiel)',
          urlPattern: '*://login.microsoftonline.com/*',
          enabled: false,
          content: [
            '// PowerBI / Microsoft Login Automation',
            '// URL-Muster: *://login.microsoftonline.com/*',
            '//',
            '// WICHTIG: Zugangsdaten vor Aktivierung anpassen!',
            '',
            'cy.log("Starte Microsoft Login...");',
            '',
            '// E-Mail eingeben',
            'cy.get(\'input[type="email"]\').type("IHR_LOGIN@example.com");',
            'cy.get(\'input[type="submit"]\').click();',
            '',
            'cy.wait(2000);',
            '',
            '// Passwort eingeben',
            'cy.get(\'input[type="password"]\').type("IHR_PASSWORT");',
            'cy.get(\'input[type="submit"]\').click();',
            '',
            'cy.wait(3000);',
            '',
            '// "Angemeldet bleiben?" - Nein klicken (optional)',
            '// cy.get("#idBtn_Back").click();',
            '',
            'cy.log("Login abgeschlossen");'
          ].join('\n')
        }
      ]
    });
  }
});

// ─── Script-Ausführung ──────────────────────────────────────────────────────

async function runScriptOnTab(scriptName, tabId) {
  const data = await chrome.storage.local.get({ scripts: [] });
  const script = data.scripts.find(s => s.name === scriptName);
  if (!script) throw new Error(`Script "${scriptName}" nicht gefunden`);

  let targetTabId = tabId;
  if (!targetTabId) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) throw new Error('Kein aktiver Tab gefunden');
    targetTabId = tab.id;
  }

  await chrome.tabs.sendMessage(targetTabId, {
    action: 'runScript',
    scriptContent: script.content,
    scriptName: script.name
  });
}

// ─── Message Handler ────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      switch (message.action) {

        case 'getStatus': {
          const local = await chrome.storage.local.get([
            'browserId', 'lastPoll', 'connectionError',
            'connectionStatus', 'currentPlaylist', 'groupName'
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

        case 'updateAlarm': {
          await setupAlarm(message.interval);
          sendResponse({ success: true });
          break;
        }

        case 'runScript':
          await runScriptOnTab(message.scriptName, message.tabId);
          sendResponse({ success: true });
          break;

        case 'scriptCompleted':
          // Logging für spätere Erweiterungen
          console.log(`[KioskCmd] Script "${message.scriptName}" abgeschlossen:`,
            message.success ? 'OK' : message.error);
          sendResponse({ success: true });
          break;

        default:
          sendResponse({ success: false, error: 'Unbekannte Aktion: ' + message.action });
      }
    } catch (err) {
      sendResponse({ success: false, error: err.message });
    }
  })();
  return true; // Asynchrone Antwort
});
