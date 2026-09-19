# ການຕິດຕັ້ງ ແລະ ການນຳໃຊ້

## ຄຸນສົມບັດ

### ການຄວບຄຸມຈາກໄລຍະໄກ

- ສືບຕໍ່ເຊດຊັນໃດກໍໄດ້ຈາກບຣາວເຊີ ດ້ວຍຂໍ້ຄວາມ ຫຼື ໄຟລ໌ຮູບພາບທີ່ແນບມາ
- ເລີ່ມເຊດຊັນໃໝ່ສົດໆ ຕໍ່ກັບເສັ້ນທາງໂປຣເຈັກໃດກໍໄດ້ ໂດຍກົງຈາກໜ້າ UI ເວັບ
- ການສະຫຼັບໂມເດວ ແລະ ຕົວເລືອກລະດັບການຄິດ ພາຍໃນບຣາວເຊີ ຕໍ່ເຊດຊັນ
- ສະຖານະ worker ຕໍ່ເຊດຊັນ (ຢູ່ສະບາຍ / ກຳລັງເຮັດວຽກ / ເກີດຂໍ້ຜິດພາດ) ພ້ອມການກູ້ຄືນອັດຕະໂນມັດເມື່ອ crash
- ຫຼາຍເຊດຊັນເຮັດວຽກຂະໜານກັນ — ເລີ່ມວຽກໃນເຊດຊັນໜຶ່ງ, ເບິ່ງອີກເຊດຊັນໜຶ່ງ stream ຢູ່
- `PI_WEB_TOKEN` ສຳລັບການເປີດເຜີຍເທິງ LAN ຢ່າງປອດໄພ — ຈຳເປັນຕາມຄ່າເລີ່ມຕົ້ນ ສຳລັບການ bind ແບບບໍ່ແມ່ນ loopback ທີ່ລະບຸຢ່າງຊັດເຈນ

### ການອ່ານເຊດຊັນ

- ເບິ່ງເຊດຊັນຂ້າມໂປຣເຈັກ ດ້ວຍຕົວກອງ, ການຄົ້ນຫາ ແລະ ການນຳທາງແບບ branch ເຕັມຮູບແບບ
- ການອັບເດດແບບ incremental ສົດໆ ໃນຂະນະທີ່ pi ຍັງເຮັດວຽກຢູ່ (ຜ່ານ fsnotify; latency ປະມານ ms)
- ໂໝດ follow ສຳລັບ tail ເຊດຊັນທີ່ເຄື່ອນໄຫວ
- deep link ໄປຫາຂໍ້ຄວາມແຕ່ລະອັນ
- ດາວໂຫຼດເຊດຊັນເປັນ JSONL
- ແບ່ງປັນ snapshot ແບບ static ເປັນ GitHub Gists ແບບລັບ
- ສ່ວນຂະຫຍາຍ pi ຄື `/web`, `/remote`, `/refresh`, `/pi-web token` ແລະ `/pi-web set-token` ສຳລັບການເປີດເຊດຊັນ, QR ໄລຍະໄກ, ການ sync ເຊດຊັນ ແລະ ການຈັດການ token
- `/skill:pi-web-schedule`, `/skill:pi-web-notes`, `/skill:pi-web-settings` (`pi-web-ctl`) ເພື່ອໃຫ້ເຊດຊັນສາມາດຈັດການຕາຕະລາງ, scratchpad ຂອງໂປຣເຈັກ ແລະ ການຕັ້ງຄ່າ ດ້ວຍພາສາທຳມະຊາດ

## ຄວາມຕ້ອງການ

- [Go](https://go.dev) 1.25+ (ສະເພາະການ build ຈາກ source ເທົ່ານັ້ນ)
- `pi` ຢູ່ໃນ `PATH` ຂອງທ່ານ ສຳລັບການສົນທະນາຜ່ານບຣາວເຊີ/ການສະຫຼັບໂມເດວ
- ທາງເລືອກ: `gh` ສຳລັບການແບ່ງປັນ
- ບົນ Windows: pi ຕ້ອງການ bash shell ສຳລັບ shell tool ຂອງມັນ — [Git for Windows](https://git-scm.com/download/win) ກໍພຽງພໍ (ເບິ່ງເອກະສານ Windows ຂອງ pi)

## ການຕິດຕັ້ງ

### ແພັກເກດ Pi (ແນະນຳ)

```bash
pi install npm:@ygncode/pi-web@beta
```

ຄຳສັ່ງດຽວນີ້:
- ຕິດຕັ້ງ npm pi package ພາຍໃຕ້ package directory ຂອງ pi
- ຮັນ script `postinstall` ຂອງ package (`install.sh`, ຫຼື `install.ps1` ບົນ Windows)
- ດາວໂຫຼດ binary pi-web ທີ່ກົງກັບເວີຊັນ package ແລະ platform ຂອງທ່ານ ຈາກ GitHub Releases
- ຕິດຕັ້ງມັນໄປທີ່ `~/.pi/agent/bin/pi-web` (`pi-web.exe` ບົນ Windows)
- ຕັ້ງຄ່າ auto-start ເມື່ອ login (launchd ບົນ macOS, systemd ບົນ Linux, launcher ແບບ Run-key ບົນ Windows)
- ລົງທະບຽນຄຳສັ່ງ pi ຄື `/web`, `/remote`, `/refresh`, `/pi-web token` ແລະ `/pi-web set-token`

ການຕັ້ງຊື່ເຊດຊັນອັດຕະໂນມັດແມ່ນຝັງຢູ່ໃນ pi-web ເອງ (ບໍ່ແມ່ນສ່ວນຂະຫຍາຍ) ແລະ ຕັ້ງຄ່າໄດ້ທີ່ໜ້າ `/settings`. ມັນເປີດໃຊ້ຕາມຄ່າເລີ່ມຕົ້ນ: pi-web ຕັ້ງຊື່ເຊດຊັນອັດຕະໂນມັດ ໂດຍໃຊ້ heuristic ຄຳສັບທີ່ສ້າງໃນຕົວແບບຟຣີ (ບໍ່ໃຊ້ AI), ຕັ້ງຊື່ໃໝ່ທຸກຄັ້ງທີ່ມີຂໍ້ຄວາມໃໝ່. ທ່ານສາມາດປ່ຽນເປັນການຕັ້ງຊື່ແຕ່ເທື່ອດຽວຕໍ່ເຊດຊັນ, ແລະ/ຫຼື ເລືອກໂມເດວເພື່ອຂຽນຊື່ທີ່ສະຫຼາດກວ່າ ແທນ heuristic.

ບົນ Linux, auto-start ຖືກຕັ້ງຄ່າເປັນ user systemd service ທີ່ `~/.config/systemd/user/pi-web.service`. ຕົວ installer ຈະຂຽນ `ExecStart` ຂອງມັນໃໝ່ ໃຫ້ຊີ້ໄປທີ່ເສັ້ນທາງ binary ທີ່ຕິດຕັ້ງຈິງ. ຖ້າ Tailscale ມີຢູ່ໃນ runtime, pi-web ຈະເຜີຍແຜ່ server ທ້ອງຖິ່ນດ້ວຍ Tailscale Serve HTTPS. ຖ້າບໍ່ມີ user systemd, ໃຫ້ຮັນມັນເອງດ້ວຍ `~/.pi/agent/bin/pi-web -o`.

ເພື່ອຕິດຕັ້ງສະເພາະສຳລັບໂປຣເຈັກໃດໜຶ່ງ (ແບ່ງປັນກັບທີມຂອງທ່ານຜ່ານ `.pi/settings.json`):

```bash
pi install -l npm:@ygncode/pi-web@beta
```

ຈາກນັ້ນ restart pi (ຫຼື ຮັນ `/reload`), ແລະ ໃຊ້ `/web`, `/pi-web`, `/remote`, `/refresh`. ຈັດການ access token ຂອງທ່ານດ້ວຍ `/pi-web token` ແລະ `/pi-web set-token`.

ຖ້າ npm abort ດ້ວຍ `ENOTEMPTY` ໃນຂະນະທີ່ renaming `@ygncode/pi-web`, ໃຫ້ລຶບ hidden backup directory ເກົ່າຂອງ npm ແລ້ວຕິດຕັ້ງ beta channel ໃໝ່:

```bash
rm -rf ~/.pi/agent/npm/node_modules/@ygncode/.pi-web-*
pi install npm:@ygncode/pi-web@beta
```

### ການຕິດຕັ້ງແບບດ່ວນ (ບໍ່ຕ້ອງໃຊ້ build tools)

macOS / Linux:

```bash
curl -fsSL https://raw.githubusercontent.com/ygncode/pi-web/main/install.sh | bash
```

Windows (PowerShell):

```powershell
irm https://raw.githubusercontent.com/ygncode/pi-web/main/install.ps1 | iex
```

ນີ້ຈະດາວໂຫຼດ binary pi-web ຫຼ້າສຸດ, ຕິດຕັ້ງມັນໄປທີ່ `/usr/local/bin` (`~/.pi/agent/bin` ບົນ Windows), ແລະ ຕັ້ງຄ່າ auto-start ເມື່ອ login. ບໍ່ຈຳເປັນຕ້ອງມີ Go, Node ຫຼື pi.

### ດາວໂຫຼດ binary

binary ທີ່ build ສຳເລັດແລ້ວ ແມ່ນແນບມາກັບແຕ່ລະ [GitHub Release](https://github.com/ygncode/pi-web/releases).

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

ຈາກນັ້ນຍ້າຍມັນໄປໃສ່ PATH ຂອງທ່ານ:

```bash
cp pi-web ~/.pi/agent/bin/
# ຫຼື ແບບທົ່ວລະບົບ:
sudo cp pi-web /usr/local/bin/
```

### Build ຈາກ source

```bash
git clone https://github.com/ygncode/pi-web.git
cd pi-web
make build   # builds the Vite bundle, then embeds it into the Go binary

# optional: put it on PATH
cp pi-web ~/.pi/agent/bin/
```

frontend bundle ຖືກ embed ໂດຍ `web/assets_embed.go`, ດັ່ງນັ້ນ `go build` ຕ້ອງການ
`web/dist` ໃຫ້ມີຢູ່ກ່ອນ. `make build` ເຮັດທັງສອງຂັ້ນຕອນຕາມລຳດັບ; ຖ້າທ່ານ build
ດ້ວຍມື, ໃຫ້ຮັນ `npm --prefix web install && npm --prefix web run build` ກ່ອນ
`go build ./cmd/pi-web`.

### ພັດທະນາຄຽງຂ້າງກັບ instance ທີ່ຕິດຕັ້ງຢູ່ແລ້ວ

ປ່ອຍໃຫ້ instance ທີ່ຕິດຕັ້ງຢູ່ແລ້ວ ເຮັດວຽກຢູ່ port `31415`, ຈາກນັ້ນເລີ່ມ source
checkout ໃນໂໝດ development:

```bash
make dev
```

ເປີດ `http://127.0.0.1:31416`. `make dev` ຕັ້ງ environment ພາຍໃນ `PI_WEB_DEV=1`,
ດັ່ງນັ້ນ source checkout ຈຶ່ງແບ່ງປັນເຊດຊັນ, ການຕັ້ງຄ່າ ແລະ ຂໍ້ມູນ
SQLite ຮ່ວມກັບ instance ທີ່ຕິດຕັ້ງຢູ່ ໃນຂະນະທີ່ຍັງຄົງແຍກ runtime lock ແລະ state file
ຂອງ development ຕ່າງຫາກ. instance ແບບຕິດຕັ້ງປົກກະຕິ ແລະ ແບບຮັນເອງ
ຈະບໍ່ປ່ຽນແປງ ແລະ ຄົງພຶດຕິກຳ single-instance ເດີມໄວ້.

ເພື່ອປ້ອງກັນວຽກແບບ autonomous ຊ້ຳກັນ, ໂໝດ development ຈະບໍ່ຮັນ
schedule loop, chat-queue drainer, ການຕັ້ງຊື່ອັດຕະໂນມັດ ຫຼື push notifications. ຄຳຮ້ອງຂໍໂດຍກົງ
ທີ່ເຮັດຜ່ານ development UI ຍັງໃຊ້ໄດ້. ຢ່າຂັບເຄື່ອນ
ເຊດຊັນສົນທະນາດຽວກັນ ຈາກທັງສອງ instance ພ້ອມກັນ; ແຕ່ລະ process ມີ RPC worker
manager ຂອງຕົນເອງ.

`make dev` ຕ້ອງການ [Air](https://github.com/air-verse/air) ສຳລັບ Go hot reload:

```bash
go install github.com/air-verse/air@latest
```

`PI_WEB_DEV` ແມ່ນ plumbing ຂອງ development harness, ບໍ່ແມ່ນໂໝດ
multi-instance ທີ່ຮອງຮັບສຳລັບ production.

## ການຖອນການຕິດຕັ້ງ

```bash
pi remove npm:@ygncode/pi-web@beta
```

ນີ້ຈະຮັນ script `preuninstall` ຂອງ package (`uninstall.sh`, ຫຼື `uninstall.ps1`
ບົນ Windows), ເຊິ່ງຈະຢຸດ instance ທີ່ເຮັດວຽກຢູ່ ແລະ ລຶບ:

- binary pi-web (`~/.pi/agent/bin/pi-web`, ຫຼື `/usr/local/bin/pi-web` ສຳລັບການຕິດຕັ້ງແບບ standalone)
- ໄຟລ໌ເວີຊັນ (`~/.pi/agent/pi-web-version`)
- ໄຟລ໌ runtime state (`~/.pi/agent/pi-web/pi-web-state.json`)
- ການຕັ້ງຄ່າ auto-start (launchd plist ບົນ macOS, systemd user service ບົນ Linux, Run-key entry + launcher scripts ບົນ Windows)

ຂໍ້ມູນຂອງທ່ານຖືກເກັບໄວ້ ເພື່ອໃຫ້ການຕິດຕັ້ງໃໝ່ໃນພາຍຫຼັງ ເລີ່ມຕໍ່ຈາກຈຸດທີ່ທ່ານຢຸດໄວ້:
`~/.pi/agent/pi-web.sqlite`, `~/.pi/agent/pi-web-memory.sqlite`, ໄຟລ໌ເຊດຊັນຂອງທ່ານ
ພາຍໃຕ້ `~/.pi/agent/sessions/`, ແລະ `~/.config/pi-web/env` (ລວມທັງ
`PI_WEB_TOKEN`). ລຶບສິ່ງເຫຼົ່ານັ້ນເອງ ຖ້າທ່ານຕ້ອງການເລີ່ມໃໝ່ສະອາດ.

## ການນຳໃຊ້

```bash
# ເລີ່ມຢູ່ port ເລີ່ມຕົ້ນ (31415)
pi-web

# ເລີ່ມ ແລະ ເປີດບຣາວເຊີ
pi-web -o

# port ທີ່ກຳນົດເອງ
pi-web -p 8080

# ກຳນົດ bind host ໃໝ່ (loopback ບໍ່ມີການກວດສິດ ຕາມຄ່າເລີ່ມຕົ້ນ)
pi-web --host 127.0.0.1

# ການ bind ແບບບໍ່ແມ່ນ loopback ຕ້ອງການ token — pi-web ຈະປະຕິເສດການເລີ່ມ ຖ້າບໍ່ມີ
PI_WEB_TOKEN=$(openssl rand -hex 16) pi-web --host 192.168.1.50
```

ຕາມຄ່າເລີ່ມຕົ້ນ, pi-web ຈະ bind ໄປທີ່ `127.0.0.1`. ຖ້າ Tailscale ເຮັດວຽກຢູ່ດ້ວຍ MagicDNS **ແລະ `PI_WEB_TOKEN` ຖືກຕັ້ງໄວ້**, pi-web ຍັງຈະຮັນ `tailscale serve --bg --https=<port> http://127.0.0.1:<port>` ແລະ ພິມ HTTPS tailnet URL ອອກມາ. ຖ້າບໍ່ມີ token, pi-web ຈະຢູ່ແບບ loopback-only ເທົ່ານັ້ນ ແລະ ຂ້າມ Tailscale Serve, ດັ່ງນັ້ນ tailnet peers ຈຶ່ງບໍ່ສາມາດເຂົ້າຫາ agent ແບບບໍ່ມີການກວດສິດໄດ້. ການ bind ແບບບໍ່ແມ່ນ loopback ທີ່ລະບຸຢ່າງຊັດເຈນ ກໍຕ້ອງການ `PI_WEB_TOKEN` ເຊັ່ນກັນ; ສົ່ງ `--insecure` ເພື່ອຂ້າມການກວດສຳລັບການທົດສອບທ້ອງຖິ່ນ.

## ການເຂົ້າເຖິງຈາກໄລຍະໄກ

ປ່ອຍໃຫ້ pi-web ຟັງຢູ່ທ້ອງຖິ່ນ, ຈາກນັ້ນໃຊ້ Tailscale HTTPS URL ທີ່ພິມອອກມາ ຈາກໂທລະສັບ ຫຼື ແລັບທັອບຂອງທ່ານບົນ tailnet.

ບົນ macOS, ຕິດຕັ້ງ ແລະ ເປີດ Tailscale ແບບ interactive, ອະນຸມັດ administrator prompt, ແລະ ລົງຊື່ເຂົ້າໃຊ້. ຈາກນັ້ນຮັນ `/pi-web restart`, ຕາມດ້ວຍ `/remote`.

ບົນ Linux, ອະນຸຍາດໃຫ້ user ຂອງທ່ານຈັດການ Tailscale ກ່ອນຕິດຕັ້ງ/ຮັນ pi-web, ຖ້າບໍ່ດັ່ງນັ້ນ `tailscale serve` ອາດຕ້ອງໃຊ້ sudo ແລະ auto-start ອາດລົ້ມເຫຼວ:

```bash
sudo tailscale set --operator=$USER
```

```bash
# 1. ເລີ່ມ pi-web ດ້ວຍ token ເພື່ອໃຫ້ມັນເຜີຍແຜ່ Tailscale HTTPS endpoint
PI_WEB_TOKEN=$(openssl rand -hex 16) pi-web

# 2. ຈາກອຸປະກອນທີ່ເຊື່ອມຕໍ່ Tailscale ອື່ນໆ, ເປີດ
#    URL "Tailscale HTTPS" ທີ່ພິມອອກມາ ແລະ ໃສ່ token ເທື່ອດຽວ.
```

> ຕາມຄ່າເລີ່ມຕົ້ນ, pi-web ຈະປະຕິເສດການ bind ໄປທີ່ທີ່ຢູ່ແບບບໍ່ແມ່ນ loopback ເວັ້ນເສຍແຕ່ `PI_WEB_TOKEN` ຖືກຕັ້ງໄວ້ — ຜູ້ໃດກໍຕາມທີ່ເຂົ້າເຖິງທີ່ຢູ່ທີ່ຖືກ bind ໄດ້ ອາດຈະເບິ່ງເຊດຊັນ ແລະ ສົ່ງຄຳສັ່ງໄປຫາ pi ໄດ້. ເພື່ອຂ້າມການກວດສອບນີ້ສຳລັບການທົດສອບບົນເຄືອຂ່າຍທ້ອງຖິ່ນ, ໃຫ້ສົ່ງ `--insecure`. **ຢ່າໃຊ້ `--insecure` ບົນ Tailscale ຫຼື ທີ່ຢູ່ໃດໆ ທີ່ເຂົ້າເຖິງໄດ້ຈາກພາຍນອກເຄື່ອງຂອງທ່ານ.**
>
> Client ສາມາດສົ່ງ token ຜ່ານ header `Authorization: Bearer <token>`, header `X-Pi-Token`, ຫຼື ເທື່ອດຽວຜ່ານ `?token=<token>` (ຫຼື login prompt). ເມື່ອ token ມາຜ່ານ query string, pi-web ຈະຕັ້ງ `pi_token` cookie ແລະ redirect ໄປຫາ URL ດຽວກັນໂດຍທີ່ token ຖືກຕັດອອກ, ເພື່ອບໍ່ໃຫ້ມັນຄ້າງຢູ່ໃນ address bar ຫຼື browser history. ຄວນໃຊ້ຮູບແບບ header ສຳລັບ scripts ແລະ automation.

## ການສົນທະນາຜ່ານບຣາວເຊີ

ເປີດໜ້າເຊດຊັນ ແລະ ໃຊ້ composer ຢູ່ດ້ານລຸ່ມ ເພື່ອສືບຕໍ່ເຊດຊັນນັ້ນແທ້ໆ.

- `Enter` ສົ່ງ, `Shift+Enter` ຂຶ້ນບັນທັດໃໝ່
- drag-and-drop ຫຼື ວາງຮູບພາບໃສ່ composer ໂດຍກົງ
- ຕົວເລືອກ model ແລະ ຕົວເລືອກລະດັບການຄິດ ຢູ່ໃນ header — ການປ່ຽນແປງຈະມີຜົນຕໍ່ pi worker ທີ່ຢູ່ເບື້ອງຫຼັງທັນທີ
- ແຕ່ລະເຊດຊັນທີ່ເຄື່ອນໄຫວ ຈະໄດ້ `pi --mode rpc` worker ສະເພາະຂອງຕົນເອງ, ດັ່ງນັ້ນເຊດຊັນຕ່າງໆ ຈຶ່ງບໍ່ block ກັນ

## ການແບ່ງປັນເຊດຊັນ

ຄລິກ **Share** ຢູ່ໜ້າເຊດຊັນ ເພື່ອສ້າງ GitHub Gist ແບບລັບ.

ຄວາມຕ້ອງການ:
- ຕ້ອງຕິດຕັ້ງ `gh`
- `gh auth login` ສຳເລັດແລ້ວ

ການແບ່ງປັນຈະສົ່ງກັບຄືນ:
- URL gist ແບບລັບ
- URL preview ທີ່ `https://pi.dev/session/#<gistId>`

gist ທີ່ແບ່ງປັນແມ່ນ snapshot ແລະ ບໍ່ອັບເດດແບບສົດໆ.

## Auto-Start ເມື່ອ Login

### macOS

```bash
cp init/com.pi-web.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.pi-web.plist
```

### Linux (systemd)

```bash
# ຕິດຕັ້ງ systemd user service
mkdir -p ~/.config/systemd/user
cp init/pi-web.service ~/.config/systemd/user/

# ທາງເລືອກ: ຕັ້ງ PI_WEB_TOKEN ຂອງທ່ານ ສຳລັບການ bind ແບບບໍ່ແມ່ນ loopback
# (ຫຼື ໃຊ້ /pi-web set-token <token> ຈາກພາຍໃນ pi)
mkdir -p ~/.config/pi-web
echo 'PI_WEB_TOKEN=your-token-here' > ~/.config/pi-web/env

# ເປີດໃຊ້ ແລະ ເລີ່ມ
systemctl --user daemon-reload
systemctl --user enable --now pi-web.service

# ກວດສອບສະຖານະ
systemctl --user status pi-web.service

# ເບິ່ງ logs
journalctl --user -u pi-web.service -f
```

> ເພື່ອໃຫ້ service ເລີ່ມຕອນ boot (ກ່ອນ login), ໃຫ້ໃຊ້ system service ແທນ:
> copy `init/pi-web.service` ໄປທີ່ `/etc/systemd/system/` ແລະ ໃຊ້ `sudo systemctl`.

### Windows

ຕົວ installer ຈະຕັ້ງຄ່ານີ້ໃຫ້ອັດຕະໂນມັດ ໂດຍບໍ່ຕ້ອງໃຊ້ admin rights: ລາຍການ
`pi-web` ພາຍໃຕ້ `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`
ຈະ launch `~/.config/pi-web/pi-web-start.vbs` ຕອນ login, ເຊິ່ງຈະເລີ່ມ binary
ແບບ hidden (ບໍ່ມີ console window) ຫຼັງຈາກ load `~/.config/pi-web/env`
(`PI_WEB_TOKEN`, `PATH`, ...).

ເພື່ອຈັດການດ້ວຍມື:

```powershell
# ເລີ່ມ / ຢຸດ
wscript.exe "$HOME\.config\pi-web\pi-web-start.vbs"
taskkill /IM pi-web.exe /F

# ລຶບ auto-start
Remove-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run' -Name 'pi-web'
```

ບົນ Windows ບໍ່ມີການກຳກັບ service: ຖ້າ pi-web crash ມັນຈະຢຸດລົງ
ຈົນກວ່າຈະ login ຄັ້ງຕໍ່ໄປ (launchd/systemd ຈະ restart ໃຫ້ອັດຕະໂນມັດບົນ
platform ອື່ນໆ).
