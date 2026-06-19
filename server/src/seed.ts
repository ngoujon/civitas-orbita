/**
 * Comptes de demonstration (creees au premier demarrage si la base est vide).
 */

import bcrypt from 'bcryptjs';
import type Database from 'better-sqlite3';

export const DEMO_ACCOUNTS = [
  {
    email: 'demo@civitas.local',
    password: 'demo1234',
    chiefName: 'Haldor',
    villageName: 'Port-Lune',
    civId: 'founders',
  },
  {
    email: 'test@civitas.local',
    password: 'test1234',
    chiefName: 'Mei Lin',
    villageName: 'Brumeval',
    civId: 'sylvans',
  },
  {
    email: 'joueur@civitas.local',
    password: 'joueur1234',
    chiefName: 'Kael',
    villageName: 'Rochenoire',
    civId: 'builders',
  },
] as const;

/** Insere les comptes demo si la table users est vide. */
export function seedDemoAccounts(db: Database.Database): void {
  const count = db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number };
  if (count.n > 0) return;

  const insertUser = db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)');
  const insertChar = db.prepare(
    'INSERT INTO characters (user_id, chief_name, village_name, civ_id) VALUES (?, ?, ?, ?)',
  );

  const tx = db.transaction(() => {
    for (const acc of DEMO_ACCOUNTS) {
      const hash = bcrypt.hashSync(acc.password, 12);
      const result = insertUser.run(acc.email, hash);
      const userId = Number(result.lastInsertRowid);
      insertChar.run(userId, acc.chiefName, acc.villageName, acc.civId);
    }
  });

  tx();
  console.log('[seed] Comptes demo crees :', DEMO_ACCOUNTS.map((a) => a.email).join(', '));
}
