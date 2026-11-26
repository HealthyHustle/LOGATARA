import { queryAll, queryOne } from '../database/db.js';
import { buildSmartLocalChatReply } from './localChatEngine.js';

const DEFAULT_N8N_WEBHOOK_URL = 'https://dpwppijabar.app.n8n.cloud/webhook/logatara-ai';

function getN8nWebhookUrl() {
  if (process.env.N8N_AI_WEBHOOK_URL !== undefined) {
    return process.env.N8N_AI_WEBHOOK_URL.trim();
  }
  return DEFAULT_N8N_WEBHOOK_URL;
}

export function getAiProviderStatus() {
  const n8nUrl = getN8nWebhookUrl();
  if (n8nUrl) {
    return {
      configured: true,
      provider: 'n8n',
      model: 'n8n-logatara-ai-agent',
      label: 'LOGATARA AI Agent (n8n)',
    };
  }
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

function extractN8nReplyText(data) {
  if (typeof data === 'string') return data.trim();
  if (Array.isArray(data)) {
    for (const item of data) {
      const found = extractN8nReplyText(item);
      if (found) return found;
    }
    return '';
  }
  if (data && typeof data === 'object') {
    const direct = data.reply || data.output || data.response || data.text || data.message || data.answer;
    if (typeof direct === 'string' && direct.trim()) return direct.trim();
    if (data.data) return extractN8nReplyText(data.data);
  }
  return '';
}

async function callN8nAgent({ user, currentLanguage, historyMessages, userMessage }) {
  const webhookUrl = getN8nWebhookUrl();
  const sessionId = `logatara-user-${user.id}`;

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: userMessage,
      chatInput: userMessage,
      sessionId,
      userName: user.full_name,
      currentLanguage: currentLanguage?.language_name || 'Basa Sunda',
      currentProvince: currentLanguage?.province_name || 'Jawa Barat',
      currentLevel: user.current_level_number || 1,
      history: (historyMessages || []).slice(-6),
    }),
    signal: AbortSignal.timeout(28000),
  });

  const rawText = await response.text();
  if (!response.ok) {
    throw new Error(`n8n AI Agent HTTP ${response.status}: ${rawText.slice(0, 160)}`);
  }

  let reply = '';
  try {
    const parsed = JSON.parse(rawText);
    reply = extractN8nReplyText(parsed);
  } catch {
    reply = rawText.trim();
  }

  if (!reply) throw new Error('Respons n8n AI Agent kosong.');
  return reply;
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
3. Jawab ringkas, alami, terstruktur, dan mudah dipahami pelajar Indonesia. Hindari penggunaan tanda pisah panjang (em-dash) agar gaya bahasa terasa natural.`;
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
  const [languages, provinces, vocabulary, dailyPhrasesRows] = await Promise.all([
    queryAll(
      `SELECT rl.*, p.province_name
       FROM regional_languages rl JOIN provinces p ON p.id = rl.province_id`
    ),
    queryAll('SELECT * FROM provinces'),
    queryAll(
      `SELECT v.*, rl.language_name, p.province_name
       FROM vocabulary v
       JOIN regional_languages rl ON rl.id = v.language_id
       JOIN provinces p ON p.id = rl.province_id
       WHERE v.verification_status = 'verified'`
    ),
    queryAll(
      `SELECT dp.*, rl.language_name, p.province_name
       FROM daily_phrases dp
       JOIN regional_languages rl ON rl.id = dp.language_id
       JOIN provinces p ON p.id = dp.province_id`
    ),
  ]);

  let currentModule = null;
  if (currentLanguage) {
    const modRow = await queryOne(
      `SELECT lm.title, lm.cultural_context, lm.pronunciation_notes, lm.vocabulary_json
       FROM learning_modules lm
       JOIN learning_levels ll ON ll.id = lm.level_id
       WHERE ll.language_id = ? AND ll.level_number = ?`,
      [currentLanguage.id, user.current_level_number || 1]
    );
    if (modRow) {
      currentModule = {
        ...modRow,
        vocabulary: JSON.parse(modRow.vocabulary_json || '[]'),
      };
    }
  }

  const dailyPhrases = dailyPhrasesRows.map((d) => ({
    ...d,
    example_dialogue: JSON.parse(d.example_dialogue_json || '[]'),
  }));

  return buildSmartLocalChatReply({
    user,
    currentLanguage,
    languages: languages.map((l) => ({ ...l, has_full_curriculum: Boolean(l.has_full_curriculum) })),
    provinces,
    vocabulary,
    currentModule,
    dailyPhrases,
    userMessage,
    modeFooter:
      '\n\n*(Mode Pengetahuan Lokal Terverifikasi. Tambahkan `GEMINI_API_KEY` atau `OPENAI_API_KEY` di `.env` untuk percakapan AI generatif bebas.)*',
  });
}

export async function generateChatResponse({ user, currentLanguage, historyMessages, userMessage }) {
  const status = getAiProviderStatus();

  if (status.provider === 'n8n') {
    try {
      const reply = await callN8nAgent({ user, currentLanguage, historyMessages, userMessage });
      return { reply, providerMode: 'n8n', providerLabel: status.label, fallbackWarning: null };
    } catch (err) {
      const fallbackReply = await buildVerifiedLocalFallbackReply(user, currentLanguage, userMessage);
      return {
        reply: `${fallbackReply}\n\n*(Info teknis: Koneksi ke LOGATARA AI Agent n8n gagal sementara: ${err.message})*`,
        providerMode: 'local_knowledge_fallback',
        providerLabel: 'Fallback Pengetahuan Lokal (n8n AI Agent sedang tidak terjangkau)',
        fallbackWarning: err.message,
      };
    }
  }

  const context = await buildUserLearningContext(user, currentLanguage);
  const systemPrompt = buildSystemPrompt(user, currentLanguage, context);

  if (status.provider === 'gemini') {
    try {
      const reply = await callGeminiProvider(systemPrompt, historyMessages, userMessage);
      return { reply, providerMode: 'gemini', providerLabel: status.label, fallbackWarning: null };
    } catch (err) {
      const fallbackReply = await buildVerifiedLocalFallbackReply(user, currentLanguage, userMessage);
      return {
        reply: `${fallbackReply}\n\n*(Info teknis: Koneksi ke Gemini AI gagal sementara: ${err.message})*`,
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
        reply: `${fallbackReply}\n\n*(Info teknis: Koneksi ke Provider AI gagal sementara: ${err.message})*`,
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
  if (status.provider !== 'gemini' && status.provider !== 'openai') return null;

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
