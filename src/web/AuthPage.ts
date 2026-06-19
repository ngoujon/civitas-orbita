/**
 * Pages d'inscription et de connexion.
 */

import { api } from '@/api';
import { navigate } from './router';
import { el } from './helpers';

type AuthMode = 'register' | 'login';

export class AuthPage {
  private root: HTMLElement;
  private mode: AuthMode;
  private errorEl!: HTMLElement;
  private form!: HTMLFormElement;

  constructor(mount: HTMLElement, mode: AuthMode) {
    this.mode = mode;
    this.root = el('div', 'site-page auth-page');
    mount.append(this.root);
    this.build();
  }

  private build(): void {
    const panel = el('div', 'site-panel auth-panel');

    const back = el('button', 'site-link back-link', '← Retour');
    back.type = 'button';
    back.onclick = () => navigate('landing');

    const title = el(
      'h1',
      'site-panel-title',
      this.mode === 'register' ? 'Creer un compte' : 'Connexion',
    );
    const subtitle = el(
      'p',
      'site-panel-subtitle',
      this.mode === 'register'
        ? 'Rejoignez Civitas Orbita et preparez-vous a fonder votre village.'
        : 'Connectez-vous pour reprendre votre partie.',
    );

    this.errorEl = el('div', 'site-error hidden');

    this.form = document.createElement('form');
    this.form.className = 'auth-form';
    this.form.noValidate = true;

    const emailGroup = this.fieldGroup('E-mail', 'email', 'email', 'votre@email.com');
    const passGroup = this.fieldGroup(
      'Mot de passe',
      'password',
      'password',
      this.mode === 'register' ? '8 caracteres minimum' : '••••••••',
    );

    const submit = el(
      'button',
      'site-btn primary full',
      this.mode === 'register' ? 'S\'inscrire' : 'Se connecter',
    );
    submit.type = 'submit';

    const switchText = el('p', 'auth-switch');
    if (this.mode === 'register') {
      switchText.innerHTML =
        'Deja un compte ? <button type="button" class="site-link inline">Se connecter</button>';
      switchText.querySelector('button')!.onclick = () => navigate('login');
    } else {
      switchText.innerHTML =
        'Pas encore de compte ? <button type="button" class="site-link inline">S\'inscrire</button>';
      switchText.querySelector('button')!.onclick = () => navigate('register');
    }

    this.form.append(emailGroup, passGroup, submit);
    this.form.onsubmit = (e) => {
      e.preventDefault();
      void this.submit();
    };

    panel.append(back, title, subtitle, this.errorEl, this.form, switchText);
    this.root.append(panel);
  }

  private fieldGroup(
    label: string,
    id: string,
    type: string,
    placeholder: string,
  ): HTMLElement {
    const group = el('div', 'form-group');
    const lbl = el('label', '', label);
    lbl.htmlFor = id;
    const input = document.createElement('input');
    input.id = id;
    input.name = id;
    input.type = type;
    input.placeholder = placeholder;
    input.required = true;
    input.autocomplete = type === 'password' ? 'current-password' : 'email';
    group.append(lbl, input);
    return group;
  }

  private async submit(): Promise<void> {
    this.hideError();
    const fd = new FormData(this.form);
    const email = String(fd.get('email') ?? '');
    const password = String(fd.get('password') ?? '');

    try {
      const result =
        this.mode === 'register'
          ? await api.register(email, password)
          : await api.login(email, password);
      navigate(result.hasCharacter ? 'play' : 'character', true);
    } catch (err) {
      this.showError(err instanceof Error ? err.message : 'Erreur inattendue.');
    }
  }

  private showError(msg: string): void {
    this.errorEl.textContent = msg;
    this.errorEl.classList.remove('hidden');
  }

  private hideError(): void {
    this.errorEl.classList.add('hidden');
  }

  setMode(mode: AuthMode): void {
    this.mode = mode;
    this.root.replaceChildren();
    this.build();
  }

  show(): void {
    this.root.classList.remove('hidden');
  }

  hide(): void {
    this.root.classList.add('hidden');
  }
}
