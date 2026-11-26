import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ArrowLeftRight,
  Volume2,
  Copy,
  Check,
  Bookmark,
  BookmarkCheck,
  Search,
  AlertCircle,
  BookOpen,
  Languages,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { apiRequest } from '../../services/api/client';
import { speakPhrase, playSoundEffect } from '../../services/audio/speechService';
import { useAuth } from '../../contexts/AuthContext';
import type { RegionalLanguage, VocabularyEntry } from '../../types';

export function TranslatePage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const queryLangId = Number(searchParams.get('langId') || 0);

  const [languages, setLanguages] = useState<RegionalLanguage[]>([]);
  const [selectedLangId, setSelectedLangId] = useState<number>(0);
  const [langSearch, setLangSearch] = useState('');
  const [direction, setDirection] = useState<'id-to-regional' | 'regional-to-id'>('id-to-regional');
  const [inputText, setInputText] = useState('');
  const [translating, setTranslating] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [savedMain, setSavedMain] = useState(false);

  // Sample entries for currently selected language (for instant clickable chips)
  const [activeLangSamples, setActiveLangSamples] = useState<VocabularyEntry[]>([]);

  // Dictionary search state
  const [dictSearch, setDictSearch] = useState('');
  const [dictLangFilter, setDictLangFilter] = useState<string>('all');
  const [dictEntries, setDictEntries] = useState<VocabularyEntry[]>([]);
  const [loadingDict, setLoadingDict] = useState(false);

  useEffect(() => {
    apiRequest<{ languages: RegionalLanguage[] }>('/languages').then((res) => {
      const list = res.languages || [];
      setLanguages(list);
      const initial =
        (queryLangId && list.some((l) => l.id === queryLangId) ? queryLangId : 0) ||
        user?.current_language_id ||
        list.find((l) => l.has_full_curriculum)?.id ||
        list[0]?.id ||
        0;
      setSelectedLangId(initial);
      if (queryLangId) {
        setDictLangFilter(String(queryLangId));
      }
    });
  }, [user?.current_language_id, queryLangId]);

  // Load verified sample words for the currently selected translator language
  useEffect(() => {
    if (!selectedLangId) return;
    apiRequest<{ entries: VocabularyEntry[] }>(`/dictionary?languageId=${selectedLangId}`)
      .then((res) => setActiveLangSamples(res.entries || []))
      .catch(() => setActiveLangSamples([]));
  }, [selectedLangId]);

  const loadDictionary = useCallback(async () => {
    setLoadingDict(true);
    try {
      const params = new URLSearchParams();
      if (dictLangFilter !== 'all') params.set('languageId', dictLangFilter);
      if (dictSearch.trim()) params.set('q', dictSearch.trim());
      const res = await apiRequest<{ entries: VocabularyEntry[] }>(`/dictionary?${params.toString()}`);
      setDictEntries(res.entries || []);
    } finally {
      setLoadingDict(false);
    }
  }, [dictLangFilter, dictSearch]);

  useEffect(() => {
    const t = window.setTimeout(loadDictionary, 200);
    return () => window.clearTimeout(t);
  }, [loadDictionary]);

  const filteredLanguageOptions = useMemo(() => {
    const q = langSearch.trim().toLowerCase();
    if (!q) return languages;
    return languages.filter(
      (l) =>
        l.language_name.toLowerCase().includes(q) ||
        (l.province_name || '').toLowerCase().includes(q) ||
        (l.alternative_names || '').toLowerCase().includes(q)
    );
  }, [languages, langSearch]);

  const handleTranslate = async (e?: React.FormEvent, overrideText?: string) => {
    e?.preventDefault();
    const targetText = (overrideText !== undefined ? overrideText : inputText).trim();
    if (!targetText || !selectedLangId) return;
    if (overrideText !== undefined) setInputText(overrideText);

    setTranslating(true);
    setSavedMain(false);
    setCopied(false);
    try {
      const data = await apiRequest('/translate', {
        method: 'POST',
        body: JSON.stringify({
          text: targetText,
          languageId: selectedLangId,
          direction,
        }),
      });
      setResult(data);
    } catch (err: any) {
      setResult({
        found: false,
        uncertain: true,
        message: err?.message || 'Terjadi kendala saat menerjemahkan.',
        matches: [],
      });
    } finally {
      setTranslating(false);
    }
  };

  const handleSwap = () => {
    setDirection((d) => (d === 'id-to-regional' ? 'regional-to-id' : 'id-to-regional'));
    if (result?.translation) {
      setInputText(result.translation);
    }
    setResult(null);
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Ignore clipboard restrictions
    }
  };

  const handleSaveVocab = async (entry: {
    vocabularyId?: number;
    languageId: number;
    regionalWord: string;
    indonesianMeaning: string;
    pronunciation: string;
    notes?: string;
  }) => {
    await apiRequest('/saved-vocabulary', {
      method: 'POST',
      body: JSON.stringify(entry),
    });
    playSoundEffect('correct');
    loadDictionary();
  };

  const activeLangObj = languages.find((l) => l.id === selectedLangId);
  const verifiedLangCount = languages.filter((l) => l.verification_status === 'verified').length;

  // Dynamic quick samples from the currently selected language's verified dictionary
  const quickSampleButtons = useMemo(() => {
    if (activeLangSamples.length > 0) {
      return activeLangSamples.slice(0, 5).map((item) =>
        direction === 'id-to-regional'
          ? item.indonesian_meaning.split('/')[0].trim()
          : item.regional_word.split('/')[0].trim()
      );
    }
    return ['Terima kasih', 'Apa kabar', 'Selamat pagi', 'Saya', 'Rumah'];
  }, [activeLangSamples, direction]);

  const sourceModeBadge = (mode?: string) => {
    if (mode === 'verified_dictionary') return 'Kamus Terverifikasi LOGATARA';
    if (mode === 'verified_dictionary_composed') return 'Terjemahan Kalimat Berbasis Kamus';
    if (mode === 'verified_dictionary_partial') return 'Padanan Terdekat (Kamus Terverifikasi)';
    if (mode === 'ai_assisted') return 'Terjemahan Berbantuan AI';
    return 'Kamus Terverifikasi';
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <section className="storybook-card p-6 batik-watermark space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-fixed text-primary text-xs font-bold uppercase">
            <Languages className="w-3.5 h-3.5" />
            Penerjemah & Kamus 38 Provinsi Terverifikasi
          </span>
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-tertiary-fixed text-on-tertiary-fixed text-xs font-bold">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {verifiedLangCount} Bahasa Daerah Aktif & Siap Diterjemahkan
          </span>
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-primary">
          Terjemahkan & Jelajahi Kamus Nusantara
        </h1>
        <p className="text-sm text-on-surface-variant max-w-3xl">
          Seluruh <strong>{verifiedLangCount} bahasa daerah dari 38 provinsi Indonesia</strong> kini telah memiliki kosakata dasar terverifikasi yang dapat diakses dan diterjemahkan dua arah (Indonesia ↔ Bahasa Daerah) beserta pelafalan, audio, dan contoh kalimat.
        </p>
      </section>

      {/* Translator Card */}
      <section className="storybook-card p-5 sm:p-7 space-y-5">
        {/* Direction & Searchable Language Bar */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-surface-low p-3.5 rounded-2xl border border-on-surface-bark/10">
          <div className="flex-1 text-center lg:text-left px-2">
            <span className="block text-[10px] font-bold uppercase text-on-surface-variant">Dari</span>
            <span className="font-display font-bold text-base text-primary">
              {direction === 'id-to-regional'
                ? 'Bahasa Indonesia'
                : activeLangObj
                  ? `${activeLangObj.language_name} (${activeLangObj.province_name})`
                  : 'Bahasa Daerah'}
            </span>
          </div>

          <button
            type="button"
            onClick={handleSwap}
            aria-label="Tukar arah bahasa terjemahan"
            className="btn-parchment px-4 py-2 text-xs inline-flex items-center justify-center gap-1.5 self-center shrink-0"
          >
            <ArrowLeftRight className="w-4 h-4 text-secondary-terracotta" />
            <span>Tukar Arah</span>
          </button>

          <div className="flex-1 flex flex-col lg:items-end gap-1.5 px-2">
            <div className="flex items-center gap-2 w-full lg:justify-end">
              <label htmlFor="translate-lang-select" className="text-[10px] font-bold uppercase text-on-surface-variant">
                {direction === 'id-to-regional' ? 'Ke Bahasa Daerah' : 'Bahasa Daerah Sumber'}
              </label>
              <input
                type="search"
                value={langSearch}
                onChange={(e) => setLangSearch(e.target.value)}
                placeholder="Filter provinsi/bahasa..."
                aria-label="Filter pilihan bahasa daerah"
                className="bg-surface-ivory border border-on-surface-bark/15 rounded-full px-3 py-0.5 text-xs text-on-surface w-40 focus:outline-none focus:border-primary"
              />
            </div>
            <select
              id="translate-lang-select"
              value={selectedLangId}
              onChange={(e) => {
                const nextId = Number(e.target.value);
                setSelectedLangId(nextId);
                setDictLangFilter(String(nextId));
                setResult(null);
              }}
              className="bg-surface-ivory border border-on-surface-bark/20 rounded-xl px-3 py-1.5 text-sm font-bold text-on-surface w-full lg:w-auto max-w-full"
            >
              {filteredLanguageOptions.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.language_name}, {l.province_name} ({l.vocab_count || 0} kata ✓)
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Input & Output Grid */}
        <form onSubmit={(e) => handleTranslate(e)} className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="space-y-3">
            <label htmlFor="translate-input" className="block text-xs font-bold uppercase text-on-surface-variant">
              Teks Masukan ({direction === 'id-to-regional' ? 'Bahasa Indonesia' : activeLangObj?.language_name || 'Daerah'})
            </label>
            <textarea
              id="translate-input"
              rows={4}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={
                direction === 'id-to-regional'
                  ? 'Contoh: terima kasih, apa kabar, selamat pagi, saya, rumah, air, makan...'
                  : `Contoh kata ${activeLangObj?.language_name || 'daerah'}: ${quickSampleButtons.slice(0, 3).join(', ')}...`
              }
              className="logatara-input w-full p-4 text-base resize-none"
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1.5">
                {quickSampleButtons.map((sample) => (
                  <button
                    key={sample}
                    type="button"
                    onClick={() => handleTranslate(undefined, sample)}
                    className="text-xs font-semibold px-2.5 py-1 rounded-full bg-surface-container hover:bg-surface-high text-on-surface-bark transition-colors"
                  >
                    {sample}
                  </button>
                ))}
              </div>
              <button
                type="submit"
                disabled={translating || !inputText.trim()}
                className="btn-adventure px-6 py-2.5 text-sm disabled:opacity-50"
              >
                {translating ? 'Menerjemahkan...' : 'Terjemahkan'}
              </button>
            </div>
          </div>

          {/* Translation Output Box */}
          <div className="rounded-2xl bg-surface-low border-2 border-on-surface-bark/10 p-5 flex flex-col justify-between min-h-[200px]">
            {!result ? (
              <div className="m-auto text-center text-sm text-on-surface-variant space-y-1.5">
                <Languages className="w-8 h-8 text-outline mx-auto mb-1" />
                <p>
                  Hasil terjemahan <strong>{activeLangObj?.language_name}</strong>, pelafalan, dan contoh kalimat akan muncul di sini.
                </p>
                <p className="text-xs text-outline">
                  Klik salah satu frasa cepat di kiri atau ketik kata sendiri untuk langsung mencoba!
                </p>
              </div>
            ) : result.found && result.translation ? (
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        result.sourceMode === 'ai_assisted'
                          ? 'bg-secondary-fixed text-on-secondary-fixed'
                          : result.uncertain
                            ? 'bg-tertiary-fixed text-on-tertiary-fixed'
                            : 'bg-primary-fixed text-primary'
                      }`}
                    >
                      {result.sourceMode === 'ai_assisted' ? (
                        <Sparkles className="w-3 h-3" />
                      ) : (
                        <CheckCircle2 className="w-3 h-3" />
                      )}
                      {sourceModeBadge(result.sourceMode)}
                    </span>
                    <p className="font-display text-2xl sm:text-3xl font-bold text-primary mt-1.5">
                      {result.translation}
                    </p>
                    {result.pronunciation && (
                      <p className="font-mono text-xs text-secondary-terracotta font-semibold mt-0.5">
                        Pelafalan: /{result.pronunciation}/
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => speakPhrase(result.translation)}
                      aria-label="Putar pelafalan hasil terjemahan"
                      className="p-2.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed hover:bg-tertiary-gold"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopy(result.translation)}
                      aria-label="Salin terjemahan"
                      className="p-2.5 rounded-full bg-surface-ivory border border-on-surface-bark/15 hover:bg-surface-container"
                    >
                      {copied ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Word-by-word breakdown when composed from verified dictionary */}
                {Array.isArray(result.wordBreakdown) && result.wordBreakdown.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {result.wordBreakdown.map((wb: any, idx: number) => (
                      <span
                        key={idx}
                        className={`text-[11px] px-2.5 py-1 rounded-xl font-semibold border ${
                          wb.verified
                            ? 'bg-primary-fixed/60 border-primary/20 text-primary'
                            : 'bg-surface-ivory border-on-surface-bark/15 text-on-surface-variant'
                        }`}
                      >
                        {wb.source} → <strong>{wb.translated}</strong>
                      </span>
                    ))}
                  </div>
                )}

                {result.exampleSentence && (
                  <div className="p-3 rounded-xl bg-surface-ivory border border-on-surface-bark/10 text-xs space-y-0.5">
                    <p className="font-bold text-on-surface">Contoh: "{result.exampleSentence}"</p>
                    <p className="text-on-surface-variant italic">"{result.exampleTranslation}"</p>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <span className="text-[11px] text-outline">{result.sourceMetadata}</span>
                  <button
                    type="button"
                    onClick={async () => {
                      await handleSaveVocab({
                        vocabularyId: result.vocabularyId,
                        languageId: selectedLangId,
                        regionalWord:
                          direction === 'id-to-regional' ? result.translation : inputText.trim(),
                        indonesianMeaning:
                          direction === 'id-to-regional' ? inputText.trim() : result.translation,
                        pronunciation: result.pronunciation || '',
                        notes: result.exampleSentence || '',
                      });
                      setSavedMain(true);
                    }}
                    className="btn-foliage px-3.5 py-1.5 text-xs inline-flex items-center gap-1.5"
                  >
                    {savedMain ? (
                      <>
                        <BookmarkCheck className="w-3.5 h-3.5" /> Tersimpan di Profil
                      </>
                    ) : (
                      <>
                        <Bookmark className="w-3.5 h-3.5" /> Simpan Kosakata
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-start gap-2.5 text-on-tertiary-fixed">
                  <AlertCircle className="w-5 h-5 text-secondary-terracotta shrink-0 mt-0.5" />
                  <div>
                    <p className="font-display font-bold text-base text-on-surface">
                      Frasa Belum Tersedia di Kamus {activeLangObj?.language_name}
                    </p>
                    <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                      {result.message}
                    </p>
                  </div>
                </div>

                {Array.isArray(result.matches) && result.matches.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <p className="text-[11px] font-bold uppercase text-primary">
                      Coba Kosakata Terverifikasi {activeLangObj?.language_name}:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {result.matches.map((m: VocabularyEntry) => {
                        const label =
                          direction === 'id-to-regional'
                            ? m.indonesian_meaning.split('/')[0].trim()
                            : m.regional_word.split('/')[0].trim();
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => handleTranslate(undefined, label)}
                            className="text-xs font-semibold px-2.5 py-1 rounded-full bg-surface-ivory border border-primary/20 hover:bg-primary-fixed/50 text-primary"
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </form>
      </section>

      {/* Regional Dictionary Section (All 78 Languages Accessible!) */}
      <section className="storybook-card p-5 sm:p-7 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-bold text-primary flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-secondary-terracotta" />
              Kamus Daerah Nusantara (38 Provinsi)
            </h2>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Jelajahi dan cari kosakata terverifikasi dari seluruh {verifiedLangCount} bahasa daerah di Indonesia.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative">
              <Search className="w-4 h-4 text-outline absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={dictSearch}
                onChange={(e) => setDictSearch(e.target.value)}
                placeholder="Cari kata, bahasa, atau provinsi..."
                aria-label="Cari di Kamus Daerah"
                className="logatara-input pl-10 pr-4 py-2 text-sm w-full sm:w-64"
              />
            </div>

            <select
              value={dictLangFilter}
              onChange={(e) => setDictLangFilter(e.target.value)}
              aria-label="Filter bahasa kamus"
              className="bg-surface-rice border-2 border-on-surface-bark/15 rounded-2xl px-3.5 py-2 text-sm font-semibold text-on-surface max-w-xs"
            >
              <option value="all">Semua 78 Bahasa Terverifikasi</option>
              {languages.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.language_name}, {l.province_name} ({l.vocab_count || 0} kata)
                </option>
              ))}
            </select>
          </div>
        </div>

        {loadingDict ? (
          <p className="text-center py-8 text-sm text-on-surface-variant">Memuat entri kamus...</p>
        ) : dictEntries.length === 0 ? (
          <div className="p-8 rounded-2xl bg-surface-low text-center text-sm text-on-surface-variant">
            Tidak ditemukan entri kamus yang cocok dengan pencarianmu.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {dictEntries.map((entry) => (
              <article
                key={entry.id}
                className="p-4 rounded-2xl bg-surface-low border border-on-surface-bark/10 flex flex-col justify-between gap-3 hover:shadow-sm transition-shadow"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2 py-0.5 rounded-full bg-primary-fixed text-primary text-[10px] font-bold">
                      {entry.language_name} • {entry.province_name}
                    </span>
                    <span className="text-[10px] font-semibold text-on-surface-variant">
                      {entry.register_level}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-display text-lg font-bold text-on-surface">
                        {entry.regional_word}
                      </h3>
                      <p className="text-sm font-semibold text-primary">{entry.indonesian_meaning}</p>
                      <p className="font-mono text-xs text-secondary-terracotta">
                        /{entry.pronunciation}/
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => speakPhrase(entry.regional_word)}
                      aria-label={`Putar suara ${entry.regional_word}`}
                      className="p-2 rounded-full bg-tertiary-fixed text-on-tertiary-fixed hover:bg-tertiary-gold shrink-0"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-xs text-on-surface-variant pt-1">
                    <strong>Contoh:</strong> "{entry.example_sentence}"
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-on-surface-bark/10">
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-primary">
                    <CheckCircle2 className="w-3 h-3" /> Kamus Terverifikasi
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      handleSaveVocab({
                        vocabularyId: entry.id,
                        languageId: entry.language_id,
                        regionalWord: entry.regional_word,
                        indonesianMeaning: entry.indonesian_meaning,
                        pronunciation: entry.pronunciation,
                        notes: entry.example_sentence,
                      })
                    }
                    className={`text-xs font-bold inline-flex items-center gap-1 px-2.5 py-1 rounded-full transition-colors ${
                      entry.is_saved
                        ? 'bg-primary-fixed text-primary'
                        : 'bg-surface-ivory text-on-surface-bark hover:bg-surface-container'
                    }`}
                  >
                    {entry.is_saved ? (
                      <>
                        <BookmarkCheck className="w-3.5 h-3.5" /> Tersimpan
                      </>
                    ) : (
                      <>
                        <Bookmark className="w-3.5 h-3.5" /> Simpan
                      </>
                    )}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
