# Kiosk Browser Command

Chrome-Extension zur Browser-Automatisierung für Kiosk-Displays. Verbindet sich mit dem [Kiosk Manager](https://github.com/MBcom/kioskmanager) und ermöglicht die Ausführung von Cypress-ähnlichen Automatisierungs-Scripts direkt im Browser – ohne externen Test-Runner.

**Typischer Anwendungsfall:** Automatischer Login-Workflow für PowerBI auf Kiosk-Screens.

---

## Features

- **Cypress-ähnliche Script-API** – `cy.get()`, `.click()`, `.type()`, `cy.wait()`, `cy.waitForUrl()`, etc.
- **URL-Pattern-Trigger** – Scripts starten automatisch bei passender URL (z.B. Login-Seite)
- **Kiosk Manager Integration** – Verbindet sich mit dem Django-Backend, empfängt Playlists
- **Script-Editor** – Integrierter Editor mit Snippets, Import/Export
- **Manifest V3** – Moderne Chrome Extension API, keine externen Abhängigkeiten

---

## Installation (Entwickler-Modus)

1. Chrome öffnen → `chrome://extensions/`
2. **Entwicklermodus** aktivieren (oben rechts)
3. **Entpackte Erweiterung laden** klicken
4. Diesen Ordner auswählen

---

## Konfiguration

### Kiosk Manager verbinden

1. Extension-Icon klicken → **⚙ Einstellungen**
2. Tab **Verbindung** → Kiosk Manager URL eintragen:
   ```
   https://kiosk-manager.example.com
   ```
3. **Speichern** → **Verbindung testen**

Die Extension meldet sich mit einer zufälligen Browser-ID beim Kiosk Manager an (Endpoint: `/api/playlist/?browser_id=<uuid>`). Diese ID kann in der Kiosk-Manager-Oberfläche einer Gruppe zugewiesen werden.

---

## Script erstellen

### PowerBI Login automatisieren

1. Einstellungen → **Scripts** → **+ Neu**
2. Name: `PowerBI Login`
3. URL-Muster: `*://login.microsoftonline.com/*`
4. Script:

```javascript
cy.log("Starte Microsoft Login...");

cy.get('input[type="email"]').type("user@company.com");
cy.get('input[type="submit"]').click();
cy.wait(2000);

cy.get('input[type="password"]').type("PasswortHier");
cy.get('input[type="submit"]').click();
cy.wait(3000);

cy.waitForUrl("app.powerbi.com");
cy.log("Login erfolgreich ✓");
```

5. **Aktivieren** ✓ → **Speichern**

Das Script startet jetzt automatisch, sobald Chrome die Microsoft-Login-Seite aufruft.

---

## Script API

| Befehl | Beschreibung |
|--------|-------------|
| `cy.get(selector)` | Element per CSS-Selektor finden (wartet bis zu 10s) |
| `cy.contains(text)` | Element per sichtbarem Text finden |
| `.click()` | Element klicken |
| `.type(text)` | Text eingeben (React/Vue/Angular-kompatibel) |
| `.clear()` | Eingabefeld leeren |
| `.pressEnter()` | Enter-Taste drücken |
| `.select(value)` | Select-Dropdown-Wert setzen |
| `.check(bool)` | Checkbox an/abwählen |
| `cy.wait(ms)` | Wartezeit in Millisekunden |
| `cy.waitForUrl(pattern)` | Warten bis URL-Text erscheint |
| `.waitForHidden(sel)` | Warten bis Element verschwindet |
| `.should('exist')` | Assertion: Element muss vorhanden sein |
| `.should('be.visible')` | Assertion: Element muss sichtbar sein |
| `.should('have.value', v)` | Assertion: Eingabefeld-Wert prüfen |
| `cy.log(msg)` | Nachricht in Browser-Konsole |
| `cy.visit(url)` | URL aufrufen |

Vollständige Docs: Einstellungen → **API Docs**

---

## Kiosk Manager Integration

Die Extension nutzt den Standard-API-Endpunkt `/api/playlist/`:

```
GET /api/playlist/?browser_id=<uuid>

Response:
{
  "browser_id": "...",
  "group_name": "Display 1",
  "playlist": [
    { "type": "website", "url": "https://app.powerbi.com/...", "duration": 300 }
  ],
  "show_status": true
}
```

**Voraussetzung:** Im Kiosk Manager muss der Browser einer Gruppe zugewiesen sein. Die Browser-ID wird in den Einstellungen angezeigt und kann kopiert werden.

---

## Salt-Formula Integration

Diese Extension ergänzt die [salt-kiosk-formula](https://github.com/MBcom/salt-kiosk-formula). Statt reinem Kiosk-Modus (`--kiosk`) kann Chrome normal mit dieser Extension laufen und trotzdem automatisierte Login-Workflows ausführen.

Salt-Pillar Beispiel:
```yaml
kiosk:
  chromeKioskMode: False  # Kiosk-Modus deaktivieren
  additionalChromeArgs: "--load-extension=/opt/kiosk-browser-command"
  start_url: "https://app.powerbi.com"
```

---

## Sicherheit

- Zugangsdaten werden im **lokalen Chrome-Profil** gespeichert (`chrome.storage.local`)
- Kein Sync über Google-Account (Scripts verlassen das Gerät nicht)
- Scripts laufen in der **Isolated World** der Extension (separiert vom Seitenkontext)
- Für sensible Umgebungen: Zugangsdaten lieber per MFA/SSO ohne Passwort im Script

---

## Verzeichnisstruktur

```
kiosk-manager-browser-command/
├── manifest.json          # Extension-Manifest (MV3)
├── background.js          # Service Worker: Polling, Browser-ID, Script-Ausführung
├── content-script.js      # CyRunner API + Auto-Trigger
├── popup.html/js/css      # Extension-Popup: Status & manueller Script-Start
├── options.html/js/css    # Einstellungen & Script-Editor
└── example-scripts/
    ├── powerbi-login.js   # PowerBI Login Template
    └── generic-login.js   # Generisches Login Template
```
