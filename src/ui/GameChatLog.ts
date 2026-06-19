/**
 * Journal de bord : toutes les notifications du jeu (remplace les toasts).
 * Dimensions redimensionnables par le joueur (persistees en localStorage).
 */

const STORAGE_KEY = 'civitas-orbita.chatlog-size';
const MIN_WIDTH = 200;
const MIN_HEIGHT = 100;

export class GameChatLog {
  private readonly root: HTMLElement;
  private readonly messages: HTMLElement;
  private saveTimer: number | null = null;

  constructor(mount: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'hud-panel hud-chat';

    const header = document.createElement('div');
    header.className = 'hud-chat-header';

    const title = document.createElement('div');
    title.className = 'hud-chat-title';
    title.textContent = 'Journal';

    const resizeHint = document.createElement('span');
    resizeHint.className = 'hud-chat-resize-hint';
    resizeHint.title = 'Redimensionner le journal';
    resizeHint.setAttribute('aria-hidden', 'true');
    resizeHint.textContent = '↘';

    header.append(title, resizeHint);

    this.messages = document.createElement('div');
    this.messages.className = 'hud-chat-messages';

    this.root.append(header, this.messages);
    mount.append(this.root);

    this.applyStoredSize();
    this.bindResizePersistence();

    this.add('Bienvenue — les evenements du village s affichent ici.', 'info');
  }

  add(message: string, kind: 'info' | 'warn'): void {
    const line = document.createElement('div');
    line.className = `hud-chat-line ${kind}`;

    const time = document.createElement('span');
    time.className = 'hud-chat-time';
    time.textContent = formatChatTime();

    const text = document.createElement('span');
    text.className = 'hud-chat-text';
    text.textContent = message;

    line.append(time, text);
    this.messages.append(line);

    const max = 100;
    while (this.messages.childElementCount > max) {
      this.messages.firstElementChild?.remove();
    }

    this.messages.scrollTop = this.messages.scrollHeight;
  }

  private applyStoredSize(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { width?: number; height?: number };
      if (typeof parsed.width === 'number' && parsed.width >= MIN_WIDTH) {
        this.root.style.width = `${Math.round(parsed.width)}px`;
      }
      if (typeof parsed.height === 'number' && parsed.height >= MIN_HEIGHT) {
        this.root.style.height = `${Math.round(parsed.height)}px`;
      }
    } catch {
      /* ignore invalid storage */
    }
  }

  private bindResizePersistence(): void {
    const observer = new ResizeObserver(() => this.scheduleSave());
    observer.observe(this.root);
  }

  private scheduleSave(): void {
    if (this.saveTimer !== null) window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => {
      this.saveTimer = null;
      this.persistSize();
    }, 120);
  }

  private persistSize(): void {
    const width = this.root.offsetWidth;
    const height = this.root.offsetHeight;
    if (width < MIN_WIDTH || height < MIN_HEIGHT) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ width, height }));
    } catch {
      /* quota / private mode */
    }
  }
}

function formatChatTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
