# LIV Dienstplaner

Aktueller produktiver Stand bleibt auf `main`.

## Branches

- `main`: produktive Version, deployed durch Vercel.
- `sicherung-vor-umbau-v13`: Rettungsstand vor groesserem Umbau.
- `umbau-projektstruktur`: Arbeitsbranch fuer die Aufteilung der grossen Ein-Datei-App.

## Zielstruktur

Die bisherige grosse `index.html` wird schrittweise aufgeteilt:

```text
index.html
bereiche/
  overview.html
  azoren.html
  bali.html
  capri.html
  delos.html
  nachtwache.html
  pikett.html
  hausdienstplan.html
data/
  planer-manifest.json
tools/
  split_embedded_planer.py
```

Die Planungsdaten bleiben weiterhin in Supabase. Die Aufteilung betrifft nur den App-Code, nicht die gespeicherten Serverdaten.
