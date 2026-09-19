# Pemasangan & Penggunaan

## Ciri-ciri

### Kawalan jauh

- Sambung mana-mana sesi daripada pelayar dengan teks atau lampiran imej
- Mulakan sesi baharu sepenuhnya terhadap mana-mana laluan projek, terus daripada UI web
- Penukaran model dalam pelayar dan pemilih tahap pemikiran, setiap sesi
- Status pekerja setiap sesi (idle / running / error) dengan pemulihan automatik apabila ranap
- Berbilang sesi berjalan selari — mulakan kerja dalam satu, tonton satu lagi distrim
- `PI_WEB_TOKEN` untuk pendedahan LAN yang selamat — diperlukan secara lalai untuk sebarang pengikatan bukan gelung-balik yang eksplisit

### Membaca sesi

- Layari sesi merentas projek dengan penapis, carian dan navigasi cawangan penuh
- Kemas kini tambahan langsung semasa pi masih berjalan (melalui fsnotify; latensi ~ms)
- Mod ikut untuk mengekori sesi aktif
- Pautan mendalam ke mesej individu
- Muat turun sesi sebagai JSONL
- Kongsi syot kilat statik sebagai GitHub Gist rahsia
- Sambungan pi `/web`, `/remote`, `/refresh`, `/pi-web token` dan `/pi-web set-token` untuk membuka sesi, QR jauh, penyegerakan sesi dan pengurusan token
- `/skill:pi-web-schedule`, `/skill:pi-web-notes`, `/skill:pi-web-settings` (`pi-web-ctl`) supaya sesi boleh menguruskan jadual, papan coretan projek dan tetapan dalam bahasa semula jadi

## Keperluan

- [Go](https://go.dev) 1.25+ (hanya untuk membina daripada sumber)
- `pi` pada `PATH` anda untuk sembang pelayar/penukaran model
- Pilihan: `gh` untuk perkongsian
- Pada Windows: pi memerlukan shell bash untuk alat shellnya — [Git for Windows](https://git-scm.com/download/win) sudah memadai (lihat dokumen Windows pi)

## Pemasangan

### Pakej Pi (disyorkan)

```bash
pi install npm:@ygncode/pi-web@beta
```

Arahan tunggal ini:
- Memasang pakej npm pi di bawah direktori pakej pi
- Menjalankan skrip `postinstall` pakej (`install.sh`, atau `install.ps1` pada Windows)
- Memuat turun binari pi-web yang sepadan untuk versi pakej dan platform anda daripada GitHub Releases
- Memasangnya ke `~/.pi/agent/bin/pi-web` (`pi-web.exe` pada Windows)
- Menyediakan auto-mula semasa log masuk (launchd pada macOS, systemd pada Linux, pelancar Run-key pada Windows)
- Mendaftarkan perintah pi `/web`, `/remote`, `/refresh`, `/pi-web token` dan `/pi-web set-token`

Penjudulan automatik sesi terbina dalam pi-web (bukan sambungan) dan dikonfigurasikan pada halaman `/settings`. Ia dihidupkan secara lalai: pi-web menamakan sesi secara automatik menggunakan heuristik perkataan terbina dalam yang percuma (tiada AI), menjudul semula pada setiap mesej baharu. Anda boleh bertukar kepada penjudulan sekali setiap sesi, dan/atau memilih model untuk menulis tajuk yang lebih pintar dan bukannya heuristik.

Pada Linux, auto-mula dikonfigurasikan sebagai perkhidmatan systemd pengguna di `~/.config/systemd/user/pi-web.service`. Pemasang menulis semula `ExecStart` kepada laluan binari yang sebenarnya dipasang. Jika Tailscale tersedia semasa masa jalan, pi-web menerbitkan pelayan localhost dengan Tailscale Serve HTTPS. Jika systemd pengguna tidak tersedia, jalankan secara manual dengan `~/.pi/agent/bin/pi-web -o`.

Untuk memasang hanya untuk projek tertentu (dikongsi dengan pasukan anda melalui `.pi/settings.json`):

```bash
pi install -l npm:@ygncode/pi-web@beta
```

Kemudian mulakan semula pi (atau jalankan `/reload`), dan gunakan `/web`, `/pi-web`, `/remote`, `/refresh`. Urus token akses anda dengan `/pi-web token` dan `/pi-web set-token`.

Jika npm terbatal dengan `ENOTEMPTY` semasa menamakan semula `@ygncode/pi-web`, alihkan direktori sandaran tersembunyi basi npm dan pasang semula saluran beta:

```bash
rm -rf ~/.pi/agent/npm/node_modules/@ygncode/.pi-web-*
pi install npm:@ygncode/pi-web@beta
```

### Pemasangan pantas (tiada alat binaan diperlukan)

macOS / Linux:

```bash
curl -fsSL https://raw.githubusercontent.com/ygncode/pi-web/main/install.sh | bash
```

Windows (PowerShell):

```powershell
irm https://raw.githubusercontent.com/ygncode/pi-web/main/install.ps1 | iex
```

Ini memuat turun binari pi-web terkini, memasangnya ke `/usr/local/bin` (`~/.pi/agent/bin` pada Windows), dan menyediakan auto-mula semasa log masuk. Tiada Go, Node, atau pi diperlukan.

### Muat turun binari

Binari pra-bina dilampirkan pada setiap [GitHub Release](https://github.com/ygncode/pi-web/releases).

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

Kemudian alihkannya ke PATH anda:

```bash
cp pi-web ~/.pi/agent/bin/
# atau seluruh sistem:
sudo cp pi-web /usr/local/bin/
```

### Bina daripada sumber

```bash
git clone https://github.com/ygncode/pi-web.git
cd pi-web
make build   # membina bundle Vite, kemudian membenamkannya ke dalam binari Go

# pilihan: letakkan pada PATH
cp pi-web ~/.pi/agent/bin/
```

Bundle frontend dibenamkan oleh `web/assets_embed.go`, jadi `go build` memerlukan
`web/dist` wujud dahulu. `make build` melakukan kedua-dua langkah mengikut urutan; jika anda membina
secara manual, jalankan `npm --prefix web install && npm --prefix web run build` sebelum
`go build ./cmd/pi-web`.

### Bangunkan bersama-sama contoh yang dipasang

Biarkan contoh yang dipasang berjalan pada port `31415`, kemudian mulakan salinan sumber
dalam mod pembangunan:

```bash
make dev
```

Buka `http://127.0.0.1:31416`. `make dev` menetapkan persekitaran pembangunan dalaman
`PI_WEB_DEV=1`, jadi salinan sumber berkongsi sesi, tetapan dan data SQLite dengan contoh
yang dipasang sambil mengekalkan kunci masa jalan dan fail keadaan pembangunan yang berasingan.
Contoh biasa yang dipasang dan dilancarkan secara manual tidak berubah dan mengekalkan tingkah
laku satu-contoh yang asal.

Untuk mengelakkan kerja autonomi yang berganda, mod pembangunan tidak menjalankan
gelung jadual, pengosong baris gilir sembang, penjudulan automatik, atau pemberitahuan tolak.
Permintaan langsung yang dibuat melalui UI pembangunan masih berfungsi. Jangan kendalikan
sesi sembang yang sama daripada kedua-dua contoh serentak; setiap proses mempunyai pengurus
pekerja RPC sendiri.

`make dev` memerlukan [Air](https://github.com/air-verse/air) untuk muat semula panas Go:

```bash
go install github.com/air-verse/air@latest
```

`PI_WEB_DEV` ialah paipan abah-abah pembangunan, bukan mod berbilang-contoh pengeluaran
yang disokong.

## Nyahpasang

```bash
pi remove npm:@ygncode/pi-web@beta
```

Ini menjalankan skrip `preuninstall` pakej (`uninstall.sh`, atau `uninstall.ps1`
pada Windows), yang menghentikan contoh yang sedang berjalan dan mengalihkan:

- binari pi-web (`~/.pi/agent/bin/pi-web`, atau `/usr/local/bin/pi-web` untuk pemasangan kendiri)
- fail versi (`~/.pi/agent/pi-web-version`)
- fail keadaan masa jalan (`~/.pi/agent/pi-web/pi-web-state.json`)
- konfigurasi auto-mula (plist launchd pada macOS, perkhidmatan systemd pengguna pada Linux, entri Run-key + skrip pelancar pada Windows)

Data anda dipelihara supaya pemasangan semula kemudian menyambung semula tempat anda berhenti:
`~/.pi/agent/pi-web.sqlite`, `~/.pi/agent/pi-web-memory.sqlite`, fail sesi anda
di bawah `~/.pi/agent/sessions/`, dan `~/.config/pi-web/env` (termasuk
`PI_WEB_TOKEN`). Alihkan semua itu secara manual jika anda mahukan permulaan yang bersih.

## Penggunaan

```bash
# Mulakan pada port lalai (31415)
pi-web

# Mulakan dan buka pelayar
pi-web -o

# Port tersuai
pi-web -p 8080

# Atasi hos pengikatan (gelung-balik tidak disahkan secara lalai)
pi-web --host 127.0.0.1

# Pengikatan bukan gelung-balik memerlukan token — pi-web enggan bermula tanpanya
PI_WEB_TOKEN=$(openssl rand -hex 16) pi-web --host 192.168.1.50
```

Secara lalai, pi-web mengikat ke `127.0.0.1`. Jika Tailscale sedang berjalan dengan MagicDNS **dan `PI_WEB_TOKEN` ditetapkan**, pi-web juga menjalankan `tailscale serve --bg --https=<port> http://127.0.0.1:<port>` dan mencetak URL HTTPS tailnet. Tanpa token, pi-web kekal hanya gelung-balik dan melangkau Tailscale Serve, jadi rakan tailnet tidak dapat mencapai ejen tanpa pengesahan. Sebarang pengikatan bukan gelung-balik yang eksplisit juga memerlukan `PI_WEB_TOKEN` ditetapkan; lulus `--insecure` untuk mengatasi bagi ujian tempatan.

## Akses Jauh

Biarkan pi-web mendengar secara tempatan, kemudian gunakan URL HTTPS Tailscale yang dicetak daripada telefon atau komputer riba anda pada tailnet.

Pada macOS, pasang dan buka Tailscale secara interaktif, luluskan gesaan pentadbir dan daftar masuk. Kemudian jalankan `/pi-web restart`, diikuti dengan `/remote`.

Pada Linux, benarkan pengguna anda menguruskan Tailscale sebelum memasang/menjalankan pi-web, jika tidak `tailscale serve` mungkin memerlukan sudo dan auto-mula boleh gagal:

```bash
sudo tailscale set --operator=$USER
```

```bash
# 1. Mulakan pi-web dengan token supaya ia menerbitkan titik akhir HTTPS Tailscale
PI_WEB_TOKEN=$(openssl rand -hex 16) pi-web

# 2. Daripada mana-mana peranti lain yang disambungkan ke Tailscale, buka URL
#    "Tailscale HTTPS" yang dicetak dan masukkan token sekali.
```

> Secara lalai, pi-web enggan mengikat ke alamat bukan gelung-balik melainkan `PI_WEB_TOKEN` ditetapkan — sesiapa yang boleh mencapai alamat yang diikat boleh melihat sesi dan menghantar arahan kepada pi. Untuk mengatasi perlindungan ini bagi ujian rangkaian tempatan, lulus `--insecure`. **Jangan gunakan `--insecure` pada Tailscale atau mana-mana alamat yang boleh dicapai dari luar mesin anda.**
>
> Klien boleh menghantar token melalui pengepala `Authorization: Bearer <token>`, pengepala `X-Pi-Token`, atau sekali melalui `?token=<token>` (atau gesaan log masuk). Apabila token tiba melalui rentetan pertanyaan, pi-web menetapkan kuki `pi_token` dan mengalihkan ke URL yang sama dengan token dibuang, supaya ia tidak tertinggal dalam bar alamat atau sejarah pelayar. Utamakan bentuk pengepala untuk skrip dan automasi.

## Sembang Pelayar

Buka halaman sesi dan gunakan penggubah di bahagian bawah untuk menyambung sesi tersebut dengan tepat.

- `Enter` menghantar, `Shift+Enter` memasukkan baris baharu
- Seret-dan-lepas atau tampal imej terus ke dalam penggubah
- Pemilih model dan pemilih tahap pemikiran terletak di pengepala — perubahan terus digunakan pada pekerja pi asas dengan serta-merta
- Setiap sesi aktif mendapat pekerja `pi --mode rpc` khusus sendiri, jadi sesi yang berbeza tidak menyekat satu sama lain

## Perkongsian Sesi

Klik **Kongsi** pada halaman sesi untuk mencipta GitHub Gist rahsia.

Keperluan:
- `gh` dipasang
- `gh auth login` selesai

Perkongsian mengembalikan:
- URL gist rahsia
- URL pratonton di `https://pi.dev/session/#<gistId>`

Gist yang dikongsi ialah syot kilat dan tidak dikemas kini secara langsung.

## Auto-Mula semasa Log Masuk

### macOS

```bash
cp init/com.pi-web.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.pi-web.plist
```

### Linux (systemd)

```bash
# Pasang perkhidmatan systemd pengguna
mkdir -p ~/.config/systemd/user
cp init/pi-web.service ~/.config/systemd/user/

# Pilihan: tetapkan PI_WEB_TOKEN anda untuk pengikatan bukan gelung-balik
# (atau gunakan /pi-web set-token <token> dari dalam pi)
mkdir -p ~/.config/pi-web
echo 'PI_WEB_TOKEN=your-token-here' > ~/.config/pi-web/env

# Dayakan dan mulakan
systemctl --user daemon-reload
systemctl --user enable --now pi-web.service

# Semak status
systemctl --user status pi-web.service

# Lihat log
journalctl --user -u pi-web.service -f
```

> Untuk perkhidmatan bermula semasa but (sebelum log masuk), gunakan perkhidmatan sistem sebaliknya:
> salin `init/pi-web.service` ke `/etc/systemd/system/` dan gunakan `sudo systemctl`.

### Windows

Pemasang mengkonfigurasikan ini secara automatik, tanpa memerlukan hak pentadbir: entri
`pi-web` di bawah `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`
melancarkan `~/.config/pi-web/pi-web-start.vbs` semasa log masuk, yang memulakan binari
secara tersembunyi (tiada tetingkap konsol) selepas memuatkan `~/.config/pi-web/env`
(`PI_WEB_TOKEN`, `PATH`, ...).

Untuk menguruskannya secara manual:

```powershell
# Mula / henti
wscript.exe "$HOME\.config\pi-web\pi-web-start.vbs"
taskkill /IM pi-web.exe /F

# Alihkan auto-mula
Remove-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run' -Name 'pi-web'
```

Tiada penyeliaan perkhidmatan pada Windows: jika pi-web ranap, ia kekal mati
sehingga log masuk seterusnya (launchd/systemd memulakannya semula secara automatik pada
platform lain).
