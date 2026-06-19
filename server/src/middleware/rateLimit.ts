/**
 * Rate limiting simple pour les routes d auth (anti brute-force).
 */

import type { Request, Response, NextFunction } from 'express';

const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 20;

const buckets = new Map<string, { count: number; resetAt: number }>();

export function authRateLimit(req: Request, res: Response, next: NextFunction): void {
  const key = `${req.ip ?? 'unknown'}:${req.path}`;
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + WINDOW_MS };
    buckets.set(key, bucket);
  }
  bucket.count++;
  if (bucket.count > MAX_ATTEMPTS) {
    res.status(429).json({ error: 'Trop de tentatives. Reessayez dans une minute.' });
    return;
  }
  next();
}
