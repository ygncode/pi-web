# การติดตั้งและการใช้งาน

## ฟีเจอร์

### การควบคุมระยะไกล

- ดำเนินเซสชันใดก็ได้ต่อจากเบราว์เซอร์ด้วยข้อความหรือไฟล์แนบรูปภาพ
- เริ่มเซสชันใหม่กับเส้นทางโปรเจกต์ใดก็ได้จากเว็บ UI ได้ทันที
- สลับโมเดลและตัวเลือกระดับการคิดในเบราว์เซอร์ แยกตามเซสชัน
- สถานะ worker แยกตามเซสชัน (idle / running / error) พร้อมการกู้คืนอัตโนมัติเมื่อเกิดการขัดข้อง
- หลายเซสชันทำงานแบบขนาน — เริ่มงานในเซสชันหนึ่ง แล้วดูอีกเซสชันสตรีมอยู่
- `PI_WEB_TOKEN` สำหรับการเปิดให้เข้าถึงผ่าน LAN อย่างปลอดภัย — จำเป็นโดยค่าเริ่มต้นสำหรับการ bind แบบ non-loopback อย่างชัดแจ้ง

### การอ่านเซสชัน

- เรียกดูเซสชันข้ามโปรเจกต์ด้วยตัวกรอง การค้นหา และการนำทางแบรนช์แบบเต็มรูปแบบ
- อัปเดตแบบไลฟ์เพิ่มขึ้นเรื่อย ๆ ขณะที่ pi ยังทำงานอยู่ (ผ่าน fsnotify; หน่วงเวลาระดับ ~มิลลิวินาที)
- โหมด Follow สำหรับติดตามเซสชันที่กำลังทำงาน
- ลิงก์ลึกไปยังข้อความแต่ละข้อความ
- ดาวน์โหลดเซสชันเป็น JSONL
- แชร์สแนปช็อตแบบ static เป็น GitHub Gist แบบลับ
- ส่วนขยาย pi `/web`, `/remote`, `/refresh`, `/pi-web token` และ `/pi-web set-token` สำหรับการเปิดเซสชัน, QR ระยะไกล, การซิงก์เซสชัน และการจัดการโทเค็น
- `/skill:pi-web-schedule`, `/skill:pi-web-notes`, `/skill:pi-web-settings` (`pi-web-ctl`) เพื่อให้เซสชันจัดการกำหนดการ, scratchpad ของโปรเจกต์ และการตั้งค่าด้วยภาษาธรรมชาติ

## ข้อกำหนด

- [Go](https://go.dev) 1.25+ (เฉพาะสำหรับการ build จากซอร์ส)
- `pi` อยู่ใน `PATH` ของคุณสำหรับการแชทในเบราว์เซอร์/การสลับโมเดล
- ตัวเลือก: `gh` สำหรับการแชร์
- บน Windows: pi ต้องใช้เชลล์ bash สำหรับเครื่องมือ shell — [Git for Windows](https://git-scm.com/download/win) ก็เพียงพอ (ดูเอกสาร Windows ของ pi)

## การติดตั้ง

### แพ็กเกจ Pi (แนะนำ)

```bash
pi install npm:@ygncode/pi-web@beta
```

คำสั่งเดียวนี้:

- ติดตั้งแพ็กเกจ npm ของ pi ใต้ไดเรกทอรีแพ็กเกจของ pi
- รันสคริปต์ `postinstall` ของแพ็กเกจ (`install.sh` หรือ `install.ps1` บน Windows)
- ดาวน์โหลดไบนารี pi-web ที่ตรงกับเวอร์ชันแพ็กเกจและแพลตฟอร์มของคุณจาก GitHub Releases
- ติดตั้งไปที่ `~/.pi/agent/bin/pi-web` (`pi-web.exe` บน Windows)
- ตั้งค่าการเริ่มอัตโนมัติเมื่อเข้าสู่ระบบ (launchd บน macOS, systemd บน Linux, ตัวเรียกใช้ผ่าน Run-key บน Windows)
- ลงทะเบียนคำสั่ง pi `/web`, `/remote`, `/refresh`, `/pi-web token` และ `/pi-web set-token`

การตั้งชื่อเซสชันอัตโนมัติฝังอยู่ใน pi-web (ไม่ใช่ส่วนขยาย) และกำหนดค่าที่หน้า `/settings` เปิดใช้งานเป็นค่าเริ่มต้น: pi-web ตั้งชื่อเซสชันอัตโนมัติโดยใช้ฮิวริสติกคำที่ฝังมาในตัวแบบฟรี (ไม่ใช้ AI) โดยตั้งชื่อใหม่ทุกข้อความใหม่ คุณสามารถสลับเป็นการตั้งชื่อเพียงครั้งเดียวต่อเซสชัน และ/หรือเลือกโมเดลเพื่อเขียนชื่อที่ฉลาดกว่าแทนฮิวริสติก

บน Linux การเริ่มอัตโนมัติถูกกำหนดค่าเป็นบริการ systemd ของผู้ใช้ที่ `~/.config/systemd/user/pi-web.service` ตัวติดตั้งจะเขียน `ExecStart` ใหม่ให้เป็นเส้นทางไบนารีที่ติดตั้งจริง หาก Tailscale พร้อมใช้งานตอนรันไทม์ pi-web จะเผยแพร่เซิร์ฟเวอร์ localhost ด้วย Tailscale Serve HTTPS หาก systemd ของผู้ใช้ไม่พร้อมใช้งาน ให้รันด้วยตนเองด้วย `~/.pi/agent/bin/pi-web -o`

หากต้องการติดตั้งเฉพาะโปรเจกต์ใดโปรเจกต์หนึ่ง (แชร์กับทีมผ่าน `.pi/settings.json`):

```bash
pi install -l npm:@ygncode/pi-web@beta
```

จากนั้นรีสตาร์ท pi (หรือรัน `/reload`) และใช้ `/web`, `/pi-web`, `/remote`, `/refresh` จัดการโทเค็นการเข้าถึงของคุณด้วย `/pi-web token` และ `/pi-web set-token`

หาก npm ยกเลิกด้วย `ENOTEMPTY` ขณะเปลี่ยนชื่อ `@ygncode/pi-web` ให้ลบไดเรกทอรีสำรองที่ซ่อนอยู่ค้างของ npm แล้วติดตั้งช่องทาง beta ใหม่:

```bash
rm -rf ~/.pi/agent/npm/node_modules/@ygncode/.pi-web-*
pi install npm:@ygncode/pi-web@beta
```

### ติดตั้งแบบรวดเร็ว (ไม่ต้องใช้เครื่องมือ build)

macOS / Linux:

```bash
curl -fsSL https://raw.githubusercontent.com/ygncode/pi-web/main/install.sh | bash
```

Windows (PowerShell):

```powershell
irm https://raw.githubusercontent.com/ygncode/pi-web/main/install.ps1 | iex
```

วิธีนี้จะดาวน์โหลดไบนารี pi-web เวอร์ชันล่าสุด ติดตั้งไปที่ `/usr/local/bin` (`~/.pi/agent/bin` บน Windows) และตั้งค่าการเริ่มอัตโนมัติเมื่อเข้าสู่ระบบ ไม่ต้องใช้ Go, Node หรือ pi

### ดาวน์โหลดไบนารี

ไบนารีที่ build ไว้ล่วงหน้าแนบอยู่กับแต่ละ [GitHub Release](https://github.com/ygncode/pi-web/releases)

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

จากนั้นย้ายไปยัง PATH ของคุณ:

```bash
cp pi-web ~/.pi/agent/bin/
# or system-wide:
sudo cp pi-web /usr/local/bin/
```

### Build จากซอร์ส

```bash
git clone https://github.com/ygncode/pi-web.git
cd pi-web
make build   # builds the Vite bundle, then embeds it into the Go binary

# optional: put it on PATH
cp pi-web ~/.pi/agent/bin/
```

แพ็กเกจ frontend ถูกฝังโดย `web/assets_embed.go` ดังนั้น `go build` ต้องมี `web/dist` อยู่ก่อน `make build` จะทำทั้งสองขั้นตอนตามลำดับ หากคุณ build ด้วยตนเอง ให้รัน `npm --prefix web install && npm --prefix web run build` ก่อน `go build ./cmd/pi-web`

### พัฒนาควบคู่กับอินสแตนซ์ที่ติดตั้งไว้

ปล่อยให้อินสแตนซ์ที่ติดตั้งไว้ทำงานบนพอร์ต `31415` จากนั้นเริ่มซอร์สที่เช็คเอาต์ไว้ในโหมดพัฒนา:

```bash
make dev
```

เปิด `http://127.0.0.1:31416` `make dev` ตั้งค่าสภาพแวดล้อมพัฒนาภายใน `PI_WEB_DEV=1` เพื่อให้ซอร์สที่เช็คเอาต์ไว้แชร์เซสชัน การตั้งค่า และข้อมูล SQLite ร่วมกับอินสแตนซ์ที่ติดตั้งไว้ ขณะที่ยังคงมี lock รันไทม์และไฟล์สถานะสำหรับการพัฒนาแยกต่างหาก อินสแตนซ์ที่ติดตั้งไว้ตามปกติและที่เปิดด้วยตนเองจะไม่เปลี่ยนแปลง และคงพฤติกรรม single-instance เดิมไว้

เพื่อป้องกันงานอัตโนมัติซ้ำซ้อน โหมดพัฒนาจะไม่รันลูปกำหนดการ, ตัวระบายคิวแชท, การตั้งชื่ออัตโนมัติ หรือการแจ้งเตือนแบบ push คำขอโดยตรงที่ส่งผ่าน UI ของโหมดพัฒนายังทำงานได้ตามปกติ อย่าขับเคลื่อนเซสชันแชทเดียวกันจากทั้งสองอินสแตนซ์พร้อมกัน แต่ละโปรเซสมีตัวจัดการ worker แบบ RPC ของตัวเอง

`make dev` ต้องใช้ [Air](https://github.com/air-verse/air) สำหรับ hot reload ของ Go:

```bash
go install github.com/air-verse/air@latest
```

`PI_WEB_DEV` เป็นโครงสร้างภายในของเครื่องมือพัฒนา ไม่ใช่โหมด multi-instance สำหรับ production ที่รองรับ

## การถอนการติดตั้ง

```bash
pi remove npm:@ygncode/pi-web@beta
```

คำสั่งนี้จะรันสคริปต์ `preuninstall` ของแพ็กเกจ (`uninstall.sh` หรือ `uninstall.ps1` บน Windows) ซึ่งจะหยุดอินสแตนซ์ที่ทำงานอยู่และลบ:

- ไบนารี pi-web (`~/.pi/agent/bin/pi-web` หรือ `/usr/local/bin/pi-web` สำหรับการติดตั้งแบบ standalone)
- ไฟล์เวอร์ชัน (`~/.pi/agent/pi-web-version`)
- ไฟล์สถานะรันไทม์ (`~/.pi/agent/pi-web/pi-web-state.json`)
- การตั้งค่าการเริ่มอัตโนมัติ (launchd plist บน macOS, บริการ systemd ของผู้ใช้บน Linux, รายการ Run-key + สคริปต์ตัวเรียกใช้บน Windows)

ข้อมูลของคุณจะถูกเก็บไว้ เพื่อให้การติดตั้งใหม่ในภายหลังเริ่มจากจุดเดิม: `~/.pi/agent/pi-web.sqlite`, `~/.pi/agent/pi-web-memory.sqlite`, ไฟล์เซสชันของคุณภายใต้ `~/.pi/agent/sessions/` และ `~/.config/pi-web/env` (รวมถึง `PI_WEB_TOKEN`) ลบสิ่งเหล่านี้ด้วยตนเองหากต้องการเริ่มต้นใหม่ทั้งหมด

## การใช้งาน

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

โดยค่าเริ่มต้น pi-web จะ bind กับ `127.0.0.1` หาก Tailscale ทำงานอยู่ด้วย MagicDNS **และตั้งค่า `PI_WEB_TOKEN` แล้ว** pi-web จะรัน `tailscale serve --bg --https=<port> http://127.0.0.1:<port>` และแสดง URL tailnet แบบ HTTPS ด้วย หากไม่มีโทเค็น pi-web จะคงอยู่เฉพาะ loopback และข้าม Tailscale Serve เพื่อให้เครื่องใน tailnet ไม่สามารถเข้าถึง agent โดยไม่ผ่านการยืนยันตัวตนได้ การ bind แบบ non-loopback อย่างชัดแจ้งก็ต้องตั้งค่า `PI_WEB_TOKEN` เช่นกัน ส่ง `--insecure` เพื่อข้ามข้อกำหนดนี้สำหรับการทดสอบในเครื่อง

## การเข้าถึงระยะไกล

ปล่อยให้ pi-web รับฟังในเครื่องไว้ แล้วใช้ URL Tailscale HTTPS ที่แสดงไว้จากโทรศัพท์หรือแล็ปท็อปของคุณบน tailnet

บน macOS ให้ติดตั้งและเปิด Tailscale แบบโต้ตอบ อนุมัติข้อความแจ้งผู้ดูแลระบบ แล้วลงชื่อเข้าใช้ จากนั้นรัน `/pi-web restart` แล้วตามด้วย `/remote`

บน Linux อนุญาตให้ผู้ใช้ของคุณจัดการ Tailscale ก่อนติดตั้ง/รัน pi-web มิฉะนั้น `tailscale serve` อาจต้องใช้ sudo และการเริ่มอัตโนมัติอาจล้มเหลว:

```bash
sudo tailscale set --operator=$USER
```

```bash
# 1. Start pi-web with a token so it publishes the Tailscale HTTPS endpoint
PI_WEB_TOKEN=$(openssl rand -hex 16) pi-web

# 2. From any other Tailscale-connected device, open the printed
#    "Tailscale HTTPS" URL and enter the token once.
```

> โดยค่าเริ่มต้น pi-web จะปฏิเสธการ bind กับที่อยู่ non-loopback เว้นแต่จะตั้งค่า `PI_WEB_TOKEN` — มิฉะนั้นใครก็ตามที่เข้าถึงที่อยู่ที่ bind ไว้ได้ก็อาจดูเซสชันและส่งคำสั่งไปยัง pi ได้ หากต้องการข้ามการป้องกันนี้สำหรับการทดสอบในเครือข่ายท้องถิ่น ให้ส่ง `--insecure` **อย่าใช้ `--insecure` บน Tailscale หรือที่อยู่ใดก็ตามที่เข้าถึงได้จากภายนอกเครื่องของคุณ**
>
> ไคลเอนต์สามารถส่งโทเค็นผ่านส่วนหัว `Authorization: Bearer <token>`, ส่วนหัว `X-Pi-Token` หรือส่งครั้งเดียวผ่าน `?token=<token>` (หรือข้อความแจ้งให้เข้าสู่ระบบ) เมื่อโทเค็นถูกส่งผ่าน query string pi-web จะตั้งคุกกี้ `pi_token` และ redirect ไปยัง URL เดิมโดยตัดโทเค็นออก เพื่อไม่ให้ค้างอยู่ในแถบที่อยู่หรือประวัติเบราว์เซอร์ แนะนำให้ใช้รูปแบบส่วนหัวสำหรับสคริปต์และระบบอัตโนมัติ

## การแชทในเบราว์เซอร์

เปิดหน้าเซสชันและใช้ช่องเขียนข้อความด้านล่างเพื่อดำเนินเซสชันนั้นต่อ

- `Enter` ใช้ส่ง `Shift+Enter` ใช้ขึ้นบรรทัดใหม่
- ลากวางหรือวางรูปภาพลงในช่องเขียนข้อความได้โดยตรง
- ตัวเลือกโมเดลและตัวเลือกระดับการคิดอยู่ที่ส่วนหัว — การเปลี่ยนแปลงจะมีผลกับ worker ของ pi ทันที
- เซสชันที่ทำงานอยู่แต่ละเซสชันมี worker `pi --mode rpc` เฉพาะของตัวเอง ดังนั้นเซสชันต่าง ๆ จึงไม่บล็อกกัน

## การแชร์เซสชัน

คลิก **Share** บนหน้าเซสชันเพื่อสร้าง GitHub Gist แบบลับ

ข้อกำหนด:

- ติดตั้ง `gh` แล้ว
- ทำ `gh auth login` เสร็จแล้ว

การแชร์จะคืนค่า:

- URL ของ gist แบบลับ
- URL ตัวอย่างที่ `https://pi.dev/session/#<gistId>`

gist ที่แชร์เป็นสแนปช็อตและไม่มีการอัปเดตแบบสด

## การเริ่มอัตโนมัติเมื่อเข้าสู่ระบบ

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

> เพื่อให้บริการเริ่มทำงานตอนบูตเครื่อง (ก่อนเข้าสู่ระบบ) ให้ใช้บริการระดับ system แทน: คัดลอก `init/pi-web.service` ไปที่ `/etc/systemd/system/` แล้วใช้ `sudo systemctl`

### Windows

ตัวติดตั้งจะกำหนดค่านี้ให้อัตโนมัติโดยไม่ต้องใช้สิทธิ์ admin: รายการ `pi-web` ภายใต้ `HKCU\Software\Microsoft\Windows\CurrentVersion\Run` จะเรียกใช้ `~/.config/pi-web/pi-web-start.vbs` เมื่อเข้าสู่ระบบ ซึ่งจะเริ่มไบนารีแบบซ่อนไว้ (ไม่มีหน้าต่าง console) หลังจากโหลด `~/.config/pi-web/env` (`PI_WEB_TOKEN`, `PATH`, ...)

การจัดการด้วยตนเอง:

```powershell
# Start / stop
wscript.exe "$HOME\.config\pi-web\pi-web-start.vbs"
taskkill /IM pi-web.exe /F

# Remove auto-start
Remove-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run' -Name 'pi-web'
```

บน Windows ไม่มีการดูแลบริการ: หาก pi-web ขัดข้อง มันจะหยุดอยู่จนกว่าจะเข้าสู่ระบบครั้งถัดไป (launchd/systemd จะรีสตาร์ทให้อัตโนมัติบนแพลตฟอร์มอื่น)
