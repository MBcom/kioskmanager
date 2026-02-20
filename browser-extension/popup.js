// popup.js

document.addEventListener('DOMContentLoaded', async () => {
  await refresh();

  document.getElementById('pollBtn').addEventListener('click', async () => {
    const btn = document.getElementById('pollBtn');
    btn.disabled = true;
    await chrome.runtime.sendMessage({ action: 'pollNow' });
    await refresh();
    btn.disabled = false;
  });

  document.getElementById('optionsBtn').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
});

async function refresh() {
  await Promise.all([loadStatus(), loadScripts()]);
}

async function loadStatus() {
  const response = await chrome.runtime.sendMessage({ action: 'getStatus' });

  // Browser-ID (nur erste 8 Zeichen anzeigen)
  const bid = response.browserId || '–';
  const bidEl = document.getElementById('browserId');
  bidEl.textContent = bid.substring(0, 8) + '…';
  bidEl.title = bid;

  // Kiosk Manager URL
  const kmUrl = response.settings?.kioskManagerUrl || '';
  document.getElementById('kmUrl').textContent = kmUrl || 'Nicht konfiguriert';

  // Letzter Poll
  if (response.lastPoll) {
    const d = new Date(response.lastPoll);
    document.getElementById('lastPoll').textContent = d.toLocaleTimeString('de-DE');
  }

  // Gruppe
  if (response.groupName) {
    document.getElementById('groupRow').style.display = '';
    document.getElementById('groupName').textContent = response.groupName;
  }

  // Status-Indikator
  const dot = document.getElementById('statusDot');
  const status = response.connectionStatus || 'disabled';
  dot.className = 'status-dot ' + status;

  const titles = {
    ok: 'Verbunden',
    error: 'Verbindungsfehler',
    warning: 'Warnung',
    disabled: 'Polling deaktiviert'
  };
  dot.title = titles[status] || status;

  // Fehleranzeige
  const banner = document.getElementById('errorBanner');
  if (response.connectionError) {
    banner.style.display = '';
    document.getElementById('errorMsg').textContent = response.connectionError;
  } else {
    banner.style.display = 'none';
  }
}

async function loadScripts() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const currentUrl = tab?.url || '';

  const data = await chrome.storage.local.get({ scripts: [], remoteScripts: [] });

  // Remote-Scripts (Kiosk Manager) mit Markierung zusammenführen
  const remoteScripts = (data.remoteScripts || []).map(s => ({
    id: '_remote_' + s.name,
    name: s.name,
    urlPattern: s.url_pattern || '',
    content: s.content,
    enabled: true,
    _source: 'remote'
  }));

  const remoteNames = new Set(remoteScripts.map(s => s.name));
  const localScripts = (data.scripts || []).map(s => ({ ...s, _source: 'local' }));

  // Remote hat Vorrang; gleichnamige lokale Scripts verstecken
  const allScripts = [
    ...remoteScripts,
    ...localScripts.filter(s => !remoteNames.has(s.name))
  ];

  // Passende Scripts für aktuelle URL finden
  const matching = allScripts.filter(script => {
    if (script.enabled === false) return false;
    if (!script.urlPattern) return true; // manuell auslösbar
    try {
      const regexStr = script.urlPattern
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*');
      return new RegExp(regexStr).test(currentUrl);
    } catch {
      return false;
    }
  });

  const container = document.getElementById('scriptsList');
  const countEl = document.getElementById('scriptsCount');

  if (matching.length > 0) {
    countEl.textContent = matching.length;
  } else {
    countEl.textContent = '';
  }

  container.innerHTML = '';

  if (matching.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'scripts-empty';
    empty.textContent = allScripts.length > 0
      ? `${allScripts.length} Script(s) – keines passt zur aktuellen URL`
      : 'Noch keine Scripts. Einstellungen öffnen.';
    container.appendChild(empty);
    return;
  }

  for (const script of matching) {
    const item = document.createElement('div');
    item.className = 'script-item';

    const isAutoTrigger = script.urlPattern &&
      (() => {
        try {
          const regexStr = script.urlPattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
          return new RegExp(regexStr).test(currentUrl);
        } catch { return false; }
      })();

    item.innerHTML = `
      <div class="script-item-info">
        <span class="script-item-name">${escHtml(script.name)}</span>
        <span class="script-item-pattern ${isAutoTrigger ? 'auto' : ''}">
          ${script._source === 'remote' ? '<span title="Vom Kiosk Manager">☁</span> ' : ''}${script.urlPattern
            ? (isAutoTrigger ? '⚡ auto: ' : '') + escHtml(script.urlPattern)
            : '⚙ manuell'}
        </span>
      </div>
      <button class="btn-run" data-id="${escHtml(script.id)}">▶ Run</button>
    `;

    item.querySelector('.btn-run').addEventListener('click', async (e) => {
      if (!tab?.id) return;
      const btn = e.currentTarget;
      btn.disabled = true;
      btn.textContent = '…';

      try {
        await chrome.tabs.sendMessage(tab.id, {
          action: 'runScript',
          scriptContent: script.content,
          scriptName: script.name
        });
        btn.textContent = '✓';
        btn.className = 'btn-run success';
      } catch (err) {
        btn.textContent = '✗';
        btn.className = 'btn-run error';
        btn.title = err.message;
      }

      setTimeout(() => {
        btn.textContent = '▶ Run';
        btn.className = 'btn-run';
        btn.disabled = false;
      }, 2500);
    });

    container.appendChild(item);
  }
}

function escHtml(str) {
  return String(str).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
