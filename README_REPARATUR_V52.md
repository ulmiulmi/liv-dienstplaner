# ULMIPOINT v52 Reparatur

Repariert für den Fehler aus `organisation-admin.html`:

- Anzeige `Server-Sitzung ist abgelaufen` blockiert die Organisationsverwaltung nicht mehr.
- Organisation kann mit gültigem Admin-Passwort-Token geladen und gespeichert werden, auch wenn die Supabase-User-Sitzung abgelaufen ist.
- Wenn auf dem Server versehentlich eine leere Organisationsstruktur gespeichert wurde, wird Haus 1 automatisch wieder eingesetzt.
- Standardstruktur bleibt sichtbar: Haus 1 mit Azoren, Bali, Capri, Delos sowie Nachtwache, Haus-Pikett und Haus-Dienstplan.
- `planer.html?site=haus_1` hat keine Ladeblockade mehr durch die zu spät definierte Server-Session-Konstante.
- Startseite und Planer haben eine lokale Notfallstruktur, damit die Häuser nicht einfach verschwinden.

Wichtig nach Vercel-Upload: Browser einmal hart neu laden (Strg+F5) oder Browser-Cache für die Seite leeren.
