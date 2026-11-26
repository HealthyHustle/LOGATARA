import React, { useState } from 'react';
import { Volume2, Bookmark, BookmarkCheck, Sparkles, BookOpen, CheckCircle2, ArrowRight } from 'lucide-react';
import type { LearningModule, ModuleVocabItem } from '../../types';
import { speakPhrase, playSoundEffect } from '../../services/audio/speechService';
import { apiRequest } from '../../services/api/client';

interface LearningModuleViewProps {
  module: LearningModule;
  languageId: number;
  languageName: string;
  completed: boolean;
  onCompleteModule: () => Promise<void>;
}

export function LearningModuleView({
  module,
  languageId,
  languageName,
  completed,
  onCompleteModule,
}: LearningModuleViewProps) {
  const [speakingWord, setSpeakingWord] = useState<string | null>(null);
  const [savedWords, setSavedWords] = useState<Set<string>>(new Set());
  const [audioWarning, setAudioWarning] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handlePlay = (text: string) => {
    setAudioWarning(null);
    speakPhrase(text, {
      languageName,
      onStart: () => setSpeakingWord(text),
      onEnd: () => setSpeakingWord(null),
      onError: (msg) => {
        setSpeakingWord(null);
        setAudioWarning(msg);
      },
    });
  };

  const handleSaveVocab = async (item: ModuleVocabItem) => {
    try {
      await apiRequest('/saved-vocabulary', {
        method: 'POST',
        body: JSON.stringify({
          languageId,
          regionalWord: item.word,
          indonesianMeaning: item.meaning,
          pronunciation: item.pron,
          notes: item.ex,
        }),
      });
      setSavedWords((prev) => new Set(prev).add(item.word));
      playSoundEffect('correct');
    } catch {
      // Non-fatal
    }
  };

  const handleFinish = async () => {
    setSubmitting(true);
    try {
      await onCompleteModule();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Module Header */}
      <div className="storybook-card p-6 bg-gradient-to-br from-surface-ivory to-surface-low space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-fixed text-primary text-xs font-bold">
            <BookOpen className="w-3.5 h-3.5" />
            Modul Belajar • {languageName}
          </span>
          {completed && (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-primary">
              <CheckCircle2 className="w-4 h-4" /> Sudah Dipelajari
            </span>
          )}
        </div>
        <h2 className="font-display text-2xl sm:text-3xl font-bold text-primary">{module.title}</h2>
        <p className="text-sm text-on-surface-variant leading-relaxed">{module.summary}</p>
      </div>

      {audioWarning && (
        <div className="p-3.5 rounded-2xl bg-tertiary-fixed/70 text-on-tertiary-fixed text-xs font-semibold">
          ℹ️ {audioWarning}
        </div>
      )}

      {/* Vocabulary Cards */}
      <section className="space-y-3">
        <h3 className="font-display text-xl font-bold text-on-surface">
          Kosakata & Ungkapan Penting
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {module.vocabulary.map((item) => {
            const isPlaying = speakingWord === item.word;
            const isSaved = savedWords.has(item.word);
            return (
              <article
                key={item.word}
                className="storybook-card p-5 flex flex-col justify-between gap-3 batik-watermark"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => handlePlay(item.word)}
                      aria-label={`Dengarkan pelafalan ${item.word}`}
                      className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 transition-all shadow-sm ${
                        isPlaying
                          ? 'bg-secondary-terracotta text-white scale-105'
                          : 'bg-tertiary-fixed text-on-tertiary-fixed hover:bg-tertiary-gold'
                      }`}
                    >
                      <Volume2 className="w-5 h-5" />
                    </button>
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <h4 className="font-display text-xl font-bold text-primary">{item.word}</h4>
                        {item.register && (
                          <span className="px-2 py-0.5 rounded-full bg-surface-container text-[10px] font-bold text-on-surface-bark">
                            {item.register}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-on-surface mt-0.5">{item.meaning}</p>
                      <p className="text-xs font-mono text-secondary-terracotta mt-0.5">
                        /{item.pron}/
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSaveVocab(item)}
                    title="Simpan ke Kamus Saku"
                    aria-label={`Simpan ${item.word} ke Kamus Saku`}
                    className={`p-2 rounded-full transition-colors ${
                      isSaved
                        ? 'bg-primary-fixed text-primary'
                        : 'bg-surface-container/70 text-on-surface-bark hover:bg-surface-high'
                    }`}
                  >
                    {isSaved ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
                  </button>
                </div>

                <div className="p-3 rounded-2xl bg-surface-low text-xs space-y-0.5 border border-on-surface-bark/10">
                  <p className="font-bold text-on-surface">"{item.ex}"</p>
                  <p className="text-on-surface-variant italic">Artinya: "{item.exTr}"</p>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Pronunciation & Cultural Context */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <section className="storybook-card p-5 bg-surface-low space-y-2">
          <h3 className="font-display text-lg font-bold text-primary flex items-center gap-2">
            <Volume2 className="w-5 h-5 text-secondary-terracotta" />
            Panduan Pelafalan
          </h3>
          <p className="text-sm text-on-surface-variant leading-relaxed">
            {module.pronunciation_notes}
          </p>
        </section>

        <section className="storybook-card p-5 bg-surface-low space-y-2">
          <h3 className="font-display text-lg font-bold text-primary flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-tertiary-gold" />
            Konteks Budaya & Tata Krama
          </h3>
          <p className="text-sm text-on-surface-variant leading-relaxed">
            {module.cultural_context}
          </p>
          <p className="text-[11px] text-outline pt-1">Sumber: {module.source_metadata}</p>
        </section>
      </div>

      {/* Complete Module Action */}
      <div className="flex justify-end">
        <button
          type="button"
          disabled={submitting}
          onClick={handleFinish}
          className="btn-adventure px-7 py-3.5 text-base inline-flex items-center gap-2 disabled:opacity-60"
        >
          <span>
            {submitting
              ? 'Menyimpan...'
              : completed
                ? 'Lanjut ke Permainan Berbicara'
                : 'Saya Siap! Mulai Permainan (+20 XP)'}
          </span>
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
