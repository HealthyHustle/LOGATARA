import { Router } from 'express';
import { queryAll, queryOne, execute } from '../database/db.js';
import {
  hashPassword,
  verifyPassword,
  signToken,
  setSessionCookie,
  clearSessionCookie,
  requireAuth,
} from '../middleware/auth.js';
import { getTodayIsoDate } from '../services/rewardsService.js';
import { logUserEventLive } from '../services/userEventLogger.js';

const router = Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/register', async (req, res, next) => {
  try {
    const fullName = String(req.body?.fullName || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (fullName.length < 2) {
      return res.status(400).json({ error: 'Nama lengkap minimal terdiri dari 2 karakter.' });
    }
    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ error: 'Masukkan alamat email yang valid (contoh: nama@email.com).' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Kata sandi minimal harus 8 karakter demi keamanan akunmu.' });
    }

    const existing = await queryOne('SELECT id FROM users WHERE LOWER(email) = ?', [email]);
    if (existing) {
      return res.status(409).json({ error: 'Email tersebut sudah terdaftar. Silakan masuk dengan akunmu.' });
    }

    const passwordHash = hashPassword(password);
    const inserted = await execute(
      'INSERT INTO users (email, password_hash) VALUES (?, ?)',
      [email, passwordHash]
    );
    const userId = inserted.lastInsertRowid;

    // Default initial language to first verified language (Basa Sunda) until onboarding updates it
    const defaultLang = await queryOne(
      "SELECT id, language_name FROM regional_languages WHERE has_full_curriculum = 1 ORDER BY id ASC LIMIT 1"
    );

    await execute(
      `INSERT INTO user_profiles
        (user_id, full_name, avatar_url, current_language_id, current_level_number, total_xp, total_stars, daily_streak, last_active_date, onboarding_completed)
       VALUES (?, ?, '/assets/characters/tara.png', ?, 1, 0, 0, 1, ?, 0)`,
      [userId, fullName, defaultLang?.id || null, getTodayIsoDate()]
    );

    const token = signToken({ userId, email });
    setSessionCookie(res, token);

    const profile = await queryOne(
      `SELECT u.id, u.email, p.full_name, p.avatar_url, p.current_language_id,
              p.current_level_number, p.total_xp, p.total_stars, p.daily_streak,
              p.onboarding_completed, p.pending_walk_from, p.pending_walk_to, p.bio
       FROM users u JOIN user_profiles p ON p.user_id = u.id WHERE u.id = ?`,
      [userId]
    );

    logUserEventLive({
      event: 'REGISTER',
      userId,
      fullName,
      email,
      status: 'BERHASIL',
      knownLanguages: '-',
      targetLanguage: defaultLang?.language_name || '-',
      currentLevel: 1,
      totalXp: 0,
      source: req.get('origin') || 'Localhost',
      userAgent: req.get('user-agent') || '',
    });

    res.status(201).json({
      message: 'Pendaftaran berhasil! Selamat datang di LOGATARA.',
      token,
      user: {
        ...profile,
        onboarding_completed: Boolean(profile.onboarding_completed),
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (!EMAIL_REGEX.test(email) || !password) {
      return res.status(400).json({ error: 'Email dan kata sandi wajib diisi dengan benar.' });
    }

    const userRow = await queryOne('SELECT id, email, password_hash FROM users WHERE LOWER(email) = ?', [email]);
    if (!userRow || !verifyPassword(password, userRow.password_hash)) {
      return res.status(401).json({ error: 'Email atau kata sandi salah. Periksa kembali dan coba lagi.' });
    }

    const token = signToken({ userId: userRow.id, email: userRow.email });
    setSessionCookie(res, token);

    const profile = await queryOne(
      `SELECT u.id, u.email, p.full_name, p.avatar_url, p.current_language_id,
              p.current_level_number, p.total_xp, p.total_stars, p.daily_streak,
              p.onboarding_completed, p.pending_walk_from, p.pending_walk_to, p.bio
       FROM users u JOIN user_profiles p ON p.user_id = u.id WHERE u.id = ?`,
      [userRow.id]
    );

    const knownLangs = await queryAll(
      `SELECT rl.language_name FROM user_known_languages ukl
       JOIN regional_languages rl ON rl.id = ukl.language_id
       WHERE ukl.user_id = ?`,
      [userRow.id]
    );
    const targetLang = profile.current_language_id
      ? await queryOne('SELECT language_name FROM regional_languages WHERE id = ?', [profile.current_language_id])
      : null;

    logUserEventLive({
      event: 'LOGIN',
      userId: userRow.id,
      fullName: profile.full_name,
      email: userRow.email,
      status: 'BERHASIL',
      knownLanguages: knownLangs.map((k) => k.language_name).join(', ') || '-',
      targetLanguage: targetLang?.language_name || '-',
      currentLevel: profile.current_level_number || 1,
      totalXp: profile.total_xp || 0,
      source: req.get('origin') || 'Localhost',
      userAgent: req.get('user-agent') || '',
    });

    res.json({
      message: 'Berhasil masuk ke LOGATARA!',
      token,
      user: {
        ...profile,
        onboarding_completed: Boolean(profile.onboarding_completed),
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', (_req, res) => {
  clearSessionCookie(res);
  res.json({ message: 'Berhasil keluar dari sesi LOGATARA.' });
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const currentLanguage = req.user.current_language_id
      ? await queryOne(
          `SELECT rl.*, p.province_name, p.province_code
           FROM regional_languages rl JOIN provinces p ON p.id = rl.province_id
           WHERE rl.id = ?`,
          [req.user.current_language_id]
        )
      : null;

    res.json({
      user: {
        ...req.user,
        onboarding_completed: Boolean(req.user.onboarding_completed),
        current_language: currentLanguage,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
