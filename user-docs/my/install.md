# တပ်ဆင်ခြင်းနှင့် အသုံးပြုခြင်း

## အင်္ဂါရပ်များ

### အဝေးမှ ထိန်းချုပ်ခြင်း

- စာသား သို့မဟုတ် ပုံ ပူးတွဲဖိုင်များဖြင့် မည်သည့် session ကိုမဆို browser မှ ဆက်လက်လုပ်ဆောင်နိုင်သည်
- မည်သည့် project path တွင်မဆို web UI မှတစ်ဆင့် session အသစ် စတင်နိုင်သည်
- session တစ်ခုချင်းစီအတွက် browser အတွင်း model ပြောင်းလဲခြင်းနှင့် thinking-level ရွေးချယ်နိုင်မှု
- session တစ်ခုချင်းစီ၏ worker အခြေအနေ (idle / running / error) နှင့် crash ဖြစ်ပါက အလိုအလျောက် ပြန်လည်လည်ပတ်နိုင်မှု
- session အများအပြားကို တပြိုင်နက်တည်း လုပ်ဆောင်နိုင်သည် — တစ်ခုတွင် အလုပ်စတင်ပြီး အခြားတစ်ခုတွင် stream ကြည့်ရှုနိုင်သည်
- ဘေးကင်းသော LAN ဖော်ထုတ်မှုအတွက် `PI_WEB_TOKEN` — မည်သည့် explicit non-loopback bind အတွက်မဆို ပုံမှန်အားဖြင့် လိုအပ်သည်

### Session များ ဖတ်ရှုခြင်း

- filters၊ search နှင့် branch navigation အပြည့်အစုံဖြင့် project များတစ်လျှောက် session များကို ကြည့်ရှုနိုင်သည်
- pi လည်ပတ်နေစဉ် live အဆင့်ဆင့် update များ (fsnotify မှတစ်ဆင့်; ~ms latency)
- လည်ပတ်နေသော session များကို tail လိုက်ရန် follow mode
- message တစ်ခုချင်းစီသို့ deep link များ
- session တစ်ခုကို JSONL အဖြစ် ဒေါင်းလုဒ်လုပ်နိုင်သည်
- static snapshot များကို secret GitHub Gist အဖြစ် မျှဝေနိုင်သည်
- session များဖွင့်ရန်၊ remote QR၊ session sync နှင့် token စီမံခန့်ခွဲရန်အတွက် `/web`, `/remote`, `/refresh`, `/pi-web token` နှင့် `/pi-web set-token` pi extensions များ
- session တစ်ခုမှ schedules၊ project scratchpad နှင့် settings များကို သဘာဝဘာသာစကားဖြင့် စီမံခန့်ခွဲနိုင်ရန် `/skill:pi-web-schedule`, `/skill:pi-web-notes`, `/skill:pi-web-settings` (`pi-web-ctl`)

## လိုအပ်ချက်များ

- [Go](https://go.dev) 1.25+ (source မှ build လုပ်ရန်အတွက်သာ)
- browser chat/model ပြောင်းလဲမှုအတွက် သင့် `PATH` တွင် `pi` ရှိရမည်
- ရွေးချယ်နိုင်သည်: မျှဝေရန်အတွက် `gh`
- Windows တွင်: pi ၏ shell tool အတွက် bash shell လိုအပ်သည် — [Git for Windows](https://git-scm.com/download/win) လုံလောက်ပါသည် (pi ၏ Windows docs ကို ကြည့်ပါ)

## တပ်ဆင်ခြင်း

### Pi package (အကြံပြုသည်)

```bash
pi install npm:@ygncode/pi-web@beta
```

ဤ command တစ်ခုတည်းဖြင့်:

- pi ၏ package directory အောက်တွင် npm pi package ကို တပ်ဆင်သည်
- package ၏ `postinstall` script (`install.sh`၊ Windows တွင် `install.ps1`) ကို လုပ်ဆောင်သည်
- သင့် package version နှင့် platform အတွက် သင့်လျော်သော pi-web binary ကို GitHub Releases မှ ဒေါင်းလုဒ်လုပ်သည်
- ၎င်းကို `~/.pi/agent/bin/pi-web` (Windows တွင် `pi-web.exe`) သို့ တပ်ဆင်သည်
- login တွင် အလိုအလျောက်စတင်ရန် သတ်မှတ်ပေးသည် (macOS တွင် launchd၊ Linux တွင် systemd၊ Windows တွင် Run-key launcher)
- `/web`, `/remote`, `/refresh`, `/pi-web token` နှင့် `/pi-web set-token` pi commands များကို မှတ်ပုံတင်သည်

Session auto-titling သည် pi-web တွင် (extension မဟုတ်ဘဲ) ပါဝင်ပြီး `/settings` စာမျက်နှာတွင် ပြင်ဆင်သတ်မှတ်နိုင်သည်။ ၎င်းသည် ပုံမှန်အားဖြင့် ဖွင့်ထားသည်: pi-web သည် အခမဲ့ built-in word heuristic (AI မဟုတ်) ကို အသုံးပြု၍ session များကို အလိုအလျောက် အမည်ပေးပြီး message အသစ်တိုင်းတွင် ခေါင်းစဉ် ပြန်ပေးသည်။ session တစ်ခုလျှင် တစ်ကြိမ်သာ ခေါင်းစဉ်ပေးရန် ပြောင်းနိုင်ပြီး/သို့မဟုတ် heuristic အစား ပိုမိုထက်မြက်သော ခေါင်းစဉ်များရေးရန် model တစ်ခုကို ရွေးချယ်နိုင်သည်။

Linux တွင် auto-start ကို `~/.config/systemd/user/pi-web.service` တွင် user systemd service အဖြစ် ပြင်ဆင်သတ်မှတ်သည်။ installer သည် ၎င်း၏ `ExecStart` ကို အမှန်တကယ် တပ်ဆင်ထားသော binary path သို့ ပြန်ရေးသည်။ runtime တွင် Tailscale ရရှိနိုင်ပါက pi-web သည် localhost server ကို Tailscale Serve HTTPS ဖြင့် ထုတ်ပြန်သည်။ user systemd မရရှိနိုင်ပါက `~/.pi/agent/bin/pi-web -o` ဖြင့် ကိုယ်တိုင် လုပ်ဆောင်ပါ။

သီးခြား project တစ်ခုအတွက်သာ တပ်ဆင်ရန် (`.pi/settings.json` မှတစ်ဆင့် သင့်အဖွဲ့နှင့် မျှဝေသည်):

```bash
pi install -l npm:@ygncode/pi-web@beta
```

ထို့နောက် pi ကို ပြန်စတင်ပါ (သို့မဟုတ် `/reload` ကို လုပ်ဆောင်ပါ)၊ ပြီးလျှင် `/web`, `/pi-web`, `/remote`, `/refresh` ကို အသုံးပြုပါ။ သင့် access token ကို `/pi-web token` နှင့် `/pi-web set-token` ဖြင့် စီမံခန့်ခွဲပါ။

`@ygncode/pi-web` ကို နာမည်ပြောင်းနေစဉ် npm မှ `ENOTEMPTY` ဖြင့် ရပ်တန့်ပါက npm ၏ ခေတ်နောက်ကျနေသော hidden backup directories များကို ဖယ်ရှားပြီး beta channel ကို ပြန်တပ်ဆင်ပါ:

```bash
rm -rf ~/.pi/agent/npm/node_modules/@ygncode/.pi-web-*
pi install npm:@ygncode/pi-web@beta
```

### အမြန်တပ်ဆင်ခြင်း (build tools မလိုအပ်)

macOS / Linux:

```bash
curl -fsSL https://raw.githubusercontent.com/ygncode/pi-web/main/install.sh | bash
```

Windows (PowerShell):

```powershell
irm https://raw.githubusercontent.com/ygncode/pi-web/main/install.ps1 | iex
```

ဤသည် နောက်ဆုံးပေါ် pi-web binary ကို ဒေါင်းလုဒ်လုပ်ပြီး `/usr/local/bin` (Windows တွင် `~/.pi/agent/bin`) သို့ တပ်ဆင်ကာ login တွင် အလိုအလျောက်စတင်ရန် သတ်မှတ်ပေးသည်။ Go၊ Node သို့မဟုတ် pi မလိုအပ်ပါ။

### Binary ဒေါင်းလုဒ်လုပ်ခြင်း

Pre-built binary များကို [GitHub Release](https://github.com/ygncode/pi-web/releases) တစ်ခုစီတွင် ပူးတွဲထားသည်။

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

ထို့နောက် ၎င်းကို သင့် PATH သို့ ရွှေ့ပါ:

```bash
cp pi-web ~/.pi/agent/bin/
# or system-wide:
sudo cp pi-web /usr/local/bin/
```

### Source မှ build လုပ်ခြင်း

```bash
git clone https://github.com/ygncode/pi-web.git
cd pi-web
make build   # builds the Vite bundle, then embeds it into the Go binary

# optional: put it on PATH
cp pi-web ~/.pi/agent/bin/
```

frontend bundle ကို `web/assets_embed.go` မှ embed လုပ်ထားသောကြောင့် `go build` သည် `web/dist` ကို ဦးစွာ ရှိနေရန် လိုအပ်သည်။ `make build` သည် အဆင့်နှစ်ခုလုံးကို အစဉ်လိုက် လုပ်ဆောင်ပေးသည်; ကိုယ်တိုင် build လုပ်ပါက `go build ./cmd/pi-web` မတိုင်မီ `npm --prefix web install && npm --prefix web run build` ကို လုပ်ဆောင်ပါ။

### တပ်ဆင်ထားသော instance တစ်ခုနှင့် ယှဉ်တွဲ၍ ဖွံ့ဖြိုးရေးလုပ်ခြင်း

တပ်ဆင်ထားသော instance ကို port `31415` တွင် လည်ပတ်နေစေပြီး source checkout ကို development mode တွင် စတင်ပါ:

```bash
make dev
```

`http://127.0.0.1:31416` ကို ဖွင့်ပါ။ `make dev` သည် internal `PI_WEB_DEV=1` development environment ကို သတ်မှတ်ပေးသောကြောင့် source checkout သည် sessions၊ settings နှင့် SQLite data များကို တပ်ဆင်ထားသော instance နှင့် မျှဝေသုံးစွဲပြီး သီးခြား development runtime lock နှင့် state file ကို ထားရှိသည်။ ပုံမှန် တပ်ဆင်ထားသော နှင့် ကိုယ်တိုင်လုပ်ဆောင်သော instance များသည် မပြောင်းလဲဘဲ မူလ single-instance အပြုအမူကို ဆက်လက်ထိန်းသိမ်းထားသည်။

ထပ်တူကျသော အလိုအလျောက်လုပ်ငန်းများ မဖြစ်စေရန် development mode သည် schedule loop၊ chat-queue drainer၊ auto-titling သို့မဟုတ် push notifications များကို မလုပ်ဆောင်ပါ။ development UI မှတစ်ဆင့် ပြုလုပ်သော တိုက်ရိုက် တောင်းဆိုမှုများသည် ဆက်လက် အလုပ်လုပ်ပါသည်။ chat session တစ်ခုတည်းကို instance နှစ်ခုလုံးမှ တပြိုင်နက် မောင်းနှင်ခြင်း မပြုပါနှင့်; process တစ်ခုစီတွင် ၎င်း၏ကိုယ်ပိုင် RPC worker manager ရှိသည်။

Go hot reload အတွက် `make dev` သည် [Air](https://github.com/air-verse/air) လိုအပ်သည်:

```bash
go install github.com/air-verse/air@latest
```

`PI_WEB_DEV` သည် development harness plumbing ဖြစ်ပြီး ပံ့ပိုးထားသော production multi-instance mode မဟုတ်ပါ။

## ဖြုတ်သိမ်းခြင်း

```bash
pi remove npm:@ygncode/pi-web@beta
```

ဤသည် package ၏ `preuninstall` script (`uninstall.sh`၊ Windows တွင် `uninstall.ps1`) ကို လုပ်ဆောင်ပြီး ၎င်းသည် လည်ပတ်နေသော instance ကို ရပ်တန့်ကာ အောက်ပါတို့ကို ဖယ်ရှားသည်:

- pi-web binary (`~/.pi/agent/bin/pi-web`၊ standalone တပ်ဆင်မှုများအတွက် `/usr/local/bin/pi-web`)
- version file (`~/.pi/agent/pi-web-version`)
- runtime state file (`~/.pi/agent/pi-web/pi-web-state.json`)
- auto-start config (macOS တွင် launchd plist၊ Linux တွင် systemd user service၊ Windows တွင် Run-key entry + launcher scripts)

သင့်ဒေတာများကို ထိန်းသိမ်းထားသောကြောင့် နောက်မှ ပြန်တပ်ဆင်ပါက သင်ရပ်ထားသည့်နေရာမှ ဆက်လုပ်နိုင်သည်: `~/.pi/agent/pi-web.sqlite`, `~/.pi/agent/pi-web-memory.sqlite`, `~/.pi/agent/sessions/` အောက်ရှိ သင့် session files များနှင့် `~/.config/pi-web/env` (`PI_WEB_TOKEN` အပါအဝင်)။ အသစ်အဆန်းစလိုပါက ၎င်းတို့ကို ကိုယ်တိုင် ဖယ်ရှားပါ။

## အသုံးပြုခြင်း

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

ပုံမှန်အားဖြင့် pi-web သည် `127.0.0.1` သို့ bind လုပ်သည်။ Tailscale သည် MagicDNS **နှင့် `PI_WEB_TOKEN` သတ်မှတ်ထားလျှင်** လည်ပတ်နေပါက pi-web သည် `tailscale serve --bg --https=<port> http://127.0.0.1:<port>` ကိုလည်း လုပ်ဆောင်ပြီး HTTPS tailnet URL ကို ထုတ်ပြသည်။ token မရှိပါက pi-web သည် loopback-only အဖြစ်သာ နေပြီး Tailscale Serve ကို ကျော်သွားသောကြောင့် tailnet peers များသည် agent ကို authentication မရှိဘဲ ရောက်ရှိနိုင်မည်မဟုတ်ပါ။ မည်သည့် explicit non-loopback bind မဆို `PI_WEB_TOKEN` သတ်မှတ်ရန် လိုအပ်သည်; local testing အတွက် ကျော်လွှားရန် `--insecure` ကို ထည့်သုံးပါ။

## အဝေးမှ ဝင်ရောက်ခြင်း

pi-web ကို local တွင် နားထောင်နေစေပြီး tailnet ပေါ်ရှိ သင့်ဖုန်း သို့မဟုတ် laptop မှ ထုတ်ပြထားသော Tailscale HTTPS URL ကို အသုံးပြုပါ။

macOS တွင် Tailscale ကို interactive ဖြင့် တပ်ဆင်ပြီး ဖွင့်ကာ administrator prompt ကို အတည်ပြုပြီး sign in လုပ်ပါ။ ထို့နောက် `/pi-web restart` ကို လုပ်ဆောင်ပြီး `/remote` ကို ဆက်လုပ်ပါ။

Linux တွင် pi-web ကို တပ်ဆင်ခြင်း/လည်ပတ်ခြင်း မပြုမီ သင့် user အား Tailscale ကို စီမံခန့်ခွဲခွင့် ပေးပါ၊ မဟုတ်ပါက `tailscale serve` သည် sudo လိုအပ်နိုင်ပြီး auto-start ပျက်ကွက်နိုင်သည်:

```bash
sudo tailscale set --operator=$USER
```

```bash
# 1. Start pi-web with a token so it publishes the Tailscale HTTPS endpoint
PI_WEB_TOKEN=$(openssl rand -hex 16) pi-web

# 2. From any other Tailscale-connected device, open the printed
#    "Tailscale HTTPS" URL and enter the token once.
```

> ပုံမှန်အားဖြင့် `PI_WEB_TOKEN` သတ်မှတ်မထားပါက pi-web သည် non-loopback address သို့ bind လုပ်ရန် ငြင်းဆန်သည် — သို့မဟုတ်ပါက bound address သို့ ရောက်ရှိနိုင်သူ မည်သူမဆို session များကို ကြည့်ရှုနိုင်ပြီး pi သို့ ညွှန်ကြားချက်များ ပေးပို့နိုင်သည်။ local-network testing အတွက် ဤ guard ကို ကျော်လွှားရန် `--insecure` ကို ထည့်သုံးပါ။ **Tailscale သို့မဟုတ် သင့်စက်ပြင်ပမှ ရောက်ရှိနိုင်သော မည်သည့် address တွင်မဆို `--insecure` ကို မသုံးပါနှင့်။**
>
> Clients များသည် token ကို `Authorization: Bearer <token>` header၊ `X-Pi-Token` header မှတစ်ဆင့် သို့မဟုတ် `?token=<token>` (သို့မဟုတ် login prompt) မှတစ်ဆင့် တစ်ကြိမ် ပေးပို့နိုင်သည်။ Query string မှတစ်ဆင့် token ရောက်ရှိလာပါက pi-web သည် `pi_token` cookie ကို သတ်မှတ်ပြီး token ဖယ်ထုတ်ထားသော တူညီသည့် URL သို့ redirect လုပ်သောကြောင့် ၎င်းသည် address bar သို့မဟုတ် browser history တွင် ကျန်နေမည်မဟုတ်ပါ။ scripts နှင့် automation အတွက် header ပုံစံကို ပိုနှစ်သက်ပါ။

## Browser ဖြင့် Chat ပြုလုပ်ခြင်း

session စာမျက်နှာတစ်ခုကို ဖွင့်ပြီး ထို session အတိအကျကို ဆက်လက်လုပ်ဆောင်ရန် အောက်ခြေရှိ composer ကို အသုံးပြုပါ။

- `Enter` သည် ပို့သည်၊ `Shift+Enter` သည် စာကြောင်းအသစ် ထည့်သည်
- ပုံများကို composer ထဲသို့ တိုက်ရိုက် drag-and-drop သို့မဟုတ် paste လုပ်ပါ
- model picker နှင့် thinking-level selector တို့သည် header တွင် ရှိသည် — ပြောင်းလဲမှုများသည် အောက်ခံ pi worker သို့ ချက်ချင်း သက်ရောက်သည်
- လည်ပတ်နေသော session တစ်ခုစီတွင် ၎င်း၏ကိုယ်ပိုင် သီးသန့် `pi --mode rpc` worker ရှိသောကြောင့် မတူညီသော session များသည် တစ်ခုနှင့်တစ်ခု မပိတ်ဆို့ပါ

## Session များ မျှဝေခြင်း

secret GitHub Gist တစ်ခု ဖန်တီးရန် session စာမျက်နှာပေါ်ရှိ **Share** ကို နှိပ်ပါ။

လိုအပ်ချက်များ:

- `gh` တပ်ဆင်ထားရမည်
- `gh auth login` ပြီးစီးထားရမည်

မျှဝေခြင်းသည် ပြန်ပေးသည်:

- secret gist URL
- `https://pi.dev/session/#<gistId>` တွင် preview URL တစ်ခု

မျှဝေထားသော gists များသည် snapshot များဖြစ်ပြီး live-update မလုပ်ပါ။

## Login တွင် အလိုအလျောက် စတင်ခြင်း

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

> Service ကို boot (login မတိုင်မီ) တွင် စတင်စေလိုပါက system service ကို အစား သုံးပါ: `init/pi-web.service` ကို `/etc/systemd/system/` သို့ ကူးယူပြီး `sudo systemctl` ကို အသုံးပြုပါ။

### Windows

installer သည် admin rights မလိုအပ်ဘဲ ၎င်းကို အလိုအလျောက် ပြင်ဆင်သတ်မှတ်ပေးသည်: `HKCU\Software\Microsoft\Windows\CurrentVersion\Run` အောက်ရှိ `pi-web` entry သည် login တွင် `~/.config/pi-web/pi-web-start.vbs` ကို လုပ်ဆောင်ပြီး ၎င်းသည် `~/.config/pi-web/env` (`PI_WEB_TOKEN`, `PATH`, ...) ကို load လုပ်ပြီးနောက် binary ကို hidden (console window မရှိ) စတင်သည်။

ကိုယ်တိုင် စီမံခန့်ခွဲရန်:

```powershell
# Start / stop
wscript.exe "$HOME\.config\pi-web\pi-web-start.vbs"
taskkill /IM pi-web.exe /F

# Remove auto-start
Remove-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run' -Name 'pi-web'
```

Windows တွင် service supervision မရှိပါ: pi-web crash ဖြစ်ပါက နောက် login အထိ ရပ်နေမည် (အခြား platform များတွင် launchd/systemd က အလိုအလျောက် ပြန်စတင်ပေးသည်)။
