# Installation et utilisation

## Fonctionnalités

### Contrôle à distance

- Reprenez n'importe quelle session depuis le navigateur avec des pièces jointes texte ou image
- Lancez une toute nouvelle session sur n'importe quel chemin de projet, directement depuis l'interface web
- Sélecteur de modèle et de niveau de réflexion dans le navigateur, par session
- Statut du worker par session (inactif / en cours / erreur) avec récupération automatique en cas de plantage
- Plusieurs sessions s'exécutent en parallèle — lancez du travail dans l'une, regardez une autre diffuser
- `PI_WEB_TOKEN` pour une exposition sécurisée sur le LAN — requis par défaut pour toute liaison explicite hors loopback

### Lecture des sessions

- Parcourez les sessions de tous vos projets avec filtres, recherche et navigation complète entre les branches
- Mises à jour incrémentielles en direct pendant que pi tourne encore (via fsnotify ; latence ~ms)
- Mode suivi pour suivre les sessions actives
- Liens profonds vers des messages individuels
- Téléchargez une session au format JSONL
- Partagez des instantanés statiques sous forme de Gists GitHub secrets
- Extensions pi `/web`, `/remote`, `/refresh`, `/pi-web token` et `/pi-web set-token` pour ouvrir des sessions, QR distant, synchronisation de session et gestion du token

## Prérequis

- [Go](https://go.dev) 1.25+
- `pi` dans votre `PATH` pour le chat et le changement de modèle dans le navigateur
- Optionnel : `gh` pour le partage

## Installation

### Paquet Pi (recommandé)

```bash
pi install npm:@ygncode/pi-web@beta
```

Cette seule commande :
- Installe le paquet npm pi dans le répertoire des paquets de pi
- Exécute le script `postinstall` du paquet (`bash install.sh`)
- Télécharge le binaire pi-web correspondant à votre version de paquet et à votre plateforme depuis GitHub Releases
- L'installe dans `~/.pi/agent/bin/pi-web`
- Configure le démarrage automatique à la connexion (launchd sur macOS, systemd sur Linux)
- Enregistre les commandes pi `/web`, `/remote`, `/refresh`, `/pi-web token` et `/pi-web set-token`

Le titrage automatique des sessions est intégré à pi-web (pas à l'extension) et se configure sur la page `/settings`. Il est activé par défaut : pi-web nomme automatiquement les sessions à l'aide d'une heuristique de mots intégrée gratuite (sans IA), en re-titrant à chaque nouveau message. Vous pouvez passer à un titrage unique par session, et/ou choisir un modèle pour écrire des titres plus intelligents au lieu de l'heuristique.

Sur Linux, le démarrage automatique est configuré comme un service systemd utilisateur dans `~/.config/systemd/user/pi-web.service`. L'installateur réécrit son `ExecStart` vers le chemin réel du binaire installé. Si Tailscale est disponible à l'exécution, pi-web publie le serveur localhost avec Tailscale Serve HTTPS. Si systemd utilisateur n'est pas disponible, exécutez-le manuellement avec `~/.pi/agent/bin/pi-web -o`.

Pour installer uniquement pour un projet spécifique (partagé avec votre équipe via `.pi/settings.json`) :

```bash
pi install -l npm:@ygncode/pi-web@beta
```

Redémarrez ensuite pi (ou exécutez `/reload`), et utilisez `/web`, `/pi-web`, `/remote`, `/refresh`. Gérez votre token d'accès avec `/pi-web token` et `/pi-web set-token`.

Si npm échoue avec `ENOTEMPTY` lors du renommage de `@ygncode/pi-web`, supprimez les répertoires de sauvegarde cachés obsolètes de npm et réinstallez le canal beta :

```bash
rm -rf ~/.pi/agent/npm/node_modules/@ygncode/.pi-web-*
pi install npm:@ygncode/pi-web@beta
```

### Installation rapide (aucun outil de build requis)

```bash
curl -fsSL https://raw.githubusercontent.com/ygncode/pi-web/main/install.sh | bash
```

Ceci télécharge le dernier binaire pi-web, l'installe dans `/usr/local/bin`, et configure le démarrage automatique à la connexion. Aucun Go, Node, ni pi requis.

### Téléchargement du binaire

Des binaires pré-compilés sont joints à chaque [GitHub Release](https://github.com/ygncode/pi-web/releases).

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

Déplacez-le ensuite dans votre PATH :

```bash
cp pi-web ~/.pi/agent/bin/
# ou à l'échelle du système :
sudo cp pi-web /usr/local/bin/
```

### Compilation depuis les sources

```bash
git clone https://github.com/ygncode/pi-web.git
cd pi-web
make build   # compile le bundle Vite, puis l'intègre dans le binaire Go

# optionnel : placez-le dans le PATH
cp pi-web ~/.pi/agent/bin/
```

Le bundle frontend est intégré par `web/assets_embed.go`, donc `go build` nécessite
que `web/dist` existe d'abord. `make build` effectue les deux étapes dans l'ordre ; si vous compilez
manuellement, exécutez `npm --prefix web install && npm --prefix web run build` avant
`go build ./cmd/pi-web`.

## Désinstallation

```bash
pi remove npm:@ygncode/pi-web@beta
```

Ceci exécute le script `preuninstall` du paquet (`bash uninstall.sh`), qui arrête
l'instance en cours et supprime :

- le binaire pi-web (`~/.pi/agent/bin/pi-web`, ou `/usr/local/bin/pi-web` pour les installations autonomes)
- le fichier de version (`~/.pi/agent/pi-web-version`)
- le fichier d'état d'exécution (`~/.pi/agent/pi-web/pi-web-state.json`)
- la configuration de démarrage automatique (plist launchd sur macOS, service systemd utilisateur sur Linux)

Vos données sont préservées afin qu'une réinstallation ultérieure reprenne là où vous en étiez :
`~/.pi/agent/pi-web.sqlite`, `~/.pi/agent/pi-web-memory.sqlite`, vos fichiers
de session sous `~/.pi/agent/sessions/`, et `~/.config/pi-web/env` (incluant
`PI_WEB_TOKEN`). Supprimez-les manuellement si vous voulez repartir de zéro.

## Utilisation

```bash
# Démarrer sur le port par défaut (31415)
pi-web

# Démarrer et ouvrir un navigateur
pi-web -o

# Port personnalisé
pi-web -p 8080

# Remplacer l'hôte de liaison (loopback n'est pas authentifié par défaut)
pi-web --host 127.0.0.1

# Une liaison hors loopback nécessite un token — pi-web refuse de démarrer sinon
PI_WEB_TOKEN=$(openssl rand -hex 16) pi-web --host 192.168.1.50
```

Par défaut, pi-web se lie à `127.0.0.1`. Si Tailscale est en cours d'exécution avec MagicDNS, pi-web exécute également `tailscale serve --bg --https=<port> http://127.0.0.1:<port>` et affiche l'URL HTTPS tailnet. Toute liaison explicite hors loopback nécessite que `PI_WEB_TOKEN` soit défini ; passez `--insecure` pour contourner cette protection lors de tests locaux.

## Accès à distance

Laissez pi-web écouter localement, puis utilisez l'URL HTTPS Tailscale affichée depuis votre téléphone ou ordinateur portable sur le tailnet.

Sur Linux, autorisez votre utilisateur à gérer Tailscale avant d'installer/exécuter pi-web, sinon `tailscale serve` peut nécessiter sudo et le démarrage automatique peut échouer :

```bash
sudo tailscale set --operator=$USER
```

```bash
# 1. Démarrez pi-web
pi-web

# 2. Depuis n'importe quel autre appareil connecté à Tailscale, ouvrez l'URL
#    "Tailscale HTTPS" affichée.
```

> Par défaut, pi-web refuse de se lier à une adresse hors loopback sauf si `PI_WEB_TOKEN` est défini — quiconque peut atteindre l'adresse liée pourrait autrement voir les sessions et envoyer des instructions à pi. Pour désactiver cette protection lors de tests sur le réseau local, passez `--insecure`. **N'utilisez pas `--insecure` sur Tailscale ni sur une adresse accessible depuis l'extérieur de votre machine.**
>
> Les clients peuvent transmettre le token via l'en-tête `Authorization: Bearer <token>`, l'en-tête `X-Pi-Token`, ou une fois via `?token=<token>` (ce qui définit un cookie `pi_token` pour les requêtes suivantes). Les tokens transmis via `?token=` se retrouvent dans l'historique du navigateur, les journaux d'accès du serveur et les en-têtes `Referer` de tous les liens de la page — préférez la forme par en-tête pour tout ce qui dépasse le signet initial.

## Chat dans le navigateur

Ouvrez une page de session et utilisez le composeur en bas pour continuer cette session exacte.

- `Entrée` envoie, `Shift+Entrée` insère un saut de ligne
- Glissez-déposez ou collez des images directement dans le composeur
- Le sélecteur de modèle et le sélecteur de niveau de réflexion se trouvent dans l'en-tête — les modifications s'appliquent immédiatement au worker pi sous-jacent
- Chaque session active obtient son propre worker `pi --mode rpc` dédié, afin que différentes sessions ne se bloquent pas mutuellement

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
# Installer le service systemd utilisateur
mkdir -p ~/.config/systemd/user
cp init/pi-web.service ~/.config/systemd/user/

# Optionnel : définissez votre PI_WEB_TOKEN pour les liaisons hors loopback
# (ou utilisez /pi-web set-token <token> depuis pi)
mkdir -p ~/.config/pi-web
echo 'PI_WEB_TOKEN=votre-token-ici' > ~/.config/pi-web/env

# Activer et démarrer
systemctl --user daemon-reload
systemctl --user enable --now pi-web.service

# Vérifier le statut
systemctl --user status pi-web.service

# Voir les journaux
journalctl --user -u pi-web.service -f
```

> Pour que le service démarre au boot (avant la connexion), utilisez plutôt un service système :
> copiez `init/pi-web.service` dans `/etc/systemd/system/` et utilisez `sudo systemctl`.
