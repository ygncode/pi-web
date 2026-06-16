# pi-web sebagai Asisten Pribadi Anda

pi-web bukan hanya untuk coding — Anda bisa mengubahnya menjadi **asisten AI pribadi** yang tinggal di komputer Anda, seperti memiliki OpenClaw atau Hermes sendiri.

## Cara kerjanya

Anda membuat folder khusus di mesin Anda — di situlah asisten Anda tinggal. Di dalamnya, Anda masukkan file `APPEND_SYSTEM.md` yang mendefinisikan siapa asisten Anda, apa yang diketahuinya, dan bagaimana ia bersikap. pi-web memberi Anda antarmuka chat yang cantik untuk berbicara dengannya dari perangkat mana pun.

## Langkah demi langkah

### 1. Buat folder asisten Anda

Pilih folder di komputer Anda. Misalnya seperti:

```
~/my-assistant/
```

### 2. Definisikan asisten Anda

Buat file `APPEND_SYSTEM.md` di dalam folder tersebut. Di sinilah Anda memberi tahu pi siapa asisten Anda:

```markdown
# Asisten Pribadi Saya

Anda adalah Jarvis, asisten AI pribadi saya. Anda membantu saya dengan:

- Perencanaan harian dan pengingat
- Riset dan peringkasan
- Menyusun email dan pesan
- Brainstorming ide
- Mencatat hal-hal yang saya sebutkan

## Tentang saya

- Saya seorang software engineer yang bekerja remote
- Saya punya kucing bernama Pixel
- Saya lebih suka jawaban singkat dan langsung
- Zona waktu saya PST

## Aturan

- Singkat saja — saya menghargai keringkasan
- Jika Anda tidak tahu sesuatu, katakan saja
- Ingatkan saya secara proaktif tentang hal-hal yang saya minta untuk dilacak
```

pi secara otomatis menambahkan ini ke system prompt setiap percakapan, sehingga asisten Anda selalu tahu siapa Anda dan bagaimana cara membantu.

### 3. Mulai sesi di folder tersebut

Di pi-web, buat sesi baru yang diarahkan ke `~/my-assistant/` (atau apa pun nama foldernya). Selesai — Anda sedang berbicara dengan asisten pribadi Anda.

### 4. Gunakan dari mana saja

Pasang pi-web sebagai PWA di ponsel, tablet, atau laptop Anda. Asisten Anda selalu ada — tanyakan apa saja, kapan saja.

## Ide untuk asisten Anda

| Peran | Apa yang dimasukkan ke APPEND_SYSTEM.md |
|---|---|
| 🧠 **Pelatih hidup** | Tujuan Anda, kebiasaan yang sedang Anda bangun, prompt jurnal |
| 🏠 **Manajer rumah** | Format daftar belanja, preferensi anggota keluarga, perencanaan makan |
| 💼 **Rekan kerja** | Peran Anda, proyek saat ini, format catatan rapat, konteks perusahaan |
| 📚 **Teman belajar** | Apa yang sedang Anda pelajari, gaya penjelasan yang disukai, mode kuis |
| ✍️ **Asisten menulis** | Gaya menulis Anda, preferensi nada, format umum yang Anda gunakan |

## Tambahkan lebih banyak konteks

Anda bisa meletakkan apa saja di folder asisten yang membantu pi menjadi lebih berguna:

- `notes/` — file referensi yang bisa dibaca asisten Anda
- `context.md` — informasi latar belakang tentang hidup atau pekerjaan Anda
- `projects.md` — proyek saat ini dan statusnya

pi bisa membaca file di dalam folder, jadi semakin banyak konteks yang Anda berikan, semakin baik kinerjanya.

---

> 💡 **Tips:** Mulailah dengan sederhana. Cukup beberapa baris tentang siapa Anda dan bagaimana Anda ingin asisten bersikap. Lakukan iterasi seiring waktu saat Anda mempelajari apa yang berhasil.
