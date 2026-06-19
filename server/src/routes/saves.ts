/**
 * Persistance de la partie en cours (GameState JSON).
 */

import { Router } from 'express';
import { getDb } from '../db.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';

const router = Router();

const MAX_SAVE_BYTES = 2 * 1024 * 1024;

router.get('/me', requireAuth, (req: AuthRequest, res) => {
  const db = getDb();
  const char = db
    .prepare('SELECT id FROM characters WHERE user_id = ?')
    .get(req.userId!) as { id: number } | undefined;

  if (!char) {
    res.status(404).json({ error: 'Aucun personnage cree.' });
    return;
  }

  const row = db
    .prepare(
      'SELECT state_json, version, updated_at FROM game_saves WHERE character_id = ?',
    )
    .get(char.id) as
    | { state_json: string; version: number; updated_at: string }
    | undefined;

  if (!row) {
    res.status(404).json({ error: 'Aucune sauvegarde.' });
    return;
  }

  res.json({
    save: {
      stateJson: row.state_json,
      version: row.version,
      updatedAt: row.updated_at,
    },
  });
});

router.put('/me', requireAuth, (req: AuthRequest, res) => {
  const stateJson = req.body?.stateJson;
  const version = Number(req.body?.version ?? 1);

  if (typeof stateJson !== 'string' || stateJson.length === 0) {
    res.status(400).json({ error: 'stateJson requis.' });
    return;
  }
  if (stateJson.length > MAX_SAVE_BYTES) {
    res.status(413).json({ error: 'Sauvegarde trop volumineuse.' });
    return;
  }
  if (!Number.isFinite(version) || version < 1) {
    res.status(400).json({ error: 'Version invalide.' });
    return;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stateJson);
  } catch {
    res.status(400).json({ error: 'JSON invalide.' });
    return;
  }
  if (!parsed || typeof parsed !== 'object') {
    res.status(400).json({ error: 'Etat de jeu invalide.' });
    return;
  }

  const db = getDb();
  const char = db
    .prepare('SELECT id FROM characters WHERE user_id = ?')
    .get(req.userId!) as { id: number } | undefined;

  if (!char) {
    res.status(404).json({ error: 'Aucun personnage cree.' });
    return;
  }

  db.prepare(
    `INSERT INTO game_saves (character_id, state_json, version, updated_at)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(character_id) DO UPDATE SET
       state_json = excluded.state_json,
       version = excluded.version,
       updated_at = datetime('now')`,
  ).run(char.id, stateJson, version);

  res.json({ ok: true });
});

router.delete('/me', requireAuth, (req: AuthRequest, res) => {
  const db = getDb();
  const char = db
    .prepare('SELECT id FROM characters WHERE user_id = ?')
    .get(req.userId!) as { id: number } | undefined;

  if (!char) {
    res.status(404).json({ error: 'Aucun personnage cree.' });
    return;
  }

  db.prepare('DELETE FROM game_saves WHERE character_id = ?').run(char.id);
  res.json({ ok: true });
});

export default router;
