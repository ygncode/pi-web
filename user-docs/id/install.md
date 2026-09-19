# Instalasi & Penggunaan

## Fitur

### Kontrol jarak jauh

- Lanjutkan sesi apa pun dari browser dengan lampiran teks atau gambar
- Mulai sesi yang benar-benar baru pada jalur proyek mana pun, langsung dari UI web
- Penggantian model di dalam browser dan pemilih level berpikir, per sesi
- Status worker per sesi (idle / running / error) dengan pemulihan otomatis saat crash
- Beberapa sesi berjalan secara paralel — mulai pekerjaan di satu sesi, pantau aliran sesi lainnya
- `PI_WEB_TOKEN` untuk eksposur LAN yang aman — wajib secara default untuk setiap bind non-loopback yang eksplisit

### Membaca sesi

- Jelajahi sesi di berbagai proyek dengan filter, pencarian, dan navigasi branch penuh
- Pembaruan inkremental langsung saat pi masih berjalan (melalui fsnotify; latensi ~ms)
- Mode follow untuk mengikuti sesi aktif
- Tautan langsung ke pesan individual
- Unduh sesi sebagai JSONL
- Bagikan snapshot statis sebagai GitHub Gists rahasia
- Ekstensi pi `/web`, `/remote`, `/refresh`, `/pi-web token`, dan `/pi-web set-token` untuk membuka sesi, QR jarak jauh, sinkronisasi sesi, dan pengelolaan token
- `/skill:pi-web-schedule`, `/skill:pi-web-notes`, `/skill:pi-web-settings` (`pi-web-ctl`) sehingga sesi dapat mengelola jadwal, scratchpad proyek, dan pengaturan dalam bahasa alami

## Persyaratan

- [Go](https://go.dev) 1.25+ (hanya untuk build dari sumber)
- `pi` di `PATH` Anda untuk chat browser/penggantian model
- Opsional: `gh` untuk berbagi
- Di Windows: pi memerlukan shell bash untuk tool shell-nya — [Git for Windows](https://git-scm.com/download/win) sudah cukup (lihat dokumen Windows pi)

## Instalasi

### Paket Pi (disarankan)

```bash
pi install npm:@ygncode/pi-web@beta
```

Perintah tunggal ini:

- Menginstal paket pi npm di bawah direktori paket pi
- Menjalankan skrip `postinstall` paket (`install.sh`, atau `install.ps1` di Windows)
- Mengunduh biner pi-web yang cocok untuk versi paket dan platform Anda dari GitHub Releases
- Menginstalnya ke `~/.pi/agent/bin/pi-web` (`pi-web.exe` di Windows)
- Menyiapkan auto-start saat login (launchd di macOS, systemd di Linux, launcher Run-key di Windows)
- Mendaftarkan perintah pi `/web`, `/remote`, `/refresh`, `/pi-web token`, dan `/pi-web set-token`

Pemberian judul otomatis sesi sudah terpasang di pi-web (bukan ekstensi) dan dikonfigurasi di halaman `/settings`. Fitur ini aktif secara default: pi-web memberi nama sesi secara otomatis menggunakan heuristik kata bawaan yang gratis (tanpa AI), memberi judul ulang pada setiap pesan baru. Anda dapat beralih ke pemberian judul sekali per sesi, dan/atau memilih model untuk menulis judul yang lebih cerdas alih-alih heuristik.

Di Linux, auto-start dikonfigurasi sebagai layanan systemd pengguna di `~/.config/systemd/user/pi-web.service`. Installer menulis ulang `ExecStart`-nya ke jalur biner yang benar-benar terinstal. Jika Tailscale tersedia saat runtime, pi-web memublikasikan server localhost dengan Tailscale Serve HTTPS. Jika systemd pengguna tidak tersedia, jalankan secara manual dengan `~/.pi/agent/bin/pi-web -o`.

Untuk menginstal hanya pada proyek tertentu (dibagikan dengan tim Anda melalui `.pi/settings.json`):

```bash
pi install -l npm:@ygncode/pi-web@beta
```

Kemudian mulai ulang pi (atau jalankan `/reload`), dan gunakan `/web`, `/pi-web`, `/remote`, `/refresh`. Kelola token akses Anda dengan `/pi-web token` dan `/pi-web set-token`.

Jika npm dibatalkan dengan `ENOTEMPTY` saat mengganti nama `@ygncode/pi-web`, hapus direktori cadangan tersembunyi npm yang usang dan instal ulang kanal beta:

```bash
rm -rf ~/.pi/agent/npm/node_modules/@ygncode/.pi-web-*
pi install npm:@ygncode/pi-web@beta
```

### Instalasi cepat (tanpa alat build)

macOS / Linux:

```bash
curl -fsSL https://raw.githubusercontent.com/ygncode/pi-web/main/install.sh | bash
```

Windows (PowerShell):

```powershell
irm https://raw.githubusercontent.com/ygncode/pi-web/main/install.ps1 | iex
```

Ini mengunduh biner pi-web terbaru, menginstalnya ke `/usr/local/bin` (`~/.pi/agent/bin` di Windows), dan menyiapkan auto-start saat login. Tidak memerlukan Go, Node, atau pi.

### Unduh biner

Biner pra-bangun dilampirkan pada setiap [GitHub Release](https://github.com/ygncode/pi-web/releases).

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

Kemudian pindahkan ke PATH Anda:

```bash
cp pi-web ~/.pi/agent/bin/
# or system-wide:
sudo cp pi-web /usr/local/bin/
```

### Build dari sumber

```bash
git clone https://github.com/ygncode/pi-web.git
cd pi-web
make build   # builds the Vite bundle, then embeds it into the Go binary

# optional: put it on PATH
cp pi-web ~/.pi/agent/bin/
```

Bundel frontend disematkan oleh `web/assets_embed.go`, jadi `go build` memerlukan
`web/dist` untuk ada terlebih dahulu. `make build` melakukan kedua langkah secara berurutan; jika Anda build
secara manual, jalankan `npm --prefix web install && npm --prefix web run build` sebelum
`go build ./cmd/pi-web`.

### Kembangkan berdampingan dengan instance terinstal

Biarkan instance terinstal berjalan di port `31415`, lalu mulai checkout sumber
dalam mode pengembangan:

```bash
make dev
```

Buka `http://127.0.0.1:31416`. `make dev` mengatur lingkungan pengembangan internal `PI_WEB_DEV=1`,
sehingga checkout sumber berbagi sesi, pengaturan, dan
data SQLite dengan instance terinstal sambil mempertahankan lock runtime pengembangan
dan file state yang terpisah. Instance terinstal biasa dan yang diluncurkan secara manual
tidak berubah dan mempertahankan perilaku single-instance asli.

Untuk mencegah pekerjaan otonom duplikat, mode pengembangan tidak menjalankan
loop jadwal, penguras antrean chat, pemberian judul otomatis, atau notifikasi push. Permintaan
langsung yang dibuat melalui UI pengembangan tetap berfungsi. Jangan mengendalikan
sesi chat yang sama dari kedua instance sekaligus; setiap proses memiliki manajer worker RPC
sendiri.

`make dev` memerlukan [Air](https://github.com/air-verse/air) untuk hot reload Go:

```bash
go install github.com/air-verse/air@latest
```

`PI_WEB_DEV` adalah infrastruktur harness pengembangan, bukan mode multi-instance
produksi yang didukung.

## Penghapusan instalasi

```bash
pi remove npm:@ygncode/pi-web@beta
```

Ini menjalankan skrip `preuninstall` paket (`uninstall.sh`, atau `uninstall.ps1`
di Windows), yang menghentikan instance yang berjalan dan menghapus:

- biner pi-web (`~/.pi/agent/bin/pi-web`, atau `/usr/local/bin/pi-web` untuk instalasi mandiri)
- file versi (`~/.pi/agent/pi-web-version`)
- file state runtime (`~/.pi/agent/pi-web/pi-web-state.json`)
- konfigurasi auto-start (plist launchd di macOS, layanan pengguna systemd di Linux, entri Run-key + skrip launcher di Windows)

Data Anda dipertahankan sehingga instalasi ulang nanti melanjutkan dari titik terakhir Anda:
`~/.pi/agent/pi-web.sqlite`, `~/.pi/agent/pi-web-memory.sqlite`, file sesi Anda
di bawah `~/.pi/agent/sessions/`, dan `~/.config/pi-web/env` (termasuk
`PI_WEB_TOKEN`). Hapus semua itu secara manual jika Anda ingin mulai dari awal yang bersih.

## Penggunaan

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

Secara default, pi-web bind ke `127.0.0.1`. Jika Tailscale berjalan dengan MagicDNS **dan `PI_WEB_TOKEN` diatur**, pi-web juga menjalankan `tailscale serve --bg --https=<port> http://127.0.0.1:<port>` dan mencetak URL tailnet HTTPS. Tanpa token, pi-web tetap hanya loopback dan melewati Tailscale Serve, sehingga peer tailnet tidak dapat menjangkau agen tanpa autentikasi. Setiap bind non-loopback eksplisit juga memerlukan `PI_WEB_TOKEN` untuk diatur; berikan `--insecure` untuk menimpanya demi pengujian lokal.

## Akses Jarak Jauh

Biarkan pi-web mendengarkan secara lokal, lalu gunakan URL Tailscale HTTPS yang dicetak dari ponsel atau laptop Anda di tailnet.

Di macOS, instal dan buka Tailscale secara interaktif, setujui perintah administrator, lalu masuk. Kemudian jalankan `/pi-web restart`, diikuti `/remote`.

Di Linux, izinkan pengguna Anda mengelola Tailscale sebelum menginstal/menjalankan pi-web, jika tidak `tailscale serve` mungkin memerlukan sudo dan auto-start bisa gagal:

```bash
sudo tailscale set --operator=$USER
```

```bash
# 1. Start pi-web with a token so it publishes the Tailscale HTTPS endpoint
PI_WEB_TOKEN=$(openssl rand -hex 16) pi-web

# 2. From any other Tailscale-connected device, open the printed
#    "Tailscale HTTPS" URL and enter the token once.
```

> Secara default, pi-web menolak untuk bind ke alamat non-loopback kecuali `PI_WEB_TOKEN` diatur — siapa pun yang dapat menjangkau alamat yang di-bind sebaliknya dapat melihat sesi dan mengirim instruksi ke pi. Untuk menimpa pengaman ini demi pengujian jaringan lokal, berikan `--insecure`. **Jangan gunakan `--insecure` di Tailscale atau alamat mana pun yang dapat dijangkau dari luar mesin Anda.**
>
> Klien dapat meneruskan token melalui header `Authorization: Bearer <token>`, header `X-Pi-Token`, atau sekali melalui `?token=<token>` (atau prompt login). Saat token tiba melalui query string, pi-web menetapkan cookie `pi_token` dan mengalihkan ke URL yang sama dengan token yang dihapus, sehingga token tidak menetap di bilah alamat atau riwayat browser. Utamakan bentuk header untuk skrip dan otomatisasi.

## Chat Browser

Buka halaman sesi dan gunakan composer di bagian bawah untuk melanjutkan sesi tersebut secara persis.

- `Enter` mengirim, `Shift+Enter` menyisipkan baris baru
- Seret-lepas atau tempel gambar langsung ke composer
- Pemilih model dan pemilih level berpikir berada di header — perubahan langsung diterapkan ke worker pi yang mendasarinya
- Setiap sesi aktif mendapatkan worker `pi --mode rpc` khusus sendiri, sehingga sesi yang berbeda tidak saling memblokir

## Berbagi Sesi

Klik **Share** pada halaman sesi untuk membuat GitHub Gist rahasia.

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

> Agar layanan dimulai saat boot (sebelum login), gunakan layanan sistem sebagai gantinya:
> salin `init/pi-web.service` ke `/etc/systemd/system/` dan gunakan `sudo systemctl`.

### Windows

Installer mengonfigurasi ini secara otomatis, tanpa memerlukan hak admin: entri
`pi-web` di bawah `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`
meluncurkan `~/.config/pi-web/pi-web-start.vbs` saat login, yang memulai biner
secara tersembunyi (tanpa jendela konsol) setelah memuat `~/.config/pi-web/env`
(`PI_WEB_TOKEN`, `PATH`, ...).

Untuk mengelolanya secara manual:

```powershell
# Start / stop
wscript.exe "$HOME\.config\pi-web\pi-web-start.vbs"
taskkill /IM pi-web.exe /F

# Remove auto-start
Remove-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run' -Name 'pi-web'
```

Tidak ada supervisi layanan di Windows: jika pi-web crash, ia tetap mati
hingga login berikutnya (launchd/systemd memulai ulang secara otomatis di
platform lainnya).
