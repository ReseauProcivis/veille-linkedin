# Veille LinkedIn du réseau Procivis

Remplace l'app Streamlit et le `.command` du Mac de Maxime. Tout tourne dans le navigateur de la personne qui fait la veille (Stéphanie, de Papiers de Soi), avec son propre compte LinkedIn. Ce qui demande de l'IA (rédiger les temps forts, choisir les photos) passe par son application Claude desktop : aucune clé d'API Anthropic.

## Le vendredi

1. Sur linkedin.com, clic sur le favori **Veille LinkedIn** : il scanne les pages de `pages.json` (environ 5 à 10 minutes) et ouvre la page de veille, qui reçoit les résultats.
2. Sur la page, cocher les posts, les mettre dans l'ordre, puis **Valider la sélection**.
3. Dans Claude desktop : « Fais les temps forts de la semaine » (skill à venir). Claude rédige les textes, choisit les photos, les fait valider, puis remplit les blocs Temps Fort de la NEWSLETTER HEBDO dans Dialog Insight avec la session DI de la personne. Rien n'est envoyé.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | Page de veille : réception du scan, sélection, pages suivies, installation du favori |
| `favori/scan.js` | Code du favori. La page le lit et fabrique le lien `javascript:` à glisser dans les favoris |
| `pages.json` | Pages suivies (`statut: suivie`) et dormantes (`statut: dormante`) |
| `config.json` | Identifiant de la requête LinkedIn (`queryId`), seuils, rythme des dormantes, URL du relais |
| `relay/worker.js` | Relais Cloudflare : enregistre scans, sélections et liste des pages dans le dépôt (jeton GitHub côté serveur uniquement) |
| `data/`, `selections/` | Archives écrites par le relais (`latest.json` + un fichier par date) |

## Pourquoi un favori et une fenêtre ouverte

La politique de sécurité de linkedin.com interdit à un onglet LinkedIn d'appeler GitHub ou Cloudflare. Le favori ouvre donc la page de veille et lui passe les résultats par `postMessage` ; la page envoie en retour la liste des pages et la configuration. Corriger `config.json` ou `pages.json` suffit : le favori n'a pas à être réinstallé, sauf si `favori/scan.js` change.

## Dormantes

`config.dormantes` : `mensuel` (premier scan de chaque mois, valeur actuelle) ou `hebdo`. Une dormante qui publie de nouveau est signalée en haut de la sélection ; une page suivie sans post depuis `jours_avant_dormante` jours (150) est proposée comme dormante.

## Panne la plus probable

LinkedIn change le `queryId` de la requête du fil (toutes les pages en `fil_400` ou `fil_404`). Le retrouver : ouvrir une page entreprise, onglet Posts trié par « Récent », et relever dans l'onglet Réseau la requête `voyagerFeedDashOrganizationalPageUpdates.<hash>`. Mettre la nouvelle valeur dans `config.json`.

## Mise en place (une seule fois)

1. Dépôt public `maxtaillebois/veille-linkedin`, GitHub Pages sur `main` à la racine.
2. Relais : dashboard Cloudflare → Workers → Create → coller `relay/worker.js` → secret `GH_TOKEN` (PAT fine-grained, Contents: Read and write sur ce seul dépôt). Reporter l'URL du Worker dans `config.json` (`relais`).
3. Ouvrir `https://maxtaillebois.github.io/veille-linkedin/`, onglet « Installer le favori ».
