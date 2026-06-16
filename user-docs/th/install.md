# การติดตั้งและการใช้งาน

## ฟีเจอร์

### การควบคุมระยะไกล

- ดำเนินเซสชันต่อจากเบราว์เซอร์ด้วยข้อความหรือไฟล์แนบรูปภาพ
- เริ่มต้นเซสชันใหม่บนพาธโปรเจกต์ใดๆ ได้โดยตรงจาก UI บนเว็บ
- สลับโมเดลและเลือกระดับการคิดในเบราว์เซอร์ ต่อเซสชัน
- สถานะ worker ต่อเซสชัน (idle / running / error) พร้อมกู้คืนอัตโนมัติเมื่อเกิดการขัดข้อง
- หลายเซสชันทำงานพร้อมกัน — เริ่มงานในเซสชันหนึ่ง ดูสตรีมอีกเซสชันหนึ่ง
- `PI_WEB_TOKEN` สำหรับการเปิดเผยใน LAN อย่างปลอดภัย — จำเป็นตามค่าเริ่มต้นสำหรับการ bind ที่ไม่ใช่ loopback อย่างชัดแจ้ง

### การอ่านเซสชัน

- เรียกดูเซสชันข้ามโปรเจกต์ด้วยตัวกรอง การค้นหา และการนำทาง branch แบบเต็ม
- อัปเดตแบบเพิ่มหน่วยแบบสดในขณะที่ pi กำลังทำงาน (ผ่าน fsnotify; ความหน่วง ~ms)
- โหมดติดตามสำหรับการ tail เซสชันที่กำลังทำงานอยู่
- ลิงก์ลึกไปยังข้อความแต่ละข้อความ
- ดาวน์โหลดเซสชันเป็น JSONL
- แชร์สแนปชอตแบบคงที่เป็น secret GitHub Gists
- ส่วนขยาย pi `/web`, `/remote`, `/refresh`, `/pi-web token` และ `/pi-web set-token` สำหรับการเปิดเซสชัน, QR ระยะไกล, การซิงค์เซสชัน และการจัดการโทเค็น

## ข้อกำหนด

- [Go](https://go.dev) 1.25+
- `pi` อยู่ใน `PATH` ของคุณสำหรับการแชทในเบราว์เซอร์/การสลับโมเดล
- ตัวเลือก: `gh` สำหรับการแชร์

## การติดตั้ง

### แพ็กเกจ Pi (แนะนำ)

```bash
pi install npm:@ygncode/pi-web@beta
```

คำสั่งเดียวนี้:
- ติดตั้งแพ็กเกจ npm pi ภายใต้ไดเรกทอรีแพ็กเกจของ pi
- รันสคริปต์ `postinstall` ของแพ็กเกจ (`bash install.sh`)
- ดาวน์โหลดไบนารี pi-web ที่ตรงกับเวอร์ชันแพ็กเกจและแพลตฟอร์มของคุณจาก GitHub Releases
- ติดตั้งไปที่ `~/.pi/agent/bin/pi-web`
- ตั้งค่าการเริ่มต้นอัตโนมัติเมื่อเข้าสู่ระบบ (launchd บน macOS, systemd บน Linux)
- ลงทะเบียนคำสั่ง pi `/web`, `/remote`, `/refresh`, `/pi-web token` และ `/pi-web set-token`

การตั้งชื่อเซสชันอัตโนมัติมีอยู่ใน pi-web (ไม่ใช่ส่วนขยาย) และกำหนดค่าบนหน้า `/settings` เปิดใช้งานตามค่าเริ่มต้น: pi-web ตั้งชื่อเซสชันโดยอัตโนมัติโดยใช้ฮิวริสติกคำในตัวฟรี (ไม่มี AI) เปลี่ยนชื่อทุกครั้งที่มีข้อความใหม่ คุณสามารถเปลี่ยนเป็นการตั้งชื่อครั้งเดียวต่อเซสชัน และ/หรือเลือกโมเดลเพื่อเขียนชื่อที่ฉลาดกว่าแทนฮิวริสติก

บน Linux การเริ่มต้นอัตโนมัติถูกกำหนดค่าเป็นบริการ systemd ผู้ใช้ที่ `~/.config/systemd/user/pi-web.service` ตัวติดตั้งจะเขียน `ExecStart` ใหม่ให้เป็นพาธไบนารีที่ติดตั้งจริง หาก Tailscale พร้อมใช้งานขณะรันไทม์ pi-web จะเผยแพร่เซิร์ฟเวอร์ localhost ด้วย Tailscale Serve HTTPS หาก systemd ผู้ใช้ไม่พร้อมใช้งาน ให้รันด้วยตนเองด้วย `~/.pi/agent/bin/pi-web -o`

เพื่อติดตั้งเฉพาะสำหรับโปรเจกต์ใดโปรเจกต์หนึ่ง (แชร์กับทีมของคุณผ่าน `.pi/settings.json`):

```bash
pi install -l npm:@ygncode/pi-web@beta
```

จากนั้นเริ่ม pi ใหม่ (หรือรัน `/reload`) และใช้ `/web`, `/pi-web`, `/remote`, `/refresh` จัดการโทเค็นการเข้าถึงของคุณด้วย `/pi-web token` และ `/pi-web set-token`

หาก npm ยกเลิกด้วย `ENOTEMPTY` ขณะเปลี่ยนชื่อ `@ygncode/pi-web` ให้ลบไดเรกทอรีสำรองที่ซ่อนอยู่ที่ค้างของ npm และติดตั้งช่อง beta ใหม่:

```bash
rm -rf ~/.pi/agent/npm/node_modules/@ygncode/.pi-web-*
pi install npm:@ygncode/pi-web@beta
```

### ติดตั้งด่วน (ไม่ต้องใช้เครื่องมือ build)

```bash
curl -fsSL https://raw.githubusercontent.com/ygncode/pi-web/main/install.sh | bash
```

สิ่งนี้ดาวน์โหลดไบนารี pi-web ล่าสุด ติดตั้งไปที่ `/usr/local/bin` และตั้งค่าการเริ่มต้นอัตโนมัติเมื่อเข้าสู่ระบบ ไม่ต้องใช้ Go, Node หรือ pi

### ดาวน์โหลดไบนารี

ไบนารีที่ build แล้วแนบอยู่ในแต่ละ [GitHub Release](https://github.com/ygncode/pi-web/releases)

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

จากนั้นย้ายไปยัง PATH ของคุณ:

```bash
cp pi-web ~/.pi/agent/bin/
# หรือทั้งระบบ:
sudo cp pi-web /usr/local/bin/
```

### Build จากซอร์ส

```bash
git clone https://github.com/ygncode/pi-web.git
cd pi-web
make build   # build Vite bundle แล้วฝังลงใน Go binary

# ตัวเลือก: วางไว้ใน PATH
cp pi-web ~/.pi/agent/bin/
```

frontend bundle ถูกฝังโดย `web/assets_embed.go` ดังนั้น `go build` จำเป็นต้องมี
`web/dist` อยู่ก่อน `make build` ทำทั้งสองขั้นตอนตามลำดับ หากคุณ build
ด้วยตนเอง ให้รัน `npm --prefix web install && npm --prefix web run build` ก่อน
`go build ./cmd/pi-web`

## การถอนการติดตั้ง

```bash
pi remove npm:@ygncode/pi-web@beta
```

สิ่งนี้รันสคริปต์ `preuninstall` ของแพ็กเกจ (`bash uninstall.sh`) ซึ่งหยุด
อินสแตนซ์ที่กำลังทำงานและลบ:

- ไบนารี pi-web (`~/.pi/agent/bin/pi-web` หรือ `/usr/local/bin/pi-web` สำหรับการติดตั้งแบบสแตนด์อโลน)
- ไฟล์เวอร์ชัน (`~/.pi/agent/pi-web-version`)
- ไฟล์สถานะรันไทม์ (`~/.pi/agent/pi-web/pi-web-state.json`)
- การกำหนดค่าการเริ่มต้นอัตโนมัติ (launchd plist บน macOS, บริการ systemd ผู้ใช้บน Linux)

ข้อมูลของคุณถูกเก็บไว้เพื่อให้การติดตั้งใหม่ในภายหลังดำเนินต่อจากจุดที่คุณค้างไว้:
`~/.pi/agent/pi-web.sqlite`, `~/.pi/agent/pi-web-memory.sqlite`, ไฟล์เซสชัน
ของคุณภายใต้ `~/.pi/agent/sessions/` และ `~/.config/pi-web/env` (รวมถึง
`PI_WEB_TOKEN`) ลบสิ่งเหล่านั้นด้วยตนเองหากคุณต้องการเริ่มต้นใหม่ทั้งหมด

## การใช้งาน

```bash
# เริ่มต้นบนพอร์ตเริ่มต้น (31415)
pi-web

# เริ่มต้นและเปิดเบราว์เซอร์
pi-web -o

# พอร์ตกำหนดเอง
pi-web -p 8080

# แทนที่โฮสต์ bind (loopback ไม่ต้องรับรองตัวตนตามค่าเริ่มต้น)
pi-web --host 127.0.0.1

# การ bind ที่ไม่ใช่ loopback ต้องใช้โทเค็น — pi-web ปฏิเสธที่จะเริ่มต้นหากไม่มี
PI_WEB_TOKEN=$(openssl rand -hex 16) pi-web --host 192.168.1.50
```

ตามค่าเริ่มต้น pi-web bind ไปที่ `127.0.0.1` หาก Tailscale กำลังทำงานด้วย MagicDNS pi-web จะรัน `tailscale serve --bg --https=<port> http://127.0.0.1:<port>` และพิมพ์ URL tailnet HTTPS การ bind ที่ไม่ใช่ loopback อย่างชัดแจ้งใดๆ ต้องการให้ตั้งค่า `PI_WEB_TOKEN` ส่ง `--insecure` เพื่อแทนที่สำหรับการทดสอบในเครื่อง

## การเข้าถึงระยะไกล

ปล่อยให้ pi-web รับฟังในเครื่อง จากนั้นใช้ URL Tailscale HTTPS ที่พิมพ์จากโทรศัพท์หรือแล็ปท็อปของคุณบน tailnet

บน Linux อนุญาตให้ผู้ใช้ของคุณจัดการ Tailscale ก่อนติดตั้ง/รัน pi-web มิฉะนั้น `tailscale serve` อาจต้องใช้ sudo และการเริ่มต้นอัตโนมัติอาจล้มเหลว:

```bash
sudo tailscale set --operator=$USER
```

```bash
# 1. เริ่มต้น pi-web
pi-web

# 2. จากอุปกรณ์อื่นที่เชื่อมต่อ Tailscale เปิด URL
#    "Tailscale HTTPS" ที่พิมพ์ออกมา
```

> ตามค่าเริ่มต้น pi-web ปฏิเสธที่จะ bind ไปยังที่อยู่ที่ไม่ใช่ loopback เว้นแต่จะตั้งค่า `PI_WEB_TOKEN` — ใครก็ตามที่สามารถเข้าถึงที่อยู่ที่ bind ไว้สามารถดูเซสชันและส่งคำสั่งไปยัง pi ได้ หากต้องการแทนที่การป้องกันนี้สำหรับการทดสอบเครือข่ายท้องถิ่น ให้ส่ง `--insecure` **อย่าใช้ `--insecure` บน Tailscale หรือที่อยู่ใดๆ ที่เข้าถึงได้จากภายนอกเครื่องของคุณ**
>
> ไคลเอนต์สามารถส่งโทเค็นผ่านส่วนหัว `Authorization: Bearer <token>`, ส่วนหัว `X-Pi-Token` หรือครั้งเดียวผ่าน `?token=<token>` (ซึ่งตั้งค่า cookie `pi_token` สำหรับคำขอถัดไป) โทเค็นที่ส่งผ่าน `?token=` จะปรากฏในประวัติเบราว์เซอร์ บันทึกการเข้าถึงของเซิร์ฟเวอร์ และส่วนหัว `Referer` จากลิงก์ใดๆ บนหน้า — ควรใช้รูปแบบส่วนหัวสำหรับสิ่งอื่นนอกเหนือจากบุ๊กมาร์กเริ่มต้น

## การแชทในเบราว์เซอร์

เปิดหน้าเซสชันและใช้คอมโพเซอร์ที่ด้านล่างเพื่อดำเนินเซสชันนั้นต่อ

- `Enter` ส่ง, `Shift+Enter` แทรกบรรทัดใหม่
- ลากและวางหรือวางรูปภาพโดยตรงลงในคอมโพเซอร์
- ตัวเลือกโมเดลและตัวเลือกระดับการคิดอยู่ที่ส่วนหัว — การเปลี่ยนแปลงจะมีผลกับ worker pi พื้นฐานทันที
- แต่ละเซสชันที่ทำงานอยู่ได้รับ worker `pi --mode rpc` เฉพาะของตัวเอง ดังนั้นเซสชันต่างๆ จึงไม่บล็อกกัน

## การแชร์เซสชัน

คลิก **Share** บนหน้าเซสชันเพื่อสร้าง secret GitHub Gist

ข้อกำหนด:
- ติดตั้ง `gh` แล้ว
- ทำ `gh auth login` เสร็จสิ้นแล้ว

การแชร์ส่งคืน:
- URL gist ลับ
- URL ตัวอย่างที่ `https://pi.dev/session/#<gistId>`

gist ที่แชร์เป็นสแนปชอตและไม่มีการอัปเดตแบบสด

## การเริ่มต้นอัตโนมัติเมื่อเข้าสู่ระบบ

### macOS

```bash
cp init/com.pi-web.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.pi-web.plist
```

### Linux (systemd)

```bash
# ติดตั้งบริการ systemd ผู้ใช้
mkdir -p ~/.config/systemd/user
cp init/pi-web.service ~/.config/systemd/user/

# ตัวเลือก: ตั้งค่า PI_WEB_TOKEN ของคุณสำหรับการ bind ที่ไม่ใช่ loopback
# (หรือใช้ /pi-web set-token <token> จากภายใน pi)
mkdir -p ~/.config/pi-web
echo 'PI_WEB_TOKEN=your-token-here' > ~/.config/pi-web/env

# เปิดใช้งานและเริ่มต้น
systemctl --user daemon-reload
systemctl --user enable --now pi-web.service

# ตรวจสอบสถานะ
systemctl --user status pi-web.service

# ดูบันทึก
journalctl --user -u pi-web.service -f
```

> เพื่อให้บริการเริ่มต้นตอนบูต (ก่อนเข้าสู่ระบบ) ให้ใช้บริการ system แทน:
> คัดลอก `init/pi-web.service` ไปที่ `/etc/systemd/system/` และใช้ `sudo systemctl`
