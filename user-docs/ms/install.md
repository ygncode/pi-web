# Pemasangan & Penggunaan

## Ciri-ciri

### Kawalan jauh

- Sambung mana-mana sesi dari pelayar dengan lampiran teks atau imej
- Mulakan sesi baharu sepenuhnya pada mana-mana laluan projek, terus dari UI web
- Penukaran model dalam pelayar dan pemilih tahap pemikiran, setiap sesi
- Status pekerja setiap sesi (melahu / berjalan / ralat) dengan pemulihan automatik semasa ranap
- Berbilang sesi berjalan selari — mulakan kerja dalam satu, tonton strim yang lain
- `PI_WEB_TOKEN` untuk pendedahan LAN yang selamat — diperlukan secara lalai untuk sebarang ikatan bukan gelung-balik yang eksplisit

### Membaca sesi

- Layari sesi merentas projek dengan penapis, carian, dan navigasi cawangan penuh
- Kemas kini tambahan langsung semasa pi masih berjalan (melalui fsnotify; latensi ~ms)
- Mod ikut untuk mengekori sesi aktif
- Pautan dalam ke mesej individu
- Muat turun sesi sebagai JSONL
- Kongsi syot kilat statik sebagai GitHub Gist rahsia
- Sambungan pi `/web`, `/remote`, `/refresh`, `/pi-web token` dan `/pi-web set-token` untuk membuka sesi, QR jauh, penyegerakan sesi, dan pengurusan token

## Keperluan

- [Go](https://go.dev) 1.25+
- `pi` dalam `PATH` anda untuk sembang pelayar/penukaran model
- Pilihan: `gh` untuk perkongsian

## Pemasangan

### Pakej Pi (disyorkan)

```bash
pi install npm:@ygncode/pi-web@beta
```

Arahan tunggal ini:
- Memasang pakej npm pi di bawah direktori pakej pi
- Menjalankan skrip `postinstall` pakej (`bash install.sh`)
- Memuat turun binari pi-web yang sepadan untuk versi pakej dan platform anda dari GitHub Releases
- Memasangnya ke `~/.pi/agent/bin/pi-web`
- Menyediakan auto-mula semasa log masuk (launchd pada macOS, systemd pada Linux)
- Mendaftarkan arahan pi `/web`, `/remote`, `/refresh`, `/pi-web token`, dan `/pi-web set-token`

Penamaan automatik sesi terbina dalam pi-web (bukan sambungan) dan dikonfigurasikan pada halaman `/settings`. Ia dihidupkan secara lalai: pi-web menamakan sesi secara automatik menggunakan heuristik perkataan terbina dalam percuma (tiada AI), menamakan semula pada setiap mesej baharu. Anda boleh menukar kepada penamaan sekali setiap sesi, dan/atau memilih model untuk menulis tajuk yang lebih pintar dan bukannya heuristik.

Pada Linux, auto-mula dikonfigurasikan sebagai perkhidmatan systemd pengguna di `~/.config/systemd/user/pi-web.service`. Pemasang menulis semula `ExecStart` ke laluan binari sebenar yang dipasang. Jika Tailscale tersedia semasa masa jalan, pi-web menerbitkan pelayan localhost dengan Tailscale Serve HTTPS. Jika systemd pengguna tidak tersedia, jalankan secara manual dengan `~/.pi/agent/bin/pi-web -o`.

Untuk memasang hanya untuk projek tertentu (dikongsi dengan pasukan anda melalui `.pi/settings.json`):

```bash
pi install -l npm:@ygncode/pi-web@beta
```

Kemudian mulakan semula pi (atau jalankan `/reload`), dan gunakan `/web`, `/pi-web`, `/remote`, `/refresh`. Urus token akses anda dengan `/pi-web token` dan `/pi-web set-token`.

Jika npm gagal dengan `ENOTEMPTY` semasa menamakan semula `@ygncode/pi-web`, buang direktori sandaran tersembunyi npm yang lapuk dan pasang semula saluran beta:

```bash
rm -rf ~/.pi/agent/npm/node_modules/@ygncode/.pi-web-*
pi install npm:@ygncode/pi-web@beta
```

### Pemasangan pantas (tiada alat binaan diperlukan)

```bash
curl -fsSL https://raw.githubusercontent.com/ygncode/pi-web/main/install.sh | bash
```

Ini memuat turun binari pi-web terkini, memasangnya ke `/usr/local/bin`, dan menyediakan auto-mula semasa log masuk. Tiada Go, Node, atau pi diperlukan.

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

Kemudian alihkannya ke PATH anda:

```bash
cp pi-web ~/.pi/agent/bin/
# atau seluruh sistem:
sudo cp pi-web /usr/local/bin/
```

### Bina dari sumber

```bash
git clone https://github.com/ygncode/pi-web.git
cd pi-web
make build   # membina bundle Vite, kemudian membenamkannya ke dalam binari Go

# pilihan: letakkan pada PATH
cp pi-web ~/.pi/agent/bin/
```

Bundle frontend dibenamkan oleh `web/assets_embed.go`, jadi `go build` memerlukan
`web/dist` wujud terlebih dahulu. `make build` melakukan kedua-dua langkah mengikut urutan; jika anda membina
secara manual, jalankan `npm --prefix web install && npm --prefix web run build` sebelum
`go build ./cmd/pi-web`.

## Nyahpasang

```bash
pi remove npm:@ygncode/pi-web@beta
```

Ini menjalankan skrip `preuninstall` pakej (`bash uninstall.sh`), yang memberhentikan
contoh yang sedang berjalan dan membuang:

- binari pi-web (`~/.pi/agent/bin/pi-web`, atau `/usr/local/bin/pi-web` untuk pemasangan kendiri)
- fail versi (`~/.pi/agent/pi-web-version`)
- fail keadaan masa jalan (`~/.pi/agent/pi-web/pi-web-state.json`)
- konfigurasi auto-mula (plist launchd pada macOS, perkhidmatan systemd pengguna pada Linux)

Data anda dikekalkan supaya pemasangan semula kemudian menyambung dari tempat anda berhenti:
`~/.pi/agent/pi-web.sqlite`, `~/.pi/agent/pi-web-memory.sqlite`, fail sesi
anda di bawah `~/.pi/agent/sessions/`, dan `~/.config/pi-web/env` (termasuk
`PI_WEB_TOKEN`). Buang fail tersebut secara manual jika anda mahu permulaan bersih.

## Penggunaan

```bash
# Mulakan pada port lalai (31415)
pi-web

# Mulakan dan buka pelayar
pi-web -o

# Port tersuai
pi-web -p 8080

# Ganti hos ikatan (loopback tidak disahkan secara lalai)
pi-web --host 127.0.0.1

# Ikatan bukan gelung-balik memerlukan token — pi-web enggan bermula tanpanya
PI_WEB_TOKEN=$(openssl rand -hex 16) pi-web --host 192.168.1.50
```

Secara lalai, pi-web mengikat ke `127.0.0.1`. Jika Tailscale berjalan dengan MagicDNS, pi-web juga menjalankan `tailscale serve --bg --https=<port> http://127.0.0.1:<port>` dan mencetak URL HTTPS tailnet. Sebarang ikatan bukan gelung-balik yang eksplisit memerlukan `PI_WEB_TOKEN` ditetapkan; hantar `--insecure` untuk mengatasi bagi ujian setempat.

## Akses Jauh

Biarkan pi-web mendengar secara setempat, kemudian gunakan URL HTTPS Tailscale yang dicetak dari telefon atau komputer riba anda pada tailnet.

Pada macOS, pasang dan buka Tailscale secara interaktif, luluskan gesaan pentadbir dan log masuk. Kemudian jalankan `/pi-web restart`, diikuti dengan `/remote`.

Pada Linux, benarkan pengguna anda mengurus Tailscale sebelum memasang/menjalankan pi-web, jika tidak `tailscale serve` mungkin memerlukan sudo dan auto-mula boleh gagal:

```bash
sudo tailscale set --operator=$USER
```

```bash
# 1. Mulakan pi-web
pi-web

# 2. Dari mana-mana peranti lain yang disambungkan Tailscale, buka URL
#    "Tailscale HTTPS" yang dicetak.
```

> Secara lalai, pi-web enggan mengikat ke alamat bukan gelung-balik melainkan `PI_WEB_TOKEN` ditetapkan — sesiapa yang boleh mencapai alamat terikat boleh melihat sesi dan menghantar arahan kepada pi. Untuk mengatasi perlindungan ini bagi ujian rangkaian setempat, hantar `--insecure`. **Jangan gunakan `--insecure` pada Tailscale atau mana-mana alamat yang boleh dicapai dari luar mesin anda.**
>
> Klien boleh menghantar token melalui pengepala `Authorization: Bearer <token>`, pengepala `X-Pi-Token`, atau sekali melalui `?token=<token>` (yang menetapkan kuki `pi_token` untuk permintaan seterusnya). Token yang dihantar melalui `?token=` akan berakhir dalam sejarah pelayar, log akses pelayan, dan pengepala `Referer` dari mana-mana pautan pada halaman — lebih suka bentuk pengepala untuk apa-apa selain penanda buku awal.

## Sembang Pelayar

Buka halaman sesi dan gunakan penggubah di bahagian bawah untuk menyambung sesi yang tepat itu.

- `Enter` menghantar, `Shift+Enter` menyisipkan baris baharu
- Seret-dan-lepas atau tampal imej terus ke dalam penggubah
- Pemilih model dan pemilih tahap pemikiran terletak di pengepala — perubahan digunakan kepada pekerja pi asas dengan serta-merta
- Setiap sesi aktif mendapat pekerja `pi --mode rpc` khusus tersendiri, jadi sesi berbeza tidak menyekat satu sama lain

## Berkongsi Sesi

Klik **Kongsi** pada halaman sesi untuk mencipta GitHub Gist rahsia.

Keperluan:
- `gh` dipasang
- `gh auth login` selesai

Perkongsian mengembalikan:
- URL gist rahsia
- URL pratonton di `https://pi.dev/session/#<gistId>`

Gist yang dikongsi adalah syot kilat dan tidak dikemas kini secara langsung.

## Auto-Mula Semasa Log Masuk

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

# Pilihan: tetapkan PI_WEB_TOKEN anda untuk ikatan bukan gelung-balik
# (atau gunakan /pi-web set-token <token> dari dalam pi)
mkdir -p ~/.config/pi-web
echo 'PI_WEB_TOKEN=token-anda-di-sini' > ~/.config/pi-web/env

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
