# Bienvenue sur pi-web 🖥️

<div align="center">

[English](../en/README.md) · [Español](../es/README.md) · **Français** · [Deutsch](../de/README.md) · [中文](../zh/README.md) · [日本語](../ja/README.md) · [Bahasa Indonesia](../id/README.md) · [Bahasa Melayu](../ms/README.md) · [Tiếng Việt](../vi/README.md) · [ไทย](../th/README.md) · [Filipino](../fil/README.md) · [မြန်မာ](../my/README.md) · [ភាសាខ្មែរ](../km/README.md) · [ລາວ](../lo/README.md)

</div>

**Vous envisagez d'essayer pi-web ? Lancez-vous — vous allez tomber amoureux.**

pi-web est une belle interface web et PWA pour [pi](https://pi.dev) — l'agent de codage IA open source. Il vous permet de parcourir, lire et poursuivre vos sessions pi depuis n'importe quel navigateur, sur n'importe quel appareil, avec des fonctionnalités soignées à chaque instant.

**pi-web est conçu pour deux types de personnes :**

- 🧑‍💻 **Pour les développeurs** — qui vivent dans le terminal mais veulent poursuivre leurs sessions depuis un mobile, passer la main à un serveur distant, ou surveiller des tâches longues depuis n'importe où.
- ✨ **Pour les non-développeurs** — qui veulent simplement une belle application IA qui fonctionne. Ouvrez-la, tapez, profitez. Pas de terminal, pas de SSH, pas de confusion. Comme les outils IA les plus conviviaux, mais avec le choix du modèle et la liberté de l'open source.

---

## Pourquoi pi-web ?

Vous êtes déjà plongé dans le flux avec pi dans votre terminal. pi-web maintient cet élan quand vous vous éloignez de votre bureau :

- **Reprendre depuis n'importe où** — continuez une session depuis votre téléphone, votre tablette ou un autre ordinateur. Pas de SSH, pas de Termius — ouvrez simplement votre navigateur.
- **Tableau de bord multi-sessions** — lancez du travail dans une session tout en regardant une autre diffuser. Recherchez dans les projets, filtrez par branche, trouvez rapidement ce dont vous avez besoin.
- **Fondation open source** — pi est entièrement open source et indépendant des fournisseurs. Vous n'êtes pas enfermé dans un seul modèle ou fournisseur. pi-web est également open source.
- **Accès distant sécurisé** — authentification par jeton intégrée pour pouvoir l'exposer sur votre LAN ou Tailscale sans inquiétude.
- **Partagez votre travail** — exportez les sessions sous forme de snapshots statiques ou de Gists GitHub secrets en un clic.

> Curieux d'en savoir plus sur l'histoire derrière tout ça ? [Lisez pourquoi nous l'avons construit →](why.md)

---

## pi-web comme espace de travail IA personnel 🏠

pi-web est une PWA (Progressive Web App), vous pouvez donc **l'installer comme une application native** sur votre ordinateur, portable, téléphone ou tablette — sans boutique d'applications. Sur ordinateur, il s'ouvre dans sa propre fenêtre sans chrome de navigateur, ce qui lui donne l'apparence et la sensation d'une véritable application de bureau.

Considérez-le comme **votre propre Claude Cowork** — un espace de travail IA personnel qui vit sur votre machine — à ceci près qu'il est open source et indépendant des modèles :

- **Vous possédez la stack.** Choisissez n'importe quel modèle, changez quand vous voulez. Lancez-en un en local et vos données ne quittent jamais votre machine.
- **Les personnes non techniques peuvent l'utiliser.** Configurez pi-web sur leur machine, montrez-leur une fois comment l'utiliser, et c'est parti. Vos parents, votre partenaire, vos amis non techniques — pas de terminal, pas de SSH, juste une interface de chat familière.
- **Une seule configuration, plusieurs utilisateurs.** Installez-le sur votre ordinateur et partagez votre écran, ou exposez-le sur votre réseau domestique et laissez les membres de votre famille l'ouvrir sur leurs propres appareils.

Vous voulez plus que du codage ? Transformez-le en [assistant personnel](personal-assistant.md) dédié qui sait qui vous êtes et vit sur votre machine — comme votre propre OpenClaw ou Hermes.

> 💡 **Astuce de pro :** Installez pi-web en tant que PWA depuis Chrome/Edge (cliquez sur l'icône d'installation dans la barre d'adresse) ou Safari (Partager → Ajouter au Dock). Il devient impossible à distinguer d'une application native.

---

## Ce que vous pouvez faire avec pi-web

| | |
|---|---|
| 📱 **PWA** | Installez pi-web comme Progressive Web App sur ordinateur, téléphone ou tablette pour une sensation native. |
| 🔄 **Reprendre les sessions** | Reprenez n'importe quelle conversation là où vous l'aviez laissée — texte, images, changement de modèle, tout depuis le navigateur. |
| 🆕 **Démarrer de nouvelles sessions** | Créez de nouvelles sessions sur n'importe quel chemin de projet, directement depuis l'interface web. |
| 📡 **Diffusion en direct** | Regardez les réponses de pi diffuser en temps réel avec une latence d'environ une milliseconde. Le mode suivi vous garde verrouillé sur le dernier message. |
| 🌲 **Vue arborescente** | Naviguez dans l'arbre de messages natif de pi — voyez la structure complète de la conversation, sautez vers n'importe quelle branche et bifurquez depuis n'importe quel point. |
| 🔀 **Fork des sessions** | Créez un fork d'une session depuis n'importe quel message ou même un appel d'outil spécifique — explorez différentes directions sans perdre votre place. |
| 🔍 **Parcourir et rechercher** | Filtrez les sessions entre les projets, recherchez par nom, naviguez dans les branches — tout votre historique de sessions en un coup d'œil. |
| 🌿 **Intégration Git** | Voyez la branche actuelle et ouvrez une PR GitHub directement depuis la visionneuse de session. |
| 📝 **Bloc-notes** | Notez des idées, des tâches ou des réflexions rapides à côté de vos sessions sans changer d'application. |
| 💬 **Annotations** | Surlignez et commentez n'importe quelle partie d'une session — parfait pour la revue de code, les retours ou le marquage des moments clés. |
| 🎨 **Thèmes et personnalisation** | Basculez entre le mode sombre et le mode clair, ajustez l'interface à votre goût — faites de pi-web quelque chose qui vous ressemble. |
| 🌐 **Multi-langues** | 14 langues intégrées (English, Español, Français, Deutsch, 中文, 日本語, Bahasa Indonesia, Bahasa Melayu, Tiếng Việt, ไทย, Filipino, မြန်မာ, ភាសាខ្មែរ, ລາວ). Ajoutez votre propre langue personnalisée depuis les Paramètres. |
| 🐱 **Bien-être et pomodoro** | Trop de codage « vibe » n'est pas sain. Minuteur pomodoro intégré avec un compagnon chat et des rappels de sommeil pour garder l'équilibre. |
| 📤 **Partager et exporter** | Téléchargez du JSONL, exportez des snapshots statiques rendus avec le look natif `pi.dev` de pi, ou partagez comme Gists GitHub privés — le tout rendu côté client. |
| 🔔 **Sons de notification** | Carillons de notification personnalisables pour les événements de session — restez au courant même quand pi-web est dans un autre onglet. |
| ⌨️ **Raccourcis clavier** | Navigation façon Vim, actions rapides — [référence complète →](keyboard-shortcuts.md) |
| 🤖 **Assistant personnel** | Transformez pi-web en votre propre assistant IA qui vit sur votre ordinateur — comme OpenClaw ou Hermes. [Configurez-le →](personal-assistant.md) |
| 🗓️ **Parler aux plannings** | Depuis une session pi, dites « add a schedule at 2am Singapore time to … » — `/skill:pi-web-schedule`. |
| 📝 **Parler aux notes et paramètres** | « Écris ceci dans les notes » (`/skill:pi-web-notes`) ou « passe en mode sombre » (`/skill:pi-web-settings`). |

---

## Navigation rapide

| Si vous cherchez… | Lisez |
|---|---|
| Comment installer, configurer et utiliser pi-web | [install.md](install.md) |
| Utiliser pi-web comme assistant personnel | [personal-assistant.md](personal-assistant.md) |
| Référence des raccourcis clavier | [keyboard-shortcuts.md](keyboard-shortcuts.md) |
| Pourquoi pi-web existe | [why.md](why.md) |
| Ce qui arrive ensuite | [roadmap.md](roadmap.md) |
| Des soucis d'installation ? Laissez votre LLM les corriger — collez-lui le lien llm-debug.md | [llm-debug.md](llm-debug.md) |

---

## Captures d'écran

| Ordinateur | Mobile |
|---|---|
| ![Ordinateur](../assets/pi-web-desktop-screenshot.png) | ![Mobile](../assets/pi-web-mobile-screenshot.png) |

---

## 💛 Sponsor

pi-web est construit avec amour et beaucoup de longues nuits. Je paie de ma poche les forfaits de codage (Claude Code, OpenCode, etc.) pour faire avancer ce projet. Si pi-web vous a été utile, votre soutien compterait énormément.

**Façons d'aider :**

- 💰 **[Sponsoriser sur GitHub](https://github.com/sponsors/setkyar)** — aidez à couvrir les outils qui rendent cela possible
- ☕ **[Offrez-moi un café](https://buymeacoffee.com/setkyar)** — chaque petit geste compte
- ⭐ **Mettez une étoile au dépôt** — ça ne coûte rien et aide plus de gens à découvrir pi-web
- 📢 **Partagez avec vos amis et votre famille** — si vous connaissez quelqu'un qui adorerait pi-web, envoyez-le-lui

Vous ne pouvez pas sponsoriser ? Aucun souci — une étoile et un partage font déjà beaucoup. Merci d'être là. 🙏

---

Bon codage ! 🚀
