# Raccourcis clavier

## Page d'index (`/`)

### Défilement de page (style vim)

Les mêmes raccourcis de style vim fonctionnent sur toutes les pages lorsque le focus n'est **pas** dans un champ de saisie, une zone de texte ou un élément contenteditable.

| Raccourci | Action |
|-----------|--------|
| `j` | Défiler vers le bas de 300px |
| `k` | Défiler vers le haut de 300px |
| `g g` | Défiler en haut de la page |
| `G` (Maj+G) | Défiler en bas de la page |
| `Échap` | Retirer le focus de l'élément actif pour que la navigation j/k fonctionne |

### Commandes d'index

| Raccourci | Contexte | Action |
|-----------|----------|--------|
| `⌘K` / `Ctrl+K` | Niveau page | Ouvrir la palette de recherche/sessions |
| `⌘⇧L` / `Ctrl+Maj+L` | Niveau page | Basculer le thème système (clair/sombre) |
| `Échap` | Niveau page | Fermer la palette, le menu ou la modale |
| `Entrée` | Champ de saisie du chemin de nouvelle session | Créer une nouvelle session |

> `⌘K` / `Ctrl+K` est aussi le raccourci Chrome « focus barre d'adresse ». Le navigateur peut l'intercepter sauf si le focus est dans un champ de saisie de texte.

## Page de détail de session (`/session?id=...`)

### Défilement de page (style vim)

Ceux-ci fonctionnent à la fois sur la page d'index et la page de session lorsque le focus n'est **pas** dans un champ de saisie, une zone de texte ou un élément contenteditable.

| Raccourci | Action |
|-----------|--------|
| `j` | Défiler vers le bas de 300px |
| `k` | Défiler vers le haut de 300px |
| `g g` | Défiler en haut de la page |
| `G` (Maj+G) | Défiler en bas de la page |
| `I` (Maj+I) | Donner le focus à la zone de texte du compositeur de chat |
| `Échap` | Retirer le focus de l'élément actif pour que la navigation j/k fonctionne |

### Barre latérale et navigation

| Raccourci | Contexte | Action |
|-----------|----------|--------|
| `⌘B` / `Ctrl+B` | Niveau page | Afficher/masquer la barre latérale |
| `⌘K` / `Ctrl+K` | Niveau page | Ouvrir la palette de liste des sessions |
| `⌘T` / `Ctrl+T` | Niveau page | Nouvelle session |
| `⌘⇧L` / `Ctrl+Maj+L` | Niveau page | Basculer le thème système (clair/sombre) |
| `⌘⇧N` / `Ctrl+Maj+N` | Niveau page | Basculer le bloc-notes / panneau latéral de notes |

> `⌘K` et `⌘T` sont aussi des raccourcis navigateur (focus barre d'adresse / nouvel onglet). Le navigateur peut les intercepter sauf si le focus est dans un champ de saisie de texte.

### Compositeur de chat

| Raccourci | Contexte | Action |
|-----------|----------|--------|
| `Entrée` | Zone de texte du chat | Envoyer le message |
| `Maj+Entrée` | Zone de texte du chat | Insérer un saut de ligne |
| `Maj+Tab` | Zone de texte du chat | Passer au niveau de réflexion suivant (`off` → `minimal` → … → `xhigh` → `off`) |
| `Ctrl+I` / `Ctrl+L` | Zone de texte du chat | Ouvrir le popup de sélection de modèle (taper pour filtrer, Entrée pour sélectionner, le focus revient à la zone de texte) |

### Bascules de visibilité des entrées

| Raccourci | Contexte | Action |
|-----------|----------|--------|
| `t` | Lorsque le focus n'est **pas** dans un champ de saisie/zone de texte | Basculer la visibilité de la réflexion |
| `o` | Lorsque le focus n'est **pas** dans un champ de saisie/zone de texte | Basculer la visibilité des outils |
| `p` | Lorsque le focus n'est **pas** dans un champ de saisie/zone de texte | Basculer la visibilité des sorties d'outils |

### Palettes, menus et feuilles

| Raccourci | Contexte | Action |
|-----------|----------|--------|
| `Échap` | Niveau page | Fermer toute palette, menu ou feuille ouverte |
| `⌘K` / `Ctrl+K` | Niveau page | Ouvrir la palette de liste des sessions |
| `Flèche haut` / `Flèche bas` | Palette de liste des sessions | Naviguer parmi les résultats de sessions |
| `Entrée` | Palette de liste des sessions | Ouvrir la session sélectionnée (ou la première) |
| `Flèche haut` / `Flèche bas` | Popup de sélection de modèle | Naviguer dans la liste des modèles |
| `Entrée` | Popup de sélection de modèle | Sélectionner le modèle mis en surbrillance |
| `Flèche haut` / `Flèche bas` | Modale de bifurcation | Naviguer parmi les messages |
| `Entrée` | Modale de bifurcation | Bifurquer depuis le message mis en surbrillance |
| `Tab` | Feuille plein écran | Faire défiler le focus à l'intérieur de la feuille |
| `Échap` | Feuille plein écran | Fermer la feuille |
