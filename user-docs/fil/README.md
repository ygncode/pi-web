# Maligayang pagdating sa pi-web 🖥️

<div align="center">

[English](../en/README.md) · [Español](../es/README.md) · [Français](../fr/README.md) · [Deutsch](../de/README.md) · [中文](../zh/README.md) · [日本語](../ja/README.md) · [Bahasa Indonesia](../id/README.md) · [Bahasa Melayu](../ms/README.md) · [Tiếng Việt](../vi/README.md) · [ไทย](../th/README.md) · **Filipino** · [မြန်မာ](../my/README.md) · [ភាសាខ្មែរ](../km/README.md) · [ລາວ](../lo/README.md)

</div>

**Iniisip mong subukan ang pi-web? Sige lang — siguradong magugustuhan mo.**

Ang pi-web ay isang magandang web UI at PWA para sa [pi](https://pi.dev) — ang open-source AI coding agent. Pinapayagan ka nitong mag-browse, magbasa, at magpatuloy ng iyong mga pi session mula sa kahit anong browser, sa kahit anong device, na may mga maingat na feature sa bawat pagkakataon.

**Ang pi-web ay ginawa para sa dalawang uri ng tao:**

- 🧑‍💻 **Para sa mga developer** — na nakatira sa terminal pero gustong magpatuloy ng mga session mula sa mobile, ipasa sa remote server, o subaybayan ang mga matagal na gawain mula sa kahit saan.
- ✨ **Para sa mga hindi developer** — na gusto lang ng magandang AI app na gumagana. Buksan, mag-type, mag-enjoy. Walang terminal, walang SSH, walang kalituhan. Tulad ng mga pinaka-user-friendly na AI tools, pero may pagpipilian ng model at kalayaan ng open-source.

---

## Bakit pi-web?

Nasa gitna ka na ng daloy kasama ang pi sa iyong terminal. Pinapanatili ng pi-web ang momentum na iyon kapag lumayo ka sa iyong desk:

- **Magpatuloy mula sa kahit saan** — ipagpatuloy ang isang session mula sa iyong telepono, tablet, o ibang computer. Walang SSH, walang Termius — buksan lang ang iyong browser.
- **Multi-session dashboard** — magsimula ng trabaho sa isang session habang pinapanood ang isa pang stream. Maghanap sa iba't ibang project, i-filter ayon sa branch, hanapin ang kailangan mo nang mabilis.
- **Open-source na pundasyon** — ang pi ay ganap na open source at provider-agnostic. Hindi ka nakakulong sa iisang model o vendor. Ang pi-web ay open source din.
- **Ligtas na remote access** — may built-in token auth kaya maaari mo itong i-expose sa iyong LAN o Tailscale nang walang pag-aalala.
- **Ibahagi ang iyong gawa** — i-export ang mga session bilang static snapshots o secret GitHub Gists sa isang click.

> Nagtataka tungkol sa kuwento sa likod nito? [Basahin kung bakit namin ito ginawa →](why.md)

---

## pi-web bilang iyong personal na AI workspace 🏠

Ang pi-web ay isang PWA (Progressive Web App), kaya maaari mo itong **i-install tulad ng isang native app** sa iyong desktop, laptop, telepono, o tablet — hindi kailangan ng app store. Sa desktop, bumubukas ito sa sarili nitong window na walang browser chrome, kaya mukha at pakiramdam nito ay isang tunay na desktop application.

Isipin ito bilang **iyong sariling Claude Cowork** — isang personal na AI workspace na nakatira sa iyong makina — maliban na lang na ito ay open source at model-agnostic:

- **Ikaw ang may-ari ng stack.** Pumili ng kahit anong model, magpalit kailanman mo gusto. Magpatakbo ng lokal at hindi kailanman aalis ang iyong data sa iyong makina.
- **Magagamit ito ng mga hindi teknikal na tao.** I-set up ang pi-web sa kanilang makina, ipakita kung paano gamitin nang isang beses, at handa na sila. Ang iyong mga magulang, ang iyong partner, ang iyong mga kaibigang hindi tech — walang terminal, walang SSH, isang pamilyar na chat interface lang.
- **Isang setup, maraming user.** I-install ito sa iyong desktop at ibahagi ang iyong screen, o i-expose ito sa iyong home network at hayaan ang mga miyembro ng pamilya na buksan ito sa kanilang sariling device.

Gusto ng higit pa sa coding? Gawin itong dedikadong [personal assistant](personal-assistant.md) na nakakaalam kung sino ka at nakatira sa iyong makina — tulad ng iyong sariling OpenClaw o Hermes.

> 💡 **Pro tip:** I-install ang pi-web bilang PWA mula sa Chrome/Edge (i-click ang install icon sa address bar) o Safari (Share → Add to Dock). Ito ay nagiging hindi matukoy ang pagkakaiba mula sa isang native app.

---

## Ano ang magagawa mo sa pi-web

| | |
|---|---|
| 📱 **PWA** | I-install ang pi-web bilang Progressive Web App sa desktop, telepono, o tablet para sa katutubong pakiramdam. |
| 🔄 **Magpatuloy ng mga session** | Ituloy ang anumang pag-uusap kung saan mo ito iniwan — text, mga imahe, pagpapalit ng model, lahat mula sa browser. |
| 🆕 **Magsimula ng bagong session** | Lumikha ng mga bagong session laban sa kahit anong project path, diretso mula sa web UI. |
| 📡 **Live streaming** | Panoorin ang mga tugon ng pi na nag-stream sa real time na may ~ms latency. Ang follow mode ay nagpapanatili sa iyo na nakatutok sa pinakabago. |
| 🌲 **Tree view** | I-navigate ang native message tree ng pi — tingnan ang buong istraktura ng pag-uusap, tumalon sa anumang branch, at mag-fork mula sa anumang punto. |
| 🔀 **Mag-fork ng session** | Mag-fork ng session mula sa anumang mensahe o kahit isang partikular na tool call — galugarin ang iba't ibang direksyon nang hindi nawawala ang iyong lugar. |
| 🔍 **Mag-browse at maghanap** | I-filter ang mga session sa iba't ibang project, maghanap ayon sa pangalan, i-navigate ang mga branch — ang iyong buong kasaysayan ng session sa isang sulyap. |
| 🌿 **Git integration** | Tingnan ang kasalukuyang branch at magbukas ng GitHub PR diretso mula sa session viewer. |
| 📝 **Scratchpad** | Isulat ang mga tala, todos, o mabilis na kaisipan kasama ng iyong mga session nang hindi nagpapalit ng app. |
| 💬 **Mga Anotasyon** | I-highlight at magkomento sa anumang bahagi ng isang session — mahusay para sa code review, feedback, o pag-bookmark ng mahahalagang sandali. |
| 🎨 **Mga Tema at pagpapasadya** | Magpalipat-lipat sa pagitan ng dark at light mode, i-tweak ang UI ayon sa iyong kagustuhan — gawing parang *sa iyo* ang pi-web. |
| 🌐 **Multi-language** | 14 built-in na wika (English, Español, Français, Deutsch, 中文, 日本語, Bahasa Indonesia, Bahasa Melayu, Tiếng Việt, ไทย, Filipino, မြန်မာ, ဗာသာခၞေယ္, ລາວ). Magdagdag ng iyong sariling custom na wika mula sa Settings. |
| 🐱 **Wellness at pomodoro** | Hindi nakakabuti ang sobrang vibe coding. May built-in na pomodoro timer na may kasamang pusa at mga paalala sa pagtulog upang mapanatili kang balanse. |
| 📤 **Ibahagi at i-export** | I-download ang JSONL, i-export ang mga static snapshot na nire-render gamit ang katutubong hitsura ng `pi.dev` ng pi, o ibahagi bilang private GitHub Gists — lahat ay nire-render sa client-side. |
| 🔔 **Mga tunog ng notipikasyon** | Nako-customize na mga tunog ng notipikasyon para sa mga kaganapan sa session — manatiling updated kahit nasa ibang tab ang pi-web. |
| ⌨️ **Mga keyboard shortcut** | Vim-style na pag-navigate, mabilis na mga aksyon — [buong sanggunian →](keyboard-shortcuts.md) |
| 🤖 **Personal assistant** | Gawing sarili mong AI assistant ang pi-web na nakatira sa iyong computer — tulad ng OpenClaw o Hermes. [I-set up ito →](personal-assistant.md) |

---

## Mabilis na pag-navigate

| Kung hinahanap mo ang… | Basahin |
|---|---|
| Paano i-install, i-configure, at gamitin ang pi-web | [install.md](install.md) |
| Gamitin ang pi-web bilang personal assistant | [personal-assistant.md](personal-assistant.md) |
| Sanggunian ng mga keyboard shortcut | [keyboard-shortcuts.md](keyboard-shortcuts.md) |
| Bakit umiiral ang pi-web | [why.md](why.md) |
| Ano ang susunod na darating | [roadmap.md](roadmap.md) |
| Nagkakaproblema sa pag-install? Hayaan ang iyong LLM na ayusin ito — i-paste ang link ng llm-debug.md sa kanila | [llm-debug.md](llm-debug.md) |

---

## Mga Screenshot

| Desktop | Mobile PWA |
|---|---|
| ![Desktop](../assets/pi-web-desktop-screenshot.png) | ![Mobile PWA](../assets/pi-web-mobile-screenshot.png) |

---

## 💛 Sponsor

Ang pi-web ay ginawa nang may pagmamahal at maraming gabing puyat. Ako ay nagbabayad para sa mga coding plan (Claude Code, OpenCode, atbp.) mula sa sariling bulsa upang mapanatiling sumusulong ang proyektong ito. Kung naging kapaki-pakinabang sa iyo ang pi-web, ang iyong suporta ay magiging napakahalaga.

**Mga paraan upang makatulong:**

- 💰 **[Mag-sponsor sa GitHub](https://github.com/sponsors/setkyar)** — tumulong na masakop ang mga tool na nagpapahintulot dito
- ☕ **[Bilhan mo ako ng kape](https://buymeacoffee.com/setkyar)** — bawat maliit na tulong ay mahalaga
- ⭐ **I-star ang repo** — wala itong gastos at nakakatulong na mas maraming tao ang makatuklas ng pi-web
- 📢 **Ibahagi sa mga kaibigan at pamilya** — kung may kakilala kang magugustuhan ang pi-web, ipadala ito sa kanila

Hindi makapag-sponsor? Walang problema — malaki na ang naitutulong ng isang star at isang share. Salamat sa pagpunta rito. 🙏

---

Maligayang pag-coding! 🚀
