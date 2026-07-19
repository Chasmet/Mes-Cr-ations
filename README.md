# Mes Créations

Application mobile installable pour classer des projets créatifs, leurs saisons et leurs épisodes vidéo.

## Fonctionnalités

- Nombre de saisons illimité par projet
- Titre personnalisé pour chaque saison
- Ajout, renommage et suppression des saisons vides
- Protection des saisons qui contiennent déjà des épisodes
- Ajout, modification, déplacement et suppression des épisodes
- Lecture, partage et téléchargement des vidéos sur Android
- Recherche dans les projets, saisons, titres et résumés d’épisodes
- Tri de la bibliothèque par date, nom ou nombre d’épisodes
- Miniatures compressées automatiquement
- Export et import des données textuelles au format JSON
- Installation en PWA et fonctionnement hors ligne

## Stockage

Les informations des projets sont enregistrées dans `localStorage`. Les vidéos sont conservées localement dans `IndexedDB` sur le téléphone.

La mise à jour migre automatiquement les anciennes données `mes-creations-v5`, `mes-creations-v4` et `mes-creations-data` vers le nouveau format. Les anciennes saisons reçoivent un titre par défaut comme `Saison 1` sans perdre leurs épisodes ou leurs références vidéo.

L’export JSON contient les projets, titres de saisons, épisodes et résumés. Les vidéos ne sont pas incluses afin d’éviter des sauvegardes trop lourdes.

## Structure

- `index.html` : écrans et structure de l’application
- `style.css` : interface mobile
- `app-core.js` : données, migration et stockage vidéo
- `app-ui.js` : affichage et formulaires
- `app-projects.js` : gestion des projets, saisons et épisodes
- `app-media.js` : lecture, partage, sauvegarde et stockage
- `app-events.js` : interactions utilisateur et installation PWA
- `sw.js` : cache hors ligne
- `manifest.webmanifest` : installation Android

## Déploiement

L’application fonctionne directement sur GitHub Pages, sans serveur ni API.
