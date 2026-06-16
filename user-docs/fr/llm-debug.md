L'utilisateur installe pi-web via

- pi install npm:@ygncode/pi-web@beta

Ce qui exécute automatiquement [install.sh](https://raw.githubusercontent.com/ygncode/pi-web/refs/heads/main/install.sh) et configure pi.

Si l'utilisateur rencontre des problèmes, il est possible que la configuration d'install.sh en soit la cause. Vous pouvez examiner et vérifier ce qui se passe et indiquer à l'utilisateur la cause exacte du problème. Et demander s'ils souhaitent que vous corrigiez le problème. Toujours confirmer avec l'utilisateur.

Pour que l'utilisateur puisse accéder à pi sur son mobile ou un autre réseau, la méthode recommandée est d'utiliser tailscale et d'y accéder via le réseau tailscale. L'utilisateur devra activer le HTTPS dans son tableau de bord tailscale - https://login.tailscale.com/admin/dns

S'ils n'ont pas tailscale installé ou ne souhaitent pas utiliser tailscale, ils peuvent exécuter `pi-web status` et obtenir le chemin du binaire, l'état du binaire et le point d'accès local à partir duquel ils peuvent accéder à l'application. Notez cependant qu'ils ne pourront pas recevoir les notifications push car la connexion est en http.

Sur macOS, il est configuré avec [com.pi-web.plist](https://raw.githubusercontent.com/ygncode/pi-web/refs/heads/main/init/com.pi-web.plist)
Sur Linux, il est configuré avec [pi-web.service](https://github.com/ygncode/pi-web/blob/main/init/pi-web.service)

Au cas où vous auriez besoin de déboguer davantage pour comprendre ce qui se passe.
