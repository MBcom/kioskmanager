// popup.js

let timerInterval = null;
let refreshInterval = null;

document.addEventListener('DOMContentLoaded', async () => {
  await refresh();

  // Auto-refresh the playlist panel every 2 s so the display stays in sync
  // with what the background service worker is actually doing.
  refreshInterval = setInterval(() => loadPlaylist(), 2000);
  window.addEventListener('unload', () => {
    clearInterval(refreshInterval);
    clearInterval(timerInterval);
  });

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
  await Promise.all([loadStatus(), loadPlaylist(), loadScripts()]);
}

// ─── Status ──────────────────────────────────────────────────────────────────

async function loadStatus() {
  const r = await chrome.runtime.sendMessage({ action: 'getStatus' });

  const bid = r.browserId || '–';
  const bidEl = document.getElementById('browserId');
  bidEl.textContent = bid.substring(0, 8) + '…';
  bidEl.title = 'Klicken zum Kopieren: ' + bid;
  bidEl.style.cursor = 'pointer';
  bidEl.onclick = () => navigator.clipboard.writeText(bid).then(() => {
    bidEl.textContent = 'Kopiert ✓';
    setTimeout(() => { bidEl.textContent = bid.substring(0, 8) + '…'; }, 1500);
  });

  const kmUrl = r.settings?.kioskManagerUrl || '';
  const kmEl = document.getElementById('kmUrl');
  kmEl.textContent = kmUrl || 'Not configured';
  if (kmUrl && r.connectionStatus === 'ok') {
    kmEl.title = 'Auto-detected';
  }

  if (r.lastPoll) {
    document.getElementById('lastPoll').textContent = new Date(r.lastPoll).toLocaleTimeString();
  }

  if (r.groupName) {
    document.getElementById('groupRow').style.display = '';
    document.getElementById('groupName').textContent = r.groupName;
  }

  const dot = document.getElementById('statusDot');
  const status = r.connectionStatus || 'disabled';
  dot.className = 'status-dot ' + status;
  dot.title = { ok: 'Connected', error: 'Connection error', disabled: 'Disabled' }[status] || status;

  const banner = document.getElementById('errorBanner');
  if (r.connectionError) {
    banner.style.display = '';
    document.getElementById('errorMsg').textContent = r.connectionError;
  } else {
    banner.style.display = 'none';
  }
}

// ─── Playlist ────────────────────────────────────────────────────────────────

async function loadPlaylist() {
  const r = await chrome.runtime.sendMessage({ action: 'getStatus' });
  const playlist = r.playlist || [];

  document.getElementById('playlistCount').textContent = playlist.length || '';
  document.getElementById('playlistEmpty').style.display   = playlist.length === 0 ? '' : 'none';
  document.getElementById('playlistRunning').style.display = (playlist.length > 0 && r.playlistActive)  ? '' : 'none';
  document.getElementById('playlistStopped').style.display = (playlist.length > 0 && !r.playlistActive) ? '' : 'none';

  if (playlist.length > 0 && r.playlistActive) {
    const item = playlist[r.currentIndex ?? 0];
    document.getElementById('currentItemTitle').textContent = item?.title || item?.url || '–';
    startProgressTimer(r.currentItemStart, r.currentItemDuration);
  }

  if (timerInterval && !r.playlistActive) {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  // Buttons verdrahten (bei jedem Refresh neu, da DOM neu gerendert)
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  const startBtn = document.getElementById('startBtn');
  const stopBtn  = document.getElementById('stopBtn');
  const prevBtn  = document.getElementById('prevBtn');
  const nextBtn  = document.getElementById('nextBtn');

  if (startBtn) {
    startBtn.onclick = async () => {
      await chrome.runtime.sendMessage({ action: 'startPlaylist', tabId: tab?.id });
      await refresh();
    };
  }
  if (stopBtn) {
    stopBtn.onclick = async () => {
      await chrome.runtime.sendMessage({ action: 'stopPlaylist' });
      await refresh();
    };
  }
  if (prevBtn) {
    prevBtn.onclick = async () => {
      await chrome.runtime.sendMessage({ action: 'playlistPrev', tabId: tab?.id });
      setTimeout(refresh, 500);
    };
  }
  if (nextBtn) {
    nextBtn.onclick = async () => {
      await chrome.runtime.sendMessage({ action: 'playlistNext', tabId: tab?.id });
      setTimeout(refresh, 500);
    };
  }
}

function startProgressTimer(startTs, durationSec) {
  if (timerInterval) clearInterval(timerInterval);

  const update = () => {
    if (!startTs || !durationSec) return;
    const elapsed = (Date.now() - startTs) / 1000;
    const remaining = Math.max(0, durationSec - elapsed);
    const pct = Math.min(100, (elapsed / durationSec) * 100);

    const bar = document.getElementById('progressBar');
    const timer = document.getElementById('playlistTimer');
    if (bar)   bar.style.width = pct + '%';
    if (timer) timer.textContent = formatTime(remaining) + ' remaining';
  };

  update();
  timerInterval = setInterval(update, 1000);
}

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

// ─── Scripts ─────────────────────────────────────────────────────────────────

async function loadScripts() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const currentUrl = tab?.url || '';

  const data = await chrome.storage.local.get({ scripts: [], remoteScripts: [] });

  const remoteScripts = (data.remoteScripts || []).map(s => ({
    id: '_remote_' + s.name,
    name: s.name,
    urlPattern: s.url_pattern || '',
    content: s.content,
    enabled: true,
    _source: 'remote'
  }));

  const remoteNames = new Set(remoteScripts.map(s => s.name));
  const allScripts = [
    ...remoteScripts,
    ...(data.scripts || [])
      .map(s => ({ ...s, _source: 'local' }))
      .filter(s => !remoteNames.has(s.name))
  ];

  const matchesUrl = (pattern) => {
    if (!pattern) return true;
    try {
      const re = new RegExp(pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*'));
      return re.test(currentUrl);
    } catch { return false; }
  };

  const matching = allScripts.filter(s => s.enabled !== false && matchesUrl(s.urlPattern));

  const container = document.getElementById('scriptsList');
  const countEl   = document.getElementById('scriptsCount');
  countEl.textContent = matching.length || '';
  container.innerHTML = '';

  if (matching.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'scripts-empty';
    empty.textContent = allScripts.length > 0
      ? `${allScripts.length} script(s) – none matches the current URL`
      : 'No scripts yet. Open Settings to create one.';
    container.appendChild(empty);
    return;
  }

  for (const script of matching) {
    const item = document.createElement('div');
    item.className = 'script-item';
    const isAuto = matchesUrl(script.urlPattern) && !!script.urlPattern;
    item.innerHTML = `
      <div class="script-item-info">
        <span class="script-item-name">${escHtml(script.name)}</span>
        <span class="script-item-pattern ${isAuto ? 'auto' : ''}">
          ${script._source === 'remote' ? '<span title="From Kiosk Manager">☁</span> ' : ''}${script.urlPattern
            ? (isAuto ? '⚡ auto: ' : '') + escHtml(script.urlPattern)
            : '⚙ manual'}
        </span>
      </div>
      <button class="btn-run">▶ Run</button>
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
      setTimeout(() => { btn.textContent = '▶ Run'; btn.className = 'btn-run'; btn.disabled = false; }, 2500);
    });

    container.appendChild(item);
  }
}

function escHtml(str) {
  return String(str).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
