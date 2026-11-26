import { Router } from 'express';
import { queryAll, queryOne, execute } from '../database/db.js';
import { requireAuth } from '../middleware/auth.js';
import {
  awardRewardOnce,
  ensureLanguageProgress,
  evaluateAchievements,
} from '../services/rewardsService.js';

const router = Router();

function normalizeAnswer(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[?!.,'’"“”\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + cost);
      prev = temp;
    }
  }
  return dp[n];
}

function isSpokenMatch(normalizedSubmitted, candidates) {
  if (!normalizedSubmitted) return false;
  const spokenNoSpace = normalizedSubmitted.replace(/\s+/g, '');
  const spokenWords = normalizedSubmitted.split(' ').filter(Boolean);
  for (const target of candidates) {
    if (!target) continue;
    if (normalizedSubmitted === target) return true;
    const targetNoSpace = target.replace(/\s+/g, '');
    if (spokenNoSpace === targetNoSpace) return true;
    const maxLen = Math.max(spokenNoSpace.length, targetNoSpace.length);
    const charSim = maxLen > 0 ? Math.max(0, 1 - levenshtein(spokenNoSpace, targetNoSpace) / maxLen) : 0;
    const targetWords = target.split(' ').filter(Boolean);
    const matched = targetWords.filter((tw) =>
      spokenWords.some((sw) => sw === tw || sw.includes(tw) || tw.includes(sw) || levenshtein(sw, tw) <= Math.max(1, Math.floor(tw.length * 0.28)))
    );
    const wordSim = targetWords.length > 0 ? matched.length / targetWords.length : 0;
    if (Math.max(charSim, wordSim * 0.85 + charSim * 0.15) >= 0.62) return true;
  }
  return false;
}

const VILLAGE_LOCATIONS = [
  {
    id: 'balai-desa',
    name: 'Balai Desa',
    levelNumber: 1,
    subtitle: 'Salam dan Sapaan',
    x: 20,
    y: 44,
    description: 'Tempat warga berkumpul dan menyambut tamu dengan salam penuh sopan santun.',
  },
  {
    id: 'rumah-batik',
    name: 'Rumah Batik',
    levelNumber: 2,
    subtitle: 'Kenalan dengan Warga',
    x: 28,
    y: 72,
    description: 'Jemuran batik Mega Mendung warna-warni tempat berkenalan dengan pengrajin kampung.',
  },
  {
    id: 'pasar-tradisional',
    name: 'Pasar Tradisional',
    levelNumber: 4,
    subtitle: 'Belanja & Tawar-menawar',
    x: 74,
    y: 71,
    description: 'Pasar ramah di tepi sungai tempat belajar menanyakan harga dan hasil bumi lokal.',
  },
  {
    id: 'sawah',
    name: 'Sawah',
    levelNumber: 5,
    subtitle: 'Cerita & Alam Lokal',
    x: 79,
    y: 33,
    description: 'Sawah terasering hijau bertingkat tempat belajar falsafah gotong royong dan cerita rakyat.',
  },
  {
    id: 'rumah-adat',
    name: 'Rumah Adat',
    levelNumber: 6,
    subtitle: 'Tradisi & Sejarah',
    x: 36,
    y: 32,
    description: 'Joglo dan Tongkonan megah yang menyimpan kisah sejarah leluhur Nusantara.',
  },
  {
    id: 'sanggar-budaya',
    name: 'Sanggar Budaya',
    levelNumber: 3,
    subtitle: 'Percakapan & Seni',
    x: 52,
    y: 50,
    description: 'Halaman beringin dan pendopo seni tempat warga berbincang santai dan berlatih musik.',
  },
  {
    id: 'perpustakaan-nusantara',
    name: 'Perpustakaan Nusantara',
    levelNumber: 7,
    subtitle: 'Master Bahasa Daerah',
    x: 55,
    y: 13,
    description: 'Puncak Kampung Nusantara tempat tersimpannya naskah, kamus, dan gelar Penjaga Bahasa.',
  },
];

// Main Game Dashboard Endpoint
router.get('/dashboard', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    let languageId = req.user.current_language_id;

    if (!languageId) {
      const fallbackLang = await queryOne(
        'SELECT id FROM regional_languages WHERE has_full_curriculum = 1 ORDER BY id ASC LIMIT 1'
      );
      languageId = fallbackLang?.id || null;
    }

    const activeLanguage = languageId
      ? await queryOne(
          `SELECT rl.*, p.province_name, p.province_code, p.island_group
           FROM regional_languages rl JOIN provinces p ON p.id = rl.province_id
           WHERE rl.id = ?`,
          [languageId]
        )
      : null;

    if (activeLanguage && activeLanguage.has_full_curriculum) {
      await ensureLanguageProgress(userId, activeLanguage.id);
    }

    const levels = activeLanguage
      ? await queryAll(
          `SELECT ll.*, COALESCE(up.status, CASE WHEN ll.level_number = 1 THEN 'available' ELSE 'locked' END) AS status,
                  COALESCE(up.module_completed, 0) AS module_completed,
                  COALESCE(up.speaking_completed, 0) AS speaking_completed,
                  COALESCE(up.listening_completed, 0) AS listening_completed,
                  COALESCE(up.reading_completed, 0) AS reading_completed,
                  COALESCE(up.writing_completed, 0) AS writing_completed,
                  COALESCE(up.stars_earned, 0) AS stars_earned,
                  COALESCE(up.xp_earned, 0) AS xp_earned
           FROM learning_levels ll
           LEFT JOIN user_progress up ON up.level_id = ll.id AND up.user_id = ?
           WHERE ll.language_id = ?
           ORDER BY ll.level_number ASC`,
          [userId, activeLanguage.id]
        )
      : [];

    const completedCount = levels.filter((l) => l.status === 'completed').length;
    const nextPlayable =
      levels.find((l) => l.status === 'in_progress') ||
      levels.find((l) => l.status === 'available') ||
      levels[levels.length - 1] ||
      null;

    // Daily phrase (prefer active language if available, else newest)
    let dailyPhrase = activeLanguage
      ? await queryOne(
          `SELECT dp.*, rl.language_name, p.province_name,
                  CASE WHEN sp.id IS NOT NULL THEN 1 ELSE 0 END AS is_saved
           FROM daily_phrases dp
           JOIN regional_languages rl ON rl.id = dp.language_id
           JOIN provinces p ON p.id = dp.province_id
           LEFT JOIN saved_phrases sp ON sp.daily_phrase_id = dp.id AND sp.user_id = ?
           WHERE dp.language_id = ?
           ORDER BY dp.phrase_date DESC LIMIT 1`,
          [userId, activeLanguage.id]
        )
      : null;

    if (!dailyPhrase) {
      dailyPhrase = await queryOne(
        `SELECT dp.*, rl.language_name, p.province_name,
                CASE WHEN sp.id IS NOT NULL THEN 1 ELSE 0 END AS is_saved
         FROM daily_phrases dp
         JOIN regional_languages rl ON rl.id = dp.language_id
         JOIN provinces p ON p.id = dp.province_id
         LEFT JOIN saved_phrases sp ON sp.daily_phrase_id = dp.id AND sp.user_id = ?
         ORDER BY dp.phrase_date DESC LIMIT 1`,
        [userId]
      );
    }

    // Recent achievements
    const recentAchievements = await queryAll(
      `SELECT a.*, ua.unlocked_at
       FROM user_achievements ua
       JOIN achievements a ON a.id = ua.achievement_id
       WHERE ua.user_id = ?
       ORDER BY ua.unlocked_at DESC
       LIMIT 4`,
      [userId]
    );

    const allAchievementsCount = await queryOne('SELECT COUNT(*) AS cnt FROM achievements');

    // Today's activity count for live Daily Mission
    const todayPrefix = new Date().toISOString().slice(0, 10);
    const todayTx = await queryOne(
      `SELECT COUNT(*) AS cnt, COALESCE(SUM(xp_amount), 0) AS xp_today
       FROM xp_transactions
       WHERE user_id = ? AND substr(created_at, 1, 10) = ?`,
      [userId, todayPrefix]
    );

    const totalXp = Number(req.user.total_xp || 0);
    const explorerRankLevel = Math.floor(totalXp / 150) + 1;
    const xpInCurrentTier = totalXp % 150;
    const xpForNextTier = 150;

    // Attach real level IDs & statuses to the 7 Kampung Nusantara locations
    const levelByNum = new Map(levels.map((l) => [l.level_number, l]));
    const locations = VILLAGE_LOCATIONS.map((loc) => {
      const lv = levelByNum.get(loc.levelNumber);
      return {
        ...loc,
        levelId: lv?.id || null,
        status: lv?.status || 'locked',
        starsEarned: lv?.stars_earned || 0,
      };
    });

    res.json({
      profile: {
        id: req.user.id,
        full_name: req.user.full_name,
        email: req.user.email,
        avatar_url: req.user.avatar_url,
        total_xp: totalXp,
        total_stars: Number(req.user.total_stars || 0),
        daily_streak: Number(req.user.daily_streak || 1),
        current_level_number: Number(req.user.current_level_number || 1),
        explorer_rank_level: explorerRankLevel,
        xp_in_current_tier: xpInCurrentTier,
        xp_for_next_tier: xpForNextTier,
      },
      activeLanguage: activeLanguage
        ? { ...activeLanguage, has_full_curriculum: Boolean(activeLanguage.has_full_curriculum) }
        : null,
      progressSummary: {
        completedLevels: completedCount,
        totalLevels: levels.length || 7,
        percent: levels.length ? Math.round((completedCount / levels.length) * 100) : 0,
        nextLevel: nextPlayable,
      },
      dailyMission: {
        title: 'Misi Harian Penjelajah',
        description: 'Selesaikan 3 aktivitas belajar atau raih minimal 75 XP hari ini bersama Tara.',
        completedTasks: Math.min(3, Number(todayTx?.cnt || 0)),
        targetTasks: 3,
        xpToday: Number(todayTx?.xp_today || 0),
        targetXp: 75,
      },
      dailyPhrase: dailyPhrase
        ? {
            ...dailyPhrase,
            is_saved: Boolean(dailyPhrase.is_saved),
            example_dialogue: JSON.parse(dailyPhrase.example_dialogue_json || '[]'),
          }
        : null,
      recentAchievements,
      totalAchievementsCount: Number(allAchievementsCount?.cnt || 0),
      locations,
    });
  } catch (err) {
    next(err);
  }
});

// Adventure Map & Tara Position Endpoint
router.get('/adventure/map', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const requestedLangId = req.query.languageId ? Number(req.query.languageId) : req.user.current_language_id;

    let activeLanguage = requestedLangId
      ? await queryOne(
          `SELECT rl.*, p.province_name, p.province_code
           FROM regional_languages rl JOIN provinces p ON p.id = rl.province_id
           WHERE rl.id = ?`,
          [requestedLangId]
        )
      : null;

    if (!activeLanguage) {
      activeLanguage = await queryOne(
        `SELECT rl.*, p.province_name, p.province_code
         FROM regional_languages rl JOIN provinces p ON p.id = rl.province_id
         WHERE rl.has_full_curriculum = 1 ORDER BY rl.id ASC LIMIT 1`
      );
    }

    if (activeLanguage?.has_full_curriculum) {
      await ensureLanguageProgress(userId, activeLanguage.id);
    }

    const levels = activeLanguage
      ? await queryAll(
          `SELECT ll.*,
                  COALESCE(up.status, CASE WHEN ll.level_number = 1 THEN 'available' ELSE 'locked' END) AS status,
                  COALESCE(up.module_completed, 0) AS module_completed,
                  COALESCE(up.speaking_completed, 0) AS speaking_completed,
                  COALESCE(up.listening_completed, 0) AS listening_completed,
                  COALESCE(up.reading_completed, 0) AS reading_completed,
                  COALESCE(up.writing_completed, 0) AS writing_completed,
                  COALESCE(up.stars_earned, 0) AS stars_earned,
                  COALESCE(up.xp_earned, 0) AS xp_earned,
                  up.completed_at
           FROM learning_levels ll
           LEFT JOIN user_progress up ON up.level_id = ll.id AND up.user_id = ?
           WHERE ll.language_id = ?
           ORDER BY ll.level_number ASC`,
          [userId, activeLanguage.id]
        )
      : [];

    // Compute Tara's persisted level position (highest unlocked/active level)
    let taraLevelNumber = 1;
    for (const lv of levels) {
      if (lv.status === 'available' || lv.status === 'in_progress') {
        taraLevelNumber = lv.level_number;
      } else if (lv.status === 'completed' && lv.level_number >= taraLevelNumber) {
        taraLevelNumber = lv.level_number;
      }
    }

    const verifiedLanguages = await queryAll(
      `SELECT rl.id, rl.language_name, p.province_name
       FROM regional_languages rl
       JOIN provinces p ON p.id = rl.province_id
       WHERE rl.has_full_curriculum = 1
       ORDER BY rl.id ASC`
    );

    const profile = await queryOne(
      'SELECT total_xp, total_stars, daily_streak, pending_walk_from, pending_walk_to FROM user_profiles WHERE user_id = ?',
      [userId]
    );

    res.json({
      activeLanguage: activeLanguage
        ? { ...activeLanguage, has_full_curriculum: Boolean(activeLanguage.has_full_curriculum) }
        : null,
      verifiedLanguages,
      taraPosition: {
        currentLevelNumber: taraLevelNumber,
        pendingWalkFrom: profile?.pending_walk_from || null,
        pendingWalkTo: profile?.pending_walk_to || null,
      },
      stats: {
        totalXp: Number(profile?.total_xp || 0),
        totalStars: Number(profile?.total_stars || 0),
        dailyStreak: Number(profile?.daily_streak || 1),
      },
      levels: levels.map((lv) => ({
        ...lv,
        module_completed: Boolean(lv.module_completed),
        speaking_completed: Boolean(lv.speaking_completed),
        listening_completed: Boolean(lv.listening_completed),
        reading_completed: Boolean(lv.reading_completed),
        writing_completed: Boolean(lv.writing_completed),
      })),
    });
  } catch (err) {
    next(err);
  }
});

// Clear pending walk state after Tara completes her animated walk along the map path
router.post('/adventure/walk-ack', requireAuth, async (req, res, next) => {
  try {
    await execute(
      'UPDATE user_profiles SET pending_walk_from = NULL, pending_walk_to = NULL, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
      [req.user.id]
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Get Level Detail (Learning Module + All 4 Game Activities + Questions)
// Enforces locked-level authorization check!
router.get('/levels/:levelId', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const levelId = Number(req.params.levelId);
    if (!levelId) return res.status(400).json({ error: 'ID level tidak valid.' });

    const level = await queryOne(
      `SELECT ll.*, rl.language_name, rl.pronunciation_information, p.province_name
       FROM learning_levels ll
       JOIN regional_languages rl ON rl.id = ll.language_id
       JOIN provinces p ON p.id = rl.province_id
       WHERE ll.id = ?`,
      [levelId]
    );
    if (!level) return res.status(404).json({ error: 'Level tidak ditemukan.' });

    await ensureLanguageProgress(userId, level.language_id);

    const progress = await queryOne(
      'SELECT * FROM user_progress WHERE user_id = ? AND level_id = ?',
      [userId, levelId]
    );

    if (!progress || progress.status === 'locked') {
      return res.status(403).json({
        error: `Level ${level.level_number} masih terkunci! Selesaikan Level ${level.level_number - 1} terlebih dahulu untuk membukanya.`,
        locked: true,
      });
    }

    // Move status from 'available' to 'in_progress' once user enters the level
    if (progress.status === 'available') {
      await execute(
        "UPDATE user_progress SET status = 'in_progress', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [progress.id]
      );
      progress.status = 'in_progress';
    }

    const learningModule = await queryOne(
      'SELECT * FROM learning_modules WHERE level_id = ?',
      [levelId]
    );

    const activities = await queryAll(
      'SELECT * FROM game_activities WHERE level_id = ? ORDER BY order_index ASC',
      [levelId]
    );

    const questions = await queryAll(
      'SELECT * FROM questions WHERE level_id = ? ORDER BY order_index ASC',
      [levelId]
    );

    const questionsByActivity = new Map();
    for (const q of questions) {
      const list = questionsByActivity.get(q.activity_id) || [];
      list.push({
        id: q.id,
        activity_id: q.activity_id,
        question_type: q.question_type,
        prompt: q.prompt,
        regional_text: q.regional_text,
        pronunciation_guide: q.pronunciation_guide,
        options: JSON.parse(q.options_json || '[]'),
        correct_answer: q.correct_answer,
        explanation: q.explanation,
        difficulty: q.difficulty,
        order_index: q.order_index,
      });
      questionsByActivity.set(q.activity_id, list);
    }

    res.json({
      level,
      progress: {
        status: progress.status,
        module_completed: Boolean(progress.module_completed),
        speaking_completed: Boolean(progress.speaking_completed),
        listening_completed: Boolean(progress.listening_completed),
        reading_completed: Boolean(progress.reading_completed),
        writing_completed: Boolean(progress.writing_completed),
        stars_earned: Number(progress.stars_earned || 0),
        xp_earned: Number(progress.xp_earned || 0),
      },
      module: learningModule
        ? {
            id: learningModule.id,
            title: learningModule.title,
            summary: learningModule.summary,
            vocabulary: JSON.parse(learningModule.vocabulary_json || '[]'),
            expressions: JSON.parse(learningModule.expressions_json || '[]'),
            cultural_context: learningModule.cultural_context,
            pronunciation_notes: learningModule.pronunciation_notes,
            source_metadata: learningModule.source_metadata,
          }
        : null,
      activities: activities.map((act) => ({
        id: act.id,
        activity_type: act.activity_type,
        title: act.title,
        instructions: act.instructions,
        xp_reward: act.xp_reward,
        order_index: act.order_index,
        story: act.story_json ? JSON.parse(act.story_json) : null,
        completed: Boolean(progress[`${act.activity_type}_completed`]),
        questions: questionsByActivity.get(act.id) || [],
      })),
    });
  } catch (err) {
    next(err);
  }
});

// Mark Learning Module as Completed (Replay-safe XP)
router.post('/levels/:levelId/module-complete', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const levelId = Number(req.params.levelId);
    const level = await queryOne('SELECT * FROM learning_levels WHERE id = ?', [levelId]);
    if (!level) return res.status(404).json({ error: 'Level tidak ditemukan.' });

    const progress = await queryOne(
      'SELECT * FROM user_progress WHERE user_id = ? AND level_id = ?',
      [userId, levelId]
    );
    if (!progress || progress.status === 'locked') {
      return res.status(403).json({ error: 'Level masih terkunci.' });
    }

    await execute(
      `UPDATE user_progress
       SET module_completed = 1,
           status = CASE WHEN status = 'available' THEN 'in_progress' ELSE status END,
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = ? AND level_id = ?`,
      [userId, levelId]
    );

    const reward = await awardRewardOnce({
      userId,
      sourceType: 'module',
      sourceKey: `level_${levelId}`,
      xpAmount: 20,
      starsAmount: 0,
      description: `Menyelesaikan Modul Belajar Level ${level.level_number}: ${level.title}`,
    });

    res.json({
      message: reward.awarded
        ? 'Modul belajar selesai! +20 XP ditambahkan.'
        : 'Modul belajar ditinjau ulang (XP modul sebelumnya sudah tercatat).',
      xpAwarded: reward.xpAwarded,
      alreadyAwarded: !reward.awarded,
    });
  } catch (err) {
    next(err);
  }
});

// Submit Answers for One of the 4 Interactive Game Modes (speaking | listening | reading | writing)
router.post('/levels/:levelId/activities/:activityType/submit', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const levelId = Number(req.params.levelId);
    const activityType = String(req.params.activityType || '').toLowerCase();

    if (!['speaking', 'listening', 'reading', 'writing'].includes(activityType)) {
      return res.status(400).json({ error: 'Jenis aktivitas game tidak valid.' });
    }

    const level = await queryOne('SELECT * FROM learning_levels WHERE id = ?', [levelId]);
    if (!level) return res.status(404).json({ error: 'Level tidak ditemukan.' });

    const progress = await queryOne(
      'SELECT * FROM user_progress WHERE user_id = ? AND level_id = ?',
      [userId, levelId]
    );
    if (!progress || progress.status === 'locked') {
      return res.status(403).json({ error: 'Level masih terkunci.' });
    }

    const activity = await queryOne(
      'SELECT * FROM game_activities WHERE level_id = ? AND activity_type = ?',
      [levelId, activityType]
    );
    if (!activity) return res.status(404).json({ error: 'Aktivitas tidak ditemukan.' });

    const questions = await queryAll(
      'SELECT * FROM questions WHERE activity_id = ? ORDER BY order_index ASC',
      [activity.id]
    );

    const submittedList = Array.isArray(req.body?.answers) ? req.body.answers : [];
    if (submittedList.length === 0) {
      return res.status(400).json({ error: 'Kirimkan minimal satu jawaban untuk dievaluasi.' });
    }

    const submittedMap = new Map(submittedList.map((a) => [Number(a.questionId), a]));
    const results = [];
    let correctCount = 0;

    for (const q of questions) {
      const submission = submittedMap.get(q.id);
      const rawAnswer = String(submission?.answer || '').trim();
      const evalMode = String(submission?.evaluationMode || 'exact');
      const accepted = JSON.parse(q.accepted_answers_json || '[]');
      const normalizedSubmitted = normalizeAnswer(rawAnswer);

      let isCorrect = false;
      if (activityType === 'speaking') {
        if (evalMode === 'self_practice_recorded' && rawAnswer.length > 0) {
          // Honest self-evaluated audio recording practice when browser STT does not support regional language
          isCorrect = true;
        } else {
          const candidates = [q.correct_answer, ...accepted].map(normalizeAnswer);
          isCorrect = isSpokenMatch(normalizedSubmitted, candidates);
        }
      } else {
        const candidates = [q.correct_answer, ...accepted].map(normalizeAnswer);
        isCorrect = candidates.includes(normalizedSubmitted);
      }

      if (isCorrect) correctCount++;

      await execute(
        `INSERT INTO user_answers (user_id, question_id, activity_id, level_id, submitted_answer, is_correct, evaluation_mode)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [userId, q.id, activity.id, levelId, rawAnswer || '(kosong)', isCorrect ? 1 : 0, evalMode]
      );

      results.push({
        questionId: q.id,
        submittedAnswer: rawAnswer,
        correctAnswer: q.correct_answer,
        isCorrect,
        explanation: q.explanation,
      });
    }

    const scorePercent = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 100;
    const passed = scorePercent >= 50; // Requires at least half correct to pass activity

    let reward = { awarded: false, xpAwarded: 0, starsAwarded: 0 };
    let newAchievements = [];

    if (passed) {
      const col = `${activityType}_completed`;
      await execute(
        `UPDATE user_progress
         SET ${col} = 1,
             status = CASE WHEN status = 'available' THEN 'in_progress' ELSE status END,
             updated_at = CURRENT_TIMESTAMP
         WHERE user_id = ? AND level_id = ?`,
        [userId, levelId]
      );

      reward = await awardRewardOnce({
        userId,
        sourceType: `activity_${activityType}`,
        sourceKey: `level_${levelId}`,
        xpAmount: activity.xp_reward || 25,
        starsAmount: 0,
        description: `Menyelesaikan aktivitas ${activityType.toUpperCase()} Level ${level.level_number}`,
      });

      newAchievements = await evaluateAchievements(userId);
    }

    const updatedProgress = await queryOne(
      'SELECT * FROM user_progress WHERE user_id = ? AND level_id = ?',
      [userId, levelId]
    );

    res.json({
      passed,
      correctCount,
      totalQuestions: questions.length,
      scorePercent,
      results,
      xpAwarded: reward.xpAwarded,
      alreadyAwarded: passed && !reward.awarded,
      newAchievements,
      progress: {
        status: updatedProgress.status,
        module_completed: Boolean(updatedProgress.module_completed),
        speaking_completed: Boolean(updatedProgress.speaking_completed),
        listening_completed: Boolean(updatedProgress.listening_completed),
        reading_completed: Boolean(updatedProgress.reading_completed),
        writing_completed: Boolean(updatedProgress.writing_completed),
      },
      allActivitiesDone: Boolean(
        updatedProgress.speaking_completed &&
          updatedProgress.listening_completed &&
          updatedProgress.reading_completed &&
          updatedProgress.writing_completed
      ),
    });
  } catch (err) {
    next(err);
  }
});

// Finalize & Complete a Level -> Award Replay-Safe XP/Stars -> Unlock Next Level -> Trigger Tara's Walk!
router.post('/levels/:levelId/complete', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const levelId = Number(req.params.levelId);

    const level = await queryOne('SELECT * FROM learning_levels WHERE id = ?', [levelId]);
    if (!level) return res.status(404).json({ error: 'Level tidak ditemukan.' });

    const progress = await queryOne(
      'SELECT * FROM user_progress WHERE user_id = ? AND level_id = ?',
      [userId, levelId]
    );

    if (!progress || progress.status === 'locked') {
      return res.status(403).json({ error: 'Level ini masih terkunci.' });
    }

    // Validate all 4 learning game modes are completed
    const missing = [];
    if (!progress.speaking_completed) missing.push('Berbicara (Speaking)');
    if (!progress.listening_completed) missing.push('Mendengarkan (Listening)');
    if (!progress.reading_completed) missing.push('Membaca (Reading)');
    if (!progress.writing_completed) missing.push('Menulis (Writing)');

    if (missing.length > 0) {
      return res.status(400).json({
        error: `Selesaikan seluruh aktivitas terlebih dahulu sebelum menuntaskan level: ${missing.join(', ')}.`,
        missingActivities: missing,
      });
    }

    const wasAlreadyCompleted = progress.status === 'completed';
    const starsEarned = level.star_reward || 3;

    const reward = await awardRewardOnce({
      userId,
      sourceType: 'level_complete',
      sourceKey: `level_${levelId}`,
      xpAmount: level.xp_reward || 100,
      starsAmount: starsEarned,
      description: `Menuntaskan Level ${level.level_number}: ${level.title}`,
    });

    await execute(
      `UPDATE user_progress
       SET status = 'completed',
           module_completed = 1,
           stars_earned = CASE WHEN stars_earned < ? THEN ? ELSE stars_earned END,
           xp_earned = CASE WHEN xp_earned = 0 THEN ? ELSE xp_earned END,
           completed_at = COALESCE(completed_at, CURRENT_TIMESTAMP),
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = ? AND level_id = ?`,
      [starsEarned, starsEarned, level.xp_reward || 100, userId, levelId]
    );

    // Unlock the next level if it exists
    const nextLevel = await queryOne(
      'SELECT * FROM learning_levels WHERE language_id = ? AND level_number = ?',
      [level.language_id, level.level_number + 1]
    );

    let unlockedNextLevelNumber = null;
    if (nextLevel) {
      await ensureLanguageProgress(userId, level.language_id);
      const nextProg = await queryOne(
        'SELECT status FROM user_progress WHERE user_id = ? AND level_id = ?',
        [userId, nextLevel.id]
      );
      if (nextProg && nextProg.status === 'locked') {
        await execute(
          "UPDATE user_progress SET status = 'available', updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND level_id = ?",
          [userId, nextLevel.id]
        );
      }
      unlockedNextLevelNumber = nextLevel.level_number;

      // Persist Tara's walking transition so Adventure Map plays the walking animation smoothly
      // even across navigation or page refresh until acknowledged!
      await execute(
        `UPDATE user_profiles
         SET current_level_number = CASE WHEN current_level_number < ? THEN ? ELSE current_level_number END,
             pending_walk_from = ?,
             pending_walk_to = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE user_id = ?`,
        [nextLevel.level_number, nextLevel.level_number, level.level_number, nextLevel.level_number, userId]
      );
    }

    const newAchievements = await evaluateAchievements(userId);
    const updatedProfile = await queryOne(
      'SELECT total_xp, total_stars, daily_streak, current_level_number FROM user_profiles WHERE user_id = ?',
      [userId]
    );

    res.json({
      completed: true,
      replayMode: wasAlreadyCompleted,
      levelNumber: level.level_number,
      unlockedNextLevel: unlockedNextLevelNumber,
      walkFromLevel: unlockedNextLevelNumber ? level.level_number : null,
      walkToLevel: unlockedNextLevelNumber,
      xpAwarded: reward.xpAwarded,
      starsAwarded: reward.starsAwarded,
      newAchievements,
      celebrationTitle: unlockedNextLevelNumber
        ? `Selamat! Level ${unlockedNextLevelNumber} berhasil dibuka!`
        : 'Selamat! Kamu telah menamatkan Kampung Nusantara!',
      celebrationSubtitle: 'Petualanganmu di Kampung Nusantara berlanjut!',
      stats: updatedProfile,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
