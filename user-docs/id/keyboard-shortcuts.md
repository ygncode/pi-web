# Pintasan Keyboard

## Halaman indeks (`/`)

### Pengguliran halaman (gaya vim)

Pintasan gaya vim yang sama berfungsi di semua halaman saat fokus **tidak** berada di dalam elemen input, textarea, atau contenteditable.

| Pintasan | Tindakan |
|----------|--------|
| `j` | Gulir ke bawah 300px |
| `k` | Gulir ke atas 300px |
| `g g` | Gulir ke atas halaman |
| `G` (Shift+G) | Gulir ke bawah halaman |
| `Escape` | Menghilangkan fokus dari input aktif agar navigasi j/k berfungsi |

### Perintah indeks

| Pintasan | Konteks | Tindakan |
|----------|---------|--------|
| `⌘K` / `Ctrl+K` | Tingkat halaman | Buka palet pencarian/sesi |
| `⌘⇧L` / `Ctrl+Shift+L` | Tingkat halaman | Alihkan tema sistem (terang/gelap) |
| `Escape` | Tingkat halaman | Tutup palet, menu, atau modal |
| `Enter` | Input jalur sesi baru | Buat sesi baru |

> `⌘K` / `Ctrl+K` juga merupakan pintasan "fokus bilah alamat" Chrome. Peramban mungkin mencegatnya kecuali jika fokus berada di dalam input teks.

## Halaman detail sesi (`/session?id=...`)

### Pengguliran halaman (gaya vim)

Ini berfungsi di halaman indeks dan sesi saat fokus **tidak** berada di dalam elemen input, textarea, atau contenteditable.

| Pintasan | Tindakan |
|----------|--------|
| `j` | Gulir ke bawah 300px |
| `k` | Gulir ke atas 300px |
| `g g` | Gulir ke atas halaman |
| `G` (Shift+G) | Gulir ke bawah halaman |
| `I` (Shift+I) | Fokuskan textarea penulis obrolan |
| `Escape` | Menghilangkan fokus dari input aktif agar navigasi j/k berfungsi |

### Sidebar & navigasi

| Pintasan | Konteks | Tindakan |
|----------|---------|--------|
| `⌘B` / `Ctrl+B` | Tingkat halaman | Alihkan visibilitas sidebar |
| `⌘K` / `Ctrl+K` | Tingkat halaman | Buka palet daftar sesi |
| `⌘T` / `Ctrl+T` | Tingkat halaman | Sesi baru |
| `⌘⇧L` / `Ctrl+Shift+L` | Tingkat halaman | Alihkan tema sistem (terang/gelap) |
| `⌘⇧N` / `Ctrl+Shift+N` | Tingkat halaman | Alihkan sidebar coretan/catatan |

> `⌘K` dan `⌘T` juga merupakan pintasan peramban (fokus bilah alamat / tab baru). Peramban mungkin mencegatnya kecuali jika fokus berada di dalam input teks.

### Penulis obrolan

| Pintasan | Konteks | Tindakan |
|----------|---------|--------|
| `Enter` | Textarea obrolan | Kirim pesan |
| `Shift+Enter` | Textarea obrolan | Sisipkan baris baru |
| `Shift+Tab` | Textarea obrolan | Beralih ke tingkat berpikir berikutnya (`off` → `minimal` → … → `xhigh` → `off`) |
| `Ctrl+I` / `Ctrl+L` | Textarea obrolan | Buka popup pemilih model (ketik untuk menyaring, Enter untuk memilih, fokus kembali ke textarea) |

### Pengalih visibilitas entri

| Pintasan | Konteks | Tindakan |
|----------|---------|--------|
| `t` | Saat fokus **tidak** berada di input/textarea | Alihkan visibilitas pemikiran |
| `o` | Saat fokus **tidak** berada di input/textarea | Alihkan visibilitas alat |
| `p` | Saat fokus **tidak** berada di input/textarea | Alihkan keluaran alat |

### Palet, menu & lembar

| Pintasan | Konteks | Tindakan |
|----------|---------|--------|
| `Escape` | Tingkat halaman | Tutup palet, menu, atau lembar yang terbuka |
| `⌘K` / `Ctrl+K` | Tingkat halaman | Buka palet daftar sesi |
| `ArrowUp` / `ArrowDown` | Palet daftar sesi | Navigasi hasil sesi |
| `Enter` | Palet daftar sesi | Buka sesi yang dipilih (atau pertama) |
| `ArrowUp` / `ArrowDown` | Popup pemilih model | Navigasi daftar model |
| `Enter` | Popup pemilih model | Pilih model yang disorot |
| `ArrowUp` / `ArrowDown` | Modal fork | Navigasi pesan |
| `Enter` | Modal fork | Fork dari pesan yang disorot |
| `Tab` | Lembar layar penuh | Alihkan fokus dalam lembar |
| `Escape` | Lembar layar penuh | Tutup lembar |
