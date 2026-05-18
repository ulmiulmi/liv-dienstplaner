# ULMIPOINT Dienstplaner

Produktionspaket v53 – einspurig.

## Grundsatz

`planer.html` ist die zentrale Planer-Schale. Alte Einzeldateien sind nur noch Weiterleitungen und werden nicht mehr als eigene zweite App-Schiene verwendet.

## Aktive Seiten

```text
index.html
organisation-admin.html
planer.html
haus.html
bereich-dyn.html
nachtwache-dyn.html
pikett-dyn.html
hausdienstplan-dyn.html
zeiterfassung-dyn.html
monatsabschluss-dyn.html
wunschportal.html
```

## Weiterleitungen

```text
overview.html
azoren.html
bali.html
capri.html
delos.html
nachtwache.html
pikett.html
hausdienstplan.html
monatsabschluss.html
bereich.html
hausfunktion.html
vorlage.html
```

Diese Dateien öffnen automatisch `planer.html?...#bereich`.

Die Planungsdaten bleiben in Supabase beziehungsweise lokal als Notfallstruktur, falls der Server nicht erreichbar ist.
