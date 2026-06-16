# တပ်ဆင်ခြင်းနှင့် အသုံးပြုခြင်း

## အင်္ဂါရပ်များ

### အဝေးထိန်း ထိန်းချုပ်မှု

- စာသား သို့မဟုတ် ပုံပူးတွဲမှုများဖြင့် မည်သည့် session ကိုမဆို browser မှ ဆက်လက်လုပ်ဆောင်နိုင်ခြင်း
- Web UI မှတစ်ဆင့် မည်သည့် project path တွင်မဆို session အသစ်တစ်ခု စတင်နိုင်ခြင်း
- Browser အတွင်းမှ model ပြောင်းလဲခြင်းနှင့် thinking-level ရွေးချယ်နိုင်ခြင်း (session တစ်ခုချင်းစီအလိုက်)
- Session တစ်ခုချင်းစီ၏ worker အခြေအနေ (ငြိမ်နေသည် / လုပ်ဆောင်နေသည် / အမှား) နှင့် crash ဖြစ်ပါက အလိုအလျောက် ပြန်လည်ရယူခြင်း
- Session များစွာကို တစ်ပြိုင်နက်တည်း လုပ်ဆောင်နိုင်ခြင်း — တစ်ခုတွင် အလုပ်စတင်ပြီး အခြားတစ်ခုကို stream ကြည့်ရှုနိုင်ခြင်း
- LAN အတွင်း ဘေးကင်းစွာ ဖွင့်ထုတ်ရန်အတွက် `PI_WEB_TOKEN` — loopback မဟုတ်သော bind အတွက် ပုံမှန်အားဖြင့် လိုအပ်သည်

### Session များကို ဖတ်ရှုခြင်း

- Project များအနှံ့ session များကို filter များ၊ ရှာဖွေမှုနှင့် branch အပြည့်အစုံဖြင့် လမ်းညွှန်ကြည့်ရှုနိုင်ခြင်း
- pi လည်ပတ်ဆဲတွင် တိုက်ရိုက် တစ်စိတ်တစ်ပိုင်း အပ်ဒိတ်များ (fsnotify မှတစ်ဆင့်၊ ~ms latency)
- လုပ်ဆောင်ဆဲ session များကို နောက်ယောင်ခံကြည့်ရှုရန် follow mode
- သီးခြားစာတစ်ခုချင်းသို့ deep link များ
- Session တစ်ခုကို JSONL အဖြစ် ဒေါင်းလုဒ်လုပ်နိုင်ခြင်း
- တည်ငြိမ်သော snapshot များကို လျှို့ဝှက် GitHub Gist များအဖြစ် မျှဝေနိုင်ခြင်း
- Session များဖွင့်ရန်၊ အဝေးထိန်း QR၊ session ထပ်တူပြုခြင်းနှင့် token စီမံခန့်ခွဲခြင်းအတွက် `/web`၊ `/remote`၊ `/refresh`၊ `/pi-web token` နှင့် `/pi-web set-token` pi extension များ

## လိုအပ်ချက်များ

- [Go](https://go.dev) 1.25+
- Browser chat/model ပြောင်းရန်အတွက် သင့် `PATH` တွင် `pi` ရှိရန်
- ရွေးချယ်နိုင်သော- မျှဝေရန်အတွက် `gh`

## တပ်ဆင်ခြင်း

### Pi package (အကြံပြုသည်)

```bash
pi install npm:@ygncode/pi-web@beta
```

ဤ command တစ်ခုတည်းသည်-
- npm pi package ကို pi ၏ package directory အောက်တွင် တပ်ဆင်သည်
- Package ၏ `postinstall` script (`bash install.sh`) ကို လုပ်ဆောင်သည်
- သင့် package ဗားရှင်းနှင့် platform အတွက် သင့်လျော်သော pi-web binary ကို GitHub Releases မှ ဒေါင်းလုဒ်လုပ်သည်
- ၎င်းကို `~/.pi/agent/bin/pi-web` တွင် တပ်ဆင်သည်
- Login ဝင်သည့်အခါ အလိုအလျောက် စတင်ရန် သတ်မှတ်ပေးသည် (macOS တွင် launchd၊ Linux တွင် systemd)
- `/web`၊ `/remote`၊ `/refresh`၊ `/pi-web token` နှင့် `/pi-web set-token` pi command များကို မှတ်ပုံတင်ပေးသည်

Session အလိုအလျောက် ခေါင်းစဉ်တပ်ခြင်းကို pi-web တွင် (extension မဟုတ်ဘဲ) တည်ဆောက်ထားပြီး `/settings` စာမျက်နှာတွင် ပြင်ဆင်သတ်မှတ်နိုင်သည်။ ပုံမှန်အားဖြင့် ဖွင့်ထားသည်- pi-web သည် session များကို အခမဲ့ built-in word heuristic (AI မဟုတ်) သုံး၍ အလိုအလျောက် အမည်ပေးပြီး စာသစ်တစ်ခုတိုင်းတွင် ခေါင်းစဉ်ပြန်တပ်သည်။ Session တစ်ခုလျှင် တစ်ကြိမ်သာ ခေါင်းစဉ်တပ်ရန် ပြောင်းနိုင်သည်၊ နှင့်/သို့မဟုတ် heuristic အစား ပိုမိုထက်မြက်သော ခေါင်းစဉ်များရေးရန် model တစ်ခုကို ရွေးချယ်နိုင်သည်။

Linux တွင်၊ auto-start ကို `~/.config/systemd/user/pi-web.service` တွင် user systemd service အဖြစ် သတ်မှတ်ထားသည်။ Installer သည် ၎င်း၏ `ExecStart` ကို အမှန်တကယ် တပ်ဆင်ထားသော binary လမ်းကြောင်းသို့ ပြန်ရေးသည်။ Runtime တွင် Tailscale ရရှိနိုင်ပါက၊ pi-web သည် localhost server ကို Tailscale Serve HTTPS ဖြင့် ထုတ်ပြန်သည်။ User systemd မရရှိနိုင်ပါက၊ `~/.pi/agent/bin/pi-web -o` ဖြင့် ကိုယ်တိုင်လည်ပတ်ပါ။

သီးခြား project တစ်ခုအတွက်သာ (.pi/settings.json မှတစ်ဆင့် သင့်အဖွဲ့နှင့် မျှဝေရန်) တပ်ဆင်ရန်-

```bash
pi install -l npm:@ygncode/pi-web@beta
```

ထို့နောက် pi ကို ပြန်လည်စတင်ပါ (သို့မဟုတ် `/reload` ကို လုပ်ဆောင်ပါ)၊ ပြီးလျှင် `/web`၊ `/pi-web`၊ `/remote`၊ `/refresh` တို့ကို အသုံးပြုပါ။ `/pi-web token` နှင့် `/pi-web set-token` ဖြင့် သင့်ဝင်ရောက်ခွင့် token ကို စီမံခန့်ခွဲပါ။

`@ygncode/pi-web` ကို အမည်ပြောင်းစဉ် npm မှ `ENOTEMPTY` ဖြင့် ရပ်တန့်သွားပါက၊ npm ၏ ဟောင်းနွမ်းသော ဝှက်ထားသည့် backup directory များကို ဖယ်ရှားပြီး beta channel ကို ပြန်လည်တပ်ဆင်ပါ-

```bash
rm -rf ~/.pi/agent/npm/node_modules/@ygncode/.pi-web-*
pi install npm:@ygncode/pi-web@beta
```

### အမြန်တပ်ဆင်ခြင်း (build tools မလိုအပ်ပါ)

```bash
curl -fsSL https://raw.githubusercontent.com/ygncode/pi-web/main/install.sh | bash
```

ဤသည်မှာ နောက်ဆုံးထွက် pi-web binary ကို ဒေါင်းလုဒ်လုပ်ပြီး `/usr/local/bin` တွင် တပ်ဆင်ကာ login ဝင်သည့်အခါ အလိုအလျောက် စတင်ရန် သတ်မှတ်ပေးသည်။ Go၊ Node သို့မဟုတ် pi မလိုအပ်ပါ။

### Binary ဒေါင်းလုဒ်လုပ်ခြင်း

ကြိုတင်တည်ဆောက်ထားသော binary များကို [GitHub Release](https://github.com/ygncode/pi-web/releases) တစ်ခုစီတွင် ပူးတွဲထားသည်။

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

ထို့နောက် ၎င်းကို သင့် PATH သို့ ရွှေ့ပါ-

```bash
cp pi-web ~/.pi/agent/bin/
# သို့မဟုတ် system တစ်ခုလုံးအတွက်-
sudo cp pi-web /usr/local/bin/
```

### Source မှတည်ဆောက်ခြင်း

```bash
git clone https://github.com/ygncode/pi-web.git
cd pi-web
make build   # Vite bundle ကို တည်ဆောက်ပြီး Go binary ထဲသို့ ထည့်သွင်းသည်

# ရွေးချယ်နိုင်သော- PATH ပေါ်တွင် ထားပါ
cp pi-web ~/.pi/agent/bin/
```

Frontend bundle ကို `web/assets_embed.go` မှ ထည့်သွင်းထားသောကြောင့် `go build` သည်
`web/dist` ကို ဦးစွာရှိရန် လိုအပ်သည်။ `make build` သည် အဆင့်နှစ်ခုစလုံးကို အစဉ်လိုက် လုပ်ဆောင်သည်။ ကိုယ်တိုင်တည်ဆောက်ပါက
`go build ./cmd/pi-web` မတိုင်မီ `npm --prefix web install && npm --prefix web run build` ကို လုပ်ဆောင်ပါ။

## ဖယ်ရှားခြင်း

```bash
pi remove npm:@ygncode/pi-web@beta
```

ဤသည်မှာ package ၏ `preuninstall` script (`bash uninstall.sh`) ကို လုပ်ဆောင်ပြီး
လက်ရှိလည်ပတ်နေသော instance ကို ရပ်တန့်ကာ အောက်ပါတို့ကို ဖယ်ရှားသည်-

- pi-web binary (`~/.pi/agent/bin/pi-web` သို့မဟုတ် standalone တပ်ဆင်မှုများအတွက် `/usr/local/bin/pi-web`)
- ဗားရှင်းဖိုင် (`~/.pi/agent/pi-web-version`)
- runtime state ဖိုင် (`~/.pi/agent/pi-web/pi-web-state.json`)
- auto-start config (macOS တွင် launchd plist၊ Linux တွင် systemd user service)

သင့်ဒေတာကို ထိန်းသိမ်းထားသောကြောင့် နောက်မှ ပြန်လည်တပ်ဆင်ပါက သင်ရပ်တန့်ခဲ့သည့်နေရာမှ ဆက်လက်နိုင်သည်-
`~/.pi/agent/pi-web.sqlite`၊ `~/.pi/agent/pi-web-memory.sqlite`၊ သင့် session ဖိုင်များ (`~/.pi/agent/sessions/` အောက်တွင်) နှင့် `~/.config/pi-web/env` (`PI_WEB_TOKEN` အပါအဝင်)။ ရှင်းလင်းစွာ ပြန်လည်စတင်လိုပါက ၎င်းတို့ကို ကိုယ်တိုင်ဖယ်ရှားပါ။

## အသုံးပြုခြင်း

```bash
# ပုံမှန် port (31415) တွင် စတင်ရန်
pi-web

# စတင်ပြီး browser ဖွင့်ရန်
pi-web -o

# စိတ်ကြိုက် port
pi-web -p 8080

# Bind host ကို override လုပ်ရန် (loopback သည် ပုံမှန်အားဖြင့် စစ်မှန်ကြောင်းအတည်ပြုရန် မလိုအပ်ပါ)
pi-web --host 127.0.0.1

# Loopback မဟုတ်သော bind သည် token လိုအပ်သည် — pi-web သည် မဟုတ်ပါက စတင်ရန် ငြင်းဆန်သည်
PI_WEB_TOKEN=$(openssl rand -hex 16) pi-web --host 192.168.1.50
```

ပုံမှန်အားဖြင့်၊ pi-web သည် `127.0.0.1` သို့ bind လုပ်သည်။ MagicDNS ဖြင့် Tailscale လည်ပတ်နေပါက၊ pi-web သည် `tailscale serve --bg --https=<port> http://127.0.0.1:<port>` ကိုလည်ပတ်ပြီး HTTPS tailnet URL ကို ပုံနှိပ်ထုတ်ပေးသည်။ Loopback မဟုတ်သော မည်သည့် bind မဆို `PI_WEB_TOKEN` သတ်မှတ်ရန် လိုအပ်သည်။ ဒေသတွင်းစမ်းသပ်ရန်အတွက် override လုပ်ရန် `--insecure` ကို ထည့်ပါ။

## အဝေးမှ ဝင်ရောက်ခြင်း

pi-web ကို ဒေသတွင်း၌ နားထောင်နေစေပြီး၊ ထို့နောက် tailnet ပေါ်ရှိ သင့်ဖုန်း သို့မဟုတ် laptop မှ ပုံနှိပ်ထုတ်ပေးထားသော Tailscale HTTPS URL ကို အသုံးပြုပါ။

Linux တွင်၊ pi-web မတပ်ဆင်မီ/မလည်ပတ်မီ သင့်အသုံးပြုသူအား Tailscale ကို စီမံခန့်ခွဲခွင့်ပေးပါ၊ မဟုတ်ပါက `tailscale serve` သည် sudo လိုအပ်နိုင်ပြီး auto-start ပျက်ကွက်နိုင်သည်-

```bash
sudo tailscale set --operator=$USER
```

```bash
# ၁။ pi-web ကို စတင်ပါ
pi-web

# ၂။ Tailscale ချိတ်ဆက်ထားသော အခြားမည်သည့် စက်မှမဆို ပုံနှိပ်ထုတ်ပေးထားသော
#    "Tailscale HTTPS" URL ကို ဖွင့်ပါ။
```

> ပုံမှန်အားဖြင့်၊ pi-web သည် `PI_WEB_TOKEN` သတ်မှတ်မထားပါက loopback မဟုတ်သော လိပ်စာသို့ bind လုပ်ရန် ငြင်းဆန်သည် — bind လုပ်ထားသော လိပ်စာသို့ ရောက်ရှိနိုင်သူ မည်သူမဆို session များကို ကြည့်ရှုနိုင်ပြီး pi သို့ ညွှန်ကြားချက်များ ပေးပို့နိုင်သည်။ ဒေသတွင်း ကွန်ရက်စမ်းသပ်ရန်အတွက် ဤအကာအကွယ်ကို override လုပ်ရန် `--insecure` ကို ထည့်ပါ။ **Tailscale သို့မဟုတ် သင့်စက်ပြင်ပမှ ရောက်ရှိနိုင်သော မည်သည့်လိပ်စာတွင်မဆို `--insecure` ကို မသုံးပါနှင့်။**
>
> Client များသည် token ကို `Authorization: Bearer <token>` header၊ `X-Pi-Token` header မှတစ်ဆင့် သို့မဟုတ် `?token=<token>` မှတစ်ဆင့် တစ်ကြိမ်ပေးပို့နိုင်သည် (ယင်းသည် နောက်ဆက်တွဲ တောင်းဆိုမှုများအတွက် `pi_token` cookie ကို သတ်မှတ်ပေးသည်)။ `?token=` မှတစ်ဆင့် ပေးပို့သော token များသည် browser history၊ server access logs နှင့် စာမျက်နှာပေါ်ရှိ link များမှ `Referer` headers များတွင် အဆုံးသတ်သည် — ကနဦး bookmark ထက်ကျော်လွန်ပါက header ပုံစံကို ပိုမိုနှစ်သက်ပါ။

## Browser Chat

Session စာမျက်နှာတစ်ခုကိုဖွင့်ပြီး ထို session အတိအကျကို ဆက်လက်ရန် အောက်ခြေရှိ composer ကို အသုံးပြုပါ။

- `Enter` က ပို့သည်၊ `Shift+Enter` က စာကြောင်းသစ်ထည့်သည်
- ပုံများကို composer ထဲသို့ တိုက်ရိုက် ဆွဲချထည့်နိုင်သည် သို့မဟုတ် paste လုပ်နိုင်သည်
- Model picker နှင့် thinking-level selector သည် header တွင် ရှိသည် — ပြောင်းလဲမှုများသည် နောက်ခံ pi worker သို့ ချက်ချင်းသက်ရောက်သည်
- လုပ်ဆောင်ဆဲ session တစ်ခုစီသည် ၎င်း၏ကိုယ်ပိုင် `pi --mode rpc` worker ကို ရရှိသောကြောင့် မတူညီသော session များသည် တစ်ခုကိုတစ်ခု ပိတ်ဆို့မှုမရှိပါ

## Session များကို မျှဝေခြင်း

Session စာမျက်နှာတစ်ခုပေါ်ရှိ **Share** ကိုနှိပ်၍ လျှို့ဝှက် GitHub Gist တစ်ခု ဖန်တီးပါ။

လိုအပ်ချက်များ-
- `gh` တပ်ဆင်ထားရန်
- `gh auth login` ပြီးစီးထားရန်

မျှဝေခြင်းမှ ပြန်လည်ရရှိသည်များ-
- လျှို့ဝှက် gist URL
- `https://pi.dev/session/#<gistId>` တွင် အစမ်းကြည့်ရှုနိုင်သော URL

မျှဝေထားသော gist များသည် snapshot များဖြစ်ပြီး တိုက်ရိုက် အပ်ဒိတ်မလုပ်ပါ။

## Login ဝင်သည့်အခါ အလိုအလျောက် စတင်ခြင်း

### macOS

```bash
cp init/com.pi-web.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.pi-web.plist
```

### Linux (systemd)

```bash
# systemd user service ကို တပ်ဆင်ပါ
mkdir -p ~/.config/systemd/user
cp init/pi-web.service ~/.config/systemd/user/

# ရွေးချယ်နိုင်သော- loopback မဟုတ်သော bind များအတွက် သင့် PI_WEB_TOKEN ကို သတ်မှတ်ပါ
# (သို့မဟုတ် pi အတွင်းမှ /pi-web set-token <token> ကို အသုံးပြုပါ)
mkdir -p ~/.config/pi-web
echo 'PI_WEB_TOKEN=your-token-here' > ~/.config/pi-web/env

# Enable လုပ်ပြီး စတင်ပါ
systemctl --user daemon-reload
systemctl --user enable --now pi-web.service

# အခြေအနေကို စစ်ဆေးပါ
systemctl --user status pi-web.service

# Logs များကို ကြည့်ရှုပါ
journalctl --user -u pi-web.service -f
```

> Boot လုပ်သည့်အခါ (login မဝင်မီ) service စတင်ရန်အတွက် system service ကို အစားသုံးပါ-
> `init/pi-web.service` ကို `/etc/systemd/system/` သို့ ကူးယူပြီး `sudo systemctl` ကို အသုံးပြုပါ။
