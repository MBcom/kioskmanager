// ============================================================
// PowerBI / Microsoft Login Automation
// ============================================================
//
// URL-Muster: *://login.microsoftonline.com/*
//
// Dieses Script automatisiert den Login-Workflow für PowerBI.
// Es wird automatisch ausgelöst, wenn der Kiosk-Browser zur
// Microsoft-Login-Seite weitergeleitet wird.
//
// Setup:
//   1. Script in Einstellungen → Scripts → Neu importieren
//   2. URL-Muster eintragen: *://login.microsoftonline.com/*
//   3. Zugangsdaten anpassen (oder per Umgebungsvariable, s.u.)
//   4. Script aktivieren
//
// SICHERHEITSHINWEIS:
//   Zugangsdaten niemals im Klartext in versionierten Dateien
//   speichern! Verwende stattdessen den integrierten Editor
//   (Einstellungen → Scripts) – die Daten liegen dann nur im
//   lokalen Chrome-Profil.
// ============================================================

cy.log("🔐 Starte PowerBI / Microsoft Login...");

// ── Schritt 1: E-Mail ──────────────────────────────────────────
// Microsoft-Login zeigt zunächst nur das E-Mail-Feld
cy.get('input[type="email"]')
  .should('be.visible')
  .type("IHR_LOGIN@example.com");

cy.get('input[type="submit"]').click();

cy.wait(2000); // Warten auf Übergang zum Passwort-Schritt

// ── Schritt 2: Passwort ────────────────────────────────────────
cy.get('input[type="password"]')
  .should('be.visible')
  .type("IHR_PASSWORT");

cy.get('input[type="submit"]').click();

cy.wait(3000); // Warten auf MFA oder Weiterleitung

// ── Schritt 3: "Angemeldet bleiben?" ablehnen ──────────────────
// Erscheint nicht immer – Zeile nach Bedarf einkommentieren
// cy.get("#idBtn_Back").click();   // "Nein" klicken
// cy.get("#idSIButton9").click();  // "Ja" klicken

// ── Schritt 4: Auf PowerBI-Weiterleitung warten ────────────────
cy.waitForUrl("app.powerbi.com");

cy.log("✅ Login erfolgreich – PowerBI geladen");


// ============================================================
// ERWEITERT: MFA / Authenticator App
// ============================================================
// Falls Microsoft nach einem Code fragt:
//
// cy.get('input[name="otc"]').type("123456");  // TOTP-Code
// cy.get('input[type="submit"]').click();
// cy.wait(3000);
// ============================================================


// ============================================================
// ERWEITERT: Specific Report öffnen
// ============================================================
// Nach erfolgreichem Login direkt zu einem Report navigieren:
//
// cy.visit("https://app.powerbi.com/groups/me/reports/REPORT-ID");
// ============================================================
