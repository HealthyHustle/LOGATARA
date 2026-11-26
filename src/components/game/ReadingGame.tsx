import React, { useState } from 'react';
import { BookOpen, Sparkles, Volume2, CheckCircle2, XCircle, ArrowRight } from 'lucide-react';
import type { GameActivity } from '../../types';
import { speakPhrase, playSoundEffect } from '../../services/audio/speechService';

interface ReadingGameProps {
  activity: GameActivity;
  onSubmitActivity: (
    answers: Array<{ questionId: number; answer: string; evaluationMode: string }>
  ) => Promise<any>;
  onNextTab: () => void;
}

export function ReadingGame({ activity, onSubmitActivity, onNextTab }: ReadingGameProps) {
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});
  const [activeHighlight, setActiveHighlight] = useState<{
    word: string;
    meaning: string;
    pronunciation: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);

  const story = activity.story;

  // Highlight regional vocabulary occurrences interactively inside story paragraphs
  const renderHighlightedParagraph = (paragraph: string) => {
    if (!story?.highlights?.length) return paragraph;
    const sorted = [...story.highlights].sort((a, b) => b.word.length - a.word.length);
    const escaped = sorted.map((h) => h.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const regex = new RegExp(`(${escaped.join('|')})`, 'gi');
    const parts = paragraph.split(regex);

    return parts.map((part, i) => {
      const match = sorted.find((h) => h.word.toLowerCase() === part.toLowerCase());
      if (!match) return <React.Fragment key={i}>{part}</React.Fragment>;
      return (
        <button
          key={i}
          type="button"
          onClick={() => {
            setActiveHighlight(match);
            playSoundEffect('click');
          }}
          className="inline px-1.5 py-0.5 mx-0.5 rounded-lg bg-tertiary-fixed/80 hover:bg-tertiary-gold/70 text-primary font-bold underline decoration-secondary-terracotta decoration-dotted underline-offset-4 transition-colors"
        >
          {part}
        </button>
      );
    });
  };

  const allAnswered = activity.questions.every((q) => Boolean(selectedAnswers[q.id]));

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const payload = activity.questions.map((q) => ({
        questionId: q.id,
        answer: selectedAnswers[q.id] || '',
        evaluationMode: 'mcq',
      }));
      const res = await onSubmitActivity(payload);
      setResult(res);
      playSoundEffect(res.passed ? 'celebrate' : 'wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const resultMap = new Map<number, any>(
    (result?.results || []).map((r: any) => [r.questionId, r])
  );

  return (
    <div className="space-y-6">
      {/* Regional Storybook Passage */}
      {story && (
        <section className="storybook-card p-6 sm:p-7 batik-watermark space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-fixed text-primary text-xs font-bold">
              <BookOpen className="w-3.5 h-3.5" />
              Kisah Kampung • {story.location}
            </span>
            <span className="text-xs font-semibold text-secondary-terracotta">
              Klik kata yang disorot untuk melihat artinya!
            </span>
          </div>

          <h3 className="font-display text-2xl sm:text-3xl font-bold text-primary">
            {story.title}
          </h3>

          <div className="space-y-3 text-base text-on-surface leading-relaxed">
            {story.paragraphs.map((p, idx) => (
              <p key={idx}>{renderHighlightedParagraph(p)}</p>
            ))}
          </div>

          {/* Interactive Highlight Glossary Pop-out */}
          {activeHighlight && (
            <div className="p-4 rounded-2xl bg-surface-low border-2 border-tertiary-gold flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-[11px] font-bold uppercase text-secondary-terracotta">
                  Kosakata Tersorot
                </span>
                <p className="font-display text-xl font-bold text-primary">
                  {activeHighlight.word}{' '}
                  <span className="font-mono text-xs text-secondary-terracotta font-semibold">
                    /{activeHighlight.pronunciation}/
                  </span>
                </p>
                <p className="text-sm font-semibold text-on-surface">
                  Artinya: "{activeHighlight.meaning}"
                </p>
              </div>
              <button
                type="button"
                onClick={() => speakPhrase(activeHighlight.word)}
                className="btn-foliage px-4 py-2 text-xs inline-flex items-center gap-1.5"
              >
                <Volume2 className="w-4 h-4" />
                <span>Dengar Pelafalan</span>
              </button>
            </div>
          )}

          {/* Cultural Insight Box */}
          <div className="p-4 rounded-2xl bg-surface-container/70 flex items-start gap-2.5 text-xs sm:text-sm text-on-surface-bark">
            <Sparkles className="w-5 h-5 text-secondary-terracotta shrink-0 mt-0.5" />
            <div>
              <strong>Wawasan Budaya:</strong> {story.culturalNote}
            </div>
          </div>
        </section>
      )}

      {/* Reading Comprehension Questions */}
      <div className="space-y-4">
        {activity.questions.map((q, idx) => {
          const resItem = resultMap.get(q.id);
          return (
            <article key={q.id} className="storybook-card p-5 sm:p-6 space-y-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-secondary-terracotta">
                  Pertanyaan Pemahaman {idx + 1} dari {activity.questions.length}
                </span>
                <h4 className="font-display text-lg sm:text-xl font-bold text-on-surface mt-1">
                  {q.prompt}
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {q.options.map((opt) => {
                  const chosen = selectedAnswers[q.id] === opt;
                  const isCorrectOpt = resItem && opt === resItem.correctAnswer;
                  const isWrongChosen = resItem && chosen && !resItem.isCorrect;

                  return (
                    <button
                      key={opt}
                      type="button"
                      disabled={Boolean(result?.passed)}
                      onClick={() => {
                        playSoundEffect('click');
                        setSelectedAnswers((prev) => ({ ...prev, [q.id]: opt }));
                      }}
                      className={`p-4 rounded-2xl border-2 text-left font-semibold text-sm transition-all flex items-center justify-between gap-2 ${
                        isCorrectOpt
                          ? 'bg-primary-fixed border-primary text-primary'
                          : isWrongChosen
                            ? 'bg-error-container border-error text-on-error-container'
                            : chosen
                              ? 'bg-secondary-fixed/60 border-secondary-terracotta text-on-surface shadow-sm'
                              : 'bg-surface-ivory border-on-surface-bark/12 hover:bg-surface-low text-on-surface'
                      }`}
                    >
                      <span>{opt}</span>
                      {isCorrectOpt && <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />}
                      {isWrongChosen && <XCircle className="w-5 h-5 text-error shrink-0" />}
                    </button>
                  );
                })}
              </div>

              {resItem && (
                <div
                  className={`p-3.5 rounded-2xl text-xs sm:text-sm font-medium ${
                    resItem.isCorrect
                      ? 'bg-primary-fixed/50 text-primary'
                      : 'bg-error-container/70 text-on-error-container'
                  }`}
                >
                  <strong>{resItem.isCorrect ? 'Tepat sekali!' : 'Kurang tepat.'}</strong>{' '}
                  {resItem.explanation}
                </div>
              )}
            </article>
          );
        })}
      </div>

      {/* Footer */}
      {result ? (
        <div
          className={`storybook-card p-5 flex flex-col sm:flex-row items-center justify-between gap-4 ${
            result.passed ? 'bg-primary-fixed/50 border-primary/30' : 'bg-error-container/60'
          }`}
        >
          <div>
            <h4 className="font-display text-lg font-bold text-on-surface">
              Skor Membaca: {result.correctCount}/{result.totalQuestions} ({result.scorePercent}%)
            </h4>
            <p className="text-xs text-on-surface-variant">
              {result.passed
                ? result.xpAwarded > 0
                  ? `Keren! +${result.xpAwarded} XP ditambahkan.`
                  : 'Lulus! (XP aktivitas sudah tercatat sebelumnya.)'
                : 'Yuk baca ulang cerita dengan saksama dan coba lagi!'}
            </p>
          </div>
          {result.passed ? (
            <button
              type="button"
              onClick={onNextTab}
              className="btn-adventure px-6 py-3 text-sm inline-flex items-center gap-2"
            >
              <span>Lanjut ke Menulis</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setResult(null)}
              className="btn-adventure px-6 py-3 text-sm"
            >
              Coba Lagi
            </button>
          )}
        </div>
      ) : (
        <div className="flex justify-end">
          <button
            type="button"
            disabled={!allAnswered || submitting}
            onClick={handleSubmit}
            className="btn-adventure px-7 py-3.5 text-base inline-flex items-center gap-2 disabled:opacity-50"
          >
            <span>{submitting ? 'Memeriksa Pemahaman...' : 'Periksa Jawaban Membaca'}</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}
