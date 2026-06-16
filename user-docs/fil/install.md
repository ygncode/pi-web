# Pag-install at Paggamit

## Mga Tampok

### Malayuang kontrol

- Ipagpatuloy ang anumang session mula sa browser na may teksto o mga kalakip na larawan
- Magsimula ng bagong session sa anumang path ng proyekto, direkta mula sa web UI
- In-browser na pagpapalit ng modelo at thinking-level selector, bawat session
- Per-session worker status (idle / running / error) na may auto-recovery sa pag-crash
- Maramihang session na sabay-sabay na tumatakbo — magsimula ng trabaho sa isa, panoorin ang stream ng isa pa
- `PI_WEB_TOKEN` para sa ligtas na LAN exposure — kinakailangan bilang default para sa anumang tahasang non-loopback bind

### Pagbabasa ng mga session

- Mag-browse ng mga session sa iba't ibang proyekto gamit ang mga filter, paghahanap, at buong branch navigation
- Live incremental updates habang tumatakbo pa ang pi (sa pamamagitan ng fsnotify; ~ms latency)
- Follow mode para sa pag-tail ng mga aktibong session
- Deep links sa mga indibidwal na mensahe
- I-download ang isang session bilang JSONL
- Ibahagi ang mga static snapshot bilang lihim na GitHub Gists
- `/web`, `/remote`, `/refresh`, `/pi-web token` at `/pi-web set-token` na mga extension ng pi para sa pagbubukas ng mga session, remote QR, session sync, at pamamahala ng token

## Mga Kinakailangan

- [Go](https://go.dev) 1.25+
- `pi` sa iyong `PATH` para sa browser chat/pagpapalit ng modelo
- Opsyonal: `gh` para sa pagbabahagi

## Pag-install

### Pi package (inirerekomenda)

```bash
pi install npm:@ygncode/pi-web@beta
```

Ang nag-iisang utos na ito ay:
- Nag-i-install ng npm pi package sa ilalim ng package directory ng pi
- Pinapatakbo ang package `postinstall` script (`bash install.sh`)
- Dina-download ang katugmang pi-web binary para sa iyong bersyon ng package at platform mula sa GitHub Releases
- Ini-install ito sa `~/.pi/agent/bin/pi-web`
- Nagse-set up ng auto-start sa login (launchd sa macOS, systemd sa Linux)
- Nirerehistro ang `/web`, `/remote`, `/refresh`, `/pi-web token`, at `/pi-web set-token` na mga pi command

Ang session auto-titling ay built-in sa pi-web (hindi sa extension) at naka-configure sa `/settings` page. Ito ay naka-on bilang default: awtomatikong pinapangalanan ng pi-web ang mga session gamit ang libreng built-in word heuristic (walang AI), na muling nagta-titulo sa bawat bagong mensahe. Maaari kang lumipat sa pagta-titulo nang isang beses bawat session, at/o pumili ng modelo para sumulat ng mas matalinong mga titulo sa halip na heuristic.

Sa Linux, ang auto-start ay naka-configure bilang isang user systemd service sa `~/.config/systemd/user/pi-web.service`. Nirerewrite ng installer ang `ExecStart` nito patungo sa aktwal na naka-install na binary path. Kung available ang Tailscale sa runtime, ipa-publish ng pi-web ang localhost server gamit ang Tailscale Serve HTTPS. Kung hindi available ang user systemd, patakbuhin ito nang manu-mano gamit ang `~/.pi/agent/bin/pi-web -o`.

Upang mag-install lamang para sa isang partikular na proyekto (ibinahagi sa iyong team sa pamamagitan ng `.pi/settings.json`):

```bash
pi install -l npm:@ygncode/pi-web@beta
```

Pagkatapos ay i-restart ang pi (o patakbuhin ang `/reload`), at gamitin ang `/web`, `/pi-web`, `/remote`, `/refresh`. Pamahalaan ang iyong access token gamit ang `/pi-web token` at `/pi-web set-token`.

Kung mag-abort ang npm na may `ENOTEMPTY` habang nire-rename ang `@ygncode/pi-web`, tanggalin ang mga stale hidden backup directory ng npm at muling i-install ang beta channel:

```bash
rm -rf ~/.pi/agent/npm/node_modules/@ygncode/.pi-web-*
pi install npm:@ygncode/pi-web@beta
```

### Mabilisang pag-install (walang build tools na kailangan)

```bash
curl -fsSL https://raw.githubusercontent.com/ygncode/pi-web/main/install.sh | bash
```

Dina-download nito ang pinakabagong pi-web binary, ini-install ito sa `/usr/local/bin`, at nagse-set up ng auto-start sa login. Walang Go, Node, o pi na kinakailangan.

### I-download ang binary

Ang mga pre-built binary ay nakakabit sa bawat [GitHub Release](https://github.com/ygncode/pi-web/releases).

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

Pagkatapos ay ilipat ito sa iyong PATH:

```bash
cp pi-web ~/.pi/agent/bin/
# o system-wide:
sudo cp pi-web /usr/local/bin/
```

### Bumuo mula sa source

```bash
git clone https://github.com/ygncode/pi-web.git
cd pi-web
make build   # binubuo ang Vite bundle, pagkatapos ay ini-embed ito sa Go binary

# opsyonal: ilagay ito sa PATH
cp pi-web ~/.pi/agent/bin/
```

Ang frontend bundle ay ini-embed ng `web/assets_embed.go`, kaya kailangan ng `go build` na
umiiral muna ang `web/dist`. Ginagawa ng `make build` ang parehong hakbang nang sunod-sunod; kung mano-mano kang
bumubuo, patakbuhin ang `npm --prefix web install && npm --prefix web run build` bago
ang `go build ./cmd/pi-web`.

## Pag-uninstall

```bash
pi remove npm:@ygncode/pi-web@beta
```

Pinapatakbo nito ang package `preuninstall` script (`bash uninstall.sh`), na humihinto
sa tumatakbong instance at nagtatanggal ng:

- ang pi-web binary (`~/.pi/agent/bin/pi-web`, o `/usr/local/bin/pi-web` para sa standalone installs)
- ang version file (`~/.pi/agent/pi-web-version`)
- ang runtime state file (`~/.pi/agent/pi-web/pi-web-state.json`)
- ang auto-start config (launchd plist sa macOS, systemd user service sa Linux)

Ang iyong data ay pinapanatili upang ang muling pag-install sa ibang pagkakataon ay magpatuloy kung saan ka tumigil:
`~/.pi/agent/pi-web.sqlite`, `~/.pi/agent/pi-web-memory.sqlite`, ang iyong mga session
file sa ilalim ng `~/.pi/agent/sessions/`, at `~/.config/pi-web/env` (kabilang ang
`PI_WEB_TOKEN`). Tanggalin ang mga iyon nang manu-mano kung gusto mo ng malinis na simula.

## Paggamit

```bash
# Magsimula sa default port (31415)
pi-web

# Magsimula at magbukas ng browser
pi-web -o

# Custom na port
pi-web -p 8080

# I-override ang bind host (loopback ay unauthenticated bilang default)
pi-web --host 127.0.0.1

# Ang non-loopback bind ay nangangailangan ng token — pi-web ay tatangging magsimula kung wala nito
PI_WEB_TOKEN=$(openssl rand -hex 16) pi-web --host 192.168.1.50
```

Bilang default, ang pi-web ay nagba-bind sa `127.0.0.1`. Kung tumatakbo ang Tailscale na may MagicDNS, pinapatakbo rin ng pi-web ang `tailscale serve --bg --https=<port> http://127.0.0.1:<port>` at ipinapakita ang HTTPS tailnet URL. Anumang tahasang non-loopback bind ay nangangailangan na maitakda ang `PI_WEB_TOKEN`; ipasa ang `--insecure` upang i-override para sa lokal na pagsubok.

## Malayuang Pag-access

Iwanang nakikinig nang lokal ang pi-web, pagkatapos ay gamitin ang naka-print na Tailscale HTTPS URL mula sa iyong telepono o laptop sa tailnet.

Sa Linux, payagan ang iyong user na pamahalaan ang Tailscale bago i-install/patakbuhin ang pi-web, kung hindi, ang `tailscale serve` ay maaaring mangailangan ng sudo at maaaring mabigo ang auto-start:

```bash
sudo tailscale set --operator=$USER
```

```bash
# 1. Simulan ang pi-web
pi-web

# 2. Mula sa anumang iba pang Tailscale-connected device, buksan ang naka-print na
#    "Tailscale HTTPS" URL.
```

> Bilang default, tumatanggi ang pi-web na mag-bind sa isang non-loopback address maliban kung nakatakda ang `PI_WEB_TOKEN` — sinumang makakaabot sa naka-bind na address ay maaaring makakita ng mga session at magpadala ng mga utos sa pi. Upang i-override ang proteksyong ito para sa pagsubok sa lokal na network, ipasa ang `--insecure`. **Huwag gumamit ng `--insecure` sa Tailscale o anumang address na maaabot mula sa labas ng iyong makina.**
>
> Maaaring ipasa ng mga kliyente ang token sa pamamagitan ng `Authorization: Bearer <token>` header, ang `X-Pi-Token` header, o minsan sa pamamagitan ng `?token=<token>` (na nagtatakda ng `pi_token` cookie para sa mga kasunod na kahilingan). Ang mga token na ipinapasa sa pamamagitan ng `?token=` ay napupunta sa kasaysayan ng browser, server access logs, at `Referer` headers mula sa anumang link sa pahina — mas mainam na gamitin ang header form para sa anumang lampas sa paunang bookmark.

## Browser Chat

Magbukas ng pahina ng session at gamitin ang composer sa ibaba upang ipagpatuloy ang eksaktong session na iyon.

- Ang `Enter` ay nagpapadala, ang `Shift+Enter` ay naglalagay ng bagong linya
- I-drag-and-drop o i-paste ang mga larawan nang direkta sa composer
- Ang model picker at thinking-level selector ay nasa header — ang mga pagbabago ay agad na nalalapat sa pinagbabatayang pi worker
- Bawat aktibong session ay nakakakuha ng sarili nitong dedikadong `pi --mode rpc` worker, kaya hindi nagba-block ang iba't ibang session sa isa't isa

## Pagbabahagi ng mga Session

I-click ang **Share** sa isang pahina ng session upang lumikha ng lihim na GitHub Gist.

Mga kinakailangan:
- Naka-install ang `gh`
- Nakumpleto ang `gh auth login`

Ang pagbabahagi ay nagbabalik ng:
- ang lihim na gist URL
- isang preview URL sa `https://pi.dev/session/#<gistId>`

Ang mga ibinahaging gist ay mga snapshot at hindi nagla-live-update.

## Auto-Start sa Login

### macOS

```bash
cp init/com.pi-web.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.pi-web.plist
```

### Linux (systemd)

```bash
# I-install ang systemd user service
mkdir -p ~/.config/systemd/user
cp init/pi-web.service ~/.config/systemd/user/

# Opsyonal: itakda ang iyong PI_WEB_TOKEN para sa non-loopback binds
# (o gamitin ang /pi-web set-token <token> mula sa loob ng pi)
mkdir -p ~/.config/pi-web
echo 'PI_WEB_TOKEN=your-token-here' > ~/.config/pi-web/env

# I-enable at simulan
systemctl --user daemon-reload
systemctl --user enable --now pi-web.service

# Suriin ang status
systemctl --user status pi-web.service

# Tingnan ang mga log
journalctl --user -u pi-web.service -f
```

> Para sa service na magsimula sa boot (bago mag-login), gumamit ng system service sa halip:
> kopyahin ang `init/pi-web.service` sa `/etc/systemd/system/` at gamitin ang `sudo systemctl`.
