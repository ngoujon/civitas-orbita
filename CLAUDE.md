# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commandes

```bash
npm run dev          # client Vite seul → http://localhost:5173
npm run dev:server   # API Express seule → http://localhost:3001
npm run dev:all      # client + API en parallèle (concurrently)

npm run build        # typecheck client + build Vite production
npm run build:server # compilation TypeScript du serveur
npm run typecheck    # tsc --noEmit (client uniquement)
npm run test         # vitest run (logique pure)
npm run test:watch   # vitest interactif

# Lancer un test précis
npx vitest run src/world/Ring.test.ts
```

Variables d'environnement serveur : `PORT` (3001), `JWT_SECRET` (obligatoire en prod), `DATABASE_PATH` (./data/civitas.db), `CORS_ORIGIN` (http://localhost:5173).

Comptes de seed : `demo@civitas.local / demo1234`, `test@civitas.local / test1234`, `joueur@civitas.local / joueur1234`.

## Architecture

### Principe fondamental : Simulation ⟂ Rendu

`GameState` (`src/game/GameState.ts`) est une structure de données **pure et sérialisable**. Les systèmes la mutent à pas fixe ; le rendu l'observe à 60 FPS sans jamais la muter. La sauvegarde est `JSON.stringify(state)`.

### Couches (dépendances vers le haut uniquement)

```
config/       données pures (ages, resources, buildings, civs, terrain…) — aucune logique
core/         EventBus, GameLoop, TimeManager, SaveSystem
world/        Ring, Sector, WorldMap, Placement, Terrain, bateaux, îles PNJ
economy/      ResourceManager, ProductionSystem, synergies, pêche
population/   PopulationSystem, WorkerAllocation
research/     AgeSystem, TechSystem
buildings/    BuildingRegistry, BuildingInstance, ConstructionSystem, UpgradeSystem
game/         GameState (données) + Game (orchestration) + events (typage bus)
rendering/    Camera, ProceduralSprites, WorldRenderer et renderers spécialisés — lit l'état, ne le mute JAMAIS
audio/        SoundSystem (SFX Web Audio API synthétisés, aucun fichier son)
ui/           HUD, panneaux DOM (tech, travailleurs, tutoriel), styles
api/          client HTTP (auth, personnage, sauvegardes)
web/          site (landing, auth, personnage, lobby, routeur)
main.ts       point d'entrée / composition root
```

### Serveur (`server/src/`)

API Express + SQLite (`better-sqlite3`) + WebSocket (`ws`).
Routes : `/api/auth` (JWT), `/api/characters`, `/api/saves`, `/api/worlds`.
WebSocket `ws/gateway.ts` : sync multijoueur avec snapshots et commandes autoritaires serveur.

### Boucle de jeu

`GameLoop` (rAF) → `TimeManager` accumule le temps réel → N ticks fixes (`TICK_SECONDS = 0.1`) → `Game.runTick` ordonne : `ability → construction → production → population`. Les animations visuelles utilisent le temps réel et continuent en pause.

### Extensibilité data-driven

Ajouter du contenu = éditer uniquement `src/config/` :
- ressource → `resources.ts`
- bâtiment → `buildings.ts` + optionnel drawer dans `rendering/ProceduralSprites.ts`
- âge → `ages.ts`
- technologie → `technologies.ts`
- civilisation → `civilizations.ts`

Le moteur itère sur ces données ; rien n'est codé en dur.

### EventBus

`core/EventBus<TEvents>` typé par `game/events.ts` (`GameEvents`). Toute communication inter-couches passe par le bus (`building:placed`, `age:advanced`, `ability:used`, `notify`, etc.). Jamais d'appel direct entre systèmes éloignés.

### Rendu procédural

Contrainte absolue : **zéro asset externe** (pas d'image, son, police importés). Tout est généré par code :
- `rendering/ProceduralSprites.ts` génère et met en cache des `RenderTexture` (une fois, réutilisées).
- `audio/SoundSystem.ts` synthétise les SFX via Web Audio API.
- Layers PixiJS : `terrain` (statique), `overlay`, `entity` (triés par y), `fx` (animations).
- Culling viewport actif ; jamais de redessin `Graphics` par frame pour un élément statique.

### Sauvegarde

`core/SaveSystem<TState>` enveloppe dans `{ version, savedAt, state }`. Migrations dans `Game.ts` (`migrateV1toV2`…). Auto-save cloud toutes les 45 s + fallback `localStorage`. Données dérivées (occupancy, géométrie) non sauvegardées — recalculées au chargement.

## Conventions

- TypeScript strict, pas de `any` non justifié.
- `type`/`interface` explicites ; unions de string littérales plutôt qu'`enum`.
- `config/` = données uniquement, aucune logique.
- Chaque dossier expose un `index.ts` barrel.
- Pas d'effet de bord à l'import (sauf `main.ts`).
- Le jeu est **entièrement en français** : UI, messages, labels, logs.
- Avant de livrer : `npm run build` passe + tests verts.
