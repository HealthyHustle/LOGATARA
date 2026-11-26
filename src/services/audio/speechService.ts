// Browser Web Speech Synthesis + Web Audio API Sound Effects + Microphone Recording Helper
// Gracefully degrades when speech voices or microphone permissions are unavailable.

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) audioCtx = new Ctx();
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as unknown as Record<string, unknown>;
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
}

// Phonetic adjustments for browser id-ID TTS engines so regional words sound more natural
// (e.g., Indonesian TTS often misreads "-es" in Sundanese "Rampes" as e-taling instead of e-pepet).
const TTS_PRONUNCIATION_OVERRIDES: Array<[RegExp, string]> = [
  [/\brampes\b/gi, 'rampes'],
];

function prepareSpeechText(rawText: string): string {
  let out = rawText.trim();
  // Indonesian TTS engines frequently pronounce final "-es" as /ɛs/ (like "sukses"/"akses").
  // For Sundanese "Rampes" (e pepet /rampəs/), "rampeus" / "rampês" guides id-ID speech synthesis closer to schwa.
  if (/^rampes[!.,?]*$/i.test(out)) {
    return 'rampeus';
  }
  out = out.replace(/\brampes\b/gi, 'rampeus');
  for (const [pattern, replacement] of TTS_PRONUNCIATION_OVERRIDES) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

export function speakPhrase(
  text: string,
  options: { rate?: number; onStart?: () => void; onEnd?: () => void; onError?: (reason: string) => void } = {}
): boolean {
  if (!isSpeechSynthesisSupported()) {
    options.onError?.('Browser ini belum mendukung pemutaran suara sintesis (Web Speech API). Gunakan panduan pelafalan tertulis.');
    return false;
  }

  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(prepareSpeechText(text));
    utterance.lang = 'id-ID';
    utterance.rate = options.rate ?? 0.9;
    utterance.pitch = 1.02;

    const voices = window.speechSynthesis.getVoices();
    const idVoice = voices.find((v) => v.lang.toLowerCase().startsWith('id'));
    if (idVoice) utterance.voice = idVoice;

    utterance.onstart = () => options.onStart?.();
    utterance.onend = () => options.onEnd?.();
    utterance.onerror = () => {
      options.onEnd?.();
      options.onError?.('Audio sintesis tidak tersedia pada perangkat ini. Silakan baca panduan pelafalan fonetis.');
    };

    window.speechSynthesis.speak(utterance);
    return true;
  } catch {
    options.onError?.('Gagal memutar suara. Gunakan panduan pelafalan tertulis.');
    return false;
  }
}

export function stopSpeaking() {
  if (isSpeechSynthesisSupported()) {
    window.speechSynthesis.cancel();
  }
}

// Gentle warm marimba/angklung-like sound effects using Web Audio API
export function playSoundEffect(type: 'correct' | 'wrong' | 'step' | 'celebrate' | 'click') {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const playTone = (freq: number, startOffset: number, duration: number, vol = 0.08, wave: OscillatorType = 'triangle') => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(freq, now + startOffset);
    gain.gain.setValueAtTime(0.001, now + startOffset);
    gain.gain.exponentialRampToValueAtTime(vol, now + startOffset + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + startOffset + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + startOffset);
    osc.stop(now + startOffset + duration + 0.02);
  };

  if (type === 'correct') {
    playTone(523.25, 0, 0.16, 0.09);
    playTone(659.25, 0.09, 0.22, 0.09);
  } else if (type === 'wrong') {
    playTone(260, 0, 0.18, 0.07, 'sine');
    playTone(215, 0.12, 0.22, 0.07, 'sine');
  } else if (type === 'step') {
    playTone(320, 0, 0.06, 0.04, 'sine');
  } else if (type === 'click') {
    playTone(440, 0, 0.05, 0.03, 'triangle');
  } else if (type === 'celebrate') {
    // Pentatonic Nusantara celebratory chime (Pelog / Slendro inspired)
    playTone(523.25, 0, 0.18, 0.1);
    playTone(587.33, 0.1, 0.18, 0.1);
    playTone(659.25, 0.2, 0.2, 0.1);
    playTone(783.99, 0.3, 0.24, 0.11);
    playTone(1046.5, 0.42, 0.45, 0.12);
  }
}
