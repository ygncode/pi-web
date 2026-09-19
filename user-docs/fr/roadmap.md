# Feuille de route

pi-web est conçu pour deux publics :

- **Pour les développeurs** — qui vivent dans le terminal mais veulent continuer leurs sessions depuis leur mobile, transférer vers un serveur distant, ou garder un œil sur les tâches longues depuis n'importe où.
- **Pour les non-développeurs** — qui veulent simplement une belle application IA qui fonctionne. Ouvrez-la, tapez, profitez. Pas de terminal, pas de SSH, pas de confusion. Comme les outils IA les plus conviviaux, mais avec le choix du modèle et la liberté de l'open source.

Voici ce qui arrive.

---

## Maintenant (livré)

Tout ce qui figure dans [le tableau des fonctionnalités](README.md#what-you-can-do-with-pi-web) est disponible aujourd'hui.

Les fonctionnalités qui figuraient auparavant sur cette feuille de route et qui ont depuis été livrées :

| Fonctionnalité | Ce qu'elle fait |
|---|---|
| **Pilotage / file d'attente** ([#46](https://github.com/ygncode/pi-web/issues/46)) | Envoyez des instructions de suivi pendant que pi tourne encore, ou mettez des messages en file d'attente pour le prochain tour. |
| **Planificateur** ([#44](https://github.com/ygncode/pi-web/issues/44)) | Planifiez des invites à exécuter automatiquement — standups quotidiens, résumés du matin, tâches récurrentes — depuis la page `/schedules`. |
| **Valeurs d'affichage par défaut configurables** ([#48](https://github.com/ygncode/pi-web/issues/48)) | Définissez votre visibilité préférée pour la réflexion, les outils et les sorties d'outils sur toutes les sessions. |
| **Diff Git** (partie de [#47](https://github.com/ygncode/pi-web/issues/47)) | Consultez les modifications non commitées de l'arbre de travail dans la fenêtre de diff de session, avec des commentaires de révision. |

---

## À venir

| # | Fonctionnalité | Ce qu'elle fait |
|---|---|---|
| [#50](https://github.com/ygncode/pi-web/issues/50) | **Bots Telegram & Discord** | Discutez avec pi via Telegram ou Discord — parfait pour les flux de travail d'assistant personnel en déplacement. |
| [#49](https://github.com/ygncode/pi-web/issues/49) | **Aperçus d'utilisation** | Suivi des jetons entre sessions, estimation des coûts et analytique — au-delà de la ventilation par session du menu de session. |
| [#41](https://github.com/ygncode/pi-web/issues/41) | **Commande `/compact`** | Compactez les longues conversations directement depuis l'interface web, sans terminal. |

---

## Prévu

| # | Fonctionnalité | Ce qu'elle fait |
|---|---|---|
| [#47](https://github.com/ygncode/pi-web/issues/47) | **Explorateur de fichiers** | Parcourez l'arborescence des fichiers du projet directement dans pi-web. Optionnel, pour qu'il reste discret. |
| [#43](https://github.com/ygncode/pi-web/issues/43) | **Raccourcis personnalisables** | Réaffectez chaque raccourci clavier pour correspondre à votre mémoire musculaire. |

---

## Vision

L'objectif à long terme : pi-web devrait être **l'interface de pi** — pour tout le monde.

- **Les non-développeurs** l'ouvrent comme n'importe quelle autre application. Choisissez un modèle. Tapez. Terminé. Jamais de ligne de commande.
- **Les développeurs** obtiennent une intégration profonde — transfert à distance, tableaux de bord multi-sessions, navigation consciente de git, bots de messagerie.
- **Tout le monde** obtient la liberté du modèle, la transparence de l'open source et une interface qui semble soignée à chaque instant.

---

> 💡 Une idée ? [Ouvrez une issue](https://github.com/ygncode/pi-web/issues/new) ou rejoignez la discussion.
