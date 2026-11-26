import { Router } from 'express';
import { queryAll, queryOne, execute } from '../database/db.js';
import { requireAuth } from '../middleware/auth.js';
import { evaluateAchievements } from '../services/rewardsService.js';
import { generateChatResponse, getAiProviderStatus, translateWithAi } from '../services/aiService.js';

const router = Router();

function normalizeForTranslate(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[?!.,'’"“”()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function expandIndonesianSynonyms(normalized) {
  const variants = [normalized];
  const rules = [
    [/\bmakasih\b/g, 'terima kasih'],
    [/\btrimakasih\b/g, 'terima kasih'],
    [/\bterimakasih\b/g, 'terima kasih'],
    [/\bgimana kabar\w*\b/g, 'apa kabar'],
    [/\bbagaimana kabar\w*\b/g, 'apa kabar'],
    [/\bkabarmu\b/g, 'apa kabar'],
    [/\baku\b/g, 'saya'],
    [/\bkamu\b/g, 'anda'],
    [/\banda\b/g, 'kamu'],
    [/\bhalo\b/g, 'salam'],
    [/\bpermisi\b/g, 'maaf'],
  ];
  for (const [regex, replacement] of rules) {
    if (regex.test(normalized)) {
      variants.push(normalized.replace(regex, replacement).replace(/\s+/g, ' ').trim());
    }
  }
  return [...new Set(variants)];
}

// ==================================================
// TRANSLATE & VERIFIED REGIONAL DICTIONARY
// ==================================================
router.post('/translate', requireAuth, async (req, res, next) => {
  try {
    const text = String(req.body?.text || '').trim();
    const languageId = Number(req.body?.languageId);
    const direction = req.body?.direction === 'regional-to-id' ? 'regional-to-id' : 'id-to-regional';

    if (!text) {
      return res.status(400).json({ error: 'Masukkan kata atau frasa yang ingin diterjemahkan.' });
    }
    if (!languageId) {
      return res.status(400).json({ error: 'Pilih bahasa daerah terlebih dahulu.' });
    }

    const language = await queryOne(
      `SELECT rl.*, p.province_name
       FROM regional_languages rl JOIN provinces p ON p.id = rl.province_id
       WHERE rl.id = ?`,
      [languageId]
    );
    if (!language) {
      return res.status(404).json({ error: 'Bahasa daerah tidak ditemukan.' });
    }

    const vocabList = await queryAll(
      'SELECT * FROM vocabulary WHERE language_id = ? ORDER BY id ASC',
      [languageId]
    );

    const cleaned = normalizeForTranslate(text);
    const queryVariants =
      direction === 'id-to-regional' ? expandIndonesianSynonyms(cleaned) : [cleaned];

    const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const hasWholePhrase = (haystack, needle) => {
      if (!needle) return false;
      return new RegExp(`(^|\\b)${escapeRegex(needle)}(\\b|$)`, 'i').test(haystack);
    };

    const getNormalizedSides = (v) => {
      const raw = direction === 'id-to-regional' ? v.indonesian_meaning : v.regional_word;
      // Split slash-separated variants like "Baik / Bagus" or "Makase / Dangke"
      const parts = raw
        .split('/')
        .map((p) => normalizeForTranslate(p))
        .filter(Boolean);
      const full = normalizeForTranslate(raw);
      return [...new Set([full, ...parts])];
    };

    // Tier 1: Exact match or dictionary entry containing the full user query
    // (Multi-word queries like "saya makan" fall through to Tier 2 sentence composition so every word translates!)
    const exactMatches = vocabList.filter((v) => {
      const sides = getNormalizedSides(v);
      return queryVariants.some((qv) =>
        sides.some((side) => side === qv || hasWholePhrase(side, qv))
      );
    });

    if (exactMatches.length > 0) {
      // Prefer closest length exact match first
      exactMatches.sort((a, b) => {
        const aExact = getNormalizedSides(a).some((s) => queryVariants.includes(s)) ? 0 : 1;
        const bExact = getNormalizedSides(b).some((s) => queryVariants.includes(s)) ? 0 : 1;
        return aExact - bExact;
      });

      const primary = exactMatches[0];
      return res.json({
        found: true,
        uncertain: false,
        sourceMode: 'verified_dictionary',
        language,
        translation: direction === 'id-to-regional' ? primary.regional_word : primary.indonesian_meaning,
        pronunciation: primary.pronunciation,
        registerLevel: primary.register_level,
        exampleSentence: primary.example_sentence,
        exampleTranslation: primary.example_translation,
        sourceMetadata: primary.source_metadata,
        vocabularyId: primary.id,
        matches: exactMatches.slice(0, 6),
        wordBreakdown: [],
        message: 'Terjemahan ditemukan di kamus terverifikasi LOGATARA.',
      });
    }

    // Tier 2: Multi-word phrase composition from verified dictionary entries
    const inputWords = cleaned.split(/\s+/).filter(Boolean);
    if (inputWords.length >= 2 && vocabList.length > 0) {
      const breakdown = [];
      let i = 0;
      let matchedWordCount = 0;

      while (i < inputWords.length) {
        let matchedEntry = null;
        let span = 0;

        // Try longest phrase first (3 words, 2 words, 1 word)
        for (let len = Math.min(3, inputWords.length - i); len >= 1; len--) {
          const slice = inputWords.slice(i, i + len).join(' ');
          const sliceVariants =
            direction === 'id-to-regional' ? expandIndonesianSynonyms(slice) : [slice];
          const found = vocabList.find((v) =>
            getNormalizedSides(v).some((side) => sliceVariants.includes(side))
          );
          if (found) {
            matchedEntry = found;
            span = len;
            break;
          }
        }

        if (matchedEntry) {
          const outText = (
            direction === 'id-to-regional'
              ? matchedEntry.regional_word
              : matchedEntry.indonesian_meaning
          )
            .split('/')[0]
            .trim();
          breakdown.push({
            source: inputWords.slice(i, i + span).join(' '),
            translated: outText,
            pronunciation: matchedEntry.pronunciation,
            verified: true,
          });
          matchedWordCount += span;
          i += span;
        } else {
          breakdown.push({
            source: inputWords[i],
            translated: inputWords[i],
            pronunciation: '',
            verified: false,
          });
          i += 1;
        }
      }

      if (matchedWordCount >= 2 || (matchedWordCount >= 1 && matchedWordCount / inputWords.length >= 0.5)) {
        const composed = breakdown.map((b) => b.translated).join(' ');
        const composedPron = breakdown
          .filter((b) => b.pronunciation)
          .map((b) => b.pronunciation)
          .join(' • ');
        return res.json({
          found: true,
          uncertain: matchedWordCount < inputWords.length,
          sourceMode: 'verified_dictionary_composed',
          language,
          translation: composed,
          pronunciation: composedPron,
          registerLevel: 'Komposisi Kamus',
          exampleSentence: '',
          exampleTranslation: '',
          sourceMetadata: language.source_metadata,
          matches: [],
          wordBreakdown: breakdown,
          message:
            matchedWordCount === inputWords.length
              ? 'Kalimat diterjemahkan kata-per-kata dari kamus terverifikasi LOGATARA.'
              : 'Sebagian kata diterjemahkan dari kamus terverifikasi; kata tanpa sorotan tetap dipertahankan.',
        });
      }
    }

    // Tier 3: Whole-word token match across verified dictionary (never partial substring inside unrelated word)
    const words = cleaned.split(/\s+/).filter((w) => w.length >= 3);
    const partialMatches = vocabList.filter((v) => {
      const field = normalizeForTranslate(
        direction === 'id-to-regional'
          ? `${v.indonesian_meaning} ${v.example_translation}`
          : `${v.regional_word} ${v.example_sentence}`
      );
      return words.some((w) => hasWholePhrase(field, w));
    });

    if (partialMatches.length > 0) {
      const best = partialMatches[0];
      return res.json({
        found: true,
        uncertain: true,
        sourceMode: 'verified_dictionary_partial',
        language,
        translation: direction === 'id-to-regional' ? best.regional_word : best.indonesian_meaning,
        pronunciation: best.pronunciation,
        registerLevel: best.register_level,
        exampleSentence: best.example_sentence,
        exampleTranslation: best.example_translation,
        sourceMetadata: best.source_metadata,
        vocabularyId: best.id,
        matches: partialMatches.slice(0, 6),
        wordBreakdown: [],
        message: 'Terjemahan persis tidak ditemukan; berikut padanan terdekat dari kamus terverifikasi.',
      });
    }

    // Tier 4: Optional AI-assisted translation when GEMINI_API_KEY or OPENAI_API_KEY is configured
    const aiTrans = await translateWithAi({
      text,
      language,
      direction,
      sampleVocab: vocabList,
    });
    if (aiTrans) {
      return res.json({
        found: true,
        uncertain: !aiTrans.confident,
        sourceMode: 'ai_assisted',
        language,
        translation: aiTrans.translation,
        pronunciation: aiTrans.pronunciation || '',
        registerLevel: 'Berbantuan AI',
        exampleSentence: aiTrans.exampleSentence || '',
        exampleTranslation: aiTrans.exampleTranslation || '',
        sourceMetadata: `Terjemahan Berbantuan ${aiTrans.providerLabel}${aiTrans.notes ? ` (${aiTrans.notes})` : ''}`,
        matches: [],
        wordBreakdown: [],
        message: `Diterjemahkan menggunakan ${aiTrans.providerLabel} berbasis konteks kamus ${language.language_name}.`,
      });
    }

    // Tier 5: Honest unavailable response + real clickable suggestions from THIS selected language
    res.json({
      found: false,
      uncertain: true,
      sourceMode: 'not_found',
      language,
      translation: null,
      matches: vocabList.slice(0, 6),
      wordBreakdown: [],
      message: `Frasa "${text}" belum tersedia di kamus terverifikasi ${language.language_name}. Coba kosakata dasar terverifikasi untuk ${language.language_name} seperti yang ditampilkan di bawah, atau aktifkan API AI di .env untuk terjemahan kalimat bebas.`,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/dictionary', requireAuth, async (req, res, next) => {
  try {
    const languageId = req.query.languageId ? Number(req.query.languageId) : null;
    const search = String(req.query.q || '').trim().toLowerCase();
    const userId = req.user.id;

    let sql = `
      SELECT v.*, rl.language_name, p.province_name,
             CASE WHEN sv.id IS NOT NULL THEN 1 ELSE 0 END AS is_saved
      FROM vocabulary v
      JOIN regional_languages rl ON rl.id = v.language_id
      JOIN provinces p ON p.id = rl.province_id
      LEFT JOIN saved_vocabulary sv
        ON sv.user_id = ? AND sv.language_id = v.language_id AND sv.regional_word = v.regional_word
      WHERE 1 = 1
    `;
    const params = [userId];

    if (languageId) {
      sql += ' AND v.language_id = ?';
      params.push(languageId);
    }
    if (search) {
      sql +=
        ' AND (LOWER(v.regional_word) LIKE ? OR LOWER(v.indonesian_meaning) LIKE ? OR LOWER(v.example_sentence) LIKE ? OR LOWER(rl.language_name) LIKE ? OR LOWER(p.province_name) LIKE ?)';
      const pat = `%${search}%`;
      params.push(pat, pat, pat, pat, pat);
    }

    sql += ' ORDER BY v.language_id ASC, v.id ASC LIMIT 200';

    const entries = await queryAll(sql, params);
    res.json({
      entries: entries.map((e) => ({ ...e, is_saved: Boolean(e.is_saved) })),
    });
  } catch (err) {
    next(err);
  }
});

// ==================================================
// SAVED VOCABULARY
// ==================================================
router.get('/saved-vocabulary', requireAuth, async (req, res, next) => {
  try {
    const rows = await queryAll(
      `SELECT sv.*, rl.language_name, p.province_name
       FROM saved_vocabulary sv
       JOIN regional_languages rl ON rl.id = sv.language_id
       JOIN provinces p ON p.id = rl.province_id
       WHERE sv.user_id = ?
       ORDER BY sv.created_at DESC`,
      [req.user.id]
    );
    res.json({ items: rows });
  } catch (err) {
    next(err);
  }
});

router.post('/saved-vocabulary', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const vocabularyId = req.body?.vocabularyId ? Number(req.body.vocabularyId) : null;
    const languageId = Number(req.body?.languageId);
    const regionalWord = String(req.body?.regionalWord || '').trim();
    const indonesianMeaning = String(req.body?.indonesianMeaning || '').trim();
    const pronunciation = String(req.body?.pronunciation || '').trim();
    const notes = String(req.body?.notes || '').trim();

    if (!languageId || !regionalWord || !indonesianMeaning) {
      return res.status(400).json({ error: 'Data kosakata tidak lengkap untuk disimpan.' });
    }

    await execute(
      `INSERT INTO saved_vocabulary (user_id, vocabulary_id, language_id, regional_word, indonesian_meaning, pronunciation, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, language_id, regional_word) DO UPDATE SET notes = excluded.notes`,
      [userId, vocabularyId, languageId, regionalWord, indonesianMeaning, pronunciation, notes]
    );

    const newAchievements = await evaluateAchievements(userId);
    res.status(201).json({ message: 'Kosakata berhasil disimpan ke Kamus Saku!', newAchievements });
  } catch (err) {
    next(err);
  }
});

router.delete('/saved-vocabulary/:id', requireAuth, async (req, res, next) => {
  try {
    await execute('DELETE FROM saved_vocabulary WHERE id = ? AND user_id = ?', [
      Number(req.params.id),
      req.user.id,
    ]);
    res.json({ message: 'Kosakata dihapus dari daftar simpanan.' });
  } catch (err) {
    next(err);
  }
});

// ==================================================
// DAILY REGIONAL PHRASES ("Frasa Nusantara Hari Ini")
// ==================================================
router.get('/daily-phrases', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const phrases = await queryAll(
      `SELECT dp.*, rl.language_name, p.province_name, p.island_group,
              CASE WHEN sp.id IS NOT NULL THEN 1 ELSE 0 END AS is_saved
       FROM daily_phrases dp
       JOIN regional_languages rl ON rl.id = dp.language_id
       JOIN provinces p ON p.id = dp.province_id
       LEFT JOIN saved_phrases sp ON sp.daily_phrase_id = dp.id AND sp.user_id = ?
       ORDER BY dp.phrase_date DESC`,
      [userId]
    );

    const formatted = phrases.map((p) => ({
      ...p,
      is_saved: Boolean(p.is_saved),
      example_dialogue: JSON.parse(p.example_dialogue_json || '[]'),
    }));

    res.json({
      todayPhrase: formatted[0] || null,
      history: formatted,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/daily-phrases/:id/save', requireAuth, async (req, res, next) => {
  try {
    const phraseId = Number(req.params.id);
    const exists = await queryOne('SELECT id FROM daily_phrases WHERE id = ?', [phraseId]);
    if (!exists) return res.status(404).json({ error: 'Frasa tidak ditemukan.' });

    await execute(
      'INSERT INTO saved_phrases (user_id, daily_phrase_id) VALUES (?, ?) ON CONFLICT(user_id, daily_phrase_id) DO NOTHING',
      [req.user.id, phraseId]
    );
    const newAchievements = await evaluateAchievements(req.user.id);
    res.status(201).json({ message: 'Frasa berhasil disimpan ke profilmu!', newAchievements });
  } catch (err) {
    next(err);
  }
});

router.delete('/daily-phrases/:id/save', requireAuth, async (req, res, next) => {
  try {
    await execute('DELETE FROM saved_phrases WHERE user_id = ? AND daily_phrase_id = ?', [
      req.user.id,
      Number(req.params.id),
    ]);
    res.json({ message: 'Frasa dihapus dari simpanan.' });
  } catch (err) {
    next(err);
  }
});

// ==================================================
// LOGATARA AI CHATBOT (With Persistent Conversation History)
// ==================================================
router.get('/chat/status', requireAuth, (_req, res) => {
  res.json(getAiProviderStatus());
});

router.get('/chat/history', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    let conv = await queryOne(
      'SELECT * FROM chat_conversations WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1',
      [userId]
    );

    if (!conv) {
      const inserted = await execute(
        'INSERT INTO chat_conversations (user_id, language_id, title) VALUES (?, ?, ?)',
        [userId, req.user.current_language_id || null, 'Petualangan Belajar bersama LOGATARA AI']
      );
      conv = await queryOne('SELECT * FROM chat_conversations WHERE id = ?', [inserted.lastInsertRowid]);
    }

    const messages = await queryAll(
      'SELECT * FROM chat_messages WHERE conversation_id = ? ORDER BY id ASC',
      [conv.id]
    );

    res.json({
      conversation: conv,
      messages,
      providerStatus: getAiProviderStatus(),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/chat/message', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const content = String(req.body?.message || '').trim();
    if (!content) {
      return res.status(400).json({ error: 'Pesan tidak boleh kosong.' });
    }
    if (content.length > 1500) {
      return res.status(400).json({ error: 'Pesan terlalu panjang (maksimal 1500 karakter).' });
    }

    let conv = await queryOne(
      'SELECT * FROM chat_conversations WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1',
      [userId]
    );
    if (!conv) {
      const inserted = await execute(
        'INSERT INTO chat_conversations (user_id, language_id, title) VALUES (?, ?, ?)',
        [userId, req.user.current_language_id || null, 'Petualangan Belajar bersama LOGATARA AI']
      );
      conv = await queryOne('SELECT * FROM chat_conversations WHERE id = ?', [inserted.lastInsertRowid]);
    }

    const historyMessages = await queryAll(
      'SELECT role, content FROM chat_messages WHERE conversation_id = ? ORDER BY id ASC',
      [conv.id]
    );

    // Save user message
    const userMsgIns = await execute(
      "INSERT INTO chat_messages (conversation_id, role, content, provider_mode) VALUES (?, 'user', ?, 'user')",
      [conv.id, content]
    );

    const currentLanguage = req.user.current_language_id
      ? await queryOne(
        `SELECT rl.*, p.province_name
           FROM regional_languages rl JOIN provinces p ON p.id = rl.province_id
           WHERE rl.id = ?`,
        [req.user.current_language_id]
      )
      : null;

    const aiResult = await generateChatResponse({
      user: req.user,
      currentLanguage,
      historyMessages,
      userMessage: content,
    });

    const botMsgIns = await execute(
      "INSERT INTO chat_messages (conversation_id, role, content, provider_mode) VALUES (?, 'assistant', ?, ?)",
      [conv.id, aiResult.reply, aiResult.providerMode]
    );

    await execute('UPDATE chat_conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [conv.id]);

    const userMessageRow = await queryOne('SELECT * FROM chat_messages WHERE id = ?', [userMsgIns.lastInsertRowid]);
    const assistantMessageRow = await queryOne('SELECT * FROM chat_messages WHERE id = ?', [
      botMsgIns.lastInsertRowid,
    ]);

    res.json({
      userMessage: userMessageRow,
      assistantMessage: assistantMessageRow,
      providerMode: aiResult.providerMode,
      providerLabel: aiResult.providerLabel,
      fallbackWarning: aiResult.fallbackWarning,
    });
  } catch (err) {
    next(err);
  }
});

router.delete('/chat/history', requireAuth, async (req, res, next) => {
  try {
    await execute('DELETE FROM chat_conversations WHERE user_id = ?', [req.user.id]);
    res.json({ message: 'Riwayat percakapan berhasil dibersihkan.' });
  } catch (err) {
    next(err);
  }
});

// ==================================================
// FULL USER PROFILE & ACHIEVEMENTS
// ==================================================
router.get('/profile/full', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;

    const knownLanguages = await queryAll(
      `SELECT rl.id, rl.language_name, p.province_name
       FROM user_known_languages ukl
       JOIN regional_languages rl ON rl.id = ukl.language_id
       JOIN provinces p ON p.id = rl.province_id
       WHERE ukl.user_id = ?
       ORDER BY rl.language_name ASC`,
      [userId]
    );

    const learningLanguages = await queryAll(
      `SELECT rl.id, rl.language_name, rl.has_full_curriculum, p.province_name, ull.is_primary
       FROM user_learning_languages ull
       JOIN regional_languages rl ON rl.id = ull.language_id
       JOIN provinces p ON p.id = rl.province_id
       WHERE ull.user_id = ?
       ORDER BY ull.is_primary DESC, rl.language_name ASC`,
      [userId]
    );

    const completedLevels = await queryAll(
      `SELECT up.*, ll.level_number, ll.title, ll.location_name, rl.language_name
       FROM user_progress up
       JOIN learning_levels ll ON ll.id = up.level_id
       JOIN regional_languages rl ON rl.id = up.language_id
       WHERE up.user_id = ? AND up.status = 'completed'
       ORDER BY up.completed_at DESC`,
      [userId]
    );

    const xpHistory = await queryAll(
      `SELECT * FROM xp_transactions
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 20`,
      [userId]
    );

    const achievements = await queryAll(
      `SELECT a.*, ua.unlocked_at,
              CASE WHEN ua.id IS NOT NULL THEN 1 ELSE 0 END AS unlocked
       FROM achievements a
       LEFT JOIN user_achievements ua ON ua.achievement_id = a.id AND ua.user_id = ?
       ORDER BY unlocked DESC, a.id ASC`,
      [userId]
    );

    const savedVocabulary = await queryAll(
      `SELECT sv.*, rl.language_name, p.province_name
       FROM saved_vocabulary sv
       JOIN regional_languages rl ON rl.id = sv.language_id
       JOIN provinces p ON p.id = rl.province_id
       WHERE sv.user_id = ?
       ORDER BY sv.created_at DESC`,
      [userId]
    );

    const savedPhrases = await queryAll(
      `SELECT sp.id AS saved_id, sp.created_at AS saved_at, dp.*, rl.language_name, p.province_name
       FROM saved_phrases sp
       JOIN daily_phrases dp ON dp.id = sp.daily_phrase_id
       JOIN regional_languages rl ON rl.id = dp.language_id
       JOIN provinces p ON p.id = dp.province_id
       WHERE sp.user_id = ?
       ORDER BY sp.created_at DESC`,
      [userId]
    );

    res.json({
      profile: {
        ...req.user,
        onboarding_completed: Boolean(req.user.onboarding_completed),
      },
      knownLanguages,
      learningLanguages: learningLanguages.map((l) => ({
        ...l,
        is_primary: Boolean(l.is_primary),
        has_full_curriculum: Boolean(l.has_full_curriculum),
      })),
      completedLevels,
      xpHistory,
      achievements: achievements.map((a) => ({ ...a, unlocked: Boolean(a.unlocked) })),
      savedVocabulary,
      savedPhrases: savedPhrases.map((p) => ({
        ...p,
        example_dialogue: JSON.parse(p.example_dialogue_json || '[]'),
      })),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
