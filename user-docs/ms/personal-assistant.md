# pi-web sebagai Pembantu Peribadi Anda

pi-web bukan sekadar untuk pengkodan — anda boleh menjadikannya sebagai **pembantu AI peribadi** yang tinggal di komputer anda, seperti memiliki OpenClaw atau Hermes anda sendiri.

## Cara ia berfungsi

Anda mencipta folder khusus pada mesin anda — di situlah pembantu anda tinggal. Di dalamnya, anda letakkan fail `APPEND_SYSTEM.md` yang menentukan siapa pembantu anda, apa yang diketahuinya, dan bagaimana ia bertingkah laku. pi-web memberikan anda antara muka sembang yang cantik untuk bercakap dengannya dari mana-mana peranti.

## Langkah demi langkah

### 1. Cipta folder pembantu anda

Pilih folder pada komputer anda. Contohnya:

```
~/my-assistant/
```

### 2. Tentukan pembantu anda

Cipta fail `APPEND_SYSTEM.md` di dalam folder tersebut. Di sinilah anda memberitahu pi siapa pembantu anda:

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

pi secara automatik menambah ini pada prompt sistem setiap perbualan, jadi pembantu anda sentiasa tahu siapa anda dan cara untuk membantu.

### 3. Mulakan sesi dalam folder tersebut

Dalam pi-web, cipta sesi baharu yang menunjuk ke `~/my-assistant/` (atau apa sahaja nama yang anda berikan). Itu sahaja — anda sedang bercakap dengan pembantu peribadi anda.

### 4. Gunakannya dari mana-mana

Pasang pi-web sebagai PWA pada telefon, tablet, atau komputer riba anda. Pembantu anda sentiasa ada — tanya apa sahaja, pada bila-bila masa.

## Idea untuk pembantu anda

| Peranan | Apa yang perlu diletakkan dalam APPEND_SYSTEM.md |
|---|---|
| 🧠 **Jurulatih hidup** | Matlamat anda, tabiat yang sedang anda usahakan, panduan penulisan jurnal |
| 🏠 **Pengurus rumah** | Format senarai barang dapur, keutamaan ahli keluarga, perancangan makanan |
| 💼 **Rakan kerja** | Peranan anda, projek semasa, format nota mesyuarat, konteks syarikat |
| 📚 **Rakan belajar** | Apa yang anda pelajari, gaya penerangan yang disukai, mod kuiz saya |
| ✍️ **Pembantu penulisan** | Gaya penulisan anda, keutamaan nada, format biasa yang anda gunakan |

## Tambah lebih banyak konteks

Anda boleh meletakkan apa sahaja dalam folder pembantu anda yang membantu pi menjadi lebih berguna:

- `notes/` — fail rujukan yang boleh dibaca oleh pembantu anda
- `context.md` — maklumat latar belakang tentang kehidupan atau kerja anda
- `projects.md` — projek semasa dan statusnya

pi boleh membaca fail dalam folder tersebut, jadi semakin banyak konteks yang anda berikan, semakin baik ia menjadi.

## Minta pi-web untuk melakukan sesuatu

Selepas `pi install npm:@ygncode/pi-web@beta`, sesi boleh bercakap dengan pi-web itu sendiri.
Cuba:

- "Tambah jadual pada pukul 2 pagi waktu Singapura untuk meringkaskan peti masuk saya"
- "Senaraikan jadual pi-web saya"
- "Hentikan jadual peti masuk"
- "Tulis ini dalam nota"
- "Tukar pi-web ke mod gelap / matikan tajuk automatik"

**/skill:pi-web-schedule** yang dibundel menukarkan itu menjadi jadual pi-web
sebenar (yang sama yang anda edit di `/schedules`). Setiap pencetusan memulakan sesi
**baharu**, jadi arahan perlu berdiri sendiri — "ringkaskan mel belum dibaca dalam
~/inbox" berfungsi; "sambung apa yang sedang kita buat" tidak berfungsi.

Jadual hanya berjalan semasa pi-web sedang berjalan.

---

> 💡 **Petua:** Mulakan dengan mudah. Hanya beberapa baris tentang siapa anda dan bagaimana anda mahu pembantu itu bertingkah laku. Ulang secara beransur-ansur mengikut masa sambil anda belajar apa yang berkesan.
