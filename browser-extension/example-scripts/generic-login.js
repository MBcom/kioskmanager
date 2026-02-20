// ============================================================
// Generisches Login-Script
// ============================================================
// Anpassbares Template für beliebige Login-Seiten.
// URL-Muster: *://your-app.example.com/login*
// ============================================================

cy.log("Starte Login...");

// Benutzername / E-Mail
cy.get('#username')       // ← CSS-Selektor anpassen
  .clear()
  .type("benutzer@example.com");

// Passwort
cy.get('#password')
  .clear()
  .type("geheimesPasswort");

// Submit
cy.get('button[type="submit"]').click();

// Auf erfolgreiche Weiterleitung warten
cy.waitForUrl("/dashboard");  // ← Ziel-URL-Fragment anpassen

cy.log("Login abgeschlossen ✓");
