/**
 * Creation et lecture du personnage (chef de village).
 */

import { Router } from 'express';
import { getDb } from '../db.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';

const router = Router();

const VALID_CIVS = new Set([
  'founders',
  'sylvans',
  'builders',
  'scholars',
  'agrarians',
  'merchants',
]);

const CHIEF_MIN = 2;
const CHIEF_MAX = 24;
const VILLAGE_MIN = 2;
const VILLAGE_MAX = 32;
const NAME_RE = /^[\p{L}\p{N}\s'-]+$/u;

function validateName(value: string, min: number, max: number, label: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max) {
    return `${label} : entre ${min} et ${max} caracteres.`;
  }
  if (!NAME_RE.test(trimmed)) {
    return `${label} : caracteres invalides (lettres, chiffres, espaces, tirets).`;
  }
  return null;
}

router.post('/', requireAuth, (req: AuthRequest, res) => {
  const chiefName = String(req.body?.chiefName ?? '');
  const villageName = String(req.body?.villageName ?? '');
  const civId = String(req.body?.civId ?? '');

  const chiefErr = validateName(chiefName, CHIEF_MIN, CHIEF_MAX, 'Nom du chef');
  if (chiefErr) {
    res.status(400).json({ error: chiefErr });
    return;
  }
  const villageErr = validateName(villageName, VILLAGE_MIN, VILLAGE_MAX, 'Nom du village');
  if (villageErr) {
    res.status(400).json({ error: villageErr });
    return;
  }
  if (!VALID_CIVS.has(civId)) {
    res.status(400).json({ error: 'Civilisation invalide.' });
    return;
  }

  const db = getDb();
  const existing = db
    .prepare('SELECT id FROM characters WHERE user_id = ?')
    .get(req.userId!) as { id: number } | undefined;

  if (existing) {
    res.status(409).json({ error: 'Vous avez deja un personnage.' });
    return;
  }

  db.prepare(
    'INSERT INTO characters (user_id, chief_name, village_name, civ_id) VALUES (?, ?, ?, ?)',
  ).run(req.userId!, chiefName.trim(), villageName.trim(), civId);

  res.status(201).json({
    character: {
      chiefName: chiefName.trim(),
      villageName: villageName.trim(),
      civId,
    },
  });
});

router.get('/me', requireAuth, (req: AuthRequest, res) => {
  const db = getDb();
  const row = db
    .prepare('SELECT chief_name, village_name, civ_id, created_at FROM characters WHERE user_id = ?')
    .get(req.userId!) as
    | { chief_name: string; village_name: string; civ_id: string; created_at: string }
    | undefined;

  if (!row) {
    res.status(404).json({ error: 'Aucun personnage cree.' });
    return;
  }

  res.json({
    character: {
      chiefName: row.chief_name,
      villageName: row.village_name,
      civId: row.civ_id,
      createdAt: row.created_at,
    },
  });
});

export default router;
