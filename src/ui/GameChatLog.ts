/**
 * Journal de bord : toutes les notifications du jeu.
 * Redimensionnable + déplaçable par le joueur (persistance localStorage).
 */

const STORAGE_KEY = 'civitas-orbita.chatlog-pos';
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
    title.textContent = '📋 Journal';

    const hint = document.createElement('span');
    hint.className = 'hud-chat-drag-hint';
    hint.title = 'Déplacer le journal';
    hint.textContent = '⠿';

    header.append(hint, title);

    this.messages = document.createElement('div');
    this.messages.className = 'hud-chat-messages';

    this.root.append(header, this.messages);
    mount.append(this.root);

    this.applyStoredPosition();
    this.bindResizePersistence();
    this.bindDrag(header);

    this.add("Bienvenue — les événements du village s'affichent ici.", 'info');
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

    while (this.messages.childElementCount > 100) {
      this.messages.firstElementChild?.remove();
    }

    this.messages.scrollTop = this.messages.scrollHeight;
  }

  private applyStoredPosition(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { left?: number; bottom?: number; width?: number; height?: number };
      if (typeof parsed.left === 'number') this.root.style.left = `${parsed.left}px`;
      if (typeof parsed.bottom === 'number') this.root.style.bottom = `${parsed.bottom}px`;
      if (typeof parsed.width === 'number' && parsed.width >= MIN_WIDTH) {
        this.root.style.width = `${parsed.width}px`;
      }
      if (typeof parsed.height === 'number' && parsed.height >= MIN_HEIGHT) {
        this.root.style.height = `${parsed.height}px`;
      }
    } catch { /* ignore */ }
  }

  private bindResizePersistence(): void {
    new ResizeObserver(() => this.scheduleSave()).observe(this.root);
  }

  private bindDrag(handle: HTMLElement): void {
    let startX = 0, startY = 0, startLeft = 0, startBottom = 0;

    const onMove = (e: MouseEvent) => {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const newLeft = Math.max(0, Math.min(window.innerWidth - this.root.offsetWidth, startLeft + dx));
      const newBottom = Math.max(0, Math.min(window.innerHeight - this.root.offsetHeight, startBottom - dy));
      this.root.style.left = `${newLeft}px`;
      this.root.style.bottom = `${newBottom}px`;
      this.root.style.right = 'auto';
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      this.scheduleSave();
    };

    handle.addEventListener('mousedown', (e) => {
      if ((e.target as HTMLElement).closest('button')) return;
      e.preventDefault();
      const rect = this.root.getBoundingClientRect();
      startX = e.clientX;
      startY = e.clientY;
      startLeft = rect.left;
      startBottom = window.innerHeight - rect.bottom;
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  }

  private scheduleSave(): void {
    if (this.saveTimer !== null) window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => {
      this.saveTimer = null;
      this.persistPosition();
    }, 120);
  }

  private persistPosition(): void {
    const rect = this.root.getBoundingClientRect();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        left: Math.round(rect.left),
        bottom: Math.round(window.innerHeight - rect.bottom),
        width: this.root.offsetWidth,
        height: this.root.offsetHeight,
      }));
    } catch { /* quota / private mode */ }
  }
}

function formatChatTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
