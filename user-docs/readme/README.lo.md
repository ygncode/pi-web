<h1 align="center">pi-web (Remote Control Your Pi)</h1>

<div align="center">

[![GitHub stars](https://img.shields.io/github/stars/ygncode/pi-web?style=flat&logo=github&label=stars&cacheSeconds=86400)](https://github.com/ygncode/pi-web/stargazers)
[![npm downloads](https://img.shields.io/npm/dt/@ygncode/pi-web?label=downloads&color=2ea043)](https://www.npmjs.com/package/@ygncode/pi-web)
[![license MIT](https://img.shields.io/npm/l/@ygncode/pi-web?label=license&color=0a7bbb)](../../LICENSE)
[![Telegram](https://img.shields.io/badge/Telegram-Join-26A5E4?logo=telegram&logoColor=white)](https://t.me/+NJvFOTTa0wNjNTc9)
![platform](https://img.shields.io/badge/platform-macOS%20%7C%20Linux-555)

[English](../../README.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [中文](README.zh.md) · [日本語](README.ja.md) · [Bahasa Indonesia](README.id.md) · [Bahasa Melayu](README.ms.md) · [Tiếng Việt](README.vi.md) · [ไทย](README.th.md) · [Filipino](README.fil.md) · [မြန်မာ](README.my.md) · [ភាសាខ្មែរ](README.km.md) · **ລາວ**

</div>

<div align="center">

ຂັບເຄື່ອນ [pi](https://pi.dev) ໂຕແທນຂຽນໂຄ້ດຂອງທ່ານຈາກໂທລະສັບ, ແທັບເລັດ, ຫຼື ແລັບທັອບ — ທຸກບ່ອນໃນເຄືອຂ່າຍຂອງທ່ານ, ຫຼື ທາງໄກຜ່ານ Tailscale.

ມັນເປັນ PWA ເຕັມຮູບແບບ, ດັ່ງນັ້ນທ່ານສາມາດຕິດຕັ້ງ ແລະ ໃຊ້ມັນຄືກັບແອັບພື້ນເມືອງໃນທຸກອຸປະກອນ. ຄິດວ່າມັນເປັນພື້ນທີ່ເຮັດວຽກ AI ສ່ວນຕົວຂອງທ່ານ — ຄ້າຍກັບ Cowork ຂອງ Claude, ແຕ່ມີຫຼາຍໂມເດວ — ສົນທະນາຂ້າມໂມເດວ, ຂຽນໂຄ້ດຈາກໂທລະສັບຂອງທ່ານ, ຫຼື ປ່ຽນມັນເປັນ [ຜູ້ຊ່ວຍສ່ວນຕົວ](user-docs/en/personal-assistant.md) ທີ່ອາໄສຢູ່ໃນເຄື່ອງຂອງທ່ານ.

ປັບແຕ່ງມັນໃຫ້ເປັນຂອງທ່ານ: ປ່ຽນຮູບແບບສີສັນ ແລະ ຟອນ, ແລະ ໃຊ້ມັນໃນພາສາຂອງທ່ານເອງ — pi-web ມາພ້ອມກັບຫຼາຍພາສາ ແລະ ທ່ານສາມາດເພີ່ມພາສາຂອງທ່ານໄດ້. ຄຸນສົມບັດເພີ່ມເຕີມກຳລັງຈະມາ, ແຕ່ມັນຈະບໍ່ໃຫຍ່ເກີນໄປ: ສິ່ງໃດກໍຕາມທີ່ທ່ານບໍ່ຕ້ອງການສາມາດປິດໄດ້ໃນການຕັ້ງຄ່າ.

</div>

> [!WARNING]
> pi-web ປັດຈຸບັນຢູ່ໃນສະຖານະ **beta**. ສິ່ງຕ່າງໆຈະມີການປ່ຽນແປງ ແລະ ອາດຈະເສຍ!

> [!TIP]
> ມາໃໝ່ບໍ? **[ອ່ານຄູ່ມືຜູ້ໃຊ້ →](user-docs/en/README.md)** ສຳລັບການທົວຄຸນສົມບັດເຕັມຮູບແບບ, ຂັ້ນຕອນການຕິດຕັ້ງ, ແລະ ເຄັດລັບ. ([ພາສາອື່ນໆ →](../README.md))

## ພາບໜ້າຈໍ

<div align="center">
  <img src="../assets/desktop-dark-mode.png" alt="Desktop — dark mode" width="90%" /><br />
  <em>ເດັສທັອບ — ໂໝດມືດ</em>
  <br /><br />
  <img src="../assets/desktop-white-mode.png" alt="Desktop — light mode" width="90%" /><br />
  <em>ເດັສທັອບ — ໂໝດສະຫວ່າງ</em>
  <br /><br />
  <img src="../assets/mobile-pwa.png" alt="Mobile PWA" width="90%" /><br />
  <em>PWA ມືຖື</em>
</div>

## ວິທີການເຮັດວຽກຮ່ວມກັນ

```
 pi (terminal)                 Browser (phone / tablet / laptop)
      │                                │
      │  writes JSONL                  │  HTTP + SSE
      ▼                                ▼
 ~/.pi/agent/sessions/  ←───  pi-web (Go HTTP server)
                                      │
                    ┌─────────────────┼─────────────────┐
                    │                 │                 │
              pi --mode rpc      fsnotify         tailscale serve
            (per‑session       (live reload)      (remote HTTPS
             chat worker)                           via MagicDNS)
```

- **pi** ຂຽນ JSONL ການສົນທະນາລົງໃນ `~/.pi/agent/sessions/` ໃນຂະນະທີ່ມັນເຮັດວຽກ.
- **pi-web** ແມ່ນເຊີບເວີ Go ທີ່ອ່ານໄຟລ໌ເຫຼົ່ານັ້ນ, ສະແດງຜົນໃນເບົາຣ໌ເຊີຣ໌, ແລະ ສະຕີມການອັບເດດສົດຜ່ານ SSE.
- **pi --mode rpc** ຕົວປະມວນຜົນຈັດການການສົນທະນາທີ່ເລີ່ມຈາກເບົາຣ໌ເຊີຣ໌ — ໜຶ່ງຕໍ່ໜຶ່ງເຊສຊັນ, ຖືກຍົກເລີກຫຼັງຈາກບໍ່ມີການເຄື່ອນໄຫວ 10 ນາທີ.
- **fsnotify** ເຝົ້າຕິດຕາມໄດເຣັກທໍຣີເຊສຊັນ ເພື່ອໃຫ້ເບົາຣ໌ເຊີຣ໌ໂຫຼດໃໝ່ພາຍໃນມິນລິວິນາທີຫຼັງຈາກມີຜົນລັບໃໝ່.
- **Tailscale Serve** ເຜີຍແຜ່ເຊີບເວີ localhost ເປັນຈຸດໝາຍປາຍທາງ HTTPS ເທິງ tailnet ຂອງທ່ານ.

## ການຕິດຕັ້ງ

```bash
pi install npm:@ygncode/pi-web@beta
```

ພຽງເທົ່ານີ້ — ມັນດາວໂຫຼດໄບນາຣີທີ່ກົງກັນ, ຕັ້ງຄ່າການເລີ່ມອັດຕະໂນມັດ, ແລະ ລົງທະບຽນຄຳສັ່ງ `/web`, `/pi-web`, `/remote`, ແລະ `/refresh`.

ເມື່ອຕິດຕັ້ງແລ້ວ, ເປີດ `http://127.0.0.1:31415` ໃນເບົາຣ໌ເຊີຣ໌ຂອງທ່ານ. ຈາກ pi, ໃຊ້ `/web` ເພື່ອເປີດເຊສຊັນປັດຈຸບັນໃນເບົາຣ໌ເຊີຣ໌ຂອງທ່ານທັນທີ. ຖ້າ Tailscale ກຳລັງເຮັດວຽກຢູ່ໃນເຄື່ອງຂອງທ່ານ, pi-web ຈະເຜີຍແຜ່ຈຸດໝາຍປາຍທາງ HTTPS ເທິງ tailnet ຂອງທ່ານໂດຍອັດຕະໂນມັດ — ໃຊ້ `/remote` ຈາກ pi ເພື່ອຮັບລະຫັດ QR ແລະ URL ສຳລັບອຸປະກອນໃດໆເທິງ tailnet ຂອງທ່ານ.

ສຳລັບການຕິດຕັ້ງແບບກຳນົດເອງ, ການດາວໂຫຼດໄບນາຣີ, ຫຼື ການສ້າງຈາກຊອສໂຄ້ດ, ເບິ່ງ [user-docs/install.md](user-docs/en/install.md).

## ການເຊື່ອມໂຍງກັບ Pi

ຫຼັງຈາກ `pi install npm:@ygncode/pi-web@beta`, ທ່ານຈະໄດ້ຮັບ:

| ຄຳສັ່ງ | ສິ່ງທີ່ມັນເຮັດ |
|---------|--------------|
| `/web` | ເປີດເຊສຊັນປັດຈຸບັນໃນເບົາຣ໌ເຊີຣ໌ຂອງທ່ານ (ຮັບຮູ້ SSH: ຂ້າມເບົາຣ໌ເຊີຣ໌ ແລະ ສະແດງພຽງ URL) |
| `/pi-web` | ສະແດງສະຖານະ, ເວີຊັນ, ເລີ່ມ/ຢຸດ/ເລີ່ມໃໝ່ເຊີບເວີ, ຫຼື ອັບເດດ |
| `/remote` | ສະແດງລະຫັດ QR ແລະ URL ສຳລັບການເຂົ້າເຖິງທາງໄກຜ່ານ Tailscale |
| `/refresh` | ດຶງຂໍ້ຄວາມໃໝ່ທີ່ຂຽນຈາກເບົາຣ໌ເຊີຣ໌ທາງໄກກັບເຂົ້າມາໃນເຊສຊັນເທີມິນອລ |

ການ **ຕັ້ງຊື່ອັດຕະໂນມັດ** ຂອງເຊສຊັນຖືກສ້າງຢູ່ໃນ pi-web ເອງ ແລະ ຕັ້ງຄ່າໄດ້ທີ່ໜ້າ `/settings`. ມັນ **ເປີດໃຊ້ຕາມຄ່າເລີ່ມຕົ້ນ** ແລະ ຕັ້ງຊື່ເຊສຊັນໂດຍອັດຕະໂນມັດ. ທ່ານສາມາດເລືອກ:

- **ເວລາໃດທີ່ຈະຕັ້ງຊື່** — ຄັ້ງດຽວຕໍ່ເຊສຊັນ, ຫຼື ທຸກຄັ້ງທີ່ມີຂໍ້ຄວາມໃໝ່ (ຄ່າເລີ່ມຕົ້ນ).
- **ໂມເດວຕັ້ງຊື່** — ໃຊ້ການວິເຄາະຄຳສັບທີ່ສ້າງມາໃນຕົວຟຣີ, ທັນທີ **(ບໍ່ໃຊ້ AI)** ຕາມຄ່າເລີ່ມຕົ້ນ, ຫຼື ເລືອກໂມເດວ (ເຊັ່ນ ໂຕນ້ອຍ/ໄວ) ສຳລັບຊື່ທີ່ຂຽນໂດຍໂມເດວທີ່ສະຫຼາດກວ່າ.

ແພັກເກດຍັງຕິດຕັ້ງໄບນາຣີ pi-web ໄປທີ່ `~/.pi/agent/bin/pi-web` ແລະ ຕັ້ງຄ່າການເລີ່ມອັດຕະໂນມັດເມື່ອເຂົ້າສູ່ລະບົບ.

## ການເລີ່ມອັດຕະໂນມັດເມື່ອເຂົ້າສູ່ລະບົບ

ຄຳສັ່ງ `pi install npm:@ygncode/pi-web@beta` ຕັ້ງຄ່າສິ່ງນີ້ໂດຍອັດຕະໂນມັດ:

| OS | ກົນໄກ |
|----|-----------|
| macOS | launchd plist ທີ່ `~/Library/LaunchAgents/com.pi-web.plist` |
| Linux | systemd user service ທີ່ `~/.config/systemd/user/pi-web.service` |

ເພື່ອຕັ້ງໂທເຄັນສຳລັບການເຂົ້າເຖິງທາງໄກ, ສ້າງ `~/.config/pi-web/env`:

```
PI_WEB_TOKEN=your-token-here
```

ສຳລັບລາຍລະອຽດເພີ່ມເຕີມ (ການຕັ້ງຄ່າແບບກຳນົດເອງ, ພອດທີ່ກຳນົດເອງ, ການຜູກທີ່ບໍ່ແມ່ນ loopback), ເບິ່ງ [user-docs/install.md](user-docs/en/install.md).

## ການພັດທະນາ

```bash
make setup   # ຕິດຕັ້ງ dependencies ຝັ່ງໜ້າບ້ານ ແລະ ດາວໂຫຼດ Go modules
make check   # ທົດສອບ/ສ້າງຝັ່ງໜ້າບ້ານ + Go test/vet
make build   # ຕັ້ງຄ່າຖ້າຈຳເປັນ, ສ້າງຝັ່ງໜ້າບ້ານ, ແລ້ວສ້າງ ./pi-web
```
