'use client';

export type VoiceLanguage = 'hi' | 'en' | 'bilingual';

/**
 * Transliterates common English clinical and venue station names into fluent Hindi Devnagari.
 */
export function formatStationForHindi(stationName: string): string {
  if (!stationName) return 'काउंटर 1';

  let s = stationName;
  s = s.replace(/Doctor Room\s*(\d+)/gi, 'डॉक्टर रूम $1');
  s = s.replace(/Doctor\s*(\d+)/gi, 'डॉक्टर $1');
  s = s.replace(/Doctor/gi, 'डॉक्टर');
  s = s.replace(/Consultation Room\s*(\d+)/gi, 'परामर्श कक्ष $1');
  s = s.replace(/Room\s*(\d+)/gi, 'कमरा $1');
  s = s.replace(/Counter\s*(\d+)/gi, 'काउंटर $1');
  s = s.replace(/Counter/gi, 'काउंटर');
  s = s.replace(/Billing Counter/gi, 'बिलिंग काउंटर');
  s = s.replace(/Billing/gi, 'बिलिंग');
  s = s.replace(/Pharmacy/gi, 'फार्मेसी');
  s = s.replace(/Lab\s*(\d+)/gi, 'लैब $1');
  s = s.replace(/Lab/gi, 'लैब');
  s = s.replace(/Reception/gi, 'रिसेप्शन');
  s = s.replace(/Desk\s*(\d+)/gi, 'डेस्क $1');
  s = s.replace(/Station\s*(\d+)/gi, 'स्टेशन $1');
  s = s.replace(/Chair\s*(\d+)/gi, 'कुर्सी $1');

  return s;
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
 * Synthesizes a crisp airport/clinical dual-tone chime (Ding-Dong: G5 783.99 Hz -> C6 1046.50 Hz).
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

    const startTime = ctx.currentTime + 0.05;

    // Tone 1: High Bell Tone (G5 - 783.99 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(783.99, startTime);
    gain1.gain.setValueAtTime(0.5, startTime);
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
    gain2.gain.setValueAtTime(0.6, startTime + 0.22);
    gain2.gain.exponentialRampToValueAtTime(0.001, startTime + 1.1);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(startTime + 0.22);
    osc2.stop(startTime + 1.1);

    return new Promise((resolve) => {
      setTimeout(resolve, 550);
    });
  } catch (err) {
    console.warn('Web Audio chime playback error:', err);
  }
}

// Keep reference to active HTML5 audio to prevent overlapping speech
let currentTtsAudio: HTMLAudioElement | null = null;

/**
 * Plays neural female voice speech audio using the dedicated /api/tts server stream.
 * Automatically falls back to Web Speech API if network is unavailable.
 */
export function playNaturalVoiceAudio(text: string, lang: 'hi' | 'en'): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve();

    // Stop any previously playing announcement
    if (currentTtsAudio) {
      try {
        currentTtsAudio.pause();
        currentTtsAudio.currentTime = 0;
      } catch {}
      currentTtsAudio = null;
    }

    const url = `/api/tts?text=${encodeURIComponent(text)}&lang=${encodeURIComponent(lang)}`;
    const audio = new Audio(url);
    currentTtsAudio = audio;

    let finished = false;
    const finish = () => {
      if (!finished) {
        finished = true;
        if (currentTtsAudio === audio) {
          currentTtsAudio = null;
        }
        resolve();
      }
    };

    audio.onended = finish;
    audio.onerror = (e) => {
      console.warn('Neural TTS stream error, falling back to Web Speech API:', e);
      speakPhraseWebSpeech(text, lang, finish);
    };

    // Safety timeout in case playback stalls
    setTimeout(finish, 14000);

    audio.play().catch((err) => {
      console.warn('HTML5 audio play blocked, falling back to Web Speech:', err);
      speakPhraseWebSpeech(text, lang, finish);
    });
  });
}

/**
 * Offline / Emergency Web Speech API fallback.
 */
function speakPhraseWebSpeech(
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
    utterance.rate = langCode === 'hi' ? 0.88 : 0.92;
    utterance.pitch = 1.15;
    utterance.lang = langCode === 'hi' ? 'hi-IN' : 'en-US';

    const voices = window.speechSynthesis.getVoices();
    if (voices && voices.length > 0) {
      if (langCode === 'hi') {
        const hindiVoice = voices.find((v) => {
          const l = v.lang.toLowerCase();
          const n = v.name.toLowerCase();
          return l.startsWith('hi') || n.includes('hindi') || n.includes('lekha');
        });
        if (hindiVoice) utterance.voice = hindiVoice;
      } else {
        const engVoice = voices.find((v) => {
          const l = v.lang.toLowerCase();
          const n = v.name.toLowerCase();
          return l.startsWith('en') && (n.includes('samantha') || n.includes('veena') || n.includes('female'));
        });
        if (engVoice) utterance.voice = engVoice;
      }
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
    setTimeout(finish, 8000);

    window.speechSynthesis.speak(utterance);
  } catch {
    if (onComplete) onComplete();
  }
}

/**
 * Plays the dual-tone chime and speaks the token number in natural Hindi, English, or Bilingual female voice.
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

  // Cancel any lingering speech synthesis
  if ('speechSynthesis' in window && window.speechSynthesis.speaking) {
    try {
      window.speechSynthesis.cancel();
    } catch {}
  }

  // 1. Play crystal dual-tone airport chime
  await playChimeAudio();

  if (options?.onStart) options.onStart();

  const hindiStation = formatStationForHindi(targetStation);
  const hindiText = `कृपया ध्यान दें। टोकन नंबर ${tokenNumber}, कृपया ${hindiStation} पर जाएं।`;
  const englishText = `Attention please. Token number ${tokenNumber}, please proceed to ${targetStation}.`;

  // 2. Play Voice Announcement according to selected language
  if (language === 'hi') {
    // Pure Natural Hindi Female Voice
    await playNaturalVoiceAudio(hindiText, 'hi');
  } else if (language === 'en') {
    // Pure Natural English Female Voice
    await playNaturalVoiceAudio(englishText, 'en');
  } else {
    // Bilingual: English Female Voice followed by Hindi Female Voice
    await playNaturalVoiceAudio(englishText, 'en');
    await new Promise((r) => setTimeout(r, 400));
    await playNaturalVoiceAudio(hindiText, 'hi');
  }

  if (options?.onEnd) options.onEnd();
}

/**
 * Plays a test chime and full descriptive sample announcement in Hindi, English, or Bilingual female voice.
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

  // 1. Play dual-tone airport chime
  await playChimeAudio();

  const hindiStation = formatStationForHindi(targetStation);
  const hindiTest = `कृपया ध्यान दें। यह परीक्षण उद्घोषणा है। टोकन नंबर 1, कृपया ${hindiStation} पर जाएं।`;
  const englishTest = `Attention please. This is a voice test. Token number 1, please proceed to ${targetStation}.`;

  if (lang === 'hi') {
    // Pure Natural Hindi Female Voice
    await playNaturalVoiceAudio(hindiTest, 'hi');
  } else if (lang === 'en') {
    // Pure Natural English Female Voice
    await playNaturalVoiceAudio(englishTest, 'en');
  } else {
    // Bilingual: English first, then Hindi
    await playNaturalVoiceAudio(englishTest, 'en');
    await new Promise((r) => setTimeout(r, 400));
    await playNaturalVoiceAudio(hindiTest, 'hi');
  }

  if (onEnd) onEnd();
}
