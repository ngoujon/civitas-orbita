/**
 * Lobby multijoueur : lister, creer et rejoindre des mondes partages.
 */

import { api } from '@/api';
import { createNewGame } from '@/game/GameState';
import { serialize } from '@/core/SaveSystem';
import type { CivId } from '@/config/civilizations';
import { navigate } from './router';
import { el } from './helpers';
import { showError } from '@/ui/ConfirmDialog';

const ACTIVE_WORLD_KEY = 'civitas-orbita:activeWorld';

export function getActiveWorldId(): string | null {
  return sessionStorage.getItem(ACTIVE_WORLD_KEY);
}

export function setActiveWorldId(id: string | null): void {
  if (id) sessionStorage.setItem(ACTIVE_WORLD_KEY, id);
  else sessionStorage.removeItem(ACTIVE_WORLD_KEY);
}

export class LobbyPage {
  private root: HTMLElement;

  constructor(mount: HTMLElement) {
    this.root = el('div', 'lobby-page hidden');
    mount.append(this.root);
  }

  show(): void {
    this.root.classList.remove('hidden');
    void this.render();
  }

  hide(): void {
    this.root.classList.add('hidden');
  }

  private async render(): Promise<void> {
    this.root.innerHTML = '';
    const panel = el('div', 'lobby-panel');

    const title = el('h1', 'lobby-title', 'Mondes partages');
    const desc = el('p', 'lobby-desc');
    desc.textContent =
      'Rejoignez un monde avec d autres joueurs ou creez le votre. La simulation est synchronisee en temps reel.';

    const list = el('div', 'lobby-list');

    try {
      const { worlds } = await api.listWorlds();
      if (worlds.length === 0) {
        list.textContent = 'Aucun monde actif — creez le premier !';
      } else {
        for (const w of worlds) {
          const row = el('div', 'lobby-row');
          const info = el('span', 'lobby-row-info');
          info.textContent = `${w.name} (${w.playerCount} joueur(s))`;
          const joinBtn = document.createElement('button');
          joinBtn.className = 'lobby-btn';
          joinBtn.textContent = 'Rejoindre';
          joinBtn.onclick = () => void this.joinWorld(w.id);
          row.append(info, joinBtn);
          list.append(row);
        }
      }
    } catch {
      list.textContent = 'Impossible de charger les mondes (API indisponible).';
    }

    const actions = el('div', 'lobby-actions');
    const createBtn = document.createElement('button');
    createBtn.className = 'lobby-btn primary';
    createBtn.textContent = 'Créer un monde multijoueur';
    createBtn.onclick = () => void this.createWorld();

    const soloBtn = document.createElement('button');
    soloBtn.className = 'lobby-btn secondary';
    soloBtn.textContent = 'Jouer en solo';
    soloBtn.onclick = () => {
      setActiveWorldId(null);
      navigate('play');
    };

    const backBtn = document.createElement('button');
    backBtn.className = 'lobby-btn secondary';
    backBtn.textContent = 'Accueil';
    backBtn.onclick = () => navigate('landing');

    actions.append(createBtn, soloBtn, backBtn);
    panel.append(title, desc, list, actions);
    this.root.append(panel);
  }

  private async createWorld(): Promise<void> {
    const name = window.prompt('Nom du monde :', 'Monde concentrique') ?? 'Monde';
    try {
      const me = await api.me();
      if (!me.character) {
        navigate('character');
        return;
      }
      let stateJson: string;
      try {
        const { save } = await api.loadSave();
        stateJson = save.stateJson;
      } catch {
        stateJson = serialize(
          createNewGame(me.character.civId as CivId, {
            chiefName: me.character.chiefName,
            villageName: me.character.villageName,
          }),
        );
      }
      const { world } = await api.createWorld(name, stateJson);
      setActiveWorldId(world.id);
      navigate('play');
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Echec creation monde.');
    }
  }

  private async joinWorld(id: string): Promise<void> {
    try {
      await api.joinWorld(id);
      setActiveWorldId(id);
      navigate('play');
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Echec connexion au monde.');
    }
  }
}
