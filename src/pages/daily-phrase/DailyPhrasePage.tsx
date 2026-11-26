import React, { useEffect, useState } from 'react';
import { Volume2, Bookmark, BookmarkCheck, Sparkles, MapPin, MessageCircle, Calendar } from 'lucide-react';
import { apiRequest } from '../../services/api/client';
import { speakPhrase, playSoundEffect } from '../../services/audio/speechService';
import type { DailyPhrase } from '../../types';

export function DailyPhrasePage() {
  const [todayPhrase, setTodayPhrase] = useState<DailyPhrase | null>(null);
  const [history, setHistory] = useState<DailyPhrase[]>([]);
  const [loading, setLoading] = useState(true);
  const [speakingId, setSpeakingId] = useState<number | null>(null);

  const loadPhrases = async () => {
    setLoading(true);
    try {
      const data = await apiRequest<{ todayPhrase: DailyPhrase | null; history: DailyPhrase[] }>(
        '/daily-phrases'
      );
      setTodayPhrase(data.todayPhrase);
      setHistory(data.history || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPhrases();
  }, []);

  const toggleSave = async (phrase: DailyPhrase) => {
    if (phrase.is_saved) {
      await apiRequest(`/daily-phrases/${phrase.id}/save`, { method: 'DELETE' });
    } else {
      await apiRequest(`/daily-phrases/${phrase.id}/save`, { method: 'POST' });
      playSoundEffect('correct');
    }
    loadPhrases();
  };

  if (loading) {
    return (
      <div className="storybook-card p-12 text-center text-on-surface-variant">
        Memuat Frasa Nusantara Hari Ini...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <section className="storybook-card p-6 batik-watermark">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary-fixed text-on-secondary-fixed text-xs font-bold uppercase">
          <Sparkles className="w-3.5 h-3.5" />
          Inspirasi Bahasa Daerah Harian
        </span>
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-primary mt-2">
          Frasa Nusantara Hari Ini
        </h1>
        <p className="text-sm text-on-surface-variant mt-1 max-w-2xl">
          Kenali satu ungkapan daerah yang kaya tata krama setiap hari beserta cara pelafalan, konteks budaya, dan contoh percakapannya.
        </p>
      </section>

      {/* Featured Daily Phrase Hero Card */}
      {todayPhrase && (
        <section className="storybook-card p-6 sm:p-8 relative overflow-hidden bg-gradient-to-br from-surface-ivory via-surface-low to-surface-container/50">
          <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-secondary-terracotta via-tertiary-gold to-primary-olive" />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start pt-2">
            <div className="lg:col-span-7 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-primary text-white text-xs font-bold">
                  {todayPhrase.language_name}
                </span>
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-tertiary-fixed text-on-tertiary-fixed text-xs font-bold">
                  <MapPin className="w-3.5 h-3.5" />
                  {todayPhrase.province_name}
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-on-surface-variant">
                  <Calendar className="w-3.5 h-3.5" />
                  {todayPhrase.phrase_date}
                </span>
              </div>

              <div>
                <h2 className="font-display text-3xl sm:text-5xl font-bold text-primary leading-tight">
                  "{todayPhrase.regional_phrase}"
                </h2>
                <p className="text-lg sm:text-xl font-bold text-secondary-terracotta mt-2">
                  Artinya: "{todayPhrase.indonesian_meaning}"
                </p>
                <p className="font-mono text-sm text-on-surface-bark bg-surface-ivory inline-block px-3.5 py-1.5 rounded-xl border border-on-surface-bark/10 mt-2">
                  Pelafalan: {todayPhrase.pronunciation}
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-surface-ivory border border-on-surface-bark/10 text-sm text-on-surface-variant leading-relaxed">
                <strong className="text-on-surface">Konteks Budaya & Tata Krama:</strong>{' '}
                {todayPhrase.cultural_context}
                <p className="text-[11px] text-outline mt-2">Sumber: {todayPhrase.source_metadata}</p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() =>
                    speakPhrase(todayPhrase.regional_phrase, {
                      onStart: () => setSpeakingId(todayPhrase.id),
                      onEnd: () => setSpeakingId(null),
                    })
                  }
                  className="btn-foliage px-5 py-3 text-sm inline-flex items-center gap-2"
                >
                  <Volume2 className="w-5 h-5" />
                  <span>{speakingId === todayPhrase.id ? 'Memutar Suara...' : 'Dengar Pelafalan'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => toggleSave(todayPhrase)}
                  className={`${
                    todayPhrase.is_saved ? 'btn-parchment' : 'btn-adventure'
                  } px-5 py-3 text-sm inline-flex items-center gap-2`}
                >
                  {todayPhrase.is_saved ? (
                    <>
                      <BookmarkCheck className="w-5 h-5 text-primary" />
                      <span>Tersimpan di Profil</span>
                    </>
                  ) : (
                    <>
                      <Bookmark className="w-5 h-5" />
                      <span>Simpan ke Profil</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Example Conversation Panel */}
            <div className="lg:col-span-5 bg-surface-ivory rounded-3xl p-5 border border-on-surface-bark/12 shadow-storybook space-y-4">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-secondary-terracotta" />
                <h3 className="font-display text-lg font-bold text-primary">Contoh Percakapan</h3>
              </div>

              <div className="space-y-3">
                {todayPhrase.example_dialogue.map((line, i) => {
                  const isTara = line.speaker.toLowerCase().includes('tara');
                  return (
                    <div
                      key={i}
                      className={`p-3.5 rounded-2xl text-sm ${
                        isTara
                          ? 'bg-secondary-fixed/60 border border-secondary-terracotta/20 ml-4'
                          : 'bg-surface-low border border-on-surface-bark/10 mr-4'
                      }`}
                    >
                      <span
                        className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-full mb-1 ${
                          isTara ? 'bg-secondary-terracotta text-white' : 'bg-primary text-white'
                        }`}
                      >
                        {line.speaker}
                      </span>
                      <p className="font-medium text-on-surface leading-snug">"{line.text}"</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Previous Daily Phrases Archive */}
      <section className="space-y-4">
        <h2 className="font-display text-2xl font-bold text-primary">
          Arsip & Riwayat Frasa Nusantara
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {history.map((item) => (
            <article key={item.id} className="storybook-card p-5 flex flex-col justify-between gap-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-primary-fixed text-primary text-xs font-bold">
                    {item.language_name}
                  </span>
                  <span className="text-[11px] text-on-surface-variant font-semibold">
                    {item.province_name}
                  </span>
                </div>
                <h3 className="font-display text-xl font-bold text-on-surface">
                  "{item.regional_phrase}"
                </h3>
                <p className="text-sm font-semibold text-secondary-terracotta">
                  {item.indonesian_meaning}
                </p>
                <p className="font-mono text-xs text-on-surface-variant">{item.pronunciation}</p>
                <p className="text-xs text-on-surface-variant leading-relaxed line-clamp-3">
                  {item.cultural_context}
                </p>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-on-surface-bark/10">
                <button
                  type="button"
                  onClick={() =>
                    speakPhrase(item.regional_phrase, {
                      onStart: () => setSpeakingId(item.id),
                      onEnd: () => setSpeakingId(null),
                    })
                  }
                  className="btn-parchment px-3 py-1.5 text-xs inline-flex items-center gap-1.5"
                >
                  <Volume2 className="w-3.5 h-3.5 text-primary" />
                  <span>{speakingId === item.id ? 'Memutar...' : 'Dengar'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => toggleSave(item)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-1 ${
                    item.is_saved
                      ? 'bg-primary-fixed text-primary'
                      : 'bg-surface-container text-on-surface-bark hover:bg-surface-high'
                  }`}
                >
                  {item.is_saved ? (
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
      </section>
    </div>
  );
}
