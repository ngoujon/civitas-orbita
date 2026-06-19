/**
 * Point d'entree de Civitas Orbita.
 *
 * Route vers le site web (landing, auth, personnage) ou le jeu (/play).
 */

import { initApp } from '@/web/App';

initApp().catch((err) => {
  console.error('Echec du demarrage :', err);
});
