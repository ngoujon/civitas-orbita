/**
 * Serveur API Civitas Orbita — comptes joueurs et personnages.
 */

import http from 'node:http';
import express from 'express';
import cors from 'cors';
import { closeDb, getDb } from './db.js';
import authRoutes from './routes/auth.js';
import characterRoutes from './routes/characters.js';
import saveRoutes from './routes/saves.js';
import worldRoutes from './routes/worlds.js';
import { attachWebSocket } from './ws/gateway.js';

const PORT = Number(process.env.PORT ?? 3001);
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:5173';

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  console.error('JWT_SECRET obligatoire en production.');
  process.exit(1);
}

const app = express();

app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'civitas-orbita-api', ws: true });
});

app.use('/api/auth', authRoutes);
app.use('/api/characters', characterRoutes);
app.use('/api/saves', saveRoutes);
app.use('/api/worlds', worldRoutes);

app.use((_req, res) => {
  res.status(404).json({ error: 'Route introuvable.' });
});

getDb();

const server = http.createServer(app);
attachWebSocket(server);

server.listen(PORT, () => {
  console.log(`API Civitas Orbita ecoute sur http://localhost:${PORT} (HTTP + WS)`);
});

process.on('SIGTERM', () => {
  closeDb();
  server.close();
  process.exit(0);
});
