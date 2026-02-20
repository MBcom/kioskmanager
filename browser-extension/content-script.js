// content-script.js - Cypress-like browser automation
// Injected on all pages. Executes automation scripts.

'use strict';

// ─── CyRunner: Cypress-like API ────────────────────────────────────────────

class CyRunner {
  constructor() {
    this._queue = [];
    this._subject = null;
  }

  // Add internal command to the queue
  _enqueue(label, fn) {
    this._queue.push({ label, fn });
    return this;
  }

  // Execute queue sequentially
  async _execute() {
    this._subject = null;
    for (const cmd of this._queue) {
      console.debug(`[KioskCmd] ▶ ${cmd.label}`);
      await cmd.fn.call(this);
    }
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  /** Navigates to the specified URL */
  visit(url) {
    return this._enqueue(`visit(${url})`, async () => {
      window.location.href = url;
      // Brief wait, then the script on the target page takes over via URL pattern
      await this._wait(1000);
    });
  }

  // ── Element Selection ─────────────────────────────────────────────────────

  /** Finds element by CSS selector (waits until it appears) */
  get(selector, options = {}) {
    return this._enqueue(`get("${selector}")`, async () => {
      const timeout = options.timeout || 10000;
      this._subject = await this._waitForSelector(selector, timeout);
    });
  }

  /** Finds element by visible text */
  contains(text, options = {}) {
    return this._enqueue(`contains("${text}")`, async () => {
      const timeout = options.timeout || 10000;
      this._subject = await this._waitForText(text, timeout);
    });
  }

  // ── Actions ──────────────────────────────────────────────────────────────

  /** Clicks the current element */
  click(options = {}) {
    return this._enqueue('click()', async () => {
      this._requireSubject('click');
      this._subject.click();
      await this._wait(options.wait !== false ? 300 : 0);
    });
  }

  /** Types text into the current element (works with React/Angular/Vue) */
  type(text, options = {}) {
    return this._enqueue(`type("${String(text).substring(0, 30)}${text.length > 30 ? '...' : ''}")`, async () => {
      this._requireSubject('type');
      const delay = options.delay !== undefined ? options.delay : 30;

      // Focus field and optionally clear it first
      this._subject.focus();
      if (options.clear !== false) {
        this._subject.value = '';
        this._subject.dispatchEvent(new Event('input', { bubbles: true }));
      }

      // Enter character by character (natural, compatible with React/SPA)
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, 'value'
      )?.set;

      for (const char of String(text)) {
        this._subject.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
        if (nativeInputValueSetter) {
          nativeInputValueSetter.call(this._subject, this._subject.value + char);
        } else {
          this._subject.value += char;
        }
        this._subject.dispatchEvent(new Event('input', { bubbles: true }));
        this._subject.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true }));
        if (delay > 0) await this._wait(delay);
      }

      this._subject.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }

  /** Clears the current input field */
  clear() {
    return this._enqueue('clear()', async () => {
      this._requireSubject('clear');
      this._subject.focus();
      this._subject.value = '';
      this._subject.dispatchEvent(new Event('input', { bubbles: true }));
      this._subject.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }

  /** Presses Enter on the current element */
  pressEnter() {
    return this._enqueue('pressEnter()', async () => {
      this._requireSubject('pressEnter');
      const opts = { key: 'Enter', keyCode: 13, which: 13, bubbles: true };
      this._subject.dispatchEvent(new KeyboardEvent('keydown', opts));
      this._subject.dispatchEvent(new KeyboardEvent('keypress', opts));
      this._subject.dispatchEvent(new KeyboardEvent('keyup', opts));
      await this._wait(300);
    });
  }

  /** Sets the value of a select element */
  select(value) {
    return this._enqueue(`select("${value}")`, async () => {
      this._requireSubject('select');
      this._subject.value = value;
      this._subject.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }

  /** Sets / removes the check state of a checkbox */
  check(state = true) {
    return this._enqueue(`check(${state})`, async () => {
      this._requireSubject('check');
      if (this._subject.checked !== state) {
        this._subject.click();
      }
    });
  }

  // ── Waiting ───────────────────────────────────────────────────────────────

  /** Waits for a specified time (in milliseconds) */
  wait(ms) {
    return this._enqueue(`wait(${ms}ms)`, () => this._wait(ms));
  }

  /** Waits until the URL contains a specific pattern */
  waitForUrl(pattern, timeout = 15000) {
    return this._enqueue(`waitForUrl("${pattern}")`, async () => {
      const start = Date.now();
      while (Date.now() - start < timeout) {
        if (window.location.href.includes(pattern)) return;
        await this._wait(300);
      }
      throw new Error(`URL did not contain "${pattern}" after ${timeout}ms. Current URL: ${window.location.href}`);
    });
  }

  /** Waits until an element disappears */
  waitForHidden(selector, timeout = 10000) {
    return this._enqueue(`waitForHidden("${selector}")`, async () => {
      const start = Date.now();
      while (Date.now() - start < timeout) {
        const el = document.querySelector(selector);
        if (!el || el.offsetParent === null) return;
        await this._wait(200);
      }
      throw new Error(`Element "${selector}" was not hidden after ${timeout}ms`);
    });
  }

  // ── Assertions ────────────────────────────────────────────────────────────

  /** Checks a condition on the current element */
  should(assertion, ...args) {
    return this._enqueue(`should("${assertion}")`, async () => {
      switch (assertion) {
        case 'exist':
          if (!this._subject) throw new Error('Element should exist but was not found');
          break;
        case 'not.exist':
          if (this._subject) throw new Error('Element should not exist but was found');
          break;
        case 'be.visible':
          if (!this._subject || this._subject.offsetParent === null)
            throw new Error('Element should be visible but is not');
          break;
        case 'be.disabled':
          if (!this._subject?.disabled)
            throw new Error('Element should be disabled but is not');
          break;
        case 'have.value':
          if (this._subject?.value !== args[0])
            throw new Error(`Expected value "${args[0]}", actual value: "${this._subject?.value}"`);
          break;
        case 'contain':
          if (!this._subject?.textContent.includes(args[0]))
            throw new Error(`Text "${args[0]}" not found in element`);
          break;
        default:
          console.warn(`[KioskCmd] Unknown assertion: ${assertion}`);
      }
    });
  }

  // ── Logging & Debug ───────────────────────────────────────────────────────

  /** Outputs a message to the browser console */
  log(message) {
    return this._enqueue(`log("${message}")`, () => {
      console.log(`[KioskCmd] 📋 ${message}`);
    });
  }

  /** Outputs the current page title to the console */
  title() {
    return this._enqueue('title()', () => {
      console.log(`[KioskCmd] 📋 Page title: ${document.title}`);
    });
  }

  // ── Private Helper Methods ────────────────────────────────────────────────

  _wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /** Triggers browser autofill and notifies React/Angular about the value */
  autofill() {
    return this._enqueue('autofill()', async () => {
      this._requireSubject('autofill');
      this._subject.focus();
      this._subject.click();
      await this._wait(800); // Wait for autofill dropdown

      // React uses its own internal state – the native browser setter
      // bypasses React's control. We set the value via the native prototype setter
      // so that React recognizes the change as "coming from React itself".
      const nativeSetter = Object.getOwnPropertyDescriptor(
        Object.getPrototypeOf(this._subject), 'value'
      )?.set;
      if (nativeSetter) {
        nativeSetter.call(this._subject, this._subject.value);
      }

      this._subject.dispatchEvent(new Event('input',  { bubbles: true }));
      this._subject.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }

  /** Submits the form of the current element */
  submit() {
    return this._enqueue('submit()', async () => {
      const form = this._subject
        ? this._subject.closest('form')
        : document.querySelector('form');
      if (form) {
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        form.submit();
      }
      await this._wait(300);
    });
  }

  _requireSubject(cmdName) {
    if (!this._subject) {
      throw new Error(`${cmdName}() called without a preceding cy.get() or cy.contains()`);
    }
  }

  _waitForSelector(selector, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const check = () => {
        const el = document.querySelector(selector);
        if (el) return resolve(el);
        if (Date.now() - start > timeout) {
          return reject(new Error(
            `Selector "${selector}" not found after ${timeout}ms`
          ));
        }
        setTimeout(check, 200);
      };
      check();
    });
  }

  _waitForText(text, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const check = () => {
        // Search all interactive and text elements
        const candidates = document.querySelectorAll(
          'button, a, label, span, p, h1, h2, h3, h4, h5, li, td, th, div'
        );
        for (const el of candidates) {
          // Only leaf-like elements (few children) or exact match
          if (el.textContent.trim() === text ||
              (el.children.length === 0 && el.textContent.includes(text))) {
            return resolve(el);
          }
        }
        if (Date.now() - start > timeout) {
          return reject(new Error(`Element with text "${text}" not found after ${timeout}ms`));
        }
        setTimeout(check, 200);
      };
      check();
    });
  }
}

// ─── Script Parser (no eval / new Function – CSP-safe) ──────────────────────
//
// Parses cy.method(arg).method(arg) chains without eval.
// Supports: single and double quotes, template literals,
// numbers, booleans, nested parentheses in selectors, comments.

function _removeComments(src) {
  let out = '', i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '"' || c === "'" || c === '`') {
      const q = c; out += c; i++;
      while (i < src.length) {
        if (src[i] === '\\') { out += src[i++]; out += src[i++] || ''; continue; }
        out += src[i];
        if (src[i++] === q) break;
      }
    } else if (src.slice(i, i + 2) === '//') {
      while (i < src.length && src[i] !== '\n') i++;
    } else if (src.slice(i, i + 2) === '/*') {
      i += 2;
      while (i < src.length && src.slice(i, i + 2) !== '*/') i++;
      i += 2;
    } else {
      out += c; i++;
    }
  }
  return out;
}

function _splitStatements(src) {
  const stmts = []; let cur = '', depth = 0, inStr = null;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inStr) {
      cur += c;
      if (c === '\\') { cur += src[++i] || ''; }
      else if (c === inStr) inStr = null;
    } else if (c === '"' || c === "'" || c === '`') { inStr = c; cur += c; }
    else if (c === '(' || c === '[' || c === '{') { depth++; cur += c; }
    else if (c === ')' || c === ']' || c === '}') { depth--; cur += c; }
    else if ((c === ';' || c === '\n') && depth === 0) {
      const t = cur.trim(); if (t) stmts.push(t); cur = '';
    } else { cur += c; }
  }
  const t = cur.trim(); if (t) stmts.push(t);
  return stmts;
}

function _extractArgs(s) {
  let depth = 0, inStr = null, i = 0;
  for (; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (c === '\\') { i++; continue; }
      if (c === inStr) inStr = null;
    } else if (c === '"' || c === "'" || c === '`') { inStr = c; }
    else if (c === '(') { depth++; }
    else if (c === ')') {
      if (depth === 0) return { argsStr: s.slice(0, i), rest: s.slice(i + 1) };
      depth--;
    }
  }
  return { argsStr: s, rest: '' };
}

function _coerce(s) {
  s = s.trim();
  if (!s) return undefined;
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (s === 'null') return null;
  if ((s.startsWith('"') && s.endsWith('"')) ||
      (s.startsWith("'") && s.endsWith("'")) ||
      (s.startsWith('`') && s.endsWith('`'))) {
    return s.slice(1, -1)
      .replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\r/g, '\r')
      .replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  return s;
}

function _parseArgList(argsStr) {
  argsStr = argsStr.trim();
  if (!argsStr) return [];
  const parts = []; let cur = '', depth = 0, inStr = null;
  for (let i = 0; i < argsStr.length; i++) {
    const c = argsStr[i];
    if (inStr) {
      cur += c;
      if (c === '\\') { cur += argsStr[++i] || ''; }
      else if (c === inStr) inStr = null;
    } else if (c === '"' || c === "'" || c === '`') { inStr = c; cur += c; }
    else if ('([{'.includes(c)) { depth++; cur += c; }
    else if (')]}'.includes(c)) { depth--; cur += c; }
    else if (c === ',' && depth === 0) { parts.push(_coerce(cur)); cur = ''; }
    else { cur += c; }
  }
  if (cur.trim() || parts.length > 0) parts.push(_coerce(cur));
  return parts;
}

function _parseChain(stmt) {
  stmt = stmt.trim();
  if (!stmt.startsWith('cy.') && !stmt.startsWith('.')) return null;
  let s = stmt.startsWith('cy.') ? stmt.slice(3) : stmt.slice(1);
  const calls = [];
  while (s.length > 0) {
    const pi = s.indexOf('(');
    if (pi === -1) break;
    const method = s.slice(0, pi).trim();
    if (!method || method.includes(' ')) break;
    s = s.slice(pi + 1);
    const { argsStr, rest } = _extractArgs(s);
    s = rest;
    calls.push({ method, args: _parseArgList(argsStr) });
    if (s.startsWith('.')) s = s.slice(1); else break;
  }
  return calls.length > 0 ? calls : null;
}

function parseScript(source) {
  const stmts = _splitStatements(_removeComments(source));
  const all = [];
  for (const stmt of stmts) {
    const calls = _parseChain(stmt);
    if (calls) all.push(...calls);
  }
  return all;
}

// ─── Script Execution ───────────────────────────────────────────────────────

window.__kioskRunScript = (content, name) => executeScript(content, name);

async function executeScript(content, name) {
  console.log(`[KioskCmd] 🚀 Starting script: "${name}"`);
  const calls = parseScript(content);
  const cy = new CyRunner();

  for (const { method, args } of calls) {
    const [a0, ...rest] = args;
    switch (method) {
      case 'get':           cy.get(a0); break;
      case 'contains':      cy.contains(a0); break;
      case 'click':         cy.click(); break;
      case 'type':          cy.type(a0); break;
      case 'clear':         cy.clear(); break;
      case 'pressEnter':    cy.pressEnter(); break;
      case 'wait':          cy.wait(a0); break;
      case 'waitForUrl':    cy.waitForUrl(a0); break;
      case 'waitForHidden': cy.waitForHidden(a0); break;
      case 'visit':         cy.visit(a0); break;
      case 'log':           cy.log(a0); break;
      case 'should':        cy.should(a0, ...rest); break;
      case 'select':        cy.select(a0); break;
      case 'check':         cy.check(a0); break;
      case 'title':         cy.title(); break;
      case 'autofill':      cy.autofill(); break;
      case 'submit':        cy.submit(); break;
      default: console.warn(`[KioskCmd] Unknown command: cy.${method}()`);
    }
  }

  await cy._execute();
  console.log(`[KioskCmd] ✅ Script "${name}" completed`);
}

// ─── Auto-Trigger: URL Pattern Detection ────────────────────────────────────

async function checkAutoTrigger() {
  const currentUrl = window.location.href;

  // Do not trigger on extension pages or Chrome-internal pages
  if (currentUrl.startsWith('chrome') || currentUrl.startsWith('about:')) return;

  let data;
  try {
    data = await chrome.storage.local.get({ scripts: [], remoteScripts: [] });
  } catch (err) {
    // Storage access can fail on some pages
    return;
  }

  // Remote scripts (from Kiosk Manager) take precedence over local scripts.
  // Local scripts with the same name are skipped if a remote script matches first.
  const remoteScripts = (data.remoteScripts || [])
    .filter(s => s.url_pattern)
    .map(s => ({ name: s.name, urlPattern: s.url_pattern, content: s.content, enabled: true, _source: 'remote' }));

  const localScripts = (data.scripts || [])
    .filter(s => s.enabled !== false && s.urlPattern)
    .map(s => ({ ...s, _source: 'local' }));

  // Remote first, then local – remote wins on name collision
  const remoteNames = new Set(remoteScripts.map(s => s.name));
  const allScripts = [
    ...remoteScripts,
    ...localScripts.filter(s => !remoteNames.has(s.name))
  ];

  for (const script of allScripts) {
    try {
      // Convert wildcard pattern (* → .*) to RegExp
      const regexStr = script.urlPattern
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*');

      if (new RegExp(`^${regexStr}$`).test(currentUrl) ||
          new RegExp(regexStr).test(currentUrl)) {

        const source = script._source === 'remote' ? '☁ remote' : '💾 local';
        console.log(`[KioskCmd] 🔍 Auto-Trigger [${source}]: Script "${script.name}" for: ${currentUrl}`);

        // Brief wait for page to finish loading, then execute
        setTimeout(async () => {
          try {
            await executeScript(script.content, script.name);
            chrome.runtime.sendMessage({
              action: 'scriptCompleted',
              scriptName: script.name,
              success: true
            }).catch(() => {});
          } catch (err) {
            console.error(`[KioskCmd] ❌ Auto-Script "${script.name}" failed:`, err.message);
            chrome.runtime.sendMessage({
              action: 'scriptCompleted',
              scriptName: script.name,
              success: false,
              error: err.message
            }).catch(() => {});
          }
        }, 800);

        break; // Always execute only the first matching script
      }
    } catch (err) {
      console.warn(`[KioskCmd] Invalid URL pattern in script "${script.name}":`, err.message);
    }
  }
}

// ─── Message Handler ────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'runScript') {
    executeScript(message.scriptContent, message.scriptName)
      .then(() => {
        chrome.runtime.sendMessage({
          action: 'scriptCompleted',
          scriptName: message.scriptName,
          success: true
        }).catch(() => {});
        sendResponse({ success: true });
      })
      .catch(err => {
        chrome.runtime.sendMessage({
          action: 'scriptCompleted',
          scriptName: message.scriptName,
          success: false,
          error: err.message
        }).catch(() => {});
        sendResponse({ success: false, error: err.message });
      });
    return true; // Asynchronous response
  }

  if (message.action === 'ping') {
    sendResponse({ success: true, url: window.location.href, title: document.title });
  }
});

// ─── Player Page: Pass Browser ID to Extension ───────────────────────────────

// If this page is the Kiosk Manager player (/play/), we read the
// browserDisplayIdentifier from localStorage and pass it to the background.
// This way the extension uses the same UUID as the player – the browser
// is already registered in the Kiosk Manager database and possibly assigned to a group.
function checkIfPlayerPage() {
  const path = window.location.pathname.replace(/\/$/, '');
  if (!path.endsWith('/play')) return;

  // localStorage is accessible in the isolated world of the content script
  const playerId = localStorage.getItem('browserDisplayIdentifier');
  if (!playerId) return;

  console.log('[KioskCmd] 🎬 Player page detected, passing browser ID:', playerId.substring(0, 8) + '…');

  chrome.runtime.sendMessage({
    action: 'setPlayerBrowserId',
    browserId: playerId,
  }).catch(() => {});
}

// ─── Start ───────────────────────────────────────────────────────────────────

function onReady() {
  checkIfPlayerPage();
  checkAutoTrigger();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', onReady);
} else {
  onReady();
}
