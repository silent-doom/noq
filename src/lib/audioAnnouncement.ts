'use client';

export type VoiceLanguage = 'hi' | 'en' | 'bilingual';

/**
 * Finds the best natural female voice available in the browser for a given language.
 */
function findBestFemaleVoice(voices: SpeechSynthesisVoice[], lang: 'hi' | 'en'): SpeechSynthesisVoice | null {
  if (!voices || voices.length === 0) return null;

  if (lang === 'hi') {
    // 1. Prioritize natural/neural Hindi female voices across platforms (Apple, Google, Microsoft, Android)
    const hindiFemaleNames = ['lekha', 'google हिन्दी', 'kalpana', 'swara', 'neerja', 'natural', 'neural', 'female'];
    
    // Exact Hindi voices matching female priority
    const matchedHindiFemale = voices.find((v) => {
      const isHindi = v.lang.toLowerCase().startsWith('hi') || v.lang.toLowerCase().includes('hi-in');
      if (!isHindi) return false;
      const lowerName = v.name.toLowerCase();
      return hindiFemaleNames.some((keyword) => lowerName.includes(keyword));
    });
    if (matchedHindiFemale) return matchedHindiFemale;

    // Any available Hindi voice
    const anyHindi = voices.find((v) => v.lang.toLowerCase().startsWith('hi') || v.lang.toLowerCase().includes('hi-in'));
    if (anyHindi) return anyHindi;

    // Indian English female voice as smooth phonetic fallback
    const indianEnglishFemale = voices.find((v) => {
      const isIndianEng = v.lang.toLowerCase().includes('en-in');
      const lowerName = v.name.toLowerCase();
      return isIndianEng && (lowerName.includes('veena') || lowerName.includes('sangeeta') || lowerName.includes('heera') || lowerName.includes('female'));
    });
    if (indianEnglishFemale) return indianEnglishFemale;
  }

  // English Female Voices (Indian English Female > Natural/Neural Female > Standard Apple/Google Female)
  const englishFemaleNames = [
    'veena',
    'sangeeta',
    'heera',
    'google uk english female',
    'google us english',
    'samantha',
    'karen',
    'moira',
    'tessa',
    'fiona',
    'victoria',
    'jenny',
    'aria',
    'zira',
    'natural',
    'neural',
    'female',
  ];

  const matchedEngFemale = voices.find((v) => {
    const isEng = v.lang.toLowerCase().startsWith('en');
    if (!isEng) return false;
    const lowerName = v.name.toLowerCase();
    return englishFemaleNames.some((keyword) => lowerName.includes(keyword));
  });

  if (matchedEngFemale) return matchedEngFemale;

  // Generic English fallback
  return voices.find((v) => v.lang.toLowerCase().startsWith('en')) || voices[0] || null;
}

/**
 * Synthesizes a crisp airport/clinical dual-tone chime (Ding-Dong) using the Web Audio API.
 */
export function playChimeAudio(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve();

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return resolve();

      const ctx = new AudioCtx();

      // Tone 1: High Bell Tone (G5 - 783.99 Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(783.99, ctx.currentTime);
      gain1.gain.setValueAtTime(0.4, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 0.4);

      // Tone 2: Harmonious Chime (C6 - 1046.50 Hz)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1046.5, ctx.currentTime + 0.2);
      gain2.gain.setValueAtTime(0.5, ctx.currentTime + 0.2);
      gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.0);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(ctx.currentTime + 0.2);
      osc2.stop(ctx.currentTime + 1.0);

      setTimeout(() => {
        resolve();
      }, 550);
    } catch (err) {
      console.warn('Web Audio chime not initialized:', err);
      resolve();
    }
  });
}

/**
 * Executes a single natural voice announcement utterance with female pitch modulation.
 */
function speakPhrase(
  text: string,
  langCode: 'hi' | 'en',
  onComplete?: () => void
) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    if (onComplete) onComplete();
    return;
  }

  try {
    const utterance = new SpeechSynthesisUtterance(text);
    // Natural female voice cadence & pitch
    utterance.rate = langCode === 'hi' ? 0.88 : 0.92;
    utterance.pitch = 1.1; // Smooth, pleasant female pitch inflection
    utterance.lang = langCode === 'hi' ? 'hi-IN' : 'en-US';

    const allVoices = window.speechSynthesis.getVoices();
    const femaleVoice = findBestFemaleVoice(allVoices, langCode);
    if (femaleVoice) {
      utterance.voice = femaleVoice;
    }

    if (onComplete) {
      utterance.onend = onComplete;
      utterance.onerror = () => onComplete();
    }

    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn('Speech synthesis playback error:', err);
    if (onComplete) onComplete();
  }
}

/**
 * Plays the dual-tone chime and speaks the token number in natural Hindi, English, or Bilingual voice.
 */
export async function playChimeAndAnnounce(
  tokenNumber: number,
  stationName?: string,
  options?: {
    language?: VoiceLanguage;
    customPrefix?: string;
    onStart?: () => void;
    onEnd?: () => void;
  }
) {
  if (typeof window === 'undefined') return;

  const targetStation = stationName || 'Counter 1';
  const language: VoiceLanguage =
    options?.language ||
    (typeof window !== 'undefined'
      ? (localStorage.getItem('noq_voice_lang') as VoiceLanguage) || 'bilingual'
      : 'bilingual');

  // Cancel any lingering TTS audio
  if ('speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {}
  }

  // 1. Play crystal dual-tone chime
  await playChimeAudio();

  if (options?.onStart) options.onStart();

  // Hindi text & English text formulations
  const hindiText = `कृपया ध्यान दें। टोकन नंबर ${tokenNumber}, कृपया ${targetStation} पर जाएं।`;
  const englishText = `Attention please. Token number ${tokenNumber}, please proceed to ${targetStation}.`;

  // 2. Play Voice Announcement according to selected language
  if (language === 'hi') {
    // Pure Hindi Natural Female Voice
    speakPhrase(hindiText, 'hi', options?.onEnd);
  } else if (language === 'en') {
    // Pure English Natural Female Voice
    speakPhrase(englishText, 'en', options?.onEnd);
  } else {
    // Bilingual: English announcement followed immediately by Hindi announcement
    speakPhrase(englishText, 'en', () => {
      setTimeout(() => {
        speakPhrase(hindiText, 'hi', options?.onEnd);
      }, 350);
    });
  }
}
