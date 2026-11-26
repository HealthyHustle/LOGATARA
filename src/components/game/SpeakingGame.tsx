import React, { useState, useRef, useEffect } from 'react';
import {
  Mic,
  Square,
  Volume2,
  Play,
  CheckCircle2,
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

  const startRecording = async (questionId: number, targetPhrase: string) => {
    setPermissionError(null);

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

      // Optional browser speech recognition (labeled transparently)
      if (sttSupported) {
        const w = window as unknown as Record<string, any>;
        const RecCtor = w.SpeechRecognition || w.webkitSpeechRecognition;
        if (RecCtor) {
          const rec = new RecCtor();
          rec.lang = 'id-ID';
          rec.interimResults = false;
          rec.maxAlternatives = 1;
          rec.onresult = (evt: any) => {
            detectedTranscript = evt.results?.[0]?.[0]?.transcript || '';
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
        playSoundEffect('correct');

        setRecordings((prev) => ({
          ...prev,
          [questionId]: {
            audioUrl,
            transcript: detectedTranscript || undefined,
            evaluationMode: detectedTranscript ? 'speech_recognition' : 'self_practice_recorded',
            completed: true,
          },
        }));
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
    setRecordings((prev) => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        transcript: `Latihan pelafalan mandiri: ${targetPhrase}`,
        evaluationMode: 'self_practice_recorded',
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

  return (
    <div className="space-y-5">
      {/* Honest Capability Banner */}
      <div className="p-4 rounded-2xl bg-tertiary-fixed/50 border border-tertiary-gold/40 flex items-start gap-3 text-xs sm:text-sm text-on-tertiary-fixed">
        <Info className="w-5 h-5 shrink-0 mt-0.5 text-tertiary" />
        <div>
          <strong>Transparansi Evaluasi Pelafalan ({languageName}):</strong>{' '}
          Mesin pengenalan suara otomatis browser belum memiliki model akustik khusus untuk seluruh bahasa daerah Indonesia. Oleh karena itu, LOGATARA menyediakan{' '}
          <strong>Rekaman Suara & Perbandingan Pelafalan Mandiri</strong> agar kamu bisa merekam suaramu, memutarnya ulang, dan membandingkan langsung dengan contoh pelafalan baku tanpa penilaian palsu.
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
          const isRec = activeRecQuestionId === q.id;
          return (
            <article key={q.id} className="storybook-card p-5 sm:p-6 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-secondary-terracotta">
                    Latihan Berbicara {idx + 1} dari {activity.questions.length}
                  </span>
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
                  onClick={() => startRecording(q.id, q.regional_text)}
                  className={`px-5 py-3 rounded-full font-display font-bold text-sm inline-flex items-center gap-2 transition-all shadow-md ${
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

                {!rec?.completed && (
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

              {/* Playback User Recording + Feedback */}
              {rec && (
                <div className="p-4 rounded-2xl bg-primary-fixed/40 border border-primary/20 space-y-2.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-primary">
                      <CheckCircle2 className="w-4 h-4" />
                      {rec.evaluationMode === 'speech_recognition'
                        ? 'Terekam & Terdeteksi (Speech Recognition)'
                        : 'Terekam (Evaluasi Pelafalan Mandiri)'}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setRecordings((prev) => {
                          const next = { ...prev };
                          delete next[q.id];
                          return next;
                        })
                      }
                      className="text-xs font-semibold text-on-surface-variant hover:text-primary inline-flex items-center gap-1"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Ulangi
                    </button>
                  </div>

                  {rec.audioUrl && (
                    <div className="flex items-center gap-3">
                      <Play className="w-4 h-4 text-primary shrink-0" />
                      <audio controls src={rec.audioUrl} className="h-9 w-full max-w-sm" />
                    </div>
                  )}

                  {rec.transcript && (
                    <p className="text-xs text-on-surface-bark">
                      <strong>Catatan Latihan:</strong> "{rec.transcript}"
                    </p>
                  )}
                  <p className="text-xs text-on-surface-variant">{q.explanation}</p>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {/* Submit Result & Next Button */}
      {submitResult ? (
        <div className="storybook-card p-5 bg-primary-fixed/50 border-primary/30 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-8 h-8 text-primary shrink-0" />
            <div>
              <h4 className="font-display text-lg font-bold text-primary">
                Aktivitas Berbicara Selesai! ({submitResult.scorePercent}%)
              </h4>
              <p className="text-xs text-on-surface-variant">
                {submitResult.xpAwarded > 0
                  ? `+${submitResult.xpAwarded} XP ditambahkan ke akunmu!`
                  : 'Latihan terekam! (XP aktivitas ini sudah tercatat sebelumnya.)'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onNextTab}
            className="btn-adventure px-6 py-3 text-sm inline-flex items-center gap-2"
          >
            <span>Lanjut ke Mendengarkan</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="flex justify-end">
          <button
            type="button"
            disabled={!allCompleted || submitting}
            onClick={handleSubmit}
            className="btn-adventure px-7 py-3.5 text-base inline-flex items-center gap-2 disabled:opacity-50"
          >
            <span>{submitting ? 'Menyimpan Latihan...' : 'Simpan Hasil Berbicara'}</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}
