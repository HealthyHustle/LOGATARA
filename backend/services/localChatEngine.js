// Smart Intent-Aware Local Knowledge Engine for LOGATARA AI
// Shared cleanly between Express backend fallback (aiService.js) and GitHub Pages static mode (staticDemoBackend.ts)
// Ensures every user question gets a direct, relevant, grounded, and honest answer — never random unrelated vocab.

function normalizeText(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[?!.,'’"“”()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasWholeWord(haystack, needle) {
  if (!needle) return false;
  return new RegExp(`(^|\\b)${escapeRegExp(needle)}(\\b|$)`, 'i').test(haystack);
}

const STOP_WORDS = new Set([
  'apa', 'apakah', 'arti', 'artinya', 'makna', 'maksud', 'maksudnya', 'bahasa', 'basa', 'baso',
  'daerah', 'untuk', 'yang', 'dan', 'atau', 'di', 'ke', 'dari', 'dalam', 'pada', 'dengan', 'adalah',
  'bagaimana', 'gimana', 'cara', 'ucap', 'ucapkan', 'mengucapkan', 'bilang', 'menyebut', 'pelafalan',
  'melafalkan', 'dibaca', 'baca', 'membaca', 'tolong', 'jelaskan', 'ceritakan', 'kasih', 'berikan', 'contoh', 'kalimat',
  'kata', 'frasa', 'ungkapan', 'tara', 'logatara', 'tentang', 'saya', 'aku', 'kamu', 'anda', 'itu',
  'ini', 'bisa', 'mau', 'ingin', 'terjemahkan', 'terjemahan', 'translate', 'nya', 'dong', 'ya', 'yah',
  'sih', 'kak', 'min', 'ai', 'bot', 'sama', 'beda', 'perbedaan', 'sebutkan', 'cari', 'carikan', 'tanya',
]);

const SYNONYM_MAP = [
  [/\bmakasih\b/g, 'terima kasih'],
  [/\btrimakasih\b/g, 'terima kasih'],
  [/\bterimakasih\b/g, 'terima kasih'],
  [/\bthank you\b/g, 'terima kasih'],
  [/\bgimana kabar\w*\b/g, 'apa kabar'],
  [/\bbagaimana kabar\w*\b/g, 'apa kabar'],
  [/\bkabar\w*\b/g, 'apa kabar'],
  [/\bpagi\b/g, 'selamat pagi'],
  [/\bmenyapa\b/g, 'salam'],
  [/\bsapaan\b/g, 'salam'],
  [/\bkenalan\b/g, 'nama saya'],
  [/\bperkenalan\b/g, 'nama saya'],
  [/\bmemperkenalkan diri\b/g, 'nama saya'],
  [/\bharga\w*\b/g, 'berapa harganya'],
];

function extractMatchedLanguages(cleanedMsg, languages) {
  const matched = [];
  for (const l of languages) {
    const baseName = normalizeText(l.language_name)
      .replace(/^(bahasa|basa|baso)\s+/, '')
      .replace(/\(.*?\)/g, '')
      .trim();
    const provName = normalizeText(l.province_name || '');
    const altNames = normalizeText(l.alternative_names || '')
      .split(/[,/]/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 4);

    if (
      (baseName.length >= 3 && hasWholeWord(cleanedMsg, baseName)) ||
      (provName.length >= 4 && hasWholeWord(cleanedMsg, provName)) ||
      altNames.some((alt) => hasWholeWord(cleanedMsg, alt))
    ) {
      matched.push(l);
    }
  }
  // Deduplicate by language id and prefer more specific matches (e.g. "Basa Sunda" before "Basa Sunda Banten" unless "banten" is mentioned)
  return matched.sort((a, b) => {
    const aHasCurr = a.has_full_curriculum ? 0 : 1;
    const bHasCurr = b.has_full_curriculum ? 0 : 1;
    return aHasCurr - bHasCurr;
  });
}

function extractQueryConcept(cleanedMsg, mentionedLangs) {
  let stripped = cleanedMsg;
  // Remove mentioned language & province names so only the concept being asked remains
  for (const l of mentionedLangs) {
    const parts = [
      normalizeText(l.language_name),
      normalizeText(l.language_name).replace(/^(bahasa|basa|baso)\s+/, ''),
      normalizeText(l.province_name || ''),
    ].filter((s) => s.length >= 3);
    for (const p of parts) {
      stripped = stripped.replace(new RegExp(`(^|\\b)${escapeRegExp(p)}(\\b|$)`, 'gi'), ' ');
    }
  }

  // Keep meaningful phrase after removing boilerplate words
  const words = stripped
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 2 && !STOP_WORDS.has(w));
  return words.join(' ').trim();
}

export function buildSmartLocalChatReply({
  user,
  currentLanguage,
  languages,
  provinces,
  vocabulary,
  currentModule,
  dailyPhrases,
  userMessage,
  modeFooter,
}) {
  const raw = String(userMessage || '').trim();
  const cleaned = normalizeText(raw);
  const activeLangName = currentLanguage?.language_name || 'Basa Sunda';

  // 1. Direct Greeting / Help / Identity
  if (
    /^(halo|hai|hello|hi|p|tes|test|assalamualaikum|sampurasun|horas|om swastyastu|pagi|siang|sore|malam)(\s+(tara|logatara|ai|bot))?$/i.test(
      cleaned
    ) ||
    cleaned.includes('siapa kamu') ||
    cleaned.includes('kamu bisa apa') ||
    cleaned.includes('bisa bantu apa')
  ) {
    return `Halo **${user.full_name}**! Aku **LOGATARA AI** bersama Tara, siap membantumu belajar **${activeLangName}** (Level ${user.current_level_number || 1}) serta mengenal bahasa dari 38 provinsi Nusantara.\n\nKamu bisa menanyakan hal spesifik seperti:\n• *"Apa bahasa Bali / Aceh / Makassar untuk terima kasih?"*\n• *"Apa arti kata Sampurasun atau Rampes?"*\n• *"Beri petunjuk belajar untuk level saya sekarang"*\n• *"Jelaskan perbedaan Ngoko dan Krama atau pelafalan Basa Sunda"*\n• *"Ceritakan budaya Provinsi Papua atau Sumatera Barat"*\n• *"Berikan contoh percakapan menyapa dalam ${activeLangName}"*`;
  }

  const mentionedLangs = extractMatchedLanguages(cleaned, languages);
  const targetLang = mentionedLangs[0] || currentLanguage || languages[0];
  const mentionedProvince = provinces.find((p) => {
    const pn = normalizeText(p.province_name);
    return pn.length >= 4 && hasWholeWord(cleaned, pn);
  });

  // 2. Current Level / Module / Study Hint Intent
  if (
    /\b(petunjuk|hint|tips belajar|level saya|level sekarang|modul|latihan|bingung|susah)\b/.test(cleaned)
  ) {
    if (currentModule) {
      const vocab = currentModule.vocabulary || [];
      const topics = vocab.slice(0, 4).map((v) => `• **${v.meaning}** (diawali huruf \`${v.word[0]}...\`, ${v.word.split(' ').length} kata)`).join('\n');
      return `Berikut petunjuk belajar untuk **${currentModule.title}** (tanpa membocorkan jawaban langsung agar tetap seru!):\n\n**Fokus Ungkapan di Level Ini:**\n${topics}\n\n**Catatan Pelafalan:** ${currentModule.pronunciation_notes}\n\n**Konteks Budaya:** ${currentModule.cultural_context}\n\n*Tips:* Baca ulang tab **Modul Belajar** dan dengarkan tombol speaker sebelum menjawab soal Mendengarkan & Menulis!${modeFooter}`;
    }
  }

  // 3. Grammar / Politeness Levels / Pronunciation Rules Intent
  const asksGrammarRule =
    /\b(unggah ungguh|undak usuk|tata bahasa|grammar|ngoko|krama|lemes|loma|sor singgih|tata krama|sopan santun)\b/.test(
      cleaned
    );
  const asksPronunciation =
    /\b(pelafalan|melafalkan|cara baca|dibaca|vokal|pepet|taling)\b/.test(cleaned);

  if (asksGrammarRule || asksPronunciation) {
    // Only do single-word pronunciation lookup when user specifically asks pronunciation (not politeness level comparison)
    if (asksPronunciation && !asksGrammarRule) {
      const concept = extractQueryConcept(cleaned, mentionedLangs);
      if (concept && concept.length >= 3 && !/^(vokal|pepet|taling|melafalkan|dibaca)$/.test(concept)) {
        const matchWord = (v) => {
          const rw = normalizeText(v.regional_word);
          return rw === concept || hasWholeWord(rw, concept) || hasWholeWord(concept, rw);
        };
        const wordHit =
          vocabulary.find((v) => targetLang && v.language_id === targetLang.id && matchWord(v)) ||
          vocabulary.find(matchWord);
        if (wordHit) {
          const wordLang = languages.find((l) => l.id === wordHit.language_id) || targetLang;
          return `**Panduan Pelafalan "${wordHit.regional_word}"** (${wordHit.language_name} — ${wordHit.register_level})\n\n• **Cara Baca:** \`/${wordHit.pronunciation}/\`\n• **Arti:** *${wordHit.indonesian_meaning}*\n• **Contoh Kalimat:** "${wordHit.example_sentence}" (*${wordHit.example_translation}*)\n\n${
            wordLang?.pronunciation_information ? `**Catatan Fonetik ${wordLang.language_name}:** ${wordLang.pronunciation_information}` : ''
          }${modeFooter}`;
        }
      }
    }

    // Infer the right language automatically when user mentions specific politeness terms (e.g. Ngoko/Krama -> Basa Jawa)
    let langForRule = mentionedLangs[0] || null;
    if (!langForRule) {
      if (/\b(ngoko|krama|unggah ungguh)\b/.test(cleaned)) {
        langForRule = languages.find((l) => l.language_name.toLowerCase().includes('jawa'));
      } else if (/\b(lemes|loma|undak usuk|pepet|taling)\b/.test(cleaned)) {
        langForRule = languages.find((l) => l.language_name.toLowerCase().includes('sunda'));
      } else if (/\b(sor singgih)\b/.test(cleaned)) {
        langForRule = languages.find((l) => l.language_name.toLowerCase().includes('bali'));
      }
    }
    langForRule = langForRule || currentLanguage;

    if (langForRule) {
      let extraRule = '';
      const ln = langForRule.language_name.toLowerCase();
      if (ln.includes('sunda')) {
        extraRule =
          '\n\n**Undak-Usuk Basa Sunda:**\n• **Lemes** (sopan/hormat): digunakan kepada orang lebih tua atau baru dikenal (mis. *Abdi*, *Wasta*, *Hatur nuhun*, *Punten*).\n• **Loma** (akrab): digunakan dengan teman sebaya (mis. *Kuring*, *Ngaran*, *Dahar*).\n• **3 Bunyi E:** `e` pepet (*rampes*, *wilujeng*, *punten*), `é` taling (*énjing*, *pangéstu*), dan `eu` (*anjeun*, *reueus*).';
      } else if (ln.includes('jawa')) {
        extraRule =
          '\n\n**Unggah-Ungguh Basa Jawa:**\n• **Ngoko** (akrab): untuk teman sebaya (*Piye kabare?*, *Jenengku*, *Tuku*).\n• **Krama / Krama Inggil** (hormat): untuk orang lebih tua atau baru dikenal (*Pripun kabaripun?*, *Nami kula*, *Tumbas*, *Matur nuwun*).';
      } else if (ln.includes('bali')) {
        extraRule =
          '\n\n**Sor-Singgih Basa Bali:**\n• **Bali Alus** untuk menghormati (*Om Swastyastu*, *Tiang*, *Matur suksma*, *Durusang*).\n• **Bali Madya/Kapara** untuk percakapan akrab sehari-hari.';
      }
      return `**Panduan Tata Bahasa & Pelafalan ${langForRule.language_name}** (${langForRule.province_name})\n\n${langForRule.language_description}\n\n**Ciri Pelafalan:** ${langForRule.pronunciation_information}${extraRule}${modeFooter}`;
    }
  }

  // 4. Example Conversation / Dialogue Intent
  if (/\b(contoh percakapan|percakapan|dialog|ngobrol|bercakap)\b/.test(cleaned)) {
    const dpMatch =
      dailyPhrases.find((d) => d.language_id === targetLang?.id) ||
      dailyPhrases[0];
    if (dpMatch && dpMatch.example_dialogue?.length) {
      const lines = dpMatch.example_dialogue.map((d) => `• **${d.speaker}:** "${d.text}"`).join('\n');
      return `**Contoh Percakapan ${dpMatch.language_name}** (${dpMatch.province_name})\n\nUngkapan utama: **"${dpMatch.regional_phrase}"** (*${dpMatch.indonesian_meaning}*) — \`${dpMatch.pronunciation}\`\n\n${lines}\n\n**Catatan Budaya:** ${dpMatch.cultural_context}${modeFooter}`;
    }
  }

  // 5. Province / Culture / Traditions / History Intent
  if (
    /\b(budaya|tradisi|adat|sejarah|provinsi|rumah adat|tarian|tari|kuliner|khas|ceritakan)\b/.test(cleaned) &&
    (mentionedProvince || mentionedLangs.length > 0)
  ) {
    const prov =
      mentionedProvince ||
      provinces.find((p) => p.id === mentionedLangs[0]?.province_id);
    if (prov) {
      const provLangs = languages
        .filter((l) => l.province_id === prov.id)
        .map((l) => `**${l.language_name}**`)
        .join(', ');
      return `**Wawasan Budaya Provinsi ${prov.province_name}** (${prov.island_group})\n\n• **Gambaran Wilayah:** ${prov.region_description}\n• **Warisan Budaya:** ${prov.cultural_information}\n• **Bahasa Daerah Terpetakan:** ${provLangs || '-'}\n\nKamu bisa langsung menerjemahkan kosakata bahasa dari ${prov.province_name} melalui halaman **Translate**!${modeFooter}`;
    }
  }

  // 6. Direct Translation / Vocabulary Lookup (Supports Multi-Language Comparison & Specific Language Queries!)
  const rawConcept = extractQueryConcept(cleaned, mentionedLangs);
  const conceptVariants = [rawConcept];
  for (const [rx, rep] of SYNONYM_MAP) {
    if (rx.test(rawConcept)) {
      conceptVariants.push(rawConcept.replace(rx, rep).replace(/\s+/g, ' ').trim());
    }
  }
  const uniqueConcepts = [...new Set(conceptVariants.filter((c) => c.length >= 2))];

  // Check if user asked for comparison across multiple mentioned languages or "berbagai daerah"
  const asksMultiRegion =
    mentionedLangs.length >= 2 ||
    /\b(berbagai daerah|semua daerah|beberapa daerah|daerah lain|nusantara)\b/.test(cleaned);

  if (uniqueConcepts.length > 0) {
    // Score every vocabulary item strictly against the extracted concept
    const scored = [];
    const filterLangIds =
      mentionedLangs.length > 0 ? new Set(mentionedLangs.map((l) => l.id)) : null;

    for (const v of vocabulary) {
      if (filterLangIds && !filterLangIds.has(v.language_id)) continue;

      const rw = normalizeText(v.regional_word);
      const im = normalizeText(v.indonesian_meaning);
      const rwParts = v.regional_word.split('/').map(normalizeText).filter(Boolean);
      const imParts = v.indonesian_meaning.split('/').map(normalizeText).filter(Boolean);

      let score = 0;
      for (const c of uniqueConcepts) {
        if (rw === c || im === c || rwParts.includes(c) || imParts.includes(c)) {
          score = Math.max(score, 100);
        } else if (hasWholeWord(rw, c) || hasWholeWord(im, c)) {
          score = Math.max(score, 80);
        } else if (c.length >= 4 && (hasWholeWord(c, rw) || hasWholeWord(c, im))) {
          score = Math.max(score, 65);
        }
      }

      if (score > 0) {
        // Boost user's active language slightly when no explicit language was named
        if (!filterLangIds && v.language_id === currentLanguage?.id) score += 10;
        scored.push({ v, score });
      }
    }

    scored.sort((a, b) => b.score - a.score);

    if (scored.length > 0) {
      // Keep at most 1 best match per language when comparing multiple languages
      const seenLangs = new Set();
      const picked = [];
      const limit = asksMultiRegion ? 6 : mentionedLangs.length === 1 ? 3 : 4;
      for (const item of scored) {
        if (asksMultiRegion && seenLangs.has(item.v.language_id)) continue;
        seenLangs.add(item.v.language_id);
        picked.push(item.v);
        if (picked.length >= limit) break;
      }

      const header =
        mentionedLangs.length === 1
          ? `Hasil kamus terverifikasi untuk **"${rawConcept}"** dalam **${mentionedLangs[0].language_name}** (${mentionedLangs[0].province_name}):`
          : `Hasil kamus terverifikasi LOGATARA untuk **"${rawConcept}"**:`;

      const lines = picked.map(
        (v) =>
          `• **${v.regional_word}** (${v.language_name} — ${v.register_level})\n  Arti: *${v.indonesian_meaning}* | Pelafalan: \`/${v.pronunciation}/\`\n  Contoh: "${v.example_sentence}" (*${v.example_translation}*)`
      );
      return `${header}\n\n${lines.join('\n\n')}${modeFooter}`;
    }

    // User asked specifically about a language, but that exact word wasn't in our verified dict -> answer HONESTLY!
    if (mentionedLangs.length === 1) {
      const lang = mentionedLangs[0];
      const availableSamples = vocabulary
        .filter((v) => v.language_id === lang.id)
        .slice(0, 5)
        .map((v) => `• **${v.regional_word}** = *${v.indonesian_meaning}* (\`/${v.pronunciation}/\`)`)
        .join('\n');
      return `Maaf ${user.full_name}, kata **"${rawConcept}"** belum tersedia dalam kamus terverifikasi **${lang.language_name}** (${lang.province_name}). LOGATARA tidak mengarang terjemahan yang belum terverifikasi.\n\nBerikut beberapa kosakata **${lang.language_name}** terverifikasi yang sudah tersedia:\n${availableSamples}${modeFooter}`;
    }
  }

  // 7. Specific Language Overview (user just typed e.g. "Basa Bali" or "Bahasa Batak Toba")
  if (mentionedLangs.length === 1) {
    const lang = mentionedLangs[0];
    const samples = vocabulary
      .filter((v) => v.language_id === lang.id)
      .slice(0, 4)
      .map((v) => `• **${v.regional_word}** = *${v.indonesian_meaning}* (\`/${v.pronunciation}/\`)`)
      .join('\n');
    return `**${lang.language_name}** (${lang.province_name})\n\n${lang.language_description}\n\n**Catatan Pelafalan:** ${lang.pronunciation_information}\n\n**Contoh Kosakata Terverifikasi:**\n${samples}${modeFooter}`;
  }

  // 8. Honest, Direct Fallback Tailored to the User's Exact Prompt
  return `Pertanyaanmu tentang **"${raw}"** belum dapat kujawab secara bebas karena saat ini LOGATARA AI berjalan dalam **Mode Pengetahuan Lokal Terverifikasi** (tanpa koneksi API Gemini/OpenAI eksternal).\n\nSupaya aku bisa menjawab tepat sasaran dari pustaka terverifikasi 38 provinsi, coba format seperti:\n• *"Apa bahasa [nama bahasa/provinsi] untuk [kata]?"* (contoh: *"Apa bahasa Makassar untuk rumah?"*)\n• *"Apa arti [kata daerah]?"* (contoh: *"Apa arti Rampes?"* atau *"Apa arti Kasumasa?"*)\n• *"Jelaskan pelafalan / tata krama ${activeLangName}"*\n• *"Ceritakan budaya Provinsi [nama provinsi]"*\n• *"Berikan petunjuk untuk level saya sekarang"*${modeFooter}`;
}
