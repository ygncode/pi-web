# Pintasan Papan Kekunci

## Halaman indeks (`/`)

### Skrol halaman (gaya vim)

Pintasan gaya vim yang sama berfungsi pada semua halaman apabila fokus **bukan** pada elemen input, textarea, atau contenteditable.

| Pintasan | Tindakan |
|----------|--------|
| `j` | Skrol ke bawah 300px |
| `k` | Skrol ke atas 300px |
| `g g` | Skrol ke atas halaman |
| `G` (Shift+G) | Skrol ke bawah halaman |
| `Escape` | Nyahfokus input aktif supaya navigasi j/k berfungsi |

### Perintah indeks

| Pintasan | Konteks | Tindakan |
|----------|---------|--------|
| `⌘K` / `Ctrl+K` | Peringkat halaman | Buka palet carian/sesi |
| `⌘,` / `Ctrl+,` | Peringkat halaman | Buka tetapan |
| `⌘⇧L` / `Ctrl+Shift+L` | Peringkat halaman | Togol tema sistem (terang/gelap) |
| `Escape` | Peringkat halaman | Tutup palet, menu, atau modal |
| `Enter` | Input laluan sesi baharu | Cipta sesi baharu |

> `⌘K` / `Ctrl+K` juga ialah pintasan "fokus bar alamat" Chrome. Penyemak imbas mungkin memintasnya melainkan fokus berada di dalam input teks.

## Halaman butiran sesi (`/session?id=...`)

### Skrol halaman (gaya vim)

Ini berfungsi pada kedua-dua halaman indeks dan sesi apabila fokus **bukan** pada elemen input, textarea, atau contenteditable.

| Pintasan | Tindakan |
|----------|--------|
| `j` | Skrol ke bawah 300px |
| `k` | Skrol ke atas 300px |
| `g g` | Skrol ke atas halaman |
| `G` (Shift+G) | Skrol ke bawah halaman |
| `I` (Shift+I) | Fokus textarea pengarang sembang |
| `Escape` | Nyahfokus input aktif supaya navigasi j/k berfungsi |

### Bar sisi & navigasi

| Pintasan | Konteks | Tindakan |
|----------|---------|--------|
| `⌘B` / `Ctrl+B` | Peringkat halaman | Togol keterlihatan bar sisi |
| `⌘K` / `Ctrl+K` | Peringkat halaman | Buka palet senarai sesi |
| `⌘T` / `Ctrl+T` | Peringkat halaman | Sesi baharu |
| `⌘/` / `Ctrl+/` | Peringkat halaman | Paparkan modal pintasan papan kekunci |
| `⌘,` / `Ctrl+,` | Peringkat halaman | Buka tetapan |
| `⌘⇧L` / `Ctrl+Shift+L` | Peringkat halaman | Togol tema sistem (terang/gelap) |
| `⌘⇧N` / `Ctrl+Shift+N` | Peringkat halaman | Togol bar sisi pad conteng / nota |

> `⌘K` dan `⌘T` juga ialah pintasan penyemak imbas (fokus bar alamat / tab baharu). Penyemak imbas mungkin memintasnya melainkan fokus berada di dalam input teks.

### Pengarang sembang

| Pintasan | Konteks | Tindakan |
|----------|---------|--------|
| `Enter` | Textarea sembang | Hantar mesej |
| `Shift+Enter` | Textarea sembang | Sisip baris baharu |
| `Shift+Tab` | Textarea sembang | Kitar ke tahap pemikiran seterusnya (`off` → `minimal` → … → `xhigh` → `off`) |
| `Ctrl+I` / `Ctrl+L` | Textarea sembang | Buka pop timbul pemilih model (taip untuk menapis, Enter untuk memilih, fokus kembali ke textarea) |

### Togol keterlihatan entri

| Pintasan | Konteks | Tindakan |
|----------|---------|--------|
| `t` | Apabila fokus **bukan** dalam input/textarea | Togol keterlihatan pemikiran |
| `o` | Apabila fokus **bukan** dalam input/textarea | Togol keterlihatan alat |
| `p` | Apabila fokus **bukan** dalam input/textarea | Togol output alat |

### Palet, menu & helaian

| Pintasan | Konteks | Tindakan |
|----------|---------|--------|
| `Escape` | Peringkat halaman | Tutup mana-mana palet, menu, atau helaian yang terbuka |
| `⌘K` / `Ctrl+K` | Peringkat halaman | Buka palet senarai sesi |
| `ArrowUp` / `ArrowDown` | Palet senarai sesi | Navigasi hasil sesi |
| `Enter` | Palet senarai sesi | Buka sesi yang dipilih (atau yang pertama) |
| `ArrowUp` / `ArrowDown` | Pop timbul pemilih model | Navigasi senarai model |
| `Enter` | Pop timbul pemilih model | Pilih model yang diserlahkan |
| `ArrowUp` / `ArrowDown` | Modal fork | Navigasi mesej |
| `Enter` | Modal fork | Fork daripada mesej yang diserlahkan |
| `Tab` | Helaian skrin penuh | Kitar fokus dalam helaian |
| `Escape` | Helaian skrin penuh | Tutup helaian |
