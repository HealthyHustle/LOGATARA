import { queryAll, queryOne } from '../database/db.js';

export function getAiProviderStatus() {
  if (process.env.GEMINI_API_KEY?.trim()) {
    return {
      configured: true,
      provider: 'gemini',
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      label: 'Google Gemini AI',
    };
  }
  if (process.env.OPENAI_API_KEY?.trim()) {
    return {
      configured: true,
      provider: 'openai',
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      label: 'OpenAI-Compatible AI',
    };
  }
  return {
    configured: false,
    provider: 'local_knowledge_fallback',
    model: 'logatara-verified-knowledge-base',
    label: 'Mode Pengetahuan Lokal (API AI belum dikonfigurasi)',
  };
}

async function buildUserLearningContext(user, currentLanguage) {
  const known = await queryAll(
    `SELECT rl.language_name, p.province_name
     FROM user_known_languages ukl
     JOIN regional_languages rl ON rl.id = ukl.language_id
     JOIN provinces p ON p.id = rl.province_id
     WHERE ukl.user_id = ?`,
    [user.id]
  );

  let sampleVocab = [];
  if (currentLanguage) {
    sampleVocab = await queryAll(
      `SELECT regional_word, indonesian_meaning, pronunciation, example_sentence, register_level
       FROM vocabulary
       WHERE language_id = ? AND verification_status = 'verified'
       LIMIT 18`,
      [currentLanguage.id]
    );
  }

  return { known, sampleVocab };
}

function buildSystemPrompt(user, currentLanguage, context) {
  const knownList = context.known.map((k) => `${k.language_name} (${k.province_name})`).join(', ') || 'Belum diisi';
  const vocabBlock = context.sampleVocab
    .map((v) => `- ${v.regional_word} = "${v.indonesian_meaning}" (/${v.pronunciation}/, ${v.register_level})`)
    .join('\n');

  return `Kamu adalah LOGATARA AI (ditemani karakter Tara), asisten edukatif ramah untuk platform belajar bahasa daerah Indonesia LOGATARA.
Gunakan Bahasa Indonesia yang hangat, jelas, sopan, dan menyemangati.

KONTEKS PENGGUNA SAAT INI:
- Nama Explorer: ${user.full_name}
- Bahasa Daerah yang Sedang Dipelajari: ${currentLanguage ? `${currentLanguage.language_name} (${currentLanguage.province_name})` : 'Belum dipilih'}
- Level Petualangan Saat Ini: Level ${user.current_level_number || 1} di Kampung Nusantara
- Bahasa Daerah yang Sudah Dikuasai: ${knownList}

KOSAKATA TERVERIFIKASI DALAM DATABASE UNTUK BAHASA AKTIF:
${vocabBlock || '(Bahasa ini masih dalam tahap verifikasi kamus lengkap.)'}

ATURAN KETAT:
1. Jelaskan kosakata, tata bahasa/unggah-ungguh, cara pelafalan, contoh percakapan, budaya daerah, dan berikan petunjuk belajar tanpa mengarang terjemahan yang tidak kamu yakini kebenarannya.
2. Jika suatu bahasa daerah belum memiliki data terverifikasi yang cukup, sampaikan secara jujur bahwa kosakata tersebut memerlukan verifikasi penutur asli atau Balai Bahasa setempat.
3. Jawab ringkas, terstruktur, dan mudah dipahami pelajar Indonesia.`;
}

async function callGeminiProvider(systemPrompt, historyMessages, userMessage) {
  const apiKey = process.env.GEMINI_API_KEY.trim();
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const contents = [
    ...historyMessages.slice(-8).map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
    { role: 'user', parts: [{ text: userMessage }] },
  ];

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: { temperature: 0.5, maxOutputTokens: 600 },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API HTTP ${response.status}: ${errText.slice(0, 180)}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('')?.trim();
  if (!text) throw new Error('Gemini API mengembalikan respons kosong.');
  return text;
}

async function callOpenAIProvider(systemPrompt, historyMessages, userMessage) {
  const apiKey = process.env.OPENAI_API_KEY.trim();
  const baseUrl = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  const messages = [
    { role: 'system', content: systemPrompt },
    ...historyMessages.slice(-8).map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    })),
    { role: 'user', content: userMessage },
  ];

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.5,
      max_tokens: 600,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI API HTTP ${response.status}: ${errText.slice(0, 180)}`);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('Provider AI mengembalikan respons kosong.');
  return text;
}

/**
 * Transparent local verified-database fallback when no external AI key is configured.
 * Searches real verified vocabulary, modules, and province cultural heritage in SQLite/Postgres
 * so answers are truthful, educational, and NEVER fabricated.
 */
async function buildVerifiedLocalFallbackReply(user, currentLanguage, userMessage) {
  const cleaned = userMessage.toLowerCase().trim();
  const langName = currentLanguage?.language_name || 'Basa Sunda';

  // Extract meaningful search terms
  const stopWords = new Set([
    'apa', 'arti', 'bahasa', 'daerah', 'dalam', 'untuk', 'yang', 'dan', 'atau', 'di', 'ke', 'dari',
    'bagaimana', 'cara', 'ucap', 'pelafalan', 'tolong', 'jelaskan', 'contoh', 'kalimat', 'kata',
    'tara', 'logatara', 'tentang', 'budaya', 'saya', 'kamu', 'itu', 'ini', 'adalah', 'bisa', 'mau',
    'terjemahkan', 'translate', 'artinya', 'sunda', 'jawa', 'bali', 'minang', 'batak', 'bugis', 'betawi', 'banjar',
  ]);
  const tokens = cleaned
    .replace(/[^a-z0-9\s'-]/gi, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !stopWords.has(w));

  // Detect if user asks about a specific language by name
  const mentionedLangs = await queryAll(
    `SELECT rl.id, rl.language_name, rl.language_description, rl.pronunciation_information, rl.verification_status, p.province_name, p.cultural_information
     FROM regional_languages rl
     JOIN provinces p ON p.id = rl.province_id`
  );
  const matchedLang = mentionedLangs.find((l) => {
    const simple = l.language_name.toLowerCase().replace(/^bahasa\s+|^basa\s+/, '');
    return cleaned.includes(simple) || cleaned.includes(l.province_name.toLowerCase());
  });
  const targetLangId = matchedLang?.id || currentLanguage?.id || null;

  // 1. Search verified vocabulary matches
  let vocabMatches = [];
  if (tokens.length > 0) {
    const likePattern = `%${tokens[0]}%`;
    vocabMatches = await queryAll(
      `SELECT v.regional_word, v.indonesian_meaning, v.pronunciation, v.example_sentence, v.example_translation,
              v.register_level, rl.language_name, p.province_name
       FROM vocabulary v
       JOIN regional_languages rl ON rl.id = v.language_id
       JOIN provinces p ON p.id = rl.province_id
       WHERE v.verification_status = 'verified'
         AND (LOWER(v.regional_word) LIKE ? OR LOWER(v.indonesian_meaning) LIKE ? OR LOWER(v.example_sentence) LIKE ?)
       ORDER BY CASE WHEN v.language_id = ? THEN 0 ELSE 1 END
       LIMIT 5`,
      [likePattern, likePattern, likePattern, targetLangId || -1]
    );

    if (vocabMatches.length === 0 && tokens.length > 1) {
      const p2 = `%${tokens[1]}%`;
      vocabMatches = await queryAll(
        `SELECT v.regional_word, v.indonesian_meaning, v.pronunciation, v.example_sentence, v.example_translation,
                v.register_level, rl.language_name, p.province_name
         FROM vocabulary v
         JOIN regional_languages rl ON rl.id = v.language_id
         JOIN provinces p ON p.id = rl.province_id
         WHERE v.verification_status = 'verified'
           AND (LOWER(v.regional_word) LIKE ? OR LOWER(v.indonesian_meaning) LIKE ?)
         LIMIT 5`,
        [p2, p2]
      );
    }
  }

  // Handle common explicit queries like "terima kasih", "halo", "apa kabar", "level", "petunjuk", "budaya"
  if (vocabMatches.length === 0 && (cleaned.includes('terima kasih') || cleaned.includes('makasih'))) {
    vocabMatches = await queryAll(
      `SELECT v.regional_word, v.indonesian_meaning, v.pronunciation, v.example_sentence, v.example_translation,
              v.register_level, rl.language_name, p.province_name
       FROM vocabulary v
       JOIN regional_languages rl ON rl.id = v.language_id
       JOIN provinces p ON p.id = rl.province_id
       WHERE LOWER(v.indonesian_meaning) LIKE '%terima kasih%'
       LIMIT 6`
    );
  } else if (vocabMatches.length === 0 && (cleaned.includes('kabar') || cleaned.includes('sapa') || cleaned.includes('salam'))) {
    vocabMatches = await queryAll(
      `SELECT v.regional_word, v.indonesian_meaning, v.pronunciation, v.example_sentence, v.example_translation,
              v.register_level, rl.language_name, p.province_name
       FROM vocabulary v
       JOIN regional_languages rl ON rl.id = v.language_id
       JOIN provinces p ON p.id = rl.province_id
       WHERE LOWER(v.indonesian_meaning) LIKE '%kabar%' OR LOWER(v.indonesian_meaning) LIKE '%salam%'
       ORDER BY CASE WHEN v.language_id = ? THEN 0 ELSE 1 END
       LIMIT 5`,
      [targetLangId || -1]
    );
  }

  if (vocabMatches.length > 0) {
    const lines = vocabMatches.map(
      (v) =>
        `• **${v.regional_word}** (${v.language_name} — ${v.register_level})\n  Arti: *${v.indonesian_meaning}* | Pelafalan: \`/${v.pronunciation}/\`\n  Contoh: "${v.example_sentence}" (${v.example_translation})`
    );
    return `Berikut kosakata terverifikasi yang Tara temukan di pustaka LOGATARA:\n\n${lines.join('\n\n')}\n\n*(Catatan: Saat ini LOGATARA AI berjalan dalam Mode Pengetahuan Lokal karena \`GEMINI_API_KEY\` / \`OPENAI_API_KEY\` belum dikonfigurasi di server.)*`;
  }

  // 2. Check if user asks for level hints or current module help
  if (cleaned.includes('level') || cleaned.includes('modul') || cleaned.includes('hint') || cleaned.includes('petunjuk') || cleaned.includes('latihan')) {
    if (currentLanguage) {
      const mod = await queryOne(
        `SELECT lm.title, lm.cultural_context, lm.pronunciation_notes, lm.vocabulary_json
         FROM learning_modules lm
         JOIN learning_levels ll ON ll.id = lm.level_id
         WHERE ll.language_id = ? AND ll.level_number = ?`,
        [currentLanguage.id, user.current_level_number || 1]
      );
      if (mod) {
        const vocab = JSON.parse(mod.vocabulary_json || '[]').slice(0, 3);
        const tips = vocab.map((v) => `• **${v.word}** (/${v.pron}/) = ${v.meaning}`).join('\n');
        return `Ini petunjuk untuk **${mod.title}** yang sedang kamu pelajari!\n\n**Kosakata Kunci:**\n${tips}\n\n**Tips Pelafalan:** ${mod.pronunciation_notes}\n\n**Konteks Budaya:** ${mod.cultural_context}\n\n*(Mode Pengetahuan Lokal — tambahkan API key AI di \`.env\` untuk percakapan AI generatif bebas.)*`;
      }
    }
  }

  // 3. Check if user mentioned a specific province or language
  if (matchedLang) {
    const statusNote =
      matchedLang.verification_status === 'verified'
        ? 'Bahasa ini sudah memiliki kurikulum terverifikasi penuh 7 level di LOGATARA!'
        : 'Bahasa ini telah tercatat dalam katalog 38 provinsi LOGATARA, namun kosakata rincinya masih memerlukan verifikasi penutur asli & Balai Bahasa setempat agar tidak ada terjemahan yang keliru.';

    return `**${matchedLang.language_name}** (${matchedLang.province_name})\n\n${matchedLang.language_description}\n\n**Catatan Pelafalan:** ${matchedLang.pronunciation_information}\n**Budaya Provinsi:** ${matchedLang.cultural_information}\n\n*Status Data:* ${statusNote}\n\n*(Mode Pengetahuan Lokal — konfigurasi \`GEMINI_API_KEY\` atau \`OPENAI_API_KEY\` di \`.env\` untuk respons AI penuh.)*`;
  }

  // 4. Honest helpful guidance
  return `Halo ${user.full_name}! Tara siap membantumu belajar **${langName}** (Level ${user.current_level_number || 1}).\n\nSaat ini server berjalan dalam **Mode Pengetahuan Lokal** (API key Gemini/OpenAI belum dikonfigurasi di \`.env\`), sehingga Tara hanya menjawab berdasarkan kamus dan modul terverifikasi agar tidak pernah mengarang kosakata daerah.\n\nCoba tanyakan hal seperti:\n• *"Apa bahasa daerah untuk terima kasih?"*\n• *"Bagaimana cara menanyakan kabar dalam Basa Sunda atau Basa Jawa?"*\n• *"Berikan petunjuk untuk level saya sekarang"*\n• *"Ceritakan tentang budaya Bali atau Sumatera Barat"*`;
}

export async function generateChatResponse({ user, currentLanguage, historyMessages, userMessage }) {
  const status = getAiProviderStatus();
  const context = await buildUserLearningContext(user, currentLanguage);
  const systemPrompt = buildSystemPrompt(user, currentLanguage, context);

  if (status.provider === 'gemini') {
    try {
      const reply = await callGeminiProvider(systemPrompt, historyMessages, userMessage);
      return { reply, providerMode: 'gemini', providerLabel: status.label, fallbackWarning: null };
    } catch (err) {
      const fallbackReply = await buildVerifiedLocalFallbackReply(user, currentLanguage, userMessage);
      return {
        reply: `${fallbackReply}\n\n*(Info teknis: Koneksi ke Gemini AI gagal sementara — ${err.message})*`,
        providerMode: 'local_knowledge_fallback',
        providerLabel: 'Fallback Pengetahuan Lokal (API AI sedang bermasalah)',
        fallbackWarning: err.message,
      };
    }
  }

  if (status.provider === 'openai') {
    try {
      const reply = await callOpenAIProvider(systemPrompt, historyMessages, userMessage);
      return { reply, providerMode: 'openai', providerLabel: status.label, fallbackWarning: null };
    } catch (err) {
      const fallbackReply = await buildVerifiedLocalFallbackReply(user, currentLanguage, userMessage);
      return {
        reply: `${fallbackReply}\n\n*(Info teknis: Koneksi ke Provider AI gagal sementara — ${err.message})*`,
        providerMode: 'local_knowledge_fallback',
        providerLabel: 'Fallback Pengetahuan Lokal (API AI sedang bermasalah)',
        fallbackWarning: err.message,
      };
    }
  }

  const reply = await buildVerifiedLocalFallbackReply(user, currentLanguage, userMessage);
  return {
    reply,
    providerMode: 'local_knowledge_fallback',
    providerLabel: status.label,
    fallbackWarning: null,
  };
}

/**
 * Optional AI-assisted translation helper used ONLY when GEMINI_API_KEY or OPENAI_API_KEY is configured
 * and the requested phrase is not found directly in the verified static dictionary.
 */
export async function translateWithAi({ text, language, direction, sampleVocab = [] }) {
  const status = getAiProviderStatus();
  if (!status.configured) return null;

  const vocabHints = sampleVocab
    .slice(0, 12)
    .map((v) => `- ${v.regional_word} = ${v.indonesian_meaning} (/${v.pronunciation}/)`)
    .join('\n');

  const dirLabel =
    direction === 'id-to-regional'
      ? `Bahasa Indonesia ke ${language.language_name} (${language.province_name})`
      : `${language.language_name} (${language.province_name}) ke Bahasa Indonesia`;

  const systemPrompt = `Kamu adalah penerjemah bahasa daerah Indonesia yang jujur dan teliti.
Terjemahkan teks dari ${dirLabel}.
Referensi kosakata terverifikasi untuk ${language.language_name}:
${vocabHints}

Balas HANYA dalam JSON valid tanpa markdown dengan format:
{"translation":"...","pronunciation":"...","exampleSentence":"...","exampleTranslation":"...","confident":true/false,"notes":"..."}
Jika kamu tidak yakin dengan terjemahan yang akurat, set "confident": false.`;

  try {
    const raw =
      status.provider === 'gemini'
        ? await callGeminiProvider(systemPrompt, [], `Terjemahkan: "${text}"`)
        : await callOpenAIProvider(systemPrompt, [], `Terjemahkan: "${text}"`);
    const cleanedJson = raw.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
    const parsed = JSON.parse(cleanedJson);
    if (!parsed?.translation) return null;
    return {
      ...parsed,
      providerLabel: status.label,
    };
  } catch {
    return null;
  }
}
