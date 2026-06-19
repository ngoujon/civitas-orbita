/**
 * Routes d'inscription et de connexion.
 */

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { getDb } from '../db.js';
import { signToken } from '../auth.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { authRateLimit } from '../middleware/rateLimit.js';

const router = Router();
router.use(authRateLimit);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

router.post('/register', (req, res) => {
  const email = normalizeEmail(String(req.body?.email ?? ''));
  const password = String(req.body?.password ?? '');

  if (!EMAIL_RE.test(email)) {
    res.status(400).json({ error: 'Adresse e-mail invalide.' });
    return;
  }
  if (password.length < MIN_PASSWORD) {
    res.status(400).json({ error: `Mot de passe : minimum ${MIN_PASSWORD} caracteres.` });
    return;
  }

  const db = getDb();
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    res.status(409).json({ error: 'Un compte existe deja avec cet e-mail.' });
    return;
  }

  const hash = bcrypt.hashSync(password, 12);
  const result = db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)').run(email, hash);
  const token = signToken(Number(result.lastInsertRowid), email);

  res.status(201).json({
    token,
    user: { id: result.lastInsertRowid, email },
    hasCharacter: false,
  });
});

router.post('/login', (req, res) => {
  const email = normalizeEmail(String(req.body?.email ?? ''));
  const password = String(req.body?.password ?? '');

  const db = getDb();
  const user = db.prepare('SELECT id, email, password_hash FROM users WHERE email = ?').get(email) as
    | { id: number; email: string; password_hash: string }
    | undefined;

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    res.status(401).json({ error: 'E-mail ou mot de passe incorrect.' });
    return;
  }

  const character = db
    .prepare('SELECT id FROM characters WHERE user_id = ?')
    .get(user.id) as { id: number } | undefined;

  const token = signToken(user.id, user.email);
  res.json({
    token,
    user: { id: user.id, email: user.email },
    hasCharacter: Boolean(character),
  });
});

router.get('/me', requireAuth, (req: AuthRequest, res) => {
  const db = getDb();
  const user = db.prepare('SELECT id, email, created_at FROM users WHERE id = ?').get(req.userId!) as
    | { id: number; email: string; created_at: string }
    | undefined;

  if (!user) {
    res.status(404).json({ error: 'Compte introuvable.' });
    return;
  }

  const character = db
    .prepare(
      'SELECT chief_name, village_name, civ_id, created_at FROM characters WHERE user_id = ?',
    )
    .get(user.id) as
    | { chief_name: string; village_name: string; civ_id: string; created_at: string }
    | undefined;

  res.json({
    user: { id: user.id, email: user.email, createdAt: user.created_at },
    character: character
      ? {
          chiefName: character.chief_name,
          villageName: character.village_name,
          civId: character.civ_id,
          createdAt: character.created_at,
        }
      : null,
  });
});

export default router;
