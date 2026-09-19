# Ang pi-web bilang Iyong Personal na Assistant

Ang pi-web ay hindi lang para sa coding — maaari mo itong gawing **personal AI assistant** na naninirahan sa iyong computer, tulad ng pagkakaroon ng sarili mong OpenClaw o Hermes.

## Paano ito gumagana

Gumagawa ka ng nakalaang folder sa iyong machine — doon naninirahan ang iyong assistant. Sa loob nito, ilalagay mo ang isang `APPEND_SYSTEM.md` file na nagtatakda kung sino ang iyong assistant, kung ano ang alam nito, at kung paano ito kumikilos. Binibigyan ka ng pi-web ng magandang chat interface para makausap ito mula sa anumang device.

## Hakbang-hakbang

### 1. Gumawa ng folder para sa iyong assistant

Pumili ng folder sa iyong computer. Halimbawa:

```
~/my-assistant/
```

### 2. Itakda ang iyong assistant

Gumawa ng `APPEND_SYSTEM.md` file sa loob ng folder na iyon. Dito mo sasabihin kay pi kung sino ang iyong assistant:

```markdown
# My Personal Assistant

You are Jarvis, my personal AI assistant. You help me with:

- Daily planning and reminders
- Research and summarization
- Drafting emails and messages
- Brainstorming ideas
- Keeping track of things I mention

## About me

- I'm a software engineer who works remotely
- I have a cat named Pixel
- I prefer short, direct answers
- My timezone is PST

## Rules

- Be concise — I value brevity
- If you don't know something, say so
- Proactively remind me of things I asked you to track
```

Awtomatikong idinaragdag ito ng pi sa system prompt ng bawat pag-uusap, kaya laging alam ng iyong assistant kung sino ka at kung paano makatulong.

### 3. Magsimula ng session sa folder na iyon

Sa pi-web, gumawa ng bagong session na nakaturo sa `~/my-assistant/` (o anuman ang ipinangalan mo rito). Iyon na — kausap mo na ang iyong personal assistant.

### 4. Gamitin ito kahit saan

I-install ang pi-web bilang PWA sa iyong phone, tablet, o laptop. Lagi nandiyan ang iyong assistant — tanungin ito ng kahit ano, anumang oras.

## Mga ideya para sa iyong assistant

| Role | Ano ang ilalagay sa APPEND_SYSTEM.md |
|---|---|
| 🧠 **Life coach** | Ang iyong mga layunin, mga habit na pinagbubuti mo, mga prompt sa journaling |
| 🏠 **Home manager** | Format ng grocery list, mga kagustuhan ng mga miyembro ng pamilya, pagpaplano ng pagkain |
| 💼 **Work buddy** | Ang iyong role, mga kasalukuyang project, format ng meeting notes, konteksto ng kumpanya |
| 📚 **Study partner** | Ano ang pinag-aaralan mo, gustong istilo ng pagpapaliwanag, mode na pag-quiz sa akin |
| ✍️ **Writing assistant** | Ang iyong istilo ng pagsusulat, mga kagustuhan sa tono, mga karaniwang format na ginagamit mo |

## Magdagdag ng karagdagang konteksto

Maaari mong ilagay ang kahit ano sa folder ng iyong assistant na makakatulong para maging mas kapaki-pakinabang ang pi:

- `notes/` — mga reference file na mababasa ng iyong assistant
- `context.md` — background information tungkol sa iyong buhay o trabaho
- `projects.md` — mga kasalukuyang project at ang kanilang status

Nababasa ng pi ang mga file sa folder, kaya habang mas maraming konteksto ang ibibigay mo, mas lalo itong gumagaling.

## Hilingin sa pi-web na gumawa ng mga bagay

Pagkatapos ng `pi install npm:@ygncode/pi-web@beta`, maaari nang kausapin ng mga session ang pi-web mismo.
Subukan:

- “Magdagdag ng schedule sa 2am Singapore time para i-summarize ang inbox ko”
- “Ilista ang aking mga pi-web schedule”
- “I-pause ang inbox schedule”
- “Isulat ito sa notes”
- “Ilipat ang pi-web sa dark mode / i-off ang auto-title”

Ginagawa ng kasamang **/skill:pi-web-schedule** skill ang mga iyon bilang tunay na pi-web
schedule (ang mga iyon din na ini-edit mo sa `/schedules`). Ang bawat pag-trigger ay nagsisimula ng **bagong**
session, kaya dapat kaya nitong tumayo nang mag-isa ang mga instruction — gumagana ang “i-summarize ang hindi pa nababasang mail sa
~/inbox”; hindi gumagana ang “ituloy ang ginagawa natin”.

Tumatakbo lamang ang mga schedule habang tumatakbo ang pi-web.

---

> 💡 **Tip:** Magsimula nang simple. Ilang linya lang tungkol sa kung sino ka at kung paano mo gustong kumilos ang assistant. Pagbutihin ito sa paglipas ng panahon habang natututuhan mo kung ano ang gumagana.
