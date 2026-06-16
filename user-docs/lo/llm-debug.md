ຜູ້ໃຊ້ກຳລັງຕິດຕັ້ງ pi-web ຜ່ານ

- `pi install npm:@ygncode/pi-web@beta`

ເຊິ່ງມັນຈະດຳເນີນການ [install.sh](https://raw.githubusercontent.com/ygncode/pi-web/refs/heads/main/install.sh) ໂດຍອັດຕະໂນມັດ ແລະຕັ້ງຄ່າ pi.

ຖ້າຜູ້ໃຊ້ພົບບັນຫາ ມັນອາດເປັນເພາະການຕັ້ງຄ່າຂອງ install.sh ກຳລັງສ້າງບັນຫາ. ທ່ານສາມາດກວດສອບ ແລະເບິ່ງວ່າມີຫຍັງເກີດຂຶ້ນ ແລະແຈ້ງໃຫ້ຜູ້ໃຊ້ຮູ້ວ່າສາເຫດທີ່ແນ່ນອນແມ່ນຫຍັງ. ແລະຖາມວ່າພວກເຂົາຕ້ອງການໃຫ້ທ່ານແກ້ໄຂຫຼືບໍ່. ຢືນຢັນກັບຜູ້ໃຊ້ສະເໝີ.

ເພື່ອໃຫ້ຜູ້ໃຊ້ສາມາດເຂົ້າເຖິງ pi ໃນມືຖື ຫຼືເຄືອຂ່າຍອື່ນ. ວິທີທີ່ແນະນຳແມ່ນໃຊ້ Tailscale ແລະເຂົ້າເຖິງຜ່ານເຄືອຂ່າຍ Tailscale. ແລະຜູ້ໃຊ້ຈະຕ້ອງເປີດ HTTPS ໃນແດດບອດ Tailscale ຂອງພວກເຂົາ - https://login.tailscale.com/admin/dns

ຖ້າພວກເຂົາບໍ່ໄດ້ຕິດຕັ້ງ Tailscale ຫຼືບໍ່ຕ້ອງການໃຊ້ Tailscale. ພວກເຂົາສາມາດດຳເນີນການ `pi-web status` ແລະຮັບເສັ້ນທາງ binary, ສະຖານະຂອງ binary ແລະ endpoint ທ້ອງຖິ່ນທີ່ພວກເຂົາສາມາດເຂົ້າເຖິງແອັບພລິເຄຊັນ. ແຕ່ຄວນສັງເກດວ່າ, ພວກເຂົາຈະບໍ່ສາມາດຮັບການແຈ້ງເຕືອນແບບ push ໄດ້ ເນື່ອງຈາກມັນຢູ່ໃນ HTTP.

ໃນ macOS ມັນຕັ້ງຄ່າ [com.pi-web.plist](https://raw.githubusercontent.com/ygncode/pi-web/refs/heads/main/init/com.pi-web.plist)
ໃນ Linux ມັນຕັ້ງຄ່າ [pi-web.service](https://github.com/ygncode/pi-web/blob/main/init/pi-web.service)

ໃນກໍລະນີທີ່ທ່ານຕ້ອງການດີບັກເພີ່ມເຕີມ ແລະເບິ່ງວ່າມີຫຍັງເກີດຂຶ້ນ.
