// content-script.js - Cypress-ähnliche Browser-Automatisierung
// Wird auf allen Seiten injiziert. Führt Automation-Scripts aus.

'use strict';

// ─── CyRunner: Cypress-ähnliche API ────────────────────────────────────────

class CyRunner {
  constructor() {
    this._queue = [];
    this._subject = null;
  }

  // Internen Befehl zur Queue hinzufügen
  _enqueue(label, fn) {
    this._queue.push({ label, fn });
    return this;
  }

  // Queue sequenziell ausführen
  async _execute() {
    this._subject = null;
    for (const cmd of this._queue) {
      console.debug(`[KioskCmd] ▶ ${cmd.label}`);
      await cmd.fn.call(this);
    }
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  /** Navigiert zur angegebenen URL */
  visit(url) {
    return this._enqueue(`visit(${url})`, async () => {
      window.location.href = url;
      // Kurze Wartezeit, danach übernimmt das Script auf der Zielseite per URL-Pattern
      await this._wait(1000);
    });
  }

  // ── Element-Selektion ─────────────────────────────────────────────────────

  /** Findet Element per CSS-Selektor (wartet bis es erscheint) */
  get(selector, options = {}) {
    return this._enqueue(`get("${selector}")`, async () => {
      const timeout = options.timeout || 10000;
      this._subject = await this._waitForSelector(selector, timeout);
    });
  }

  /** Findet Element per sichtbarem Text */
  contains(text, options = {}) {
    return this._enqueue(`contains("${text}")`, async () => {
      const timeout = options.timeout || 10000;
      this._subject = await this._waitForText(text, timeout);
    });
  }

  // ── Aktionen ──────────────────────────────────────────────────────────────

  /** Klickt das aktuelle Element */
  click(options = {}) {
    return this._enqueue('click()', async () => {
      this._requireSubject('click');
      this._subject.click();
      await this._wait(options.wait !== false ? 300 : 0);
    });
  }

  /** Tippt Text in das aktuelle Element (funktioniert mit React/Angular/Vue) */
  type(text, options = {}) {
    return this._enqueue(`type("${String(text).substring(0, 30)}${text.length > 30 ? '...' : ''}")`, async () => {
      this._requireSubject('type');
      const delay = options.delay !== undefined ? options.delay : 30;

      // Feld fokussieren und ggf. vorher leeren
      this._subject.focus();
      if (options.clear !== false) {
        this._subject.value = '';
        this._subject.dispatchEvent(new Event('input', { bubbles: true }));
      }

      // Zeichen für Zeichen eingeben (natürlich, für React/SPA kompatibel)
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

  /** Leert das aktuelle Eingabefeld */
  clear() {
    return this._enqueue('clear()', async () => {
      this._requireSubject('clear');
      this._subject.focus();
      this._subject.value = '';
      this._subject.dispatchEvent(new Event('input', { bubbles: true }));
      this._subject.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }

  /** Drückt Enter auf dem aktuellen Element */
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

  /** Setzt den Wert eines Select-Elements */
  select(value) {
    return this._enqueue(`select("${value}")`, async () => {
      this._requireSubject('select');
      this._subject.value = value;
      this._subject.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }

  /** Setzt / entfernt Häkchen bei einer Checkbox */
  check(state = true) {
    return this._enqueue(`check(${state})`, async () => {
      this._requireSubject('check');
      if (this._subject.checked !== state) {
        this._subject.click();
      }
    });
  }

  // ── Warten ────────────────────────────────────────────────────────────────

  /** Wartet eine bestimmte Zeit (in Millisekunden) */
  wait(ms) {
    return this._enqueue(`wait(${ms}ms)`, () => this._wait(ms));
  }

  /** Wartet bis die URL ein bestimmtes Muster enthält */
  waitForUrl(pattern, timeout = 15000) {
    return this._enqueue(`waitForUrl("${pattern}")`, async () => {
      const start = Date.now();
      while (Date.now() - start < timeout) {
        if (window.location.href.includes(pattern)) return;
        await this._wait(300);
      }
      throw new Error(`URL enthielt "${pattern}" nicht nach ${timeout}ms. Aktuelle URL: ${window.location.href}`);
    });
  }

  /** Wartet bis ein Element verschwindet */
  waitForHidden(selector, timeout = 10000) {
    return this._enqueue(`waitForHidden("${selector}")`, async () => {
      const start = Date.now();
      while (Date.now() - start < timeout) {
        const el = document.querySelector(selector);
        if (!el || el.offsetParent === null) return;
        await this._wait(200);
      }
      throw new Error(`Element "${selector}" wurde nicht ausgeblendet nach ${timeout}ms`);
    });
  }

  // ── Assertions ────────────────────────────────────────────────────────────

  /** Prüft eine Bedingung am aktuellen Element */
  should(assertion, ...args) {
    return this._enqueue(`should("${assertion}")`, async () => {
      switch (assertion) {
        case 'exist':
          if (!this._subject) throw new Error('Element sollte existieren, wurde aber nicht gefunden');
          break;
        case 'not.exist':
          if (this._subject) throw new Error('Element sollte nicht existieren, wurde aber gefunden');
          break;
        case 'be.visible':
          if (!this._subject || this._subject.offsetParent === null)
            throw new Error('Element sollte sichtbar sein, ist es aber nicht');
          break;
        case 'be.disabled':
          if (!this._subject?.disabled)
            throw new Error('Element sollte deaktiviert sein, ist es aber nicht');
          break;
        case 'have.value':
          if (this._subject?.value !== args[0])
            throw new Error(`Erwarteter Wert "${args[0]}", tatsächlicher Wert: "${this._subject?.value}"`);
          break;
        case 'contain':
          if (!this._subject?.textContent.includes(args[0]))
            throw new Error(`Text "${args[0]}" nicht im Element gefunden`);
          break;
        default:
          console.warn(`[KioskCmd] Unbekannte Assertion: ${assertion}`);
      }
    });
  }

  // ── Logging & Debug ───────────────────────────────────────────────────────

  /** Gibt eine Nachricht in die Browser-Konsole aus */
  log(message) {
    return this._enqueue(`log("${message}")`, () => {
      console.log(`[KioskCmd] 📋 ${message}`);
    });
  }

  /** Gibt den aktuellen Seitentitel in die Konsole aus */
  title() {
    return this._enqueue('title()', () => {
      console.log(`[KioskCmd] 📋 Seitentitel: ${document.title}`);
    });
  }

  // ── Private Hilfsmethoden ─────────────────────────────────────────────────

  _wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  _requireSubject(cmdName) {
    if (!this._subject) {
      throw new Error(`${cmdName}() aufgerufen ohne vorheriges cy.get() oder cy.contains()`);
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
            `Selektor "${selector}" nicht gefunden nach ${timeout}ms`
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
        // Alle interaktiven und Text-Elemente durchsuchen
        const candidates = document.querySelectorAll(
          'button, a, label, span, p, h1, h2, h3, h4, h5, li, td, th, div'
        );
        for (const el of candidates) {
          // Nur Blatt-ähnliche Elemente (wenig Kinder) oder exakter Match
          if (el.textContent.trim() === text ||
              (el.children.length === 0 && el.textContent.includes(text))) {
            return resolve(el);
          }
        }
        if (Date.now() - start > timeout) {
          return reject(new Error(`Element mit Text "${text}" nicht gefunden nach ${timeout}ms`));
        }
        setTimeout(check, 200);
      };
      check();
    });
  }
}

// ─── Script-Ausführung ──────────────────────────────────────────────────────

async function executeScript(content, name) {
  console.log(`[KioskCmd] 🚀 Starte Script: "${name}"`);
  const cy = new CyRunner();

  // Script mit cy als Argument ausführen
  // new Function() läuft im Isolated World der Extension – sicher
  const scriptFn = new Function('cy', content);
  scriptFn(cy);

  // Alle Befehle in der Queue sequenziell abarbeiten
  await cy._execute();
  console.log(`[KioskCmd] ✅ Script "${name}" erfolgreich abgeschlossen`);
}

// ─── Auto-Trigger: URL-Pattern-Erkennung ────────────────────────────────────

async function checkAutoTrigger() {
  const currentUrl = window.location.href;

  // Nicht auf Extension-Seiten oder Chrome-internen Seiten triggern
  if (currentUrl.startsWith('chrome') || currentUrl.startsWith('about:')) return;

  let data;
  try {
    data = await chrome.storage.local.get({ scripts: [], remoteScripts: [] });
  } catch (err) {
    // Storage-Zugriff kann scheitern auf manchen Seiten
    return;
  }

  // Remote-Scripts (vom Kiosk Manager) haben Vorrang vor lokalen Scripts.
  // Lokale Scripts mit gleichem Namen werden übersprungen wenn ein Remote-Script zuerst matched.
  const remoteScripts = (data.remoteScripts || [])
    .filter(s => s.url_pattern)
    .map(s => ({ name: s.name, urlPattern: s.url_pattern, content: s.content, enabled: true, _source: 'remote' }));

  const localScripts = (data.scripts || [])
    .filter(s => s.enabled !== false && s.urlPattern)
    .map(s => ({ ...s, _source: 'local' }));

  // Remote zuerst, dann lokal – bei Namensgleichheit gewinnt remote
  const remoteNames = new Set(remoteScripts.map(s => s.name));
  const allScripts = [
    ...remoteScripts,
    ...localScripts.filter(s => !remoteNames.has(s.name))
  ];

  for (const script of allScripts) {
    try {
      // Wildcard-Pattern (* → .*) zu RegExp konvertieren
      const regexStr = script.urlPattern
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*');

      if (new RegExp(`^${regexStr}$`).test(currentUrl) ||
          new RegExp(regexStr).test(currentUrl)) {

        const source = script._source === 'remote' ? '☁ remote' : '💾 lokal';
        console.log(`[KioskCmd] 🔍 Auto-Trigger [${source}]: Script "${script.name}" für: ${currentUrl}`);

        // Kurz warten damit Seite fertig lädt, dann ausführen
        setTimeout(async () => {
          try {
            await executeScript(script.content, script.name);
            chrome.runtime.sendMessage({
              action: 'scriptCompleted',
              scriptName: script.name,
              success: true
            }).catch(() => {});
          } catch (err) {
            console.error(`[KioskCmd] ❌ Auto-Script "${script.name}" fehlgeschlagen:`, err.message);
            chrome.runtime.sendMessage({
              action: 'scriptCompleted',
              scriptName: script.name,
              success: false,
              error: err.message
            }).catch(() => {});
          }
        }, 800);

        break; // Immer nur das erste passende Script ausführen
      }
    } catch (err) {
      console.warn(`[KioskCmd] Ungültiges URL-Pattern in Script "${script.name}":`, err.message);
    }
  }
}

// ─── Message-Handler ────────────────────────────────────────────────────────

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
    return true; // Asynchrone Antwort
  }

  if (message.action === 'ping') {
    sendResponse({ success: true, url: window.location.href, title: document.title });
  }
});

// ─── Start ──────────────────────────────────────────────────────────────────

// Nach DOMContentLoaded auto-trigger prüfen
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', checkAutoTrigger);
} else {
  checkAutoTrigger();
}
