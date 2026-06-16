Ang user ay nag-i-install ng pi-web sa pamamagitan ng

- `pi install npm:@ygncode/pi-web@beta`

Na awtomatikong nagpapatakbo ng [install.sh](https://raw.githubusercontent.com/ygncode/pi-web/refs/heads/main/install.sh) at nagse-setup ng pi.

Kung ang user ay nagkakaroon ng isyu, maaaring ang setup ng install.sh ang nagdudulot ng problema. Maaari mong suriin at tingnan kung ano ang nangyayari at ibigay sa user kung ano talaga ang sanhi ng problema. At tanungin kung gusto nilang ayusin mo ito. Laging kumpirmahin sa user.

Upang ma-access ng user ang pi sa kanilang mobile o ibang network, ang inirerekomendang paraan ay ang paggamit ng Tailscale at i-access ito mula sa Tailscale network. At kailangang i-enable ng user ang HTTPS sa kanilang Tailscale dashboard - https://login.tailscale.com/admin/dns

Kung wala silang Tailscale na naka-install o ayaw nilang gumamit ng Tailscale, maaari nilang patakbuhin ang `pi-web status` at makuha ang binary path, status ng binary at ang local endpoint kung saan nila maa-access ang application. Ngunit tandaan, hindi nila makukuha ang push notification dahil ito ay nasa http.

Sa macOS ito ay naka-setup bilang [com.pi-web.plist](https://raw.githubusercontent.com/ygncode/pi-web/refs/heads/main/init/com.pi-web.plist)
Sa Linux ito ay naka-setup bilang [pi-web.service](https://github.com/ygncode/pi-web/blob/main/init/pi-web.service)

Kung sakaling kailangan mong mag-debug nang mas malalim at tingnan kung ano ang nangyayari.
