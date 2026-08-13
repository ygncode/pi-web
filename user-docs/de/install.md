# Installation & Nutzung

## Funktionen

### Fernsteuerung

- Jede Sitzung vom Browser aus mit Text- oder Bildanhängen fortsetzen
- Eine brandneue Sitzung für einen beliebigen Projektpfad direkt aus der Web-UI starten
- Modellauswahl und Thinking-Level-Auswahl im Browser, pro Sitzung
- Worker-Status pro Sitzung (idle / running / error) mit automatischer Wiederherstellung bei Absturz
- Mehrere Sitzungen parallel ausführen — Arbeit in einer starten, einer anderen beim Streamen zusehen
- `PI_WEB_TOKEN` für sichere LAN-Freigabe — standardmäßig erforderlich für jede explizite Nicht-Loopback-Bindung

### Sitzungen lesen

- Sitzungen projektübergreifend durchsuchen mit Filtern, Suche und vollständiger Branch-Navigation
- Live-inkrementelle Aktualisierungen, während pi noch läuft (via fsnotify; ~ms Latenz)
- Follow-Modus zum Verfolgen aktiver Sitzungen
- Deeplinks zu einzelnen Nachrichten
- Eine Sitzung als JSONL herunterladen
- Statische Snapshots als geheime GitHub Gists teilen
- `/web`, `/remote`, `/refresh`, `/pi-web token` und `/pi-web set-token` pi-Erweiterungen zum Öffnen von Sitzungen, Remote-QR, Sitzungssynchronisation und Token-Verwaltung

## Voraussetzungen

- [Go](https://go.dev) 1.25+
- `pi` im `PATH` für Browser-Chat/Modellwechsel
- Optional: `gh` zum Teilen

## Installation

### Pi-Paket (empfohlen)

```bash
pi install npm:@ygncode/pi-web@beta
```

Dieser einzelne Befehl:
- Installiert das npm-Paket im Paketverzeichnis von pi
- Führt das `postinstall`-Skript des Pakets aus (`bash install.sh`)
- Lädt die passende pi-web-Binärdatei für deine Paketversion und Plattform von GitHub Releases herunter
- Installiert sie nach `~/.pi/agent/bin/pi-web`
- Richtet den automatischen Start bei der Anmeldung ein (launchd auf macOS, systemd auf Linux)
- Registriert die pi-Befehle `/web`, `/remote`, `/refresh`, `/pi-web token` und `/pi-web set-token`

Die automatische Sitzungsbetitelung ist in pi-web integriert (nicht in der Erweiterung) und wird auf der `/settings`-Seite konfiguriert. Sie ist standardmäßig aktiviert: pi-web benennt Sitzungen automatisch mit einer kostenlosen integrierten Wortheuristik (keine KI) und betitelt bei jeder neuen Nachricht neu. Du kannst auf einmalige Betitelung pro Sitzung umschalten und/oder ein Modell auswählen, das intelligentere Titel anstelle der Heuristik schreibt.

Auf Linux wird der automatische Start als systemd-Benutzerdienst unter `~/.config/systemd/user/pi-web.service` konfiguriert. Das Installationsprogramm schreibt dessen `ExecStart` auf den tatsächlichen installierten Binärpfad um. Wenn Tailscale zur Laufzeit verfügbar ist, veröffentlicht pi-web den localhost-Server mit Tailscale Serve HTTPS. Falls systemd-Benutzerdienste nicht verfügbar sind, führe es manuell mit `~/.pi/agent/bin/pi-web -o` aus.

Um nur für ein bestimmtes Projekt zu installieren (geteilt mit deinem Team über `.pi/settings.json`):

```bash
pi install -l npm:@ygncode/pi-web@beta
```

Starte dann pi neu (oder führe `/reload` aus) und verwende `/web`, `/pi-web`, `/remote`, `/refresh`. Verwalte dein Zugriffstoken mit `/pi-web token` und `/pi-web set-token`.

Falls npm mit `ENOTEMPTY` beim Umbenennen von `@ygncode/pi-web` abbricht, entferne die veralteten versteckten npm-Sicherungsverzeichnisse und installiere den Beta-Kanal erneut:

```bash
rm -rf ~/.pi/agent/npm/node_modules/@ygncode/.pi-web-*
pi install npm:@ygncode/pi-web@beta
```

### Schnellinstallation (keine Build-Werkzeuge nötig)

```bash
curl -fsSL https://raw.githubusercontent.com/ygncode/pi-web/main/install.sh | bash
```

Dies lädt die neueste pi-web-Binärdatei herunter, installiert sie nach `/usr/local/bin` und richtet den automatischen Start bei der Anmeldung ein. Kein Go, Node oder pi erforderlich.

### Binärdatei herunterladen

Vorkompilierte Binärdateien sind jedem [GitHub Release](https://github.com/ygncode/pi-web/releases) beigefügt.

```bash
# macOS (Apple Silicon)
curl -L -o pi-web https://github.com/ygncode/pi-web/releases/latest/download/pi-web-darwin-arm64
chmod +x pi-web

# macOS (Intel)
curl -L -o pi-web https://github.com/ygncode/pi-web/releases/latest/download/pi-web-darwin-amd64
chmod +x pi-web

# Linux (amd64)
curl -L -o pi-web https://github.com/ygncode/pi-web/releases/latest/download/pi-web-linux-amd64
chmod +x pi-web

# Linux (arm64)
curl -L -o pi-web https://github.com/ygncode/pi-web/releases/latest/download/pi-web-linux-arm64
chmod +x pi-web
```

Verschiebe sie dann in deinen PATH:

```bash
cp pi-web ~/.pi/agent/bin/
# oder systemweit:
sudo cp pi-web /usr/local/bin/
```

### Aus dem Quellcode bauen

```bash
git clone https://github.com/ygncode/pi-web.git
cd pi-web
make build   # baut das Vite-Bundle, bettet es dann in die Go-Binärdatei ein

# optional: in den PATH legen
cp pi-web ~/.pi/agent/bin/
```

Das Frontend-Bundle wird von `web/assets_embed.go` eingebettet, daher benötigt `go build`,
dass `web/dist` zuerst existiert. `make build` führt beide Schritte nacheinander aus; wenn du
von Hand baust, führe `npm --prefix web install && npm --prefix web run build` vor
`go build ./cmd/pi-web` aus.

## Deinstallation

```bash
pi remove npm:@ygncode/pi-web@beta
```

Dies führt das `preuninstall`-Skript des Pakets aus (`bash uninstall.sh`), das die
laufende Instanz stoppt und Folgendes entfernt:

- die pi-web-Binärdatei (`~/.pi/agent/bin/pi-web` oder `/usr/local/bin/pi-web` bei eigenständigen Installationen)
- die Versionsdatei (`~/.pi/agent/pi-web-version`)
- die Laufzeit-Zustandsdatei (`~/.pi/agent/pi-web/pi-web-state.json`)
- die Autostart-Konfiguration (launchd-plist auf macOS, systemd-Benutzerdienst auf Linux)

Deine Daten bleiben erhalten, sodass eine spätere Neuinstallation dort weitermacht, wo du aufgehört hast:
`~/.pi/agent/pi-web.sqlite`, `~/.pi/agent/pi-web-memory.sqlite`, deine Sitzungsdateien
unter `~/.pi/agent/sessions/` und `~/.config/pi-web/env` (einschließlich
`PI_WEB_TOKEN`). Entferne diese manuell, wenn du einen sauberen Neustart möchtest.

## Nutzung

```bash
# Auf dem Standardport starten (31415)
pi-web

# Starten und einen Browser öffnen
pi-web -o

# Benutzerdefinierter Port
pi-web -p 8080

# Bind-Host überschreiben (Loopback ist standardmäßig unauthentifiziert)
pi-web --host 127.0.0.1

# Nicht-Loopback-Bindung erfordert ein Token — pi-web verweigert sonst den Start
PI_WEB_TOKEN=$(openssl rand -hex 16) pi-web --host 192.168.1.50
```

Standardmäßig bindet pi-web an `127.0.0.1`. Wenn Tailscale mit MagicDNS läuft, führt pi-web auch `tailscale serve --bg --https=<port> http://127.0.0.1:<port>` aus und gibt die HTTPS-Tailnet-URL aus. Jede explizite Nicht-Loopback-Bindung erfordert, dass `PI_WEB_TOKEN` gesetzt ist; übergib `--insecure`, um dies für lokale Tests zu umgehen.

## Fernzugriff

Lasse pi-web lokal lauschen und verwende dann die ausgegebene Tailscale-HTTPS-URL von deinem Telefon oder Laptop im Tailnet.

Installiere und öffne Tailscale unter macOS interaktiv, bestätige die Administratorabfrage und melde dich an. Führe anschließend `/pi-web restart` und danach `/remote` aus.

Erlaube deinem Benutzer auf Linux, Tailscale zu verwalten, bevor du pi-web installierst/ausführst, andernfalls könnte `tailscale serve` sudo erfordern und der Autostart fehlschlagen:

```bash
sudo tailscale set --operator=$USER
```

```bash
# 1. pi-web starten
pi-web

# 2. Von jedem anderen Tailscale-verbundenen Gerät aus die ausgegebene
#    "Tailscale HTTPS"-URL öffnen.
```

> Standardmäßig verweigert pi-web die Bindung an eine Nicht-Loopback-Adresse, es sei denn, `PI_WEB_TOKEN` ist gesetzt — jeder, der die gebundene Adresse erreichen kann, könnte sonst Sitzungen einsehen und Anweisungen an pi senden. Um diese Sicherung für Tests im lokalen Netzwerk zu umgehen, übergib `--insecure`. **Verwende `--insecure` nicht mit Tailscale oder einer Adresse, die von außerhalb deines Rechners erreichbar ist.**
>
> Clients können das Token über den `Authorization: Bearer <token>`-Header, den `X-Pi-Token`-Header oder einmalig via `?token=<token>` übergeben (was ein `pi_token`-Cookie für nachfolgende Anfragen setzt). Tokens, die via `?token=` übergeben werden, landen im Browserverlauf, in Server-Zugriffslogs und in `Referer`-Headern von Links auf der Seite — bevorzuge die Header-Form für alles außer dem initialen Lesezeichen.

## Browser-Chat

Öffne eine Sitzungsseite und verwende den Composer unten, um genau diese Sitzung fortzusetzen.

- `Enter` sendet, `Shift+Enter` fügt einen Zeilenumbruch ein
- Ziehe Bilder per Drag-and-Drop oder füge sie direkt in den Composer ein
- Die Modellauswahl und der Thinking-Level-Selektor befinden sich im Header — Änderungen werden sofort auf den zugrunde liegenden pi-Worker angewendet
- Jede aktive Sitzung erhält ihren eigenen dedizierten `pi --mode rpc`-Worker, sodass sich verschiedene Sitzungen nicht gegenseitig blockieren

## Sitzungen teilen

Klicke auf **Share** auf einer Sitzungsseite, um einen geheimen GitHub Gist zu erstellen.

Voraussetzungen:
- `gh` installiert
- `gh auth login` abgeschlossen

Das Teilen liefert:
- die geheime Gist-URL
- eine Vorschau-URL unter `https://pi.dev/session/#<gistId>`

Geteilte Gists sind Snapshots und aktualisieren sich nicht live.

## Autostart bei der Anmeldung

### macOS

```bash
cp init/com.pi-web.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.pi-web.plist
```

### Linux (systemd)

```bash
# Den systemd-Benutzerdienst installieren
mkdir -p ~/.config/systemd/user
cp init/pi-web.service ~/.config/systemd/user/

# Optional: PI_WEB_TOKEN für Nicht-Loopback-Bindungen setzen
# (oder /pi-web set-token <token> innerhalb von pi verwenden)
mkdir -p ~/.config/pi-web
echo 'PI_WEB_TOKEN=your-token-here' > ~/.config/pi-web/env

# Aktivieren und starten
systemctl --user daemon-reload
systemctl --user enable --now pi-web.service

# Status prüfen
systemctl --user status pi-web.service

# Logs anzeigen
journalctl --user -u pi-web.service -f
```

> Damit der Dienst beim Booten startet (vor der Anmeldung), verwende stattdessen einen Systemdienst:
> kopiere `init/pi-web.service` nach `/etc/systemd/system/` und verwende `sudo systemctl`.
