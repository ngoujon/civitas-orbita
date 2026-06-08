# Civitas Orbita

Jeu de gestion de colonie evolutif a travers les ages. La ville grandit en
**anneaux concentriques** autour d'un feu de camp central, de l'Age du Feu
jusqu'au Futur. Rendu **100% procedural** (zero asset externe : aucune image,
aucun son telecharge), style pixel art inspire de Pokemon Rouge Feu / Vert
Feuille.

## Apercu des fonctionnalites

- **Carte en anneaux concentriques** (1, 4, 8, 12, 16... secteurs), croissance
  organique vers l'exterieur, entierement parametrable.
- **Ecran d'accueil** avec choix parmi **6 civilisations**, chacune dotee de
  bonus passifs et d'une **capacite active** (rechargeable).
- **Economie** : recolte, production, consommation, stockage (8 ressources).
- **Population** : logement, emplois automatiques, croissance, famine.
- **9 ages** historiques debloquant batiments et ressources via la recherche.
- **14 batiments** dessines proceduralement, avec infobulles d'utilite.
- **Rendu anime** : feu de camp vivant, fumee, decor parseme (arbres, rochers,
  fleurs), animation d'apparition des batiments, vignette d'ambiance.
- **SFX synthetises** par code (Web Audio API), mute persistant.
- **Sauvegarde JSON versionnee** avec migrations.

## Stack

- **TypeScript** (strict) — robustesse pour une grande base de code.
- **PixiJS v8** (WebGL/WebGPU) — rendu 2D performant, dessin procedural via `Graphics`.
- **Web Audio API** — effets sonores synthetises (aucun fichier audio).
- **Vite** — dev server + build.
- **Vitest** — tests unitaires de la logique pure.

## Demarrage

```bash
npm install
npm run dev       # serveur de dev (http://localhost:5173)
npm run build     # typecheck + build de production
npm run test      # tests unitaires
npm run typecheck # verification de types seule
```

### Avec Docker

```bash
# Production (Nginx) -> http://localhost:8080
docker compose up --build web

# Developpement (HMR) -> http://localhost:5173
docker compose --profile dev up dev
```

## Commandes en jeu

| Action | Touche / Souris |
|---|---|
| Selectionner un secteur / poser un batiment | Clic gauche |
| Deplacer la camera | Glisser ou Fleches / WASD |
| Zoom / dezoom | Molette ou `+` / `-` |
| Quitter le mode construction | Clic droit / `Echap` |
| Recentrer sur le feu de camp | `C` |
| Pause | `Espace` |

## Boucle de jeu

1. Choisir une civilisation sur l'ecran d'accueil.
2. Construire une **ferme** (nourriture) et une **hutte** (logement) sur l'anneau 1.
3. Accumuler de la **science** (feu de camp, puis bibliotheque) pour faire
   evoluer la civilisation vers l'age suivant.
4. Etendre la ville vers l'exterieur, debloquer de nouveaux batiments, et
   utiliser la capacite active de sa civilisation au bon moment.

## Architecture

Separation stricte **simulation / rendu**. `GameState` est une donnee pure et
serialisable (sauvegarde = `JSON.stringify`). La simulation tourne a pas fixe ;
le rendu observe l'etat a 60 FPS sans jamais le muter. Voir `.cursorrules` pour
les conventions et `DEVBOOK.md` pour le guide developpeur detaille.

```
src/
  config/      donnees data-driven (ages, ressources, batiments, anneaux, civilisations)
  core/        moteur (EventBus, GameLoop, TimeManager, SaveSystem)
  world/       geometrie (anneaux, secteurs, carte, placement)
  economy/     ressources, production, consommation, stockage
  population/  habitants, emplois, besoins
  research/    ages et deblocages
  buildings/   definitions, instances, construction
  rendering/   camera, sprites proceduraux, renderer monde (PixiJS)
  audio/       SoundSystem (SFX synthetises)
  game/        GameState + orchestrateur Game + evenements
  ui/          ecran d'accueil, HUD (overlay DOM) + styles
  main.ts      point d'entree
```

## Extensibilite (data-driven)

Ajouter du contenu = editer la **config** uniquement, sans toucher au moteur :

- nouvelle ressource -> `src/config/resources.ts`
- nouveau batiment -> `src/config/buildings.ts`
- nouvel age -> `src/config/ages.ts`
- nouvelle civilisation -> `src/config/civilizations.ts`

Le moteur itere sur ces donnees ; rien n'est code en dur.

## Sauvegarde

Format JSON versionne (`SAVE_VERSION`), avec migrations entre versions pour
preserver la compatibilite des anciennes sauvegardes. Sauvegarde automatique
toutes les 60 s + boutons Sauver / Charger / Menu.

## Documentation

- `.cursorrules` — stack, conventions, regles de modularite et de performance.
- `DEVBOOK.md` — guide developpeur : architecture detaillee, flux de donnees,
  recettes d'extension, roadmap.
