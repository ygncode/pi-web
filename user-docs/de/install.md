# Installation & Verwendung

## Funktionen

### Fernsteuerung

- Setze eine beliebige Sitzung im Browser mit Text- oder Bildanhängen fort
- Starte eine komplett neue Sitzung für einen beliebigen Projektpfad, direkt über die Web-UI
- Modellwechsel und Auswahl der Denkstufe im Browser, pro Sitzung
- Worker-Status pro Sitzung (idle / running / error) mit automatischer Wiederherstellung bei Absturz
- Mehrere Sitzungen laufen parallel — starte Arbeit in einer und beobachte den Stream einer anderen
- `PI_WEB_TOKEN` für sichere LAN-Freigabe — standardmäßig erforderlich für jede explizite Nicht-Loopback-Bindung

### Sitzungen lesen

- Durchsuche Sitzungen projektübergreifend mit Filtern, Suche und vollständiger Branch-Navigation
- Live-inkrementelle Updates, während pi noch läuft (über fsnotify; ~ms Latenz)
- Follow-Modus zum Mitverfolgen aktiver Sitzungen
- Deep-Links zu einzelnen Nachrichten
- Lade eine Sitzung als JSONL herunter
- Teile statische Snapshots als geheime GitHub Gists
- `/web`-, `/remote`-, `/refresh`-, `/pi-web token`- und `/pi-web set-token`-pi-Erweiterungen zum Öffnen von Sitzungen, Remote-QR, Sitzungssync und Token-Verwaltung
- `/skill:pi-web-schedule`, `/skill:pi-web-notes`, `/skill:pi-web-settings` (`pi-web-ctl`), damit eine Sitzung Zeitpläne, den Projekt-Scratchpad und Einstellungen in natürlicher Sprache verwalten kann

## Voraussetzungen

- [Go](https://go.dev) 1.25+ (nur zum Bauen aus dem Quellcode)
- `pi` in deinem `PATH` für Browser-Chat/Modellwechsel
- Optional: `gh` zum Teilen
- Unter Windows: pi benötigt eine Bash-Shell für sein Shell-Tool — [Git for Windows](https://git-scm.com/download/win) genügt (siehe pis Windows-Dokumentation)

## Installation

### Pi-Paket (empfohlen)

```bash
pi install npm:@ygncode/pi-web@beta
```

Dieser einzelne Befehl:

- Installiert das npm-pi-Paket in pis Paketverzeichnis
- Führt das `postinstall`-Skript des Pakets aus (`install.sh`, bzw. `install.ps1` unter Windows)
- Lädt die passende pi-web-Binärdatei für deine Paketversion und Plattform von GitHub Releases herunter
- Installiert sie nach `~/.pi/agent/bin/pi-web` (`pi-web.exe` unter Windows)
- Richtet den Autostart bei Anmeldung ein (launchd unter macOS, systemd unter Linux, ein Run-Key-Starter unter Windows)
- Registriert die pi-Befehle `/web`, `/remote`, `/refresh`, `/pi-web token` und `/pi-web set-token`

Die automatische Sitzungsbetitelung ist in pi-web eingebaut (nicht in der Erweiterung) und wird auf der Seite `/settings` konfiguriert. Sie ist standardmäßig aktiviert: pi-web benennt Sitzungen automatisch mithilfe einer kostenlosen integrierten Wort-Heuristik (keine KI) und betitelt sie bei jeder neuen Nachricht neu. Du kannst auf einmalige Betitelung pro Sitzung umschalten und/oder ein Modell auswählen, das anstelle der Heuristik intelligentere Titel schreibt.

Unter Linux wird der Autostart als user systemd-Dienst unter `~/.config/systemd/user/pi-web.service` konfiguriert. Das Installationsprogramm schreibt dessen `ExecStart` auf den tatsächlich installierten Binärpfad um. Wenn Tailscale zur Laufzeit verfügbar ist, veröffentlicht pi-web den Localhost-Server mit Tailscale Serve HTTPS. Wenn user systemd nicht verfügbar ist, starte ihn manuell mit `~/.pi/agent/bin/pi-web -o`.

Um nur für ein bestimmtes Projekt zu installieren (über `.pi/settings.json` mit deinem Team geteilt):

```bash
pi install -l npm:@ygncode/pi-web@beta
```

Starte pi danach neu (oder führe `/reload` aus) und verwende `/web`, `/pi-web`, `/remote`, `/refresh`. Verwalte dein Zugriffstoken mit `/pi-web token` und `/pi-web set-token`.

Wenn npm beim Umbenennen von `@ygncode/pi-web` mit `ENOTEMPTY` abbricht, entferne die veralteten versteckten Backup-Verzeichnisse von npm und installiere den Beta-Kanal neu:

```bash
rm -rf ~/.pi/agent/npm/node_modules/@ygncode/.pi-web-*
pi install npm:@ygncode/pi-web@beta
```

### Schnellinstallation (keine Build-Tools erforderlich)

macOS / Linux:

```bash
curl -fsSL https://raw.githubusercontent.com/ygncode/pi-web/main/install.sh | bash
```

Windows (PowerShell):

```powershell
irm https://raw.githubusercontent.com/ygncode/pi-web/main/install.ps1 | iex
```

Dies lädt die neueste pi-web-Binärdatei herunter, installiert sie nach `/usr/local/bin` (`~/.pi/agent/bin` unter Windows) und richtet den Autostart bei Anmeldung ein. Kein Go, Node oder pi erforderlich.

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

```powershell
# Windows (x64)
irm -OutFile pi-web.exe https://github.com/ygncode/pi-web/releases/latest/download/pi-web-windows-amd64.exe

# Windows (ARM64)
irm -OutFile pi-web.exe https://github.com/ygncode/pi-web/releases/latest/download/pi-web-windows-arm64.exe
```

Verschiebe sie dann in deinen PATH:

```bash
cp pi-web ~/.pi/agent/bin/
# or system-wide:
sudo cp pi-web /usr/local/bin/
```

### Aus dem Quellcode bauen

```bash
git clone https://github.com/ygncode/pi-web.git
cd pi-web
make build   # builds the Vite bundle, then embeds it into the Go binary

# optional: put it on PATH
cp pi-web ~/.pi/agent/bin/
```

Das Frontend-Bundle wird von `web/assets_embed.go` eingebettet, daher muss `web/dist` zuerst existieren, damit `go build` funktioniert. `make build` führt beide Schritte in dieser Reihenfolge aus; wenn du manuell baust, führe `npm --prefix web install && npm --prefix web run build` vor `go build ./cmd/pi-web` aus.

### Parallel zu einer installierten Instanz entwickeln

Lasse die installierte Instanz auf Port `31415` laufen und starte dann den Quellcode-Checkout im Entwicklungsmodus:

```bash
make dev
```

Öffne `http://127.0.0.1:31416`. `make dev` setzt die interne Entwicklungsumgebung `PI_WEB_DEV=1`, sodass der Quellcode-Checkout Sitzungen, Einstellungen und SQLite-Daten mit der installierten Instanz teilt, während er eine separate Entwicklungs-Laufzeitsperre und Statusdatei behält. Regulär installierte und manuell gestartete Instanzen bleiben unverändert und behalten das ursprüngliche Einzelinstanz-Verhalten.

Um doppelte autonome Arbeit zu verhindern, führt der Entwicklungsmodus die Schedule-Schleife, den Chat-Queue-Abarbeiter, die automatische Betitelung oder Push-Benachrichtigungen nicht aus. Direkte Anfragen über die Entwicklungs-UI funktionieren weiterhin. Steuere dieselbe Chat-Sitzung nicht gleichzeitig von beiden Instanzen aus; jeder Prozess hat seinen eigenen RPC-Worker-Manager.

`make dev` erfordert [Air](https://github.com/air-verse/air) für Go Hot Reload:

```bash
go install github.com/air-verse/air@latest
```

`PI_WEB_DEV` ist Entwicklungs-Harness-Infrastruktur und kein unterstützter Produktions-Mehrinstanzen-Modus.

## Deinstallation

```bash
pi remove npm:@ygncode/pi-web@beta
```

Dies führt das `preuninstall`-Skript des Pakets aus (`uninstall.sh`, bzw. `uninstall.ps1` unter Windows), das die laufende Instanz stoppt und Folgendes entfernt:

- die pi-web-Binärdatei (`~/.pi/agent/bin/pi-web`, bzw. `/usr/local/bin/pi-web` für Standalone-Installationen)
- die Versionsdatei (`~/.pi/agent/pi-web-version`)
- die Laufzeit-Statusdatei (`~/.pi/agent/pi-web/pi-web-state.json`)
- die Autostart-Konfiguration (launchd-Plist unter macOS, systemd user-Dienst unter Linux, Run-Key-Eintrag + Starter-Skripte unter Windows)

Deine Daten bleiben erhalten, sodass eine spätere Neuinstallation dort weitermacht, wo du aufgehört hast: `~/.pi/agent/pi-web.sqlite`, `~/.pi/agent/pi-web-memory.sqlite`, deine Sitzungsdateien unter `~/.pi/agent/sessions/` und `~/.config/pi-web/env` (einschließlich `PI_WEB_TOKEN`). Entferne diese manuell, wenn du einen sauberen Neustart möchtest.

## Verwendung

```bash
# Start on the default port (31415)
pi-web

# Start and open a browser
pi-web -o

# Custom port
pi-web -p 8080

# Override bind host (loopback is unauthenticated by default)
pi-web --host 127.0.0.1

# Non-loopback bind requires a token — pi-web refuses to start otherwise
PI_WEB_TOKEN=$(openssl rand -hex 16) pi-web --host 192.168.1.50
```

Standardmäßig bindet pi-web an `127.0.0.1`. Wenn Tailscale mit MagicDNS läuft **und `PI_WEB_TOKEN` gesetzt ist**, führt pi-web außerdem `tailscale serve --bg --https=<port> http://127.0.0.1:<port>` aus und gibt die HTTPS-Tailnet-URL aus. Ohne Token bleibt pi-web ausschließlich loopback-gebunden und überspringt Tailscale Serve, sodass Tailnet-Peers den Agenten nicht unauthentifiziert erreichen können. Jede explizite Nicht-Loopback-Bindung erfordert ebenfalls, dass `PI_WEB_TOKEN` gesetzt ist; übergib `--insecure`, um dies für lokale Tests zu überschreiben.

## Fernzugriff

Lasse pi-web lokal lauschen und verwende dann die ausgegebene Tailscale-HTTPS-URL von deinem Telefon oder Laptop im Tailnet.

Installiere und öffne Tailscale unter macOS interaktiv, bestätige die Administrator-Abfrage und melde dich an. Führe dann `/pi-web restart` aus, gefolgt von `/remote`.

Erlaube deinem Benutzer unter Linux, Tailscale zu verwalten, bevor du pi-web installierst/ausführst, andernfalls kann `tailscale serve` sudo erfordern und der Autostart fehlschlagen:

```bash
sudo tailscale set --operator=$USER
```

```bash
# 1. Start pi-web with a token so it publishes the Tailscale HTTPS endpoint
PI_WEB_TOKEN=$(openssl rand -hex 16) pi-web

# 2. From any other Tailscale-connected device, open the printed
#    "Tailscale HTTPS" URL and enter the token once.
```

> Standardmäßig verweigert pi-web die Bindung an eine Nicht-Loopback-Adresse, sofern `PI_WEB_TOKEN` nicht gesetzt ist — andernfalls könnte jeder, der die gebundene Adresse erreichen kann, Sitzungen einsehen und pi Anweisungen senden. Um diese Schutzmaßnahme für Tests im lokalen Netzwerk zu überschreiben, übergib `--insecure`. **Verwende `--insecure` nicht mit Tailscale oder einer Adresse, die von außerhalb deines Rechners erreichbar ist.**
>
> Clients können das Token über den Header `Authorization: Bearer <token>`, den Header `X-Pi-Token` oder einmalig über `?token=<token>` (oder die Anmeldeaufforderung) übermitteln. Wenn das Token über den Query-String ankommt, setzt pi-web ein `pi_token`-Cookie und leitet auf dieselbe URL ohne Token um, sodass es nicht in der Adressleiste oder im Browserverlauf verbleibt. Bevorzuge die Header-Form für Skripte und Automatisierung.

## Browser-Chat

Öffne eine Sitzungsseite und verwende den Composer unten, um genau diese Sitzung fortzusetzen.

- `Enter` sendet, `Shift+Enter` fügt eine neue Zeile ein
- Ziehe Bilder per Drag-and-drop in den Composer oder füge sie direkt ein
- Die Modellauswahl und der Denkstufen-Selektor befinden sich im Header — Änderungen wirken sich sofort auf den zugrunde liegenden pi-Worker aus
- Jede aktive Sitzung erhält ihren eigenen dedizierten `pi --mode rpc`-Worker, sodass sich verschiedene Sitzungen nicht gegenseitig blockieren

## Sitzungen teilen

Klicke auf einer Sitzungsseite auf **Share**, um einen geheimen GitHub Gist zu erstellen.

Voraussetzungen:
- `gh` installiert
- `gh auth login` abgeschlossen

Das Teilen gibt Folgendes zurück:
- die geheime Gist-URL
- eine Vorschau-URL unter `https://pi.dev/session/#<gistId>`

Geteilte Gists sind Snapshots und aktualisieren sich nicht live.

## Autostart bei Anmeldung

### macOS

```bash
cp init/com.pi-web.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.pi-web.plist
```

### Linux (systemd)

```bash
# Install the systemd user service
mkdir -p ~/.config/systemd/user
cp init/pi-web.service ~/.config/systemd/user/

# Optional: set your PI_WEB_TOKEN for non-loopback binds
# (or use /pi-web set-token <token> from inside pi)
mkdir -p ~/.config/pi-web
echo 'PI_WEB_TOKEN=your-token-here' > ~/.config/pi-web/env

# Enable and start
systemctl --user daemon-reload
systemctl --user enable --now pi-web.service

# Check status
systemctl --user status pi-web.service

# View logs
journalctl --user -u pi-web.service -f
```

> Damit der Dienst beim Booten (vor der Anmeldung) startet, verwende stattdessen einen Systemdienst: Kopiere `init/pi-web.service` nach `/etc/systemd/system/` und verwende `sudo systemctl`.

### Windows

Das Installationsprogramm konfiguriert dies automatisch, ohne Administratorrechte zu benötigen: Ein `pi-web`-Eintrag unter `HKCU\Software\Microsoft\Windows\CurrentVersion\Run` startet bei der Anmeldung `~/.config/pi-web/pi-web-start.vbs`, das die Binärdatei versteckt (ohne Konsolenfenster) startet, nachdem es `~/.config/pi-web/env` (`PI_WEB_TOKEN`, `PATH`, ...) geladen hat.

Um sie manuell zu verwalten:

```powershell
# Start / stop
wscript.exe "$HOME\.config\pi-web\pi-web-start.vbs"
taskkill /IM pi-web.exe /F

# Remove auto-start
Remove-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run' -Name 'pi-web'
```

Unter Windows gibt es keine Dienstüberwachung: Wenn pi-web abstürzt, bleibt es bis zur nächsten Anmeldung aus (launchd/systemd starten es auf den anderen Plattformen automatisch neu).
