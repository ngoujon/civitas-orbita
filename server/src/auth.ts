/**
 * Helpers JWT pour l'authentification des joueurs.
 */

import jwt, { type SignOptions } from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-in-production';
const JWT_EXPIRES = (process.env.JWT_EXPIRES ?? '7d') as SignOptions['expiresIn'];

export interface JwtPayload {
  sub: number;
  email: string;
}

export function signToken(userId: number, email: string): string {
  return jwt.sign({ sub: userId, email }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (typeof payload !== 'object' || payload === null) return null;
    const p = payload as Record<string, unknown>;
    if (typeof p.sub !== 'number' || typeof p.email !== 'string') return null;
    return { sub: p.sub, email: p.email };
  } catch {
    return null;
  }
}
