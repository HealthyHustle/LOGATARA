import { queryAll, queryOne, execute } from '../database/db.js';

export function getTodayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Replay-safe reward awarding backed by UNIQUE(user_id, source_type, source_key) in xp_transactions.
 * Guarantees the same activity, module, level, or achievement can NEVER grant duplicate XP or stars.
 */
export async function awardRewardOnce({
  userId,
  sourceType,
  sourceKey,
  xpAmount = 0,
  starsAmount = 0,
  description = '',
}) {
  const existing = await queryOne(
    'SELECT id FROM xp_transactions WHERE user_id = ? AND source_type = ? AND source_key = ?',
    [userId, sourceType, String(sourceKey)]
  );

  if (existing) {
    return { awarded: false, xpAwarded: 0, starsAwarded: 0 };
  }

  await execute(
    `INSERT INTO xp_transactions (user_id, source_type, source_key, xp_amount, stars_amount, description)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, sourceType, String(sourceKey), xpAmount, starsAmount, description]
  );

  await execute(
    `UPDATE user_profiles
     SET total_xp = total_xp + ?,
         total_stars = total_stars + ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE user_id = ?`,
    [xpAmount, starsAmount, userId]
  );

  await touchDailyStreak(userId);

  return { awarded: true, xpAwarded: xpAmount, starsAwarded: starsAmount };
}

export async function touchDailyStreak(userId) {
  const profile = await queryOne(
    'SELECT daily_streak, last_active_date FROM user_profiles WHERE user_id = ?',
    [userId]
  );
  if (!profile) return;

  const today = getTodayIsoDate();
  if (profile.last_active_date === today) return;

  let nextStreak = 1;
  if (profile.last_active_date) {
    const prev = new Date(`${profile.last_active_date}T00:00:00Z`);
    const curr = new Date(`${today}T00:00:00Z`);
    const diffDays = Math.round((curr - prev) / (1000 * 60 * 60 * 24));
    if (diffDays === 1) {
      nextStreak = (profile.daily_streak || 0) + 1;
    }
  }

  await execute(
    `UPDATE user_profiles
     SET daily_streak = ?, last_active_date = ?, updated_at = CURRENT_TIMESTAMP
     WHERE user_id = ?`,
    [nextStreak, today, userId]
  );
}

/**
 * Ensures progress rows exist for every level of a given language,
 * keeping Level 1 available by default and subsequent levels locked until unlocked.
 */
export async function ensureLanguageProgress(userId, languageId) {
  const levels = await queryAll(
    'SELECT id, level_number FROM learning_levels WHERE language_id = ? ORDER BY level_number ASC',
    [languageId]
  );

  for (const lv of levels) {
    const initialStatus = lv.level_number === 1 ? 'available' : 'locked';
    await execute(
      `INSERT INTO user_progress (user_id, language_id, level_id, status)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id, level_id) DO NOTHING`,
      [userId, languageId, lv.id, initialStatus]
    );
  }
}

/**
 * Checks all achievements against the user's real persisted progress and unlocks any newly qualified badges.
 */
export async function evaluateAchievements(userId) {
  const allAchievements = await queryAll('SELECT * FROM achievements');
  const existingRows = await queryAll(
    'SELECT achievement_id FROM user_achievements WHERE user_id = ?',
    [userId]
  );
  const ownedIds = new Set(existingRows.map((r) => r.achievement_id));

  const levelsCompletedRow = await queryOne(
    "SELECT COUNT(*) AS cnt FROM user_progress WHERE user_id = ? AND status = 'completed'",
    [userId]
  );
  const speakingRow = await queryOne(
    'SELECT COUNT(*) AS cnt FROM user_progress WHERE user_id = ? AND speaking_completed = 1',
    [userId]
  );
  const listeningRow = await queryOne(
    'SELECT COUNT(*) AS cnt FROM user_progress WHERE user_id = ? AND listening_completed = 1',
    [userId]
  );
  const savedVocabRow = await queryOne(
    'SELECT COUNT(*) AS cnt FROM saved_vocabulary WHERE user_id = ?',
    [userId]
  );
  const savedPhraseRow = await queryOne(
    'SELECT COUNT(*) AS cnt FROM saved_phrases WHERE user_id = ?',
    [userId]
  );

  const metrics = {
    levels_completed: Number(levelsCompletedRow?.cnt || 0),
    speaking_completed: Number(speakingRow?.cnt || 0),
    listening_completed: Number(listeningRow?.cnt || 0),
    saved_items: Number(savedVocabRow?.cnt || 0) + Number(savedPhraseRow?.cnt || 0),
  };

  const newlyUnlocked = [];

  for (const ach of allAchievements) {
    if (ownedIds.has(ach.id)) continue;
    const currentValue = metrics[ach.requirement_type] ?? 0;
    if (currentValue >= ach.requirement_value) {
      await execute(
        'INSERT INTO user_achievements (user_id, achievement_id) VALUES (?, ?) ON CONFLICT(user_id, achievement_id) DO NOTHING',
        [userId, ach.id]
      );
      if (ach.xp_bonus > 0) {
        await awardRewardOnce({
          userId,
          sourceType: 'achievement',
          sourceKey: ach.code,
          xpAmount: ach.xp_bonus,
          starsAmount: 0,
          description: `Lencana terbuka: ${ach.title}`,
        });
      }
      newlyUnlocked.push(ach);
    }
  }

  return newlyUnlocked;
}
