// Gentle two-tone "murr" chime via WebAudio — no external assets needed.
let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function note(ac: AudioContext, freq: number, start: number, dur: number, vol: number) {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, start);
  osc.frequency.exponentialRampToValueAtTime(freq * 0.82, start + dur);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(vol, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(gain).connect(ac.destination);
  osc.start(start);
  osc.stop(start + dur + 0.05);
}

export function playChime() {
  const ac = getCtx();
  if (!ac) return;
  const t = ac.currentTime;
  // two soft "meow-like" descending tones
  note(ac, 760, t, 0.28, 0.22);
  note(ac, 1020, t + 0.16, 0.22, 0.14);
  note(ac, 620, t + 0.34, 0.4, 0.2);
}
