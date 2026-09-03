'use client';

/**
 * Synthesizes a crisp airport/clinical dual-tone chime (Ding-Dong) using the Web Audio API,
 * followed by a natural Web Speech TTS voice announcement calling out the token number and station.
 */
export function playChimeAndAnnounce(
  tokenNumber: number,
  stationName?: string,
  options?: {
    customPrefix?: string;
    onStart?: () => void;
    onEnd?: () => void;
  }
) {
  if (typeof window === 'undefined') return;

  const prefix = options?.customPrefix || 'Attention please. Token number';
  const targetStation = stationName || 'Counter 1';

  // 1. Synthesize Crystal Web Audio Chime (G5 -> C6 ding-dong)
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx) {
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
    }
  } catch (err) {
    console.warn('Web Audio chime not initialized:', err);
  }

  // 2. Play Speech Synthesis Voice Announcement (timed after the chime)
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    setTimeout(() => {
      try {
        window.speechSynthesis.cancel();
        const text = `${prefix} ${tokenNumber}, please proceed to ${targetStation}.`;
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.92;
        utterance.pitch = 1.05;
        utterance.lang = 'en-US';

        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find(
          (v) =>
            v.lang.startsWith('en') &&
            (v.name.includes('Natural') ||
              v.name.includes('Google') ||
              v.name.includes('Samantha') ||
              v.name.includes('Alex') ||
              v.name.includes('Daniel') ||
              v.name.includes('Enhanced'))
        );
        if (preferredVoice) {
          utterance.voice = preferredVoice;
        }

        if (options?.onStart) utterance.onstart = options.onStart;
        if (options?.onEnd) utterance.onend = options.onEnd;

        window.speechSynthesis.speak(utterance);
      } catch (ttsErr) {
        console.warn('Speech synthesis playback error:', ttsErr);
      }
    }, 600);
  }
}
