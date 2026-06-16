# Pintasan Papan Kekunci

## Halaman indeks (`/`)

### Penatalan halaman (gaya vim)

Pintasan gaya vim yang sama berfungsi di semua halaman apabila fokus **bukan** dalam elemen input, textarea, atau contenteditable.

| Pintasan | Tindakan |
|----------|--------|
| `j` | Tatal ke bawah 300px |
| `k` | Tatal ke atas 300px |
| `g g` | Tatal ke atas halaman |
| `G` (Shift+G) | Tatal ke bawah halaman |
| `Escape` | Nyahfokus input aktif supaya navigasi j/k berfungsi |

### Arahan indeks

| Pintasan | Konteks | Tindakan |
|----------|---------|--------|
| `⌘K` / `Ctrl+K` | Peringkat halaman | Buka palet carian/sesi |
| `⌘⇧L` / `Ctrl+Shift+L` | Peringkat halaman | Togol tema sistem (terang/gelap) |
| `Escape` | Peringkat halaman | Tutup palet, menu, atau modal |
| `Enter` | Input laluan sesi baharu | Cipta sesi baharu |

> `⌘K` / `Ctrl+K` juga merupakan pintasan "fokus bar alamat" Chrome. Pelayar mungkin memintasnya melainkan fokus berada dalam input teks.

## Halaman butiran sesi (`/session?id=...`)

### Penatalan halaman (gaya vim)

Ini berfungsi di kedua-dua halaman indeks dan sesi apabila fokus **bukan** dalam elemen input, textarea, atau contenteditable.

| Pintasan | Tindakan |
|----------|--------|
| `j` | Tatal ke bawah 300px |
| `k` | Tatal ke atas 300px |
| `g g` | Tatal ke atas halaman |
| `G` (Shift+G) | Tatal ke bawah halaman |
| `I` (Shift+I) | Fokus textarea pengarang sembang |
| `Escape` | Nyahfokus input aktif supaya navigasi j/k berfungsi |

### Bar sisi & navigasi

| Pintasan | Konteks | Tindakan |
|----------|---------|--------|
| `⌘B` / `Ctrl+B` | Peringkat halaman | Togol keterlihatan bar sisi |
| `⌘K` / `Ctrl+K` | Peringkat halaman | Buka palet senarai sesi |
| `⌘T` / `Ctrl+T` | Peringkat halaman | Sesi baharu |
| `⌘⇧L` / `Ctrl+Shift+L` | Peringkat halaman | Togol tema sistem (terang/gelap) |
| `⌘⇧N` / `Ctrl+Shift+N` | Peringkat halaman | Togol bar sisi contengan / nota |

> `⌘K` dan `⌘T` juga merupakan pintasan pelayar (fokus bar alamat / tab baharu). Pelayar mungkin memintasnya melainkan fokus berada dalam input teks.

### Pengarang sembang

| Pintasan | Konteks | Tindakan |
|----------|---------|--------|
| `Enter` | Textarea sembang | Hantar mesej |
| `Shift+Enter` | Textarea sembang | Sisip baris baharu |
| `Shift+Tab` | Textarea sembang | Kitar ke tahap pemikiran seterusnya (`off` → `minimal` → … → `xhigh` → `off`) |
| `Ctrl+I` / `Ctrl+L` | Textarea sembang | Buka popup pemilih model (taip untuk tapis, Enter untuk pilih, fokus kembali ke textarea) |

### Togol keterlihatan entri

| Pintasan | Konteks | Tindakan |
|----------|---------|--------|
| `t` | Apabila fokus **bukan** dalam input/textarea | Togol keterlihatan pemikiran |
| `o` | Apabila fokus **bukan** dalam input/textarea | Togol keterlihatan alatan |
| `p` | Apabila fokus **bukan** dalam input/textarea | Togol output alatan |

### Palet, menu & helaian

| Pintasan | Konteks | Tindakan |
|----------|---------|--------|
| `Escape` | Peringkat halaman | Tutup sebarang palet, menu, atau helaian yang terbuka |
| `⌘K` / `Ctrl+K` | Peringkat halaman | Buka palet senarai sesi |
| `ArrowUp` / `ArrowDown` | Palet senarai sesi | Navigasi hasil sesi |
| `Enter` | Palet senarai sesi | Buka sesi yang dipilih (atau pertama) |
| `ArrowUp` / `ArrowDown` | Popup pemilih model | Navigasi senarai model |
| `Enter` | Popup pemilih model | Pilih model yang diserlahkan |
| `ArrowUp` / `ArrowDown` | Modal cabang | Navigasi mesej |
| `Enter` | Modal cabang | Cabang dari mesej yang diserlahkan |
| `Tab` | Helaian skrin penuh | Kitar fokus dalam helaian |
| `Escape` | Helaian skrin penuh | Tutup helaian |
