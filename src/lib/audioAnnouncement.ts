'use client';

export type VoiceLanguage = 'hi' | 'en' | 'bilingual';

/**
 * Finds the best natural female voice available in the browser for a given language.
 */
function findBestFemaleVoice(voices: SpeechSynthesisVoice[], lang: 'hi' | 'en'): SpeechSynthesisVoice | null {
  if (!voices || voices.length === 0) return null;

  if (lang === 'hi') {
    // 1. Strict Hindi voice filtering
    const hindiVoices = voices.filter((v) => {
      const l = v.lang.toLowerCase();
      const n = v.name.toLowerCase();
      return (
        l.startsWith('hi') ||
        l.includes('hi-in') ||
        l.includes('hi_in') ||
        n.includes('hindi') ||
        n.includes('हिन्दी') ||
        n.includes('lekha')
      );
    });

    if (hindiVoices.length > 0) {
      // Prioritize verified Hindi female voices
      const femaleKeywords = ['lekha', 'google हिन्दी', 'kalpana', 'swara', 'neerja', 'female', 'natural', 'neural'];
      const matched = hindiVoices.find((v) => {
        const lowerName = v.name.toLowerCase();
        return femaleKeywords.some((k) => lowerName.includes(k));
      });
      if (matched) return matched;
      return hindiVoices[0];
    }

    // Strictly DO NOT fallback to English voices for Hindi text,
    // so the browser's native Hindi speech engine handles Devnagari properly.
    return null;
  }

  // 2. English Language Female Voices
  const englishVoices = voices.filter((v) => {
    const l = v.lang.toLowerCase();
    return l.startsWith('en');
  });

  if (englishVoices.length > 0) {
    // Known male voices to strictly exclude
    const maleKeywords = ['rishi', 'daniel', 'alex', 'fred', 'oliver', 'george', 'david', 'male', 'guy', 'mark', 'tom'];
    const nonMaleVoices = englishVoices.filter((v) => {
      const lowerName = v.name.toLowerCase();
      return !maleKeywords.some((m) => lowerName.includes(m));
    });

    // Prioritize natural English female voices
    const femaleKeywords = [
      'veena',
      'samantha',
      'google uk english female',
      'google us english',
      'karen',
      'moira',
      'victoria',
      'tessa',
      'fiona',
      'jenny',
      'aria',
      'zira',
      'sangeeta',
      'heera',
      'female',
      'natural',
      'neural',
    ];

    const pool = nonMaleVoices.length > 0 ? nonMaleVoices : englishVoices;
    const matchedFemale = pool.find((v) => {
      const lowerName = v.name.toLowerCase();
      return femaleKeywords.some((k) => lowerName.includes(k));
    });
    if (matchedFemale) return matchedFemale;
    return pool[0];
  }

  return null;
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
      try {
        await ctx.resume();
      } catch (e) {
        console.warn('AudioContext resume error:', e);
      }
    }

    // Use current time + 0.05s buffer to prevent any audio clipping
    const startTime = ctx.currentTime + 0.05;

    // Tone 1: High Bell Tone (G5 - 783.99 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(783.99, startTime);
    gain1.gain.setValueAtTime(0.45, startTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, startTime + 0.38);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(startTime);
    osc1.stop(startTime + 0.4);

    // Tone 2: Harmonious Chime (C6 - 1046.50 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1046.5, startTime + 0.22);
    gain2.gain.setValueAtTime(0.55, startTime + 0.22);
    gain2.gain.exponentialRampToValueAtTime(0.001, startTime + 1.1);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(startTime + 0.22);
    osc2.stop(startTime + 1.1);

    return new Promise((resolve) => {
      setTimeout(resolve, 600);
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
    utterance.pitch = 1.15; // Smooth, pleasant female pitch inflection
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
    // Pure Hindi Female Voice
    speakPhrase(hindiText, 'hi', options?.onEnd);
  } else if (language === 'en') {
    // Pure English Female Voice
    speakPhrase(englishText, 'en', options?.onEnd);
  } else {
    // Bilingual: English female voice followed immediately by Hindi female voice
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
    // Strictly speaks Hindi Test in Hindi Female Voice
    speakPhrase(hindiTest, 'hi', onEnd);
  } else if (lang === 'en') {
    // Strictly speaks English Test in English Female Voice
    speakPhrase(englishTest, 'en', onEnd);
  } else {
    // Bilingual: Speaks English first, then Hindi
    speakPhrase(englishTest, 'en', () => {
      setTimeout(() => {
        speakPhrase(hindiTest, 'hi', onEnd);
      }, 350);
    });
  }
}
