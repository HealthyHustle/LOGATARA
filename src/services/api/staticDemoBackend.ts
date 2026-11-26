// Persistent Browser-Side Engine for Static Hosting (GitHub Pages)
// Automatically mirrors the Express + SQLite backend using the exact same verified datasets
// and persists users, sessions, progression, XP, stars, achievements, saved items, and chat in localStorage.

import { PROVINCES, REGIONAL_LANGUAGES } from '../../../backend/database/data/provincesAndLanguages.js';
import { LEVEL_BLUEPRINT, VERIFIED_LANGUAGE_PACKS } from '../../../backend/database/data/curriculumData.js';
import {
  VERIFIED_LANGUAGE_PACKS_PART2,
  ACHIEVEMENTS_SEED,
  DAILY_PHRASES_SEED,
} from '../../../backend/database/data/curriculumDataExtra.js';
import { VERIFIED_DICT_WEST } from '../../../backend/database/data/verifiedDictWest.js';
import { VERIFIED_DICT_EAST } from '../../../backend/database/data/verifiedDictEast.js';
import { buildSmartLocalChatReply } from '../../../backend/services/localChatEngine.js';
import { assetUrl } from '../../utils/assets';

const STORAGE_KEY = 'logatara_static_store_v1';

const ALL_PACKS: Record<string, any> = {
  ...VERIFIED_LANGUAGE_PACKS,
  ...VERIFIED_LANGUAGE_PACKS_PART2,
};

const ALL_EXTENDED_DICTS: Record<string, { source: string; entries: any[][] }> = {
  ...VERIFIED_DICT_WEST,
  ...VERIFIED_DICT_EAST,
};

const VILLAGE_LOCATIONS = [
  { id: 'balai-desa', name: 'Balai Desa', levelNumber: 1, subtitle: 'Salam dan Sapaan', x: 20, y: 44, description: 'Tempat warga berkumpul dan menyambut tamu dengan salam penuh sopan santun.' },
  { id: 'rumah-batik', name: 'Rumah Batik', levelNumber: 2, subtitle: 'Kenalan dengan Warga', x: 28, y: 72, description: 'Jemuran batik Mega Mendung warna-warni tempat berkenalan dengan pengrajin kampung.' },
  { id: 'pasar-tradisional', name: 'Pasar Tradisional', levelNumber: 4, subtitle: 'Belanja & Tawar-menawar', x: 74, y: 71, description: 'Pasar ramah di tepi sungai tempat belajar menanyakan harga dan hasil bumi lokal.' },
  { id: 'sawah', name: 'Sawah', levelNumber: 5, subtitle: 'Cerita & Alam Lokal', x: 79, y: 33, description: 'Sawah terasering hijau bertingkat tempat belajar falsafah gotong royong dan cerita rakyat.' },
  { id: 'rumah-adat', name: 'Rumah Adat', levelNumber: 6, subtitle: 'Tradisi & Sejarah', x: 36, y: 32, description: 'Joglo dan Tongkonan megah yang menyimpan kisah sejarah leluhur Nusantara.' },
  { id: 'sanggar-budaya', name: 'Sanggar Budaya', levelNumber: 3, subtitle: 'Percakapan & Seni', x: 52, y: 50, description: 'Halaman beringin dan pendopo seni tempat warga berbincang santai dan berlatih musik.' },
  { id: 'perpustakaan-nusantara', name: 'Perpustakaan Nusantara', levelNumber: 7, subtitle: 'Master Bahasa Daerah', x: 55, y: 13, description: 'Puncak Kampung Nusantara tempat tersimpannya naskah, kamus, dan gelar Penjaga Bahasa.' },
];

function shuffleDeterministic<T>(arr: T[], seed = 1): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = (i * 7 + seed * 3) % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function normalizeStr(str: string) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[?!.,'’"“”()\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function expandIdSynonyms(normalized: string) {
  const variants = [normalized];
  const rules: Array<[RegExp, string]> = [
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
  for (const [rx, rep] of rules) {
    if (rx.test(normalized)) {
      variants.push(normalized.replace(rx, rep).replace(/\s+/g, ' ').trim());
    }
  }
  return [...new Set(variants)];
}

async function sha256Hex(text: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const data = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  return btoa(unescape(encodeURIComponent(text)));
}

// Build static read-only catalog once in memory
let catalogCache: any = null;
function getCatalog() {
  if (catalogCache) return catalogCache;

  const provinces = PROVINCES.map((p, idx) => ({
    id: idx + 1,
    ...p,
    illustration_asset: assetUrl('/assets/environments/kampung-nusantara.png'),
  }));
  const provByCode = new Map(provinces.map((p) => [p.province_code, p]));

  const languages = REGIONAL_LANGUAGES.map((l, idx) => {
    const prov = provByCode.get(l.province_code)!;
    const ext = ALL_EXTENDED_DICTS[l.language_name];
    return {
      id: idx + 1,
      language_name: l.language_name,
      province_id: prov.id,
      province_name: prov.province_name,
      province_code: prov.province_code,
      island_group: prov.island_group,
      alternative_names: l.alternative_names,
      language_description: l.language_description,
      pronunciation_information: l.pronunciation_information,
      verification_status: (ext || l.has_full_curriculum ? 'verified' : l.verification_status) as 'verified' | 'needs_verification',
      source_metadata: ext ? ext.source : l.source_metadata,
      has_full_curriculum: Boolean(l.has_full_curriculum),
    };
  });
  const langByName = new Map(languages.map((l) => [l.language_name, l]));

  const vocabulary: any[] = [];
  const levels: any[] = [];
  const modules = new Map<number, any>();
  const activitiesByLevel = new Map<number, any[]>();

  let vocabId = 1;
  let levelId = 1;
  let activityId = 1;
  let questionId = 1;

  for (const [langName, pack] of Object.entries(ALL_PACKS)) {
    const lang = langByName.get(langName);
    if (!lang) continue;

    for (const bp of LEVEL_BLUEPRINT) {
      const lvData = pack.levels[bp.level_number];
      if (!lvData) continue;

      for (const v of lvData.vocab) {
        if (!vocabulary.some((e) => e.language_id === lang.id && e.regional_word === v.word)) {
          vocabulary.push({
            id: vocabId++,
            language_id: lang.id,
            language_name: lang.language_name,
            province_name: lang.province_name,
            regional_word: v.word,
            indonesian_meaning: v.meaning,
            pronunciation: v.pron,
            example_sentence: v.ex,
            example_translation: v.exTr,
            category: bp.title.toLowerCase(),
            register_level: v.register || 'Umum',
            verification_status: 'verified',
            source_metadata: pack.source,
          });
        }
      }

      const lv = {
        id: levelId++,
        language_id: lang.id,
        language_name: lang.language_name,
        province_name: lang.province_name,
        ...bp,
      };
      levels.push(lv);

      modules.set(lv.id, {
        id: lv.id,
        level_id: lv.id,
        title: `Modul ${bp.level_number}: ${bp.title} (${langName})`,
        summary: bp.description,
        vocabulary: lvData.vocab,
        expressions: lvData.vocab.slice(0, 4).map((v: any) => ({
          regional: v.ex,
          indonesian: v.exTr,
          pronunciation: v.pron,
          register: v.register || 'Umum',
        })),
        cultural_context: lvData.culturalContext,
        pronunciation_notes: lvData.pronunciationNotes,
        source_metadata: pack.source,
      });

      const [v0, v1, v2, v3, v4, v5] = lvData.vocab;
      const allMeanings = lvData.vocab.map((v: any) => v.meaning);
      const allWords = lvData.vocab.map((v: any) => v.word);
      const diff = bp.level_number <= 2 ? 'pemula' : bp.level_number <= 5 ? 'menengah' : 'mahir';

      const speakActId = activityId++;
      const listenActId = activityId++;
      const readActId = activityId++;
      const writeActId = activityId++;

      const arrangeItem = v0.ex.split(/\s+/).length >= 3 ? v0 : v5 || v1;
      const cleanTokens = arrangeItem.ex.replace(/[.,!?]/g, '').split(/\s+/).filter(Boolean);
      const typeItem = v5 || v1;
      const targetV = v4 || v0;

      const acts = [
        {
          id: speakActId,
          activity_type: 'speaking',
          title: `Berbicara: Ucapkan Frasa ${bp.title}`,
          instructions: 'Dengarkan contoh pelafalan, rekam suaramu, lalu bandingkan dengan panduan pelafalan baku.',
          xp_reward: 25,
          order_index: 1,
          story: null,
          questions: [v0, v1].map((item: any, idx: number) => ({
            id: questionId++,
            activity_id: speakActId,
            question_type: 'speaking_phrase',
            prompt: `Ucapkan ungkapan untuk "${item.meaning}" dalam ${langName}:`,
            regional_text: item.word,
            pronunciation_guide: item.pron,
            options: [],
            correct_answer: item.word,
            accepted_answers: [item.word],
            explanation: `"${item.word}" dibaca /${item.pron}/ dan berarti "${item.meaning}".`,
            difficulty: diff,
            order_index: idx + 1,
          })),
        },
        {
          id: listenActId,
          activity_type: 'listening',
          title: 'Mendengarkan: Pahami Ucapan Warga',
          instructions: 'Putar audio frasa daerah berikut, lalu pilih arti Bahasa Indonesia yang paling tepat.',
          xp_reward: 25,
          order_index: 2,
          story: null,
          questions: [v2, v3].map((item: any, idx: number) => ({
            id: questionId++,
            activity_id: listenActId,
            question_type: 'listening_mcq',
            prompt: `Dengarkan audio ${langName} ini. Apa artinya dalam Bahasa Indonesia?`,
            regional_text: item.word,
            pronunciation_guide: item.pron,
            options: shuffleDeterministic(
              [item.meaning, ...allMeanings.filter((m: string) => m !== item.meaning).slice(0, 3)],
              bp.level_number + idx + 1
            ),
            correct_answer: item.meaning,
            accepted_answers: [item.meaning],
            explanation: `Frasa "${item.word}" (/${item.pron}/) berarti "${item.meaning}".`,
            difficulty: diff,
            order_index: idx + 1,
          })),
        },
        {
          id: readActId,
          activity_type: 'reading',
          title: `Membaca: ${lvData.storyTitle}`,
          instructions: 'Bacalah kisah singkat petualangan Tara dan klik kosakata yang disorot untuk melihat artinya.',
          xp_reward: 25,
          order_index: 3,
          story: {
            title: lvData.storyTitle,
            location: bp.location_name,
            paragraphs: lvData.storyParagraphs,
            culturalNote: lvData.culturalContext,
            highlights: lvData.vocab.map((v: any) => ({ word: v.word, meaning: v.meaning, pronunciation: v.pron })),
          },
          questions: [
            {
              id: questionId++,
              activity_id: readActId,
              question_type: 'reading_mcq',
              prompt: lvData.readingQuestion,
              regional_text: lvData.storyTitle,
              pronunciation_guide: '',
              options: shuffleDeterministic(lvData.readingOptions, bp.level_number + 2),
              correct_answer: lvData.readingAnswer,
              accepted_answers: [lvData.readingAnswer],
              explanation: lvData.readingExplanation,
              difficulty: diff,
              order_index: 1,
            },
            {
              id: questionId++,
              activity_id: readActId,
              question_type: 'reading_mcq',
              prompt: `Berdasarkan modul & bacaan, manakah kosakata ${langName} yang berarti "${targetV.meaning}"?`,
              regional_text: targetV.meaning,
              pronunciation_guide: targetV.pron,
              options: shuffleDeterministic(
                [targetV.word, ...allWords.filter((w: string) => w !== targetV.word).slice(0, 3)],
                bp.level_number + 5
              ),
              correct_answer: targetV.word,
              accepted_answers: [targetV.word],
              explanation: `"${targetV.word}" (/${targetV.pron}/) berarti "${targetV.meaning}".`,
              difficulty: diff,
              order_index: 2,
            },
          ],
        },
        {
          id: writeActId,
          activity_type: 'writing',
          title: 'Menulis: Susun & Terjemahkan Kalimat',
          instructions: 'Susun potongan kata menjadi kalimat daerah yang tepat dan lengkapi terjemahan singkat.',
          xp_reward: 25,
          order_index: 4,
          story: null,
          questions: [
            {
              id: questionId++,
              activity_id: writeActId,
              question_type: 'writing_arrange',
              prompt: `Susun kata-kata ${langName} berikut agar bermakna: "${arrangeItem.exTr}"`,
              regional_text: arrangeItem.exTr,
              pronunciation_guide: arrangeItem.pron,
              options: shuffleDeterministic(cleanTokens, bp.level_number + 3),
              correct_answer: cleanTokens.join(' '),
              accepted_answers: [cleanTokens.join(' '), arrangeItem.ex],
              explanation: `Susunan yang benar adalah "${arrangeItem.ex}" (${arrangeItem.exTr}).`,
              difficulty: diff,
              order_index: 1,
            },
            {
              id: questionId++,
              activity_id: writeActId,
              question_type: 'writing_translate',
              prompt: `Ketik ungkapan ${langName} untuk: "${typeItem.meaning}"`,
              regional_text: typeItem.meaning,
              pronunciation_guide: typeItem.pron,
              options: [typeItem.word.split(' ')[0]],
              correct_answer: typeItem.word,
              accepted_answers: [typeItem.word, typeItem.word.replace(/[?!.,]/g, '').trim()],
              explanation: `Ungkapan yang tepat adalah "${typeItem.word}" (/${typeItem.pron}/).`,
              difficulty: diff,
              order_index: 2,
            },
          ],
        },
      ];
      activitiesByLevel.set(lv.id, acts);
    }
  }

  // Extended verified dictionaries for all 70 additional regional languages
  for (const [langName, pack] of Object.entries(ALL_EXTENDED_DICTS)) {
    const lang = langByName.get(langName);
    if (!lang) continue;
    for (const [word, meaning, pron, ex, exTr, reg] of pack.entries) {
      if (!vocabulary.some((e) => e.language_id === lang.id && e.regional_word === word)) {
        vocabulary.push({
          id: vocabId++,
          language_id: lang.id,
          language_name: lang.language_name,
          province_name: lang.province_name,
          regional_word: word,
          indonesian_meaning: meaning,
          pronunciation: pron,
          example_sentence: ex,
          example_translation: exTr,
          category: 'dasar',
          register_level: reg || 'Umum',
          verification_status: 'verified',
          source_metadata: pack.source,
        });
      }
    }
  }

  const vocabCountByLang = new Map<number, number>();
  for (const v of vocabulary) {
    vocabCountByLang.set(v.language_id, (vocabCountByLang.get(v.language_id) || 0) + 1);
  }
  const languagesWithCounts = languages.map((l) => ({
    ...l,
    vocab_count: vocabCountByLang.get(l.id) || 0,
  }));

  const achievements = ACHIEVEMENTS_SEED.map((a, i) => ({ id: i + 1, ...a }));
  const dailyPhrases = DAILY_PHRASES_SEED.map((dp, i) => {
    const lang = langByName.get(dp.language_name);
    const prov = provByCode.get(dp.province_code);
    return {
      id: i + 1,
      language_id: lang?.id || 1,
      province_id: prov?.id || 1,
      language_name: dp.language_name,
      province_name: prov?.province_name || '',
      island_group: prov?.island_group || '',
      phrase_date: dp.phrase_date,
      regional_phrase: dp.regional_phrase,
      indonesian_meaning: dp.indonesian_meaning,
      pronunciation: dp.pronunciation,
      cultural_context: dp.cultural_context,
      example_dialogue: dp.example_dialogue,
      source_metadata: dp.source_metadata,
    };
  });

  catalogCache = {
    provinces,
    languages: languagesWithCounts,
    vocabulary,
    levels,
    modules,
    activitiesByLevel,
    achievements,
    dailyPhrases,
  };
  return catalogCache;
}

interface StaticStore {
  users: any[];
  currentUserId: number | null;
  progress: Record<string, any>; // key: `${userId}_${levelId}`
  xpTx: any[];
  userAchievements: Array<{ userId: number; achievementId: number; unlocked_at: string }>;
  savedVocab: any[];
  savedPhrases: Array<{ id: number; userId: number; dailyPhraseId: number; created_at: string }>;
  chatMessages: any[];
  nextId: number;
}

function loadStore(): StaticStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // fallback
  }
  return {
    users: [],
    currentUserId: null,
    progress: {},
    xpTx: [],
    userAchievements: [],
    savedVocab: [],
    savedPhrases: [],
    chatMessages: [],
    nextId: 1,
  };
}

function saveStore(store: StaticStore) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // ignore quota issues
  }
}

function makeError(message: string, status = 400, data?: any) {
  const err: any = new Error(message);
  err.status = status;
  err.data = data;
  return err;
}

function getAuthUser(store: StaticStore) {
  if (!store.currentUserId) throw makeError('Sesi tidak ditemukan. Silakan masuk terlebih dahulu.', 401);
  const user = store.users.find((u) => u.id === store.currentUserId);
  if (!user) throw makeError('Akun tidak ditemukan.', 401);
  return user;
}

function ensureProgressForLang(store: StaticStore, userId: number, languageId: number) {
  const cat = getCatalog();
  const langLevels = cat.levels.filter((l: any) => l.language_id === languageId);
  for (const lv of langLevels) {
    const key = `${userId}_${lv.id}`;
    if (!store.progress[key]) {
      store.progress[key] = {
        user_id: userId,
        language_id: languageId,
        level_id: lv.id,
        status: lv.level_number === 1 ? 'available' : 'locked',
        module_completed: false,
        speaking_completed: false,
        listening_completed: false,
        reading_completed: false,
        writing_completed: false,
        stars_earned: 0,
        xp_earned: 0,
        completed_at: null,
      };
    }
  }
}

function awardOnce(store: StaticStore, user: any, sourceType: string, sourceKey: string, xp: number, stars: number, desc: string) {
  if (store.xpTx.some((t) => t.user_id === user.id && t.source_type === sourceType && t.source_key === sourceKey)) {
    return { awarded: false, xpAwarded: 0, starsAwarded: 0 };
  }
  store.xpTx.unshift({
    id: store.nextId++,
    user_id: user.id,
    source_type: sourceType,
    source_key: sourceKey,
    xp_amount: xp,
    stars_amount: stars,
    description: desc,
    created_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
  });
  user.total_xp = (user.total_xp || 0) + xp;
  user.total_stars = (user.total_stars || 0) + stars;
  return { awarded: true, xpAwarded: xp, starsAwarded: stars };
}

function evaluateBadges(store: StaticStore, user: any) {
  const cat = getCatalog();
  const owned = new Set(store.userAchievements.filter((a) => a.userId === user.id).map((a) => a.achievementId));
  const userProg = Object.values(store.progress).filter((p: any) => p.user_id === user.id);
  const metrics: Record<string, number> = {
    levels_completed: userProg.filter((p: any) => p.status === 'completed').length,
    speaking_completed: userProg.filter((p: any) => p.speaking_completed).length,
    listening_completed: userProg.filter((p: any) => p.listening_completed).length,
    saved_items:
      store.savedVocab.filter((v) => v.user_id === user.id).length +
      store.savedPhrases.filter((p) => p.userId === user.id).length,
  };

  const unlocked: any[] = [];
  for (const ach of cat.achievements) {
    if (owned.has(ach.id)) continue;
    if ((metrics[ach.requirement_type] || 0) >= ach.requirement_value) {
      store.userAchievements.push({
        userId: user.id,
        achievementId: ach.id,
        unlocked_at: new Date().toISOString(),
      });
      if (ach.xp_bonus > 0) {
        awardOnce(store, user, 'achievement', ach.code, ach.xp_bonus, 0, `Lencana terbuka: ${ach.title}`);
      }
      unlocked.push(ach);
    }
  }
  return unlocked;
}

export async function handleStaticApiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const cat = getCatalog();
  const store = loadStore();
  const method = (options.method || 'GET').toUpperCase();
  const urlObj = new URL(endpoint, 'https://logatara.local');
  const pathname = urlObj.pathname;
  const query = urlObj.searchParams;
  const body = options.body ? JSON.parse(String(options.body)) : {};

  // === AUTH ===
  if (pathname === '/auth/register' && method === 'POST') {
    const fullName = String(body.fullName || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (fullName.length < 2) throw makeError('Nama lengkap minimal terdiri dari 2 karakter.', 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw makeError('Masukkan alamat email yang valid.', 400);
    if (password.length < 8) throw makeError('Kata sandi minimal harus 8 karakter.', 400);
    if (store.users.some((u) => u.email === email)) throw makeError('Email tersebut sudah terdaftar. Silakan masuk.', 409);

    const passwordHash = await sha256Hex(`${email}:${password}`);
    const defaultLang = cat.languages.find((l: any) => l.has_full_curriculum);
    const newUser = {
      id: store.nextId++,
      email,
      password_hash: passwordHash,
      full_name: fullName,
      avatar_url: assetUrl('/assets/characters/tara.png'),
      current_language_id: defaultLang?.id || 1,
      current_level_number: 1,
      total_xp: 0,
      total_stars: 0,
      daily_streak: 1,
      onboarding_completed: false,
      pending_walk_from: null,
      pending_walk_to: null,
      bio: 'Penjelajah bahasa dan budaya Nusantara',
      known_language_ids: [] as number[],
      learning_language_ids: [] as number[],
    };
    store.users.push(newUser);
    store.currentUserId = newUser.id;
    saveStore(store);
    return { message: 'Pendaftaran berhasil!', token: `static_${newUser.id}`, user: newUser } as T;
  }

  if (pathname === '/auth/login' && method === 'POST') {
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const hash = await sha256Hex(`${email}:${password}`);
    const user = store.users.find((u) => u.email === email && u.password_hash === hash);
    if (!user) throw makeError('Email atau kata sandi salah. Periksa kembali dan coba lagi.', 401);
    store.currentUserId = user.id;
    saveStore(store);
    return { message: 'Berhasil masuk!', token: `static_${user.id}`, user } as T;
  }

  if (pathname === '/auth/logout' && method === 'POST') {
    store.currentUserId = null;
    saveStore(store);
    return { message: 'Berhasil keluar.' } as T;
  }

  if (pathname === '/auth/me' && method === 'GET') {
    const user = getAuthUser(store);
    const current_language = cat.languages.find((l: any) => l.id === user.current_language_id) || null;
    return { user: { ...user, current_language } } as T;
  }

  // === PROVINCES & LANGUAGES ===
  if (pathname === '/provinces' && method === 'GET') {
    const q = (query.get('q') || '').trim().toLowerCase();
    const island = (query.get('island') || '').trim();
    let result = cat.provinces.map((p: any) => ({
      ...p,
      languages: cat.languages.filter((l: any) => l.province_id === p.id),
    }));
    if (island && island !== 'Semua') result = result.filter((p: any) => p.island_group === island);
    if (q) {
      result = result.filter(
        (p: any) =>
          p.province_name.toLowerCase().includes(q) ||
          p.cultural_information.toLowerCase().includes(q) ||
          p.languages.some((l: any) => l.language_name.toLowerCase().includes(q))
      );
    }
    return { totalProvinces: cat.provinces.length, totalLanguages: cat.languages.length, provinces: result } as T;
  }

  if (pathname === '/languages' && method === 'GET') {
    const q = (query.get('q') || '').trim().toLowerCase();
    let list = [...cat.languages];
    if (q) {
      list = list.filter(
        (l: any) =>
          l.language_name.toLowerCase().includes(q) ||
          l.province_name.toLowerCase().includes(q) ||
          (l.alternative_names || '').toLowerCase().includes(q)
      );
    }
    return { languages: list } as T;
  }

  // === ONBOARDING & PROFILE UPDATES ===
  if (pathname === '/onboarding' && method === 'POST') {
    const user = getAuthUser(store);
    const targetId = Number(body.targetLanguageId);
    if (!targetId) throw makeError('Pilih satu bahasa daerah yang ingin kamu pelajari.', 400);
    user.known_language_ids = Array.isArray(body.knownLanguageIds) ? body.knownLanguageIds.map(Number) : [];
    user.learning_language_ids = [...new Set([...(user.learning_language_ids || []), targetId])];
    user.current_language_id = targetId;
    user.onboarding_completed = true;
    ensureProgressForLang(store, user.id, targetId);
    saveStore(store);
    return { message: 'Preferensi bahasa berhasil disimpan!', currentLanguageId: targetId } as T;
  }

  if (pathname === '/profile/active-language' && method === 'PUT') {
    const user = getAuthUser(store);
    const langId = Number(body.languageId);
    const lang = cat.languages.find((l: any) => l.id === langId);
    if (!lang) throw makeError('Bahasa tidak ditemukan.', 404);
    user.current_language_id = langId;
    user.learning_language_ids = [...new Set([...(user.learning_language_ids || []), langId])];
    ensureProgressForLang(store, user.id, langId);
    const langLevels = cat.levels.filter((l: any) => l.language_id === langId);
    let maxLv = 1;
    for (const lv of langLevels) {
      const p = store.progress[`${user.id}_${lv.id}`];
      if (p && p.status !== 'locked') maxLv = Math.max(maxLv, lv.level_number);
    }
    user.current_level_number = maxLv;
    user.pending_walk_from = null;
    user.pending_walk_to = null;
    saveStore(store);
    return { message: `Bahasa belajar aktif diubah ke ${lang.language_name}.`, language: lang } as T;
  }

  if (pathname === '/profile' && method === 'PUT') {
    const user = getAuthUser(store);
    if (body.fullName) user.full_name = String(body.fullName).trim();
    if (body.bio !== undefined) user.bio = String(body.bio).trim() || 'Penjelajah bahasa dan budaya Nusantara';
    if (body.avatarUrl !== undefined && String(body.avatarUrl).trim()) {
      const av = String(body.avatarUrl).trim();
      if (av.length > 450_000) throw makeError('Ukuran foto terlalu besar. Pilih gambar yang lebih kecil.', 400);
      user.avatar_url = av;
    }
    if (Array.isArray(body.knownLanguageIds)) {
      user.known_language_ids = [...new Set(body.knownLanguageIds.map(Number).filter(Boolean))];
    }
    if (body.targetLanguageId) {
      const lid = Number(body.targetLanguageId);
      user.current_language_id = lid;
      user.learning_language_ids = [...new Set([...(user.learning_language_ids || []), lid])];
      ensureProgressForLang(store, user.id, lid);
    }
    saveStore(store);
    return { message: 'Profil berhasil diperbarui.' } as T;
  }

  // === DASHBOARD ===
  if (pathname === '/dashboard' && method === 'GET') {
    const user = getAuthUser(store);
    const activeLanguage =
      cat.languages.find((l: any) => l.id === user.current_language_id) ||
      cat.languages.find((l: any) => l.has_full_curriculum);
    if (activeLanguage?.has_full_curriculum) ensureProgressForLang(store, user.id, activeLanguage.id);
    saveStore(store);

    const levels = cat.levels
      .filter((l: any) => l.language_id === activeLanguage?.id)
      .map((l: any) => ({ ...l, ...(store.progress[`${user.id}_${l.id}`] || { status: l.level_number === 1 ? 'available' : 'locked' }) }));
    const completedCount = levels.filter((l: any) => l.status === 'completed').length;
    const nextLevel =
      levels.find((l: any) => l.status === 'in_progress') ||
      levels.find((l: any) => l.status === 'available') ||
      levels[levels.length - 1] ||
      null;

    const savedPhraseIds = new Set(store.savedPhrases.filter((s) => s.userId === user.id).map((s) => s.dailyPhraseId));
    const dp = cat.dailyPhrases.find((d: any) => d.language_id === activeLanguage?.id) || cat.dailyPhrases[0];
    const levelByNum = new Map(levels.map((l: any) => [l.level_number, l]));
    const todayPrefix = new Date().toISOString().slice(0, 10);
    const todayTx = store.xpTx.filter((t) => t.user_id === user.id && String(t.created_at).startsWith(todayPrefix));

    const ownedAch = store.userAchievements
      .filter((ua) => ua.userId === user.id)
      .map((ua) => ({ ...cat.achievements.find((a: any) => a.id === ua.achievementId), unlocked_at: ua.unlocked_at }))
      .slice(-4)
      .reverse();

    const totalXp = Number(user.total_xp || 0);
    return {
      profile: {
        ...user,
        explorer_rank_level: Math.floor(totalXp / 150) + 1,
        xp_in_current_tier: totalXp % 150,
        xp_for_next_tier: 150,
      },
      activeLanguage,
      progressSummary: {
        completedLevels: completedCount,
        totalLevels: levels.length || 7,
        percent: levels.length ? Math.round((completedCount / levels.length) * 100) : 0,
        nextLevel,
      },
      dailyMission: {
        title: 'Misi Harian Penjelajah',
        description: 'Selesaikan 3 aktivitas belajar atau raih minimal 75 XP hari ini bersama Tara.',
        completedTasks: Math.min(3, todayTx.length),
        targetTasks: 3,
        xpToday: todayTx.reduce((s, t) => s + (t.xp_amount || 0), 0),
        targetXp: 75,
      },
      dailyPhrase: dp ? { ...dp, is_saved: savedPhraseIds.has(dp.id) } : null,
      recentAchievements: ownedAch,
      totalAchievementsCount: cat.achievements.length,
      locations: VILLAGE_LOCATIONS.map((loc) => {
        const lv: any = levelByNum.get(loc.levelNumber);
        return { ...loc, levelId: lv?.id || null, status: lv?.status || 'locked', starsEarned: lv?.stars_earned || 0 };
      }),
    } as T;
  }

  // === ADVENTURE MAP ===
  if (pathname === '/adventure/map' && method === 'GET') {
    const user = getAuthUser(store);
    const reqLangId = query.get('languageId') ? Number(query.get('languageId')) : user.current_language_id;
    const activeLanguage =
      cat.languages.find((l: any) => l.id === reqLangId) ||
      cat.languages.find((l: any) => l.has_full_curriculum);
    if (activeLanguage?.has_full_curriculum) ensureProgressForLang(store, user.id, activeLanguage.id);
    saveStore(store);

    const levels = cat.levels
      .filter((l: any) => l.language_id === activeLanguage?.id)
      .map((l: any) => ({ ...l, ...(store.progress[`${user.id}_${l.id}`] || { status: l.level_number === 1 ? 'available' : 'locked' }) }));

    let taraLv = 1;
    for (const lv of levels) {
      if (lv.status !== 'locked' && lv.level_number >= taraLv) taraLv = lv.level_number;
    }

    return {
      activeLanguage,
      verifiedLanguages: cat.languages
        .filter((l: any) => l.has_full_curriculum)
        .map((l: any) => ({ id: l.id, language_name: l.language_name, province_name: l.province_name })),
      taraPosition: {
        currentLevelNumber: taraLv,
        pendingWalkFrom: user.pending_walk_from || null,
        pendingWalkTo: user.pending_walk_to || null,
      },
      stats: { totalXp: user.total_xp || 0, totalStars: user.total_stars || 0, dailyStreak: user.daily_streak || 1 },
      levels,
    } as T;
  }

  if (pathname === '/adventure/walk-ack' && method === 'POST') {
    const user = getAuthUser(store);
    user.pending_walk_from = null;
    user.pending_walk_to = null;
    saveStore(store);
    return { ok: true } as T;
  }

  // === LEVEL ROUTES ===
  const lvDetailMatch = pathname.match(/^\/levels\/(\d+)$/);
  if (lvDetailMatch && method === 'GET') {
    const user = getAuthUser(store);
    const lvId = Number(lvDetailMatch[1]);
    const level = cat.levels.find((l: any) => l.id === lvId);
    if (!level) throw makeError('Level tidak ditemukan.', 404);
    ensureProgressForLang(store, user.id, level.language_id);
    const prog = store.progress[`${user.id}_${lvId}`];
    if (!prog || prog.status === 'locked') {
      throw makeError(`Level ${level.level_number} masih terkunci! Selesaikan Level ${level.level_number - 1} terlebih dahulu.`, 403, { locked: true });
    }
    if (prog.status === 'available') prog.status = 'in_progress';
    saveStore(store);
    const acts = (cat.activitiesByLevel.get(lvId) || []).map((a: any) => ({
      ...a,
      completed: Boolean(prog[`${a.activity_type}_completed`]),
    }));
    return { level, progress: prog, module: cat.modules.get(lvId) || null, activities: acts } as T;
  }

  const modDoneMatch = pathname.match(/^\/levels\/(\d+)\/module-complete$/);
  if (modDoneMatch && method === 'POST') {
    const user = getAuthUser(store);
    const lvId = Number(modDoneMatch[1]);
    const level = cat.levels.find((l: any) => l.id === lvId);
    const prog = store.progress[`${user.id}_${lvId}`];
    if (!level || !prog || prog.status === 'locked') throw makeError('Level masih terkunci.', 403);
    prog.module_completed = true;
    const reward = awardOnce(store, user, 'module', `level_${lvId}`, 20, 0, `Menyelesaikan Modul Belajar Level ${level.level_number}: ${level.title}`);
    saveStore(store);
    return {
      message: reward.awarded ? 'Modul belajar selesai! +20 XP ditambahkan.' : 'Modul belajar ditinjau ulang (XP sudah tercatat).',
      xpAwarded: reward.xpAwarded,
      alreadyAwarded: !reward.awarded,
    } as T;
  }

  const actSubmitMatch = pathname.match(/^\/levels\/(\d+)\/activities\/(speaking|listening|reading|writing)\/submit$/);
  if (actSubmitMatch && method === 'POST') {
    const user = getAuthUser(store);
    const lvId = Number(actSubmitMatch[1]);
    const actType = actSubmitMatch[2];
    const level = cat.levels.find((l: any) => l.id === lvId);
    const prog = store.progress[`${user.id}_${lvId}`];
    if (!level || !prog || prog.status === 'locked') throw makeError('Level masih terkunci.', 403);
    const act = (cat.activitiesByLevel.get(lvId) || []).find((a: any) => a.activity_type === actType);
    if (!act) throw makeError('Aktivitas tidak ditemukan.', 404);

    const subMap = new Map((body.answers || []).map((a: any) => [Number(a.questionId), a]));
    let correctCount = 0;
    const results = act.questions.map((q: any) => {
      const sub: any = subMap.get(q.id);
      const rawAns = String(sub?.answer || '').trim();
      const mode = String(sub?.evaluationMode || 'exact');
      let isCorrect = false;
      if (actType === 'speaking') {
        isCorrect = mode === 'self_practice_recorded' ? rawAns.length > 0 : normalizeStr(rawAns).length > 0;
      } else {
        const candidates = [q.correct_answer, ...(q.accepted_answers || [])].map(normalizeStr);
        isCorrect = candidates.includes(normalizeStr(rawAns));
      }
      if (isCorrect) correctCount++;
      return { questionId: q.id, submittedAnswer: rawAns, correctAnswer: q.correct_answer, isCorrect, explanation: q.explanation };
    });

    const scorePercent = Math.round((correctCount / act.questions.length) * 100);
    const passed = scorePercent >= 50;
    let reward = { awarded: false, xpAwarded: 0, starsAwarded: 0 };
    let newAchievements: any[] = [];
    if (passed) {
      prog[`${actType}_completed`] = true;
      reward = awardOnce(store, user, `activity_${actType}`, `level_${lvId}`, 25, 0, `Menyelesaikan aktivitas ${actType.toUpperCase()} Level ${level.level_number}`);
      newAchievements = evaluateBadges(store, user);
    }
    saveStore(store);
    return {
      passed,
      correctCount,
      totalQuestions: act.questions.length,
      scorePercent,
      results,
      xpAwarded: reward.xpAwarded,
      alreadyAwarded: passed && !reward.awarded,
      newAchievements,
      progress: prog,
      allActivitiesDone: Boolean(prog.speaking_completed && prog.listening_completed && prog.reading_completed && prog.writing_completed),
    } as T;
  }

  const lvCompMatch = pathname.match(/^\/levels\/(\d+)\/complete$/);
  if (lvCompMatch && method === 'POST') {
    const user = getAuthUser(store);
    const lvId = Number(lvCompMatch[1]);
    const level = cat.levels.find((l: any) => l.id === lvId);
    const prog = store.progress[`${user.id}_${lvId}`];
    if (!level || !prog || prog.status === 'locked') throw makeError('Level terkunci.', 403);
    if (!prog.speaking_completed || !prog.listening_completed || !prog.reading_completed || !prog.writing_completed) {
      throw makeError('Selesaikan seluruh 4 mode game terlebih dahulu.', 400);
    }
    const wasCompleted = prog.status === 'completed';
    const reward = awardOnce(store, user, 'level_complete', `level_${lvId}`, level.xp_reward || 100, level.star_reward || 3, `Menuntaskan Level ${level.level_number}: ${level.title}`);
    prog.status = 'completed';
    prog.module_completed = true;
    prog.stars_earned = Math.max(prog.stars_earned || 0, level.star_reward || 3);
    prog.xp_earned = prog.xp_earned || level.xp_reward || 100;
    prog.completed_at = prog.completed_at || new Date().toISOString();

    const nextLv = cat.levels.find((l: any) => l.language_id === level.language_id && l.level_number === level.level_number + 1);
    let unlockedNextLevel: number | null = null;
    if (nextLv) {
      ensureProgressForLang(store, user.id, level.language_id);
      const nextProg = store.progress[`${user.id}_${nextLv.id}`];
      if (nextProg.status === 'locked') nextProg.status = 'available';
      unlockedNextLevel = nextLv.level_number;
      user.current_level_number = Math.max(user.current_level_number || 1, nextLv.level_number);
      user.pending_walk_from = level.level_number;
      user.pending_walk_to = nextLv.level_number;
    }
    const newAchievements = evaluateBadges(store, user);
    saveStore(store);

    return {
      completed: true,
      replayMode: wasCompleted,
      levelNumber: level.level_number,
      unlockedNextLevel,
      walkFromLevel: unlockedNextLevel ? level.level_number : null,
      walkToLevel: unlockedNextLevel,
      xpAwarded: reward.xpAwarded,
      starsAwarded: reward.starsAwarded,
      newAchievements,
      celebrationTitle: unlockedNextLevel
        ? `Selamat! Level ${unlockedNextLevel} berhasil dibuka!`
        : 'Selamat! Kamu telah menamatkan Kampung Nusantara!',
      celebrationSubtitle: 'Petualanganmu di Kampung Nusantara berlanjut!',
      stats: user,
    } as T;
  }

  // === TRANSLATE & DICTIONARY ===
  if (pathname === '/translate' && method === 'POST') {
    getAuthUser(store);
    const text = String(body.text || '').trim();
    const languageId = Number(body.languageId);
    const direction = body.direction === 'regional-to-id' ? 'regional-to-id' : 'id-to-regional';
    const language = cat.languages.find((l: any) => l.id === languageId);
    if (!language) throw makeError('Bahasa daerah tidak ditemukan.', 404);

    const vocabList = cat.vocabulary.filter((v: any) => v.language_id === languageId);
    const cleaned = normalizeStr(text);
    const queryVariants = direction === 'id-to-regional' ? expandIdSynonyms(cleaned) : [cleaned];
    const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const hasWhole = (hay: string, ndl: string) => (ndl ? new RegExp(`(^|\\b)${esc(ndl)}(\\b|$)`, 'i').test(hay) : false);
    const getSides = (v: any) => {
      const raw = direction === 'id-to-regional' ? v.indonesian_meaning : v.regional_word;
      return [...new Set([normalizeStr(raw), ...raw.split('/').map(normalizeStr).filter(Boolean)])];
    };

    const exact = vocabList.filter((v: any) =>
      queryVariants.some((qv) => getSides(v).some((s) => s === qv || hasWhole(s, qv)))
    );
    if (exact.length > 0) {
      const p = exact[0];
      return {
        found: true,
        uncertain: false,
        sourceMode: 'verified_dictionary',
        language,
        translation: direction === 'id-to-regional' ? p.regional_word : p.indonesian_meaning,
        pronunciation: p.pronunciation,
        registerLevel: p.register_level,
        exampleSentence: p.example_sentence,
        exampleTranslation: p.example_translation,
        sourceMetadata: p.source_metadata,
        vocabularyId: p.id,
        matches: exact.slice(0, 6),
        wordBreakdown: [],
        message: 'Terjemahan ditemukan di kamus terverifikasi LOGATARA.',
      } as T;
    }

    // Multi-word composition
    const tokens = cleaned.split(/\s+/).filter(Boolean);
    if (tokens.length >= 2) {
      const breakdown: any[] = [];
      let i = 0;
      let matched = 0;
      while (i < tokens.length) {
        let foundEntry: any = null;
        let span = 0;
        for (let len = Math.min(3, tokens.length - i); len >= 1; len--) {
          const sl = tokens.slice(i, i + len).join(' ');
          const slVars = direction === 'id-to-regional' ? expandIdSynonyms(sl) : [sl];
          const hit = vocabList.find((v: any) => getSides(v).some((s) => slVars.includes(s)));
          if (hit) {
            foundEntry = hit;
            span = len;
            break;
          }
        }
        if (foundEntry) {
          const out = (direction === 'id-to-regional' ? foundEntry.regional_word : foundEntry.indonesian_meaning).split('/')[0].trim();
          breakdown.push({ source: tokens.slice(i, i + span).join(' '), translated: out, pronunciation: foundEntry.pronunciation, verified: true });
          matched += span;
          i += span;
        } else {
          breakdown.push({ source: tokens[i], translated: tokens[i], pronunciation: '', verified: false });
          i += 1;
        }
      }
      if (matched >= 2 || (matched >= 1 && matched / tokens.length >= 0.5)) {
        return {
          found: true,
          uncertain: matched < tokens.length,
          sourceMode: 'verified_dictionary_composed',
          language,
          translation: breakdown.map((b) => b.translated).join(' '),
          pronunciation: breakdown.filter((b) => b.pronunciation).map((b) => b.pronunciation).join(' • '),
          registerLevel: 'Komposisi Kamus',
          exampleSentence: '',
          exampleTranslation: '',
          sourceMetadata: language.source_metadata,
          matches: [],
          wordBreakdown: breakdown,
          message: 'Kalimat diterjemahkan kata-per-kata dari kamus terverifikasi LOGATARA.',
        } as T;
      }
    }

    return {
      found: false,
      uncertain: true,
      sourceMode: 'not_found',
      language,
      translation: null,
      matches: vocabList.slice(0, 6),
      wordBreakdown: [],
      message: `Frasa "${text}" belum tersedia di kamus terverifikasi ${language.language_name}. Coba pilih kosakata terverifikasi di bawah.`,
    } as T;
  }

  if (pathname === '/dictionary' && method === 'GET') {
    const user = getAuthUser(store);
    const langId = query.get('languageId') ? Number(query.get('languageId')) : null;
    const q = (query.get('q') || '').trim().toLowerCase();
    const savedKeys = new Set(store.savedVocab.filter((v) => v.user_id === user.id).map((v) => `${v.language_id}_${v.regional_word}`));
    let entries = cat.vocabulary;
    if (langId) entries = entries.filter((v: any) => v.language_id === langId);
    if (q) {
      entries = entries.filter(
        (v: any) =>
          v.regional_word.toLowerCase().includes(q) ||
          v.indonesian_meaning.toLowerCase().includes(q) ||
          v.language_name.toLowerCase().includes(q) ||
          v.province_name.toLowerCase().includes(q)
      );
    }
    return {
      entries: entries.slice(0, 200).map((e: any) => ({ ...e, is_saved: savedKeys.has(`${e.language_id}_${e.regional_word}`) })),
    } as T;
  }

  // === SAVED VOCAB ===
  if (pathname === '/saved-vocabulary' && method === 'POST') {
    const user = getAuthUser(store);
    const lang = cat.languages.find((l: any) => l.id === Number(body.languageId));
    if (!store.savedVocab.some((s) => s.user_id === user.id && s.language_id === Number(body.languageId) && s.regional_word === body.regionalWord)) {
      store.savedVocab.unshift({
        id: store.nextId++,
        user_id: user.id,
        language_id: Number(body.languageId),
        language_name: lang?.language_name || '',
        province_name: lang?.province_name || '',
        regional_word: body.regionalWord,
        indonesian_meaning: body.indonesianMeaning,
        pronunciation: body.pronunciation || '',
        notes: body.notes || '',
        created_at: new Date().toISOString(),
      });
    }
    const newAchievements = evaluateBadges(store, user);
    saveStore(store);
    return { message: 'Kosakata berhasil disimpan ke Kamus Saku!', newAchievements } as T;
  }

  const delVocabMatch = pathname.match(/^\/saved-vocabulary\/(\d+)$/);
  if (delVocabMatch && method === 'DELETE') {
    const user = getAuthUser(store);
    store.savedVocab = store.savedVocab.filter((s) => !(s.id === Number(delVocabMatch[1]) && s.user_id === user.id));
    saveStore(store);
    return { message: 'Kosakata dihapus.' } as T;
  }

  // === DAILY PHRASES ===
  if (pathname === '/daily-phrases' && method === 'GET') {
    const user = getAuthUser(store);
    const savedSet = new Set(store.savedPhrases.filter((s) => s.userId === user.id).map((s) => s.dailyPhraseId));
    const list = cat.dailyPhrases.map((p: any) => ({ ...p, is_saved: savedSet.has(p.id) }));
    return { todayPhrase: list[0] || null, history: list } as T;
  }

  const savePhraseMatch = pathname.match(/^\/daily-phrases\/(\d+)\/save$/);
  if (savePhraseMatch) {
    const user = getAuthUser(store);
    const pid = Number(savePhraseMatch[1]);
    if (method === 'POST') {
      if (!store.savedPhrases.some((s) => s.userId === user.id && s.dailyPhraseId === pid)) {
        store.savedPhrases.unshift({ id: store.nextId++, userId: user.id, dailyPhraseId: pid, created_at: new Date().toISOString() });
      }
      const newAchievements = evaluateBadges(store, user);
      saveStore(store);
      return { message: 'Frasa berhasil disimpan!', newAchievements } as T;
    }
    if (method === 'DELETE') {
      store.savedPhrases = store.savedPhrases.filter((s) => !(s.userId === user.id && s.dailyPhraseId === pid));
      saveStore(store);
      return { message: 'Frasa dihapus.' } as T;
    }
  }

  // === LOGATARA AI CHATBOT ===
  if (pathname === '/chat/history' && method === 'GET') {
    const user = getAuthUser(store);
    return {
      conversation: { id: user.id, title: 'LOGATARA AI' },
      messages: store.chatMessages.filter((m) => m.user_id === user.id),
      providerStatus: {
        configured: false,
        label: 'Mode Pengetahuan Lokal Terverifikasi (GitHub Pages Static Mode)',
      },
    } as T;
  }

  if (pathname === '/chat/history' && method === 'DELETE') {
    const user = getAuthUser(store);
    store.chatMessages = store.chatMessages.filter((m) => m.user_id !== user.id);
    saveStore(store);
    return { message: 'Riwayat dibersihkan.' } as T;
  }

  if (pathname === '/chat/message' && method === 'POST') {
    const user = getAuthUser(store);
    const content = String(body.message || '').trim();
    const userMsg = {
      id: store.nextId++,
      conversation_id: user.id,
      user_id: user.id,
      role: 'user',
      content,
      provider_mode: 'user',
      created_at: new Date().toISOString(),
    };
    store.chatMessages.push(userMsg);

    const currentLanguage =
      cat.languages.find((l: any) => l.id === user.current_language_id) ||
      cat.languages.find((l: any) => l.has_full_curriculum);
    const currentLvObj = cat.levels.find(
      (l: any) => l.language_id === currentLanguage?.id && l.level_number === (user.current_level_number || 1)
    );
    const currentModule = currentLvObj ? cat.modules.get(currentLvObj.id) || null : null;

    const reply = buildSmartLocalChatReply({
      user,
      currentLanguage,
      languages: cat.languages,
      provinces: cat.provinces,
      vocabulary: cat.vocabulary,
      currentModule,
      dailyPhrases: cat.dailyPhrases,
      userMessage: content,
      modeFooter: '\n\n*(Mode Pengetahuan Lokal Terverifikasi: pustaka 38 provinsi & 78 bahasa daerah LOGATARA)*',
    });

    const botMsg = {
      id: store.nextId++,
      conversation_id: user.id,
      user_id: user.id,
      role: 'assistant',
      content: reply,
      provider_mode: 'local_knowledge_fallback',
      created_at: new Date().toISOString(),
    };
    store.chatMessages.push(botMsg);
    saveStore(store);
    return {
      userMessage: userMsg,
      assistantMessage: botMsg,
      providerMode: 'local_knowledge_fallback',
      providerLabel: 'Mode Pengetahuan Lokal Terverifikasi (GitHub Pages)',
    } as T;
  }

  // === FULL PROFILE ===
  if (pathname === '/profile/full' && method === 'GET') {
    const user = getAuthUser(store);
    const knownLanguages = (user.known_language_ids || [])
      .map((id: number) => cat.languages.find((l: any) => l.id === id))
      .filter(Boolean);
    const learningLanguages = [...new Set([user.current_language_id, ...(user.learning_language_ids || [])])]
      .map((id: number) => cat.languages.find((l: any) => l.id === id))
      .filter(Boolean)
      .map((l: any) => ({ ...l, is_primary: l.id === user.current_language_id }));

    const completedLevels = Object.values(store.progress)
      .filter((p: any) => p.user_id === user.id && p.status === 'completed')
      .map((p: any) => {
        const lv = cat.levels.find((l: any) => l.id === p.level_id);
        return { ...p, ...lv };
      });

    const ownedMap = new Map(store.userAchievements.filter((a) => a.userId === user.id).map((a) => [a.achievementId, a.unlocked_at]));
    const achievements = cat.achievements.map((a: any) => ({
      ...a,
      unlocked: ownedMap.has(a.id),
      unlocked_at: ownedMap.get(a.id) || null,
    }));

    const savedPhrases = store.savedPhrases
      .filter((sp) => sp.userId === user.id)
      .map((sp) => {
        const dp = cat.dailyPhrases.find((d: any) => d.id === sp.dailyPhraseId);
        return dp ? { ...dp, saved_id: sp.id, saved_at: sp.created_at } : null;
      })
      .filter(Boolean);

    return {
      profile: user,
      knownLanguages,
      learningLanguages,
      completedLevels,
      xpHistory: store.xpTx.filter((t) => t.user_id === user.id).slice(0, 20),
      achievements,
      savedVocabulary: store.savedVocab.filter((v) => v.user_id === user.id),
      savedPhrases,
    } as T;
  }

  throw makeError(`Endpoint ${method} ${pathname} tidak ditemukan.`, 404);
}
