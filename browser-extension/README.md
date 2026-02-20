# Kiosk Browser Command

Chrome extension for browser automation on kiosk displays. Connects to the
[Kiosk Manager](https://github.com/MBcom/kioskmanager) backend, rotates
playlist URLs as direct tab navigation, and runs Cypress-like automation
scripts – for example to handle a PowerBI login flow automatically.

---

## Features

- **Cypress-like script API** – `cy.get()`, `.click()`, `.type()`, `cy.wait()`, `cy.waitForUrl()`, etc.
- **URL-pattern trigger** – scripts start automatically when the browser navigates to a matching URL
- **Kiosk Manager integration** – connects to the Django backend, receives playlists and scripts
- **Direct tab navigation** – replaces the iframe-based player; the extension navigates the tab directly
- **Auto-detection** – detects the Kiosk Manager `/play/` page and picks up the player's browser ID from `localStorage` automatically
- **Script permissions** – only users with the `manage_automation_scripts` permission can view or edit scripts in the admin
- **Manifest V3** – modern Chrome extension API; no external dependencies; eval-free CSP-safe script execution

---

## Installation (developer mode)

1. Open Chrome → `chrome://extensions/`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select this folder

---

## Configuration

### Auto-detection

Navigate any tab to your Kiosk Manager `/play/` endpoint
(e.g. `http://kiosk-manager.example.com/play/`).  The extension will:

1. Detect the Kiosk Manager automatically
2. Read `browserDisplayIdentifier` from the page's `localStorage`
3. Save the Kiosk Manager URL in settings
4. Start polling and launch playlist rotation

No manual configuration required for kiosk displays.

### Manual configuration

Extension icon → **⚙ Settings** → enter the Kiosk Manager URL, e.g.:
```
http://kiosk-manager.example.com
```

---

## Creating scripts

### PowerBI login automation

1. Settings → **Scripts** → **+ New**
2. Name: `PowerBI Login`
3. URL pattern: `*://login.microsoftonline.com/*`
4. Script (using browser-saved credentials):

```javascript
cy.log("Starting Microsoft login...");

cy.wait(1000); // wait for browser autofill
cy.get('#idSIButton9').click();  // Next (email already filled by browser)
cy.wait(2000);
cy.get('#idSIButton9').click();  // Sign in (password already filled by browser)
cy.wait(3000);
cy.get('#idBtn_Back').click();   // Stay signed in? → No

cy.log("Login complete ✓");
```

5. Enable ✓ → **Save**

The script starts automatically whenever Chrome navigates to the
Microsoft login page.

---

## Script API

| Command | Description |
|---------|-------------|
| `cy.get(selector)` | Find element by CSS selector (waits up to 10 s) |
| `cy.contains(text)` | Find element by visible text |
| `.click()` | Click the current element |
| `.type(text)` | Type text (React / Vue / Angular compatible) |
| `.clear()` | Clear an input field |
| `.pressEnter()` | Press the Enter key |
| `.autofill()` | Trigger browser autofill and notify React of the value |
| `.select(value)` | Set a `<select>` dropdown value |
| `.check(bool)` | Check or uncheck a checkbox |
| `cy.wait(ms)` | Wait for a fixed time in milliseconds |
| `cy.waitForUrl(pattern)` | Wait until the URL contains a pattern |
| `.waitForHidden(selector)` | Wait until an element disappears |
| `.should('exist')` | Assert element exists |
| `.should('be.visible')` | Assert element is visible |
| `.should('have.value', v)` | Assert input value |
| `.should('contain', text)` | Assert element text content |
| `cy.log(msg)` | Print a message to the browser console |
| `cy.visit(url)` | Navigate to a URL |

Full interactive docs: Settings → **API Docs**

---

## Kiosk Manager integration

The extension polls `/api/playlist/?browser_id=<uuid>`.  Scripts are
attached directly to **Content Items** and returned inline with each
playlist entry:

```json
{
  "playlist": [
    {
      "id": 1,
      "type": "website",
      "url": "https://app.powerbi.com/...",
      "duration": 300,
      "scripts": [
        {
          "name": "PowerBI Login",
          "url_pattern": "*://login.microsoftonline.com/*",
          "content": "cy.get('#idSIButton9').click();"
        }
      ]
    }
  ]
}
```

### Assigning the browser

The browser registers itself on the first API call.  Assign it to a
Display Group in the Kiosk Manager admin under **Browsers**.  The
browser's UUID is shown in the extension popup (click to copy).

### Script permissions

In the Kiosk Manager admin, scripts are only visible and editable for
users who hold the
`kioskmanager | automation script | Can view and manage automation scripts`
permission (or superusers).  Assign via **Auth → Users → User permissions**.

---

## Salt formula integration

Complements the
[salt-kiosk-formula](https://github.com/MBcom/salt-kiosk-formula).
Run Chrome without `--kiosk` and load this extension instead:

```yaml
kiosk:
  chromeKioskMode: False
  additionalChromeArgs: "--load-extension=/opt/kiosk-browser-command"
  start_url: "https://kiosk-manager.example.com/play/"
```

---

## Security

- Credentials are stored in the **local Chrome profile** (`chrome.storage.local`) and never synced via Google account
- Script execution is **eval-free** – a custom DSL parser is used, making scripts safe regardless of page CSP
- For sensitive environments: prefer MFA / SSO so that no passwords need to be stored in scripts at all

---

## File structure

```
browser-extension/
├── manifest.json          # Extension manifest (MV3)
├── background.js          # Service worker: polling, browser ID, playlist rotation, auto-detection
├── content-script.js      # CyRunner API + URL-pattern auto-trigger + eval-free DSL parser
├── popup.html/js/css      # Popup UI: connection status, playlist controls, manual script run
├── options.html/js/css    # Settings: Kiosk Manager URL, script editor with snippets
└── example-scripts/
    ├── powerbi-login.js   # PowerBI / Microsoft login template
    └── generic-login.js   # Generic login template
```
