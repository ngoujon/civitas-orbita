/**
 * Orchestrateur du site web et du jeu selon la route courante.
 */

import './site.css';
import { api } from '@/api';
import type { CharacterProfile } from '@/api';
import { getRoute, navigate, onRouteChange, type RouteId } from './router';
import { LandingPage } from './LandingPage';
import { AuthPage } from './AuthPage';
import { CharacterPage } from './CharacterPage';
import { LobbyPage } from './LobbyPage';
import { bootstrapGame } from '@/gameBootstrap';

export async function initApp(): Promise<void> {
  const mount = document.getElementById('app');
  if (!mount) throw new Error('#app introuvable.');

  const landing = new LandingPage(mount);
  const authRegister = new AuthPage(mount, 'register');
  const authLogin = new AuthPage(mount, 'login');
  const character = new CharacterPage(mount);
  const lobby = new LobbyPage(mount);

  let gameStarted = false;
  let characterProfile: CharacterProfile | null = null;

  const pages: Record<RouteId, { show: () => void; hide: () => void } | null> = {
    landing,
    register: authRegister,
    login: authLogin,
    character,
    lobby,
    play: null,
  };

  async function handleRoute(): Promise<void> {
    const route = getRoute();

    // Masquer toutes les pages web.
    for (const page of Object.values(pages)) page?.hide();

    const canvas = document.getElementById('game-canvas');
    const hud = document.getElementById('hud');
    if (canvas) canvas.style.display = 'none';
    if (hud) hud.style.display = 'none';

    if (route === 'lobby') {
      if (!api.isLoggedIn()) {
        navigate('login', true);
        return;
      }
      lobby.show();
      return;
    }

    if (route === 'play') {
      if (!api.isLoggedIn()) {
        navigate('login', true);
        return;
      }
      try {
        const me = await api.me();
        if (!me.character) {
          navigate('character', true);
          return;
        }
        characterProfile = me.character;
      } catch {
        api.logout();
        navigate('login', true);
        return;
      }

      if (canvas) canvas.style.display = '';
      if (hud) hud.style.display = '';

      if (!gameStarted) {
        gameStarted = true;
        await bootstrapGame(characterProfile);
      }
      return;
    }

    if (route === 'character' && !api.isLoggedIn()) {
      navigate('login', true);
      return;
    }

    if ((route === 'register' || route === 'login') && api.isLoggedIn()) {
      try {
        const me = await api.me();
        navigate(me.character ? 'play' : 'character', true);
        return;
      } catch {
        api.logout();
      }
    }

    if (route === 'register') {
      authRegister.setMode('register');
      authRegister.show();
    } else if (route === 'login') {
      authLogin.setMode('login');
      authLogin.show();
    } else {
      pages[route]?.show();
    }
  }

  onRouteChange(() => void handleRoute());
  await handleRoute();
}
