# Raccourcis clavier

## Page d'index (`/`)

### Défilement de la page (style vim)

Les mêmes raccourcis de style vim fonctionnent sur toutes les pages lorsque le focus n'est **pas** dans un élément input, textarea ou contenteditable.

| Raccourci | Action |
|----------|--------|
| `j` | Défiler vers le bas de 300 px |
| `k` | Défiler vers le haut de 300 px |
| `g g` | Défiler en haut de la page |
| `G` (Maj+G) | Défiler en bas de la page |
| `Escape` | Retirer le focus de l'entrée active pour que la navigation j/k fonctionne |

### Commandes d'index

| Raccourci | Contexte | Action |
|----------|---------|--------|
| `⌘K` / `Ctrl+K` | Niveau page | Ouvrir la palette de recherche/sessions |
| `⌘,` / `Ctrl+,` | Niveau page | Ouvrir les paramètres |
| `⌘⇧L` / `Ctrl+Maj+L` | Niveau page | Basculer le thème du système (clair/sombre) |
| `Escape` | Niveau page | Fermer la palette, le menu ou la fenêtre modale |
| `Enter` | Champ du chemin de nouvelle session | Créer une nouvelle session |

> `⌘K` / `Ctrl+K` est aussi le raccourci de Chrome pour « focaliser la barre d'adresse ». Le navigateur peut l'intercepter à moins que le focus soit dans un champ de saisie de texte.

## Page de détail de session (`/session?id=...`)

### Défilement de la page (style vim)

Ils fonctionnent à la fois sur la page d'index et sur la page de session lorsque le focus n'est **pas** dans un élément input, textarea ou contenteditable.

| Raccourci | Action |
|----------|--------|
| `j` | Défiler vers le bas de 300 px |
| `k` | Défiler vers le haut de 300 px |
| `g g` | Défiler en haut de la page |
| `G` (Maj+G) | Défiler en bas de la page |
| `I` (Maj+I) | Donner le focus à la zone de texte du composeur de chat |
| `Escape` | Retirer le focus de l'entrée active pour que la navigation j/k fonctionne |

### Barre latérale et navigation

| Raccourci | Contexte | Action |
|----------|---------|--------|
| `⌘B` / `Ctrl+B` | Niveau page | Basculer la visibilité de la barre latérale |
| `⌘K` / `Ctrl+K` | Niveau page | Ouvrir la palette de liste des sessions |
| `⌘T` / `Ctrl+T` | Niveau page | Nouvelle session |
| `⌘/` / `Ctrl+/` | Niveau page | Afficher la fenêtre modale des raccourcis clavier |
| `⌘,` / `Ctrl+,` | Niveau page | Ouvrir les paramètres |
| `⌘⇧L` / `Ctrl+Maj+L` | Niveau page | Basculer le thème du système (clair/sombre) |
| `⌘⇧N` / `Ctrl+Maj+N` | Niveau page | Basculer la barre latérale du bloc-notes / notes |

> `⌘K` et `⌘T` sont aussi des raccourcis du navigateur (focaliser la barre d'adresse / nouvel onglet). Le navigateur peut les intercepter à moins que le focus soit dans un champ de saisie de texte.

### Composeur de chat

| Raccourci | Contexte | Action |
|----------|---------|--------|
| `Enter` | Zone de texte du chat | Envoyer le message |
| `Maj+Enter` | Zone de texte du chat | Insérer un saut de ligne |
| `Maj+Tab` | Zone de texte du chat | Passer au niveau de réflexion suivant (`off` → `minimal` → … → `xhigh` → `off`) |
| `Ctrl+I` / `Ctrl+L` | Zone de texte du chat | Ouvrir la fenêtre contextuelle du sélecteur de modèle (taper pour filtrer, Entrée pour sélectionner, le focus revient à la zone de texte) |

### Basculement de visibilité des entrées

| Raccourci | Contexte | Action |
|----------|---------|--------|
| `t` | Lorsque le focus n'est **pas** dans un champ input/textarea | Basculer la visibilité de la réflexion |
| `o` | Lorsque le focus n'est **pas** dans un champ input/textarea | Basculer la visibilité des outils |
| `p` | Lorsque le focus n'est **pas** dans un champ input/textarea | Basculer les sorties des outils |

### Palettes, menus et panneaux

| Raccourci | Contexte | Action |
|----------|---------|--------|
| `Escape` | Niveau page | Fermer toute palette, tout menu ou tout panneau ouvert |
| `⌘K` / `Ctrl+K` | Niveau page | Ouvrir la palette de liste des sessions |
| `Flèche haut` / `Flèche bas` | Palette de liste des sessions | Naviguer parmi les résultats de session |
| `Enter` | Palette de liste des sessions | Ouvrir la session sélectionnée (ou la première) |
| `Flèche haut` / `Flèche bas` | Fenêtre contextuelle du sélecteur de modèle | Naviguer dans la liste des modèles |
| `Enter` | Fenêtre contextuelle du sélecteur de modèle | Sélectionner le modèle en surbrillance |
| `Flèche haut` / `Flèche bas` | Fenêtre modale Fork | Naviguer parmi les messages |
| `Enter` | Fenêtre modale Fork | Bifurquer à partir du message en surbrillance |
| `Tab` | Panneau plein écran | Faire défiler le focus dans le panneau |
| `Escape` | Panneau plein écran | Fermer le panneau |
