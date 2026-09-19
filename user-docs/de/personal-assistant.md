# pi-web als dein persönlicher Assistent

pi-web ist nicht nur zum Programmieren da — du kannst es in einen **persönlichen KI-Assistenten** verwandeln, der auf deinem Computer lebt, so als hättest du dein eigenes OpenClaw oder Hermes.

## So funktioniert es

Du legst auf deinem Rechner einen eigenen Ordner an — dort lebt dein Assistent. Darin legst du eine Datei `APPEND_SYSTEM.md` ab, die festlegt, wer dein Assistent ist, was er weiß und wie er sich verhält. pi-web bietet dir eine schöne Chat-Oberfläche, um von jedem Gerät aus mit ihm zu sprechen.

## Schritt für Schritt

### 1. Erstelle deinen Assistenten-Ordner

Wähle einen Ordner auf deinem Computer. Zum Beispiel:

```
~/my-assistant/
```

### 2. Definiere deinen Assistenten

Erstelle in diesem Ordner eine Datei `APPEND_SYSTEM.md`. Hier teilst du pi mit, wer dein Assistent ist:

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

Erstelle in pi-web eine neue Sitzung, die auf `~/my-assistant/` zeigt (oder wie auch immer du sie genannt hast). Das war's — du sprichst mit deinem persönlichen Assistenten.

### 4. Nutze ihn von überall

Installiere pi-web als PWA auf deinem Handy, Tablet oder Laptop. Dein Assistent ist immer da — frag ihn alles, jederzeit.

## Ideen für deinen Assistenten

| Rolle | Was du in APPEND_SYSTEM.md schreibst |
|---|---|
| 🧠 **Life-Coach** | Deine Ziele, Gewohnheiten, an denen du arbeitest, Journaling-Anregungen |
| 🏠 **Haushaltsmanager** | Format der Einkaufsliste, Vorlieben der Familienmitglieder, Essensplanung |
| 💼 **Arbeitsbuddy** | Deine Rolle, aktuelle Projekte, Format für Meeting-Notizen, Unternehmenskontext |
| 📚 **Lernpartner** | Was du lernst, bevorzugter Erklärstil, Quiz-Modus |
| ✍️ **Schreibassistent** | Dein Schreibstil, Tonvorlieben, gängige Formate, die du verwendest |

## Füge mehr Kontext hinzu

Du kannst alles in deinen Assistenten-Ordner legen, was pi nützlicher macht:

- `notes/` — Referenzdateien, die dein Assistent lesen kann
- `context.md` — Hintergrundinformationen über dein Leben oder deine Arbeit
- `projects.md` — aktuelle Projekte und ihr Status

pi kann Dateien im Ordner lesen — je mehr Kontext du gibst, desto besser wird es.

## Lass pi-web Dinge erledigen

Nach `pi install npm:@ygncode/pi-web@beta` können Sitzungen mit pi-web selbst sprechen.
Probiere es aus:

- „Lege einen Zeitplan um 2 Uhr Singapur-Zeit an, um meinen Posteingang zusammenzufassen“
- „Liste meine pi-web-Zeitpläne auf“
- „Pausiere den Posteingangs-Zeitplan“
- „Schreib das in die Notizen“
- „Stelle pi-web auf den dunklen Modus um / schalte die automatische Titelvergabe aus“

Der mitgelieferte Skill **/skill:pi-web-schedule** macht daraus einen echten pi-web-Zeitplan (dieselben, die du unter `/schedules` bearbeitest). Jede Ausführung startet eine **neue** Sitzung, daher müssen die Anweisungen für sich allein stehen — „fasse ungelesene E-Mails in ~/inbox zusammen“ funktioniert; „mach weiter, wo wir aufgehört haben“ nicht.

Zeitpläne laufen nur, während pi-web läuft.

---

> 💡 **Tipp:** Fang einfach an. Nur ein paar Zeilen darüber, wer du bist und wie sich der Assistent verhalten soll. Verbessere es mit der Zeit, wenn du merkst, was funktioniert.
