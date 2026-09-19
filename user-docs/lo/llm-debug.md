ຜູ້ໃຊ້ກຳລັງຕິດຕັ້ງ pi-web ຜ່ານ 

- pi install npm:@ygncode/pi-web@beta

ເຊິ່ງມັນຈະດຳເນີນການ [install.sh](https://raw.githubusercontent.com/ygncode/pi-web/refs/heads/main/install.sh) ແລະ ຕັ້ງຄ່າ pi ໂດຍອັດຕະໂນມັດ.

ຖ້າຜູ້ໃຊ້ກຳລັງມີບັນຫາ ມັນອາດເປັນຍ້ອນການຕັ້ງຄ່າຂອງ install.sh ເປັນສາເຫດຂອງບັນຫາ. ທ່ານສາມາດກວດສອບ ແລະ ກວດເບິ່ງວ່າມີຫຍັງເກີດຂຶ້ນ ແລະ ແຈ້ງໃຫ້ຜູ້ໃຊ້ຮູ້ວ່າອັນໃດແທ້ທີ່ເປັນສາເຫດຂອງບັນຫາ. ແລະ ຖາມວ່າພວກເຂົາຕ້ອງການໃຫ້ທ່ານແກ້ໄຂຫຼືບໍ່. ຕ້ອງຢືນຢັນກັບຜູ້ໃຊ້ສະເໝີ.

ເພື່ອໃຫ້ຜູ້ໃຊ້ສາມາດເຂົ້າເຖິງ pi ຈາກມືຖືຂອງພວກເຂົາ ຫຼື ເຄືອຂ່າຍອື່ນ. ວິທີທີ່ແນະນຳແມ່ນໃຊ້ Tailscale ແລະ ເຂົ້າເຖິງຜ່ານເຄືອຂ່າຍ Tailscale. ແລະ ຜູ້ໃຊ້ຈະຕ້ອງເປີດໃຊ້ HTTPS ໃນ dashboard ຂອງ Tailscale - https://login.tailscale.com/admin/dns

ຖ້າພວກເຂົາບໍ່ໄດ້ຕິດຕັ້ງ Tailscale ຫຼື ບໍ່ຕ້ອງການໃຊ້ Tailscale. ພວກເຂົາສາມາດຮັນ `/pi-web status` ຈາກພາຍໃນ pi ແລະ ໄດ້ຮັບ binary path, ສະຖານະຂອງ binary ແລະ endpoint ພາຍໃນ ທີ່ພວກເຂົາສາມາດເຂົ້າເຖິງແອັບພລິເຄຊັນໄດ້. (`/pi-web path` ພິມພຽງ binary path ເທົ່ານັ້ນ.) ແຕ່ຄວນຮູ້ວ່າ ພວກເຂົາຈະບໍ່ສາມາດຮັບ push notification ໄດ້ ເພາະມັນຢູ່ໃນ http.

ໃນ macOS ມັນຈະຕັ້ງຄ່າ [com.pi-web.plist](https://raw.githubusercontent.com/ygncode/pi-web/refs/heads/main/init/com.pi-web.plist)
ໃນ Linux ມັນຈະຕັ້ງຄ່າ [pi-web.service](https://github.com/ygncode/pi-web/blob/main/init/pi-web.service)

ໃນກໍລະນີທີ່ທ່ານຕ້ອງການ debug ເພີ່ມເຕີມ ແລະ ເບິ່ງວ່າມີຫຍັງເກີດຂຶ້ນ.
