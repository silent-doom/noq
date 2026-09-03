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

// Global shared AudioContext to prevent hitting browser limit & ensure smooth resume on user action
let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
    sharedAudioCtx = new AudioCtx();
  }
  return sharedAudioCtx;
}

/**
 * Synthesizes a crisp airport/clinical dual-tone chime (Ding-Dong) using the Web Audio API.
 */
export async function playChimeAudio(): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    const now = ctx.currentTime;

    // Tone 1: High Bell Tone (G5 - 783.99 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(783.99, now);
    gain1.gain.setValueAtTime(0.4, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.4);

    // Tone 2: Harmonious Chime (C6 - 1046.50 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1046.5, now + 0.22);
    gain2.gain.setValueAtTime(0.5, now + 0.22);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.0);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.22);
    osc2.stop(now + 1.0);

    return new Promise((resolve) => {
      setTimeout(resolve, 550);
    });
  } catch (err) {
    console.warn('Web Audio chime playback error:', err);
  }
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
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }

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

    let completed = false;
    const finish = () => {
      if (!completed) {
        completed = true;
        if (onComplete) onComplete();
      }
    };

    utterance.onend = finish;
    utterance.onerror = finish;

    // Safety timeout in case browser synthesis drops event
    setTimeout(finish, 8000);

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

  // Cancel previous speech only if active, avoiding chromium drop bugs
  if ('speechSynthesis' in window && window.speechSynthesis.speaking) {
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

/**
 * Plays a test chime and voice announcement so operators or venue staff can calibrate and hear sound immediately.
 */
export async function playTestAnnouncement(
  language?: VoiceLanguage,
  stationName?: string,
  onEnd?: () => void
) {
  if (typeof window === 'undefined') return;

  const targetStation = stationName || 'Counter 1';
  const lang: VoiceLanguage =
    language ||
    (typeof window !== 'undefined'
      ? (localStorage.getItem('noq_voice_lang') as VoiceLanguage) || 'bilingual'
      : 'bilingual');

  if ('speechSynthesis' in window && window.speechSynthesis.speaking) {
    try {
      window.speechSynthesis.cancel();
    } catch {}
  }

  await playChimeAudio();

  const hindiTest = `कृपया ध्यान दें। यह परीक्षण उद्घोषणा है। टोकन नंबर 1, कृपया ${targetStation} पर जाएं।`;
  const englishTest = `Attention please. This is a voice test. Token number 1, please proceed to ${targetStation}.`;

  if (lang === 'hi') {
    speakPhrase(hindiTest, 'hi', onEnd);
  } else if (lang === 'en') {
    speakPhrase(englishTest, 'en', onEnd);
  } else {
    speakPhrase(englishTest, 'en', () => {
      setTimeout(() => {
        speakPhrase(hindiTest, 'hi', onEnd);
      }, 350);
    });
  }
}
