---
name: temps-forts-de-la-semaine
description: Rédige et intègre les « Temps forts de la semaine » de la NEWSLETTER HEBDO Procivis dans Dialog Insight, à partir de la sélection faite sur la page de veille LinkedIn (reseauprocivis.github.io/veille-linkedin) ou d'un fichier temps-forts-AAAA-MM-JJ.md. Claude lit la sélection, rédige un court texte par post, choisit les photos, fait tout valider, puis remplit les blocs Temps Fort du message DI ouvert dans Chrome. Rien n'est envoyé. À utiliser dès que l'utilisateur dit « fais les temps forts de la semaine », « temps forts », « intègre les temps forts dans la newsletter », « remplis les temps forts dans Dialog Insight », ou joint un fichier temps-forts-….md.
---

# Temps forts de la semaine

Les temps forts sont les posts LinkedIn des sociétés du réseau Procivis, en bas de la NEWSLETTER HEBDO, sous la bannière « temps forts ». Chacun est un bloc avec le nom de la société en orange, un texte court, une photo et le lien « Voir le post LinkedIn ».

La sélection est faite par une personne sur la page de veille. Ce skill fait le reste : textes, photos, remplissage de Dialog Insight (DI). **Aucun envoi, aucun BAT, aucun autre bloc touché.**

## Outils

- **Claude in Chrome**, dans le Chrome où la personne est connectée à DI (projet PROCIVIS).
- Le script `https://reseauprocivis.github.io/veille-linkedin/di/temps-forts.js`, chargé dans un onglet DI. Il fait tout le travail technique : lecture de la sélection, planche des photos, médiathèque, blocs. Ne pas réécrire ce qu'il fait.
- Un appel JavaScript ne doit pas durer plus de 40 secondes. Le script prévoit `lancer()` / `suivi()` et une planche par paquets pour cela.

Offre Pro : rester économe. Pas de captures d'écran inutiles, pas de relecture du HTML de DI, pas de lecture des posts sur LinkedIn (le texte complet est dans la sélection).

## Déroulé

### 1. Ouvrir le message et charger le script

Demander à la personne d'ouvrir dans Chrome la newsletter de la semaine dans l'éditeur DI (message nommé `JJ-MM-AAAA NEWSLETTER HEBDO`, préparé par duplication du numéro précédent). L'identifiant est dans l'adresse de l'onglet : `.../editor/message/<id>`.

Dans un **autre** onglet DI (par exemple `https://app.mydialoginsight.com/fe/ofc4/home`, pour ne pas écrire sous l'éditeur ouvert) :

```js
await import('https://reseauprocivis.github.io/veille-linkedin/di/temps-forts.js?v=' + Date.now());
await VLDI.infos(<id>)
```

Vérifier que le nom est bien `JJ-MM-AAAA NEWSLETTER HEBDO` avec la date du vendredi visé. Sinon, s'arrêter et demander. `blocs_temps_fort` donne le nombre de blocs déjà en place (ceux du numéro précédent).

Erreur « session DI expirée ou projet autre que PROCIVIS » : la personne se reconnecte à DI, ou choisit PROCIVIS dans la liste du haut de DI.

### 2. Lire la sélection

- Cas habituel : `const sel = await VLDI.selection()`. La sélection validée est lue en ligne et gardée dans `window.VL_SEL`.
- Si la personne a joint un fichier `temps-forts-….md` : le bloc JSON en fin de fichier est la sélection. Comparer sa date et ses posts avec `VLDI.selection()`. S'ils sont identiques, utiliser la version en ligne. Sinon, poser le JSON du fichier : `window.VL_SEL = {...}`.

Ne renvoyer dans la conversation que l'essentiel (numéro, page, date, texte, nombre d'images, `photo`), pas les adresses des images.

### 3. Rédiger les textes

Pour chaque temps fort, dans l'ordre de la sélection :

- **Titre** : le nom de la société tel qu'on l'écrit dans le réseau (« Groupe Procivis Ouest », « Edifidès », « Immo de France Hauts-de-France »). Si le post est une republication (`reprise`), le titre est la société qui publie la page, et le texte cite l'auteur d'origine si c'est utile.
- **Texte** : 1 à 3 phrases, 300 à 450 caractères. Factuel, au présent ou au passé composé, à la troisième personne.
  - Dire ce qui se passe, où et avec qui : nom du programme, ville avec le numéro du département entre parenthèses, chiffres clés (logements, m², dates), partenaires nommés.
  - Noms de résidence et de programme entre guillemets droits : `"Le Belvédère"`.
  - Exposants en HTML : `4<sup>e</sup> trimestre`, `6<sup>e</sup> arrondissement`.
  - Interdit : émojis, hashtags, mentions @, liens, tirets longs, points d'exclamation, superlatifs publicitaires (« exceptionnel », « idéalement situé »), formules d'appel (« Contactez-nous », « Profitez-en »), toute information absente du post.
  - Ne pas recopier le post : le résumer.
- Écrire du texte brut. Le script pose lui-même les espaces insécables et les entités HTML.

Exemples (newsletter du 16/10/2026) :

> **Pierre Passion**
> Pierre Passion remporte la Pyramide d'argent de la conduite responsable des opérations, parrainée par l'Apave, pour la résidence "Bosquet de la Grive" à L'Union (31) : une boucle de réemploi inédite mise en place avec Patrimoine SA Languedocienne et les entreprises du chantier, aux côtés du bailleur Promologis et de l'OFS de Midi Habitat. Une belle récompense pour l'entreprise à mission.

> **Edifidès**
> Le chantier "Les Jardins d'Auguste" démarre à Giberville (14), à quelques minutes de Caen, dans le nouveau quartier des Jardins de Clopée : maisons 4 pièces avec jardin plein sud et appartements du 2 au 4 pièces avec balcon, loggia ou terrasse. Quelques lots restent à saisir.

> **Groupe CISN**
> TF1 a choisi le Groupe CISN pour un reportage grand format sur l'habitat à Saint-Nazaire (44) : pourquoi les promoteurs ne sortent-ils pas plus de logements alors que la demande est là ? Tourné sur le projet "La Ronde du Carrousel", entièrement vendu, à quelques pas du front de mer, avec Matthieu Nédonchelle face caméra. Le reportage a depuis été diffusé dans le journal de 13 h.

### 4. Choisir les photos

- Si le temps fort porte `photo` (choisie sur la page de veille), la reprendre telle quelle, sans discuter.
- Pour les autres, afficher la planche par paquets de 4 temps forts, puis faire une capture d'écran de l'onglet :

```js
await VLDI.planche(VL_SEL.temps_forts, [0, 1, 2, 3])   // puis [4, 5, 6, 7], etc.
```

  Chaque image porte un code (`3.b`). Règles :
  - la plus belle photo du projet : bâtiment, chantier, inauguration, équipe sur place ;
  - pas d'affiche couverte de texte quand une vraie photo existe, pas de logo seul ;
  - pour une vidéo, jamais la miniature (marquée « miniature (non) ») : prendre un des trois plans proposés, net et sans texte coupé ;
  - pour un document, la page de couverture si elle montre le projet.
- Source retenue : `VLDI.candidat('3.b')`. Fermer avec `VLDI.fermerPlanche()`.

La photo garde ses proportions, ramenée à 900 px de large. Aucun recadrage par défaut. Ne recadrer (`image.recadrage = {x, y, w, h}` en fractions) que si la personne le demande, et vérifier avec `VLDI.apercu(source)`.

### 5. Faire valider

Montrer dans la conversation, pour chaque temps fort : numéro, titre, texte, photo retenue (code ou « choisie sur la page »). Montrer la planche des photos retenues si la personne le souhaite. **Attendre son accord explicite** avant d'écrire quoi que ce soit dans DI. Après une correction, remontrer le texte corrigé.

### 6. Remplir Dialog Insight

```js
const plan = [ {titre, texte, linkedin: t.url, image: <source>}, ... ];   // dans l'ordre de la newsletter
VLDI.lancer(<id>, plan)
```

Puis `VLDI.suivi()` toutes les 30 secondes, jusqu'à `etat: 'fini'` ou `'erreur'`. Compter environ 15 secondes par temps fort.

Le script :
- prépare chaque image dans le navigateur, la verse et la confirme dans la médiathèque DI ;
- remplit les blocs Temps Fort existants dans l'ordre ;
- crée ceux qui manquent en alternant image à gauche et image à droite ;
- retire ceux qui sont en trop (temps forts du numéro précédent) ;
- met le séparateur à 0 sur le dernier bloc ;
- relit chaque bloc.

Le rapport donne `ecarts` (champs relus différents de ce qui a été écrit) et `sauvegarde_avant` (contenu des blocs avant le remplissage). Garder `sauvegarde_avant` dans la conversation jusqu'à la fin.

En cas d'erreur en cours de route : relancer `VLDI.lancer` avec le même plan. Le script reprend les blocs en place. Pour ne pas reverser les images déjà versées, remplacer `image` par `{dejaVersee: <url>}` avec les URL de `VLDI.etat(<id>)`.

### 7. Contrôler et rendre la main

1. `await VLDI.etat(<id>)` : titres, images et liens dans l'ordre, `sep` à 0 sur le dernier seulement.
2. Demander à la personne de **recharger l'éditeur DI (F5)** : il ne voit pas les modifications faites par le script, et un enregistrement depuis une page non rechargée les écraserait.
3. Lui demander de vérifier la rubrique dans l'aperçu DI. Le BAT et l'envoi restent à elle (ou à Maxime).

Résumer : nombre de temps forts écrits, blocs créés ou retirés, écarts éventuels.

## Pannes connues

| Symptôme | Cause | Remède |
|---|---|---|
| « Média illisible (lien LinkedIn expiré ?) » | Les liens d'images LinkedIn expirent au bout de quelques semaines | Refaire le scan et la sélection sur la page de veille |
| `InternalError` sur toutes les commandes | Session DI expirée, ou éditeur ouvert sur un autre projet | Se reconnecter, choisir PROCIVIS, relancer |
| « Aucun bloc Inauguré dans ce message » | Le message n'est pas une NEWSLETTER HEBDO, ou la rubrique a été supprimée | Vérifier le message ouvert, ne rien forcer |
| « Les blocs Inauguré ne forment pas une suite unique » | Blocs Temps Fort séparés par un autre bloc | Le signaler. La personne remet la rubrique d'aplomb dans DI |
| Aucune sélection en ligne | La sélection n'a pas été validée, ou le relais était indisponible | Demander le fichier `.md` ou une nouvelle validation |

## À ne jamais faire

- Envoyer le message, lancer un BAT, changer l'objet, l'expéditeur ou un autre bloc que les Temps Fort.
- Écrire dans DI avant l'accord de la personne sur les textes et les photos.
- Inventer une information absente du post.
- Travailler sur un message dont le nom n'est pas la NEWSLETTER HEBDO de la bonne date.
