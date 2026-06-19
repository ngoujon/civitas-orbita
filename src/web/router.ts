/**
 * Routeur client minimal (History API).
 */

export type RouteId = 'landing' | 'register' | 'login' | 'character' | 'lobby' | 'play';

const ROUTES: Record<RouteId, string> = {
  landing: '/',
  register: '/register',
  login: '/login',
  character: '/character',
  lobby: '/lobby',
  play: '/play',
};

export function getRoute(): RouteId {
  const path = window.location.pathname;
  for (const [id, routePath] of Object.entries(ROUTES)) {
    if (routePath === path) return id as RouteId;
  }
  return 'landing';
}

export function navigate(route: RouteId, replace = false): void {
  const path = ROUTES[route];
  if (replace) {
    history.replaceState(null, '', path);
  } else {
    history.pushState(null, '', path);
  }
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function onRouteChange(handler: () => void): () => void {
  window.addEventListener('popstate', handler);
  return () => window.removeEventListener('popstate', handler);
}
