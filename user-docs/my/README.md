# pi-web မှ ကြိုဆိုပါတယ် 🖥️

<div align="center">

[English](../en/README.md) · [Español](../es/README.md) · [Français](../fr/README.md) · [Deutsch](../de/README.md) · [中文](../zh/README.md) · [日本語](../ja/README.md) · [Bahasa Indonesia](../id/README.md) · [Bahasa Melayu](../ms/README.md) · [Tiếng Việt](../vi/README.md) · [ไทย](../th/README.md) · [Filipino](../fil/README.md) · **မြန်မာ** · [ភាសាខ្មែរ](../km/README.md) · [ລາວ](../lo/README.md)

</div>

**pi-web ကို စမ်းကြည့်ဖို့ စဉ်းစားနေလား။ စမ်းကြည့်လိုက်ပါ — သင် ချစ်မိသွားမှာ သေချာပါတယ်။**

pi-web သည် open-source AI coding agent ဖြစ်သော [pi](https://pi.dev) အတွက် လှပသည့် web UI နှင့် PWA တစ်ခုဖြစ်သည်။ ၎င်းသည် မည်သည့် browser မှမဆို၊ မည်သည့် စက်ပစ္စည်းမှမဆို သင့် pi sessions များကို ကြည့်ရှုခြင်း၊ ဖတ်ရှုခြင်းနှင့် ဆက်လက်လုပ်ဆောင်ခြင်းတို့ကို ပြုလုပ်နိုင်စေပြီး၊ နေရာတိုင်းတွင် ဂရုတစိုက် စဉ်းစားထားသော features များ ပါဝင်သည်။

**pi-web သည် လူနှစ်မျိုးအတွက် တည်ဆောက်ထားသည်:**

- 🧑‍💻 **developer များအတွက်** — terminal ထဲတွင် နေထိုင်ကြသော်လည်း mobile မှ sessions များကို ဆက်လက်လုပ်ဆောင်လိုသူ၊ remote server သို့ လွှဲပြောင်းလိုသူ၊ သို့မဟုတ် ကြာရှည်လုပ်ဆောင်နေသော အလုပ်များကို မည်သည့်နေရာမှမဆို စောင့်ကြည့်လိုသူများအတွက်။
- ✨ **developer မဟုတ်သူများအတွက်** — အလုပ်လုပ်သော လှပသည့် AI app တစ်ခုကိုသာ လိုချင်သူများအတွက်။ ဖွင့်လိုက်၊ စာရိုက်လိုက်၊ သဘောကျလိုက်။ terminal မလို၊ SSH မလို၊ ရှုပ်ထွေးမှု မရှိ။ အသုံးပြုရ အဆင်ပြေဆုံး AI tools များကဲ့သို့ပင်၊ သို့သော် model ရွေးချယ်ခွင့်နှင့် open-source လွတ်လပ်မှုဖြင့်။

---

## ဘာကြောင့် pi-web လဲ။

သင်သည် terminal ထဲတွင် pi ဖြင့် အလုပ်ထဲ နက်နက်ရှိုင်းရှိုင်း နစ်မြုပ်နေပြီးသားဖြစ်သည်။ သင်စားပွဲမှ ခွာသွားသည့်အခါ pi-web က ထိုအရှိန်အဟုန်ကို ဆက်ထိန်းပေးသည်:

- **မည်သည့်နေရာမှမဆို ပြန်စလုပ်နိုင်ခြင်း** — သင့်ဖုန်း၊ tablet သို့မဟုတ် အခြား computer တစ်လုံးမှ session တစ်ခုကို ဆက်လုပ်ပါ။ SSH မလို၊ Termius မလို — browser ကို ဖွင့်လိုက်ရုံပါပဲ။
- **Multi-session dashboard** — session တစ်ခုတွင် အလုပ်စလုပ်နေစဉ် အခြားတစ်ခု stream လာသည်ကို ကြည့်နိုင်သည်။ projects များအနှံ့ ရှာဖွေပါ၊ branch အလိုက် filter လုပ်ပါ၊ လိုအပ်သည်ကို လျင်မြန်စွာ ရှာတွေ့ပါ။
- **Open-source အခြေခံ** — pi သည် အပြည့်အဝ open source ဖြစ်ပြီး provider-agnostic ဖြစ်သည်။ သင် model တစ်ခုတည်း သို့မဟုတ် vendor တစ်ခုတည်းတွင် ပိတ်လှောင်ခံရခြင်း မရှိပါ။ pi-web သည်လည်း open source ဖြစ်သည်။
- **လုံခြုံသော remote access** — built-in token auth ပါသောကြောင့် သင်၏ LAN သို့မဟုတ် Tailscale တွင် စိတ်ပူစရာမလိုဘဲ ဖွင့်ထားနိုင်သည်။
- **သင့်အလုပ်ကို မျှဝေပါ** — sessions များကို static snapshots သို့မဟုတ် secret GitHub Gists အဖြစ် တစ်ချက်နှိပ်ရုံဖြင့် export လုပ်ပါ။

> နောက်ခံအကြောင်း သိချင်ပါသလား။ [ဘာကြောင့် တည်ဆောက်ခဲ့လဲ ဖတ်ပါ →](why.md)

---

## သင့်ကိုယ်ပိုင် AI workspace အဖြစ် pi-web 🏠

pi-web သည် PWA (Progressive Web App) ဖြစ်သောကြောင့်၊ သင့် desktop၊ laptop၊ ဖုန်း သို့မဟုတ် tablet တွင် **native app တစ်ခုကဲ့သို့ install လုပ်နိုင်သည်** — app store မလိုအပ်ပါ။ Desktop တွင် ၎င်းသည် browser chrome မပါဘဲ ကိုယ်ပိုင် window တစ်ခုဖြင့် ဖွင့်သောကြောင့်၊ တကယ့် desktop application တစ်ခုကဲ့သို့ မြင်ရပြီး ခံစားရသည်။

၎င်းကို **သင့်ကိုယ်ပိုင် Claude Cowork** အဖြစ် စဉ်းစားကြည့်ပါ — သင့်စက်ပေါ်တွင် နေထိုင်သော ကိုယ်ပိုင် AI workspace တစ်ခု — သို့သော် ၎င်းသည် open source ဖြစ်ပြီး model-agnostic ဖြစ်သည်:

- **Stack ကို သင်ပိုင်ဆိုင်သည်။** မည်သည့် model ကိုမဆို ရွေးပါ၊ ကြိုက်သည့်အခါတိုင်း ပြောင်းပါ။ local တစ်ခုကို run လုပ်ပါက သင့် data သည် သင့်စက်မှ ဘယ်တော့မှ ထွက်မသွားပါ။
- **နည်းပညာမကျွမ်းသူများ အသုံးပြုနိုင်သည်။** သူတို့၏ စက်ပေါ်တွင် pi-web ကို set up လုပ်ပေးပါ၊ တစ်ကြိမ် အသုံးပြုပုံ ပြသပေးပါ၊ ပြီးပါပြီ။ သင့်မိဘများ၊ သင့်အဖော်၊ သင့် tech မကျွမ်းသော သူငယ်ချင်းများ — terminal မလို၊ SSH မလို၊ ရင်းနှီးနေသော chat interface တစ်ခုသာ။
- **Setup တစ်ခု၊ အသုံးပြုသူများစွာ။** သင့် desktop တွင် install လုပ်ပြီး သင့် screen ကို မျှဝေပါ၊ သို့မဟုတ် သင့်အိမ် network တွင် ဖွင့်ထားပြီး မိသားစုဝင်များကို ၎င်းတို့၏ စက်များပေါ်တွင် ဖွင့်ခွင့်ပေးပါ။

coding ထက်ပိုလိုချင်ပါသလား။ သင်မည်သူဖြစ်ကြောင်း သိပြီး သင့်စက်ပေါ်တွင် နေထိုင်သော သီးသန့် [personal assistant](personal-assistant.md) တစ်ခုအဖြစ် ပြောင်းလဲလိုက်ပါ — သင့်ကိုယ်ပိုင် OpenClaw သို့မဟုတ် Hermes ကဲ့သို့ပင်။

> 💡 **Pro tip:** pi-web ကို Chrome/Edge (address bar ရှိ install icon ကို နှိပ်ပါ) သို့မဟုတ် Safari (Share → Add to Dock) မှ PWA အဖြစ် install လုပ်ပါ။ ၎င်းသည် native app တစ်ခုနှင့် ခွဲခြားမရအောင် ဖြစ်သွားသည်။

---

## pi-web ဖြင့် သင်ဘာတွေလုပ်နိုင်လဲ

| | |
|---|---|
| 📱 **PWA** | pi-web ကို desktop၊ ဖုန်း သို့မဟုတ် tablet တွင် Progressive Web App အဖြစ် install လုပ်ပြီး native ခံစားမှုရယူပါ။ |
| 🔄 **Sessions များကို ဆက်လုပ်ပါ** | မည်သည့် conversation ကိုမဆို သင်ရပ်ထားခဲ့သည့်နေရာမှ ဆက်လုပ်ပါ — text၊ images၊ model switching၊ အားလုံးကို browser မှ။ |
| 🆕 **Session အသစ်များ စတင်ပါ** | မည်သည့် project path ကိုမဆို အခြေခံ၍ session အသစ်များကို web UI မှ တိုက်ရိုက် ဖန်တီးပါ။ |
| 📡 **Live streaming** | pi ၏ responses များကို ~ms latency ဖြင့် real time တွင် stream လာသည်ကို ကြည့်ပါ။ Follow mode က သင့်ကို နောက်ဆုံးအခြေအနေပေါ်တွင် ဆက်ထိန်းထားပေးသည်။ |
| 🌲 **Tree view** | pi ၏ native message tree ကို သွားလာပါ — conversation တည်ဆောက်ပုံ အပြည့်အစုံကို မြင်ရပြီး၊ မည်သည့် branch သို့မဆို ခုန်သွားနိုင်ကာ၊ မည်သည့်နေရာမှမဆို fork လုပ်နိုင်သည်။ |
| 🔀 **Sessions များကို fork လုပ်ပါ** | မည်သည့် message မှမဆို သို့မဟုတ် specific tool call တစ်ခုမှပင် session တစ်ခုကို fork လုပ်ပါ — သင့်နေရာကို မဆုံးရှုံးဘဲ မတူညီသော လမ်းကြောင်းများကို စူးစမ်းပါ။ |
| 🔍 **ကြည့်ရှု & ရှာဖွေပါ** | projects များအနှံ့ sessions များကို filter လုပ်ပါ၊ အမည်ဖြင့် ရှာဖွေပါ၊ branches များကို သွားလာပါ — သင့် session မှတ်တမ်း အပြည့်အစုံကို တစ်ချက်ကြည့်ရုံဖြင့်။ |
| 🌿 **Git integration** | လက်ရှိ branch ကို ကြည့်ပြီး session viewer မှပင် GitHub PR တစ်ခုကို ဖွင့်ပါ။ |
| 📝 **Scratchpad** | app များ မပြောင်းဘဲ သင့် sessions များနှင့်အတူ notes၊ todos သို့မဟုတ် လျင်မြန်သော အတွေးများကို မှတ်သားပါ။ |
| 💬 **Annotations** | session တစ်ခု၏ မည်သည့်အပိုင်းကိုမဆို highlight လုပ်ပြီး comment ပေးပါ — code review၊ feedback သို့မဟုတ် အရေးကြီးသော အခိုက်အတန့်များကို bookmark လုပ်ရန် အကောင်းဆုံးဖြစ်သည်။ |
| 🎨 **Themes & စိတ်ကြိုက်ပြင်ဆင်ခြင်း** | dark နှင့် light mode ကြား ပြောင်းပါ၊ UI ကို သင့်ကြိုက်သလို ပြင်ဆင်ပါ — pi-web ကို *သင့်ကိုယ်ပိုင်* အဖြစ် ခံစားရအောင် လုပ်ပါ။ |
| 🌐 **Multi-language** | built-in ဘာသာစကား ၁၄ မျိုး (English, Español, Français, Deutsch, 中文, 日本語, Bahasa Indonesia, Bahasa Melayu, Tiếng Việt, ไทย, Filipino, မြန်မာ, ភាសាខ្មែរ, ລາວ)။ Settings မှ သင့်ကိုယ်ပိုင် ဘာသာစကားကို ထည့်ပါ။ |
| 🐱 **Wellness & pomodoro** | vibe coding အလွန်အကျွံလုပ်ခြင်းသည် ကျန်းမာရေးနှင့် မညီပါ။ ကြောင်အဖော်နှင့် sleep reminders ပါသော built-in pomodoro timer ဖြင့် သင့်ကို မျှတနေစေသည်။ |
| 📤 **Share & export** | JSONL ကို download လုပ်ပါ၊ pi ၏ native `pi.dev` အသွင်ဖြင့် render လုပ်ထားသော static snapshots များကို export လုပ်ပါ၊ သို့မဟုတ် private GitHub Gists အဖြစ် မျှဝေပါ — အားလုံးကို client-side တွင် render လုပ်ထားသည်။ |
| 🔔 **Notification sounds** | session events များအတွက် စိတ်ကြိုက်ပြင်ဆင်နိုင်သော notification chimes — pi-web က အခြား tab တွင် ရှိနေသည့်တိုင် အသိပေးချက်များကို ဆက်လက်ရရှိနေပါ။ |
| ⌨️ **Keyboard shortcuts** | Vim-style navigation၊ လျင်မြန်သော လုပ်ဆောင်ချက်များ — [အပြည့်အစုံ ကိုးကား →](keyboard-shortcuts.md) |
| 🤖 **Personal assistant** | pi-web ကို သင့် computer ပေါ်တွင် နေထိုင်သော သင့်ကိုယ်ပိုင် AI assistant အဖြစ် ပြောင်းလဲပါ — OpenClaw သို့မဟုတ် Hermes ကဲ့သို့။ [Set up လုပ်ပါ →](personal-assistant.md) |
| 🗓️ **Talk to schedules** | pi session တစ်ခုမှ “… သို့ Singapore စံတော်ချိန် မနက် ၂ နာရီတွင် schedule တစ်ခု ထည့်ပါ” ဟု ပြောပါ — `/skill:pi-web-schedule`။ |
| 📝 **Talk to notes & settings** | “ဒါကို notes ထဲမှာ ရေးပါ” (`/skill:pi-web-notes`) သို့မဟုတ် “dark mode သို့ ပြောင်းပါ” (`/skill:pi-web-settings`). |

---

## အမြန်လမ်းညွှန်

| သင်ရှာဖွေနေသည်မှာ… | ဖတ်ရန် |
|---|---|
| pi-web ကို install လုပ်ခြင်း၊ configure လုပ်ခြင်းနှင့် အသုံးပြုနည်း | [install.md](install.md) |
| pi-web ကို personal assistant အဖြစ် အသုံးပြုခြင်း | [personal-assistant.md](personal-assistant.md) |
| Keyboard shortcuts ကိုးကား | [keyboard-shortcuts.md](keyboard-shortcuts.md) |
| pi-web ဘာကြောင့် တည်ရှိသလဲ | [why.md](why.md) |
| နောက်ထပ် ဘာတွေ လာမလဲ | [roadmap.md](roadmap.md) |
| install ပြဿနာ ရှိနေလား။ သင့် LLM ကို ပြင်ခိုင်းလိုက်ပါ — llm-debug.md link ကို သူတို့ဆီ ကူးထည့်ပေးပါ | [llm-debug.md](llm-debug.md) |

---

## Screenshots

| Desktop | Mobile |
|---|---|
| ![Desktop](../assets/pi-web-desktop-screenshot.png) | ![Mobile](../assets/pi-web-mobile-screenshot.png) |

---

## 💛 Sponsor

pi-web ကို ချစ်ခြင်းမေတ္တာနှင့် ညနက်ပိုင်း အချိန်များစွာဖြင့် တည်ဆောက်ထားသည်။ ဤ project ဆက်လက်ရှင်သန်နိုင်ရန် coding plans (Claude Code, OpenCode, etc.) များကို ကိုယ့်အိတ်ထဲမှ ကုန်ကျခံပေးနေပါသည်။ pi-web က သင့်အတွက် အသုံးဝင်ခဲ့လျှင်၊ သင့်ထောက်ပံ့မှုသည် အလွန်တန်ဖိုးရှိပါသည်။

**ကူညီနိုင်သည့် နည်းလမ်းများ:**

- 💰 **[GitHub တွင် Sponsor လုပ်ပါ](https://github.com/sponsors/setkyar)** — ၎င်းကို ဖြစ်နိုင်စေသော tools များ၏ ကုန်ကျစရိတ်ကို ကူညီဖြည့်ဆည်းပေးပါ
- ☕ **[ကော်ဖီတစ်ခွက် လှူဒါန်းပါ](https://buymeacoffee.com/setkyar)** — နည်းနည်းစီတိုင်း အထောက်အကူဖြစ်သည်
- ⭐ **Repo ကို Star ပေးပါ** — ဘာမှ မကုန်ကျဘဲ လူများစွာ pi-web ကို ရှာဖွေတွေ့ရှိစေရန် ကူညီပေးသည်
- 📢 **သူငယ်ချင်းများနှင့် မိသားစုကို မျှဝေပါ** — pi-web ကို သဘောကျမည့်သူတစ်ဦးကို သိပါက သူတို့ဆီ ပို့ပေးလိုက်ပါ

Sponsor မလုပ်နိုင်ဘူးလား။ လုံးဝ စိတ်မပူပါနဲ့ — star တစ်ခုနှင့် share တစ်ခုက အများကြီး အထောက်အကူပြုပါတယ်။ ဒီမှာ ရှိနေပေးတဲ့အတွက် ကျေးဇူးတင်ပါတယ်။ 🙏

---

ပျော်ရွှင်စွာ coding လုပ်ပါ။ 🚀
