/**
 * Site de presentation — page d'accueil publique.
 */

import { api } from '@/api';
import { navigate } from './router';
import { el } from './helpers';

export class LandingPage {
  private root: HTMLElement;

  constructor(mount: HTMLElement) {
    this.root = el('div', 'site-page landing-page');
    mount.append(this.root);
    this.render();
  }

  private render(): void {
    this.root.replaceChildren();

    const hero = el('section', 'landing-hero');
    const badge = el('span', 'landing-badge', 'Jeu multijoueur — Alpha');
    const title = el('h1', 'landing-title', 'CIVITAS ORBITA');
    const tagline = el(
      'p',
      'landing-tagline',
      'Batissez votre civilisation en anneaux concentriques, du feu de camp primitif jusqu\'au futur. Devenez le chef de votre village et guidez votre peuple a travers les ages.',
    );

    const actions = el('div', 'landing-actions');
    const playBtn = el('button', 'site-btn primary', 'Jouer');
    playBtn.onclick = () => void this.onPlay();

    const multiBtn = el('button', 'site-btn secondary', 'Multijoueur');
    multiBtn.onclick = () => void this.onMultiplayer();

    const registerBtn = el('button', 'site-btn secondary', 'Creer un compte');
    registerBtn.onclick = () => navigate('register');

    const loginBtn = el('button', 'site-btn ghost', 'Se connecter');
    loginBtn.onclick = () => navigate('login');

    actions.append(playBtn, multiBtn, registerBtn, loginBtn);
    hero.append(badge, title, tagline, actions);

    const features = el('section', 'landing-features');
    features.append(
      this.featureCard(
        'Anneaux concentriques',
        'Votre ville s\'etend en cercles autour du feu de camp central. Chaque anneau debloque de nouvelles possibilites.',
      ),
      this.featureCard(
        'Six civilisations',
        'Choisissez votre peuple : Fondateurs, Sylvains, Batisseurs, Savants, Agrariens ou Marchands — chacun avec ses bonus uniques.',
      ),
      this.featureCard(
        'Neuf ages',
        'De l\'Age de pierre a l\'ere spatiale. Recherchez, construisez et evoluez pour debloquer de nouvelles technologies.',
      ),
      this.featureCard(
        'Multijoueur a venir',
        'Creez votre compte, incarnez le chef de village et preparez-vous a cooperer ou rivaliser avec d\'autres joueurs.',
      ),
    );

    const footer = el('footer', 'site-footer');
    footer.textContent = 'Civitas Orbita — Rendu 100 % procedural, zero asset externe.';

    this.root.append(hero, features, footer);
  }

  private featureCard(title: string, text: string): HTMLElement {
    const card = el('article', 'feature-card');
    card.append(el('h3', 'feature-title', title), el('p', 'feature-text', text));
    return card;
  }

  private async onPlay(): Promise<void> {
    if (!api.isLoggedIn()) {
      navigate('login');
      return;
    }
    try {
      const { character } = await api.me();
      navigate(character ? 'play' : 'character');
    } catch {
      api.logout();
      navigate('login');
    }
  }

  private async onMultiplayer(): Promise<void> {
    if (!api.isLoggedIn()) {
      navigate('login');
      return;
    }
    try {
      const { character } = await api.me();
      navigate(character ? 'lobby' : 'character');
    } catch {
      api.logout();
      navigate('login');
    }
  }

  show(): void {
    this.root.classList.remove('hidden');
  }

  hide(): void {
    this.root.classList.add('hidden');
  }
}
