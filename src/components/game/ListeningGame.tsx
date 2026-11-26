import React, { useState } from 'react';
import { Volume2, RotateCcw, CheckCircle2, XCircle, ArrowRight, Eye } from 'lucide-react';
import type { GameActivity } from '../../types';
import { speakPhrase, playSoundEffect } from '../../services/audio/speechService';

interface ListeningGameProps {
  activity: GameActivity;
  onSubmitActivity: (
    answers: Array<{ questionId: number; answer: string; evaluationMode: string }>
  ) => Promise<any>;
  onNextTab: () => void;
}

export function ListeningGame({
  activity,
  onSubmitActivity,
  onNextTab,
}: ListeningGameProps) {
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const [showClue, setShowClue] = useState<Record<number, boolean>>({});
  const [audioFailedFor, setAudioFailedFor] = useState<Record<number, boolean>>({});
  const [audioFallbackMsg, setAudioFallbackMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);

  const buildMaskedAudioClue = (phrase: string) => {
    const words = phrase.replace(/[?!.,]/g, '').trim().split(/\s+/).filter(Boolean);
    const masked = words
      .map((w) => (w.length <= 2 ? `${w[0]}_` : `${w[0]}${'_'.repeat(Math.min(5, w.length - 1))}`))
      .join('  ');
    return `${masked} (${words.length} kata, coba tombol "Putar Pelan" untuk menyimak suku katanya)`;
  };

  const playAudio = (qId: number, text: string, slow = false) => {
    setAudioFallbackMsg(null);
    const key = `${qId}-${slow ? 'slow' : 'norm'}`;
    speakPhrase(text, {
      rate: slow ? 0.68 : 0.92,
      onStart: () => setPlayingKey(key),
      onEnd: () => setPlayingKey(null),
      onError: (msg) => {
        setPlayingKey(null);
        setAudioFallbackMsg(msg);
        setAudioFailedFor((prev) => ({ ...prev, [qId]: true }));
        setShowClue((prev) => ({ ...prev, [qId]: true }));
      },
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
    <div className="space-y-5">
      {audioFallbackMsg && (
        <div className="p-3.5 rounded-2xl bg-tertiary-fixed/70 text-on-tertiary-fixed text-xs font-semibold">
          ℹ️ {audioFallbackMsg}
        </div>
      )}

      {activity.questions.map((q, idx) => {
        const resItem = resultMap.get(q.id);
        return (
          <article key={q.id} className="storybook-card p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-secondary-terracotta">
                  Soal Mendengarkan {idx + 1} dari {activity.questions.length}
                </span>
                <h3 className="font-display text-lg sm:text-xl font-bold text-on-surface mt-1">
                  {q.prompt}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setShowClue((p) => ({ ...p, [q.id]: !p[q.id] }))}
                className="text-xs font-bold text-on-surface-variant hover:text-primary inline-flex items-center gap-1"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>{showClue[q.id] ? 'Sembunyikan Petunjuk' : 'Petunjuk Audio'}</span>
              </button>
            </div>

            {/* Audio Controls Bar */}
            <div className="p-4 rounded-2xl bg-surface-low border border-on-surface-bark/10 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => playAudio(q.id, q.regional_text, false)}
                className="btn-foliage px-5 py-2.5 text-sm inline-flex items-center gap-2"
              >
                <Volume2 className="w-5 h-5" />
                <span>{playingKey === `${q.id}-norm` ? 'Memutar Audio...' : 'Putar Audio'}</span>
              </button>

              <button
                type="button"
                onClick={() => playAudio(q.id, q.regional_text, true)}
                className="btn-parchment px-4 py-2.5 text-xs inline-flex items-center gap-1.5"
              >
                <RotateCcw className="w-4 h-4 text-secondary-terracotta" />
                <span>{playingKey === `${q.id}-slow` ? 'Memutar Pelan...' : 'Putar Pelan (0.7x)'}</span>
              </button>

              {showClue[q.id] && (
                <div className="px-3.5 py-2 rounded-xl bg-surface-ivory border border-on-surface-bark/10 text-xs sm:text-sm">
                  {audioFailedFor[q.id] ? (
                    <>
                      <span className="font-display font-bold text-primary">"{q.regional_text}"</span>
                      <span className="ml-2 font-mono text-xs text-secondary-terracotta">
                        /{q.pronunciation_guide}/
                      </span>
                    </>
                  ) : (
                    <span className="font-semibold text-on-surface-bark">
                      💡 Petunjuk pola kata: <span className="font-mono text-primary">{buildMaskedAudioClue(q.regional_text)}</span>
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Multiple Choice Tiles */}
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
                <strong>{resItem.isCorrect ? 'Benar!' : 'Belum Tepat.'}</strong> {resItem.explanation}
              </div>
            )}
          </article>
        );
      })}

      {/* Submission Footer */}
      {result ? (
        <div
          className={`storybook-card p-5 flex flex-col sm:flex-row items-center justify-between gap-4 ${
            result.passed ? 'bg-primary-fixed/50 border-primary/30' : 'bg-error-container/60'
          }`}
        >
          <div>
            <h4 className="font-display text-lg font-bold text-on-surface">
              Skor Mendengarkan: {result.correctCount}/{result.totalQuestions} ({result.scorePercent}%)
            </h4>
            <p className="text-xs text-on-surface-variant">
              {result.passed
                ? result.xpAwarded > 0
                  ? `Hebat! +${result.xpAwarded} XP ditambahkan.`
                  : 'Lulus! (XP aktivitas sudah tercatat sebelumnya.)'
                : 'Minimal 50% benar untuk lulus. Putar ulang audio dan coba lagi ya!'}
            </p>
          </div>
          {result.passed ? (
            <button
              type="button"
              onClick={onNextTab}
              className="btn-adventure px-6 py-3 text-sm inline-flex items-center gap-2"
            >
              <span>Lanjut ke Membaca</span>
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
            <span>{submitting ? 'Memeriksa Jawaban...' : 'Periksa Jawaban Mendengarkan'}</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}
