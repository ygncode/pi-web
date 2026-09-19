# ការដំឡើង និង ការប្រើប្រាស់

## មុខងារ

### ការគ្រប់គ្រងពីចម្ងាយ

- បន្តវគ្គណាមួយពីកម្មវិធីរុករកដោយប្រើឯកសារភ្ជាប់ជាអត្ថបទ ឬរូបភាព
- ចាប់ផ្តើមវគ្គថ្មីស្រឡាងលើផ្លូវគម្រោងណាមួយ ដោយផ្ទាល់ពី UI បណ្តាញ
- ការប្តូរម៉ូដែល និងកម្រិតនៃការគិតក្នុងកម្មវិធីរុករក សម្រាប់វគ្គនីមួយៗ
- ស្ថានភាព worker ក្នុងមួយវគ្គ (idle / running / error) ជាមួយការស្តារឡើងវិញដោយស្វ័យប្រវត្តិពេលគាំង
- វគ្គច្រើនដំណើរការស្របគ្នា — ចាប់ផ្តើមការងារក្នុងមួយ និងមើលការផ្សាយរបស់មួយទៀត
- `PI_WEB_TOKEN` សម្រាប់ការបញ្ចេញទៅ LAN ដោយសុវត្ថិភាព — តម្រូវតាមលំនាំដើមសម្រាប់ការចងដែលមិនមែន loopback ដោយច្បាស់លាស់

### ការអានវគ្គ

- រកមើលវគ្គនានាក្នុងគម្រោងទាំងអស់ដោយមានតម្រង ការស្វែងរក និងការរុករកសាខាពេញលេញ
- ការធ្វើបច្ចុប្បន្នភាពបន្ថែមផ្ទាល់ ខណៈដែល pi នៅតែដំណើរការ (តាមរយៈ fsnotify; ភាពយឺត ~ms)
- របៀប Follow សម្រាប់តាមដានវគ្គសកម្ម
- តំណជ្រៅទៅកាន់សារនីមួយៗ
- ទាញយកវគ្គជាទម្រង់ JSONL
- ចែករំលែក snapshot ឋិតិវន្តជា GitHub Gists សម្ងាត់
- `/web`, `/remote`, `/refresh`, `/pi-web token` និង `/pi-web set-token` pi extensions សម្រាប់បើកវគ្គ, QR ពីចម្ងាយ, ការធ្វើសមកាលកម្មវគ្គ និងការគ្រប់គ្រង token
- `/skill:pi-web-schedule`, `/skill:pi-web-notes`, `/skill:pi-web-settings` (`pi-web-ctl`) ដើម្បីឱ្យវគ្គអាចគ្រប់គ្រងកាលវិភាគ, ក្រដាសកត់ត្រាគម្រោង និងការកំណត់ជាភាសាធម្មជាតិ

## តម្រូវការ

- [Go](https://go.dev) 1.25+ (សម្រាប់តែការបង្កើតពីកូដដើមប៉ុណ្ណោះ)
- `pi` នៅលើ `PATH` របស់អ្នកសម្រាប់ការជជែកក្នុងកម្មវិធីរុករក/ការប្តូរម៉ូដែល
- ស្រេចចិត្ត៖ `gh` សម្រាប់ការចែករំលែក
- នៅលើ Windows: pi ត្រូវការ bash shell សម្រាប់ឧបករណ៍ shell របស់វា — [Git for Windows](https://git-scm.com/download/win) គឺគ្រប់គ្រាន់ (សូមមើលឯកសារ Windows របស់ pi)

## ការដំឡើង

### កញ្ចប់ Pi (បានណែនាំ)

```bash
pi install npm:@ygncode/pi-web@beta
```

ពាក្យបញ្ជាតែមួយនេះ៖
- ដំឡើងកញ្ចប់ npm pi នៅក្រោមថតកញ្ចប់របស់ pi
- ដំណើរការស្គ្រីប `postinstall` របស់កញ្ចប់ (`install.sh` ឬ `install.ps1` នៅលើ Windows)
- ទាញយក pi-web binary ដែលត្រូវគ្នាសម្រាប់កំណែកញ្ចប់ និងវេទិការបស់អ្នកពី GitHub Releases
- ដំឡើងវាទៅ `~/.pi/agent/bin/pi-web` (`pi-web.exe` នៅលើ Windows)
- រៀបចំការចាប់ផ្តើមដោយស្វ័យប្រវត្តិពេលចូលប្រើ (launchd នៅលើ macOS, systemd នៅលើ Linux, កម្មវិធីចាប់ផ្តើម Run-key នៅលើ Windows)
- ចុះឈ្មោះពាក្យបញ្ជា pi `/web`, `/remote`, `/refresh`, `/pi-web token` និង `/pi-web set-token`

ការដាក់ចំណងជើងវគ្គដោយស្វ័យប្រវត្តិត្រូវបានភ្ជាប់មកជាមួយ pi-web (មិនមែនជាផ្នែកបន្ថែម) ហើយត្រូវបានកំណត់រចនាសម្ព័ន្ធនៅលើទំព័រ `/settings`។ វាបើកតាមលំនាំដើម៖ pi-web ដាក់ឈ្មោះវគ្គដោយស្វ័យប្រវត្តិដោយប្រើ heuristic ពាក្យដែលភ្ជាប់មកជាមួយដោយឥតគិតថ្លៃ (គ្មាន AI) ដោយដាក់ចំណងជើងឡើងវិញលើសារថ្មីនីមួយៗ។ អ្នកអាចប្តូរទៅការដាក់ចំណងជើងម្តងក្នុងមួយវគ្គ និង/ឬជ្រើសរើសម៉ូដែលដើម្បីសរសេរចំណងជើងឆ្លាតជាងជំនួស heuristic។

នៅលើ Linux ការចាប់ផ្តើមដោយស្វ័យប្រវត្តិត្រូវបានកំណត់រចនាសម្ព័ន្ធជាសេវាកម្ម systemd របស់អ្នកប្រើនៅ `~/.config/systemd/user/pi-web.service`។ កម្មវិធីដំឡើងសរសេរ `ExecStart` របស់វាឡើងវិញទៅផ្លូវ binary ដែលបានដំឡើងពិតប្រាកដ។ ប្រសិនបើ Tailscale មាននៅពេលដំណើរការ pi-web បោះពុម្ពម៉ាស៊ីនបម្រើ localhost ជាមួយ Tailscale Serve HTTPS។ ប្រសិនបើ systemd របស់អ្នកប្រើមិនមានទេ ដំណើរការវាដោយដៃជាមួយ `~/.pi/agent/bin/pi-web -o`។

ដើម្បីដំឡើងសម្រាប់តែគម្រោងជាក់លាក់មួយប៉ុណ្ណោះ (ចែករំលែកជាមួយក្រុមរបស់អ្នកតាមរយៈ `.pi/settings.json`)៖

```bash
pi install -l npm:@ygncode/pi-web@beta
```

បន្ទាប់មកចាប់ផ្តើម pi ឡើងវិញ (ឬដំណើរការ `/reload`) ហើយប្រើ `/web`, `/pi-web`, `/remote`, `/refresh`។ គ្រប់គ្រង access token របស់អ្នកជាមួយ `/pi-web token` និង `/pi-web set-token`។

ប្រសិនបើ npm បោះបង់ដោយ `ENOTEMPTY` ខណៈកំពុងប្តូរឈ្មោះ `@ygncode/pi-web` សូមលុបថតបម្រុងទុកដែលលាក់ និងចាស់របស់ npm ចេញ ហើយដំឡើង beta channel ឡើងវិញ៖

```bash
rm -rf ~/.pi/agent/npm/node_modules/@ygncode/.pi-web-*
pi install npm:@ygncode/pi-web@beta
```

### ការដំឡើងរហ័ស (មិនត្រូវការឧបករណ៍បង្កើត)

macOS / Linux៖

```bash
curl -fsSL https://raw.githubusercontent.com/ygncode/pi-web/main/install.sh | bash
```

Windows (PowerShell)៖

```powershell
irm https://raw.githubusercontent.com/ygncode/pi-web/main/install.ps1 | iex
```

វាទាញយក pi-web binary ចុងក្រោយបំផុត ដំឡើងវាទៅ `/usr/local/bin` (`~/.pi/agent/bin` នៅលើ Windows) និងរៀបចំការចាប់ផ្តើមដោយស្វ័យប្រវត្តិពេលចូលប្រើ។ មិនត្រូវការ Go, Node ឬ pi ទេ។

### ការទាញយក binary

binary ដែលបានបង្កើតជាមុនត្រូវបានភ្ជាប់ជាមួយ [GitHub Release](https://github.com/ygncode/pi-web/releases) នីមួយៗ។

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

បន្ទាប់មកផ្លាស់ទីវាទៅ PATH របស់អ្នក៖

```bash
cp pi-web ~/.pi/agent/bin/
# or system-wide:
sudo cp pi-web /usr/local/bin/
```

### ការបង្កើតពីកូដដើម

```bash
git clone https://github.com/ygncode/pi-web.git
cd pi-web
make build   # builds the Vite bundle, then embeds it into the Go binary

# optional: put it on PATH
cp pi-web ~/.pi/agent/bin/
```

កញ្ចប់ frontend ត្រូវបានបង្កប់ដោយ `web/assets_embed.go` ដូច្នេះ `go build` ត្រូវការឱ្យ `web/dist` មានជាមុនសិន។ `make build` ធ្វើជំហានទាំងពីរតាមលំដាប់។ ប្រសិនបើអ្នកបង្កើតដោយដៃ សូមដំណើរការ `npm --prefix web install && npm --prefix web run build` មុន `go build ./cmd/pi-web`។

### ការអភិវឌ្ឍន៍រួមជាមួយ instance ដែលបានដំឡើង

ទុក instance ដែលបានដំឡើងឱ្យដំណើរការនៅលើច្រក `31415` បន្ទាប់មកចាប់ផ្តើមការពិនិត្យកូដដើមក្នុងរបៀបអភិវឌ្ឍន៍៖

```bash
make dev
```

បើក `http://127.0.0.1:31416`។ `make dev` កំណត់បរិយាកាសអភិវឌ្ឍន៍ផ្ទៃក្នុង `PI_WEB_DEV=1` ដូច្នេះការពិនិត្យកូដដើមចែករំលែកវគ្គ ការកំណត់ និងទិន្នន័យ SQLite ជាមួយ instance ដែលបានដំឡើង ខណៈរក្សា runtime lock និងឯកសារស្ថានភាពអភិវឌ្ឍន៍ដាច់ដោយឡែក។ instance ដែលបានដំឡើងធម្មតា និងដែលបានចាប់ផ្តើមដោយដៃមិនផ្លាស់ប្តូរទេ ហើយរក្សាឥរិយាបថ single-instance ដើម។

ដើម្បីទប់ស្កាត់ការងារស្វ័យភាពស្ទួន របៀបអភិវឌ្ឍន៍មិនដំណើរការ schedule loop, chat-queue drainer, auto-titling ឬ push notifications ទេ។ សំណើផ្ទាល់ដែលធ្វើតាមរយៈ UI អភិវឌ្ឍន៍នៅតែដំណើរការ។ កុំបើកវគ្គជជែកដូចគ្នាពី instance ទាំងពីរក្នុងពេលតែមួយ។ ដំណើរការនីមួយៗមាន RPC worker manager ផ្ទាល់ខ្លួន។

`make dev` ត្រូវការ [Air](https://github.com/air-verse/air) សម្រាប់ការផ្ទុកឡើងវិញក្តៅរបស់ Go៖

```bash
go install github.com/air-verse/air@latest
```

`PI_WEB_DEV` គឺជាប្រព័ន្ធបំពង់ harness អភិវឌ្ឍន៍ មិនមែនជារបៀប multi-instance ផលិតកម្មដែលគាំទ្រទេ។

## ការដកចេញ

```bash
pi remove npm:@ygncode/pi-web@beta
```

វាដំណើរការស្គ្រីប `preuninstall` របស់កញ្ចប់ (`uninstall.sh` ឬ `uninstall.ps1` នៅលើ Windows) ដែលបញ្ឈប់ instance ដែលកំពុងដំណើរការ និងលុបចេញនូវ៖

- pi-web binary (`~/.pi/agent/bin/pi-web` ឬ `/usr/local/bin/pi-web` សម្រាប់ការដំឡើង standalone)
- ឯកសារកំណែ (`~/.pi/agent/pi-web-version`)
- ឯកសារស្ថានភាព runtime (`~/.pi/agent/pi-web/pi-web-state.json`)
- ការកំណត់រចនាសម្ព័ន្ធចាប់ផ្តើមដោយស្វ័យប្រវត្តិ (launchd plist នៅលើ macOS, systemd user service នៅលើ Linux, Run-key entry + launcher scripts នៅលើ Windows)

ទិន្នន័យរបស់អ្នកត្រូវបានរក្សាទុក ដូច្នេះការដំឡើងឡើងវិញនៅពេលក្រោយនឹងបន្តពីកន្លែងដែលអ្នកបានឈប់៖ `~/.pi/agent/pi-web.sqlite`, `~/.pi/agent/pi-web-memory.sqlite`, ឯកសារវគ្គរបស់អ្នកនៅក្រោម `~/.pi/agent/sessions/` និង `~/.config/pi-web/env` (រួមទាំង `PI_WEB_TOKEN`)។ លុបឯកសារទាំងនោះដោយដៃ ប្រសិនបើអ្នកចង់បានការចាប់ផ្តើមស្អាត។

## ការប្រើប្រាស់

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

តាមលំនាំដើម pi-web ចងទៅ `127.0.0.1`។ ប្រសិនបើ Tailscale កំពុងដំណើរការជាមួយ MagicDNS **ហើយ `PI_WEB_TOKEN` ត្រូវបានកំណត់** pi-web ក៏ដំណើរការ `tailscale serve --bg --https=<port> http://127.0.0.1:<port>` និងបោះពុម្ព URL tailnet HTTPS។ បើគ្មាន token ទេ pi-web នៅតែ loopback ប៉ុណ្ណោះ ហើយរំលង Tailscale Serve ដូច្នេះ peers ក្នុង tailnet មិនអាចទៅដល់ agent ដោយគ្មានការផ្ទៀងផ្ទាត់ទេ។ ការចងដែលមិនមែន loopback ដោយច្បាស់លាស់ណាមួយក៏តម្រូវឱ្យកំណត់ `PI_WEB_TOKEN` ផងដែរ។ បញ្ជូន `--insecure` ដើម្បីបដិសេធសម្រាប់ការសាកល្បងក្នុងស្រុក។

## ការចូលប្រើពីចម្ងាយ

ទុក pi-web ឱ្យស្តាប់ក្នុងស្រុក បន្ទាប់មកប្រើ URL Tailscale HTTPS ដែលបានបោះពុម្ពពីទូរស័ព្ទ ឬកុំព្យូទ័រយួរដៃរបស់អ្នកនៅលើ tailnet។

នៅលើ macOS ដំឡើង និងបើក Tailscale ដោយអន្តរកម្ម អនុម័តប្រអប់ administrator ហើយចូល។ បន្ទាប់មកដំណើរការ `/pi-web restart` បន្ទាប់មក `/remote`។

នៅលើ Linux អនុញ្ញាតឱ្យអ្នកប្រើរបស់អ្នកគ្រប់គ្រង Tailscale មុនពេលដំឡើង/ដំណើរការ pi-web បើមិនដូច្នេះទេ `tailscale serve` អាចតម្រូវឱ្យប្រើ sudo ហើយការចាប់ផ្តើមដោយស្វ័យប្រវត្តិអាចបរាជ័យ៖

```bash
sudo tailscale set --operator=$USER
```

```bash
# 1. Start pi-web with a token so it publishes the Tailscale HTTPS endpoint
PI_WEB_TOKEN=$(openssl rand -hex 16) pi-web

# 2. From any other Tailscale-connected device, open the printed
#    "Tailscale HTTPS" URL and enter the token once.
```

> តាមលំនាំដើម pi-web បដិសេធមិនចងទៅអាសយដ្ឋានដែលមិនមែន loopback លុះត្រាតែ `PI_WEB_TOKEN` ត្រូវបានកំណត់ — អ្នកណាដែលអាចទៅដល់អាសយដ្ឋានដែលបានចងអាចមើលវគ្គ និងផ្ញើការណែនាំទៅ pi បាន។ ដើម្បីបដិសេធរបាំងនេះសម្រាប់ការសាកល្បងបណ្តាញក្នុងស្រុក បញ្ជូន `--insecure`។ **កុំប្រើ `--insecure` នៅលើ Tailscale ឬអាសយដ្ឋានណាមួយដែលអាចទៅដល់ពីក្រៅម៉ាស៊ីនរបស់អ្នក។**
>
> កម្មវិធីភ្ជាប់ (clients) អាចបញ្ជូន token តាមរយៈ header `Authorization: Bearer <token>`, header `X-Pi-Token` ឬម្តងតាមរយៈ `?token=<token>` (ឬប្រអប់ចូល)។ នៅពេល token មកដល់តាមរយៈ query string pi-web កំណត់ cookie `pi_token` ហើយបញ្ជូនបន្តទៅ URL ដដែលដោយដក token ចេញ ដូច្នេះវាមិននៅសេសសល់ក្នុងរបារអាសយដ្ឋាន ឬប្រវត្តិកម្មវិធីរុករកទេ។ ចូលចិត្តប្រើទម្រង់ header សម្រាប់ scripts និង automation។

## ការជជែកក្នុងកម្មវិធីរុករក

បើកទំព័រវគ្គ ហើយប្រើ composer នៅខាងក្រោមដើម្បីបន្តវគ្គនោះយ៉ាងពិតប្រាកដ។

- `Enter` ផ្ញើ, `Shift+Enter` បញ្ចូលបន្ទាត់ថ្មី
- អូស-ទម្លាក់ ឬបិទភ្ជាប់រូបភាពដោយផ្ទាល់ទៅក្នុង composer
- កម្មវិធីជ្រើសរើសម៉ូដែល និងកម្រិតនៃការគិតស្ថិតនៅក្នុង header — ការផ្លាស់ប្តូរអនុវត្តទៅលើ pi worker ភ្លាមៗ
- វគ្គសកម្មនីមួយៗទទួលបាន worker `pi --mode rpc` ផ្ទាល់ខ្លួន ដូច្នេះវគ្គផ្សេងៗមិនរារាំងគ្នាទេ

## ការចែករំលែកវគ្គ

ចុច **ចែករំលែក** នៅលើទំព័រវគ្គដើម្បីបង្កើត GitHub Gist សម្ងាត់។

តម្រូវការ៖
- `gh` ត្រូវបានដំឡើង
- `gh auth login` បានបញ្ចប់

ការចែករំលែកត្រឡប់មកវិញ៖
- URL gist សម្ងាត់
- URL មើលជាមុននៅ `https://pi.dev/session/#<gistId>`

gist ដែលបានចែករំលែកគឺជា snapshot ហើយមិនធ្វើបច្ចុប្បន្នភាពផ្ទាល់ទេ។

## ការចាប់ផ្តើមដោយស្វ័យប្រវត្តិពេលចូលប្រើ

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

> ដើម្បីឱ្យសេវាកម្មចាប់ផ្តើមនៅពេល boot (មុនពេលចូលប្រើ) ប្រើ system service ជំនួសវិញ៖ ចម្លង `init/pi-web.service` ទៅ `/etc/systemd/system/` ហើយប្រើ `sudo systemctl`។

### Windows

កម្មវិធីដំឡើងកំណត់រចនាសម្ព័ន្ធនេះដោយស្វ័យប្រវត្តិ ដោយមិនត្រូវការសិទ្ធិ admin៖ ធាតុ `pi-web` នៅក្រោម `HKCU\Software\Microsoft\Windows\CurrentVersion\Run` ចាប់ផ្តើម `~/.config/pi-web/pi-web-start.vbs` នៅពេលចូលប្រើ ដែលចាប់ផ្តើម binary ដោយលាក់ (គ្មានបង្អួច console) បន្ទាប់ពីផ្ទុក `~/.config/pi-web/env` (`PI_WEB_TOKEN`, `PATH`, ...)។

ដើម្បីគ្រប់គ្រងវាដោយដៃ៖

```powershell
# Start / stop
wscript.exe "$HOME\.config\pi-web\pi-web-start.vbs"
taskkill /IM pi-web.exe /F

# Remove auto-start
Remove-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run' -Name 'pi-web'
```

មិនមានការត្រួតពិនិត្យសេវាកម្មនៅលើ Windows ទេ៖ ប្រសិនបើ pi-web គាំង វានៅតែបិទរហូតដល់ការចូលប្រើលើកក្រោយ (launchd/systemd ចាប់ផ្តើមវាឡើងវិញដោយស្វ័យប្រវត្តិនៅលើវេទិកាផ្សេងទៀត)។
