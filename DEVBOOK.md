# Devbook — Civitas Orbita

Guide developpeur du projet. Pour la prise en main rapide, voir `README.md`.
Pour les regles strictes (conventions, perf, modularite), voir `.cursorrules`.

---

## 1. Philosophie

Trois principes guident toute l'architecture :

1. **Simulation ⟂ Rendu.** L'etat du jeu (`GameState`) est une structure de
   donnees pure et serialisable. La simulation le mute a pas de temps fixe ; le
   rendu l'observe a 60 FPS sans jamais le modifier.
2. **Data-driven.** Le contenu (ages, ressources, batiments, civilisations) vit
   dans `src/config/`. Le moteur itere sur ces donnees ; ajouter du contenu ne
   doit jamais exiger de modifier la logique.
3. **Zero asset externe.** Tous les visuels (sprites, terrain, decor) et tous
   les sons sont **generes par code** (PixiJS Graphics, Web Audio API).

---

## 2. Architecture en couches

Les fleches indiquent les dependances autorisees (une couche basse ne connait
jamais une couche haute).

```
config/   (donnees pures, aucune dependance)
   ^
core/     (moteur generique : EventBus, GameLoop, TimeManager, SaveSystem)
   ^
world/  economy/  population/  research/  buildings/   (systemes de simulation)
   ^
game/     (GameState = contrat de donnees partage + orchestrateur Game)
   ^
rendering/  audio/  ui/   (presentation : observent l'etat, ne le mutent pas*)
   ^
main.ts   (composition root)
```

\* Le rendu et l'audio ne mutent jamais l'etat de simulation. Seul `Game`
(via les systemes et les actions joueur) mute `GameState`.

### Role de chaque dossier

| Dossier | Responsabilite |
|---|---|
| `config/` | Source de verite du game design (data only). |
| `core/` | Infrastructure agnostique du gameplay. |
| `world/` | Geometrie : anneaux, secteurs, carte, hit-testing, placement. |
| `economy/` | Ressources, capacites, production/consommation par tick. |
| `population/` | Logement, affectation d'emplois, croissance, famine. |
| `research/` | Conditions et application des transitions d'age. |
| `buildings/` | Definitions (via config), instances posees, chantiers. |
| `rendering/` | Camera, generation de textures, rendu PixiJS, animations. |
| `audio/` | `SoundSystem` : SFX synthetises et branches sur l'EventBus. |
| `game/` | `GameState` (donnee), `Game` (orchestration), `events` (typage du bus). |
| `ui/` | `StartScreen`, `HUD` (overlays DOM) et styles. |

---

## 3. Boucle de jeu et temps

- `GameLoop` (requestAnimationFrame) appelle chaque frame `onUpdate(realDt)` puis
  `onRender(alpha)`, et mesure le FPS.
- `TimeManager` accumule le temps reel et le decoupe en **ticks fixes**
  (`TICK_SECONDS = 0.1`), avec garde-fou anti spiral-of-death
  (`MAX_TICKS_PER_FRAME`). Gere aussi la vitesse (0/1/2/4) et la pause.
- `Game.onUpdate` :
  1. applique le pan clavier (temps reel) ;
  2. demande N ticks a `TimeManager` ;
  3. execute `runTick(TICK_SECONDS)` N fois.
- `Game.runTick` ordonne les systemes :
  `ability -> construction -> production -> population`.
- `Game.onRender` met a jour le survol puis appelle `WorldRenderer.render`.

Les animations visuelles (feu, fumee, pop, surbrillance) utilisent le temps
reel et continuent meme en pause.

---

## 4. Flux de donnees (exemple : poser un batiment)

```
Clic joueur
  -> HUD/Game.handleClick -> screenToSector (camera + WorldMap.sectorAtPoint)
  -> Game.tryPlace -> ConstructionSystem.place
       - canPlace : deblocage d'age + Placement.canBuildAt + cout effectif
       - spend(cout) ; cree BuildingInstance dans GameState.buildings
  -> Game met a jour l'occupancy + expandIfNeeded
  -> EventBus.emit('building:placed')
       - SoundSystem joue 'place'
       - WorldRenderer cree le sprite (pop anim) au prochain render
       - HUD rafraichit
```

Tout passe par `GameState` (mutation) et l'`EventBus` (notification). Aucun
appel direct entre systemes eloignes.

---

## 5. GameState et sauvegarde

`GameState` (voir `src/game/GameState.ts`) contient : `civ`, `age`, `ability`,
`totalTicks`, `resources`, `capacities`, `population`, `buildings`, `ringCount`,
`nextBuildingId`. Tout est serialisable (pas de classes Pixi, pas de fonctions).

- `SaveSystem<TState>` (core) enveloppe l'etat dans `{ version, savedAt, state }`
  et le stocke en `localStorage`.
- **Versionnement** : `SAVE_VERSION` dans `Game`. Toute evolution du schema
  incremente la version et ajoute une migration `migrations[N]` qui transforme
  une sauvegarde vN en v(N+1). Exemple existant : `migrateV1toV2` injecte `civ`
  et `ability` dans les anciennes sauvegardes.
- Donnees derivees (occupancy, geometrie de la carte) **ne sont pas** sauvees :
  elles sont recalculees au chargement (`computeOccupancy`, `WorldMap`).

---

## 6. Le systeme d'anneaux

- `config/rings.ts` definit la formule : anneau 0 = centre (1 secteur),
  anneau n = `SECTORS_PER_RING_BASE * n` secteurs (4, 8, 12, 16...).
- `Ring` calcule la geometrie (rayons, angles, centre d'un secteur).
- `WorldMap` agrege les anneaux et fournit : iteration des secteurs,
  `sectorAtPoint` (hit-testing), `neighbors` (adjacence intra/inter-anneau),
  `geometry`, et l'expansion (`setRingCount` / `expand`).
- `Placement.canBuildAt` impose une **croissance organique** : un secteur est
  constructible s'il est vide et adjacent a un secteur deja occupe.

---

## 7. Civilisations (bonus passifs + capacite active)

`config/civilizations.ts` est entierement data-driven.

- **Modificateurs passifs** (`CivModifiers`) : multiplicateurs de production
  (global et par ressource), cout/temps de construction, croissance, appetit,
  stockage, ressources/population de depart.
- **Capacite active** (`CivAbility`) : `cooldown` + un `AbilityEffect` parmi
  `grant` (octroi de ressources), `complete_constructions`, `production_buff`
  (multiplicateur temporaire).
- `getCivModifiers(civId)` renvoie des modificateurs **normalises** (tous les
  champs presents avec leur valeur neutre). Les systemes l'appellent et
  multiplient leurs taux.
- `Game.activateAbility` applique l'effet, declenche le cooldown et emet
  `ability:used`. `Game.runTick -> tickAbility` decremente cooldown et buff.

---

## 8. Rendu

- `Camera` applique une transform (scale + position lissees) au conteneur-monde
  et convertit ecran <-> monde (zoom/pan/recentrage, bornes visibles).
- `ProceduralSprites` genere et **cache** des `RenderTexture` (batiments, decor,
  habitants) : dessin une fois, reutilisation ensuite (`scaleMode = 'nearest'`
  pour le rendu pixel). Ombrage a 3 tons via `shade()`.
- `WorldRenderer` organise des couches : `terrain` (statique), `overlay`
  (surbrillance), `entity` (batiments + decor, tries par y), `fx` (anime).
  - **Decor** : props deterministes (seed `mulberry32` par cle de secteur),
    regeneres uniquement quand la carte ou le nombre de batiments change.
  - **Culling** : seules les entites dans le viewport sont visibles.
  - **Animations** : feu/fumee dans `fx`, pop d'apparition (`easeOutBack`),
    surbrillance pulsee.

Regle de perf : jamais de redessin `Graphics` par frame pour un element
statique ; reutiliser les sprites (diff add/remove), partager les textures.

---

## 9. Audio

`audio/SoundSystem.ts` synthetise 8 SFX via la Web Audio API (oscillateurs,
enveloppes de gain, bruit blanc) — aucun fichier audio. `bindBus` mappe les
evenements de jeu aux sons ; `attachUiClicks` ajoute un retour sur les boutons.
L'`AudioContext` est cree paresseusement et reactive a la premiere interaction
(politique d'autoplay). Mute persistant en `localStorage`.

---

## 10. EventBus

`core/EventBus<TEvents>` est un pub/sub type. La carte concrete des evenements
est `game/events.ts` (`GameEvents`). Evenements actuels : `building:placed`,
`building:completed`, `building:cancelled`, `building:selected`,
`age:advanced`, `buildmode:changed`, `ability:used`, `menu:open`, `notify`.

Utiliser le bus pour toute communication inter-couches faiblement couplee
(notamment vers l'UI et l'audio).

---

## 11. Recettes d'extension

### Ajouter une ressource
1. Ajouter l'id a `ResourceId` et l'entree dans `RESOURCES` (`config/resources.ts`).
2. C'est tout : HUD, stockage et production la prennent en compte automatiquement.

### Ajouter un batiment
1. Ajouter l'id a `BuildingId` et l'entree dans `BUILDINGS` (`config/buildings.ts`)
   avec `description`, `cost`, `produces/consumes`, `jobs/housing/storage`,
   `unlockedAtAge`, et une cle `sprite`.
2. (Optionnel) Ajouter un drawer dans `BUILDING_DRAWERS` de
   `rendering/ProceduralSprites.ts` pour un visuel dedie (sinon `drawGeneric`).

### Ajouter un age
1. Ajouter l'id a `AgeId`, l'entree dans `AGES` et la position dans `AGE_ORDER`
   (`config/ages.ts`), avec `scienceCost` et `requiredPopulation`.

### Ajouter une civilisation
1. Ajouter l'id a `CivId` et l'entree dans `CIVILIZATIONS`
   (`config/civilizations.ts`) : `modifiers`, `ability`, `emblem`, textes.
2. L'ecran d'accueil et les systemes l'integrent automatiquement.

### Ajouter un SFX
1. Ajouter le nom a `SfxName` et la recette dans `SoundSystem.play`.
2. Le declencher via un evenement dans `SoundSystem.bindBus`.

---

## 12. Conventions

- TypeScript strict ; pas de `any` non justifie.
- Unions de string literales plutot qu'`enum` (meilleure serialisation).
- `config/` = donnees uniquement (aucune logique).
- Chaque dossier expose un `index.ts` (barrel).
- Commentaires : expliquer le *pourquoi*, jamais le *quoi* evident.
- Pas d'effet de bord a l'import (sauf `main.ts`).

---

## 13. Qualite et commandes

```bash
npm run typecheck   # tsc --noEmit
npm run test        # vitest (logique pure : anneaux, placement...)
npm run build       # typecheck + build de production
```

Avant de livrer une feature : `npm run build` doit passer et les tests verts.
Tests actuels : `src/world/Ring.test.ts` (geometrie, hit-testing, voisinage,
placement). Privilegier les tests sur la logique pure (systemes, config),
le rendu restant teste manuellement.

---

## 14. Performance (cibles)

- 1000+ batiments, 5000+ habitants, dizaines d'anneaux, 60 FPS.
- Leviers en place : pas fixe + interpolation, textures cachees, batching Pixi,
  culling viewport, decor regenere a la demande, structures plates indexees par id.
- Pistes futures : object pooling des sprites d'habitants, agregation de la
  population, quadtree pour le hit-testing si la carte devient tres grande.

---

## 15. Roadmap (idees)

- Habitants visibles se deplacant entre logements et lieux de travail (poolises).
- Cycle jour/nuit (teinte ambiante + halo des feux la nuit).
- Ameliorations/niveaux de batiments (`level` est deja dans l'instance).
- Arbre technologique au sein des ages.
- Musique d'ambiance generative evoluant avec l'age.
- Combat / unites militaires (la caserne pose les bases).
```
