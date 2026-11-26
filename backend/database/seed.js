import 'dotenv/config';
import { initDatabase, queryOne, execute } from './db.js';
import { PROVINCES, REGIONAL_LANGUAGES } from './data/provincesAndLanguages.js';
import { LEVEL_BLUEPRINT, VERIFIED_LANGUAGE_PACKS } from './data/curriculumData.js';
import { VERIFIED_LANGUAGE_PACKS_PART2, ACHIEVEMENTS_SEED, DAILY_PHRASES_SEED } from './data/curriculumDataExtra.js';
import { VERIFIED_DICT_WEST } from './data/verifiedDictWest.js';
import { VERIFIED_DICT_EAST } from './data/verifiedDictEast.js';

const ALL_PACKS = {
  ...VERIFIED_LANGUAGE_PACKS,
  ...VERIFIED_LANGUAGE_PACKS_PART2,
};

const ALL_EXTENDED_DICTS = {
  ...VERIFIED_DICT_WEST,
  ...VERIFIED_DICT_EAST,
};

function shuffleDeterministic(arr, seed = 1) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = (i * 7 + seed * 3) % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export async function syncVerifiedDictionaries({ silent = false } = {}) {
  let addedEntries = 0;
  let verifiedLangs = 0;

  for (const [langName, dictPack] of Object.entries(ALL_EXTENDED_DICTS)) {
    const langRow = await queryOne(
      'SELECT id, verification_status FROM regional_languages WHERE language_name = ?',
      [langName]
    );
    if (!langRow) continue;

    for (const [word, meaning, pron, ex, exTr, reg] of dictPack.entries) {
      const ins = await execute(
        `INSERT INTO vocabulary
          (language_id, regional_word, indonesian_meaning, pronunciation, example_sentence, example_translation, category, register_level, verification_status, source_metadata)
         VALUES (?, ?, ?, ?, ?, ?, 'dasar', ?, 'verified', ?)
         ON CONFLICT(language_id, regional_word) DO NOTHING`,
        [langRow.id, word, meaning, pron, ex, exTr, reg || 'Umum', dictPack.source]
      );
      addedEntries += ins.changes || 0;
    }

    if (langRow.verification_status !== 'verified') {
      await execute(
        `UPDATE regional_languages
         SET verification_status = 'verified', source_metadata = ?
         WHERE id = ?`,
        [dictPack.source, langRow.id]
      );
      verifiedLangs++;
    }
  }

  // Ensure corrected Sundanese "Rampes" e-pepet pronunciation & notes stay synced in existing databases
  await execute(
    `UPDATE vocabulary SET pronunciation = 'ram-pês (e pepet seperti "senang")'
     WHERE regional_word = 'Rampes' AND pronunciation = 'ram-pés'`
  );
  await execute(
    `UPDATE questions SET pronunciation_guide = 'ram-pês (e pepet seperti "senang")',
       explanation = REPLACE(explanation, '/ram-pés/', '/ram-pês (e pepet)/')
     WHERE regional_text = 'Rampes' AND pronunciation_guide = 'ram-pés'`
  );
  await execute(
    `UPDATE learning_modules
     SET vocabulary_json = REPLACE(vocabulary_json, '"ram-pés"', '"ram-pês (e pepet seperti \\"senang\\")"'),
         pronunciation_notes = 'Basa Sunda membedakan 3 bunyi vokal: "e" pepet (seperti "sepatu") pada kata "rampes", "wilujeng", dan "punten"; "é" taling (seperti "sate") pada "énjing" dan "pangéstu"; serta "eu" khas Sunda (bibir mendatar) pada "anjeun" dan "peuyeum".'
     WHERE vocabulary_json LIKE '%"ram-pés"%'`
  );
  await execute(
    `UPDATE regional_languages
     SET pronunciation_information = 'Perhatikan perbedaan 3 bunyi vokal: "e" pepet (seperti "sepatu"/"senang" pada kata "rampes" & "punten"), "é" taling (seperti "sate" pada "énjing"), dan "eu" khas Sunda (bibir mendatar seperti "anjeun" & "peuyeum").'
     WHERE language_name = 'Basa Sunda' AND pronunciation_information LIKE '%"enak"%'`
  );
  await execute(
    `UPDATE learning_modules
     SET pronunciation_notes = REPLACE(pronunciation_notes, 'makan - untuk', 'makan untuk')
     WHERE pronunciation_notes LIKE '%makan - untuk%'`
  );
  await execute(
    `UPDATE game_activities
     SET story_json = REPLACE(story_json, ' — ', ', yang berarti ')
     WHERE story_json LIKE '% — %'`
  );

  if (!silent && (addedEntries > 0 || verifiedLangs > 0)) {
    console.log(
      `Synced verified dictionaries across 38 provinces (+${addedEntries} entries, ${verifiedLangs} languages marked verified).`
    );
  }
}

export async function seedDatabase({ silent = false } = {}) {
  const existingProvinces = await queryOne('SELECT COUNT(*) AS cnt FROM provinces');
  if (Number(existingProvinces?.cnt || 0) >= 38) {
    await syncVerifiedDictionaries({ silent });
    if (!silent) console.log('LOGATARA database already seeded (38 provinces present).');
    return;
  }

  if (!silent) console.log('Seeding LOGATARA database with 38 provinces, regional languages, verified curricula, and achievements...');

  // 1. Seed all 38 Provinces
  const provinceMap = new Map();
  for (const p of PROVINCES) {
    await execute(
      `INSERT INTO provinces (province_name, province_code, island_group, region_description, cultural_information)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(province_code) DO NOTHING`,
      [p.province_name, p.province_code, p.island_group, p.region_description, p.cultural_information]
    );
    const row = await queryOne('SELECT id FROM provinces WHERE province_code = ?', [p.province_code]);
    provinceMap.set(p.province_code, row.id);
  }

  // 2. Seed all Regional Languages (many-to-one with provinces)
  const languageMap = new Map();
  for (const lang of REGIONAL_LANGUAGES) {
    const provinceId = provinceMap.get(lang.province_code);
    if (!provinceId) continue;
    await execute(
      `INSERT INTO regional_languages
        (language_name, province_id, alternative_names, language_description, pronunciation_information, verification_status, source_metadata, has_full_curriculum)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(language_name, province_id) DO NOTHING`,
      [
        lang.language_name,
        provinceId,
        lang.alternative_names,
        lang.language_description,
        lang.pronunciation_information,
        lang.verification_status,
        lang.source_metadata,
        lang.has_full_curriculum ? 1 : 0,
      ]
    );
    const row = await queryOne(
      'SELECT id FROM regional_languages WHERE language_name = ? AND province_id = ?',
      [lang.language_name, provinceId]
    );
    languageMap.set(lang.language_name, row.id);
  }

  // 3. Seed Verified Vocabulary, 7 Learning Levels, Learning Modules, 4 Game Activities, and Questions
  for (const [langName, pack] of Object.entries(ALL_PACKS)) {
    const languageId = languageMap.get(langName);
    if (!languageId) continue;

    for (const bp of LEVEL_BLUEPRINT) {
      const lvData = pack.levels[bp.level_number];
      if (!lvData) continue;

      // Insert vocabulary entries into central dictionary table
      for (const v of lvData.vocab) {
        await execute(
          `INSERT INTO vocabulary
            (language_id, regional_word, indonesian_meaning, pronunciation, example_sentence, example_translation, category, register_level, verification_status, source_metadata)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'verified', ?)
           ON CONFLICT(language_id, regional_word) DO NOTHING`,
          [
            languageId,
            v.word,
            v.meaning,
            v.pron,
            v.ex,
            v.exTr,
            bp.title.toLowerCase(),
            v.register || 'Umum',
            pack.source,
          ]
        );
      }

      // Insert learning_level
      await execute(
        `INSERT INTO learning_levels
          (language_id, level_number, title, location_name, description, required_xp, xp_reward, star_reward, map_x, map_y)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(language_id, level_number) DO NOTHING`,
        [
          languageId,
          bp.level_number,
          bp.title,
          bp.location_name,
          bp.description,
          bp.required_xp,
          bp.xp_reward,
          bp.star_reward,
          bp.map_x,
          bp.map_y,
        ]
      );
      const levelRow = await queryOne(
        'SELECT id FROM learning_levels WHERE language_id = ? AND level_number = ?',
        [languageId, bp.level_number]
      );
      const levelId = levelRow.id;

      // Insert learning_module
      const expressions = lvData.vocab.slice(0, 4).map((v) => ({
        regional: v.ex,
        indonesian: v.exTr,
        pronunciation: v.pron,
        register: v.register || 'Umum',
      }));

      await execute(
        `INSERT INTO learning_modules
          (level_id, language_id, title, summary, vocabulary_json, expressions_json, cultural_context, pronunciation_notes, source_metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(level_id) DO NOTHING`,
        [
          levelId,
          languageId,
          `Modul ${bp.level_number}: ${bp.title} (${langName})`,
          bp.description,
          JSON.stringify(lvData.vocab),
          JSON.stringify(expressions),
          lvData.culturalContext,
          lvData.pronunciationNotes,
          pack.source,
        ]
      );

      // Build 4 Game Activities (Speaking, Listening, Reading, Writing)
      const [v0, v1, v2, v3, v4, v5] = lvData.vocab;
      const allMeanings = lvData.vocab.map((v) => v.meaning);
      const allWords = lvData.vocab.map((v) => v.word);
      const difficulty = bp.level_number <= 2 ? 'pemula' : bp.level_number <= 5 ? 'menengah' : 'mahir';

      // A. SPEAKING
      await execute(
        `INSERT INTO game_activities (level_id, language_id, activity_type, title, instructions, xp_reward, order_index)
         VALUES (?, ?, 'speaking', ?, ?, 25, 1)
         ON CONFLICT(level_id, activity_type) DO NOTHING`,
        [
          levelId,
          languageId,
          `Berbicara: Ucapkan Frasa ${bp.title}`,
          'Dengarkan contoh pelafalan, tekan tombol mikrofon untuk merekam suaramu, lalu bandingkan dengan panduan pelafalan baku.',
        ]
      );
      const speakAct = await queryOne(
        "SELECT id FROM game_activities WHERE level_id = ? AND activity_type = 'speaking'",
        [levelId]
      );
      const speakExists = await queryOne('SELECT COUNT(*) AS cnt FROM questions WHERE activity_id = ?', [speakAct.id]);
      if (Number(speakExists?.cnt || 0) === 0) {
        const speakItems = [v0, v1];
        for (let idx = 0; idx < speakItems.length; idx++) {
          const item = speakItems[idx];
          await execute(
            `INSERT INTO questions
              (activity_id, level_id, language_id, question_type, prompt, regional_text, pronunciation_guide, options_json, correct_answer, accepted_answers_json, explanation, difficulty, order_index)
             VALUES (?, ?, ?, 'speaking_phrase', ?, ?, ?, '[]', ?, ?, ?, ?, ?)`,
            [
              speakAct.id,
              levelId,
              languageId,
              `Ucapkan ungkapan untuk "${item.meaning}" dalam ${langName}:`,
              item.word,
              item.pron,
              item.word,
              JSON.stringify([item.word.toLowerCase(), item.word.toLowerCase().replace(/[?!.,']/g, '')]),
              `"${item.word}" dibaca /${item.pron}/ dan berarti "${item.meaning}". Contoh: "${item.ex}" (${item.exTr}).`,
              difficulty,
              idx + 1,
            ]
          );
        }
      }

      // B. LISTENING
      await execute(
        `INSERT INTO game_activities (level_id, language_id, activity_type, title, instructions, xp_reward, order_index)
         VALUES (?, ?, 'listening', ?, ?, 25, 2)
         ON CONFLICT(level_id, activity_type) DO NOTHING`,
        [
          levelId,
          languageId,
          `Mendengarkan: Pahami Ucapan Warga`,
          'Putar audio frasa daerah berikut (kamu dapat memutar ulang atau memperlambat suara), lalu pilih arti Bahasa Indonesia yang paling tepat.',
        ]
      );
      const listenAct = await queryOne(
        "SELECT id FROM game_activities WHERE level_id = ? AND activity_type = 'listening'",
        [levelId]
      );
      const listenExists = await queryOne('SELECT COUNT(*) AS cnt FROM questions WHERE activity_id = ?', [listenAct.id]);
      if (Number(listenExists?.cnt || 0) === 0) {
        const listenItems = [v2, v3];
        for (let idx = 0; idx < listenItems.length; idx++) {
          const item = listenItems[idx];
          const distractors = allMeanings.filter((m) => m !== item.meaning).slice(0, 3);
          const opts = shuffleDeterministic([item.meaning, ...distractors], bp.level_number + idx + 1);
          await execute(
            `INSERT INTO questions
              (activity_id, level_id, language_id, question_type, prompt, regional_text, pronunciation_guide, options_json, correct_answer, accepted_answers_json, explanation, difficulty, order_index)
             VALUES (?, ?, ?, 'listening_mcq', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              listenAct.id,
              levelId,
              languageId,
              `Dengarkan audio ${langName} ini. Apa artinya dalam Bahasa Indonesia?`,
              item.word,
              item.pron,
              JSON.stringify(opts),
              item.meaning,
              JSON.stringify([item.meaning]),
              `Frasa "${item.word}" (/${item.pron}/) berarti "${item.meaning}". Contoh kalimat: "${item.ex}".`,
              difficulty,
              idx + 1,
            ]
          );
        }
      }

      // C. READING
      const storyPayload = {
        title: lvData.storyTitle,
        location: bp.location_name,
        paragraphs: lvData.storyParagraphs,
        culturalNote: lvData.culturalContext,
        highlights: lvData.vocab.map((v) => ({
          word: v.word,
          meaning: v.meaning,
          pronunciation: v.pron,
        })),
      };
      await execute(
        `INSERT INTO game_activities (level_id, language_id, activity_type, title, instructions, xp_reward, order_index, story_json)
         VALUES (?, ?, 'reading', ?, ?, 25, 3, ?)
         ON CONFLICT(level_id, activity_type) DO NOTHING`,
        [
          levelId,
          languageId,
          `Membaca: ${lvData.storyTitle}`,
          'Bacalah kisah singkat petualangan Tara di Kampung Nusantara. Klik kosakata yang disorot untuk melihat arti & pelafalannya, lalu jawab pertanyaan pemahaman.',
          JSON.stringify(storyPayload),
        ]
      );
      const readAct = await queryOne(
        "SELECT id FROM game_activities WHERE level_id = ? AND activity_type = 'reading'",
        [levelId]
      );
      const readExists = await queryOne('SELECT COUNT(*) AS cnt FROM questions WHERE activity_id = ?', [readAct.id]);
      if (Number(readExists?.cnt || 0) === 0) {
        const opts1 = shuffleDeterministic(lvData.readingOptions, bp.level_number + 2);
        await execute(
          `INSERT INTO questions
            (activity_id, level_id, language_id, question_type, prompt, regional_text, pronunciation_guide, options_json, correct_answer, accepted_answers_json, explanation, difficulty, order_index)
           VALUES (?, ?, ?, 'reading_mcq', ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
          [
            readAct.id,
            levelId,
            languageId,
            lvData.readingQuestion,
            lvData.storyTitle,
            '',
            JSON.stringify(opts1),
            lvData.readingAnswer,
            JSON.stringify([lvData.readingAnswer]),
            lvData.readingExplanation,
            difficulty,
          ]
        );

        // Second comprehension question testing another highlighted vocab
        const targetV = v4 || v0;
        const dist2 = allWords.filter((w) => w !== targetV.word).slice(0, 3);
        const opts2 = shuffleDeterministic([targetV.word, ...dist2], bp.level_number + 5);
        await execute(
          `INSERT INTO questions
            (activity_id, level_id, language_id, question_type, prompt, regional_text, pronunciation_guide, options_json, correct_answer, accepted_answers_json, explanation, difficulty, order_index)
           VALUES (?, ?, ?, 'reading_mcq', ?, ?, ?, ?, ?, ?, ?, ?, 2)`,
          [
            readAct.id,
            levelId,
            languageId,
            `Berdasarkan modul & bacaan, manakah kosakata ${langName} yang berarti "${targetV.meaning}"?`,
            targetV.meaning,
            targetV.pron,
            JSON.stringify(opts2),
            targetV.word,
            JSON.stringify([targetV.word]),
            `"${targetV.word}" (/${targetV.pron}/) berarti "${targetV.meaning}".`,
            difficulty,
          ]
        );
      }

      // D. WRITING (Word Arrangement + Translation Input)
      await execute(
        `INSERT INTO game_activities (level_id, language_id, activity_type, title, instructions, xp_reward, order_index)
         VALUES (?, ?, 'writing', ?, ?, 25, 4)
         ON CONFLICT(level_id, activity_type) DO NOTHING`,
        [
          levelId,
          languageId,
          `Menulis: Susun & Terjemahkan Kalimat`,
          'Susun potongan kata menjadi kalimat daerah yang tepat dan lengkapi terjemahan singkat.',
        ]
      );
      const writeAct = await queryOne(
        "SELECT id FROM game_activities WHERE level_id = ? AND activity_type = 'writing'",
        [levelId]
      );
      const writeExists = await queryOne('SELECT COUNT(*) AS cnt FROM questions WHERE activity_id = ?', [writeAct.id]);
      if (Number(writeExists?.cnt || 0) === 0) {
        // Question 1: Word Arrangement from example sentence
        const arrangeItem = v0.ex.split(/\s+/).length >= 3 ? v0 : v5 || v1;
        const cleanTokens = arrangeItem.ex.replace(/[.,!?]/g, '').split(/\s+/).filter(Boolean);
        const shuffledTokens = shuffleDeterministic(cleanTokens, bp.level_number + 3);
        await execute(
          `INSERT INTO questions
            (activity_id, level_id, language_id, question_type, prompt, regional_text, pronunciation_guide, options_json, correct_answer, accepted_answers_json, explanation, difficulty, order_index)
           VALUES (?, ?, ?, 'writing_arrange', ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
          [
            writeAct.id,
            levelId,
            languageId,
            `Susun kata-kata ${langName} berikut agar bermakna: "${arrangeItem.exTr}"`,
            arrangeItem.exTr,
            arrangeItem.pron,
            JSON.stringify(shuffledTokens),
            cleanTokens.join(' '),
            JSON.stringify([cleanTokens.join(' '), arrangeItem.ex]),
            `Susunan yang benar adalah "${arrangeItem.ex}" yang berarti "${arrangeItem.exTr}".`,
            difficulty,
          ]
        );

        // Question 2: Translation typing exercise
        const typeItem = v5 || v1;
        const normalizedTarget = typeItem.word.replace(/[?!.,]/g, '').trim();
        await execute(
          `INSERT INTO questions
            (activity_id, level_id, language_id, question_type, prompt, regional_text, pronunciation_guide, options_json, correct_answer, accepted_answers_json, explanation, difficulty, order_index)
           VALUES (?, ?, ?, 'writing_translate', ?, ?, ?, ?, ?, ?, ?, ?, 2)`,
          [
            writeAct.id,
            levelId,
            languageId,
            `Ketik ungkapan ${langName} untuk: "${typeItem.meaning}"`,
            typeItem.meaning,
            typeItem.pron,
            JSON.stringify([typeItem.word.split(' ')[0]]),
            typeItem.word,
            JSON.stringify([typeItem.word, normalizedTarget]),
            `Ungkapan yang tepat adalah "${typeItem.word}" (/${typeItem.pron}/).`,
            difficulty,
          ]
        );
      }
    }
  }

  // 4. Seed Achievements
  for (const ach of ACHIEVEMENTS_SEED) {
    await execute(
      `INSERT INTO achievements (code, title, description, icon, badge_color, requirement_type, requirement_value, xp_bonus)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(code) DO NOTHING`,
      [ach.code, ach.title, ach.description, ach.icon, ach.badge_color, ach.requirement_type, ach.requirement_value, ach.xp_bonus]
    );
  }

  // 5. Seed Daily Regional Phrases
  for (const dp of DAILY_PHRASES_SEED) {
    const languageId = languageMap.get(dp.language_name);
    const provinceId = provinceMap.get(dp.province_code);
    if (!languageId || !provinceId) continue;
    await execute(
      `INSERT INTO daily_phrases
        (language_id, province_id, phrase_date, regional_phrase, indonesian_meaning, pronunciation, cultural_context, example_dialogue_json, source_metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(language_id, regional_phrase) DO NOTHING`,
      [
        languageId,
        provinceId,
        dp.phrase_date,
        dp.regional_phrase,
        dp.indonesian_meaning,
        dp.pronunciation,
        dp.cultural_context,
        JSON.stringify(dp.example_dialogue),
        dp.source_metadata,
      ]
    );
  }

  await syncVerifiedDictionaries({ silent });

  if (!silent) console.log('LOGATARA database seeded successfully!');
}

// Allow running directly via `npm run db:seed`
if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  initDatabase()
    .then(() => seedDatabase())
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seed failed:', err);
      process.exit(1);
    });
}
