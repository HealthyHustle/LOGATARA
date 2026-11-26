import { Router } from 'express';
import { queryAll, queryOne, execute } from '../database/db.js';
import { requireAuth } from '../middleware/auth.js';
import { ensureLanguageProgress } from '../services/rewardsService.js';
import { logUserEventLive } from '../services/userEventLogger.js';

const router = Router();

// Public catalog of all 38 provinces with their associated regional languages (many-to-one)
router.get('/provinces', async (req, res, next) => {
  try {
    const search = String(req.query.q || '').trim().toLowerCase();
    const island = String(req.query.island || '').trim();

    const provinces = await queryAll('SELECT * FROM provinces ORDER BY id ASC');
    const languages = await queryAll(
      `SELECT rl.*, p.province_name, p.province_code, p.island_group,
              (SELECT COUNT(*) FROM vocabulary v WHERE v.language_id = rl.id) AS vocab_count
       FROM regional_languages rl
       JOIN provinces p ON p.id = rl.province_id
       ORDER BY rl.has_full_curriculum DESC, rl.language_name ASC`
    );

    const langsByProvince = new Map();
    for (const l of languages) {
      const list = langsByProvince.get(l.province_id) || [];
      list.push({ ...l, has_full_curriculum: Boolean(l.has_full_curriculum) });
      langsByProvince.set(l.province_id, list);
    }

    let result = provinces.map((p) => ({
      ...p,
      languages: langsByProvince.get(p.id) || [],
    }));

    if (island && island !== 'Semua') {
      result = result.filter((p) => p.island_group === island);
    }
    if (search) {
      result = result.filter(
        (p) =>
          p.province_name.toLowerCase().includes(search) ||
          p.cultural_information.toLowerCase().includes(search) ||
          p.languages.some(
            (l) =>
              l.language_name.toLowerCase().includes(search) ||
              (l.alternative_names || '').toLowerCase().includes(search)
          )
      );
    }

    res.json({
      totalProvinces: provinces.length,
      totalLanguages: languages.length,
      provinces: result,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/languages', async (req, res, next) => {
  try {
    const search = String(req.query.q || '').trim().toLowerCase();
    const verifiedOnly = req.query.verified === 'true';

    const languages = await queryAll(
      `SELECT rl.*, p.province_name, p.province_code, p.island_group,
              (SELECT COUNT(*) FROM vocabulary v WHERE v.language_id = rl.id) AS vocab_count
       FROM regional_languages rl
       JOIN provinces p ON p.id = rl.province_id
       ORDER BY rl.has_full_curriculum DESC, p.province_name ASC, rl.language_name ASC`
    );

    let filtered = languages.map((l) => ({
      ...l,
      has_full_curriculum: Boolean(l.has_full_curriculum),
    }));

    if (verifiedOnly) {
      filtered = filtered.filter((l) => l.verification_status === 'verified');
    }
    if (search) {
      filtered = filtered.filter(
        (l) =>
          l.language_name.toLowerCase().includes(search) ||
          l.province_name.toLowerCase().includes(search) ||
          (l.alternative_names || '').toLowerCase().includes(search)
      );
    }

    res.json({ languages: filtered });
  } catch (err) {
    next(err);
  }
});

// Save language onboarding selections (Known languages + Target learning language)
router.post('/onboarding', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const knownLanguageIds = Array.isArray(req.body?.knownLanguageIds)
      ? req.body.knownLanguageIds.map(Number).filter(Boolean)
      : [];
    const targetLanguageId = Number(req.body?.targetLanguageId);

    if (!targetLanguageId) {
      return res.status(400).json({ error: 'Pilih minimal satu bahasa daerah yang ingin kamu pelajari.' });
    }

    const targetLang = await queryOne('SELECT * FROM regional_languages WHERE id = ?', [targetLanguageId]);
    if (!targetLang) {
      return res.status(404).json({ error: 'Bahasa tujuan tidak ditemukan.' });
    }

    // Update known languages
    await execute('DELETE FROM user_known_languages WHERE user_id = ?', [userId]);
    for (const lid of new Set(knownLanguageIds)) {
      const exists = await queryOne('SELECT id FROM regional_languages WHERE id = ?', [lid]);
      if (exists) {
        await execute(
          'INSERT INTO user_known_languages (user_id, language_id) VALUES (?, ?) ON CONFLICT(user_id, language_id) DO NOTHING',
          [userId, lid]
        );
      }
    }

    // Update target learning language
    await execute('UPDATE user_learning_languages SET is_primary = 0 WHERE user_id = ?', [userId]);
    await execute(
      `INSERT INTO user_learning_languages (user_id, language_id, is_primary)
       VALUES (?, ?, 1)
       ON CONFLICT(user_id, language_id) DO UPDATE SET is_primary = 1`,
      [userId, targetLanguageId]
    );

    // Initialize level progress for the target language if it has curriculum levels
    await ensureLanguageProgress(userId, targetLanguageId);

    // Calculate highest available/completed level for this language
    const highestOpen = await queryOne(
      `SELECT MAX(ll.level_number) AS max_lv
       FROM user_progress up
       JOIN learning_levels ll ON ll.id = up.level_id
       WHERE up.user_id = ? AND up.language_id = ? AND up.status IN ('available', 'in_progress', 'completed')`,
      [userId, targetLanguageId]
    );

    await execute(
      `UPDATE user_profiles
       SET current_language_id = ?,
           current_level_number = ?,
           onboarding_completed = 1,
           pending_walk_from = NULL,
           pending_walk_to = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = ?`,
      [targetLanguageId, Number(highestOpen?.max_lv || 1), userId]
    );

    const knownLangRows = await queryAll(
      `SELECT rl.language_name FROM user_known_languages ukl
       JOIN regional_languages rl ON rl.id = ukl.language_id
       WHERE ukl.user_id = ?`,
      [userId]
    );
    logUserEventLive({
      event: 'ONBOARDING',
      userId,
      fullName: req.user.full_name,
      email: req.user.email,
      status: 'BERHASIL',
      knownLanguages: knownLangRows.map((k) => k.language_name).join(', ') || '-',
      targetLanguage: targetLang.language_name,
      currentLevel: Number(highestOpen?.max_lv || 1),
      totalXp: Number(req.user.total_xp || 0),
      source: req.get('origin') || 'Localhost',
      userAgent: req.get('user-agent') || '',
    });

    res.json({
      message: 'Preferensi bahasa berhasil disimpan! Petualangan Kampung Nusantara siap dimulai.',
      currentLanguageId: targetLanguageId,
    });
  } catch (err) {
    next(err);
  }
});

// Switch active learning language quickly (from map/dashboard/profile)
router.put('/profile/active-language', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const languageId = Number(req.body?.languageId);
    if (!languageId) {
      return res.status(400).json({ error: 'ID bahasa wajib disertakan.' });
    }
    const lang = await queryOne('SELECT * FROM regional_languages WHERE id = ?', [languageId]);
    if (!lang) {
      return res.status(404).json({ error: 'Bahasa daerah tidak ditemukan.' });
    }

    await execute('UPDATE user_learning_languages SET is_primary = 0 WHERE user_id = ?', [userId]);
    await execute(
      `INSERT INTO user_learning_languages (user_id, language_id, is_primary)
       VALUES (?, ?, 1)
       ON CONFLICT(user_id, language_id) DO UPDATE SET is_primary = 1`,
      [userId, languageId]
    );
    await ensureLanguageProgress(userId, languageId);

    const highestOpen = await queryOne(
      `SELECT MAX(ll.level_number) AS max_lv
       FROM user_progress up
       JOIN learning_levels ll ON ll.id = up.level_id
       WHERE up.user_id = ? AND up.language_id = ? AND up.status IN ('available', 'in_progress', 'completed')`,
      [userId, languageId]
    );

    await execute(
      `UPDATE user_profiles
       SET current_language_id = ?,
           current_level_number = ?,
           pending_walk_from = NULL,
           pending_walk_to = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = ?`,
      [languageId, Number(highestOpen?.max_lv || 1), userId]
    );

    res.json({ message: `Bahasa belajar aktif diubah ke ${lang.language_name}.`, language: lang });
  } catch (err) {
    next(err);
  }
});

// Update user profile, avatar (3D character or uploaded photo), & language preferences
router.put('/profile', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const fullName = String(req.body?.fullName || '').trim();
    const bio = String(req.body?.bio || '').trim();
    const avatarUrlRaw = req.body?.avatarUrl !== undefined ? String(req.body.avatarUrl).trim() : null;
    const knownLanguageIds = Array.isArray(req.body?.knownLanguageIds)
      ? req.body.knownLanguageIds.map(Number).filter(Boolean)
      : null;
    const targetLanguageId = req.body?.targetLanguageId ? Number(req.body.targetLanguageId) : null;

    if (fullName && fullName.length < 2) {
      return res.status(400).json({ error: 'Nama lengkap minimal 2 karakter.' });
    }

    let safeAvatarUrl = null;
    if (avatarUrlRaw) {
      const allowedPreset = /^\/assets\/characters\/[a-z0-9\-_]+\.png$/i.test(avatarUrlRaw);
      const allowedDataUri = /^data:image\/(png|jpeg|jpg|webp);base64,[a-z0-9+/=]+$/i.test(avatarUrlRaw);
      if (!allowedPreset && !allowedDataUri) {
        return res.status(400).json({ error: 'Format foto profil tidak didukung. Gunakan PNG, JPG, atau WebP.' });
      }
      if (avatarUrlRaw.length > 450_000) {
        return res.status(400).json({ error: 'Ukuran foto terlalu besar. Pilih gambar yang lebih kecil.' });
      }
      safeAvatarUrl = avatarUrlRaw;
    }

    if (fullName || bio !== undefined || safeAvatarUrl) {
      await execute(
        `UPDATE user_profiles
         SET full_name = COALESCE(NULLIF(?, ''), full_name),
             bio = ?,
             avatar_url = COALESCE(?, avatar_url),
             updated_at = CURRENT_TIMESTAMP
         WHERE user_id = ?`,
        [fullName, bio || 'Penjelajah bahasa dan budaya Nusantara', safeAvatarUrl, userId]
      );
    }

    if (knownLanguageIds !== null) {
      await execute('DELETE FROM user_known_languages WHERE user_id = ?', [userId]);
      for (const lid of new Set(knownLanguageIds)) {
        await execute(
          'INSERT INTO user_known_languages (user_id, language_id) VALUES (?, ?) ON CONFLICT(user_id, language_id) DO NOTHING',
          [userId, lid]
        );
      }
    }

    if (targetLanguageId) {
      const lang = await queryOne('SELECT id FROM regional_languages WHERE id = ?', [targetLanguageId]);
      if (lang) {
        await execute('UPDATE user_learning_languages SET is_primary = 0 WHERE user_id = ?', [userId]);
        await execute(
          `INSERT INTO user_learning_languages (user_id, language_id, is_primary)
           VALUES (?, ?, 1)
           ON CONFLICT(user_id, language_id) DO UPDATE SET is_primary = 1`,
          [userId, targetLanguageId]
        );
        await ensureLanguageProgress(userId, targetLanguageId);
        const highestOpen = await queryOne(
          `SELECT MAX(ll.level_number) AS max_lv
           FROM user_progress up
           JOIN learning_levels ll ON ll.id = up.level_id
           WHERE up.user_id = ? AND up.language_id = ? AND up.status IN ('available', 'in_progress', 'completed')`,
          [userId, targetLanguageId]
        );
        await execute(
          `UPDATE user_profiles
           SET current_language_id = ?, current_level_number = ?, updated_at = CURRENT_TIMESTAMP
           WHERE user_id = ?`,
          [targetLanguageId, Number(highestOpen?.max_lv || 1), userId]
        );
      }
    }

    res.json({ message: 'Profil berhasil diperbarui.' });
  } catch (err) {
    next(err);
  }
});

export default router;
