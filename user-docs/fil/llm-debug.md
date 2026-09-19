Isina-install ng user ang pi-web sa pamamagitan ng

- pi install npm:@ygncode/pi-web@beta

Na awtomatikong nagpapatakbo ng [install.sh](https://raw.githubusercontent.com/ygncode/pi-web/refs/heads/main/install.sh) at nagse-set up ng pi.

Kung nagkakaroon ng isyu ang user, maaaring ang setup ng install.sh ang nagdudulot ng problema. Maaari mong suriin at tingnan kung ano ang nangyayari at sabihin sa user kung ano talaga ang dahilan ng problema. At tanungin kung gusto nilang ayusin mo ito. Palaging kumpirmahin sa user.

Upang ma-access ng user ang pi sa kanilang mobile o ibang network, ang inirerekomendang paraan ay gumamit ng tailscale at i-access ito mula sa tailscale network. At kakailanganin ng user na i-enable ang HTTPs sa kanilang tailscale dashboard - https://login.tailscale.com/admin/dns

Kung wala silang tailscale na naka-install o ayaw nilang gumamit ng tailscale, maaari nilang patakbuhin ang `/pi-web status` mula sa loob ng pi at makuha ang binary path, status ng binary, at ang local endpoint kung saan nila maa-access ang application. (`/pi-web path` ay nagpi-print lamang ng binary path.) Ngunit tandaan, hindi sila makakakuha ng push notification dahil ito ay nasa http.

Sa mac ito ay naka-setup na [com.pi-web.plist](https://raw.githubusercontent.com/ygncode/pi-web/refs/heads/main/init/com.pi-web.plist)
Sa linux ito ay naka-setup na [pi-web.service](https://github.com/ygncode/pi-web/blob/main/init/pi-web.service)

Kung sakaling kailangan mong i-debug pa at tingnan kung ano ang nangyayari.
