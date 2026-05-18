# ULMIPOINT Produktionspaket v50

## Enthalten

- vollständiger Stand aus v49
- `vercel.json` mit kostenlosen Sicherheits- und Cache-Headern
- `deploy-check.html` als einfache Lesediagnose
- keine TXT-Hinweisdateien
- keine ZIP-Dateien im Paket

## Nach dem Deploy prüfen

1. `https://liv-dienstplaner.vercel.app/deploy-check.html` öffnen
2. Prüfen, ob `index.html`, `planer.html`, `organisation-admin.html`, `bereich-dyn.html` erreichbar sind
3. Prüfen, ob `/api/org-structure.js` nicht als Quellcode angezeigt wird
4. Erst danach Organisation und Planer öffnen
5. Zuerst nur laden, nicht speichern

## Vercel Environment Variables

Mindestens prüfen:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ULMIPOINT_ORG_ADMIN_PASSWORD`

## Rollback

Vor jedem neuen Deploy den letzten funktionierenden Vercel Deploy merken.
Bei Fehler: Vercel → Deployments → funktionierenden Deploy → Redeploy / Promote.
