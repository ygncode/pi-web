# pi-web als dein persönlicher Assistent

pi-web ist nicht nur zum Programmieren da — du kannst es in einen **persönlichen KI-Assistenten** verwandeln, der auf deinem Computer lebt, wie dein eigener OpenClaw oder Hermes.

## So funktioniert's

Du erstellst einen eigenen Ordner auf deinem Rechner — dort lebt dein Assistent. Darin legst du eine `APPEND_SYSTEM.md`-Datei ab, die festlegt, wer dein Assistent ist, was er weiß und wie er sich verhält. pi-web bietet dir eine schöne Chat-Oberfläche, um von jedem Gerät aus mit ihm zu sprechen.

## Schritt für Schritt

### 1. Erstelle deinen Assistent-Ordner

Wähle einen Ordner auf deinem Computer. Zum Beispiel:

```
~/my-assistant/
```

### 2. Definiere deinen Assistenten

Erstelle eine `APPEND_SYSTEM.md`-Datei in diesem Ordner. Hier sagst du pi, wer dein Assistent ist:

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

pi hängt dies automatisch an den System-Prompt jeder Unterhaltung an, sodass dein Assistent immer weiß, wer du bist und wie er helfen kann.

### 3. Starte eine Sitzung in diesem Ordner

Erstelle in pi-web eine neue Sitzung, die auf `~/my-assistant/` (oder wie auch immer du sie genannt hast) verweist. Das war's — du sprichst mit deinem persönlichen Assistenten.

### 4. Nutze ihn von überall

Installiere pi-web als PWA auf deinem Handy, Tablet oder Laptop. Dein Assistent ist immer da — frag ihn alles, jederzeit.

## Ideen für deinen Assistenten

| Rolle | Was in die APPEND_SYSTEM.md gehört |
|---|---|
| 🧠 **Life-Coach** | Deine Ziele, Gewohnheiten, an denen du arbeitest, Anregungen zum Tagebuchschreiben |
| 🏠 **Haushaltsmanager** | Einkaufslisten-Format, Vorlieben der Familienmitglieder, Essensplanung |
| 💼 **Arbeits-Buddy** | Deine Rolle, aktuelle Projekte, Format für Besprechungsnotizen, Unternehmenskontext |
| 📚 **Lernpartner** | Was du lernst, bevorzugter Erklärstil, Prüf-mich-Modus |
| ✍️ **Schreibassistent** | Dein Schreibstil, bevorzugter Ton, häufig genutzte Formate |

## Füge mehr Kontext hinzu

Du kannst alles in deinen Assistent-Ordner legen, was pi nützlicher macht:

- `notes/` — Referenzdateien, die dein Assistent lesen kann
- `context.md` — Hintergrundinformationen über dein Leben oder deine Arbeit
- `projects.md` — aktuelle Projekte und deren Status

pi kann Dateien im Ordner lesen. Je mehr Kontext du gibst, desto besser wird es.

---

> 💡 **Tipp:** Fang einfach an. Nur ein paar Zeilen darüber, wer du bist und wie sich der Assistent verhalten soll. Entwickle es mit der Zeit weiter, wenn du herausfindest, was funktioniert.
