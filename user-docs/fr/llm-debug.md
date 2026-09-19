L'utilisateur installe pi-web via

- pi install npm:@ygncode/pi-web@beta

ce qui exécute automatiquement [install.sh](https://raw.githubusercontent.com/ygncode/pi-web/refs/heads/main/install.sh) et configure pi.

Si l'utilisateur rencontre un problème, il se peut que la configuration d'install.sh en soit la cause. Vous pouvez examiner et vérifier ce qui se passe et indiquer à l'utilisateur ce qui cause exactement le problème. Et demander s'il souhaite que vous le corrigiez. Confirmez toujours avec l'utilisateur.

Afin que l'utilisateur puisse accéder à pi depuis son mobile ou un autre réseau, la méthode recommandée est d'utiliser tailscale et d'y accéder depuis le réseau tailscale. L'utilisateur devra activer le HTTPs dans son tableau de bord tailscale - https://login.tailscale.com/admin/dns

S'ils n'ont pas tailscale installé ou ne souhaitent pas utiliser tailscale, ils peuvent exécuter `/pi-web status` depuis pi et obtenir le chemin du binaire, le statut du binaire et le point de terminaison local via lequel ils peuvent accéder à l'application. (`/pi-web path` affiche uniquement le chemin du binaire.) À noter toutefois qu'ils ne pourront pas recevoir de notification push, car c'est en http.

Sous mac, il configure [com.pi-web.plist](https://raw.githubusercontent.com/ygncode/pi-web/refs/heads/main/init/com.pi-web.plist)
Sous linux, il configure [pi-web.service](https://github.com/ygncode/pi-web/blob/main/init/pi-web.service)

Au cas où vous auriez besoin de déboguer davantage et de voir ce qui se passe.
