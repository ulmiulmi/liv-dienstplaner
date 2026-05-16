# ULMIPOINT Zeiterfassung – QR/NFC/API Vorbereitung

## In dieser Patch-Version

### Android-App
- QR-Code lesen über Google Code Scanner
- NFC-Tags lesen bleibt aktiv
- ein QR-Code für alle möglich
- eingeloggter Mitarbeiter kommt aus Wunschportal-Login
- QR/NFC identifiziert nur die Stempelstelle
- Button "Nach Update suchen" bleibt App-only

### Interne API
Neue Endpunkte:

```text
POST /api/time-clock-stamp
POST /api/time-clock-list
```

Gespeichert wird im bestehenden `planer_store.data.timeClock`.

Keine neue Supabase-Tabelle nötig.

## QR-Code Inhalt

Empfohlen für den allgemeinen QR-Code:

```text
ULMIPOINT:STAMP:DEFAULT:Eingang
```

Oder als Link:

```text
https://liv-dienstplaner.vercel.app/wunschportal.html?app=apk&stamp=ULMIPOINT%3ASTAMP%3ADEFAULT%3AEingang
```

## Stempel-Ereignis

```json
{
  "employeeId": "...",
  "employeeName": "...",
  "group": "...",
  "action": "kommen",
  "source": "qr",
  "locationId": "default",
  "locationLabel": "Eingang",
  "api": {
    "status": "open",
    "provider": null,
    "sentAt": null,
    "response": null,
    "externalId": null
  }
}
```

## Spätere externe Zeiterfassungs-API

Die externe API kann später an diese Felder andocken:

```text
api.status: open / sent / error
api.provider
api.sentAt
api.response
api.externalId
```

Bis dahin bleiben alle Stempelungen intern sichtbar und übertragbar.
