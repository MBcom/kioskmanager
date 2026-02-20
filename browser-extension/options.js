// options.js – Script-Management und Einstellungen

'use strict';

// ─── Snippets ───────────────────────────────────────────────────────────────

const SNIPPETS = {
  'powerbi': `// PowerBI / Microsoft Login Automation
// URL pattern for this script: *://login.microsoftonline.com/*
// Uses browser-saved credentials – no passwords needed in the script

cy.log("Starting Microsoft login...");

cy.wait(1000); // wait for browser autofill
cy.get('#idSIButton9').click();  // Next (email already filled)
cy.wait(2000);
cy.get('#idSIButton9').click();  // Sign in (password already filled)
cy.wait(3000);
cy.get('#idBtn_Back').click();   // Stay signed in? → No

cy.log("Login complete ✓");`,

  'get-type': `cy.get('input[name="email"]').type("user@example.com");`,

  'get-click': `cy.get('button[type="submit"]').click();`,

  'wait': `cy.wait(2000); // wait 2 seconds`,

  'waitForUrl': `cy.waitForUrl("app.powerbi.com"); // wait until URL contains this text`,
};

// ─── State ──────────────────────────────────────────────────────────────────

let scripts = [];
let currentScriptId = null;
let hasUnsavedChanges = false;

// ─── Init ────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  await Promise.all([loadSettings(), loadScripts()]);
  setupNavigation();
  setupSettingsHandlers();
  setupScriptHandlers();
  setupSnippets();
});

// ─── Navigation ─────────────────────────────────────────────────────────────

function setupNavigation() {
  document.querySelectorAll('.nav-item').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const section = link.dataset.section;
      document.querySelectorAll('.nav-item').forEach(l => l.classList.remove('active'));
      document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
      link.classList.add('active');
      document.getElementById(`section-${section}`).classList.add('active');
    });
  });
}

// ─── Settings ───────────────────────────────────────────────────────────────

async function loadSettings() {
  const settings = await chrome.storage.sync.get({
    kioskManagerUrl: '',
    kioskEnabled: true,
    pollInterval: 1
  });
  const local = await chrome.storage.local.get({ browserId: '' });

  document.getElementById('kioskManagerUrl').value = settings.kioskManagerUrl;
  document.getElementById('kioskEnabled').checked = settings.kioskEnabled;
  document.getElementById('pollInterval').value = settings.pollInterval;
  document.getElementById('browserIdDisplay').value = local.browserId || '(generated on first use)';
}

function setupSettingsHandlers() {
  document.getElementById('saveSettingsBtn').addEventListener('click', saveSettings);
  document.getElementById('testConnectionBtn').addEventListener('click', testConnection);
  document.getElementById('copyBrowserId').addEventListener('click', () => {
    const val = document.getElementById('browserIdDisplay').value;
    navigator.clipboard.writeText(val).then(() => {
      showStatus('settingsSaveStatus', 'Copied ✓');
    });
  });
}

async function saveSettings() {
  const settings = {
    kioskManagerUrl: document.getElementById('kioskManagerUrl').value.trim().replace(/\/$/, ''),
    kioskEnabled: document.getElementById('kioskEnabled').checked,
    pollInterval: Math.max(1, parseInt(document.getElementById('pollInterval').value) || 1)
  };

  await chrome.storage.sync.set(settings);
  await chrome.runtime.sendMessage({ action: 'updateAlarm', interval: settings.pollInterval });
  showStatus('settingsSaveStatus', 'Saved ✓');
}

async function testConnection() {
  const url = document.getElementById('kioskManagerUrl').value.trim().replace(/\/$/, '');
  if (!url) {
    showStatus('settingsSaveStatus', 'No URL entered', 'error');
    return;
  }

  showStatus('settingsSaveStatus', 'Testing…');
  await chrome.runtime.sendMessage({ action: 'pollNow' });

  const result = await chrome.storage.local.get(['connectionStatus', 'connectionError']);
  if (result.connectionStatus === 'ok') {
    showStatus('settingsSaveStatus', 'Connection successful ✓');
  } else {
    showStatus('settingsSaveStatus', 'Error: ' + (result.connectionError || 'Unknown'), 'error');
  }
}

// ─── Scripts ─────────────────────────────────────────────────────────────────

async function loadScripts() {
  const data = await chrome.storage.local.get({ scripts: [] });
  scripts = data.scripts || [];
  renderList();
}

async function saveAllScripts() {
  await chrome.storage.local.set({ scripts });
  renderList();
}

function renderList() {
  const list = document.getElementById('scriptsList');
  list.innerHTML = '';

  if (scripts.length === 0) {
    list.innerHTML = '<li class="empty">No scripts yet</li>';
    return;
  }

  scripts.forEach(script => {
    const li = document.createElement('li');
    li.className = 'script-list-item' + (script.id === currentScriptId ? ' active' : '');

    const enabled = script.enabled !== false;
    li.innerHTML = `
      <div style="flex:1;overflow:hidden">
        <span class="script-list-name">${escHtml(script.name)}</span>
        <span class="script-list-meta">${script.urlPattern ? escHtml(script.urlPattern) : '⚙ manual'}</span>
      </div>
      <span class="script-status ${enabled ? 'enabled' : 'disabled'}">${enabled ? '●' : '○'}</span>
    `;
    li.addEventListener('click', () => selectScript(script.id));
    list.appendChild(li);
  });
}

function selectScript(id) {
  if (hasUnsavedChanges && currentScriptId) {
    if (!confirm('Discard unsaved changes?')) return;
    hasUnsavedChanges = false;
  }

  currentScriptId = id;
  const script = scripts.find(s => s.id === id);
  if (!script) return;

  document.getElementById('editorPlaceholder').style.display = 'none';
  document.getElementById('editorForm').style.display = 'flex';

  document.getElementById('scriptName').value = script.name;
  document.getElementById('scriptUrlPattern').value = script.urlPattern || '';
  document.getElementById('scriptEnabled').checked = script.enabled !== false;
  document.getElementById('scriptContent').value = script.content || '';

  hasUnsavedChanges = false;
  renderList();
}

function setupScriptHandlers() {
  document.getElementById('newScriptBtn').addEventListener('click', createNewScript);
  document.getElementById('saveScriptBtn').addEventListener('click', saveCurrentScript);
  document.getElementById('deleteBtn').addEventListener('click', deleteCurrentScript);
  document.getElementById('duplicateBtn').addEventListener('click', duplicateCurrentScript);
  document.getElementById('runScriptBtn').addEventListener('click', runCurrentScript);
  document.getElementById('exportBtn').addEventListener('click', exportScripts);
  document.getElementById('importFile').addEventListener('change', importScripts);

  // Track unsaved changes
  ['scriptName', 'scriptUrlPattern', 'scriptContent'].forEach(id => {
    document.getElementById(id).addEventListener('input', () => {
      hasUnsavedChanges = true;
    });
  });
  document.getElementById('scriptEnabled').addEventListener('change', () => {
    hasUnsavedChanges = true;
  });
}

function createNewScript() {
  const id = Date.now().toString(36);
  const script = {
    id,
    name: 'New Script',
    urlPattern: '',
    enabled: true,
    content: '// Enter your script here\n// cy.get(\'input\').type(\'text\');\n// cy.get(\'button\').click();\n'
  };
  scripts.unshift(script);
  saveAllScripts();
  selectScript(id);

  // Switch to Scripts tab
  document.querySelector('[data-section="scripts"]').click();
  setTimeout(() => document.getElementById('scriptName').select(), 100);
}

async function saveCurrentScript() {
  if (!currentScriptId) return;
  const idx = scripts.findIndex(s => s.id === currentScriptId);
  if (idx === -1) return;

  scripts[idx] = {
    ...scripts[idx],
    name: document.getElementById('scriptName').value.trim() || 'Unnamed',
    urlPattern: document.getElementById('scriptUrlPattern').value.trim(),
    enabled: document.getElementById('scriptEnabled').checked,
    content: document.getElementById('scriptContent').value
  };

  await saveAllScripts();
  hasUnsavedChanges = false;
  showStatus('scriptSaveStatus', 'Saved ✓');
}

async function deleteCurrentScript() {
  if (!currentScriptId) return;
  const script = scripts.find(s => s.id === currentScriptId);
  if (!confirm(`Really delete script "${script?.name}"?`)) return;

  scripts = scripts.filter(s => s.id !== currentScriptId);
  currentScriptId = null;
  hasUnsavedChanges = false;

  await saveAllScripts();
  document.getElementById('editorForm').style.display = 'none';
  document.getElementById('editorPlaceholder').style.display = '';
}

async function duplicateCurrentScript() {
  if (!currentScriptId) return;
  await saveCurrentScript(); // Save first

  const original = scripts.find(s => s.id === currentScriptId);
  if (!original) return;

  const copy = {
    ...original,
    id: Date.now().toString(36),
    name: original.name + ' (Copy)'
  };

  scripts.unshift(copy);
  await saveAllScripts();
  selectScript(copy.id);
}

async function runCurrentScript() {
  if (!currentScriptId) return;
  await saveCurrentScript();

  const script = scripts.find(s => s.id === currentScriptId);
  if (!script) return;

  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab?.id) {
    showStatus('scriptSaveStatus', 'No active tab', 'error');
    return;
  }

  try {
    await chrome.tabs.sendMessage(tab.id, {
      action: 'runScript',
      scriptContent: script.content,
      scriptName: script.name
    });
    showStatus('scriptSaveStatus', 'Started ✓');
  } catch (err) {
    // Content script not yet loaded – inject it first
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content-script.js']
      });
      await chrome.tabs.sendMessage(tab.id, {
        action: 'runScript',
        scriptContent: script.content,
        scriptName: script.name
      });
      showStatus('scriptSaveStatus', 'Started ✓');
    } catch (err2) {
      showStatus('scriptSaveStatus', 'Error: ' + err2.message, 'error');
    }
  }
}

// ─── Snippets ────────────────────────────────────────────────────────────────

function setupSnippets() {
  document.querySelectorAll('.snippet-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const snippet = SNIPPETS[btn.dataset.snippet];
      if (!snippet) return;

      const textarea = document.getElementById('scriptContent');
      const start = textarea.selectionStart;
      const before = textarea.value.substring(0, start);
      const after = textarea.value.substring(textarea.selectionEnd);

      // Insert snippet with a blank line
      const insert = (before.length > 0 && !before.endsWith('\n') ? '\n' : '') + snippet + '\n';
      textarea.value = before + insert + after;
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = (before + insert).length;
      hasUnsavedChanges = true;
    });
  });
}

// ─── Import / Export ─────────────────────────────────────────────────────────

function exportScripts() {
  const data = JSON.stringify({
    version: 1,
    exportedAt: new Date().toISOString(),
    scripts
  }, null, 2);

  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `kiosk-scripts-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function importScripts(e) {
  const file = e.target.files[0];
  if (!file) return;
  e.target.value = '';

  try {
    const text = await file.text();
    const data = JSON.parse(text);

    if (!Array.isArray(data.scripts)) throw new Error('Invalid format: "scripts" array missing');

    const newCount = data.scripts.filter(imp =>
      !scripts.some(s => s.name === imp.name)
    ).length;

    if (!confirm(`Import ${data.scripts.length} script(s)? ${newCount} new, ${data.scripts.length - newCount} already exist (will be skipped).`)) return;

    for (const imp of data.scripts) {
      const exists = scripts.findIndex(s => s.name === imp.name);
      if (exists === -1) {
        scripts.push({ ...imp, id: Date.now().toString(36) + Math.random().toString(36).slice(2) });
      }
    }

    await saveAllScripts();
    showStatus('scriptSaveStatus', `${newCount} script(s) imported ✓`);
  } catch (err) {
    showStatus('scriptSaveStatus', 'Import error: ' + err.message, 'error');
  }
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function showStatus(elementId, message, type = 'success') {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.textContent = message;
  el.className = 'save-status' + (type === 'error' ? ' error' : '');
  setTimeout(() => {
    el.textContent = '';
    el.className = 'save-status';
  }, 3500);
}

function escHtml(str) {
  return String(str).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
