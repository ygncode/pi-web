# Maligayang pagdating sa pi-web 🖥️

<div align="center">

[English](../en/README.md) · [Español](../es/README.md) · [Français](../fr/README.md) · [Deutsch](../de/README.md) · [中文](../zh/README.md) · [日本語](../ja/README.md) · [Bahasa Indonesia](../id/README.md) · [Bahasa Melayu](../ms/README.md) · [Tiếng Việt](../vi/README.md) · [ไทย](../th/README.md) · **Filipino** · [မြန်မာ](../my/README.md) · [ភាសាខ្មែរ](../km/README.md) · [ລາວ](../lo/README.md)

</div>

**Iniisip mo bang subukan ang pi-web? Sige na — siguradong maiinlove ka.**

Ang pi-web ay isang magandang web UI at PWA para sa [pi](https://pi.dev) — ang open-source na AI coding agent. Hinahayaan ka nitong mag-browse, magbasa, at magpatuloy ng iyong mga pi session mula sa kahit anong browser, sa kahit anong device, na may maiisipang mga feature sa bawat sulok.

**Ang pi-web ay ginawa para sa dalawang uri ng tao:**

- 🧑‍💻 **Para sa mga developer** — na namumuhay sa terminal pero gustong magpatuloy ng mga session mula sa mobile, mag-hand off sa isang remote server, o subaybayan ang mga mahabang task mula sa kahit saan.
- ✨ **Para sa mga hindi developer** — na gusto lang ng magandang AI app na gumagana. Buksan ito, mag-type, mag-vibe. Walang terminal, walang SSH, walang kalituhan. Tulad ng pinaka-user-friendly na mga AI tool, pero may pagpipilian ng modelo at kalayaan ng open-source.

---

## Bakit pi-web?

Nasa gitna ka na ng flow kasama ang pi sa iyong terminal. Pinapanatili ng pi-web ang momentum na iyon kapag lumayo ka sa iyong desk:

- **Magpatuloy mula sa kahit saan** — ipagpatuloy ang isang session mula sa iyong telepono, tablet, o ibang computer. Walang SSH, walang Termius — buksan lang ang iyong browser.
- **Multi-session dashboard** — magsimula ng trabaho sa isang session habang pinapanood ang isa pang nag-i-stream. Mag-search sa mga proyekto, mag-filter ayon sa branch, hanapin agad ang kailangan mo.
- **Open-source na pundasyon** — ang pi ay fully open source at provider-agnostic. Hindi ka nakakulong sa iisang modelo o vendor. Open source rin ang pi-web.
- **Ligtas na remote access** — built-in na token auth para mailantad mo ito sa iyong LAN o Tailscale nang walang pag-aalala.
- **I-share ang iyong trabaho** — i-export ang mga session bilang static snapshot o secret na GitHub Gists sa isang click.

> Curious ka ba sa backstory? [Basahin kung bakit namin ito ginawa →](why.md)

---

## Ang pi-web bilang iyong personal AI workspace 🏠

Ang pi-web ay isang PWA (Progressive Web App), kaya maaari mo itong **i-install tulad ng isang native app** sa iyong desktop, laptop, telepono, o tablet — hindi kailangan ng app store. Sa desktop, bumubukas ito sa sarili nitong window na walang browser chrome, kaya mukha at parang tunay na desktop application ang dating nito.

Isipin ito bilang **iyong sariling Claude Cowork** — isang personal AI workspace na naninirahan sa iyong makina — maliban na ito ay open source at model-agnostic:

- **Ikaw ang may-ari ng stack.** Pumili ng kahit anong modelo, lumipat kung kailan mo gusto. Magpatakbo ng lokal na modelo at hindi kailanman aalis sa iyong makina ang iyong data.
- **Magagamit ito ng mga hindi teknikal na tao.** I-set up ang pi-web sa kanilang makina, ipakita sa kanila kung paano gamitin nang isang beses, at handa na sila. Ang iyong mga magulang, ang iyong partner, ang iyong mga kaibigang hindi tech — walang terminal, walang SSH, isang pamilyar na chat interface lang.
- **Isang setup, maraming gumagamit.** I-install ito sa iyong desktop at i-share ang iyong screen, o ilantad ito sa iyong home network at hayaang buksan ito ng mga miyembro ng pamilya sa kanilang sariling mga device.

Gusto mo ng higit pa sa coding? Gawin itong isang dedikadong [personal assistant](personal-assistant.md) na nakakakilala sa iyo at naninirahan sa iyong makina — tulad ng iyong sariling OpenClaw o Hermes.

> 💡 **Pro tip:** I-install ang pi-web bilang isang PWA mula sa Chrome/Edge (i-click ang install icon sa address bar) o Safari (Share → Add to Dock). Ito ay magiging hindi na makikilala mula sa isang native app.

---

## Ano ang magagawa mo sa pi-web

| | |
|---|---|
| 📱 **PWA** | I-install ang pi-web bilang isang Progressive Web App sa desktop, telepono, o tablet para sa native na pakiramdam. |
| 🔄 **Magpatuloy ng mga session** | Ipagpatuloy ang kahit anong usapan kung saan ka tumigil — text, mga larawan, pagpapalit ng modelo, lahat mula sa browser. |
| 🆕 **Magsimula ng mga bagong session** | Gumawa ng mga bagong session laban sa kahit anong project path, diretso mula sa web UI. |
| 📡 **Live streaming** | Panoorin ang mga tugon ng pi na nag-i-stream nang real time na may ~ms na latency. Pinapanatili ka ng Follow mode na naka-lock sa pinakabago. |
| 🌲 **Tree view** | Mag-navigate sa native message tree ng pi — tingnan ang buong istruktura ng usapan, tumalon sa kahit anong branch, at mag-fork mula sa kahit anong punto. |
| 🔀 **Mag-fork ng mga session** | I-fork ang isang session mula sa kahit anong mensahe o kahit isang partikular na tool call — galugarin ang iba't ibang direksyon nang hindi nawawala ang iyong lugar. |
| 🔍 **Mag-browse at mag-search** | I-filter ang mga session sa mga proyekto, maghanap ayon sa pangalan, mag-navigate sa mga branch — ang iyong buong session history sa isang sulyap. |
| 🌿 **Git integration** | Tingnan ang kasalukuyang branch at magbukas ng GitHub PR diretso mula sa session viewer. |
| 📝 **Scratchpad** | Magsulat ng mga tala, todos, o mabilis na mga kaisipan sa tabi ng iyong mga session nang hindi lumilipat ng app. |
| 💬 **Mga Annotation** | I-highlight at magkomento sa kahit anong bahagi ng isang session — maganda para sa code review, feedback, o pag-bookmark ng mga mahalagang sandali. |
| 🎨 **Mga Theme at pag-customize** | Lumipat sa pagitan ng dark at light mode, ayusin ang UI ayon sa gusto mo — gawing parang *iyo* ang pi-web. |
| 🌐 **Multi-language** | 14 na built-in na wika (English, Español, Français, Deutsch, 中文, 日本語, Bahasa Indonesia, Bahasa Melayu, Tiếng Việt, ไทย, Filipino, မြန်မာ, ភាសាខ្មែរ, ລາວ). Magdagdag ng sarili mong custom na wika mula sa Settings. |
| 🐱 **Wellness at pomodoro** | Hindi malusog ang sobrang vibe coding. Built-in na pomodoro timer na may kasamang pusa at mga paalala sa pagtulog para manatili kang balanse. |
| 📤 **Mag-share at mag-export** | Mag-download ng JSONL, mag-export ng mga static snapshot na nire-render gamit ang native na `pi.dev` na itsura ng pi, o mag-share bilang private na GitHub Gists — lahat ay nire-render sa client-side. |
| 🔔 **Mga tunog ng notification** | Nako-customize na mga notification chime para sa mga session event — manatiling updated kahit nasa ibang tab ang pi-web. |
| ⌨️ **Mga keyboard shortcut** | Vim-style na pag-navigate, mabilis na mga aksyon — [buong sanggunian →](keyboard-shortcuts.md) |
| 🤖 **Personal assistant** | Gawing sarili mong AI assistant ang pi-web na naninirahan sa iyong computer — tulad ng OpenClaw o Hermes. [I-set up ito →](personal-assistant.md) |
| 🗓️ **Makipag-usap sa mga schedule** | Mula sa isang pi session, sabihing “add a schedule at 2am Singapore time to …” — `/skill:pi-web-schedule`. |
| 📝 **Makipag-usap sa mga tala at setting** | “Write this in the notes” (`/skill:pi-web-notes`) o “switch to dark mode” (`/skill:pi-web-settings`). |

---

## Mabilis na pag-navigate

| Kung hinahanap mo ang… | Basahin |
|---|---|
| Paano i-install, i-configure, at gamitin ang pi-web | [install.md](install.md) |
| Gamitin ang pi-web bilang personal assistant | [personal-assistant.md](personal-assistant.md) |
| Sanggunian ng mga keyboard shortcut | [keyboard-shortcuts.md](keyboard-shortcuts.md) |
| Bakit umiiral ang pi-web | [why.md](why.md) |
| Ano ang susunod na darating | [roadmap.md](roadmap.md) |
| May problema sa pag-install? Hayaang ayusin ito ng iyong LLM — i-paste sa kanila ang llm-debug.md link | [llm-debug.md](llm-debug.md) |

---

## Mga Screenshot

| Desktop | Mobile |
|---|---|
| ![Desktop](../assets/pi-web-desktop-screenshot.png) | ![Mobile](../assets/pi-web-mobile-screenshot.png) |

---

## 💛 Sponsor

Ang pi-web ay ginawa nang may pagmamahal at maraming gabing puyat. Binabayaran ko mula sa sarili kong bulsa ang mga coding plan (Claude Code, OpenCode, atbp.) para patuloy na sumulong ang proyektong ito. Kung naging kapaki-pakinabang sa iyo ang pi-web, malaki ang ibig sabihin ng iyong suporta.

**Mga paraan para makatulong:**

- 💰 **[Mag-sponsor sa GitHub](https://github.com/sponsors/setkyar)** — tumulong na masagot ang mga tool na nagpapangyari nito
- ☕ **[Bilhan ako ng kape](https://buymeacoffee.com/setkyar)** — malaking tulong ang bawat maliit na ambag
- ⭐ **I-star ang repo** — wala itong gastos at nakakatulong para mas maraming tao ang makatuklas ng pi-web
- 📢 **I-share sa mga kaibigan at pamilya** — kung may kakilala kang magugustuhan ang pi-web, ipadala ito sa kanila

Hindi makapag-sponsor? Ayos lang talaga — malayo na ang mararating ng isang star at isang share. Salamat sa pagiging nandito. 🙏

---

Maligayang pagko-code! 🚀
