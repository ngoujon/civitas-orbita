/**
 * Middleware Express : extrait et valide le JWT Bearer.
 */

import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../auth.js';

export interface AuthRequest extends Request {
  userId?: number;
  userEmail?: string;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentification requise.' });
    return;
  }

  const payload = verifyToken(header.slice(7));
  if (!payload) {
    res.status(401).json({ error: 'Session invalide ou expiree.' });
    return;
  }

  req.userId = payload.sub;
  req.userEmail = payload.email;
  next();
}
