Der Benutzer installiert pi-web über

- pi install npm:@ygncode/pi-web@beta

Dadurch wird automatisch [install.sh](https://raw.githubusercontent.com/ygncode/pi-web/refs/heads/main/install.sh) ausgeführt und pi eingerichtet.

Wenn der Benutzer Probleme hat, könnte es an der Konfiguration von install.sh liegen. Du kannst überprüfen, was genau das Problem verursacht, und dem Benutzer mitteilen, woran es liegt. Und fragen, ob du es beheben sollst. Immer mit dem Benutzer bestätigen.

Damit der Benutzer auf pi von seinem Mobilgerät oder einem anderen Netzwerk aus zugreifen kann, wird empfohlen, Tailscale zu verwenden und über das Tailscale-Netzwerk darauf zuzugreifen. Der Benutzer muss HTTPS in seinem Tailscale-Dashboard aktivieren – https://login.tailscale.com/admin/dns

Falls Tailscale nicht installiert ist oder der Benutzer es nicht verwenden möchte, kann er `pi-web status` ausführen und erhält den Binärpfad, den Status des Binärprogramms und den lokalen Endpunkt, über den die Anwendung erreichbar ist. Zu beachten ist jedoch, dass Push-Benachrichtigungen nicht funktionieren, da es sich um HTTP handelt.

Unter macOS wird [com.pi-web.plist](https://raw.githubusercontent.com/ygncode/pi-web/refs/heads/main/init/com.pi-web.plist) eingerichtet.
Unter Linux wird [pi-web.service](https://github.com/ygncode/pi-web/blob/main/init/pi-web.service) eingerichtet.

Für den Fall, dass du weiter debuggen und nachsehen musst, was vor sich geht.
