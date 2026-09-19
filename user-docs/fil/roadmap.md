# Roadmap

Ang pi-web ay ginawa para sa dalawang audience:

- **Para sa mga developer** — na naninirahan sa terminal ngunit gustong ipagpatuloy ang mga session mula sa mobile, ipasa sa isang remote server, o bantayan ang mga pangmatagalang gawain mula sa kahit saan.
- **Para sa mga hindi developer** — na gusto lang ng magandang AI app na gumagana. Buksan ito, mag-type, mag-enjoy. Walang terminal, walang SSH, walang kalituhan. Tulad ng mga pinaka-user-friendly na AI tool, ngunit may pagpipilian ng modelo at open-source na kalayaan.

Narito ang mga paparating.

---

## Ngayon (inilabas na)

Lahat ng nakalista sa [talahanayan ng mga feature](README.md#what-you-can-do-with-pi-web) ay live na ngayon.

Mga feature na dati ay nasa roadmap na ito at inilabas na mula noon:

| Feature | Ano ang ginagawa nito |
|---|---|
| **Pagpipiloto / pila** ([#46](https://github.com/ygncode/pi-web/issues/46)) | Magpadala ng mga follow-up na tagubilin habang tumatakbo pa ang pi, o magpila ng mga mensahe para sa susunod na turn. |
| **Scheduler** ([#44](https://github.com/ygncode/pi-web/issues/44)) | Mag-iskedyul ng mga prompt na awtomatikong tatakbo — pang-araw-araw na standup, mga buod sa umaga, mga paulit-ulit na gawain — mula sa `/schedules` page. |
| **Nako-configure na mga default ng display** ([#48](https://github.com/ygncode/pi-web/issues/48)) | Itakda ang iyong gustong visibility para sa thinking, tools, at tool outputs sa lahat ng session. |
| **Git diff** (bahagi ng [#47](https://github.com/ygncode/pi-web/issues/47)) | Tingnan ang mga hindi pa na-commit na pagbabago sa working-tree sa session diff modal, na may mga review comment. |

---

## Susunod

| # | Feature | Ano ang ginagawa nito |
|---|---|---|
| [#50](https://github.com/ygncode/pi-web/issues/50) | **Telegram at Discord bots** | Makipag-chat sa pi sa pamamagitan ng Telegram o Discord — perpekto para sa mga personal assistant workflow habang nasa labas. |
| [#49](https://github.com/ygncode/pi-web/issues/49) | **Mga insight sa paggamit** | Cross-session token tracking, pagtatantya ng gastos, at analytics — lampas sa per-session breakdown sa session menu. |
| [#41](https://github.com/ygncode/pi-web/issues/41) | **`/compact` command** | I-compact ang mahahabang usapan mula mismo sa web UI, hindi na kailangan ng terminal. |

---

## Nakaplano

| # | Feature | Ano ang ginagawa nito |
|---|---|---|
| [#47](https://github.com/ygncode/pi-web/issues/47) | **File Explorer** | I-browse ang project file tree nang direkta sa pi-web. Opt-in, kaya hindi ito makakasagabal sa iyo. |
| [#43](https://github.com/ygncode/pi-web/issues/43) | **Nako-customize na mga shortcut** | I-remap ang bawat keyboard shortcut upang tumugma sa iyong muscle memory. |

---

## Pananaw

Ang pangmatagalang layunin: ang pi-web ay dapat maging **ang interface para sa pi** — para sa lahat.

- **Mga hindi dev** ang nagbubukas nito tulad ng anumang ibang app. Pumili ng modelo. Mag-type. Tapos na. Wala nang command line kailanman.
- **Mga dev** ay nakakakuha ng malalim na integrasyon — remote handoff, multi-session dashboards, git-aware browsing, messaging bots.
- **Lahat** ay nakakakuha ng kalayaan sa modelo, open-source na transparency, at isang UI na maingat na pinag-isipan sa bawat hakbang.

---

> 💡 May ideya? [Magbukas ng issue](https://github.com/ygncode/pi-web/issues/new) o sumali sa talakayan.
