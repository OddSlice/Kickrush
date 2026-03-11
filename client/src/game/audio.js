// KickRush Audio — Web Audio API synthesized sounds
// AudioContext created lazily on first user interaction

export function createAudioManager() {
  let ctx = null;
  let muted = false;

  function ensureContext() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function playTone(freq, duration) {
    if (muted) return;
    const c = ensureContext();
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.25, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(c.currentTime);
    osc.stop(c.currentTime + duration);
  }

  return {
    wallHit() { playTone(440, 0.03); },

    kick() { playTone(180, 0.05); },

    goal() {
      if (muted) return;
      const c = ensureContext();
      [220, 330, 440].forEach((freq, i) => {
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const start = c.currentTime + i * 0.12;
        gain.gain.setValueAtTime(0.3, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.12);
        osc.connect(gain);
        gain.connect(c.destination);
        osc.start(start);
        osc.stop(start + 0.12);
      });
    },

    tick() { playTone(880, 0.02); },

    toggleMute() { muted = !muted; return muted; },
    isMuted() { return muted; },

    initOnInteraction() {
      ensureContext();
    },
  };
}
