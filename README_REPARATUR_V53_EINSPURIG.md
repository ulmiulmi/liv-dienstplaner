# ULMIPOINT v53 – einspurig

Diese Version räumt die Doppelspur auf.

## Geändert

- `planer.html` ist jetzt die einzige Planer-Schale.
- Auch `Haus 1 / Startseite` nutzt die neue dynamische Hausseite `haus.html`.
- Die alte statische `overview.html` wird nicht mehr eingebettet.
- Alte Einzeldateien wie `azoren.html`, `bali.html`, `capri.html`, `delos.html`, `nachtwache.html`, `pikett.html`, `hausdienstplan.html` leiten nur noch in `planer.html?...#bereich` weiter.
- Organisation lädt ohne gültige Server-Sitzung mindestens die Notfallstruktur mit `Haus 1`, `Azoren`, `Bali`, `Capri`, `Delos`, `Nachtwache`, `Haus-Pikett`, `Haus-Dienstplan`.
- Eine leere Organisationsstruktur darf die Häuser nicht mehr entfernen.

## Wichtig

Dieses Paket komplett als neue Vercel-Version hochladen. Nicht einzelne Dateien aus alten Paketen mischen.
