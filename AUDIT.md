# Audit MovieManager

Date: 2026-03-10

## Modifications apportees

### Correctifs critiques et eleves
- Import series/episodes aligne sur le schema `media_versions` (`owner_type = movie|episode`) au lieu de `series`.
  - Ajout d'un rattachement via episode (creation saison/episode si necessaire).
  - Fichier: `src-tauri/src/commands/scan.rs`
- Detection de doublons en import corrigee.
  - Colonnes SQL corrigees (`media_version_id`, `owner_id`, `owner_type`).
  - Suppression du masquage d'erreurs (`unwrap_or_default`) au profit d'erreurs explicites.
  - Fichier: `src-tauri/src/commands/scan.rs`
- Inbox "Traites" fonctionnel.
  - Backend accepte `status = "all"` pour retourner tous les items.
  - Front passe en `useInboxItems("all")`.
  - Invalidation React Query corrigee avec une cle prefixee (`["inboxItems"]`).
  - Fichiers: `src-tauri/src/commands/inbox.rs`, `src/App.tsx`, `src/lib/hooks.ts`

### Correctifs moyens
- Inbox: `entity_id` stocke maintenant l'ID local (movie/series) et non l'ID TMDB.
  - Fichier: `src-tauri/src/commands/inbox.rs`
- Performance `get_series_detail` amelioree.
  - Regroupement des episodes par `season_id` via `HashMap` pour eviter les filtrages/clonages repetes.
  - Fichier: `src-tauri/src/commands/series.rs`
- Drag & drop dans la page Import fiabilise.
  - Priorite aux chemins natifs `file.path` en environnement Tauri.
  - Fallback nettoye et dedoublonnage des chemins.
  - Fichier: `src/pages/ImportPage.tsx`

### Correctifs faibles
- Compteur d'usage des tags (`usage_count`) calcule cote base et affiche dans l'UI.
  - Fichiers: `src-tauri/src/db/models.rs`, `src-tauri/src/db/queries.rs`, `src-tauri/src/commands/tags.rs`, `src/lib/api.ts`, `src/App.tsx`
- Affichage des positions dans les collections corrige (suppression du `+1`).
  - Fichier: `src/pages/CatalogPages.tsx`

## Verification technique
- `cargo check`: OK
- `npm run build`: OK

## Suggestions d'ameliorations fonctionnelles
1. Inbox: actions en lot (lier/ignorer/reouvrir) avec previsualisation d'impact.
2. Collections dynamiques: "smart collections" basees sur des regles (tags, qualite, annee, statut).
3. Import: mode dry-run detaille (crees/mis a jour/ignores) avant validation finale.
4. Historique: rollback groupe par operation (import, scan, sync TMDB).
5. Bibliotheque: pagination/virtualisation configurable pour les gros catalogues.

## Suggestions d'ameliorations esthetiques/UX
1. Uniformiser la charte visuelle via tokens (couleurs, spacing, typo) et reduire les styles inline.
2. Introduire un jeu d'icones coherent pour navigation, statut et actions frequentes.
3. Clarifier la hierarchie visuelle des listes/tables (dense/comfortable, hover/selected, contrastes).
4. Ajouter des animations discretes sur les transitions de panneaux, chargements et confirmations.
5. Corriger et unifier l'encodage/affichage des libelles FR pour supprimer les caracteres mojibakes.
