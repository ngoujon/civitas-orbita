# Civitas Orbita

Jeu de gestion de colonie evolutif a travers les ages. La ville grandit en
**anneaux concentriques** autour d'un feu de camp central, de l'Age du Feu
jusqu'au Futur. Rendu **100% procedural** (zero asset externe : aucune image,
aucun son telecharge), style pixel art inspire de Pokemon Rouge Feu / Vert
Feuille.

**Comptes joueurs** : inscription, connexion et creation de personnage (chef de
village) via une API backend. La progression persistante cote serveur est
prevue ; la partie en cours reste en session locale pour l'instant.

## Apercu des fonctionnalites

### Site et compte

- **Page d'accueil** publique (`/`) avec presentation du jeu.
- **Inscription / connexion** (`/register`, `/login`) — authentification JWT.
- **Creation de personnage** (`/character`) : nom du chef, nom du village, choix
  parmi **6 civilisations** (bonus passifs + **capacite active** rechargeable).
- **Partie** (`/play`) accessible apres connexion et creation du personnage.

### Gameplay

- **Carte en anneaux concentriques** (1, 4, 8, 12, 16... secteurs), croissance
  organique vers l'exterieur, entierement parametrable.
- **Preparation du terrain** : defrichage ou aplanissement avant construction.
- **Economie** : recolte, production, consommation, stockage (**8 ressources**).
- **Synergies de production** : bonus entre batiments adjacents du meme groupe.
- **Ameliorations de batiments** : niveaux successifs avec couts et effets croissants.
- **Population** : logement, emplois, croissance, famine ; **repartition manuelle**
  de la main-d'oeuvre par secteur (production, commerce, recherche, militaire).
- **9 ages** historiques debloquant contenu via la recherche.
- **Arbre de technologies** (~27 techs) : debloque batiments, competences d'ere
  et maitrises par age.
- **19 batiments** dessines proceduralement, avec infobulles d'utilite.
- **Mer et exploration** : brouillard de guerre, bateaux eclaireurs depuis le port.
- **Peche** : bateaux de peche envoyes depuis le port.
- **Iles PNJ** : villages voisins, expeditions de pillage.
- **Rendu anime** : feu de camp vivant, fumee, decor parseme, mer procedurale,
  animation d'apparition des batiments, vignette d'ambiance.
- **SFX synthetises** par code (Web Audio API), mute persistant.
- **Journal de partie** (chat log) redimensionnable.

## Stack

| Couche | Technologies |
|---|---|
| Client | **TypeScript** (strict), **PixiJS v8** (WebGL/WebGPU), **Vite** |
| Audio | **Web Audio API** — effets sonores synthetises (aucun fichier audio) |
| API | **Express**, **SQLite** (`better-sqlite3`), **JWT**, **bcrypt** |
| Tests | **Vitest** — logique pure |
| Deploiement | **Docker** (Nginx + API), proxy `/api` en dev et prod |

## Demarrage

### Developpement local

```bash
npm install

# Client seul (proxy /api -> localhost:3001)
npm run dev              # http://localhost:5173

# API seule
npm run dev:server       # http://localhost:3001

# Client + API en parallele
npm run dev:all
```

```bash
npm run build            # typecheck client + build Vite
npm run build:server     # compilation TypeScript du serveur
npm run test             # tests unitaires
npm run typecheck        # verification de types client
```

### Variables d'environnement (API)

| Variable | Defaut | Description |
|---|---|---|
| `PORT` | `3001` | Port d'ecoute de l'API |
| `JWT_SECRET` | — | Secret de signature des tokens (obligatoire en prod) |
| `DATABASE_PATH` | `./data/civitas.db` | Chemin du fichier SQLite |
| `CORS_ORIGIN` | `http://localhost:5173` | Origine autorisee pour CORS |

### Avec Docker

```bash
# Production (Nginx + API) -> http://localhost:8080
docker compose up --build

# Developpement (HMR, client seul) -> http://localhost:5173
docker compose --profile dev up dev
```

En production Docker, Nginx sert le client et proxifie `/api` vers le conteneur
`api`. La base SQLite est persistee dans le volume `civitas-data`.

## Parcours joueur

1. Creer un compte ou se connecter depuis la page d'accueil.
2. Definir son **chef de village**, le **nom du village** et sa **civilisation**.
3. Lancer la partie : construire une **ferme** et une **hutte** sur l'anneau 1.
4. Defricher ou aplatir les secteurs, puis etendre la ville vers l'exterieur.
5. Rechercher des **technologies** et faire evoluer la civilisation vers l'age
   suivant (science + population requise).
6. Exploiter les **synergies**, gerer la **main-d'oeuvre**, envoyer des
   **bateaux** (peche, exploration) et mener des **expeditions** vers les iles PNJ.

## Commandes en jeu

| Action | Touche / Souris |
|---|---|
| Selectionner un secteur / poser un batiment | Clic gauche |
| Deplacer la camera | Glisser ou Fleches / ZQSD |
| Zoom / dezoom | Molette ou `+` / `-` |
| Quitter le mode construction | Clic droit / `Echap` |
| Recentrer sur le feu de camp | `C` |
| Pause | `Espace` |

## Architecture

Separation stricte **simulation / rendu**. `GameState` est une donnee pure et
serialisable. La simulation tourne a pas fixe ; le rendu observe l'etat a 60 FPS
sans jamais le muter. Voir `.cursorrules` pour les conventions et `DEVBOOK.md`
pour le guide developpeur detaille.

```
src/
  config/      donnees data-driven (ages, ressources, batiments, technologies,
               civilisations, terrain, peche, exploration, synergies, PNJ...)
  core/        moteur (EventBus, GameLoop, TimeManager, SaveSystem)
  world/       geometrie (anneaux, secteurs, carte, mer, iles PNJ, bateaux)
  economy/     ressources, production, synergies, flux, peche
  population/  habitants, emplois, allocation des travailleurs
  research/    ages, arbre de technologies
  buildings/   definitions, instances, construction, ameliorations
  rendering/   camera, sprites proceduraux, mer, bateaux, renderer monde (PixiJS)
  audio/       SoundSystem (SFX synthetises)
  game/        GameState + orchestrateur Game + evenements
  ui/          HUD, panneaux (tech, travailleurs), journal, styles
  api/         client HTTP (auth, personnage)
  web/         site (landing, auth, personnage, routeur)
  main.ts      point d'entree

server/
  src/         API Express (auth JWT, personnages, sauvegardes, mondes, WebSocket)
```

## Extensibilite (data-driven)

Ajouter du contenu = editer la **config** uniquement, sans toucher au moteur :

- nouvelle ressource -> `src/config/resources.ts`
- nouveau batiment -> `src/config/buildings.ts`
- nouvel age -> `src/config/ages.ts`
- nouvelle technologie -> `src/config/technologies.ts`
- nouvelle civilisation -> `src/config/civilizations.ts`

Le moteur itere sur ces donnees ; rien n'est code en dur.

## Sauvegarde et persistance

- **Compte joueur** : e-mail + mot de passe, token JWT en `localStorage`.
- **Personnage** : chef, village et civilisation stockes en base SQLite.
- **Partie en cours** : sauvegarde cloud (`PUT /api/saves/me`) + fallback `localStorage` ;
  auto-save toutes les 45 s et a la fermeture d onglet.
- **Multijoueur** : mondes partages via `/lobby`, sync WebSocket (`/ws`) avec snapshots
  et commandes autoritaires serveur.

## Controles en jeu

| Action | Touche / Souris |
|---|---|
| Pause | `Espace` |
| Vitesse 1x / 2x / 3x | Panneau Reglages |
| File de construction | `Shift` + clic sur une carte de batiment |
| Tutoriel | Overlay automatique en debut de partie |
| Multijoueur | Accueil → Multijoueur → Lobby |

## Documentation

- `.cursorrules` — stack, conventions, regles de modularite et de performance.
- `DEVBOOK.md` — guide developpeur : architecture detaillee, flux de donnees,
  recettes d'extension, roadmap.
