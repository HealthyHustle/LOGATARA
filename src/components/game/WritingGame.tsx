import React, { useState } from 'react';
import { RotateCcw, Lightbulb, CheckCircle2, XCircle, ArrowRight } from 'lucide-react';
import type { GameActivity } from '../../types';
import { playSoundEffect } from '../../services/audio/speechService';

interface WritingGameProps {
  activity: GameActivity;
  onSubmitActivity: (
    answers: Array<{ questionId: number; answer: string; evaluationMode: string }>
  ) => Promise<any>;
  onAllGamesReady: () => void;
}

export function WritingGame({
  activity,
  onSubmitActivity,
  onAllGamesReady,
}: WritingGameProps) {
  // For arrange questions: ordered list of chosen tile indices
  const [arrangedIndices, setArrangedIndices] = useState<Record<number, number[]>>({});
  // For translate typing questions: free text value
  const [typedAnswers, setTypedAnswers] = useState<Record<number, string>>({});
  const [showHint, setShowHint] = useState<Record<number, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);

  const toggleArrangeToken = (qId: number, idx: number) => {
    if (result?.passed) return;
    playSoundEffect('click');
    setArrangedIndices((prev) => {
      const curr = prev[qId] || [];
      if (curr.includes(idx)) {
        return { ...prev, [qId]: curr.filter((x) => x !== idx) };
      }
      return { ...prev, [qId]: [...curr, idx] };
    });
  };

  const getAnswerForQuestion = (q: GameActivity['questions'][number]) => {
    if (q.question_type === 'writing_arrange') {
      const idxs = arrangedIndices[q.id] || [];
      return idxs.map((i) => q.options[i]).join(' ');
    }
    return (typedAnswers[q.id] || '').trim();
  };

  const allAnswered = activity.questions.every((q) => getAnswerForQuestion(q).length > 0);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const payload = activity.questions.map((q) => ({
        questionId: q.id,
        answer: getAnswerForQuestion(q),
        evaluationMode: q.question_type,
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
      {activity.questions.map((q, idx) => {
        const resItem = resultMap.get(q.id);
        const isArrange = q.question_type === 'writing_arrange';
        const chosenIdxs = arrangedIndices[q.id] || [];

        return (
          <article key={q.id} className="storybook-card p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-secondary-terracotta">
                  Latihan Menulis {idx + 1} dari {activity.questions.length} •{' '}
                  {isArrange ? 'Susun Kalimat' : 'Terjemahan'}
                </span>
                <h3 className="font-display text-lg sm:text-xl font-bold text-on-surface mt-1">
                  {q.prompt}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setShowHint((p) => ({ ...p, [q.id]: !p[q.id] }))}
                className="btn-parchment px-3 py-1.5 text-xs inline-flex items-center gap-1"
              >
                <Lightbulb className="w-3.5 h-3.5 text-tertiary-gold" />
                <span>Petunjuk</span>
              </button>
            </div>

            {showHint[q.id] && (
              <div className="p-3 rounded-2xl bg-tertiary-fixed/60 text-xs text-on-tertiary-fixed font-semibold">
                💡 Pelafalan kunci: /{q.pronunciation_guide}/ • Kata awal:{' '}
                <strong>"{q.correct_answer.split(' ')[0]}"</strong>
              </div>
            )}

            {isArrange ? (
              <div className="space-y-4">
                {/* Sentence Construction Tray */}
                <div className="min-h-[64px] p-3.5 rounded-2xl bg-surface-rice border-2 border-dashed border-on-surface-bark/25 flex flex-wrap items-center gap-2">
                  {chosenIdxs.length === 0 ? (
                    <span className="text-xs text-outline">
                      Klik potongan kata di bawah sesuai urutan kalimat yang benar...
                    </span>
                  ) : (
                    chosenIdxs.map((optIdx, pos) => (
                      <button
                        key={`${optIdx}-${pos}`}
                        type="button"
                        disabled={Boolean(result?.passed)}
                        onClick={() => toggleArrangeToken(q.id, optIdx)}
                        className="px-3.5 py-2 rounded-xl bg-primary text-white font-display font-bold text-sm shadow-sm hover:brightness-110 transition-all"
                      >
                        {q.options[optIdx]}
                      </button>
                    ))
                  )}
                </div>

                {/* Available Word Bank */}
                <div className="flex flex-wrap items-center gap-2">
                  {q.options.map((token, optIdx) => {
                    const used = chosenIdxs.includes(optIdx);
                    return (
                      <button
                        key={`${token}-${optIdx}`}
                        type="button"
                        disabled={used || Boolean(result?.passed)}
                        onClick={() => toggleArrangeToken(q.id, optIdx)}
                        className={`px-4 py-2 rounded-xl font-display font-bold text-sm border-2 transition-all ${
                          used
                            ? 'bg-surface-container/40 border-transparent text-transparent select-none'
                            : 'bg-surface-ivory border-on-surface-bark/20 border-b-4 text-on-surface hover:bg-surface-low active:translate-y-0.5'
                        }`}
                      >
                        {token}
                      </button>
                    );
                  })}

                  {chosenIdxs.length > 0 && !result?.passed && (
                    <button
                      type="button"
                      onClick={() => setArrangedIndices((p) => ({ ...p, [q.id]: [] }))}
                      className="ml-auto text-xs font-bold text-on-surface-variant hover:text-secondary-terracotta inline-flex items-center gap-1"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Susun Ulang
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <label htmlFor={`write-input-${q.id}`} className="sr-only">
                  Jawaban terjemahan
                </label>
                <input
                  id={`write-input-${q.id}`}
                  type="text"
                  disabled={Boolean(result?.passed)}
                  value={typedAnswers[q.id] || ''}
                  onChange={(e) =>
                    setTypedAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                  }
                  placeholder="Ketik jawaban bahasa daerahmu di sini..."
                  className="logatara-input w-full px-4 py-3 text-base"
                />
              </div>
            )}

            {resItem && (
              <div
                className={`p-3.5 rounded-2xl text-xs sm:text-sm font-medium flex items-start gap-2 ${
                  resItem.isCorrect
                    ? 'bg-primary-fixed/50 text-primary'
                    : 'bg-error-container/70 text-on-error-container'
                }`}
              >
                {resItem.isCorrect ? (
                  <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-5 h-5 shrink-0 mt-0.5" />
                )}
                <div>
                  <strong>{resItem.isCorrect ? 'Benar sekali!' : `Jawaban benar: "${resItem.correctAnswer}"`}</strong>{' '}
                  {resItem.explanation}
                </div>
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
              Skor Menulis: {result.correctCount}/{result.totalQuestions} ({result.scorePercent}%)
            </h4>
            <p className="text-xs text-on-surface-variant">
              {result.passed
                ? result.xpAwarded > 0
                  ? `Luar biasa! +${result.xpAwarded} XP ditambahkan.`
                  : 'Lulus! (XP aktivitas sudah tercatat sebelumnya.)'
                : 'Coba periksa kembali susunan kata atau gunakan tombol Petunjuk ya!'}
            </p>
          </div>
          {result.passed ? (
            <button
              type="button"
              onClick={onAllGamesReady}
              className="btn-adventure px-6 py-3 text-sm inline-flex items-center gap-2"
            >
              <span>Tuntaskan Level Sekarang!</span>
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
            <span>{submitting ? 'Memeriksa Tulisan...' : 'Periksa Jawaban Menulis'}</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}
