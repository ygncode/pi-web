# Roadmap

pi-web ist für zwei Zielgruppen gebaut:

- **Für Entwickler** — die im Terminal leben, aber Sessions vom Handy aus fortsetzen, an einen Remote-Server übergeben oder langlaufende Aufgaben von überall im Blick behalten möchten.
- **Für Nicht-Entwickler** — die einfach eine schöne KI-App wollen, die funktioniert. Öffnen, tippen, loslegen. Kein Terminal, kein SSH, keine Verwirrung. Wie die benutzerfreundlichsten KI-Tools, aber mit Modellwahl und Open-Source-Freiheit.

Das kommt als Nächstes.

---

## Jetzt (veröffentlicht)

Alles, was in [der Feature-Tabelle](README.md#what-you-can-do-with-pi-web) aufgeführt ist, ist heute live.

Features, die früher auf dieser Roadmap standen und inzwischen veröffentlicht wurden:

| Feature | Was es macht |
|---|---|
| **Steuerung / Warteschlange** ([#46](https://github.com/ygncode/pi-web/issues/46)) | Sende Folge-Anweisungen, während pi noch läuft, oder stelle Nachrichten für den nächsten Zug in die Warteschlange. |
| **Scheduler** ([#44](https://github.com/ygncode/pi-web/issues/44)) | Plane Prompts, die automatisch ausgeführt werden — tägliche Standups, Morgen-Zusammenfassungen, wiederkehrende Aufgaben — über die Seite `/schedules`. |
| **Konfigurierbare Anzeige-Standardwerte** ([#48](https://github.com/ygncode/pi-web/issues/48)) | Lege deine bevorzugte Sichtbarkeit für Thinking, Tools und Tool-Ausgaben über alle Sessions hinweg fest. |
| **Git-Diff** (Teil von [#47](https://github.com/ygncode/pi-web/issues/47)) | Sieh dir nicht committete Änderungen im Arbeitsbaum im Session-Diff-Modal an, mit Review-Kommentaren. |

---

## Als Nächstes

| # | Feature | Was es macht |
|---|---|---|
| [#50](https://github.com/ygncode/pi-web/issues/50) | **Telegram- & Discord-Bots** | Chatte mit pi über Telegram oder Discord — perfekt für persönliche Assistenten-Workflows unterwegs. |
| [#49](https://github.com/ygncode/pi-web/issues/49) | **Nutzungseinblicke** | Session-übergreifendes Token-Tracking, Kostenschätzung und Analysen — über die Aufschlüsselung pro Session im Session-Menü hinaus. |
| [#41](https://github.com/ygncode/pi-web/issues/41) | **`/compact`-Befehl** | Komprimiere lange Unterhaltungen direkt aus der Web-UI, ohne Terminal. |

---

## Geplant

| # | Feature | Was es macht |
|---|---|---|
| [#47](https://github.com/ygncode/pi-web/issues/47) | **Datei-Explorer** | Durchsuche den Projekt-Dateibaum direkt in pi-web. Opt-in, damit er dir nicht im Weg steht. |
| [#43](https://github.com/ygncode/pi-web/issues/43) | **Anpassbare Tastenkürzel** | Belege jedes Tastenkürzel neu, passend zu deinem Muskelgedächtnis. |

---

## Vision

Das langfristige Ziel: pi-web soll **die Oberfläche für pi** sein — für alle.

- **Nicht-Entwickler** öffnen es wie jede andere App. Modell wählen. Tippen. Fertig. Nie wieder eine Kommandozeile.
- **Entwickler** bekommen tiefe Integration — Remote-Übergabe, Multi-Session-Dashboards, Git-bewusstes Durchsuchen, Messaging-Bots.
- **Alle** bekommen Modellfreiheit, Open-Source-Transparenz und eine UI, die sich bei jedem Schritt durchdacht anfühlt.

---

> 💡 Hast du eine Idee? [Eröffne ein Issue](https://github.com/ygncode/pi-web/issues/new) oder nimm an der Diskussion teil.
