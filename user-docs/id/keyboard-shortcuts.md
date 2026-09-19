# Pintasan Keyboard

## Halaman indeks (`/`)

### Pengguliran halaman (gaya vim)

Pintasan gaya vim yang sama berfungsi di semua halaman ketika fokus **tidak** berada di elemen input, textarea, atau contenteditable.

| Pintasan | Aksi |
|----------|--------|
| `j` | Gulir ke bawah 300px |
| `k` | Gulir ke atas 300px |
| `g g` | Gulir ke atas halaman |
| `G` (Shift+G) | Gulir ke bawah halaman |
| `Escape` | Hilangkan fokus dari input aktif agar navigasi j/k berfungsi |

### Perintah indeks

| Pintasan | Konteks | Aksi |
|----------|---------|--------|
| `⌘K` / `Ctrl+K` | Tingkat halaman | Buka palet pencarian/sesi |
| `⌘,` / `Ctrl+,` | Tingkat halaman | Buka pengaturan |
| `⌘⇧L` / `Ctrl+Shift+L` | Tingkat halaman | Alihkan tema sistem (terang/gelap) |
| `Escape` | Tingkat halaman | Tutup palet, menu, atau modal |
| `Enter` | Input path sesi baru | Buat sesi baru |

> `⌘K` / `Ctrl+K` juga merupakan pintasan "fokus bilah alamat" Chrome. Browser mungkin mencegatnya kecuali fokus berada di dalam input teks.

## Halaman detail sesi (`/session?id=...`)

### Pengguliran halaman (gaya vim)

Ini berfungsi di halaman indeks maupun sesi ketika fokus **tidak** berada di elemen input, textarea, atau contenteditable.

| Pintasan | Aksi |
|----------|--------|
| `j` | Gulir ke bawah 300px |
| `k` | Gulir ke atas 300px |
| `g g` | Gulir ke atas halaman |
| `G` (Shift+G) | Gulir ke bawah halaman |
| `I` (Shift+I) | Fokus ke textarea penyusun obrolan |
| `Escape` | Hilangkan fokus dari input aktif agar navigasi j/k berfungsi |

### Sidebar & navigasi

| Pintasan | Konteks | Aksi |
|----------|---------|--------|
| `⌘B` / `Ctrl+B` | Tingkat halaman | Alihkan visibilitas sidebar |
| `⌘K` / `Ctrl+K` | Tingkat halaman | Buka palet daftar sesi |
| `⌘T` / `Ctrl+T` | Tingkat halaman | Sesi baru |
| `⌘/` / `Ctrl+/` | Tingkat halaman | Tampilkan modal pintasan keyboard |
| `⌘,` / `Ctrl+,` | Tingkat halaman | Buka pengaturan |
| `⌘⇧L` / `Ctrl+Shift+L` | Tingkat halaman | Alihkan tema sistem (terang/gelap) |
| `⌘⇧N` / `Ctrl+Shift+N` | Tingkat halaman | Alihkan sidebar papan coretan / catatan |

> `⌘K` dan `⌘T` juga merupakan pintasan browser (fokus bilah alamat / tab baru). Browser mungkin mencegatnya kecuali fokus berada di dalam input teks.

### Penyusun obrolan

| Pintasan | Konteks | Aksi |
|----------|---------|--------|
| `Enter` | Textarea obrolan | Kirim pesan |
| `Shift+Enter` | Textarea obrolan | Sisipkan baris baru |
| `Shift+Tab` | Textarea obrolan | Beralih ke tingkat pemikiran berikutnya (`off` → `minimal` → … → `xhigh` → `off`) |
| `Ctrl+I` / `Ctrl+L` | Textarea obrolan | Buka popup pemilih model (ketik untuk memfilter, Enter untuk memilih, fokus kembali ke textarea) |

### Pengalih visibilitas entri

| Pintasan | Konteks | Aksi |
|----------|---------|--------|
| `t` | Ketika fokus **tidak** berada di input/textarea | Alihkan visibilitas pemikiran |
| `o` | Ketika fokus **tidak** berada di input/textarea | Alihkan visibilitas alat |
| `p` | Ketika fokus **tidak** berada di input/textarea | Alihkan keluaran alat |

### Palet, menu & lembar

| Pintasan | Konteks | Aksi |
|----------|---------|--------|
| `Escape` | Tingkat halaman | Tutup palet, menu, atau lembar yang terbuka |
| `⌘K` / `Ctrl+K` | Tingkat halaman | Buka palet daftar sesi |
| `ArrowUp` / `ArrowDown` | Palet daftar sesi | Navigasi hasil sesi |
| `Enter` | Palet daftar sesi | Buka sesi yang dipilih (atau yang pertama) |
| `ArrowUp` / `ArrowDown` | Popup pemilih model | Navigasi daftar model |
| `Enter` | Popup pemilih model | Pilih model yang disorot |
| `ArrowUp` / `ArrowDown` | Modal fork | Navigasi pesan |
| `Enter` | Modal fork | Fork dari pesan yang disorot |
| `Tab` | Lembar layar penuh | Pindahkan fokus secara bergilir di dalam lembar |
| `Escape` | Lembar layar penuh | Tutup lembar |
