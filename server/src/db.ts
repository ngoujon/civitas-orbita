/**
 * Persistance SQLite : comptes joueurs et personnages (chef de village).
 */

import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { seedDemoAccounts } from './seed.js';

export interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  created_at: string;
}

export interface CharacterRow {
  id: number;
  user_id: number;
  chief_name: string;
  village_name: string;
  civ_id: string;
  created_at: string;
}

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  const path = process.env.DATABASE_PATH ?? './data/civitas.db';
  mkdirSync(dirname(path), { recursive: true });

  db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS characters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      chief_name TEXT NOT NULL,
      village_name TEXT NOT NULL,
      civ_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS game_saves (
      character_id INTEGER PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE,
      state_json TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS worlds (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      host_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      state_json TEXT NOT NULL,
      player_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  seedDemoAccounts(db);

  return db;
}

export function closeDb(): void {
  db?.close();
  db = null;
}
