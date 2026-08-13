<h1 align="center">pi-web (Remote Control Your Pi)</h1>

<div align="center">

[![GitHub stars](https://img.shields.io/github/stars/ygncode/pi-web?style=flat&logo=github&label=stars&cacheSeconds=86400)](https://github.com/ygncode/pi-web/stargazers)
[![npm downloads](https://img.shields.io/npm/dw/@ygncode/pi-web?label=downloads/wk&color=2ea043&cacheSeconds=86400)](https://www.npmjs.com/package/@ygncode/pi-web)
[![license MIT](https://img.shields.io/npm/l/@ygncode/pi-web?label=license&color=0a7bbb&cacheSeconds=86400)](../../LICENSE)
[![Telegram](https://img.shields.io/badge/Telegram-Join-26A5E4?logo=telegram&logoColor=white)](https://t.me/+NJvFOTTa0wNjNTc9)
![platform](https://img.shields.io/badge/platform-macOS%20%7C%20Linux-555)

[English](../../README.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [中文](README.zh.md) · [日本語](README.ja.md) · **Bahasa Indonesia** · [Bahasa Melayu](README.ms.md) · [Tiếng Việt](README.vi.md) · [ไทย](README.th.md) · [Filipino](README.fil.md) · [မြန်မာ](README.my.md) · [ភាសាខ្មែរ](README.km.md) · [ລາວ](README.lo.md)

</div>

<div align="center">

Kendalikan [pi](https://pi.dev) coding agent Anda dari ponsel, tablet, atau laptop — di mana saja di jaringan Anda, atau dari jarak jauh melalui Tailscale.

Ini adalah PWA penuh, jadi Anda bisa memasangnya dan menggunakannya seperti aplikasi native di perangkat apa pun. Anggap saja sebagai ruang kerja AI pribadi Anda sendiri — seperti Cowork milik Claude, tetapi dengan model yang berbeda — mengobrol lintas model, menulis kode dari ponsel, atau menjadikannya [asisten pribadi](user-docs/en/personal-assistant.md) yang hidup di mesin Anda.

Jadikan milik Anda: ganti tema dan font, dan gunakan dalam bahasa Anda sendiri — pi-web hadir dengan banyak bahasa dan Anda bisa menambahkan sendiri. Lebih banyak fitur sedang dalam perjalanan, tetapi tidak akan membengkak: apa pun yang tidak Anda perlukan bisa dimatikan di pengaturan.

</div>

> [!WARNING]
> pi-web saat ini dalam tahap **beta**. Banyak hal akan berubah dan rusak!

> [!TIP]
> Baru di sini? **[Baca panduan pengguna →](user-docs/en/README.md)** untuk tur lengkap fitur, langkah pemasangan, dan tips. ([Bahasa lainnya →](../README.md))

## Tangkapan Layar

<div align="center">
  <img src="../assets/pi-web-desktop-screenshot.png" alt="Desktop" width="90%" /><br />
  <em>Desktop</em>
  <br /><br />
  <img src="../assets/pi-web-mobile-screenshot.png" alt="PWA Seluler" width="90%" /><br />
  <em>PWA Seluler</em>
</div>

## Bagaimana Semuanya Bekerja

```
 pi (terminal)                 Peramban (ponsel / tablet / laptop)
      │                                │
      │  menulis JSONL                │  HTTP + SSE
      ▼                                ▼
 ~/.pi/agent/sessions/  ←───  pi-web (server HTTP Go)
                                      │
                    ┌─────────────────┼─────────────────┐
                    │                 │                 │
              pi --mode rpc      fsnotify         tailscale serve
            (pekerja obrolan  (muat ulang       (HTTPS jarak jauh
             per sesi)         langsung)          melalui MagicDNS)
```

- **pi** menulis JSONL percakapan ke `~/.pi/agent/sessions/` saat bekerja.
- **pi-web** adalah server Go yang membaca file-file tersebut, merendernya di peramban, dan mengalirkan pembaruan langsung melalui SSE.
- Pekerja **pi --mode rpc** menangani obrolan yang dimulai dari peramban — satu per sesi, dihentikan setelah 10 menit menganggur.
- **fsnotify** memantau direktori sesi sehingga peramban memuat ulang dalam hitungan milidetik setelah ada keluaran baru.
- **Tailscale Serve** mempublikasikan server localhost sebagai titik akhir HTTPS di tailnet Anda.

## Pemasangan

```bash
pi install npm:@ygncode/pi-web@beta
```

Itu saja — perintah ini mengunduh biner yang cocok, menyiapkan mulai-otomatis, dan mendaftarkan perintah `/web`, `/pi-web`, `/remote`, dan `/refresh`.

Setelah terpasang, buka `http://127.0.0.1:31415` di peramban Anda. Dari pi, gunakan `/web` untuk membuka sesi saat ini di peramban secara instan. Jika Tailscale berjalan di mesin Anda, pi-web secara otomatis mempublikasikan titik akhir HTTPS di tailnet Anda — gunakan `/remote` dari pi untuk mendapatkan kode QR dan URL untuk perangkat apa pun di tailnet Anda.

> **Akses jarak jauh di macOS:** Instal dan buka Tailscale secara interaktif, setujui permintaan administrator, lalu masuk. Kemudian jalankan `/pi-web restart`, diikuti dengan `/remote`.

Untuk pemasangan manual, unduhan biner, atau membangun dari sumber, lihat [user-docs/install.md](user-docs/en/install.md).

## Integrasi Pi

Setelah `pi install npm:@ygncode/pi-web@beta`, Anda mendapatkan:

| Perintah | Fungsinya |
|----------|-----------|
| `/web` | Buka sesi saat ini di peramban Anda (sadar-SSH: melewati peramban dan hanya menampilkan URL) |
| `/pi-web` | Tampilkan status, versi, mulai/hentikan/mulai ulang server, atau perbarui |
| `/remote` | Tampilkan kode QR dan URL untuk akses jarak jauh melalui Tailscale |
| `/refresh` | Tarik pesan baru yang ditulis dari peramban jarak jauh kembali ke sesi terminal |

**Pemberian judul otomatis** sesi sudah terpasang di pi-web dan dikonfigurasi di halaman `/settings`. Ini **aktif secara bawaan** dan memberi nama sesi secara otomatis. Anda dapat memilih:

- **Kapan memberi judul** — sekali per sesi, atau pada setiap pesan baru (bawaan).
- **Model judul** — **heuristik kata bawaan (tanpa AI)** yang gratis dan instan secara bawaan, atau pilih model (mis. yang kecil/cepat) untuk judul yang lebih cerdas yang ditulis oleh model.

Paket ini juga memasang biner pi-web ke `~/.pi/agent/bin/pi-web` dan menyiapkan mulai-otomatis saat login.

## Mulai-Otomatis saat Login

Perintah `pi install npm:@ygncode/pi-web@beta` menyiapkan ini secara otomatis:

| OS | Mekanisme |
|----|-----------|
| macOS | launchd plist di `~/Library/LaunchAgents/com.pi-web.plist` |
| Linux | systemd user service di `~/.config/systemd/user/pi-web.service` |

Untuk mengatur token untuk akses jarak jauh, buat `~/.config/pi-web/env`:

```
PI_WEB_TOKEN=token-anda-di-sini
```

Untuk detail lebih lanjut (pengaturan manual, port kustom, binding non-loopback), lihat [user-docs/install.md](user-docs/en/install.md).

## Pengembangan

```bash
make setup   # pasang dependensi frontend dan unduh modul Go
make check   # uji frontend/build + uji Go/vet
make build   # setup jika diperlukan, bangun frontend, lalu bangun ./pi-web
```
