<h1 align="center">pi-web (Remote Control Your Pi)</h1>

<div align="center">

[![GitHub stars](https://img.shields.io/github/stars/ygncode/pi-web?style=flat&logo=github&label=stars&cacheSeconds=86400)](https://github.com/ygncode/pi-web/stargazers)
[![npm downloads](https://img.shields.io/npm/dw/@ygncode/pi-web?label=downloads/wk&color=2ea043&cacheSeconds=86400)](https://www.npmjs.com/package/@ygncode/pi-web)
[![license MIT](https://img.shields.io/npm/l/@ygncode/pi-web?label=license&color=0a7bbb&cacheSeconds=86400)](../../LICENSE)
[![Telegram](https://img.shields.io/badge/Telegram-Join-26A5E4?logo=telegram&logoColor=white)](https://t.me/+NJvFOTTa0wNjNTc9)
![platform](https://img.shields.io/badge/platform-macOS%20%7C%20Linux-555)

[English](../../README.md) · [Español](README.es.md) · **Français** · [Deutsch](README.de.md) · [中文](README.zh.md) · [日本語](README.ja.md) · [Bahasa Indonesia](README.id.md) · [Bahasa Melayu](README.ms.md) · [Tiếng Việt](README.vi.md) · [ไทย](README.th.md) · [Filipino](README.fil.md) · [မြန်မာ](README.my.md) · [ភាសាខ្មែរ](README.km.md) · [ລາວ](README.lo.md)

</div>

---
<div align="center">

Pilotez votre [pi](https://pi.dev) agent de codage depuis votre téléphone, tablette ou ordinateur portable — partout sur votre réseau, ou à distance via Tailscale.

C'est une PWA complète, vous pouvez donc l'installer et l'utiliser comme une application native sur n'importe quel appareil. Considérez-la comme votre propre espace de travail IA personnel — comme le Cowork de Claude, mais avec différents modèles — discutez entre modèles, codez depuis votre téléphone, ou transformez-la en [assistant personnel](user-docs/en/personal-assistant.md) qui vit sur votre machine.

Faites-la vôtre : changez de thèmes et de polices, et utilisez-la dans votre propre langue — pi-web est livré avec plusieurs langues et vous pouvez ajouter la vôtre. D'autres fonctionnalités sont à venir, mais elle ne deviendra pas surchargée : tout ce dont vous n'avez pas besoin peut être désactivé dans les paramètres.

</div>

> [!WARNING]
> pi-web est actuellement en **beta**. Les choses vont changer et casser !

> [!TIP]
> Nouveau ici ? **[Lisez le guide utilisateur →](user-docs/en/README.md)** pour une visite complète des fonctionnalités, les étapes d'installation et des astuces. ([Autres langues →](../README.md))

## Captures d'écran

<div align="center">
  <img src="../assets/pi-web-desktop-screenshot.png" alt="Desktop" width="90%" /><br />
  <em>Ordinateur</em>
  <br /><br />
  <img src="../assets/pi-web-mobile-screenshot.png" alt="Mobile PWA" width="90%" /><br />
  <em>Mobile PWA</em>
</div>

## Comment tout s'articule

```
 pi (terminal)                 Navigateur (téléphone / tablette / ordinateur)
      │                                │
      │  écrit du JSONL               │  HTTP + SSE
      ▼                                ▼
 ~/.pi/agent/sessions/  ←───  pi-web (serveur HTTP Go)
                                      │
                    ┌─────────────────┼─────────────────┐
                    │                 │                 │
              pi --mode rpc      fsnotify         tailscale serve
            (travailleur de   (rechargement     (HTTPS distant
             chat par session)  en direct)       via MagicDNS)
```

- **pi** écrit les conversations en JSONL dans `~/.pi/agent/sessions/` au fur et à mesure.
- **pi-web** est un serveur Go qui lit ces fichiers, les affiche dans le navigateur et diffuse les mises à jour en direct via SSE.
- Les travailleurs **pi --mode rpc** gèrent les discussions initiées depuis le navigateur — un par session, supprimés après 10 min d'inactivité.
- **fsnotify** surveille le répertoire des sessions pour que le navigateur se recharge en quelques millisecondes après une nouvelle sortie.
- **Tailscale Serve** publie le serveur local comme un point de terminaison HTTPS sur votre tailnet.

## Installation

```bash
pi install npm:@ygncode/pi-web@beta
```

C'est tout — cela télécharge le binaire correspondant, configure le démarrage automatique et enregistre les commandes `/web`, `/pi-web`, `/remote` et `/refresh`.

Une fois installé, ouvrez `http://127.0.0.1:31415` dans votre navigateur. Depuis pi, utilisez `/web` pour ouvrir instantanément la session en cours dans votre navigateur. Si Tailscale est en cours d'exécution sur votre machine, pi-web publie automatiquement un point de terminaison HTTPS sur votre tailnet — utilisez `/remote` depuis pi pour obtenir un QR code et une URL pour n'importe quel appareil sur votre tailnet.

> **Accès à distance sous macOS :** installez et ouvrez Tailscale de manière interactive, approuvez la demande d’autorisation administrateur et connectez-vous. Exécutez ensuite `/pi-web restart`, puis `/remote`.

Pour les installations manuelles, les téléchargements binaires ou la compilation depuis les sources, consultez [user-docs/install.md](user-docs/en/install.md).

## Intégration avec Pi

Après `pi install npm:@ygncode/pi-web@beta`, vous obtenez :

| Commande | Ce qu'elle fait |
|----------|-----------------|
| `/web` | Ouvre la session en cours dans votre navigateur (compatible SSH : ignore le navigateur et affiche uniquement l'URL) |
| `/pi-web` | Affiche l'état, la version, démarre/arrête/redémarre le serveur, ou met à jour |
| `/remote` | Affiche un QR code et une URL pour l'accès distant via Tailscale |
| `/refresh` | Rapatrie dans la session terminal les nouveaux messages écrits depuis des navigateurs distants |

Le **titrage automatique** des sessions est intégré à pi-web et se configure sur la page `/settings`. Il est **activé par défaut** et nomme automatiquement les sessions. Vous pouvez choisir :

- **Quand titrer** — une fois par session, ou à chaque nouveau message (par défaut).
- **Modèle de titre** — une **heuristique de mots intégrée gratuite et instantanée (sans IA)** par défaut, ou choisissez un modèle (par ex. un petit/rapide) pour des titres plus intelligents, rédigés par le modèle.

Le paquet installe également le binaire pi-web dans `~/.pi/agent/bin/pi-web` et configure le démarrage automatique à la connexion.

## Démarrage automatique à la connexion

La commande `pi install npm:@ygncode/pi-web@beta` configure cela automatiquement :

| OS | Mécanisme |
|----|-----------|
| macOS | launchd plist dans `~/Library/LaunchAgents/com.pi-web.plist` |
| Linux | service utilisateur systemd dans `~/.config/systemd/user/pi-web.service` |

Pour définir un jeton d'accès distant, créez `~/.config/pi-web/env` :

```
PI_WEB_TOKEN=your-token-here
```

Pour plus de détails (configuration manuelle, ports personnalisés, liaisons non-loopback), consultez [user-docs/install.md](user-docs/en/install.md).

## Développement

```bash
make setup   # installe les dépendances frontend et télécharge les modules Go
make check   # test/build frontend + test/vet Go
make build   # setup si nécessaire, build frontend, puis build ./pi-web
```
