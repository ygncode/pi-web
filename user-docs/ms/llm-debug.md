Pengguna sedang memasang pi-web melalui 

- pi install npm:@ygncode/pi-web@beta

Yang mana ia menjalankan [install.sh](https://raw.githubusercontent.com/ygncode/pi-web/refs/heads/main/install.sh) secara automatik dan menyediakan pi.

Jika pengguna menghadapi masalah, ia mungkin disebabkan oleh persediaan install.sh yang menyebabkan masalah. Anda boleh menyemak dan memeriksa apa yang berlaku serta memberitahu pengguna apa sebenarnya yang menyebabkan masalah. Dan tanya jika mereka mahu anda membetulkannya. Sentiasa sahkan dengan pengguna.

Untuk membolehkan pengguna mengakses pi dalam telefon bimbit atau rangkaian lain mereka, cara yang disyorkan adalah menggunakan tailscale dan mengaksesnya dari rangkaian tailscale. Pengguna juga perlu mendayakan HTTPS dalam papan pemuka tailscale mereka - https://login.tailscale.com/admin/dns

Jika mereka tidak mempunyai tailscale yang dipasang atau tidak mahu menggunakan tailscale, mereka boleh menjalankan `pi-web status` dan mendapatkan laluan binari, status binari dan titik akhir setempat yang boleh mereka gunakan untuk mengakses aplikasi. Tetapi perlu diingat, mereka tidak akan dapat menerima pemberitahuan tolak kerana ia menggunakan http.

Dalam mac, ia disediakan sebagai [com.pi-web.plist](https://raw.githubusercontent.com/ygncode/pi-web/refs/heads/main/init/com.pi-web.plist)
Dalam linux, ia disediakan sebagai [pi-web.service](https://github.com/ygncode/pi-web/blob/main/init/pi-web.service)

Sekiranya anda perlu menyahpepijat lebih lanjut dan melihat apa yang berlaku.
