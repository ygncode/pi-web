<h1 align="center">pi-web (Remote Control Your Pi)</h1>

<div align="center">

[![GitHub stars](https://img.shields.io/github/stars/ygncode/pi-web?style=flat&logo=github&label=stars&cacheSeconds=86400)](https://github.com/ygncode/pi-web/stargazers)
[![npm downloads](https://img.shields.io/npm/dw/@ygncode/pi-web?label=downloads/wk&color=2ea043&cacheSeconds=86400)](https://www.npmjs.com/package/@ygncode/pi-web)
[![license MIT](https://img.shields.io/npm/l/@ygncode/pi-web?label=license&color=0a7bbb&cacheSeconds=86400)](../../LICENSE)
[![Telegram](https://img.shields.io/badge/Telegram-Join-26A5E4?logo=telegram&logoColor=white)](https://t.me/+NJvFOTTa0wNjNTc9)
![platform](https://img.shields.io/badge/platform-macOS%20%7C%20Linux-555)

[English](../../README.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [中文](README.zh.md) · [日本語](README.ja.md) · [Bahasa Indonesia](README.id.md) · [Bahasa Melayu](README.ms.md) · [Tiếng Việt](README.vi.md) · **ไทย** · [Filipino](README.fil.md) · [မြန်မာ](README.my.md) · [ភាសាខ្មែរ](README.km.md) · [ລາວ](README.lo.md)

</div>

<div align="center">

ขับเคลื่อน [pi](https://pi.dev) coding agent ของคุณจากโทรศัพท์, แท็บเล็ต, หรือแล็ปท็อป — ทุกที่บนเครือข่ายของคุณ, หรือจากระยะไกลผ่าน Tailscale

มันเป็น PWA เต็มรูปแบบ ดังนั้นคุณสามารถติดตั้งและใช้งานได้เหมือนแอป native บนทุกอุปกรณ์ คิดว่ามันเป็นพื้นที่ทำงาน AI ส่วนตัวของคุณ — เหมือนกับ Claude's Cowork, แต่มีโมเดลที่หลากหลาย — แชทข้ามโมเดล, เขียนโค้ดจากโทรศัพท์ของคุณ, หรือเปลี่ยนมันให้เป็น [ผู้ช่วยส่วนตัว](user-docs/en/personal-assistant.md) ที่อาศัยอยู่บนเครื่องของคุณ

ทำให้เป็นของคุณ: สลับธีมและฟอนต์, และใช้งานในภาษาของคุณเอง — pi-web มาพร้อมกับหลายภาษาและคุณสามารถเพิ่มภาษาของคุณเองได้ ฟีเจอร์เพิ่มเติมกำลังจะมา, แต่มันจะไม่บวม: อะไรก็ตามที่คุณไม่ต้องการสามารถปิดได้ในการตั้งค่า

</div>

> [!WARNING]
> pi-web อยู่ในช่วง **beta** สิ่งต่างๆ จะเปลี่ยนแปลงและพังได้!

> [!TIP]
> เพิ่งมาใหม่? **[อ่านคู่มือผู้ใช้ →](user-docs/en/README.md)** สำหรับทัวร์ฟีเจอร์แบบเต็ม, ขั้นตอนการติดตั้ง, และเคล็ดลับ ([ภาษาอื่นๆ →](../README.md))

## ภาพหน้าจอ

<div align="center">
  <img src="../assets/pi-web-desktop-screenshot.png" alt="Desktop" width="90%" /><br />
  <em>เดสก์ท็อป</em>
  <br /><br />
  <img src="../assets/pi-web-mobile-screenshot.png" alt="Mobile PWA" width="90%" /><br />
  <em>มือถือ PWA</em>
</div>

## มันประกอบกันอย่างไร

```
 pi (terminal)                 Browser (โทรศัพท์ / แท็บเล็ต / แล็ปท็อป)
      │                                │
      │  เขียน JSONL                  │  HTTP + SSE
      ▼                                ▼
 ~/.pi/agent/sessions/  ←───  pi-web (Go HTTP server)
                                      │
                    ┌─────────────────┼─────────────────┐
                    │                 │                 │
              pi --mode rpc      fsnotify         tailscale serve
            (ต่อเซสชัน        (โหลดซ้ำสด)      (HTTPS ระยะไกล
             chat worker)                           ผ่าน MagicDNS)
```

- **pi** เขียนบทสนทนา JSONL ไปที่ `~/.pi/agent/sessions/` ขณะที่มันทำงาน
- **pi-web** คือเซิร์ฟเวอร์ Go ที่อ่านไฟล์เหล่านั้น, แสดงผลในเบราว์เซอร์, และสตรีมการอัปเดตสดผ่าน SSE
- **pi --mode rpc** workers จัดการแชทที่เริ่มจากเบราว์เซอร์ — หนึ่งตัวต่อเซสชัน, ปิดเมื่อว่างเกิน 10 นาที
- **fsnotify** เฝ้าดูไดเรกทอรีเซสชันเพื่อให้เบราว์เซอร์โหลดซ้ำภายในมิลลิวินาทีเมื่อมีผลลัพธ์ใหม่
- **Tailscale Serve** เผยแพร่เซิร์ฟเวอร์ localhost เป็นปลายทาง HTTPS บน tailnet ของคุณ

## ติดตั้ง

```bash
pi install npm:@ygncode/pi-web@beta
```

แค่นั้นแหละ — มันดาวน์โหลดไบนารีที่ตรงกัน, ตั้งค่าเริ่มอัตโนมัติ, และลงทะเบียนคำสั่ง `/web`, `/pi-web`, `/remote`, และ `/refresh`

เมื่อติดตั้งแล้ว, เปิด `http://127.0.0.1:31415` ในเบราว์เซอร์ของคุณ จาก pi, ใช้ `/web` เพื่อเปิดเซสชันปัจจุบันในเบราว์เซอร์ของคุณทันที ถ้า Tailscale กำลังทำงานบนเครื่องของคุณ, pi-web จะเผยแพร่ปลายทาง HTTPS บน tailnet ของคุณโดยอัตโนมัติ — ใช้ `/remote` จาก pi เพื่อรับ QR code และ URL สำหรับทุกอุปกรณ์บน tailnet ของคุณ

> **การเข้าถึงจากระยะไกลบน macOS:** ติดตั้งและเปิด Tailscale แบบโต้ตอบ อนุมัติข้อความแจ้งสิทธิ์ผู้ดูแลระบบ และลงชื่อเข้าใช้ จากนั้นเรียกใช้ `/pi-web restart` ตามด้วย `/remote`

สำหรับการติดตั้งด้วยตนเอง, ดาวน์โหลดไบนารี, หรือสร้างจากซอร์ส, ดู [user-docs/install.md](user-docs/en/install.md)

## การผสานกับ Pi

หลังจาก `pi install npm:@ygncode/pi-web@beta`, คุณจะได้รับ:

| คำสั่ง | มันทำอะไร |
|---------|--------------|
| `/web` | เปิดเซสชันปัจจุบันในเบราว์เซอร์ของคุณ (รับรู้ SSH: ข้ามเบราว์เซอร์และแสดงเฉพาะ URL) |
| `/pi-web` | แสดงสถานะ, เวอร์ชัน, เริ่ม/หยุด/รีสตาร์ทเซิร์ฟเวอร์, หรืออัปเดต |
| `/remote` | แสดง QR code และ URL สำหรับการเข้าถึงระยะไกลผ่าน Tailscale |
| `/refresh` | ดึงข้อความใหม่ที่เขียนจากเบราว์เซอร์ระยะไกลกลับเข้ามาในเซสชัน terminal |

**การตั้งชื่ออัตโนมัติ** ของเซสชันถูกสร้างไว้ใน pi-web เองและกำหนดค่าบนหน้า `/settings` มัน**เปิดโดยค่าเริ่มต้น** และตั้งชื่อเซสชันโดยอัตโนมัติ คุณสามารถเลือก:

- **เมื่อใดที่จะตั้งชื่อ** — หนึ่งครั้งต่อเซสชัน, หรือทุกข้อความใหม่ (ค่าเริ่มต้น)
- **โมเดลการตั้งชื่อ** — ** heuristic คำในตัวที่ฟรีและรวดเร็ว (ไม่มี AI)** โดยค่าเริ่มต้น, หรือเลือกโมเดล (เช่น ตัวเล็ก/เร็ว) สำหรับชื่อที่เขียนโดยโมเดลที่ฉลาดกว่า

แพ็คเกจยังติดตั้งไบนารี pi-web ไปที่ `~/.pi/agent/bin/pi-web` และตั้งค่าเริ่มอัตโนมัติเมื่อเข้าสู่ระบบ

## เริ่มอัตโนมัติเมื่อเข้าสู่ระบบ

คำสั่ง `pi install npm:@ygncode/pi-web@beta` ตั้งค่านี้โดยอัตโนมัติ:

| OS | กลไก |
|----|-----------|
| macOS | launchd plist ที่ `~/Library/LaunchAgents/com.pi-web.plist` |
| Linux | systemd user service ที่ `~/.config/systemd/user/pi-web.service` |

เพื่อตั้งค่า token สำหรับการเข้าถึงระยะไกล, สร้าง `~/.config/pi-web/env`:

```
PI_WEB_TOKEN=your-token-here
```

สำหรับรายละเอียดเพิ่มเติม (การตั้งค่าด้วยตนเอง, พอร์ตที่กำหนดเอง, การ bind แบบ non-loopback), ดู [user-docs/install.md](user-docs/en/install.md)

## การพัฒนา

```bash
make setup   # ติดตั้ง frontend dependencies และดาวน์โหลดโมดูล Go
make check   # frontend test/build + Go test/vet
make build   # setup ถ้าจำเป็น, build frontend, แล้ว build ./pi-web
```
