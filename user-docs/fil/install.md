# Pag-install at Paggamit

## Mga Tampok

### Malayuang kontrol

- Ipagpatuloy ang anumang session mula sa browser na may teksto o mga attachment na larawan
- Magsimula ng bagong session sa anumang project path, diretso mula sa web UI
- In-browser na pagpapalit ng modelo at selector ng thinking-level, bawat session
- Katayuan ng worker bawat session (idle / running / error) na may awtomatikong pag-recover sa crash
- Maramihang session na tumatakbo nang sabay — magsimula ng trabaho sa isa, panoorin ang stream ng isa pa
- `PI_WEB_TOKEN` para sa ligtas na LAN exposure — kinakailangan bilang default para sa anumang tahasang non-loopback bind

### Pagbabasa ng mga session

- Mag-browse ng mga session sa iba't ibang proyekto gamit ang mga filter, paghahanap, at buong branch navigation
- Live na incremental na mga update habang tumatakbo pa ang pi (sa pamamagitan ng fsnotify; ~ms latency)
- Follow mode para sa pag-tail ng mga aktibong session
- Mga deep link sa mga indibidwal na mensahe
- I-download ang isang session bilang JSONL
- I-share ang mga static na snapshot bilang lihim na GitHub Gists
- `/web`, `/remote`, `/refresh`, `/pi-web token` at `/pi-web set-token` na mga pi extension para sa pagbubukas ng mga session, remote QR, session sync, at pamamahala ng token
- `/skill:pi-web-schedule`, `/skill:pi-web-notes`, `/skill:pi-web-settings` (`pi-web-ctl`) upang ang isang session ay makapamahala ng mga iskedyul, ang project scratchpad, at mga setting sa natural na wika

## Mga Kinakailangan

- [Go](https://go.dev) 1.25+ (para lamang sa pagbuo mula sa source)
- `pi` sa iyong `PATH` para sa browser chat/pagpapalit ng modelo
- Opsyonal: `gh` para sa pag-share
- Sa Windows: kailangan ng pi ng bash shell para sa shell tool nito — sapat na ang [Git for Windows](https://git-scm.com/download/win) (tingnan ang Windows docs ng pi)

## Pag-install

### Pi package (inirerekomenda)

```bash
pi install npm:@ygncode/pi-web@beta
```

Ang nag-iisang command na ito:

- Nag-i-install ng npm pi package sa ilalim ng package directory ng pi
- Pinapatakbo ang `postinstall` script ng package (`install.sh`, o `install.ps1` sa Windows)
- Dina-download ang katugmang pi-web binary para sa bersyon at platform ng iyong package mula sa GitHub Releases
- Iini-install ito sa `~/.pi/agent/bin/pi-web` (`pi-web.exe` sa Windows)
- Nagse-set up ng auto-start sa pag-login (launchd sa macOS, systemd sa Linux, isang Run-key launcher sa Windows)
- Nirerehistro ang `/web`, `/remote`, `/refresh`, `/pi-web token`, at `/pi-web set-token` na mga pi command

Ang awtomatikong pagbibigay ng titulo sa session ay naka-built in sa pi-web (hindi sa extension) at kino-configure sa pahina ng `/settings`. Naka-on ito bilang default: awtomatikong pinapangalanan ng pi-web ang mga session gamit ang isang libreng built-in na word heuristic (walang AI), na muling nagbibigay ng titulo sa bawat bagong mensahe. Maaari kang lumipat sa pagbibigay ng titulo nang isang beses bawat session, at/o pumili ng modelo upang magsulat ng mas matatalinong titulo sa halip na ang heuristic.

Sa Linux, ang auto-start ay kino-configure bilang isang user systemd service sa `~/.config/systemd/user/pi-web.service`. Ina-update ng installer ang `ExecStart` nito sa aktwal na path ng naka-install na binary. Kung available ang Tailscale sa runtime, ipina-publish ng pi-web ang localhost server gamit ang Tailscale Serve HTTPS. Kung hindi available ang user systemd, patakbuhin ito nang manu-mano gamit ang `~/.pi/agent/bin/pi-web -o`.

Upang mag-install lamang para sa isang partikular na proyekto (ibinabahagi sa iyong team sa pamamagitan ng `.pi/settings.json`):

```bash
pi install -l npm:@ygncode/pi-web@beta
```

Pagkatapos ay i-restart ang pi (o patakbuhin ang `/reload`), at gamitin ang `/web`, `/pi-web`, `/remote`, `/refresh`. Pamahalaan ang iyong access token gamit ang `/pi-web token` at `/pi-web set-token`.

Kung mag-aabort ang npm na may `ENOTEMPTY` habang nire-rename ang `@ygncode/pi-web`, alisin ang mga luma nang nakatagong backup directory ng npm at muling i-install ang beta channel:

```bash
rm -rf ~/.pi/agent/npm/node_modules/@ygncode/.pi-web-*
pi install npm:@ygncode/pi-web@beta
```

### Mabilisang pag-install (walang kinakailangang build tools)

macOS / Linux:

```bash
curl -fsSL https://raw.githubusercontent.com/ygncode/pi-web/main/install.sh | bash
```

Windows (PowerShell):

```powershell
irm https://raw.githubusercontent.com/ygncode/pi-web/main/install.ps1 | iex
```

Dina-download nito ang pinakabagong pi-web binary, iini-install ito sa `/usr/local/bin` (`~/.pi/agent/bin` sa Windows), at nagse-set up ng auto-start sa pag-login. Walang kinakailangang Go, Node, o pi.

### Pag-download ng binary

Ang mga pre-built na binary ay naka-attach sa bawat [GitHub Release](https://github.com/ygncode/pi-web/releases).

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

Pagkatapos ay ilipat ito sa iyong PATH:

```bash
cp pi-web ~/.pi/agent/bin/
# or system-wide:
sudo cp pi-web /usr/local/bin/
```

### Buuin mula sa source

```bash
git clone https://github.com/ygncode/pi-web.git
cd pi-web
make build   # builds the Vite bundle, then embeds it into the Go binary

# optional: put it on PATH
cp pi-web ~/.pi/agent/bin/
```

Ang frontend bundle ay naka-embed ng `web/assets_embed.go`, kaya kailangang umiral muna ang `web/dist` bago ang `go build`. Ginagawa ng `make build` ang dalawang hakbang nang magkakasunod; kung magbu-build ka nang manu-mano, patakbuhin ang `npm --prefix web install && npm --prefix web run build` bago ang `go build ./cmd/pi-web`.

### Mag-develop kasabay ng naka-install na instance

Iwanang tumatakbo ang naka-install na instance sa port `31415`, pagkatapos ay simulan ang source checkout sa development mode:

```bash
make dev
```

Buksan ang `http://127.0.0.1:31416`. Itinatakda ng `make dev` ang internal na `PI_WEB_DEV=1` na development environment, kaya ibinabahagi ng source checkout ang mga session, setting, at SQLite data sa naka-install na instance habang pinapanatili ang isang hiwalay na development runtime lock at state file. Ang mga regular na naka-install at manu-manong inilunsad na instance ay hindi nagbabago at nananatili sa orihinal na single-instance na pag-uugali.

Upang maiwasan ang dobleng autonomous na trabaho, hindi pinapatakbo ng development mode ang schedule loop, chat-queue drainer, auto-titling, o mga push notification. Gumagana pa rin ang mga direktang request na ginagawa sa pamamagitan ng development UI. Huwag i-drive ang parehong chat session mula sa dalawang instance nang sabay; ang bawat proseso ay may sariling RPC worker manager.

Kinakailangan ng `make dev` ang [Air](https://github.com/air-verse/air) para sa Go hot reload:

```bash
go install github.com/air-verse/air@latest
```

Ang `PI_WEB_DEV` ay development harness plumbing, hindi isang suportadong production multi-instance mode.

## Pag-uninstall

```bash
pi remove npm:@ygncode/pi-web@beta
```

Pinapatakbo nito ang `preuninstall` script ng package (`uninstall.sh`, o `uninstall.ps1` sa Windows), na humihinto sa tumatakbong instance at nag-aalis ng:

- ang pi-web binary (`~/.pi/agent/bin/pi-web`, o `/usr/local/bin/pi-web` para sa mga standalone na pag-install)
- ang version file (`~/.pi/agent/pi-web-version`)
- ang runtime state file (`~/.pi/agent/pi-web/pi-web-state.json`)
- ang auto-start config (launchd plist sa macOS, systemd user service sa Linux, Run-key entry + launcher scripts sa Windows)

Pinapanatili ang iyong data upang ang susunod na muling pag-install ay magpapatuloy kung saan ka tumigil: `~/.pi/agent/pi-web.sqlite`, `~/.pi/agent/pi-web-memory.sqlite`, ang iyong mga session file sa ilalim ng `~/.pi/agent/sessions/`, at `~/.config/pi-web/env` (kasama ang `PI_WEB_TOKEN`). Tanggalin ang mga iyon nang manu-mano kung gusto mo ng malinis na simula.

## Paggamit

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

Bilang default, nag-bibind ang pi-web sa `127.0.0.1`. Kung tumatakbo ang Tailscale na may MagicDNS **at nakatakda ang `PI_WEB_TOKEN`**, pinapatakbo rin ng pi-web ang `tailscale serve --bg --https=<port> http://127.0.0.1:<port>` at ipinapakita ang HTTPS tailnet URL. Kung walang token, mananatiling loopback-only ang pi-web at lalaktawan ang Tailscale Serve, kaya hindi maaabot ng mga tailnet peer ang agent nang walang authentication. Ang anumang tahasang non-loopback bind ay nangangailangan ding nakatakda ang `PI_WEB_TOKEN`; ipasa ang `--insecure` upang i-override para sa lokal na pagsubok.

## Malayuang Access

Iwanang nakikinig nang lokal ang pi-web, pagkatapos ay gamitin ang ipinakitang Tailscale HTTPS URL mula sa iyong telepono o laptop sa tailnet.

Sa macOS, i-install at buksan ang Tailscale nang interactive, aprubahan ang administrator prompt, at mag-sign in. Pagkatapos ay patakbuhin ang `/pi-web restart`, na susundan ng `/remote`.

Sa Linux, payagan ang iyong user na pamahalaan ang Tailscale bago i-install/patakbuhin ang pi-web, kung hindi ay maaaring mangailangan ng sudo ang `tailscale serve` at maaaring mabigo ang auto-start:

```bash
sudo tailscale set --operator=$USER
```

```bash
# 1. Start pi-web with a token so it publishes the Tailscale HTTPS endpoint
PI_WEB_TOKEN=$(openssl rand -hex 16) pi-web

# 2. From any other Tailscale-connected device, open the printed
#    "Tailscale HTTPS" URL and enter the token once.
```

> Bilang default, tumatangging mag-bind ang pi-web sa isang non-loopback address maliban kung nakatakda ang `PI_WEB_TOKEN` — kung hindi, ang sinumang makakaabot sa naka-bind na address ay maaaring makakita ng mga session at makapagpadala ng mga tagubilin sa pi. Upang i-override ang guard na ito para sa pagsubok sa lokal na network, ipasa ang `--insecure`. **Huwag gamitin ang `--insecure` sa Tailscale o sa anumang address na maaabot mula sa labas ng iyong machine.**
>
> Maaaring ipasa ng mga client ang token sa pamamagitan ng `Authorization: Bearer <token>` header, ng `X-Pi-Token` header, o nang isang beses sa pamamagitan ng `?token=<token>` (o ng login prompt). Kapag dumating ang token sa pamamagitan ng query string, nagtatakda ang pi-web ng `pi_token` cookie at nagre-redirect sa parehong URL na inalis na ang token, kaya hindi ito nananatili sa address bar o sa history ng browser. Mas mainam ang header form para sa mga script at automation.

## Browser Chat

Buksan ang isang pahina ng session at gamitin ang composer sa ibaba upang ipagpatuloy ang eksaktong session na iyon.

- Ang `Enter` ay nagpapadala, ang `Shift+Enter` ay naglalagay ng newline
- I-drag-and-drop o i-paste ang mga larawan nang direkta sa composer
- Nasa header ang model picker at thinking-level selector — agad na nalalapat ang mga pagbabago sa pinagbabatayang pi worker
- Ang bawat aktibong session ay may sariling dedikadong `pi --mode rpc` worker, kaya hindi naghaharangan ang magkakaibang session

## Pagbabahagi ng mga Session

I-click ang **Share** sa isang pahina ng session upang gumawa ng lihim na GitHub Gist.

Mga kinakailangan:

- naka-install ang `gh`
- nakumpleto ang `gh auth login`

Ibinabalik ng pag-share:

- ang lihim na gist URL
- isang preview URL sa `https://pi.dev/session/#<gistId>`

Ang mga na-share na gist ay mga snapshot at hindi nag-live-update.

## Auto-Start sa Pag-login

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

> Upang magsimula ang service sa boot (bago mag-login), gumamit na lang ng system service: kopyahin ang `init/pi-web.service` sa `/etc/systemd/system/` at gamitin ang `sudo systemctl`.

### Windows

Awtomatikong kino-configure ito ng installer, nang hindi kinakailangan ang mga admin right: isang `pi-web` entry sa ilalim ng `HKCU\Software\Microsoft\Windows\CurrentVersion\Run` ang naglulunsad ng `~/.config/pi-web/pi-web-start.vbs` sa pag-login, na nagpapatakbo sa binary nang nakatago (walang console window) matapos i-load ang `~/.config/pi-web/env` (`PI_WEB_TOKEN`, `PATH`, ...).

Upang pamahalaan ito nang manu-mano:

```powershell
# Start / stop
wscript.exe "$HOME\.config\pi-web\pi-web-start.vbs"
taskkill /IM pi-web.exe /F

# Remove auto-start
Remove-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run' -Name 'pi-web'
```

Walang service supervision sa Windows: kung mag-crash ang pi-web ay mananatili itong patay hanggang sa susunod na pag-login (awtomatiko itong nire-restart ng launchd/systemd sa iba pang mga platform).
