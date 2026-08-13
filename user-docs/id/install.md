# Instalasi & Penggunaan

## Fitur

### Kendali jarak jauh

- Lanjutkan sesi apa pun dari browser dengan teks atau lampiran gambar
- Mulai sesi baru di path proyek mana pun, langsung dari UI web
- Penggantian model dalam browser dan pemilih level berpikir, per sesi
- Status worker per sesi (idle / running / error) dengan pemulihan otomatis saat crash
- Beberapa sesi berjalan paralel — mulai pekerjaan di satu sesi, pantau streaming sesi lain
- `PI_WEB_TOKEN` untuk eksposur LAN yang aman — wajib secara default untuk bind non-loopback eksplisit

### Membaca sesi

- Jelajahi sesi di seluruh proyek dengan filter, pencarian, dan navigasi branch lengkap
- Pembaruan inkremental langsung saat pi masih berjalan (via fsnotify; latensi ~ms)
- Mode ikuti untuk memantau sesi aktif
- Deep link ke pesan individual
- Unduh sesi sebagai JSONL
- Bagikan snapshot statis sebagai GitHub Gist rahasia
- Ekstensi pi `/web`, `/remote`, `/refresh`, `/pi-web token` dan `/pi-web set-token` untuk membuka sesi, QR jarak jauh, sinkronisasi sesi, dan manajemen token

## Persyaratan

- [Go](https://go.dev) 1.25+
- `pi` di `PATH` Anda untuk chat browser/penggantian model
- Opsional: `gh` untuk berbagi

## Instalasi

### Paket Pi (direkomendasikan)

```bash
pi install npm:@ygncode/pi-web@beta
```

Satu perintah ini:
- Menginstal paket npm pi di bawah direktori paket pi
- Menjalankan skrip `postinstall` paket (`bash install.sh`)
- Mengunduh biner pi-web yang cocok untuk versi paket dan platform Anda dari GitHub Releases
- Menginstalnya ke `~/.pi/agent/bin/pi-web`
- Menyiapkan auto-start saat login (launchd di macOS, systemd di Linux)
- Mendaftarkan perintah pi `/web`, `/remote`, `/refresh`, `/pi-web token`, dan `/pi-web set-token`

Pemberian judul otomatis sesi sudah terintegrasi dalam pi-web (bukan ekstensi) dan dikonfigurasi di halaman `/settings`. Fitur ini aktif secara default: pi-web menamai sesi secara otomatis menggunakan heuristik kata bawaan gratis (tanpa AI), memberi judul ulang setiap ada pesan baru. Anda dapat beralih ke pemberian judul sekali per sesi, dan/atau memilih model untuk menulis judul yang lebih cerdas alih-alih heuristik.

Di Linux, auto-start dikonfigurasi sebagai layanan systemd pengguna di `~/.config/systemd/user/pi-web.service`. Installer menulis ulang `ExecStart`-nya ke path biner yang terinstal. Jika Tailscale tersedia saat runtime, pi-web mempublikasikan server localhost dengan Tailscale Serve HTTPS. Jika systemd pengguna tidak tersedia, jalankan secara manual dengan `~/.pi/agent/bin/pi-web -o`.

Untuk menginstal hanya untuk proyek tertentu (dibagikan dengan tim Anda via `.pi/settings.json`):

```bash
pi install -l npm:@ygncode/pi-web@beta
```

Kemudian mulai ulang pi (atau jalankan `/reload`), dan gunakan `/web`, `/pi-web`, `/remote`, `/refresh`. Kelola token akses Anda dengan `/pi-web token` dan `/pi-web set-token`.

Jika npm gagal dengan `ENOTEMPTY` saat mengganti nama `@ygncode/pi-web`, hapus direktori cadangan tersembunyi npm yang usang dan instal ulang saluran beta:

```bash
rm -rf ~/.pi/agent/npm/node_modules/@ygncode/.pi-web-*
pi install npm:@ygncode/pi-web@beta
```

### Instalasi cepat (tanpa alat build)

```bash
curl -fsSL https://raw.githubusercontent.com/ygncode/pi-web/main/install.sh | bash
```

Ini mengunduh biner pi-web terbaru, menginstalnya ke `/usr/local/bin`, dan menyiapkan auto-start saat login. Tidak memerlukan Go, Node, atau pi.

### Unduh biner

Biner yang sudah dibangun tersedia di setiap [GitHub Release](https://github.com/ygncode/pi-web/releases).

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

Kemudian pindahkan ke PATH Anda:

```bash
cp pi-web ~/.pi/agent/bin/
# atau di seluruh sistem:
sudo cp pi-web /usr/local/bin/
```

### Build dari sumber

```bash
git clone https://github.com/ygncode/pi-web.git
cd pi-web
make build   # membangun bundel Vite, lalu menanamkannya ke biner Go

# opsional: letakkan di PATH
cp pi-web ~/.pi/agent/bin/
```

Bundel frontend ditanam oleh `web/assets_embed.go`, jadi `go build` memerlukan
`web/dist` sudah ada terlebih dahulu. `make build` melakukan kedua langkah secara
berurutan; jika Anda membangun secara manual, jalankan `npm --prefix web install && npm --prefix web run build` sebelum
`go build ./cmd/pi-web`.

## Penghapusan

```bash
pi remove npm:@ygncode/pi-web@beta
```

Ini menjalankan skrip `preuninstall` paket (`bash uninstall.sh`), yang menghentikan
instance yang berjalan dan menghapus:

- biner pi-web (`~/.pi/agent/bin/pi-web`, atau `/usr/local/bin/pi-web` untuk instalasi standalone)
- file versi (`~/.pi/agent/pi-web-version`)
- file status runtime (`~/.pi/agent/pi-web/pi-web-state.json`)
- konfigurasi auto-start (launchd plist di macOS, layanan systemd pengguna di Linux)

Data Anda dipertahankan sehingga instal ulang nanti melanjutkan dari tempat Anda berhenti:
`~/.pi/agent/pi-web.sqlite`, `~/.pi/agent/pi-web-memory.sqlite`, file sesi Anda
di bawah `~/.pi/agent/sessions/`, dan `~/.config/pi-web/env` (termasuk
`PI_WEB_TOKEN`). Hapus secara manual jika Anda ingin memulai dari awal.

## Penggunaan

```bash
# Mulai di port default (31415)
pi-web

# Mulai dan buka browser
pi-web -o

# Port kustom
pi-web -p 8080

# Timpa host bind (loopback tidak terautentikasi secara default)
pi-web --host 127.0.0.1

# Bind non-loopback memerlukan token — pi-web menolak untuk memulai tanpanya
PI_WEB_TOKEN=$(openssl rand -hex 16) pi-web --host 192.168.1.50
```

Secara default, pi-web bind ke `127.0.0.1`. Jika Tailscale berjalan dengan MagicDNS, pi-web juga menjalankan `tailscale serve --bg --https=<port> http://127.0.0.1:<port>` dan mencetak URL HTTPS tailnet. Bind non-loopback eksplisit apa pun memerlukan `PI_WEB_TOKEN` untuk disetel; berikan `--insecure` untuk menimpa demi pengujian lokal.

## Akses Jarak Jauh

Biarkan pi-web mendengarkan secara lokal, lalu gunakan URL HTTPS Tailscale yang tercetak dari ponsel atau laptop Anda di tailnet.

Pada macOS, instal dan buka Tailscale secara interaktif, setujui permintaan administrator, lalu masuk. Kemudian jalankan `/pi-web restart`, diikuti dengan `/remote`.

Di Linux, izinkan pengguna Anda mengelola Tailscale sebelum menginstal/menjalankan pi-web, jika tidak `tailscale serve` mungkin memerlukan sudo dan auto-start dapat gagal:

```bash
sudo tailscale set --operator=$USER
```

```bash
# 1. Mulai pi-web
pi-web

# 2. Dari perangkat lain yang terhubung ke Tailscale, buka URL
#    "Tailscale HTTPS" yang tercetak.
```

> Secara default, pi-web menolak untuk bind ke alamat non-loopback kecuali `PI_WEB_TOKEN` disetel — siapa pun yang dapat mencapai alamat yang di-bind bisa melihat sesi dan mengirim instruksi ke pi. Untuk menimpa pengamanan ini demi pengujian jaringan lokal, berikan `--insecure`. **Jangan gunakan `--insecure` di Tailscale atau alamat apa pun yang dapat dijangkau dari luar mesin Anda.**
>
> Klien dapat mengirimkan token melalui header `Authorization: Bearer <token>`, header `X-Pi-Token`, atau sekali via `?token=<token>` (yang menyetel cookie `pi_token` untuk permintaan selanjutnya). Token yang dikirim via `?token=` akan tersimpan di riwayat browser, log akses server, dan header `Referer` dari tautan apa pun di halaman — lebih baik gunakan bentuk header untuk apa pun selain bookmark awal.

## Chat Browser

Buka halaman sesi dan gunakan komposer di bagian bawah untuk melanjutkan sesi yang sama persis.

- `Enter` mengirim, `Shift+Enter` menyisipkan baris baru
- Seret-dan-lepas atau tempel gambar langsung ke komposer
- Pemilih model dan pemilih level berpikir berada di header — perubahan berlaku ke worker pi yang mendasarinya segera
- Setiap sesi aktif mendapatkan worker `pi --mode rpc` khusus sendiri, sehingga sesi yang berbeda tidak saling memblokir

## Berbagi Sesi

Klik **Share** di halaman sesi untuk membuat GitHub Gist rahasia.

Persyaratan:
- `gh` terinstal
- `gh auth login` selesai

Berbagi mengembalikan:
- URL gist rahasia
- URL pratinjau di `https://pi.dev/session/#<gistId>`

Gist yang dibagikan adalah snapshot dan tidak diperbarui secara langsung.

## Auto-Start saat Login

### macOS

```bash
cp init/com.pi-web.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.pi-web.plist
```

### Linux (systemd)

```bash
# Instal layanan systemd pengguna
mkdir -p ~/.config/systemd/user
cp init/pi-web.service ~/.config/systemd/user/

# Opsional: setel PI_WEB_TOKEN Anda untuk bind non-loopback
# (atau gunakan /pi-web set-token <token> dari dalam pi)
mkdir -p ~/.config/pi-web
echo 'PI_WEB_TOKEN=token-anda-di-sini' > ~/.config/pi-web/env

# Aktifkan dan mulai
systemctl --user daemon-reload
systemctl --user enable --now pi-web.service

# Periksa status
systemctl --user status pi-web.service

# Lihat log
journalctl --user -u pi-web.service -f
```

> Agar layanan mulai saat boot (sebelum login), gunakan layanan sistem sebagai gantinya:
> salin `init/pi-web.service` ke `/etc/systemd/system/` dan gunakan `sudo systemctl`.
