import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { initDatabase, getDbEngine } from './database/db.js';
import { seedDatabase } from './database/seed.js';
import authRoutes from './routes/authRoutes.js';
import languageRoutes from './routes/languageRoutes.js';
import gameRoutes from './routes/gameRoutes.js';
import featureRoutes from './routes/featureRoutes.js';
import { getAiProviderStatus } from './services/aiService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const PORT = Number(process.env.PORT || 3001);
const APP_ORIGIN = process.env.APP_ORIGIN || 'http://localhost:5173';

const app = express();

app.use(
  cors({
    origin: [APP_ORIGIN, 'http://localhost:5173', 'http://127.0.0.1:5173', `http://localhost:${PORT}`],
    credentials: true,
  })
);
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    app: 'LOGATARA',
    databaseEngine: getDbEngine(),
    aiProvider: getAiProviderStatus(),
    timestamp: new Date().toISOString(),
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api', languageRoutes);
app.use('/api', gameRoutes);
app.use('/api', featureRoutes);

// Static files & production SPA fallback
const distDir = path.join(ROOT_DIR, 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

// 404 handler for API routes
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Endpoint API tidak ditemukan.' });
});

// Centralized error handler
app.use((err, _req, res, _next) => {
  console.error('[LOGATARA API Error]:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Terjadi gangguan pada server LOGATARA. Silakan coba lagi.',
  });
});

async function startServer() {
  const dbInfo = await initDatabase();
  await seedDatabase({ silent: false });
  app.listen(PORT, () => {
    console.log(`LOGATARA API running on http://localhost:${PORT} (DB: ${dbInfo.engine})`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start LOGATARA server:', err);
  process.exit(1);
});
