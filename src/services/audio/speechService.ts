// Browser Web Speech Synthesis + Web Audio API Sound Effects + Speech Similarity Helper
// Gracefully degrades when speech voices or microphone permissions are unavailable.

let audioCtx: AudioContext | null = null;
let cachedVoices: SpeechSynthesisVoice[] = [];

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  const loadVoices = () => {
    const v = window.speechSynthesis.getVoices();
    if (v && v.length > 0) cachedVoices = v;
  };
  loadVoices();
  if (typeof window.speechSynthesis.addEventListener === 'function') {
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
  }
}

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

export function resolveSpeechLocale(languageName?: string): string {
  const ln = (languageName || '').toLowerCase();
  if (ln.includes('sunda')) return 'su-ID';
  if (ln.includes('jawa')) return 'jv-ID';
  return 'id-ID';
}

// Keep authentic diacritics (especially Sundanese é taling on "Rampés" & "Badé")
// so both native su-ID voices and id-ID fallback voices read them clearly.
function prepareSpeechText(rawText: string, languageName?: string): string {
  let out = rawText.trim();
  const isSunda = (languageName || '').toLowerCase().includes('sunda');

  // Ensure Sundanese "Rampés" always carries explicit é taling (never "rampeus" / e-pepet)
  out = out.replace(/\brampes\b/gi, (m) => (m[0] === 'R' ? 'Rampés' : 'rampés'));

  if (isSunda) {
    out = out.replace(/\bbade\b/gi, (m) => (m[0] === 'B' ? 'Badé' : 'badé'));
  }

  return out;
}

export function speakPhrase(
  text: string,
  options: {
    languageName?: string;
    rate?: number;
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (reason: string) => void;
  } = {}
): boolean {
  if (!isSpeechSynthesisSupported()) {
    options.onError?.('Browser ini belum mendukung pemutaran suara sintesis (Web Speech API). Gunakan panduan pelafalan tertulis.');
    return false;
  }

  try {
    window.speechSynthesis.cancel();
    const prepared = prepareSpeechText(text, options.languageName);
    const utterance = new SpeechSynthesisUtterance(prepared);

    const liveVoices = window.speechSynthesis.getVoices();
    const voices = liveVoices.length > 0 ? liveVoices : cachedVoices;
    const preferredLocale = resolveSpeechLocale(options.languageName);
    const preferredPrefix = preferredLocale.split('-')[0].toLowerCase();

    // Prefer native regional voice (e.g. su-ID for Basa Sunda, jv-ID for Basa Jawa) if installed,
    // otherwise cleanly fall back to Indonesian (id-ID).
    const nativeVoice = voices.find((v) => v.lang.toLowerCase().startsWith(preferredPrefix));
    const idVoice = voices.find((v) => v.lang.toLowerCase().startsWith('id'));
    const chosenVoice = nativeVoice || idVoice || null;

    utterance.lang = chosenVoice ? chosenVoice.lang : 'id-ID';
    if (chosenVoice) utterance.voice = chosenVoice;

    utterance.rate = options.rate ?? 0.88;
    utterance.pitch = 1.0;

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

function normalizeForSpeechCompare(str: string): string {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[?!.,'’"“”\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[] = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + cost);
      prev = temp;
    }
  }
  return dp[n];
}

/**
 * Evaluates spoken Speech Recognition transcript against target regional phrase.
 * Tolerates minor diacritic/spacing differences (e.g. "sampura sun" vs "Sampurasun", "rampes" vs "Rampés"),
 * while clearly rejecting unrelated spoken words.
 */
export function evaluateSpeechMatch(
  spokenText: string,
  targetPhrase: string,
  acceptedAnswers: string[] = []
): { isMatch: boolean; similarityPercent: number } {
  const spoken = normalizeForSpeechCompare(spokenText);
  if (!spoken) return { isMatch: false, similarityPercent: 0 };

  const candidates = [targetPhrase, ...acceptedAnswers]
    .map(normalizeForSpeechCompare)
    .filter(Boolean);

  let bestScore = 0;
  const spokenNoSpace = spoken.replace(/\s+/g, '');
  const spokenWords = spoken.split(' ').filter(Boolean);

  for (const target of candidates) {
    if (spoken === target) return { isMatch: true, similarityPercent: 100 };

    const targetNoSpace = target.replace(/\s+/g, '');
    if (spokenNoSpace === targetNoSpace) return { isMatch: true, similarityPercent: 100 };

    // Character-level Levenshtein similarity (collapsed spaces to forgive STT splitting compound regional words)
    const maxLen = Math.max(spokenNoSpace.length, targetNoSpace.length);
    const dist = levenshteinDistance(spokenNoSpace, targetNoSpace);
    const charSim = maxLen > 0 ? Math.max(0, 1 - dist / maxLen) : 0;

    // Word-level overlap similarity
    const targetWords = target.split(' ').filter(Boolean);
    let matchedWords = 0;
    for (const tw of targetWords) {
      if (
        spokenWords.some((sw) => {
          if (sw === tw || sw.includes(tw) || tw.includes(sw)) return true;
          const d = levenshteinDistance(sw, tw);
          return d <= Math.max(1, Math.floor(tw.length * 0.28));
        })
      ) {
        matchedWords++;
      }
    }
    const wordSim = targetWords.length > 0 ? matchedWords / targetWords.length : 0;

    const combined = Math.round(Math.max(charSim, wordSim * 0.85 + charSim * 0.15) * 100);
    if (combined > bestScore) bestScore = combined;
  }

  return {
    isMatch: bestScore >= 62,
    similarityPercent: bestScore,
  };
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
