# pi-web comme votre assistant personnel

pi-web ne sert pas qu'à coder — vous pouvez le transformer en **assistant IA personnel** qui vit sur votre ordinateur, comme si vous aviez votre propre OpenClaw ou Hermes.

## Comment ça marche

Vous créez un dossier dédié sur votre machine — c'est là que vit votre assistant. À l'intérieur, vous y déposez un fichier `APPEND_SYSTEM.md` qui définit qui est votre assistant, ce qu'il sait et comment il se comporte. pi-web vous offre une belle interface de discussion pour lui parler depuis n'importe quel appareil.

## Pas à pas

### 1. Créez votre dossier d'assistant

Choisissez un dossier sur votre ordinateur. Par exemple :

```
~/my-assistant/
```

### 2. Définissez votre assistant

Créez un fichier `APPEND_SYSTEM.md` dans ce dossier. C'est là que vous dites à pi qui est votre assistant :

```markdown
# My Personal Assistant

You are Jarvis, my personal AI assistant. You help me with:

- Daily planning and reminders
- Research and summarization
- Drafting emails and messages
- Brainstorming ideas
- Keeping track of things I mention

## About me

- I'm a software engineer who works remotely
- I have a cat named Pixel
- I prefer short, direct answers
- My timezone is PST

## Rules

- Be concise — I value brevity
- If you don't know something, say so
- Proactively remind me of things I asked you to track
```

pi ajoute automatiquement ceci au prompt système de chaque conversation, afin que votre assistant sache toujours qui vous êtes et comment vous aider.

### 3. Démarrez une session dans ce dossier

Dans pi-web, créez une nouvelle session pointant vers `~/my-assistant/` (ou le nom que vous lui avez donné). C'est tout — vous discutez avec votre assistant personnel.

### 4. Utilisez-le où que vous soyez

Installez pi-web en tant que PWA sur votre téléphone, votre tablette ou votre ordinateur portable. Votre assistant est toujours là — posez-lui n'importe quelle question, à tout moment.

## Idées pour votre assistant

| Rôle | Que mettre dans APPEND_SYSTEM.md |
|---|---|
| 🧠 **Coach de vie** | Vos objectifs, les habitudes sur lesquelles vous travaillez, des suggestions pour votre journal |
| 🏠 **Gestionnaire de maison** | Format de liste de courses, préférences des membres de la famille, planification des repas |
| 💼 **Compagnon de travail** | Votre rôle, vos projets en cours, le format de vos notes de réunion, le contexte de l'entreprise |
| 📚 **Partenaire d'étude** | Ce que vous apprenez, votre style d'explication préféré, mode « interroge-moi » |
| ✍️ **Assistant d'écriture** | Votre style d'écriture, vos préférences de ton, les formats courants que vous utilisez |

## Ajoutez plus de contexte

Vous pouvez mettre dans votre dossier d'assistant tout ce qui aide pi à être plus utile :

- `notes/` — des fichiers de référence que votre assistant peut lire
- `context.md` — des informations de contexte sur votre vie ou votre travail
- `projects.md` — vos projets en cours et leur statut

pi peut lire les fichiers du dossier, donc plus vous lui donnez de contexte, meilleur il devient.

## Demandez à pi-web de faire des choses

Après `pi install npm:@ygncode/pi-web@beta`, les sessions peuvent parler à pi-web lui-même.
Essayez :

- « Ajoute une planification à 2h du matin, heure de Singapour, pour résumer ma boîte de réception »
- « Liste mes planifications pi-web »
- « Mets en pause la planification de la boîte de réception »
- « Note ceci dans les notes »
- « Passe pi-web en mode sombre / désactive le titre automatique »

La compétence fournie **/skill:pi-web-schedule** transforme cela en une véritable planification
pi-web (celles que vous modifiez dans `/schedules`). Chaque déclenchement démarre une **nouvelle**
session, les instructions doivent donc se suffire à elles-mêmes — « résume le courrier non lu dans
~/inbox » fonctionne ; « continue ce que nous faisions » ne fonctionne pas.

Les planifications ne s'exécutent que lorsque pi-web est en cours d'exécution.

---

> 💡 **Astuce :** Commencez simplement. Quelques lignes sur qui vous êtes et comment vous voulez que l'assistant se comporte. Itérez au fil du temps, à mesure que vous apprenez ce qui fonctionne.
