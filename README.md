# Veille LinkedIn du réseau Procivis

Remplace l'app Streamlit et le `.command` du Mac de Maxime. Tout tourne dans le navigateur de la personne qui fait la veille (Stéphanie, de Papiers de Soi), avec son propre compte LinkedIn. Ce qui demande de l'IA (rédiger les temps forts, choisir les photos) passe par son application Claude desktop : aucune clé d'API Anthropic.

## Le vendredi

1. Sur linkedin.com, clic sur le favori **Veille LinkedIn** : il scanne les pages de `pages.json` (environ 5 à 10 minutes) et ouvre la page de veille, qui reçoit les résultats.
2. Sur la page, cocher les posts, les mettre dans l'ordre, puis **Valider la sélection**. On peut retenir la photo de chaque post en cliquant dessus (pour une vidéo : « Choisir un plan de la vidéo »), sinon Claude choisit. **Télécharger la sélection (.md)** produit un fichier à transmettre à la personne qui fait les temps forts : une partie lisible, puis la sélection complète en JSON pour son Claude.
3. Dans Claude desktop : « Fais les temps forts de la semaine » (skill à venir). Claude rédige les textes, choisit les photos, les fait valider, puis remplit les blocs Temps Fort de la NEWSLETTER HEBDO dans Dialog Insight avec la session DI de la personne (voir plus bas). Rien n’est envoyé.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | Page de veille : réception du scan, sélection, pages suivies, installation du favori |
| `favori/scan.js` | Code du favori. La page le lit et fabrique le lien `javascript:` à glisser dans les favoris |
| `pages.json` | Pages suivies (`statut: suivie`) et dormantes (`statut: dormante`) |
| `config.json` | Identifiant de la requête LinkedIn (`queryId`), seuils, rythme des dormantes, URL du relais |
| `skill/` | Skill Claude « temps-forts-de-la-semaine » (SKILL.md) et son paquet .zip à importer dans l’application Claude |
| `relay/worker.js` | Relais Cloudflare : enregistre scans, sélections et liste des pages dans le dépôt (jeton GitHub côté serveur uniquement) |
| `data/`, `selections/` | Archives écrites par le relais (`latest.json` + un fichier par date) |

## Remplissage de Dialog Insight (`di/temps-forts.js`)

Claude le charge dans un onglet DI connecté au projet PROCIVIS (`await import('https://reseauprocivis.github.io/veille-linkedin/di/temps-forts.js?v=' + Date.now())`), puis :

1. `await VLDI.selection()` lit `selections/latest.json` ;
2. `await VLDI.planche(sel.temps_forts)` affiche les images candidates numérotées (photos, pages de document, trois plans de chaque vidéo ; les miniatures de vidéo sont marquées « non »), Claude choisit avec une capture d'écran, `VLDI.candidat('2.b')` donne la source ;
3. `VLDI.lancer(idMessage, plan)` puis `VLDI.suivi()` toutes les 30 s : images ramenées à 900 px et versées dans la médiathèque, blocs Inauguré remplis dans l'ordre, blocs manquants créés en alternant image à gauche / à droite, blocs en trop retirés, séparateur à 0 sur le dernier, relecture de chaque bloc. Aucun envoi.

`plan = [{titre, texte, linkedin, image}]`, texte brut : le script le passe en entités HTML avec les insécables. Recharger l'éditeur DI après coup. Testé le 30/10/2026 sur la copie 17266 du numéro du 16/10 (12 blocs ramenés à 6, puis 7, puis 6).

Piège : DI répond `InternalError` si le Content-Type est `...;charset=UTF-8` sans espace (ce que `fetch` met seul pour un `URLSearchParams`). Le script envoie une chaîne avec l'en-tête de jQuery.

## Pourquoi un favori et une fenêtre ouverte

La politique de sécurité de linkedin.com interdit à un onglet LinkedIn d'appeler GitHub ou Cloudflare. Le favori ouvre donc la page de veille et lui passe les résultats par `postMessage` ; la page envoie en retour la liste des pages et la configuration. Corriger `config.json` ou `pages.json` suffit : le favori n'a pas à être réinstallé, sauf si `favori/scan.js` change.

## Dormantes

`config.dormantes` : `mensuel` (premier scan de chaque mois, valeur actuelle) ou `hebdo`. Une dormante qui publie de nouveau est signalée en haut de la sélection ; une page suivie sans post depuis `jours_avant_dormante` jours (150) est proposée comme dormante.

## Panne la plus probable

LinkedIn change le `queryId` de la requête du fil (toutes les pages en `fil_400` ou `fil_404`). Le retrouver : ouvrir une page entreprise, onglet Posts trié par « Récent », et relever dans l'onglet Réseau la requête `voyagerFeedDashOrganizationalPageUpdates.<hash>`. Mettre la nouvelle valeur dans `config.json`.

## Mise en place (une seule fois)

1. Dépôt public `ReseauProcivis/veille-linkedin`, GitHub Pages sur `main` à la racine.
2. Relais : dashboard Cloudflare → Workers → Create → coller `relay/worker.js` → secret `GH_TOKEN` (PAT fine-grained, Contents: Read and write sur ce seul dépôt). Reporter l'URL du Worker dans `config.json` (`relais`).
3. Ouvrir `https://reseauprocivis.github.io/veille-linkedin/`, onglet « Installer le favori ».
