/**
 * Everything you hear is synthesised here with WebAudio — no audio files.
 * The context is created lazily on the first user gesture, as browsers require.
 */

type ToneOpts = {
  type?: OscillatorType;
  gain?: number;
  when?: number;
  attack?: number;
  to?: number; // glide target frequency
  out?: AudioNode;
};

type NoiseOpts = {
  gain?: number;
  when?: number;
  filter?: BiquadFilterType;
  freq?: number;
  to?: number;
  q?: number;
  attack?: number;
  out?: AudioNode;
};

const midi = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

class Sound {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private music!: GainNode;
  private noiseBuf!: AudioBuffer;
  private muted = false;
  private radio = false;
  private radioVol = 0.72;
  private connectedAudioEl: HTMLAudioElement | null = null;
  private localGain: GainNode | null = null;
  private radioTimer = 0;
  private nextBar = 0;
  private bar = 0;

  unlock() {
    if (!this.ctx) {
      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC();
      } catch {
        return;
      }
      const ctx = this.ctx;
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.85;
      this.master.connect(ctx.destination);

      // Warm "Rhodes Drift" music bus: lowpass + gentle filtered echo for cozy space
      const tone = ctx.createBiquadFilter();
      tone.type = "lowpass";
      tone.frequency.value = 1650;

      const delay = ctx.createDelay(1.0);
      delay.delayTime.value = (60 / 72) * 0.75; // dotted-eighth drift echo
      const delayFilter = ctx.createBiquadFilter();
      delayFilter.type = "lowpass";
      delayFilter.frequency.value = 1100;
      const delayFeedback = ctx.createGain();
      delayFeedback.gain.value = 0.28;
      const delayWet = ctx.createGain();
      delayWet.gain.value = 0.24;

      this.music = ctx.createGain();
      this.music.gain.value = 0;
      this.music.connect(tone);
      tone.connect(this.master);

      tone.connect(delay);
      delay.connect(delayFilter);
      delayFilter.connect(delayFeedback);
      delayFeedback.connect(delay);
      delayFilter.connect(delayWet);
      delayWet.connect(this.master);

      const len = ctx.sampleRate * 2;
      this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.85, this.ctx.currentTime, 0.04);
  }

  /* ----------------------------- primitives ----------------------------- */

  private tone(freq: number, dur: number, o: ToneOpts = {}) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime + (o.when ?? 0);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = o.type ?? "sine";
    osc.frequency.setValueAtTime(freq, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.gain ?? 0.2, t + (o.attack ?? 0.006));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(o.out ?? this.master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  private noise(dur: number, o: NoiseOpts = {}) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime + (o.when ?? 0);
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = o.filter ?? "bandpass";
    f.frequency.setValueAtTime(o.freq ?? 1000, t);
    if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + dur);
    f.Q.value = o.q ?? 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.gain ?? 0.2, t + (o.attack ?? 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(o.out ?? this.master);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
    return g;
  }

  /** Soft Fender Rhodes-style electric piano voice with subtle tape drift & tine shimmer. */
  private rhodes(freq: number, dur: number, when: number, gain: number) {
    const out = this.music;
    // Warm fundamental body
    this.tone(freq, dur, { type: "sine", gain, when, attack: 0.025, out });
    // Slight detuned triangle for lush vintage tape drift
    this.tone(freq * 1.003, dur * 0.92, { type: "triangle", gain: gain * 0.52, when, attack: 0.035, out });
    // Gentle electric piano bell tine (fast decay)
    this.tone(freq * 2, Math.min(0.28, dur * 0.3), {
      type: "sine",
      gain: gain * 0.16,
      when,
      attack: 0.008,
      out,
    });
  }

  /* ------------------------------- effects ------------------------------ */

  pop() {
    this.tone(480, 0.11, { type: "triangle", gain: 0.16, to: 820 });
  }
  click() {
    this.tone(1500, 0.03, { type: "square", gain: 0.05 });
    this.tone(210, 0.07, { type: "triangle", gain: 0.14 });
  }
  discover() {
    [76, 81, 88].forEach((m, i) =>
      this.tone(midi(m), 0.5, { type: "triangle", gain: 0.13, when: i * 0.075 })
    );
  }
  secret() {
    [72, 76, 79, 84, 91].forEach((m, i) =>
      this.tone(midi(m), 0.7, { type: "triangle", gain: 0.12, when: i * 0.085 })
    );
  }
  /** Kitchen-timer bell, softened. */
  complete() {
    [72, 76, 79, 84].forEach((m, i) => {
      this.tone(midi(m), 1.8, { gain: 0.18, when: i * 0.17 });
      this.tone(midi(m) * 2.01, 1.1, { gain: 0.05, when: i * 0.17 });
    });
    [84, 88].forEach((m, i) => this.tone(midi(m), 2.2, { gain: 0.12, when: 0.85 + i * 0.2 }));
  }
  breakOver() {
    [79, 76, 72].forEach((m, i) => this.tone(midi(m), 0.9, { gain: 0.15, when: i * 0.16 }));
  }
  purr() {
    const ctx = this.ctx;
    if (!ctx || !this.noiseBuf) return;
    const t = ctx.currentTime;

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;

    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(260, t);
    f.Q.value = 1.0;

    // Soft warm throat hum that flutters with the breath noise
    const sub = ctx.createOscillator();
    sub.type = "sine";
    sub.frequency.setValueAtTime(115, t);
    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0.065, t);

    // Stage 1: positive 25 Hz tremolo multiplier ([0.47 .. 0.97]) so flutter never swings negative
    const trem = ctx.createGain();
    trem.gain.setValueAtTime(0.72, t);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 25;
    const depth = ctx.createGain();
    depth.gain.value = 0.25;
    lfo.connect(depth).connect(trem.gain);

    // Stage 2: outer envelope clearly audible on laptop speakers, fading cleanly to silence
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.38, t + 0.28);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 1.65);

    src.connect(f).connect(trem);
    sub.connect(subGain).connect(trem);
    trem.connect(env).connect(this.master);

    src.start(t, Math.random());
    src.stop(t + 1.7);
    sub.start(t);
    sub.stop(t + 1.7);
    lfo.start(t);
    lfo.stop(t + 1.7);
  }
  meow() {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const tri = ctx.createOscillator();
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    osc.type = "sine";
    tri.type = "triangle";
    const base = 510 + Math.random() * 55;
    osc.frequency.setValueAtTime(base, t);
    osc.frequency.exponentialRampToValueAtTime(base * 1.42, t + 0.1);
    osc.frequency.exponentialRampToValueAtTime(base * 0.88, t + 0.34);
    tri.frequency.setValueAtTime(base * 2, t);
    tri.frequency.exponentialRampToValueAtTime(base * 2.84, t + 0.1);
    tri.frequency.exponentialRampToValueAtTime(base * 1.76, t + 0.34);
    f.type = "lowpass";
    f.frequency.value = 1850;
    const g2 = ctx.createGain();
    g2.gain.value = 0.25;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.08, t + 0.045);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.36);
    osc.connect(f);
    tri.connect(g2).connect(f);
    f.connect(g).connect(this.master);
    osc.start(t);
    tri.start(t);
    osc.stop(t + 0.38);
    tri.stop(t + 0.38);
  }
  trill() {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(380, t);
    osc.frequency.exponentialRampToValueAtTime(670, t + 0.18);
    lfo.frequency.value = 34;
    lfoGain.gain.value = 32;
    lfo.connect(lfoGain).connect(osc.frequency);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.075, t + 0.025);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    osc.connect(g).connect(this.master);
    osc.start(t);
    lfo.start(t);
    osc.stop(t + 0.22);
    lfo.stop(t + 0.22);
  }
  catHop() {
    this.tone(165, 0.075, { type: "sine", gain: 0.045, to: 285, attack: 0.004 });
    this.noise(0.045, { filter: "lowpass", freq: 620, gain: 0.022, q: 0.9, attack: 0.003 });
  }
  callCat() {
    this.tone(880, 0.075, { type: "sine", gain: 0.06, to: 1040, attack: 0.006 });
    this.tone(1040, 0.09, { type: "sine", gain: 0.065, to: 1220, when: 0.085, attack: 0.006 });
  }
  squeak() {
    this.tone(2300, 0.09, { gain: 0.1, to: 3300 });
    this.tone(2600, 0.1, { gain: 0.1, to: 3500, when: 0.13 });
  }
  water() {
    this.noise(0.6, { freq: 2400, to: 700, gain: 0.16, q: 1.5, attack: 0.05 });
    [0.1, 0.24, 0.37].forEach((w, i) =>
      this.tone(900 + i * 240, 0.08, { gain: 0.07, to: 1500 + i * 200, when: w })
    );
  }
  sip() {
    this.noise(0.32, { filter: "bandpass", freq: 900, to: 1900, gain: 0.12, q: 2.5, attack: 0.06 });
  }
  mugPlace() {
    this.tone(320, 0.055, { type: "triangle", gain: 0.065, to: 180, attack: 0.002 });
    this.tone(1180, 0.035, { type: "sine", gain: 0.032, to: 840, attack: 0.002 });
  }
  page() {
    this.noise(0.22, { filter: "highpass", freq: 2200, gain: 0.1, attack: 0.03 });
  }
  spin() {
    this.noise(0.7, { freq: 500, to: 1600, gain: 0.07, q: 3, attack: 0.08 });
  }
  whoosh() {
    this.noise(1.1, { freq: 260, to: 1300, gain: 0.09, q: 1.2, attack: 0.35 });
  }
  sparkle() {
    [91, 96, 93, 100].forEach((m, i) => this.tone(midi(m), 0.4, { gain: 0.07, when: i * 0.06 }));
  }
  lullaby() {
    [76, 72, 69, 64].forEach((m, i) => this.tone(midi(m), 1.2, { gain: 0.12, when: i * 0.26 }));
  }
  wake() {
    [64, 69, 72, 76, 81].forEach((m, i) =>
      this.tone(midi(m), 0.7, { type: "triangle", gain: 0.1, when: i * 0.11 })
    );
  }
  step(running: boolean, crouched: boolean) {
    const pitch = crouched ? 125 : running ? 175 : 150;
    const gain = crouched ? 0.032 : running ? 0.075 : 0.05;
    this.tone(pitch + Math.random() * 25, 0.055, { type: "triangle", gain, to: 65, attack: 0.003 });
    this.noise(0.045, { filter: "bandpass", freq: running ? 950 : 720, gain: gain * 0.65, q: 1.4, attack: 0.003 });
  }
  jump() {
    this.tone(175, 0.11, { type: "sine", gain: 0.075, to: 330, attack: 0.006 });
    this.noise(0.09, { filter: "bandpass", freq: 520, to: 1050, gain: 0.04, q: 1.2, attack: 0.008 });
  }
  land(strength = 1) {
    const k = Math.min(1.4, Math.max(0.4, strength));
    this.tone(120, 0.09, { type: "triangle", gain: 0.09 * k, to: 52, attack: 0.003 });
    this.noise(0.07, { filter: "lowpass", freq: 580, gain: 0.06 * k, q: 0.9, attack: 0.003 });
  }
  bell() {
    this.tone(2450, 0.24, { type: "sine", gain: 0.045, attack: 0.002 });
    this.tone(3680, 0.18, { type: "sine", gain: 0.025, attack: 0.002, when: 0.01 });
  }
  scratch() {
    this.noise(0.11, { filter: "bandpass", freq: 1600, to: 900, gain: 0.08, q: 1.5, attack: 0.005 });
  }
  yarnBat() {
    this.tone(210, 0.07, { type: "triangle", gain: 0.055, to: 115, attack: 0.003 });
    this.noise(0.06, { filter: "lowpass", freq: 480, gain: 0.04, q: 0.8, attack: 0.004 });
  }
  laserBeep() {
    this.tone(1850, 0.05, { type: "sine", gain: 0.05, to: 2200, attack: 0.002 });
  }
  boxRustle() {
    this.noise(0.18, { filter: "bandpass", freq: 750, to: 420, gain: 0.07, q: 1.1, attack: 0.01 });
  }
  exerciseDone() {
    [72, 76, 84].forEach((m, i) =>
      this.tone(midi(m), 0.55, { type: "triangle", gain: 0.12, when: i * 0.09 }),
    );
  }
  rhythmNote(lane: 0 | 1 | 2) {
    const notes = [72, 76, 79] as const;
    this.tone(midi(notes[lane]), 0.36, { type: "sine", gain: 0.11, attack: 0.008 });
  }
  gachaCrank() {
    this.tone(360, 0.055, { type: "triangle", gain: 0.08, to: 440, attack: 0.003 });
    this.tone(420, 0.055, { type: "triangle", gain: 0.08, to: 520, when: 0.14, attack: 0.003 });
    this.tone(midi(76), 0.28, { type: "sine", gain: 0.1, when: 0.42, attack: 0.008 });
  }

  /* -------------------------------- radio ------------------------------- */

  setRadioVolume(vol: number) {
    this.radioVol = Math.min(1, Math.max(0, vol));
    const ctx = this.ctx;
    if (!ctx) return;
    if (this.radio) {
      this.music.gain.setTargetAtTime(0.8 * this.radioVol, ctx.currentTime, 0.04);
    }
    if (this.localGain) {
      this.localGain.gain.setTargetAtTime(this.radioVol, ctx.currentTime, 0.04);
    }
  }

  attachCozyAudio(el: HTMLAudioElement): boolean {
    this.unlock();
    const ctx = this.ctx;
    if (!ctx) return false;
    if (this.connectedAudioEl === el) return true;
    try {
      const src = ctx.createMediaElementSource(el);
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 165;
      hp.Q.value = 0.7;

      const mid = ctx.createBiquadFilter();
      mid.type = "peaking";
      mid.frequency.value = 1150;
      mid.Q.value = 0.9;
      mid.gain.value = 3.2;

      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 3400;
      lp.Q.value = 0.75;

      const gain = ctx.createGain();
      gain.gain.value = this.radioVol;

      src.connect(hp).connect(mid).connect(lp).connect(gain).connect(this.master);
      this.localGain = gain;
      this.connectedAudioEl = el;
      return true;
    } catch {
      return false;
    }
  }

  setRadio(on: boolean) {
    this.radio = on;
    if (on) this.unlock();
    const ctx = this.ctx;
    if (!ctx) return;
    window.clearInterval(this.radioTimer);
    this.music.gain.cancelScheduledValues(ctx.currentTime);
    this.music.gain.setTargetAtTime(on ? 0.8 * this.radioVol : 0, ctx.currentTime, on ? 0.45 : 0.15);
    if (!on) return;
    this.nextBar = ctx.currentTime + 0.08;
    const pump = () => {
      if (!this.radio || !this.ctx) return;
      while (this.nextBar < this.ctx.currentTime + 1.6) {
        this.scheduleBar(this.nextBar - this.ctx.currentTime);
        this.nextBar += BAR;
        this.bar++;
      }
    };
    pump();
    this.radioTimer = window.setInterval(pump, 300);
  }

  /** One bar of "Rhodes Drift" lo-fi: warm Rhodes chords, sub-bass, swung soft beats, vinyl. */
  private scheduleBar(when: number) {
    const out = this.music;
    const step = PROGRESSION[this.bar % PROGRESSION.length];
    const beat = BAR / 4;

    // 1. Warm sub-bass on beat 1 (+ subtle pickup note near end of bar)
    this.tone(midi(step.bass), BAR * 0.78, { type: "sine", gain: 0.2, when, attack: 0.05, out });
    if (this.bar % 2 === 1) {
      this.tone(midi(step.bass + 7), beat * 0.7, {
        type: "sine",
        gain: 0.1,
        when: when + beat * 3.58,
        attack: 0.03,
        out,
      });
    }

    // 2. Strummed Rhodes chord with gentle spread
    step.chord.forEach((m, i) => {
      const w = when + i * 0.042;
      this.rhodes(midi(m), BAR * 0.92, w, 0.068);
    });

    // Subtle mid-bar chord re-touch for dreamy flow
    if (Math.random() < 0.55) {
      const top = step.chord.slice(-3);
      top.forEach((m, i) => {
        this.rhodes(midi(m), beat * 1.4, when + beat * 2.58 + i * 0.035, 0.036);
      });
    }

    // 3. Cozy deep-focus drums (pillow kick, dragged brushed snare, swung hats)
    for (let b = 0; b < 4; b++) {
      const w = when + b * beat;
      if (b === 0 || (b === 2 && Math.random() < 0.75)) {
        this.tone(95, 0.24, { gain: 0.28, to: 38, when: w, out });
      }
      if (b === 1 || b === 3) {
        this.noise(0.15, { filter: "bandpass", freq: 1450, gain: 0.085, q: 0.85, when: w + 0.015, out });
      }
      // Swung soft hi-hat
      this.noise(0.035, { filter: "highpass", freq: 6200, gain: 0.025, when: w + beat * 0.58, out });
    }
    // Occasional lazy ghost kick on beat 2.58
    if (Math.random() < 0.45) {
      this.tone(90, 0.18, { gain: 0.15, to: 40, when: when + beat * 2.58, out });
    }

    // 4. Gentle vinyl crackle
    for (let i = 0; i < 8; i++) {
      this.noise(0.01, {
        filter: "highpass",
        freq: 3400,
        gain: 0.015 + Math.random() * 0.022,
        when: when + Math.random() * BAR,
        attack: 0.002,
        out,
      });
    }
  }
}

const BAR = (60 / 72) * 4;

// Warm Fmaj7 -> Em7 -> Dm7 -> Cmaj7 progression ("Rhodes Drift", 72 BPM)
const PROGRESSION: { bass: number; chord: number[] }[] = [
  { bass: 41, chord: [53, 57, 60, 64, 67] },
  { bass: 40, chord: [52, 55, 59, 62, 67] },
  { bass: 38, chord: [50, 53, 57, 60, 64] },
  { bass: 36, chord: [48, 52, 55, 59, 62] },
];

export const sound = new Sound();
