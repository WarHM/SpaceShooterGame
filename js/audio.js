let ctx = null;

export function initAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) ctx = new AC();
  }
  if (ctx && ctx.state === "suspended") ctx.resume();
}

function tone(freq, duration, type, volume, slide) {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  if (slide) {
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(30, freq + slide),
      ctx.currentTime + duration
    );
  }
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + duration);
}

export const sfx = {
  shoot() { tone(880, 0.08, "square", 0.06, -500); },
  hit() { tone(240, 0.12, "sawtooth", 0.12, -120); },
  explosion() { tone(110, 0.35, "sawtooth", 0.18, -70); },
  powerup() { tone(660, 0.15, "sine", 0.15, 440); },
  playerHit() { tone(160, 0.45, "square", 0.18, -110); },
  wave() { tone(440, 0.25, "sine", 0.1, 220); },
};
