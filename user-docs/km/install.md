# ការដំឡើង និង ការប្រើប្រាស់

## មុខងារ

### បញ្ជាពីចម្ងាយ

- បន្តសម័យណាមួយពី browser ដោយមានឯកសារភ្ជាប់ជាអត្ថបទ ឬរូបភាព
- ចាប់ផ្ដើមសម័យថ្មីសម្រាប់ផ្លូវគម្រោងណាមួយ ដោយផ្ទាល់ពី web UI
- ការប្ដូរ model ក្នុង browser និង selector កម្រិតការគិត (thinking-level) ក្នុងមួយសម័យ
- ស្ថានភាព worker ក្នុងមួយសម័យ (ទំនេរ / កំពុងដំណើរការ / មានកំហុស) ជាមួយការស្ដារឡើងវិញដោយស្វ័យប្រវត្តិពេលគាំង
- សម័យច្រើនដំណើរការស្របគ្នា — ចាប់ផ្ដើមការងារក្នុងមួយ មើល stream ក្នុងមួយទៀត
- `PI_WEB_TOKEN` សម្រាប់ការបញ្ចេញទៅ LAN ដោយសុវត្ថិភាព — តម្រូវតាមលំនាំដើមសម្រាប់ការ bind ដែលមិនមែន loopback ណាមួយ

### ការអានសម័យ

- រកមើលសម័យឆ្លងគម្រោងដោយមានតម្រង ការស្វែងរក និងការរុករក branch ពេញលេញ
- បច្ចុប្បន្នភាពបន្តិចម្ដងៗផ្ទាល់នៅពេល pi កំពុងដំណើរការ (តាមរយៈ fsnotify; latency ~ms)
- របៀប Follow សម្រាប់តាមដានសម័យដែលកំពុងសកម្ម
- Deep link ទៅកាន់សារនីមួយៗ
- ទាញយកសម័យជា JSONL
- ចែករំលែក snapshot ឋិតិវន្តជា GitHub Gist សម្ងាត់
- ផ្នែកបន្ថែម pi `/web`, `/remote`, `/refresh`, `/pi-web token` និង `/pi-web set-token` សម្រាប់បើកសម័យ, QR ពីចម្ងាយ, ធ្វើសមកាលកម្មសម័យ និងគ្រប់គ្រង token

## តម្រូវការ

- [Go](https://go.dev) 1.25+
- `pi` នៅលើ `PATH` របស់អ្នកសម្រាប់ការជជែកក្នុង browser និងការប្ដូរ model
- ជម្រើស: `gh` សម្រាប់ការចែករំលែក

## ការដំឡើង

### Pi package (ណែនាំ)

```bash
pi install npm:@ygncode/pi-web@beta
```

ពាក្យបញ្ជាតែមួយនេះ:
- ដំឡើង npm pi package ក្រោមថត package របស់ pi
- ដំណើរការ script `postinstall` របស់ package (`bash install.sh`)
- ទាញយក pi-web binary ដែលត្រូវនឹងកំណែ package និង platform របស់អ្នកពី GitHub Releases
- ដំឡើងវាទៅ `~/.pi/agent/bin/pi-web`
- រៀបចំ auto-start ពេល login (launchd នៅលើ macOS, systemd នៅលើ Linux)
- ចុះឈ្មោះពាក្យបញ្ជា pi `/web`, `/remote`, `/refresh`, `/pi-web token` និង `/pi-web set-token`

ការដាក់ចំណងជើងសម័យដោយស្វ័យប្រវត្តិត្រូវបានបង្កប់ក្នុង pi-web (មិនមែននៅក្នុងផ្នែកបន្ថែម) និងកំណត់រចនាសម្ព័ន្ធនៅលើទំព័រ `/settings`។ វាបើកតាមលំនាំដើម: pi-web ដាក់ឈ្មោះសម័យដោយស្វ័យប្រវត្តិដោយប្រើ heuristic ពាក្យឥតគិតថ្លៃដែលមានស្រាប់ (មិនប្រើ AI) ដោយដាក់ចំណងជើងឡើងវិញរាល់សារថ្មី។ អ្នកអាចប្ដូរទៅការដាក់ចំណងជើងម្ដងក្នុងមួយសម័យ និង/ឬ ជ្រើសរើស model ដើម្បីសរសេរចំណងជើងឆ្លាតជាងជំនួស heuristic។

នៅលើ Linux, auto-start ត្រូវបានកំណត់រចនាសម្ព័ន្ធជា systemd user service នៅ `~/.config/systemd/user/pi-web.service`។ កម្មវិធីដំឡើងសរសេរឡើងវិញ `ExecStart` របស់វាទៅផ្លូវ binary ដែលបានដំឡើងពិតប្រាកដ។ ប្រសិនបើ Tailscale មាននៅពេល runtime, pi-web បោះពុម្ពម៉ាស៊ីនមេ localhost ជាមួយ Tailscale Serve HTTPS។ ប្រសិនបើ systemd user មិនអាចប្រើបាន, ដំណើរការវាដោយដៃជាមួយ `~/.pi/agent/bin/pi-web -o`។

ដើម្បីដំឡើងសម្រាប់តែគម្រោងជាក់លាក់ (ចែករំលែកជាមួយក្រុមរបស់អ្នកតាមរយៈ `.pi/settings.json`):

```bash
pi install -l npm:@ygncode/pi-web@beta
```

បន្ទាប់មកចាប់ផ្ដើម pi ឡើងវិញ (ឬដំណើរការ `/reload`) ហើយប្រើ `/web`, `/pi-web`, `/remote`, `/refresh`។ គ្រប់គ្រង access token របស់អ្នកជាមួយ `/pi-web token` និង `/pi-web set-token`។

ប្រសិនបើ npm បរាជ័យជាមួយ `ENOTEMPTY` ពេលកំពុងប្ដូរឈ្មោះ `@ygncode/pi-web` សូមលុបថតបម្រុងទុកដែលលាក់ដែលហួសសម័យរបស់ npm ហើយដំឡើង beta channel ឡើងវិញ:

```bash
rm -rf ~/.pi/agent/npm/node_modules/@ygncode/.pi-web-*
pi install npm:@ygncode/pi-web@beta
```

### ការដំឡើងរហ័ស (មិនត្រូវការឧបករណ៍ build)

```bash
curl -fsSL https://raw.githubusercontent.com/ygncode/pi-web/main/install.sh | bash
```

វាទាញយក pi-web binary ចុងក្រោយបំផុត ដំឡើងវាទៅ `/usr/local/bin` និងរៀបចំ auto-start ពេល login។ មិនត្រូវការ Go, Node ឬ pi ទេ។

### ទាញយក binary

Binary ដែលបាន build រួចត្រូវបានភ្ជាប់ជាមួយ [GitHub Release](https://github.com/ygncode/pi-web/releases) នីមួយៗ។

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

បន្ទាប់មកផ្លាស់ទីវាទៅ PATH របស់អ្នក:

```bash
cp pi-web ~/.pi/agent/bin/
# ឬទូទាំងប្រព័ន្ធ:
sudo cp pi-web /usr/local/bin/
```

### Build ពី source

```bash
git clone https://github.com/ygncode/pi-web.git
cd pi-web
make build   # build Vite bundle បន្ទាប់មកបង្កប់វាទៅក្នុង Go binary

# ជម្រើស: ដាក់វានៅលើ PATH
cp pi-web ~/.pi/agent/bin/
```

frontend bundle ត្រូវបានបង្កប់ដោយ `web/assets_embed.go` ដូច្នេះ `go build` ត្រូវការ
`web/dist` ឱ្យមានជាមុនសិន។ `make build` ធ្វើជំហានទាំងពីរតាមលំដាប់; ប្រសិនបើអ្នក build
ដោយដៃ សូមដំណើរការ `npm --prefix web install && npm --prefix web run build` មុន
`go build ./cmd/pi-web`។

## ការលុបចេញ

```bash
pi remove npm:@ygncode/pi-web@beta
```

វាដំណើរការ script `preuninstall` របស់ package (`bash uninstall.sh`) ដែលបញ្ឈប់
instance ដែលកំពុងដំណើរការ និងលុប:

- pi-web binary (`~/.pi/agent/bin/pi-web` ឬ `/usr/local/bin/pi-web` សម្រាប់ការដំឡើង standalone)
- ឯកសារកំណែ (`~/.pi/agent/pi-web-version`)
- ឯកសារស្ថានភាព runtime (`~/.pi/agent/pi-web/pi-web-state.json`)
- ការកំណត់រចនាសម្ព័ន្ធ auto-start (launchd plist នៅលើ macOS, systemd user service នៅលើ Linux)

ទិន្នន័យរបស់អ្នកត្រូវបានរក្សាទុក ដូច្នេះការដំឡើងឡើងវិញនៅពេលក្រោយនឹងបន្តពីកន្លែងដែលអ្នកបានឈប់:
`~/.pi/agent/pi-web.sqlite`, `~/.pi/agent/pi-web-memory.sqlite`, ឯកសារសម័យរបស់អ្នក
នៅក្រោម `~/.pi/agent/sessions/` និង `~/.config/pi-web/env` (រួមទាំង
`PI_WEB_TOKEN`)។ លុបឯកសារទាំងនោះដោយដៃ ប្រសិនបើអ្នកចង់ចាប់ផ្ដើមពីដំបូង។

## ការប្រើប្រាស់

```bash
# ចាប់ផ្ដើមនៅលើ port លំនាំដើម (31415)
pi-web

# ចាប់ផ្ដើមនិងបើក browser
pi-web -o

# port ផ្ទាល់ខ្លួន
pi-web -p 8080

# បដិសេធ bind host (loopback មិនតម្រូវឱ្យមានការផ្ទៀងផ្ទាត់តាមលំនាំដើម)
pi-web --host 127.0.0.1

# ការ bind មិនមែន loopback តម្រូវឱ្យមាន token — pi-web នឹងបដិសេធមិនចាប់ផ្ដើមបើមិនដូច្នេះទេ
PI_WEB_TOKEN=$(openssl rand -hex 16) pi-web --host 192.168.1.50
```

តាមលំនាំដើម pi-web bind ទៅ `127.0.0.1`។ ប្រសិនបើ Tailscale កំពុងដំណើរការជាមួយ MagicDNS, pi-web ក៏ដំណើរការ `tailscale serve --bg --https=<port> http://127.0.0.1:<port>` និងបង្ហាញ HTTPS tailnet URL។ ការ bind មិនមែន loopback ណាមួយដែលបានបញ្ជាក់ច្បាស់តម្រូវឱ្យកំណត់ `PI_WEB_TOKEN`; ប្រើ `--insecure` ដើម្បីបដិសេធសម្រាប់ការសាកល្បងក្នុង local។

## ការចូលប្រើពីចម្ងាយ

ទុកឱ្យ pi-web ស្ដាប់នៅក្នុង local បន្ទាប់មកប្រើ Tailscale HTTPS URL ដែលបានបង្ហាញពីទូរសព្ទ ឬកុំព្យូទ័រយួរដៃរបស់អ្នកនៅលើ tailnet។

នៅលើ Linux អនុញ្ញាតឱ្យ user របស់អ្នកគ្រប់គ្រង Tailscale មុនពេលដំឡើង/ដំណើរការ pi-web បើមិនដូច្នេះទេ `tailscale serve` អាចត្រូវការ sudo ហើយ auto-start អាចបរាជ័យ:

```bash
sudo tailscale set --operator=$USER
```

```bash
# 1. ចាប់ផ្ដើម pi-web
pi-web

# 2. ពីឧបករណ៍ផ្សេងទៀតដែលភ្ជាប់ Tailscale បើក
#    "Tailscale HTTPS" URL ដែលបានបង្ហាញ។
```

> តាមលំនាំដើម pi-web បដិសេធមិន bind ទៅអាសយដ្ឋានមិនមែន loopback លុះត្រាតែ `PI_WEB_TOKEN` ត្រូវបានកំណត់ — អ្នកណាដែលអាចទៅដល់អាសយដ្ឋានដែលបាន bind អាចមើលសម័យ និងផ្ញើការណែនាំទៅកាន់ pi។ ដើម្បីបដិសេធការការពារនេះសម្រាប់ការសាកល្បងបណ្តាញក្នុង local សូមប្រើ `--insecure`។ **កុំប្រើ `--insecure` នៅលើ Tailscale ឬអាសយដ្ឋានណាដែលអាចទៅដល់ពីខាងក្រៅម៉ាស៊ីនរបស់អ្នក។**
>
> Clients អាចផ្ញើ token តាមរយៈ header `Authorization: Bearer <token>`, header `X-Pi-Token` ឬម្ដងតាមរយៈ `?token=<token>` (ដែលកំណត់ cookie `pi_token` សម្រាប់សំណើបន្តបន្ទាប់)។ Token ដែលផ្ញើតាម `?token=` នឹងបញ្ចប់នៅក្នុង browser history, server access logs និង `Referer` headers ពី link ណាមួយនៅលើទំព័រ — សូមប្រើទម្រង់ header សម្រាប់អ្វីក្រៅពី bookmark ដំបូង។

## ការជជែកក្នុង Browser

បើកទំព័រសម័យមួយ ហើយប្រើ composer នៅខាងក្រោមដើម្បីបន្តសម័យនោះយ៉ាងពិតប្រាកដ។

- `Enter` ផ្ញើ, `Shift+Enter` បញ្ចូលបន្ទាត់ថ្មី
- អូសហើយទម្លាក់ ឬបិទភ្ជាប់រូបភាពដោយផ្ទាល់ទៅក្នុង composer
- model picker និង thinking-level selector ស្ថិតនៅក្នុង header — ការផ្លាស់ប្ដូរអនុវត្តទៅលើ pi worker ភ្លាមៗ
- សម័យសកម្មនីមួយៗទទួលបាន `pi --mode rpc` worker ផ្ទាល់ខ្លួន ដូច្នេះសម័យផ្សេងៗមិនរារាំងគ្នាទេ

## ការចែករំលែកសម័យ

ចុច **Share** នៅលើទំព័រសម័យដើម្បីបង្កើត GitHub Gist សម្ងាត់។

តម្រូវការ:
- `gh` បានដំឡើង
- `gh auth login` បានបញ្ចប់

ការចែករំលែកត្រឡប់មកវិញ:
- secret gist URL
- preview URL នៅ `https://pi.dev/session/#<gistId>`

gist ដែលបានចែករំលែកគឺជា snapshot ហើយមិនធ្វើបច្ចុប្បន្នភាពផ្ទាល់ទេ។

## Auto-Start ពេល Login

### macOS

```bash
cp init/com.pi-web.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.pi-web.plist
```

### Linux (systemd)

```bash
# ដំឡើង systemd user service
mkdir -p ~/.config/systemd/user
cp init/pi-web.service ~/.config/systemd/user/

# ជម្រើស: កំណត់ PI_WEB_TOKEN របស់អ្នកសម្រាប់ការ bind មិនមែន loopback
# (ឬប្រើ /pi-web set-token <token> ពីក្នុង pi)
mkdir -p ~/.config/pi-web
echo 'PI_WEB_TOKEN=your-token-here' > ~/.config/pi-web/env

# បើកនិងចាប់ផ្ដើម
systemctl --user daemon-reload
systemctl --user enable --now pi-web.service

# ពិនិត្យស្ថានភាព
systemctl --user status pi-web.service

# មើល logs
journalctl --user -u pi-web.service -f
```

> ដើម្បីឱ្យ service ចាប់ផ្ដើមនៅពេល boot (មុន login) សូមប្រើ system service ជំនួសវិញ:
> ចម្លង `init/pi-web.service` ទៅ `/etc/systemd/system/` ហើយប្រើ `sudo systemctl`។
