<h1 align="center">pi-web (Remote Control Your Pi)</h1>

<div align="center">

[![GitHub stars](https://img.shields.io/github/stars/ygncode/pi-web?style=flat&logo=github&label=stars&cacheSeconds=86400)](https://github.com/ygncode/pi-web/stargazers)
[![npm downloads](https://img.shields.io/npm/dt/@ygncode/pi-web?label=downloads&color=2ea043)](https://www.npmjs.com/package/@ygncode/pi-web)
[![license MIT](https://img.shields.io/npm/l/@ygncode/pi-web?label=license&color=0a7bbb)](../../LICENSE)
[![Telegram](https://img.shields.io/badge/Telegram-Join-26A5E4?logo=telegram&logoColor=white)](https://t.me/+NJvFOTTa0wNjNTc9)
![platform](https://img.shields.io/badge/platform-macOS%20%7C%20Linux-555)

[English](../../README.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [中文](README.zh.md) · [日本語](README.ja.md) · [Bahasa Indonesia](README.id.md) · [Bahasa Melayu](README.ms.md) · [Tiếng Việt](README.vi.md) · [ไทย](README.th.md) · [Filipino](README.fil.md) · **မြန်မာ** · [ភាសាខ្មែរ](README.km.md) · [ລາວ](README.lo.md)

</div>

<div align="center">

သင့် [pi](https://pi.dev) coding agent ကို သင့်ဖုန်း၊ တက်ဘလက် သို့မဟုတ် လက်ပ်တော့မှ မောင်းနှင်ပါ — သင့်ကွန်ရက်ပေါ်ရှိ မည်သည့်နေရာမှမဆို သို့မဟုတ် Tailscale မှတစ်ဆင့် အဝေးမှ။

၎င်းသည် PWA အပြည့်အစုံဖြစ်သောကြောင့် မည်သည့်စက်ပစ္စည်းတွင်မဆို native app တစ်ခုကဲ့သို့ ထည့်သွင်းအသုံးပြုနိုင်ပါသည်။ ၎င်းကို သင့်ကိုယ်ပိုင် AI workspace အဖြစ် မြင်ပါ — Claude ၏ Cowork ကဲ့သို့သော်လည်း မတူညီသော model များဖြင့် — model များကြားတွင် chat လုပ်ခြင်း၊ သင့်ဖုန်းမှ code ရေးခြင်း၊ သို့မဟုတ် သင့်စက်ပေါ်တွင် တည်ရှိသော [personal assistant](user-docs/en/personal-assistant.md) အဖြစ် ပြောင်းလဲခြင်း။

သင့်ကိုယ်ပိုင်ပြုလုပ်ပါ- theme များနှင့် font များကို ပြောင်းလဲခြင်း၊ သင့်ကိုယ်ပိုင်ဘာသာစကားဖြင့် အသုံးပြုခြင်း — pi-web သည် ဘာသာစကားမျိုးစုံဖြင့် ပါရှိပြီး သင့်ကိုယ်ပိုင်ကိုလည်း ထည့်သွင်းနိုင်ပါသည်။ နောက်ထပ် feature များ လာနေဆဲဖြစ်သော်လည်း bloated ဖြစ်မည်မဟုတ်ပါ- သင်မလိုအပ်သောအရာမှန်သမျှကို settings တွင် ပိတ်ထားနိုင်ပါသည်။

</div>

> [!WARNING]
> pi-web သည် လက်ရှိတွင် **beta** အဆင့်ဖြစ်သည်။ အရာများ ပြောင်းလဲပြီး ပျက်စီးနိုင်ပါသည်။

> [!TIP]
> အသစ်ဖြစ်ပါသလား။ feature များ၏ အပြည့်အစုံလမ်းညွှန်၊ ထည့်သွင်းနည်းအဆင့်ဆင့်နှင့် အကြံပြုချက်များအတွက် **[အသုံးပြုသူလမ်းညွှန်ကို ဖတ်ပါ →](user-docs/en/README.md)** ([အခြားဘာသာစကားများ →](../README.md))

## Screenshots

<div align="center">
  <img src="../assets/desktop-dark-mode.png" alt="Desktop — အမှောင်မုဒ်" width="90%" /><br />
  <em>Desktop — အမှောင်မုဒ်</em>
  <br /><br />
  <img src="../assets/desktop-white-mode.png" alt="Desktop — အလင်းမုဒ်" width="90%" /><br />
  <em>Desktop — အလင်းမုဒ်</em>
  <br /><br />
  <img src="../assets/mobile-pwa.png" alt="မိုဘိုင်း PWA" width="90%" /><br />
  <em>မိုဘိုင်း PWA</em>
</div>

## မည်သို့ချိတ်ဆက်အလုပ်လုပ်ပုံ

```
 pi (terminal)                 Browser (phone / tablet / laptop)
      │                                │
      │  writes JSONL                  │  HTTP + SSE
      ▼                                ▼
 ~/.pi/agent/sessions/  ←───  pi-web (Go HTTP server)
                                      │
                    ┌─────────────────┼─────────────────┐
                    │                 │                 │
              pi --mode rpc      fsnotify         tailscale serve
            (per‑session       (live reload)      (remote HTTPS
             chat worker)                           via MagicDNS)
```

- **pi** သည် အလုပ်လုပ်နေစဉ် conversation JSONL ကို `~/.pi/agent/sessions/` သို့ ရေးသားသည်။
- **pi-web** သည် ထိုဖိုင်များကို ဖတ်ရှုကာ browser တွင် render လုပ်ပြီး SSE မှတစ်ဆင့် live update များ stream လုပ်ပေးသည့် Go server တစ်ခုဖြစ်သည်။
- **pi --mode rpc** worker များသည် browser မှစတင်သော chat ကို ကိုင်တွယ်သည် — session တစ်ခုလျှင် တစ်ခု၊ ၁၀ မိနစ် idle ပြီးနောက် ဖယ်ရှားခံရသည်။
- **fsnotify** သည် sessions directory ကို စောင့်ကြည့်သောကြောင့် output အသစ်ရောက်ပြီး မီလီစက္ကန့်အတွင်း browser က reload လုပ်သည်။
- **Tailscale Serve** သည် localhost server ကို သင့် tailnet ပေါ်တွင် HTTPS endpoint အဖြစ် ထုတ်ပြန်ပေးသည်။

## ထည့်သွင်းနည်း

```bash
pi install npm:@ygncode/pi-web@beta
```

ဒါပါပဲ — ၎င်းသည် သင့်လျော်သော binary ကို download လုပ်ကာ auto‑start ပြင်ဆင်သတ်မှတ်ပြီး `/web`၊ `/pi-web`၊ `/remote` နှင့် `/refresh` command များကို register လုပ်ပေးပါသည်။

ထည့်သွင်းပြီးသည်နှင့် သင့် browser တွင် `http://127.0.0.1:31415` ကိုဖွင့်ပါ။ pi မှ၊ လက်ရှိ session ကို သင့် browser တွင် ချက်ချင်းဖွင့်ရန် `/web` ကို အသုံးပြုပါ။ သင့်စက်တွင် Tailscale ကို run ထားပါက pi-web သည် သင့် tailnet ပေါ်တွင် HTTPS endpoint တစ်ခုကို အလိုအလျောက် ထုတ်ပြန်ပေးသည် — သင့် tailnet ပေါ်ရှိ မည်သည့်စက်အတွက်မဆို QR code နှင့် URL ရယူရန် pi မှ `/remote` ကို အသုံးပြုပါ။

Manual ထည့်သွင်းခြင်း၊ binary download များ သို့မဟုတ် source မှ build လုပ်ခြင်းအတွက် [user-docs/install.md](user-docs/en/install.md) ကို ကြည့်ပါ။

## Pi နှင့်ပေါင်းစပ်မှု

`pi install npm:@ygncode/pi-web@beta` ပြီးနောက်၊ သင်ရရှိသည်များ-

| Command | လုပ်ဆောင်ချက် |
|---------|--------------|
| `/web` | လက်ရှိ session ကို browser တွင်ဖွင့်ပါ (SSH-သိရှိနိုင်သည်- browser ကိုကျော်ပြီး URL သာပြသသည်) |
| `/pi-web` | status၊ version ပြသခြင်း၊ server ကို start/stop/restart လုပ်ခြင်း သို့မဟုတ် update လုပ်ခြင်း |
| `/remote` | Tailscale မှတစ်ဆင့် အဝေးမှအသုံးပြုရန် QR code နှင့် URL ကိုပြသခြင်း |
| `/refresh` | အဝေးမှ browser များမှ ရေးသားထားသော မက်ဆေ့ချ်အသစ်များကို terminal session ထဲသို့ ပြန်လည်ဆွဲယူခြင်း |

Session **auto-titling** ကို pi-web တွင်ယှဉ်တွဲပါရှိပြီး `/settings` စာမျက်နှာတွင် configure လုပ်နိုင်ပါသည်။ ၎င်းသည် **မူလအားဖြင့် ဖွင့်ထားသည်** ဖြစ်ပြီး session များကို အလိုအလျောက် အမည်ပေးပါသည်။ သင်ရွေးချယ်နိုင်သည်များ-

- **မည်သည့်အချိန်တွင် အမည်ပေးမည်နည်း** — session တစ်ခုလျှင် တစ်ကြိမ်၊ သို့မဟုတ် မက်ဆေ့ချ်အသစ်တိုင်းတွင် (မူလသတ်မှတ်ချက်)။
- **ခေါင်းစဉ်ပေး model** — မူလအားဖြင့် အခမဲ့၊ ချက်ချင်းလက်ငင်း **built-in word heuristic (AI မပါ)** သို့မဟုတ် ပိုမိုထက်မြက်သော model ရေးသားသည့် ခေါင်းစဉ်များအတွက် model တစ်ခု (ဥပမာ သေးငယ်/မြန်ဆန်သော) ကို ရွေးချယ်ပါ။

ထို package သည် pi-web binary ကို `~/.pi/agent/bin/pi-web` သို့လည်း ထည့်သွင်းပြီး login ဝင်သည့်အခါ auto-start ပြင်ဆင်ပေးပါသည်။

## Login ဝင်သည့်အခါ Auto-Start

`pi install npm:@ygncode/pi-web@beta` command က ၎င်းကို အလိုအလျောက် ပြင်ဆင်ပေးပါသည်-

| OS | လုပ်ဆောင်ပုံ |
|----|-----------|
| macOS | `~/Library/LaunchAgents/com.pi-web.plist` တွင် launchd plist |
| Linux | `~/.config/systemd/user/pi-web.service` တွင် systemd user service |

အဝေးမှအသုံးပြုခွင့်အတွက် token တစ်ခုသတ်မှတ်ရန် `~/.config/pi-web/env` ကို ဖန်တီးပါ-

```
PI_WEB_TOKEN=your-token-here
```

အသေးစိတ်အတွက် (manual ပြင်ဆင်သတ်မှတ်ခြင်း၊ custom port များ၊ non-loopback bind များ) [user-docs/install.md](user-docs/en/install.md) ကို ကြည့်ပါ။

## Development

```bash
make setup   # frontend deps ထည့်သွင်းပြီး Go module များ download လုပ်ပါ
make check   # frontend test/build + Go test/vet
make build   # လိုအပ်ပါက setup၊ frontend build၊ ထို့နောက် ./pi-web build
```
