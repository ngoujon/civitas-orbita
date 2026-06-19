/**
 * Mondes partages multijoueur (CRUD + join).
 */

import { Router } from 'express';
import { getDb } from '../db.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { getOrCreateRoom, setRoomState } from '../game/WorldRoom.js';

const router = Router();

router.get('/', requireAuth, (_req: AuthRequest, res) => {
  const db = getDb();
  const rows = db
    .prepare('SELECT id, name, player_count, created_at FROM worlds ORDER BY created_at DESC LIMIT 50')
    .all() as { id: string; name: string; player_count: number; created_at: string }[];
  res.json({
    worlds: rows.map((r) => ({
      id: r.id,
      name: r.name,
      playerCount: r.player_count,
      createdAt: r.created_at,
    })),
  });
});

router.post('/', requireAuth, (req: AuthRequest, res) => {
  const name = String(req.body?.name ?? 'Monde').trim().slice(0, 32);
  const stateJson = req.body?.stateJson;
  if (typeof stateJson !== 'string') {
    res.status(400).json({ error: 'stateJson requis pour initialiser le monde.' });
    return;
  }

  const worldId = `world-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const db = getDb();
  db.prepare(
    'INSERT INTO worlds (id, name, host_user_id, state_json, player_count) VALUES (?, ?, ?, ?, 0)',
  ).run(worldId, name, req.userId!, stateJson);

  getOrCreateRoom(worldId, stateJson);
  res.status(201).json({ world: { id: worldId, name } });
});

router.post('/:id/join', requireAuth, (req: AuthRequest, res) => {
  const worldId = String(req.params.id);
  const db = getDb();
  const row = db
    .prepare('SELECT id, name, state_json FROM worlds WHERE id = ?')
    .get(worldId) as { id: string; name: string; state_json: string } | undefined;

  if (!row) {
    res.status(404).json({ error: 'Monde introuvable.' });
    return;
  }

  getOrCreateRoom(worldId, row.state_json);
  db.prepare('UPDATE worlds SET player_count = player_count + 1 WHERE id = ?').run(worldId);
  res.json({ world: { id: row.id, name: row.name } });
});

router.put('/:id/state', requireAuth, (req: AuthRequest, res) => {
  const worldId = String(req.params.id);
  const stateJson = req.body?.stateJson;
  if (typeof stateJson !== 'string') {
    res.status(400).json({ error: 'stateJson requis.' });
    return;
  }
  const db = getDb();
  db.prepare('UPDATE worlds SET state_json = ?, updated_at = datetime(\'now\') WHERE id = ?').run(
    stateJson,
    worldId,
  );
  setRoomState(worldId, stateJson);
  res.json({ ok: true });
});

export default router;
