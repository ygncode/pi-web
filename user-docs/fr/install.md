# Installation & Utilisation

## Fonctionnalités

### Contrôle à distance

- Reprendre n'importe quelle session depuis le navigateur avec des pièces jointes texte ou image
- Démarrer une toute nouvelle session sur n'importe quel chemin de projet, directement depuis l'interface web
- Sélection du modèle et du niveau de réflexion dans le navigateur, par session
- Statut de worker par session (inactif / en cours / erreur) avec récupération automatique en cas de plantage
- Plusieurs sessions s'exécutent en parallèle — lancez du travail dans l'une, regardez une autre diffuser en continu
- `PI_WEB_TOKEN` pour une exposition sûre au LAN — requis par défaut pour toute liaison explicite non-loopback

### Lecture des sessions

- Parcourir les sessions entre les projets avec des filtres, une recherche et une navigation complète entre les branches
- Mises à jour incrémentales en direct pendant que pi est encore en cours d'exécution (via fsnotify ; latence de l'ordre de la ms)
- Mode suivi pour suivre les sessions actives
- Liens profonds vers des messages individuels
- Télécharger une session au format JSONL
- Partager des instantanés statiques sous forme de Gists GitHub secrets
- Extensions pi `/web`, `/remote`, `/refresh`, `/pi-web token` et `/pi-web set-token` pour ouvrir des sessions, le QR distant, la synchronisation des sessions et la gestion des jetons
- `/skill:pi-web-schedule`, `/skill:pi-web-notes`, `/skill:pi-web-settings` (`pi-web-ctl`) afin qu'une session puisse gérer les planifications, le bloc-notes du projet et les réglages en langage naturel

## Prérequis

- [Go](https://go.dev) 1.25+ (uniquement pour compiler depuis les sources)
- `pi` dans votre `PATH` pour le chat dans le navigateur et la sélection de modèle
- Facultatif : `gh` pour le partage
- Sous Windows : pi a besoin d'un shell bash pour son outil shell — [Git for Windows](https://git-scm.com/download/win) suffit (voir la documentation Windows de pi)

## Installation

### Paquet Pi (recommandé)

```bash
pi install npm:@ygncode/pi-web@beta
```

Cette commande unique :
- Installe le paquet npm pi dans le répertoire des paquets de pi
- Exécute le script `postinstall` du paquet (`install.sh`, ou `install.ps1` sous Windows)
- Télécharge le binaire pi-web correspondant à la version de votre paquet et à votre plateforme depuis GitHub Releases
- L'installe dans `~/.pi/agent/bin/pi-web` (`pi-web.exe` sous Windows)
- Configure le démarrage automatique à la connexion (launchd sous macOS, systemd sous Linux, un lanceur de clé Run sous Windows)
- Enregistre les commandes pi `/web`, `/remote`, `/refresh`, `/pi-web token` et `/pi-web set-token`

Le titrage automatique des sessions est intégré à pi-web (et non à l'extension) et se configure sur la page `/settings`. Il est activé par défaut : pi-web nomme automatiquement les sessions à l'aide d'une heuristique de mots intégrée gratuite (sans IA), en re-titrant à chaque nouveau message. Vous pouvez passer à un titrage unique par session, et/ou choisir un modèle pour rédiger des titres plus intelligents au lieu de l'heuristique.

Sous Linux, le démarrage automatique est configuré comme un service systemd utilisateur dans `~/.config/systemd/user/pi-web.service`. L'installateur réécrit son `ExecStart` vers le chemin réel du binaire installé. Si Tailscale est disponible à l'exécution, pi-web publie le serveur localhost avec Tailscale Serve HTTPS. Si systemd utilisateur n'est pas disponible, lancez-le manuellement avec `~/.pi/agent/bin/pi-web -o`.

Pour installer uniquement pour un projet spécifique (partagé avec votre équipe via `.pi/settings.json`) :

```bash
pi install -l npm:@ygncode/pi-web@beta
```

Redémarrez ensuite pi (ou exécutez `/reload`), puis utilisez `/web`, `/pi-web`, `/remote`, `/refresh`. Gérez votre jeton d'accès avec `/pi-web token` et `/pi-web set-token`.

Si npm échoue avec `ENOTEMPTY` lors du renommage de `@ygncode/pi-web`, supprimez les répertoires de sauvegarde cachés obsolètes de npm et réinstallez le canal beta :

```bash
rm -rf ~/.pi/agent/npm/node_modules/@ygncode/.pi-web-*
pi install npm:@ygncode/pi-web@beta
```

### Installation rapide (aucun outil de compilation requis)

macOS / Linux :

```bash
curl -fsSL https://raw.githubusercontent.com/ygncode/pi-web/main/install.sh | bash
```

Windows (PowerShell) :

```powershell
irm https://raw.githubusercontent.com/ygncode/pi-web/main/install.ps1 | iex
```

Cela télécharge le dernier binaire pi-web, l'installe dans `/usr/local/bin` (`~/.pi/agent/bin` sous Windows) et configure le démarrage automatique à la connexion. Aucun Go, Node ou pi requis.

### Télécharger le binaire

Les binaires précompilés sont joints à chaque [GitHub Release](https://github.com/ygncode/pi-web/releases).

```bash
# macOS (Apple Silicon)
curl -L -o pi-web https://github.com/ygncode/pi-web/releases/latest/download/pi-web-darwin-arm64
chmod +x pi-web

# macOS (Intel)
curl -L -o pi-web https://github.com/ygncode/pi-web/releases/latest/download/pi-web-darwin-amd64
chmod +x pi-web

# Linux (amd64)
curl -L -o pi-web https://github.com/ygncode/pi-web/releases/latest/download/pi-web-linux-amd64
chmod +x pi-web

# Linux (arm64)
curl -L -o pi-web https://github.com/ygncode/pi-web/releases/latest/download/pi-web-linux-arm64
chmod +x pi-web
```

```powershell
# Windows (x64)
irm -OutFile pi-web.exe https://github.com/ygncode/pi-web/releases/latest/download/pi-web-windows-amd64.exe

# Windows (ARM64)
irm -OutFile pi-web.exe https://github.com/ygncode/pi-web/releases/latest/download/pi-web-windows-arm64.exe
```

Déplacez-le ensuite dans votre PATH :

```bash
cp pi-web ~/.pi/agent/bin/
# ou à l'échelle du système :
sudo cp pi-web /usr/local/bin/
```

### Compiler depuis les sources

```bash
git clone https://github.com/ygncode/pi-web.git
cd pi-web
make build   # compile le bundle Vite, puis l'intègre dans le binaire Go

# facultatif : le placer dans le PATH
cp pi-web ~/.pi/agent/bin/
```

Le bundle frontend est intégré par `web/assets_embed.go`, donc `go build` a besoin
que `web/dist` existe d'abord. `make build` effectue les deux étapes dans l'ordre ; si vous compilez
à la main, exécutez `npm --prefix web install && npm --prefix web run build` avant
`go build ./cmd/pi-web`.

### Développer aux côtés d'une instance installée

Laissez l'instance installée tourner sur le port `31415`, puis démarrez la copie
de travail des sources en mode développement :

```bash
make dev
```

Ouvrez `http://127.0.0.1:31416`. `make dev` définit l'environnement de
développement interne `PI_WEB_DEV=1`, afin que la copie de travail partage les sessions, les réglages et
les données SQLite avec l'instance installée tout en conservant un verrou d'exécution et un fichier d'état de développement séparés.
Les instances installées régulières et lancées manuellement
restent inchangées et conservent le comportement d'instance unique d'origine.

Pour éviter un travail autonome en double, le mode développement n'exécute pas la
boucle de planification, le drain de la file de chat, le titrage automatique ni les notifications push. Les requêtes
directes effectuées via l'interface de développement fonctionnent toujours. Ne pilotez pas la même
session de chat depuis les deux instances en même temps ; chaque processus possède son propre gestionnaire de workers RPC.

`make dev` nécessite [Air](https://github.com/air-verse/air) pour le rechargement à chaud de Go :

```bash
go install github.com/air-verse/air@latest
```

`PI_WEB_DEV` est un mécanisme interne de développement, et non un mode
multi-instance de production pris en charge.

## Désinstallation

```bash
pi remove npm:@ygncode/pi-web@beta
```

Cela exécute le script `preuninstall` du paquet (`uninstall.sh`, ou `uninstall.ps1`
sous Windows), qui arrête l'instance en cours et supprime :

- le binaire pi-web (`~/.pi/agent/bin/pi-web`, ou `/usr/local/bin/pi-web` pour les installations autonomes)
- le fichier de version (`~/.pi/agent/pi-web-version`)
- le fichier d'état d'exécution (`~/.pi/agent/pi-web/pi-web-state.json`)
- la configuration de démarrage automatique (plist launchd sous macOS, service utilisateur systemd sous Linux, entrée de clé Run + scripts de lancement sous Windows)

Vos données sont conservées afin qu'une réinstallation ultérieure reprenne là où vous vous étiez arrêté :
`~/.pi/agent/pi-web.sqlite`, `~/.pi/agent/pi-web-memory.sqlite`, vos fichiers de session
sous `~/.pi/agent/sessions/`, et `~/.config/pi-web/env` (y compris
`PI_WEB_TOKEN`). Supprimez-les manuellement si vous voulez repartir de zéro.

## Utilisation

```bash
# Démarrer sur le port par défaut (31415)
pi-web

# Démarrer et ouvrir un navigateur
pi-web -o

# Port personnalisé
pi-web -p 8080

# Remplacer l'hôte de liaison (loopback est non authentifié par défaut)
pi-web --host 127.0.0.1

# Une liaison non-loopback exige un jeton — sinon pi-web refuse de démarrer
PI_WEB_TOKEN=$(openssl rand -hex 16) pi-web --host 192.168.1.50
```

Par défaut, pi-web se lie à `127.0.0.1`. Si Tailscale est en cours d'exécution avec MagicDNS **et que `PI_WEB_TOKEN` est défini**, pi-web exécute également `tailscale serve --bg --https=<port> http://127.0.0.1:<port>` et affiche l'URL HTTPS du tailnet. Sans jeton, pi-web reste limité au loopback et ignore Tailscale Serve, de sorte que les pairs du tailnet ne peuvent pas atteindre l'agent sans authentification. Toute liaison non-loopback explicite exige également que `PI_WEB_TOKEN` soit défini ; passez `--insecure` pour passer outre lors de tests locaux.

## Accès à distance

Laissez pi-web écouter localement, puis utilisez l'URL HTTPS Tailscale affichée depuis votre téléphone ou ordinateur portable sur le tailnet.

Sous macOS, installez et ouvrez Tailscale de manière interactive, approuvez l'invite d'administration et connectez-vous. Exécutez ensuite `/pi-web restart`, puis `/remote`.

Sous Linux, autorisez votre utilisateur à gérer Tailscale avant d'installer/exécuter pi-web, sinon `tailscale serve` peut nécessiter sudo et le démarrage automatique peut échouer :

```bash
sudo tailscale set --operator=$USER
```

```bash
# 1. Démarrez pi-web avec un jeton pour qu'il publie le point de terminaison HTTPS Tailscale
PI_WEB_TOKEN=$(openssl rand -hex 16) pi-web

# 2. Depuis tout autre appareil connecté à Tailscale, ouvrez l'URL
#    "Tailscale HTTPS" affichée et saisissez le jeton une fois.
```

> Par défaut, pi-web refuse de se lier à une adresse non-loopback à moins que `PI_WEB_TOKEN` ne soit défini — quiconque peut atteindre l'adresse liée pourrait sinon consulter les sessions et envoyer des instructions à pi. Pour passer outre cette protection lors de tests sur le réseau local, passez `--insecure`. **N'utilisez pas `--insecure` sur Tailscale ni sur une adresse joignable depuis l'extérieur de votre machine.**
>
> Les clients peuvent transmettre le jeton via l'en-tête `Authorization: Bearer <token>`, l'en-tête `X-Pi-Token`, ou une fois via `?token=<token>` (ou l'invite de connexion). Lorsque le jeton arrive via la chaîne de requête, pi-web définit un cookie `pi_token` et redirige vers la même URL avec le jeton supprimé, afin qu'il ne subsiste pas dans la barre d'adresse ni dans l'historique du navigateur. Préférez la forme par en-tête pour les scripts et l'automatisation.

## Chat dans le navigateur

Ouvrez une page de session et utilisez le composeur en bas pour poursuivre exactement cette session.

- `Entrée` envoie, `Maj+Entrée` insère une nouvelle ligne
- Glissez-déposez ou collez des images directement dans le composeur
- Le sélecteur de modèle et le sélecteur de niveau de réflexion se trouvent dans l'en-tête — les modifications s'appliquent immédiatement au worker pi sous-jacent
- Chaque session active dispose de son propre worker `pi --mode rpc` dédié, de sorte que les différentes sessions ne se bloquent pas mutuellement

## Partage de sessions

Cliquez sur **Partager** sur une page de session pour créer un Gist GitHub secret.

Prérequis :
- `gh` installé
- `gh auth login` effectué

Le partage renvoie :
- l'URL du gist secret
- une URL d'aperçu sur `https://pi.dev/session/#<gistId>`

Les gists partagés sont des instantanés et ne se mettent pas à jour en direct.

## Démarrage automatique à la connexion

### macOS

```bash
cp init/com.pi-web.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.pi-web.plist
```

### Linux (systemd)

```bash
# Installer le service utilisateur systemd
mkdir -p ~/.config/systemd/user
cp init/pi-web.service ~/.config/systemd/user/

# Facultatif : définir votre PI_WEB_TOKEN pour les liaisons non-loopback
# (ou utilisez /pi-web set-token <token> depuis pi)
mkdir -p ~/.config/pi-web
echo 'PI_WEB_TOKEN=your-token-here' > ~/.config/pi-web/env

# Activer et démarrer
systemctl --user daemon-reload
systemctl --user enable --now pi-web.service

# Vérifier le statut
systemctl --user status pi-web.service

# Consulter les journaux
journalctl --user -u pi-web.service -f
```

> Pour que le service démarre au boot (avant la connexion), utilisez plutôt un service système :
> copiez `init/pi-web.service` vers `/etc/systemd/system/` et utilisez `sudo systemctl`.

### Windows

L'installateur configure cela automatiquement, sans nécessiter de droits administrateur : une
entrée `pi-web` sous `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`
lance `~/.config/pi-web/pi-web-start.vbs` à la connexion, ce qui démarre le binaire
en mode masqué (sans fenêtre de console) après avoir chargé `~/.config/pi-web/env`
(`PI_WEB_TOKEN`, `PATH`, ...).

Pour le gérer à la main :

```powershell
# Démarrer / arrêter
wscript.exe "$HOME\.config\pi-web\pi-web-start.vbs"
taskkill /IM pi-web.exe /F

# Supprimer le démarrage automatique
Remove-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run' -Name 'pi-web'
```

Il n'y a pas de supervision de service sous Windows : si pi-web plante, il reste arrêté
jusqu'à la prochaine connexion (launchd/systemd le redémarrent automatiquement sur les autres
plateformes).
