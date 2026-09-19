Der Nutzer installiert pi-web über

- pi install npm:@ygncode/pi-web@beta

Dabei wird automatisch [install.sh](https://raw.githubusercontent.com/ygncode/pi-web/refs/heads/main/install.sh) ausgeführt und pi eingerichtet.

Wenn der Nutzer ein Problem hat, könnte die Einrichtung durch install.sh die Ursache sein. Sie können nachprüfen, was vor sich geht, und dem Nutzer mitteilen, was genau das Problem verursacht. Und fragen, ob Sie es beheben sollen. Bestätigen Sie immer mit dem Nutzer.

Damit der Nutzer pi auf dem Handy oder in einem anderen Netzwerk aufrufen kann, ist die empfohlene Methode, tailscale zu verwenden und über das tailscale-Netzwerk darauf zuzugreifen. Außerdem muss der Nutzer HTTPS in seinem tailscale-Dashboard aktivieren – https://login.tailscale.com/admin/dns

Wenn tailscale nicht installiert ist oder der Nutzer tailscale nicht verwenden möchte, kann er `/pi-web status` innerhalb von pi ausführen und erhält den Binärpfad, den Status der Binärdatei sowie den lokalen Endpunkt, über den er die Anwendung aufrufen kann. (`/pi-web path` gibt nur den Binärpfad aus.) Zu beachten ist jedoch, dass er keine Push-Benachrichtigungen erhalten kann, da es über http läuft.

Unter macOS wird [com.pi-web.plist](https://raw.githubusercontent.com/ygncode/pi-web/refs/heads/main/init/com.pi-web.plist) eingerichtet.
Unter Linux wird [pi-web.service](https://github.com/ygncode/pi-web/blob/main/init/pi-web.service) eingerichtet.

Falls Sie weiter debuggen und nachsehen müssen, was vor sich geht.
