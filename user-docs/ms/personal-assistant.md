# pi-web sebagai Pembantu Peribadi Anda

pi-web bukan sekadar untuk pengekodan — anda boleh mengubahnya menjadi **pembantu AI peribadi** yang berada di komputer anda, seperti memiliki OpenClaw atau Hermes anda sendiri.

## Cara ia berfungsi

Anda mencipta folder khusus pada mesin anda — di situlah pembantu anda tinggal. Di dalamnya, anda letakkan fail `APPEND_SYSTEM.md` yang mentakrifkan siapa pembantu anda, apa yang diketahuinya, dan bagaimana ia bertindak. pi-web memberikan anda antara muka sembang yang cantik untuk bercakap dengannya dari mana-mana peranti.

## Langkah demi langkah

### 1. Cipta folder pembantu anda

Pilih folder pada komputer anda. Contohnya:

```
~/my-assistant/
```

### 2. Takrifkan pembantu anda

Cipta fail `APPEND_SYSTEM.md` di dalam folder itu. Di sinilah anda memberitahu pi siapa pembantu anda:

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

pi secara automatik menambahkan ini ke dalam system prompt setiap perbualan, jadi pembantu anda sentiasa tahu siapa anda dan bagaimana untuk membantu.

### 3. Mulakan sesi dalam folder itu

Dalam pi-web, cipta sesi baharu yang ditujukan ke `~/my-assistant/` (atau apa sahaja yang anda namakan). Itu sahaja — anda sedang bercakap dengan pembantu peribadi anda.

### 4. Gunakannya dari mana-mana

Pasang pi-web sebagai PWA pada telefon, tablet, atau komputer riba anda. Pembantu anda sentiasa ada — tanya apa sahaja, bila-bila masa.

## Idea untuk pembantu anda

| Peranan | Apa yang perlu diletakkan dalam APPEND_SYSTEM.md |
|---|---|
| 🧠 **Jurulatih hidup** | Matlamat anda, tabiat yang sedang anda usahakan, panduan penjurnalan |
| 🏠 **Pengurus rumah** | Format senarai barangan runcit, keutamaan ahli keluarga, perancangan makanan |
| 💼 **Rakan kerja** | Peranan anda, projek semasa, format nota mesyuarat, konteks syarikat |
| 📚 **Rakan belajar** | Apa yang anda sedang pelajari, gaya penerangan pilihan, mod kuiz saya |
| ✍️ **Pembantu penulisan** | Gaya penulisan anda, pilihan nada, format biasa yang anda gunakan |

## Tambah lebih banyak konteks

Anda boleh letakkan apa sahaja dalam folder pembantu anda yang membantu pi menjadi lebih berguna:

- `notes/` — fail rujukan yang boleh dibaca oleh pembantu anda
- `context.md` — maklumat latar belakang tentang kehidupan atau kerja anda
- `projects.md` — projek semasa dan statusnya

pi boleh membaca fail dalam folder itu, jadi semakin banyak konteks yang anda berikan, semakin baik ia menjadi.

---

> 💡 **Tip:** Mulakan dengan ringkas. Hanya beberapa baris tentang siapa anda dan bagaimana anda mahu pembantu itu bertindak. Perbaiki dari semasa ke semasa apabila anda belajar apa yang berkesan.
