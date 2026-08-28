/* موتور صدا — همه‌ی افکت‌ها رویه‌ساز با WebAudio (بدون فایل خارجی) */

export class SFX {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private windSrc: AudioBufferSourceNode | null = null;
  private windGain: GainNode | null = null;

  init() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return;
    }
    const AC: typeof AudioContext =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);

    const len = this.ctx.sampleRate * 2;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }

  private env(peak: number, attack: number, decay: number): GainNode | null {
    if (!this.ctx || !this.master) return null;
    const g = this.ctx.createGain();
    const t = this.ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    g.connect(this.master);
    return g;
  }

  private noiseBurst(opts: { peak: number; decay: number; from: number; to: number; type?: BiquadFilterType }) {
    if (!this.ctx || !this.noise) return;
    const g = this.env(opts.peak, 0.002, opts.decay);
    if (!g) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = opts.type ?? "lowpass";
    const t = this.ctx.currentTime;
    f.frequency.setValueAtTime(opts.from, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(30, opts.to), t + opts.decay);
    src.connect(f).connect(g);
    src.start(t);
    src.stop(t + opts.decay + 0.05);
  }

  private tone(freq: number, freqEnd: number, peak: number, decay: number, type: OscillatorType = "square", delay = 0) {
    if (!this.ctx) return;
    const g = this.env(peak, 0.004, decay);
    if (!g) return;
    const o = this.ctx.createOscillator();
    o.type = type;
    const t = this.ctx.currentTime + delay;
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t + decay);
    o.connect(g);
    o.start(t);
    o.stop(t + decay + 0.05);
  }

  shot(kind: "ak" | "pistol" = "ak") {
    if (kind === "ak") {
      this.noiseBurst({ peak: 0.5, decay: 0.15, from: 2600, to: 300 });
      this.noiseBurst({ peak: 0.22, decay: 0.05, from: 6000, to: 1500, type: "bandpass" });
      this.tone(140, 55, 0.28, 0.11, "triangle");
    } else {
      this.noiseBurst({ peak: 0.42, decay: 0.1, from: 3400, to: 500 });
      this.tone(220, 90, 0.2, 0.08, "triangle");
    }
  }

  enemyShot(vol: number) {
    const v = Math.min(0.4, Math.max(0.05, vol));
    this.noiseBurst({ peak: v, decay: 0.13, from: 1400, to: 250 });
    this.tone(120, 60, v * 0.5, 0.1, "triangle");
  }

  hit(head: boolean) {
    if (head) {
      this.tone(1250, 1650, 0.16, 0.09, "square");
      this.tone(1870, 2400, 0.1, 0.12, "sine");
    } else {
      this.tone(420, 300, 0.13, 0.05, "square");
    }
  }

  step(alt: boolean) {
    this.noiseBurst({ peak: 0.045, decay: 0.07, from: alt ? 220 : 180, to: 90 });
  }

  reload() {
    this.tone(700, 500, 0.09, 0.05, "square");
    this.tone(500, 380, 0.09, 0.05, "square", 0.35);
    this.tone(900, 700, 0.11, 0.06, "square", 1.4);
  }

  hurt() {
    this.tone(160, 60, 0.28, 0.22, "sawtooth");
    this.noiseBurst({ peak: 0.15, decay: 0.18, from: 700, to: 150 });
  }

  death() {
    this.tone(300, 90, 0.15, 0.3, "sawtooth");
  }

  wave() {
    this.tone(196, 196, 0.13, 0.5, "sawtooth");
    this.tone(294, 294, 0.11, 0.55, "sawtooth", 0.02);
    this.tone(392, 392, 0.11, 0.6, "sawtooth", 0.18);
  }

  click() {
    this.tone(900, 650, 0.07, 0.05, "square");
  }

  swap() {
    this.tone(500, 760, 0.07, 0.06, "square");
    this.tone(760, 520, 0.06, 0.05, "square", 0.09);
  }

  empty() {
    this.tone(240, 180, 0.09, 0.04, "square");
  }

  knife() {
    this.noiseBurst({ peak: 0.16, decay: 0.16, from: 700, to: 2600, type: "bandpass" });
  }

  explosion() {
    this.noiseBurst({ peak: 0.85, decay: 0.9, from: 1000, to: 55 });
    this.tone(95, 28, 0.5, 0.8, "sine");
    this.noiseBurst({ peak: 0.3, decay: 0.35, from: 3000, to: 700, type: "bandpass" });
  }

  pickup() {
    this.tone(660, 660, 0.09, 0.08, "square");
    this.tone(990, 990, 0.09, 0.1, "square", 0.08);
  }

  allyDown() {
    this.tone(330, 165, 0.16, 0.5, "sawtooth");
  }

  gameOver() {
    this.tone(220, 110, 0.24, 0.9, "sawtooth");
    this.tone(160, 70, 0.2, 0.9, "sawtooth", 0.3);
  }

  startWind() {
    if (!this.ctx || !this.noise || this.windSrc) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 260;
    const g = this.ctx.createGain();
    g.gain.value = 0.0001;
    g.gain.linearRampToValueAtTime(0.055, this.ctx.currentTime + 2);
    src.connect(f).connect(g).connect(this.master!);
    src.start();
    this.windSrc = src;
    this.windGain = g;
  }

  stopWind() {
    if (this.windSrc && this.windGain && this.ctx) {
      this.windGain.gain.linearRampToValueAtTime(0.0001, this.ctx.currentTime + 0.6);
      const src = this.windSrc;
      setTimeout(() => {
        try {
          src.stop();
        } catch {
          /* ignore */
        }
      }, 700);
      this.windSrc = null;
      this.windGain = null;
    }
  }
  /* ---------- جدید: موسیقی و افکت‌های سلاح ---------- */

  private musicNodes: AudioNode[] = [];
  private musicGain: GainNode | null = null;

  setVolume(v: number) {
    if (this.master) this.master.gain.value = Math.max(0, Math.min(1, v));
  }

  startMusic() {
    if (!this.ctx || !this.master || this.musicGain) return;
    const c = this.ctx;
    const g = c.createGain();
    g.gain.value = 0.055;
    g.connect(this.master);
    this.musicGain = g;
    // درونِ بم و کشدار
    for (const f of [55, 55.6, 110.4]) {
      const o = c.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = f;
      const lp = c.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 240;
      const og = c.createGain();
      og.gain.value = f > 100 ? 0.25 : 0.6;
      o.connect(lp).connect(og).connect(g);
      o.start();
      this.musicNodes.push(o);
    }
    // پالس تنش — نویز فیلترشده با LFO
    const n = c.createBufferSource();
    n.buffer = this.noise;
    n.loop = true;
    const bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 420;
    bp.Q.value = 1.6;
    const ng = c.createGain();
    ng.gain.value = 0.12;
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.09;
    const lfoG = c.createGain();
    lfoG.gain.value = 0.1;
    lfo.connect(lfoG).connect(ng.gain);
    n.connect(bp).connect(ng).connect(g);
    n.start();
    lfo.start();
    this.musicNodes.push(n, lfo);
  }

  stopMusic() {
    for (const n of this.musicNodes) {
      try {
        (n as OscillatorNode).stop?.();
      } catch {
        /* ignore */
      }
      n.disconnect();
    }
    this.musicNodes = [];
    if (this.musicGain) {
      this.musicGain.disconnect();
      this.musicGain = null;
    }
  }

  pump() {
    this.tone(340, 220, 0.12, 0.05, "square");
    setTimeout(() => this.noiseBurst({ peak: 0.12, decay: 0.06, from: 2400, to: 600 }), 140);
    setTimeout(() => this.tone(260, 180, 0.1, 0.05, "square"), 300);
  }

  bolt() {
    this.tone(900, 700, 0.1, 0.04, "square");
    setTimeout(() => this.tone(520, 380, 0.12, 0.06, "square"), 120);
    setTimeout(() => this.noiseBurst({ peak: 0.08, decay: 0.05, from: 4000, to: 1200 }), 260);
  }

  beep() {
    this.tone(880, 880, 0.1, 0.1, "sine");
  }

  metal() {
    this.tone(1600, 900, 0.1, 0.06, "square");
    this.noiseBurst({ peak: 0.08, decay: 0.05, from: 6000, to: 2000, type: "highpass" });
  }

  bigExplosion() {
    this.noiseBurst({ peak: 0.7, decay: 0.9, from: 900, to: 60 });
    this.tone(90, 30, 0.4, 0.8, "triangle");
    this.noiseBurst({ peak: 0.3, decay: 0.3, from: 3000, to: 200 });
  }

  achv() {
    this.tone(660, 660, 0.09, 0.12, "sine");
    setTimeout(() => this.tone(990, 990, 0.09, 0.16, "sine"), 110);
  }
}

export const sfx = new SFX();
