# pi-web comme votre assistant personnel

pi-web n'est pas seulement pour coder — vous pouvez le transformer en **assistant IA personnel** qui vit sur votre ordinateur, comme avoir votre propre OpenClaw ou Hermes.

## Comment ça marche

Vous créez un dossier dédié sur votre machine — c'est là que votre assistant habite. À l'intérieur, vous ajoutez un fichier `APPEND_SYSTEM.md` qui définit qui est votre assistant, ce qu'il sait et comment il se comporte. pi-web vous offre une belle interface de chat pour lui parler depuis n'importe quel appareil.

## Pas à pas

### 1. Créez le dossier de votre assistant

Choisissez un dossier sur votre ordinateur. Par exemple :

```
~/mon-assistant/
```

### 2. Définissez votre assistant

Créez un fichier `APPEND_SYSTEM.md` dans ce dossier. C'est là que vous dites à pi qui est votre assistant :

```markdown
# Mon assistant personnel

Tu es Jarvis, mon assistant IA personnel. Tu m'aides avec :

- La planification quotidienne et les rappels
- La recherche et la synthèse
- La rédaction d'e-mails et de messages
- Le brainstorming d'idées
- Le suivi des choses que je mentionne

## À propos de moi

- Je suis ingénieur logiciel et je travaille à distance
- J'ai un chat qui s'appelle Pixel
- Je préfère les réponses courtes et directes
- Mon fuseau horaire est PST

## Règles

- Sois concis — j'apprécie la brièveté
- Si tu ne sais pas quelque chose, dis-le
- Rappelle-moi proactivement les choses que je t'ai demandé de suivre
```

pi ajoute automatiquement ceci au prompt système de chaque conversation, afin que votre assistant sache toujours qui vous êtes et comment vous aider.

### 3. Démarrez une session dans ce dossier

Dans pi-web, créez une nouvelle session pointant vers `~/mon-assistant/` (ou le nom que vous lui avez donné). C'est tout — vous parlez à votre assistant personnel.

### 4. Utilisez-le de partout

Installez pi-web comme une PWA sur votre téléphone, tablette ou ordinateur portable. Votre assistant est toujours là — posez-lui n'importe quoi, n'importe quand.

## Idées pour votre assistant

| Rôle | Quoi mettre dans APPEND_SYSTEM.md |
|---|---|
| 🧠 **Coach de vie** | Vos objectifs, les habitudes sur lesquelles vous travaillez, des invites de journaling |
| 🏠 **Gestionnaire de maison** | Format de liste de courses, préférences des membres de la famille, planification des repas |
| 💼 **Compagnon de travail** | Votre rôle, projets en cours, format de notes de réunion, contexte de l'entreprise |
| 📚 **Partenaire d'étude** | Ce que vous apprenez, style d'explication préféré, mode quiz |
| ✍️ **Assistant d'écriture** | Votre style d'écriture, préférences de ton, formats courants que vous utilisez |

## Ajoutez plus de contexte

Vous pouvez mettre dans le dossier de votre assistant tout ce qui aide pi à être plus utile :

- `notes/` — fichiers de référence que votre assistant peut lire
- `contexte.md` — informations de fond sur votre vie ou votre travail
- `projets.md` — projets en cours et leur état

pi peut lire les fichiers dans le dossier, donc plus vous lui donnez de contexte, meilleur il devient.

---

> 💡 **Astuce :** Commencez simplement. Juste quelques lignes sur qui vous êtes et comment vous voulez que l'assistant se comporte. Affinez au fil du temps à mesure que vous apprenez ce qui fonctionne.
