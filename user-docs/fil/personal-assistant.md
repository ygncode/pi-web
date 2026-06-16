# pi-web bilang Iyong Pansariling Katulong

Ang pi-web ay hindi lang para sa coding — maaari mo itong gawing **personal na AI assistant** na nakatira sa iyong computer, tulad ng pagkakaroon ng sarili mong OpenClaw o Hermes.

## Paano ito gumagana

Gumagawa ka ng dedikadong folder sa iyong makina — doon nakatira ang iyong katulong. Sa loob nito, naglalagay ka ng `APPEND_SYSTEM.md` file na nagtatakda kung sino ang iyong katulong, kung ano ang alam nito, at kung paano ito kumilos. Binibigyan ka ng pi-web ng magandang chat interface para makausap ito mula sa anumang device.

## Hakbang-hakbang

### 1. Gawin ang iyong assistant folder

Pumili ng folder sa iyong computer. Tulad ng:

```
~/my-assistant/
```

### 2. Itakda ang iyong katulong

Gumawa ng `APPEND_SYSTEM.md` file sa loob ng folder na iyon. Dito mo sasabihin kay pi kung sino ang iyong katulong:

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

Awtomatikong idinadagdag ito ng pi sa system prompt ng bawat pag-uusap, kaya laging alam ng iyong katulong kung sino ka at kung paano tumulong.

### 3. Magsimula ng session sa folder na iyon

Sa pi-web, gumawa ng bagong session na nakaturo sa `~/my-assistant/` (o kung anuman ang ipinangalan mo rito). Iyon lang — nakikipag-usap ka na sa iyong pansariling katulong.

### 4. Gamitin ito kahit saan

I-install ang pi-web bilang PWA sa iyong telepono, tablet, o laptop. Laging nariyan ang iyong katulong — tanungin ito ng kahit ano, kahit kailan.

## Mga ideya para sa iyong katulong

| Papel | Kung ano ang ilalagay sa APPEND_SYSTEM.md |
|---|---|
| 🧠 **Life coach** | Iyong mga layunin, mga gawi na pinagbubuti mo, mga prompt sa journal |
| 🏠 **Tagapamahala ng tahanan** | Format ng listahan ng grocery, mga kagustuhan ng miyembro ng pamilya, pagpaplano ng pagkain |
| 💼 **Kasama sa trabaho** | Iyong tungkulin, mga kasalukuyang proyekto, format ng meeting notes, konteksto ng kumpanya |
| 📚 **Kasama sa pag-aaral** | Kung ano ang iyong pinag-aaralan, gustong istilo ng pagpapaliwanag, quiz mode |
| ✍️ **Katulong sa pagsusulat** | Iyong istilo ng pagsusulat, mga kagustuhan sa tono, mga karaniwang format na ginagamit mo |

## Magdagdag ng karagdagang konteksto

Maaari kang maglagay ng kahit ano sa iyong assistant folder na makakatulong para maging mas kapaki-pakinabang ang pi:

- `notes/` — mga reference file na mababasa ng iyong katulong
- `context.md` — impormasyon sa background tungkol sa iyong buhay o trabaho
- `projects.md` — mga kasalukuyang proyekto at ang kanilang estado

Nababasa ng pi ang mga file sa folder, kaya kung mas maraming konteksto ang ibibigay mo, lalo itong gumagaling.

---

> 💡 **Tip:** Magsimula nang simple. Ilang linya lang tungkol sa kung sino ka at kung paano mo gustong kumilos ang katulong. Baguhin-baguhin sa paglipas ng panahon habang natututunan mo kung ano ang epektibo.
