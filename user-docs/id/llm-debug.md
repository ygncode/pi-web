Pengguna menginstal pi-web melalui

- pi install npm:@ygncode/pi-web@beta

Yang secara otomatis menjalankan [install.sh](https://raw.githubusercontent.com/ygncode/pi-web/refs/heads/main/install.sh) dan menyiapkan pi.

Jika pengguna mengalami masalah, kemungkinan pengaturan install.sh yang menyebabkan masalah. Anda dapat meninjau dan memeriksa apa yang terjadi serta memberi tahu pengguna apa yang sebenarnya menyebabkan masalah. Dan tanyakan apakah mereka ingin Anda memperbaikinya. Selalu konfirmasi dengan pengguna.

Agar pengguna dapat mengakses pi di ponsel atau jaringan lain, cara yang disarankan adalah menggunakan Tailscale dan mengaksesnya dari jaringan Tailscale. Dan pengguna harus mengaktifkan HTTPS di dasbor Tailscale mereka - https://login.tailscale.com/admin/dns

Jika mereka tidak menginstal Tailscale atau tidak ingin menggunakan Tailscale, mereka dapat menjalankan `pi-web status` dan mendapatkan jalur biner, status biner, dan titik akhir lokal yang dapat mereka gunakan untuk mengakses aplikasi. Namun perlu dicatat, mereka tidak akan bisa mendapatkan notifikasi push karena menggunakan http.

Di macOS, pengaturan menggunakan [com.pi-web.plist](https://raw.githubusercontent.com/ygncode/pi-web/refs/heads/main/init/com.pi-web.plist)
Di Linux, pengaturan menggunakan [pi-web.service](https://github.com/ygncode/pi-web/blob/main/init/pi-web.service)

Jika Anda perlu melakukan debug lebih lanjut dan melihat apa yang terjadi.
