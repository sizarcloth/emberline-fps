// Synthesized sound: every effect is built from oscillators and filtered noise
// at boot, so the game ships no audio files. The context starts on the first
// user gesture; distant shots are quieter and low-passed by distance.
export function createAudio() {
  let ctx = null;
  let master = null;
  let noiseBuf = null;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      return false;
    }
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return true;
  }

  function noise({ at = 0, dur = 0.12, freq = 1800, q = 0.8, gain = 0.5, type = 'bandpass' }) {
    if (!ctx) return;
    const t = ctx.currentTime + at;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  function tone({ at = 0, dur = 0.1, from = 440, to = 440, gain = 0.2, type = 'sine' }) {
    if (!ctx) return;
    const t = ctx.currentTime + at;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  const SHOTS = {
    pistol: { dur: 0.11, freq: 1400, gain: 0.5, thump: 160 },
    smg: { dur: 0.08, freq: 1900, gain: 0.34, thump: 190 },
    rifle: { dur: 0.13, freq: 1100, gain: 0.55, thump: 120 },
    dmr: { dur: 0.2, freq: 750, gain: 0.7, thump: 80 },
    shotgun: { dur: 0.18, freq: 600, gain: 0.8, thump: 65 },
  };

  return {
    unlock() {
      ensure();
    },
    shoot(kind, distance = 0) {
      if (!ensure()) return;
      const s = SHOTS[kind] || SHOTS.rifle;
      const att = 1 / (1 + distance * 0.09);
      noise({ dur: s.dur, freq: Math.max(300, s.freq - distance * 22), gain: s.gain * att });
      tone({ dur: 0.09, from: s.thump, to: 45, gain: 0.5 * att, type: 'sine' });
    },
    dryFire() {
      if (!ensure()) return;
      tone({ dur: 0.03, from: 1200, to: 900, gain: 0.12, type: 'square' });
    },
    reload() {
      if (!ensure()) return;
      tone({ dur: 0.04, from: 700, to: 500, gain: 0.16, type: 'square' });
      tone({ at: 0.28, dur: 0.04, from: 900, to: 650, gain: 0.16, type: 'square' });
      tone({ at: 0.6, dur: 0.05, from: 1100, to: 800, gain: 0.18, type: 'square' });
    },
    hit() {
      if (!ensure()) return;
      tone({ dur: 0.05, from: 2400, to: 1800, gain: 0.14, type: 'sine' });
    },
    kill() {
      if (!ensure()) return;
      tone({ dur: 0.07, from: 1800, to: 1800, gain: 0.16, type: 'sine' });
      tone({ at: 0.08, dur: 0.1, from: 2400, to: 2400, gain: 0.16, type: 'sine' });
    },
    hurt() {
      if (!ensure()) return;
      tone({ dur: 0.14, from: 140, to: 60, gain: 0.4, type: 'sine' });
      noise({ dur: 0.1, freq: 400, gain: 0.2, type: 'lowpass' });
    },
    step() {
      if (!ensure()) return;
      noise({ dur: 0.05, freq: 300, gain: 0.06, type: 'lowpass' });
    },
    buy() {
      if (!ensure()) return;
      tone({ dur: 0.06, from: 1320, to: 1320, gain: 0.14, type: 'sine' });
      tone({ at: 0.07, dur: 0.09, from: 1760, to: 1760, gain: 0.14, type: 'sine' });
    },
    roundStart() {
      if (!ensure()) return;
      tone({ dur: 0.12, from: 660, to: 660, gain: 0.16, type: 'triangle' });
      tone({ at: 0.12, dur: 0.16, from: 880, to: 880, gain: 0.16, type: 'triangle' });
    },
    roundWin() {
      if (!ensure()) return;
      [523, 659, 784, 1047].forEach((f, i) => tone({ at: i * 0.11, dur: 0.16, from: f, to: f, gain: 0.18, type: 'triangle' }));
    },
    roundLose() {
      if (!ensure()) return;
      [392, 330, 262].forEach((f, i) => tone({ at: i * 0.14, dur: 0.2, from: f, to: f, gain: 0.16, type: 'triangle' }));
    },
  };
}
