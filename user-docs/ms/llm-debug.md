Pengguna sedang memasang pi-web melalui

- pi install npm:@ygncode/pi-web@beta

Yang mana ia secara automatik menjalankan [install.sh](https://raw.githubusercontent.com/ygncode/pi-web/refs/heads/main/install.sh) dan menyediakan pi.

Jika pengguna menghadapi masalah, mungkin persediaan install.sh yang menyebabkan masalah. Anda boleh menyemak dan memeriksa apa yang berlaku serta memberitahu pengguna apa sebenarnya yang menyebabkan masalah tersebut. Dan tanya sama ada mereka mahu anda membetulkannya. Sentiasa sahkan dengan pengguna.

Untuk membolehkan pengguna mengakses pi pada telefon bimbit atau rangkaian lain, cara yang disyorkan ialah menggunakan Tailscale dan mengaksesnya melalui rangkaian Tailscale. Pengguna juga perlu mendayakan HTTPS dalam papan pemuka Tailscale mereka - https://login.tailscale.com/admin/dns

Jika mereka tidak memasang Tailscale atau tidak mahu menggunakan Tailscale, mereka boleh menjalankan `/pi-web status` dari dalam pi untuk mendapatkan laluan binari, status binari dan titik akhir setempat yang boleh mereka akses aplikasi tersebut. (`/pi-web path` hanya mencetak laluan binari.) Tetapi perlu diingat, mereka tidak akan dapat menerima notifikasi tolak kerana ia menggunakan http.

Pada macOS ia disediakan melalui [com.pi-web.plist](https://raw.githubusercontent.com/ygncode/pi-web/refs/heads/main/init/com.pi-web.plist)
Pada Linux ia disediakan melalui [pi-web.service](https://github.com/ygncode/pi-web/blob/main/init/pi-web.service)

Sekiranya anda perlu menyahpepijat dengan lebih lanjut dan melihat apa yang berlaku.
