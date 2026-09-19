# pi-web sebagai Asisten Pribadi Anda

pi-web bukan hanya untuk coding — Anda bisa mengubahnya menjadi **asisten AI pribadi** yang tinggal di komputer Anda, seperti memiliki OpenClaw atau Hermes sendiri.

## Cara kerjanya

Anda membuat folder khusus di mesin Anda — di situlah asisten Anda tinggal. Di dalamnya, Anda masukkan file `APPEND_SYSTEM.md` yang menentukan siapa asisten Anda, apa yang diketahuinya, dan bagaimana perilakunya. pi-web memberi Anda antarmuka chat yang indah untuk berbicara dengannya dari perangkat mana pun.

## Langkah demi langkah

### 1. Buat folder asisten Anda

Pilih sebuah folder di komputer Anda. Sesuatu seperti:

```
~/my-assistant/
```

### 2. Tentukan asisten Anda

Buat file `APPEND_SYSTEM.md` di dalam folder tersebut. Di sinilah Anda memberi tahu pi siapa asisten Anda:

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

pi secara otomatis menambahkan ini ke system prompt setiap percakapan, sehingga asisten Anda selalu tahu siapa Anda dan bagaimana cara membantu.

### 3. Mulai sesi di folder tersebut

Di pi-web, buat sesi baru yang diarahkan ke `~/my-assistant/` (atau nama apa pun yang Anda berikan). Itu saja — Anda sedang berbicara dengan asisten pribadi Anda.

### 4. Gunakan dari mana saja

Instal pi-web sebagai PWA di ponsel, tablet, atau laptop Anda. Asisten Anda selalu ada — tanyakan apa saja, kapan saja.

## Ide untuk asisten Anda

| Peran | Yang dimasukkan ke APPEND_SYSTEM.md |
|---|---|
| 🧠 **Pelatih kehidupan** | Tujuan Anda, kebiasaan yang sedang Anda kembangkan, prompt jurnal |
| 🏠 **Manajer rumah** | Format daftar belanja, preferensi anggota keluarga, perencanaan menu |
| 💼 **Teman kerja** | Peran Anda, proyek saat ini, format catatan rapat, konteks perusahaan |
| 📚 **Teman belajar** | Yang sedang Anda pelajari, gaya penjelasan yang disukai, mode kuis |
| ✍️ **Asisten menulis** | Gaya menulis Anda, preferensi nada, format umum yang Anda gunakan |

## Tambahkan lebih banyak konteks

Anda bisa meletakkan apa pun di folder asisten Anda yang membantu pi menjadi lebih berguna:

- `notes/` — file referensi yang bisa dibaca asisten Anda
- `context.md` — informasi latar belakang tentang kehidupan atau pekerjaan Anda
- `projects.md` — proyek saat ini dan statusnya

pi dapat membaca file di folder tersebut, jadi semakin banyak konteks yang Anda berikan, semakin baik kinerjanya.

## Minta pi-web melakukan berbagai hal

Setelah `pi install npm:@ygncode/pi-web@beta`, sesi dapat berbicara langsung dengan pi-web.
Coba:

- "Tambahkan jadwal pukul 2 pagi waktu Singapura untuk merangkum inbox saya"
- "Tampilkan jadwal pi-web saya"
- "Jeda jadwal inbox"
- "Tulis ini di catatan"
- "Ganti pi-web ke mode gelap / matikan judul otomatis"

Skill bawaan **/skill:pi-web-schedule** mengubah itu menjadi jadwal pi-web yang nyata
(sama seperti yang Anda edit di `/schedules`). Setiap pemicu memulai sesi **baru**,
jadi instruksinya harus berdiri sendiri — "rangkum email yang belum dibaca di
~/inbox" berhasil; "lanjutkan apa yang sedang kita kerjakan" tidak.

Jadwal hanya berjalan selama pi-web berjalan.

---

> 💡 **Tips:** Mulai dari yang sederhana. Cukup beberapa baris tentang siapa Anda dan bagaimana Anda ingin asisten itu berperilaku. Lakukan iterasi seiring waktu saat Anda belajar apa yang berhasil.
