/**
 * Dialogue de confirmation personnalise (remplace window.confirm).
 */

let overlay: HTMLElement | null = null;

export function showConfirm(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (overlay) overlay.remove();

    overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';

    const dialog = document.createElement('div');
    dialog.className = 'confirm-dialog';

    const msg = document.createElement('p');
    msg.className = 'confirm-message';
    msg.textContent = message;

    const actions = document.createElement('div');
    actions.className = 'confirm-actions';

    const okBtn = document.createElement('button');
    okBtn.className = 'hud-btn confirm-ok';
    okBtn.textContent = 'Confirmer';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'hud-btn confirm-cancel';
    cancelBtn.textContent = 'Annuler';

    const close = (result: boolean) => {
      overlay?.remove();
      overlay = null;
      resolve(result);
    };

    okBtn.onclick = () => close(true);
    cancelBtn.onclick = () => close(false);
    overlay.onclick = (e) => { if (e.target === overlay) close(false); };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') { document.removeEventListener('keydown', onKey); close(true); }
      if (e.key === 'Escape') { document.removeEventListener('keydown', onKey); close(false); }
    };
    document.addEventListener('keydown', onKey);

    actions.append(okBtn, cancelBtn);
    dialog.append(msg, actions);
    overlay.append(dialog);
    document.body.append(overlay);

    okBtn.focus();
  });
}

export function showError(message: string): void {
  const overlay = document.createElement('div');
  overlay.className = 'confirm-overlay';

  const dialog = document.createElement('div');
  dialog.className = 'confirm-dialog confirm-error';

  const msg = document.createElement('p');
  msg.className = 'confirm-message';
  msg.textContent = message;

  const okBtn = document.createElement('button');
  okBtn.className = 'hud-btn confirm-ok';
  okBtn.textContent = 'OK';
  okBtn.onclick = () => overlay.remove();

  dialog.append(msg, okBtn);
  overlay.append(dialog);
  document.body.append(overlay);
  okBtn.focus();
}
