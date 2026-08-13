# ການຕິດຕັ້ງ ແລະ ການນຳໃຊ້

## ຄຸນສົມບັດ

### ການຄວບຄຸມທາງໄກ

- ສືບຕໍ່ເຊສຊັນໃດໆຈາກບຣາວເຊີດ້ວຍຂໍ້ຄວາມ ຫຼື ໄຟລ໌ແນບຮູບພາບ
- ເລີ່ມເຊສຊັນໃໝ່ສຳລັບພາດໂປຣເຈັກໃດໆ, ໂດຍກົງຈາກໜ້າເວັບ UI
- ການປ່ຽນໂມເດລໃນບຣາວເຊີ ແລະ ຕົວເລືອກລະດັບການຄິດ, ຕໍ່ເຊສຊັນ
- ສະຖານະ worker ຕໍ່ເຊສຊັນ (idle / running / error) ພ້ອມການຟື້ນຟູອັດຕະໂນມັດເມື່ອລົ້ມ
- ຫຼາຍເຊສຊັນເຮັດວຽກພ້ອມກັນ — ເລີ່ມວຽກໃນເຊສຊັນໜຶ່ງ, ເບິ່ງສະຕີມອີກເຊສຊັນໜຶ່ງ
- `PI_WEB_TOKEN` ສຳລັບການເປີດເຜີຍຜ່ານ LAN ຢ່າງປອດໄພ — ຕ້ອງການຕາມຄ່າເລີ່ມຕົ້ນສຳລັບການ bind ແບບ non-loopback ແບບຊັດເຈນໃດໆ

### ການອ່ານເຊສຊັນ

- ເບິ່ງເຊສຊັນຂ້າມໂປຣເຈັກດ້ວຍຕົວກອງ, ການຄົ້ນຫາ, ແລະ ການນຳທາງສາຂາຢ່າງເຕັມຮູບແບບ
- ການອັບເດດແບບສົດໆເທື່ອລະໜ້ອຍໃນຂະນະທີ່ pi ຍັງເຮັດວຽກຢູ່ (ຜ່ານ fsnotify; ~ms latency)
- ໂໝດຕິດຕາມສຳລັບການຕິດຕາມເຊສຊັນທີ່ກຳລັງເຮັດວຽກ
- ລິ້ງເລິກໄປຫາຂໍ້ຄວາມແຕ່ລະອັນ
- ດາວໂຫຼດເຊສຊັນເປັນ JSONL
- ແບ່ງປັນພາບຖ່າຍ static ເປັນ GitHub Gists ແບບລັບ
- `/web`, `/remote`, `/refresh`, `/pi-web token` ແລະ `/pi-web set-token` pi extensions ສຳລັບການເປີດເຊສຊັນ, QR ທາງໄກ, ຊິງຄ໌ເຊສຊັນ, ແລະ ການຈັດການ token

## ຂໍ້ກຳນົດ

- [Go](https://go.dev) 1.25+
- `pi` ຢູ່ໃນ `PATH` ຂອງທ່ານສຳລັບການສົນທະນາຜ່ານບຣາວເຊີ/ການປ່ຽນໂມເດລ
- ທາງເລືອກ: `gh` ສຳລັບການແບ່ງປັນ

## ການຕິດຕັ້ງ

### Pi package (ແນະນຳ)

```bash
pi install npm:@ygncode/pi-web@beta
```

ຄຳສັ່ງດຽວນີ້:
- ຕິດຕັ້ງ npm pi package ພາຍໃຕ້ໄດເຣັກທໍຣີ package ຂອງ pi
- ເຮັດວຽກສະຄຣິບ `postinstall` ຂອງ package (`bash install.sh`)
- ດາວໂຫຼດໄບນາຣີ pi-web ທີ່ກົງກັບເວີຊັນ package ແລະ ແພລັດຟອມຂອງທ່ານຈາກ GitHub Releases
- ຕິດຕັ້ງມັນໃສ່ `~/.pi/agent/bin/pi-web`
- ຕັ້ງຄ່າການເລີ່ມອັດຕະໂນມັດເມື່ອ login (launchd ສຳລັບ macOS, systemd ສຳລັບ Linux)
- ລົງທະບຽນຄຳສັ່ງ `/web`, `/remote`, `/refresh`, `/pi-web token`, ແລະ `/pi-web set-token` ສຳລັບ pi

ການຕັ້ງຊື່ເຊສຊັນອັດຕະໂນມັດຖືກສ້າງຢູ່ໃນ pi-web (ບໍ່ແມ່ນໃນ extension) ແລະ ຕັ້ງຄ່າໄດ້ທີ່ໜ້າ `/settings`. ມັນເປີດຢູ່ຕາມຄ່າເລີ່ມຕົ້ນ: pi-web ຕັ້ງຊື່ເຊສຊັນອັດຕະໂນມັດໂດຍໃຊ້ຮິວຣິສຕິກຄຳສັບທີ່ມີໃນຕົວແບບຟຣີ (ບໍ່ໃຊ້ AI), ປ່ຽນຊື່ໃໝ່ທຸກຄັ້ງທີ່ມີຂໍ້ຄວາມໃໝ່. ທ່ານສາມາດປ່ຽນເປັນການຕັ້ງຊື່ຄັ້ງດຽວຕໍ່ເຊສຊັນ, ແລະ/ຫຼື ເລືອກໂມເດລເພື່ອຂຽນຊື່ທີ່ສະຫຼາດຂຶ້ນແທນຮິວຣິສຕິກ.

ໃນ Linux, ການເລີ່ມອັດຕະໂນມັດຖືກຕັ້ງຄ່າເປັນ user systemd service ທີ່ `~/.config/systemd/user/pi-web.service`. ຕົວຕິດຕັ້ງຈະຂຽນ `ExecStart` ໃໝ່ໃຫ້ເປັນພາດໄບນາຣີທີ່ຕິດຕັ້ງຈິງ. ຖ້າ Tailscale ມີຢູ່ໃນ runtime, pi-web ຈະເຜີຍແພ່ເຊີບເວີ localhost ດ້ວຍ Tailscale Serve HTTPS. ຖ້າ user systemd ບໍ່ສາມາດໃຊ້ໄດ້, ໃຫ້ເຮັດວຽກມັນດ້ວຍຕົນເອງດ້ວຍ `~/.pi/agent/bin/pi-web -o`.

ເພື່ອຕິດຕັ້ງສະເພາະສຳລັບໂປຣເຈັກໃດໜຶ່ງ (ແບ່ງປັນກັບທີມຂອງທ່ານຜ່ານ `.pi/settings.json`):

```bash
pi install -l npm:@ygncode/pi-web@beta
```

ຈາກນັ້ນ restart pi (ຫຼື ເຮັດ `/reload`), ແລະ ໃຊ້ `/web`, `/pi-web`, `/remote`, `/refresh`. ຈັດການ token ການເຂົ້າເຖິງຂອງທ່ານດ້ວຍ `/pi-web token` ແລະ `/pi-web set-token`.

ຖ້າ npm ຢຸດດ້ວຍ `ENOTEMPTY` ໃນຂະນະທີ່ປ່ຽນຊື່ `@ygncode/pi-web`, ໃຫ້ລຶບໄດເຣັກທໍຣີສຳຮອງທີ່ເຊື່ອງໄວ້ທີ່ຄ້າງຢູ່ຂອງ npm ແລະ ຕິດຕັ້ງ beta channel ໃໝ່:

```bash
rm -rf ~/.pi/agent/npm/node_modules/@ygncode/.pi-web-*
pi install npm:@ygncode/pi-web@beta
```

### ການຕິດຕັ້ງແບບດ່ວນ (ບໍ່ຕ້ອງມີ build tools)

```bash
curl -fsSL https://raw.githubusercontent.com/ygncode/pi-web/main/install.sh | bash
```

ຄຳສັ່ງນີ້ດາວໂຫຼດໄບນາຣີ pi-web ລ່າສຸດ, ຕິດຕັ້ງມັນໃສ່ `/usr/local/bin`, ແລະ ຕັ້ງຄ່າການເລີ່ມອັດຕະໂນມັດເມື່ອ login. ບໍ່ຕ້ອງການ Go, Node, ຫຼື pi.

### ດາວໂຫຼດໄບນາຣີ

ໄບນາຣີທີ່ສ້າງມາກ່ອນຖືກແນບມາໃນແຕ່ລະ [GitHub Release](https://github.com/ygncode/pi-web/releases).

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

ຈາກນັ້ນຍ້າຍມັນໃສ່ PATH ຂອງທ່ານ:

```bash
cp pi-web ~/.pi/agent/bin/
# ຫຼື ທົ່ວລະບົບ:
sudo cp pi-web /usr/local/bin/
```

### ສ້າງຈາກ source

```bash
git clone https://github.com/ygncode/pi-web.git
cd pi-web
make build   # ສ້າງ Vite bundle, ຈາກນັ້ນຝັງມັນໃສ່ Go binary

# ທາງເລືອກ: ເອົາໃສ່ PATH
cp pi-web ~/.pi/agent/bin/
```

frontend bundle ຖືກຝັງໂດຍ `web/assets_embed.go`, ດັ່ງນັ້ນ `go build` ຕ້ອງການ
`web/dist` ໃຫ້ມີຢູ່ກ່ອນ. `make build` ເຮັດທັງສອງຂັ້ນຕອນຕາມລຳດັບ; ຖ້າທ່ານສ້າງ
ດ້ວຍຕົນເອງ, ໃຫ້ເຮັດ `npm --prefix web install && npm --prefix web run build` ກ່ອນ
`go build ./cmd/pi-web`.

## ການຖອນການຕິດຕັ້ງ

```bash
pi remove npm:@ygncode/pi-web@beta
```

ຄຳສັ່ງນີ້ເຮັດວຽກສະຄຣິບ `preuninstall` ຂອງ package (`bash uninstall.sh`), ເຊິ່ງຢຸດ
instance ທີ່ກຳລັງເຮັດວຽກຢູ່ ແລະ ລຶບ:

- ໄບນາຣີ pi-web (`~/.pi/agent/bin/pi-web`, ຫຼື `/usr/local/bin/pi-web` ສຳລັບການຕິດຕັ້ງແບບ standalone)
- ໄຟລ໌ເວີຊັນ (`~/.pi/agent/pi-web-version`)
- ໄຟລ໌ສະຖານະ runtime (`~/.pi/agent/pi-web/pi-web-state.json`)
- ການຕັ້ງຄ່າການເລີ່ມອັດຕະໂນມັດ (launchd plist ສຳລັບ macOS, systemd user service ສຳລັບ Linux)

ຂໍ້ມູນຂອງທ່ານຖືກເກັບຮັກສາໄວ້ ເພື່ອໃຫ້ການຕິດຕັ້ງໃໝ່ໃນພາຍຫຼັງສາມາດເລີ່ມຕໍ່ຈາກຈຸດທີ່ທ່ານຢຸດໄວ້:
`~/.pi/agent/pi-web.sqlite`, `~/.pi/agent/pi-web-memory.sqlite`, ໄຟລ໌ເຊສຊັນຂອງທ່ານ
ພາຍໃຕ້ `~/.pi/agent/sessions/`, ແລະ `~/.config/pi-web/env` (ລວມທັງ
`PI_WEB_TOKEN`). ລຶບສິ່ງເຫຼົ່ານັ້ນດ້ວຍຕົນເອງ ຖ້າທ່ານຕ້ອງການເລີ່ມຕົ້ນໃໝ່ທັງໝົດ.

## ການນຳໃຊ້

```bash
# ເລີ່ມເຮັດວຽກທີ່ພອດເລີ່ມຕົ້ນ (31415)
pi-web

# ເລີ່ມເຮັດວຽກ ແລະ ເປີດບຣາວເຊີ
pi-web -o

# ພອດທີ່ກຳນົດເອງ
pi-web -p 8080

# ປ່ຽນ bind host (loopback ບໍ່ມີການຢືນຢັນຕາມຄ່າເລີ່ມຕົ້ນ)
pi-web --host 127.0.0.1

# ການ bind ແບບ non-loopback ຕ້ອງການ token — pi-web ຈະປະຕິເສດບໍ່ເລີ່ມເຮັດວຽກຖ້າບໍ່ມີ
PI_WEB_TOKEN=$(openssl rand -hex 16) pi-web --host 192.168.1.50
```

ຕາມຄ່າເລີ່ມຕົ້ນ, pi-web binds ກັບ `127.0.0.1`. ຖ້າ Tailscale ກຳລັງເຮັດວຽກດ້ວຍ MagicDNS, pi-web ຍັງຈະເຮັດ `tailscale serve --bg --https=<port> http://127.0.0.1:<port>` ແລະ ສະແດງ HTTPS tailnet URL. ການ bind non-loopback ແບບຊັດເຈນໃດໆ ຕ້ອງການໃຫ້ `PI_WEB_TOKEN` ຖືກຕັ້ງຄ່າ; ໃຊ້ `--insecure` ເພື່ອຂ້າມສຳລັບການທົດສອບພາຍໃນ.

## ການເຂົ້າເຖິງທາງໄກ

ປ່ອຍໃຫ້ pi-web ຟັງຢູ່ພາຍໃນ, ຈາກນັ້ນໃຊ້ Tailscale HTTPS URL ທີ່ສະແດງຈາກໂທລະສັບ ຫຼື ແລັບທັອບຂອງທ່ານໃນ tailnet.

ໃນ macOS, ຕິດຕັ້ງ ແລະ ເປີດ Tailscale ແບບໂຕ້ຕອບ, ອະນຸມັດຄຳຂໍສິດ administrator ແລະ ເຂົ້າລະບົບ. ຈາກນັ້ນເອີ້ນໃຊ້ `/pi-web restart`, ຕາມດ້ວຍ `/remote`.

ໃນ Linux, ໃຫ້ອະນຸຍາດໃຫ້ຜູ້ໃຊ້ຂອງທ່ານຈັດການ Tailscale ກ່ອນການຕິດຕັ້ງ/ເຮັດວຽກ pi-web, ຖ້າບໍ່ດັ່ງນັ້ນ `tailscale serve` ອາດຕ້ອງການ sudo ແລະ ການເລີ່ມອັດຕະໂນມັດອາດລົ້ມເຫຼວ:

```bash
sudo tailscale set --operator=$USER
```

```bash
# 1. ເລີ່ມ pi-web
pi-web

# 2. ຈາກອຸປະກອນອື່ນທີ່ເຊື່ອມຕໍ່ Tailscale, ເປີດ
#    "Tailscale HTTPS" URL ທີ່ສະແດງຢູ່.
```

> ຕາມຄ່າເລີ່ມຕົ້ນ, pi-web ປະຕິເສດການ bind ກັບທີ່ຢູ່ non-loopback ເວັ້ນເສຍແຕ່ວ່າ `PI_WEB_TOKEN` ຖືກຕັ້ງຄ່າ — ຜູ້ທີ່ສາມາດເຂົ້າເຖິງທີ່ຢູ່ທີ່ຖືກ bind ໄດ້ ອາດສາມາດເບິ່ງເຊສຊັນ ແລະ ສົ່ງຄຳສັ່ງໄປຫາ pi. ເພື່ອຂ້າມການປ້ອງກັນນີ້ສຳລັບການທົດສອບພາຍໃນເຄືອຂ່າຍ, ໃຫ້ໃຊ້ `--insecure`. **ຢ່າໃຊ້ `--insecure` ເທິງ Tailscale ຫຼື ທີ່ຢູ່ໃດໆທີ່ສາມາດເຂົ້າເຖິງໄດ້ຈາກພາຍນອກເຄື່ອງຂອງທ່ານ.**
>
> ຜູ້ໃຊ້ສາມາດສົ່ງ token ຜ່ານ header `Authorization: Bearer <token>`, header `X-Pi-Token`, ຫຼື ຄັ້ງດຽວຜ່ານ `?token=<token>` (ເຊິ່ງຕັ້ງ cookie `pi_token` ສຳລັບຄຳຂໍຕໍ່ໄປ). tokens ທີ່ສົ່ງຜ່ານ `?token=` ຈະປາກົດຢູ່ໃນປະຫວັດບຣາວເຊີ, ລັອກການເຂົ້າເຖິງເຊີບເວີ, ແລະ `Referer` headers ຈາກລິ້ງໃດໆໃນໜ້າ — ແນະນຳໃຫ້ໃຊ້ຮູບແບບ header ສຳລັບທຸກຢ່າງນອກເໜືອຈາກ bookmark ເບື້ອງຕົ້ນ.

## ການສົນທະນາຜ່ານບຣາວເຊີ

ເປີດໜ້າເຊສຊັນ ແລະ ໃຊ້ composer ດ້ານລຸ່ມເພື່ອສືບຕໍ່ເຊສຊັນນັ້ນໆ.

- `Enter` ສົ່ງ, `Shift+Enter` ໃສ່ບັນທັດໃໝ່
- ລາກແລ້ວວາງ ຫຼື ວາງຮູບພາບໂດຍກົງໃສ່ composer
- ຕົວເລືອກໂມເດລ ແລະ ຕົວເລືອກລະດັບການຄິດຢູ່ໃນ header — ການປ່ຽນແປງຈະມີຜົນຕໍ່ pi worker ທີ່ຢູ່ເບື້ອງຫຼັງທັນທີ
- ແຕ່ລະເຊສຊັນທີ່ເຮັດວຽກມີ `pi --mode rpc` worker ຂອງຕົນເອງ, ດັ່ງນັ້ນເຊສຊັນທີ່ແຕກຕ່າງກັນຈະບໍ່ບລັອກກັນ

## ການແບ່ງປັນເຊສຊັນ

ຄລິກ **Share** ໃນໜ້າເຊສຊັນເພື່ອສ້າງ GitHub Gist ແບບລັບ.

ຂໍ້ກຳນົດ:
- `gh` ຖືກຕິດຕັ້ງ
- `gh auth login` ສຳເລັດແລ້ວ

ການແບ່ງປັນສົ່ງຄືນ:
- secret gist URL
- preview URL ທີ່ `https://pi.dev/session/#<gistId>`

gists ທີ່ແບ່ງປັນແມ່ນພາບຖ່າຍ ແລະ ບໍ່ມີການອັບເດດແບບສົດໆ.

## ການເລີ່ມອັດຕະໂນມັດເມື່ອ Login

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

# ທາງເລືອກ: ຕັ້ງຄ່າ PI_WEB_TOKEN ຂອງທ່ານສຳລັບ non-loopback binds
# (ຫຼື ໃຊ້ /pi-web set-token <token> ຈາກພາຍໃນ pi)
mkdir -p ~/.config/pi-web
echo 'PI_WEB_TOKEN=your-token-here' > ~/.config/pi-web/env

# ເປີດໃຊ້ງານ ແລະ ເລີ່ມ
systemctl --user daemon-reload
systemctl --user enable --now pi-web.service

# ກວດສອບສະຖານະ
systemctl --user status pi-web.service

# ເບິ່ງລັອກ
journalctl --user -u pi-web.service -f
```

> ສຳລັບການເລີ່ມ service ຕອນ boot (ກ່ອນ login), ໃຫ້ໃຊ້ system service ແທນ:
> ກັອບປີ້ `init/pi-web.service` ໃສ່ `/etc/systemd/system/` ແລະ ໃຊ້ `sudo systemctl`.
