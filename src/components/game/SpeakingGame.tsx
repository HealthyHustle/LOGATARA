import React, { useState, useRef, useEffect } from 'react';
import {
  Mic,
  Square,
  Volume2,
  Play,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Info,
  ArrowRight,
  RotateCcw,
} from 'lucide-react';
import type { GameActivity } from '../../types';
import {
  speakPhrase,
  playSoundEffect,
  isSpeechRecognitionSupported,
  resolveSpeechLocale,
  evaluateSpeechMatch,
} from '../../services/audio/speechService';

interface SpeakingGameProps {
  activity: GameActivity;
  languageName: string;
  onSubmitActivity: (
    answers: Array<{ questionId: number; answer: string; evaluationMode: string }>
  ) => Promise<any>;
  onNextTab: () => void;
}

interface RecordingEntry {
  audioUrl?: string;
  transcript?: string;
  evaluationMode: 'speech_recognition' | 'self_practice_recorded';
  liveMatch?: boolean;
  similarityPercent?: number;
  completed: boolean;
}

export function SpeakingGame({
  activity,
  languageName,
  onSubmitActivity,
  onNextTab,
}: SpeakingGameProps) {
  const [recordings, setRecordings] = useState<Record<number, RecordingEntry>>({});
  const [activeRecQuestionId, setActiveRecQuestionId] = useState<number | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<any>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<any>(null);
  const sttSupported = isSpeechRecognitionSupported();

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      try {
        recognitionRef.current?.stop();
      } catch {
        // Ignore
      }
    };
  }, []);

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    try {
      recognitionRef.current?.stop();
    } catch {
      // Ignore
    }
    setActiveRecQuestionId(null);
  };

  const startRecording = async (questionId: number, targetPhrase: string, acceptedAnswers: string[] = []) => {
    setPermissionError(null);
    if (submitResult && !submitResult.passed) setSubmitResult(null);

    if (activeRecQuestionId === questionId) {
      stopRecording();
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setPermissionError(
        'Perangkat atau browser ini tidak mendukung perekaman mikrofon. Kamu tetap bisa berlatih menggunakan tombol "Konfirmasi Latihan Pelafalan Mandiri" di bawah.'
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      let detectedTranscript = '';

      if (sttSupported) {
        const w = window as unknown as Record<string, any>;
        const RecCtor = w.SpeechRecognition || w.webkitSpeechRecognition;
        if (RecCtor) {
          const rec = new RecCtor();
          rec.lang = resolveSpeechLocale(languageName);
          rec.interimResults = false;
          rec.maxAlternatives = 3;
          rec.onresult = (evt: any) => {
            const alts: string[] = [];
            const res0 = evt.results?.[0];
            if (res0) {
              for (let i = 0; i < res0.length; i++) {
                if (res0[i]?.transcript) alts.push(String(res0[i].transcript));
              }
            }
            if (alts.length > 0) {
              // Pick the alternative with the highest match to target phrase to avoid penalizing STT accents
              let best = alts[0];
              let bestScore = -1;
              for (const alt of alts) {
                const ev = evaluateSpeechMatch(alt, targetPhrase, acceptedAnswers);
                if (ev.similarityPercent > bestScore) {
                  bestScore = ev.similarityPercent;
                  best = alt;
                }
              }
              detectedTranscript = best;
            }
          };
          rec.onerror = () => {};
          try {
            rec.start();
            recognitionRef.current = rec;
          } catch {
            // Non-blocking
          }
        }
      }

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(blob);
        stream.getTracks().forEach((t) => t.stop());

        if (detectedTranscript) {
          const evalRes = evaluateSpeechMatch(detectedTranscript, targetPhrase, acceptedAnswers);
          playSoundEffect(evalRes.isMatch ? 'correct' : 'wrong');
          setRecordings((prev) => ({
            ...prev,
            [questionId]: {
              audioUrl,
              transcript: detectedTranscript,
              evaluationMode: 'speech_recognition',
              liveMatch: evalRes.isMatch,
              similarityPercent: evalRes.similarityPercent,
              completed: true,
            },
          }));
        } else {
          playSoundEffect('click');
          setRecordings((prev) => ({
            ...prev,
            [questionId]: {
              audioUrl,
              transcript: undefined,
              evaluationMode: 'self_practice_recorded',
              completed: true,
            },
          }));
        }
      };

      setActiveRecQuestionId(questionId);
      recorder.start();
    } catch (err: any) {
      const denied = err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError';
      setPermissionError(
        denied
          ? 'Izin mikrofon ditolak oleh browser. Aktifkan izin mikrofon di bilah alamat, atau gunakan mode Latihan Pelafalan Mandiri.'
          : 'Mikrofon tidak terdeteksi pada perangkat ini. Kamu dapat menggunakan mode Latihan Pelafalan Mandiri.'
      );
    }
  };

  const markManualPractice = (questionId: number, targetPhrase: string) => {
    playSoundEffect('correct');
    if (submitResult && !submitResult.passed) setSubmitResult(null);
    setRecordings((prev) => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        transcript: `Latihan pelafalan mandiri: ${targetPhrase}`,
        evaluationMode: 'self_practice_recorded',
        liveMatch: undefined,
        similarityPercent: undefined,
        completed: true,
      },
    }));
  };

  const allCompleted = activity.questions.every((q) => recordings[q.id]?.completed);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const payload = activity.questions.map((q) => {
        const rec = recordings[q.id];
        return {
          questionId: q.id,
          answer: rec?.transcript || q.correct_answer,
          evaluationMode: rec?.evaluationMode || 'self_practice_recorded',
        };
      });
      const res = await onSubmitActivity(payload);
      setSubmitResult(res);
      playSoundEffect(res.passed ? 'celebrate' : 'wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const resultMap = new Map<number, any>(
    (submitResult?.results || []).map((r: any) => [r.questionId, r])
  );

  return (
    <div className="space-y-5">
      {/* Honest Capability Banner */}
      <div className="p-4 rounded-2xl bg-tertiary-fixed/50 border border-tertiary-gold/40 flex items-start gap-3 text-xs sm:text-sm text-on-tertiary-fixed">
        <Info className="w-5 h-5 shrink-0 mt-0.5 text-tertiary" />
        <div>
          <strong>Koreksi Pelafalan ({languageName}):</strong>{' '}
          Dengarkan contoh pelafalan, lalu rekam suaramu. Jika browser mendukung pengenalan suara, LOGATARA otomatis menilai kecocokan ucapanmu (Benar/Kurang Tepat). Jika perangkat belum mengenali dialek lokal, kamu tetap bisa menggunakan <strong>Konfirmasi Latihan Pelafalan Mandiri</strong>.
        </div>
      </div>

      {permissionError && (
        <div
          role="alert"
          className="p-4 rounded-2xl bg-error-container text-on-error-container text-sm font-semibold flex items-start gap-2.5"
        >
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{permissionError}</span>
        </div>
      )}

      {/* Speaking Phrase Cards */}
      <div className="space-y-4">
        {activity.questions.map((q, idx) => {
          const rec = recordings[q.id];
          const resItem = resultMap.get(q.id);
          const isRec = activeRecQuestionId === q.id;
          const isCardCorrect = resItem ? resItem.isCorrect : rec?.liveMatch === true;
          const isCardWrong = resItem ? !resItem.isCorrect : rec?.liveMatch === false;

          return (
            <article
              key={q.id}
              className={`storybook-card p-5 sm:p-6 space-y-4 border-2 transition-colors ${
                isCardCorrect
                  ? 'border-primary/35'
                  : isCardWrong
                    ? 'border-error/45'
                    : 'border-transparent'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-secondary-terracotta">
                      Latihan Berbicara {idx + 1} dari {activity.questions.length}
                    </span>
                    {resItem && (
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          resItem.isCorrect
                            ? 'bg-primary-fixed text-primary'
                            : 'bg-error-container text-on-error-container'
                        }`}
                      >
                        {resItem.isCorrect ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" /> Benar
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3.5 h-3.5" /> Kurang Tepat
                          </>
                        )}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-on-surface-variant mt-1">{q.prompt}</p>
                  <h3 className="font-display text-2xl sm:text-3xl font-bold text-primary mt-1.5">
                    "{q.regional_text}"
                  </h3>
                  <p className="text-sm font-mono text-secondary-terracotta font-semibold mt-1">
                    Panduan Pelafalan: /{q.pronunciation_guide}/
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    speakPhrase(q.regional_text, {
                      languageName,
                      onStart: () => setPlayingId(q.id),
                      onEnd: () => setPlayingId(null),
                    })
                  }
                  className={`btn-parchment px-4 py-2.5 text-xs inline-flex items-center gap-2 ${
                    playingId === q.id ? 'bg-tertiary-fixed' : ''
                  }`}
                >
                  <Volume2 className="w-4 h-4 text-primary" />
                  <span>{playingId === q.id ? 'Memutar...' : 'Dengar Contoh'}</span>
                </button>
              </div>

              {/* Microphone Controls */}
              <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-on-surface-bark/10">
                <button
                  type="button"
                  disabled={Boolean(submitResult?.passed)}
                  onClick={() => startRecording(q.id, q.regional_text, q.accepted_answers)}
                  className={`px-5 py-3 rounded-full font-display font-bold text-sm inline-flex items-center gap-2 transition-all shadow-md disabled:opacity-50 ${
                    isRec
                      ? 'bg-error text-white animate-pulse'
                      : 'btn-adventure'
                  }`}
                >
                  {isRec ? (
                    <>
                      <Square className="w-4 h-4 fill-current" />
                      <span>Berhenti Merekam</span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-4 h-4" />
                      <span>{rec?.audioUrl ? 'Rekam Ulang' : 'Rekam Suaramu'}</span>
                    </>
                  )}
                </button>

                {(!rec?.completed || rec.liveMatch === false) && !submitResult?.passed && (
                  <button
                    type="button"
                    onClick={() => markManualPractice(q.id, q.regional_text)}
                    className="btn-parchment px-4 py-2.5 text-xs inline-flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    <span>Konfirmasi Latihan Pelafalan Mandiri</span>
                  </button>
                )}
              </div>

              {/* Playback User Recording + Instant Right/Wrong Feedback */}
              {rec && (
                <div
                  className={`p-4 rounded-2xl border space-y-2.5 ${
                    isCardWrong
                      ? 'bg-error-container/60 border-error/30'
                      : 'bg-primary-fixed/40 border-primary/20'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs font-bold ${
                        isCardWrong ? 'text-on-error-container' : 'text-primary'
                      }`}
                    >
                      {isCardWrong ? (
                        <XCircle className="w-4 h-4 text-error" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-primary" />
                      )}
                      {rec.evaluationMode === 'speech_recognition'
                        ? rec.liveMatch
                          ? `Pelafalan Tepat! (${rec.similarityPercent ?? 100}% cocok)`
                          : `Pelafalan Belum Tepat (${rec.similarityPercent ?? 0}% cocok)`
                        : 'Terekam (Evaluasi Pelafalan Mandiri)'}
                    </span>
                    {!submitResult?.passed && (
                      <button
                        type="button"
                        onClick={() => {
                          setSubmitResult(null);
                          setRecordings((prev) => {
                            const next = { ...prev };
                            delete next[q.id];
                            return next;
                          });
                        }}
                        className="text-xs font-semibold text-on-surface-variant hover:text-primary inline-flex items-center gap-1"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Ulangi
                      </button>
                    )}
                  </div>

                  {rec.audioUrl && (
                    <div className="flex items-center gap-3">
                      <Play className="w-4 h-4 text-primary shrink-0" />
                      <audio controls src={rec.audioUrl} className="h-9 w-full max-w-sm" />
                    </div>
                  )}

                  {rec.transcript && (
                    <p className="text-xs text-on-surface-bark">
                      <strong>{rec.evaluationMode === 'speech_recognition' ? 'Terdengar oleh sistem:' : 'Catatan Latihan:'}</strong>{' '}
                      "{rec.transcript}"
                    </p>
                  )}

                  {isCardWrong && (
                    <p className="text-xs font-semibold text-on-error-container">
                      Target bacaan: <strong>"{q.regional_text}"</strong> (/{q.pronunciation_guide}/). Tekan <strong>Dengar Contoh</strong> lalu <strong>Rekam Ulang</strong> untuk memperbaiki.
                    </p>
                  )}

                  <p className="text-xs text-on-surface-variant">{q.explanation}</p>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {/* Submit Result & Next / Retry Button */}
      {submitResult ? (
        <div
          className={`storybook-card p-5 flex flex-col sm:flex-row items-center justify-between gap-4 ${
            submitResult.passed ? 'bg-primary-fixed/50 border-primary/30' : 'bg-error-container/60 border-error/30'
          }`}
        >
          <div className="flex items-center gap-3">
            {submitResult.passed ? (
              <CheckCircle2 className="w-8 h-8 text-primary shrink-0" />
            ) : (
              <XCircle className="w-8 h-8 text-error shrink-0" />
            )}
            <div>
              <h4 className="font-display text-lg font-bold text-on-surface">
                Skor Berbicara: {submitResult.correctCount}/{submitResult.totalQuestions} ({submitResult.scorePercent}%)
              </h4>
              <p className="text-xs text-on-surface-variant">
                {submitResult.passed
                  ? submitResult.xpAwarded > 0
                    ? `Hebat! +${submitResult.xpAwarded} XP ditambahkan ke akunmu!`
                    : 'Lulus! (XP aktivitas ini sudah tercatat sebelumnya.)'
                  : 'Beberapa ucapan masih kurang tepat. Dengarkan contoh pelafalan dan coba rekam ulang!'}
              </p>
            </div>
          </div>
          {submitResult.passed ? (
            <button
              type="button"
              onClick={onNextTab}
              className="btn-adventure px-6 py-3 text-sm inline-flex items-center gap-2"
            >
              <span>Lanjut ke Mendengarkan</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setSubmitResult(null)}
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
            disabled={!allCompleted || submitting}
            onClick={handleSubmit}
            className="btn-adventure px-7 py-3.5 text-base inline-flex items-center gap-2 disabled:opacity-50"
          >
            <span>{submitting ? 'Memeriksa Pelafalan...' : 'Periksa & Simpan Hasil Berbicara'}</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}
