<h1 align="center">pi-web (Remote Control Your Pi)</h1>

<div align="center">

[![GitHub stars](https://img.shields.io/github/stars/ygncode/pi-web?style=flat&logo=github&label=stars&cacheSeconds=86400)](https://github.com/ygncode/pi-web/stargazers)
[![npm downloads](https://img.shields.io/npm/dw/@ygncode/pi-web?label=downloads/wk&color=2ea043&cacheSeconds=86400)](https://www.npmjs.com/package/@ygncode/pi-web)
[![license MIT](https://img.shields.io/npm/l/@ygncode/pi-web?label=license&color=0a7bbb&cacheSeconds=86400)](../../LICENSE)
[![Telegram](https://img.shields.io/badge/Telegram-Join-26A5E4?logo=telegram&logoColor=white)](https://t.me/+NJvFOTTa0wNjNTc9)
![platform](https://img.shields.io/badge/platform-macOS%20%7C%20Linux-555)

[English](../../README.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [中文](README.zh.md) · [日本語](README.ja.md) · [Bahasa Indonesia](README.id.md) · **Bahasa Melayu** · [Tiếng Việt](README.vi.md) · [ไทย](README.th.md) · [Filipino](README.fil.md) · [မြန်မာ](README.my.md) · [ភាសាខ្មែរ](README.km.md) · [ລາວ](README.lo.md)

</div>

---
<div align="center">

Pandu ejen pengekodan [pi](https://pi.dev) anda dari telefon, tablet, atau komputer riba — di mana-mana sahaja dalam rangkaian anda, atau dari jauh melalui Tailscale.

Ia adalah PWA penuh, jadi anda boleh memasangnya dan menggunakannya seperti aplikasi asli pada mana-mana peranti. Anggaplah ia sebagai ruang kerja AI peribadi anda sendiri — seperti Cowork Claude, tetapi dengan pelbagai model — berbual merentas model, mengekod dari telefon anda, atau jadikannya sebagai [pembantu peribadi](user-docs/en/personal-assistant.md) yang hidup pada mesin anda.

Jadikannya milik anda: tukar tema dan fon, dan gunakannya dalam bahasa anda sendiri — pi-web disertakan dengan pelbagai bahasa dan anda boleh menambah bahasa anda sendiri. Lebih banyak ciri akan datang, tetapi ia tidak akan menjadi gemuk: apa-apa yang anda tidak perlukan boleh dimatikan dalam tetapan.

</div>

> [!WARNING]
> pi-web kini dalam **beta**. Perkara akan berubah dan rosak!

> [!TIP]
> Baru di sini? **[Baca panduan pengguna →](user-docs/en/README.md)** untuk lawatan penuh ciri, langkah pemasangan, dan petua. ([Bahasa lain →](../README.md))

## Tangkapan Skrin

<div align="center">
  <img src="../assets/pi-web-desktop-screenshot.png" alt="Desktop" width="90%" /><br />
  <em>Desktop</em>
  <br /><br />
  <img src="../assets/pi-web-mobile-screenshot.png" alt="Mobile PWA" width="90%" /><br />
  <em>Mobile PWA</em>
</div>

## Bagaimana Ia Saling Melengkapi

```
 pi (terminal)                 Pelayar (telefon / tablet / komputer riba)
      │                                │
      │  menulis JSONL                 │  HTTP + SSE
      ▼                                ▼
 ~/.pi/agent/sessions/  ←───  pi-web (pelayan HTTP Go)
                                      │
                    ┌─────────────────┼─────────────────┐
                    │                 │                 │
              pi --mode rpc      fsnotify         tailscale serve
            (pekerja sembang    (muat semula     (HTTPS jauh
             per-sesi)           langsung)        melalui MagicDNS)
```

- **pi** menulis JSONL perbualan ke `~/.pi/agent/sessions/` semasa ia bekerja.
- **pi-web** ialah pelayan Go yang membaca fail tersebut, memaparkannya dalam pelayar, dan menstrim kemas kini langsung melalui SSE.
- Pekerja **pi --mode rpc** mengendalikan sembang yang dimulakan oleh pelayar — satu per sesi, dihapuskan selepas 10 minit melahu.
- **fsnotify** memantau direktori sesi supaya pelayar memuat semula dalam milisaat selepas output baharu.
- **Tailscale Serve** menerbitkan pelayan localhost sebagai titik akhir HTTPS pada tailnet anda.

## Pasang

```bash
pi install npm:@ygncode/pi-web@beta
```

Itu sahaja — ia memuat turun binari yang sepadan, menyediakan permulaan automatik, dan mendaftarkan perintah `/web`, `/pi-web`, `/remote`, dan `/refresh`.

Setelah dipasang, buka `http://127.0.0.1:31415` dalam pelayar anda. Dari pi, gunakan `/web` untuk membuka sesi semasa dalam pelayar anda dengan serta-merta. Jika Tailscale sedang berjalan pada mesin anda, pi-web secara automatik menerbitkan titik akhir HTTPS pada tailnet anda — gunakan `/remote` dari pi untuk mendapatkan kod QR dan URL untuk mana-mana peranti pada tailnet anda.

> **Akses jauh macOS:** Pasang dan buka Tailscale secara interaktif, luluskan gesaan pentadbir dan log masuk. Kemudian jalankan `/pi-web restart`, diikuti dengan `/remote`.

Untuk pemasangan manual, muat turun binari, atau binaan dari sumber, lihat [user-docs/install.md](user-docs/en/install.md).

## Integrasi Pi

Selepas `pi install npm:@ygncode/pi-web@beta`, anda mendapat:

| Perintah | Fungsinya |
|----------|-----------|
| `/web` | Buka sesi semasa dalam pelayar anda (sedar SSH: langkau pelayar dan tunjukkan URL sahaja) |
| `/pi-web` | Tunjukkan status, versi, mula/henti/mula semula pelayan, atau kemas kini |
| `/remote` | Tunjukkan kod QR dan URL untuk akses jauh melalui Tailscale |
| `/refresh` | Tarik mesej baharu yang ditulis dari pelayar jauh kembali ke sesi terminal |

**Penajukan automatik** sesi dibina ke dalam pi-web sendiri dan dikonfigurasikan pada halaman `/settings`. Ia **dihidupkan secara lalai** dan menamakan sesi secara automatik. Anda boleh memilih:

- **Bila untuk menajuk** — sekali setiap sesi, atau pada setiap mesej baharu (lalai).
- **Model tajuk** — **heuristik perkataan terbina dalam percuma dan pantas (tiada AI)** secara lalai, atau pilih model (cth. yang kecil/pantas) untuk tajuk yang lebih pintar, ditulis oleh model.

Pakej ini juga memasang binari pi-web ke `~/.pi/agent/bin/pi-web` dan menyediakan permulaan automatik semasa log masuk.

## Permulaan Automatik Semasa Log Masuk

Perintah `pi install npm:@ygncode/pi-web@beta` menyediakan ini secara automatik:

| OS | Mekanisme |
|----|-----------|
| macOS | launchd plist di `~/Library/LaunchAgents/com.pi-web.plist` |
| Linux | systemd user service di `~/.config/systemd/user/pi-web.service` |

Untuk menetapkan token untuk akses jauh, cipta `~/.config/pi-web/env`:

```
PI_WEB_TOKEN=token-anda-di-sini
```

Untuk butiran lanjut (persediaan manual, port tersuai, ikatan bukan loopback), lihat [user-docs/install.md](user-docs/en/install.md).

## Pembangunan

```bash
make setup   # pasang kebergantungan frontend dan muat turun modul Go
make check   # ujian/pembinaan frontend + ujian/vet Go
make build   # setup jika perlu, bina frontend, kemudian bina ./pi-web
```
