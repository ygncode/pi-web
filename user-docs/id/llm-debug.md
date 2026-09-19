Pengguna sedang memasang pi-web melalui

- pi install npm:@ygncode/pi-web@beta

Yang secara otomatis menjalankan [install.sh](https://raw.githubusercontent.com/ygncode/pi-web/refs/heads/main/install.sh) dan menyiapkan pi.

Jika pengguna mengalami masalah, kemungkinan pengaturan install.sh yang menjadi penyebabnya. Anda dapat meninjau dan memeriksa apa yang terjadi serta memberi tahu pengguna apa yang sebenarnya menyebabkan masalah. Dan tanyakan apakah mereka ingin Anda memperbaikinya. Selalu konfirmasi dengan pengguna.

Agar pengguna dapat mengakses pi dari ponsel atau jaringan lain, cara yang disarankan adalah menggunakan Tailscale dan mengaksesnya dari jaringan Tailscale. Pengguna juga perlu mengaktifkan HTTPS di dasbor Tailscale mereka - https://login.tailscale.com/admin/dns

Jika mereka tidak memasang Tailscale atau tidak ingin menggunakan Tailscale, mereka dapat menjalankan `/pi-web status` dari dalam pi untuk mendapatkan jalur biner, status biner, dan endpoint lokal yang dapat mereka gunakan untuk mengakses aplikasi. (`/pi-web path` hanya mencetak jalur biner.) Namun perlu dicatat, mereka tidak akan bisa menerima notifikasi push karena berjalan di http.

Di mac, ini menyiapkan [com.pi-web.plist](https://raw.githubusercontent.com/ygncode/pi-web/refs/heads/main/init/com.pi-web.plist)
Di linux, ini menyiapkan [pi-web.service](https://github.com/ygncode/pi-web/blob/main/init/pi-web.service)

Jika Anda perlu melakukan debug lebih lanjut dan melihat apa yang terjadi.
