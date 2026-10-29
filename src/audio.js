// All sound and music is synthesised at runtime with the Web Audio API.

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.enabled = false;
    this.loops = {};
  }

  /** Must be called from a user gesture. */
  start() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain();
    this.master.gain.value = 0.8;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);
    this.sfx = ctx.createGain(); this.sfx.connect(this.master);
    this.musicBus = ctx.createGain(); this.musicBus.gain.value = 0.0; this.musicBus.connect(this.master);
    // shared reverb for factory hall
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this._impulse(2.6, 2.2);
    this.reverbSend = ctx.createGain(); this.reverbSend.gain.value = 0.35;
    this.reverbSend.connect(this.reverb).connect(this.master);
    this.noise = this._noiseBuffer(3);
    this.brown = this._brownBuffer(4);
    this.enabled = true;
    this._ambience();
    this._loops();
  }

  get t() { return this.ctx.currentTime; }

  _noiseBuffer(sec) {
    const b = this.ctx.createBuffer(1, this.ctx.sampleRate * sec, this.ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  _brownBuffer(sec) {
    const b = this.ctx.createBuffer(1, this.ctx.sampleRate * sec, this.ctx.sampleRate);
    const d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
    return b;
  }
  _impulse(sec, decay) {
    const rate = this.ctx.sampleRate;
    const b = this.ctx.createBuffer(2, rate * sec, rate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, decay);
    }
    return b;
  }
  _src(buf, loop = true) {
    const s = this.ctx.createBufferSource();
    s.buffer = buf; s.loop = loop;
    return s;
  }

  /** Positional output node. */
  panner(x, y, z, ref = 6, rolloff = 1.3) {
    const p = this.ctx.createPanner();
    p.panningModel = 'equalpower';
    p.distanceModel = 'inverse';
    p.refDistance = ref; p.rolloffFactor = rolloff; p.maxDistance = 400;
    this.setPos(p, x, y, z);
    p.connect(this.sfx);
    p.connect(this.reverbSend);
    return p;
  }
  setPos(p, x, y, z) {
    if (p.positionX) { p.positionX.value = x; p.positionY.value = y; p.positionZ.value = z; }
    else p.setPosition(x, y, z);
  }

  setListener(cam) {
    if (!this.ctx) return;
    const l = this.ctx.listener;
    const e = cam.matrixWorld.elements;
    const fx = -e[8], fy = -e[9], fz = -e[10];
    const p = cam.position;
    if (l.positionX) {
      l.positionX.value = p.x; l.positionY.value = p.y; l.positionZ.value = p.z;
      l.forwardX.value = fx; l.forwardY.value = fy; l.forwardZ.value = fz;
      l.upX.value = 0; l.upY.value = 1; l.upZ.value = 0;
    } else {
      l.setPosition(p.x, p.y, p.z); l.setOrientation(fx, fy, fz, 0, 1, 0);
    }
  }

  // ------------------------------------------------------------------ ambience
  _ambience() {
    const ctx = this.ctx;
    this.amb = ctx.createGain(); this.amb.gain.value = 0.0; this.amb.connect(this.master);
    const n = this._src(this.brown);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380;
    const ng = ctx.createGain(); ng.gain.value = 0.55;
    n.connect(lp).connect(ng).connect(this.amb); n.start();
    for (const f of [50, 100, 150]) {
      const o = ctx.createOscillator(); o.frequency.value = f; o.type = 'sine';
      const g = ctx.createGain(); g.gain.value = f === 50 ? 0.05 : 0.018;
      o.connect(g).connect(this.amb); o.start();
    }
    // outdoor wind
    this.wind = ctx.createGain(); this.wind.gain.value = 0; this.wind.connect(this.master);
    const w = this._src(this.noise);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 500; bp.Q.value = 0.5;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.13;
    const lg = ctx.createGain(); lg.gain.value = 250;
    lfo.connect(lg).connect(bp.frequency); lfo.start();
    const wg = ctx.createGain(); wg.gain.value = 0.06;
    w.connect(bp).connect(wg).connect(this.wind); w.start();
  }

  setEnvironment(inside) {
    if (!this.ctx) return;
    this.amb.gain.setTargetAtTime(inside ? 0.22 : 0.035, this.t, 0.6);
    this.wind.gain.setTargetAtTime(inside ? 0.05 : 0.6, this.t, 0.6);
    this.reverbSend.gain.setTargetAtTime(inside ? 0.35 : 0.05, this.t, 0.6);
  }

  /** Random distant clank inside the hall. */
  clank(x, y, z) {
    if (!this.enabled) return;
    const ctx = this.ctx, t = this.t;
    const p = this.panner(x, y, z, 10, 1);
    const o = ctx.createOscillator(); o.type = 'square';
    o.frequency.value = 300 + Math.random() * 900;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1500 + Math.random() * 2500; bp.Q.value = 8;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.25, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    o.connect(bp).connect(g).connect(p); o.start(t); o.stop(t + 0.45);
  }

  // ------------------------------------------------------------------ continuous station loops
  _loops() {
    const ctx = this.ctx;
    const mk = (name, build) => { const gain = ctx.createGain(); gain.gain.value = 0; const pan = this.panner(0, 1, 0, 5, 1.2); gain.connect(pan); build(gain); this.loops[name] = { gain, pan }; };
    // welding buzz: mains-hum saw + crackling noise
    mk('weld', (out) => {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 100;
      const og = ctx.createGain(); og.gain.value = 0.12;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
      o.connect(lp).connect(og).connect(out); o.start();
      const n = this._src(this.noise);
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2500;
      const crackle = ctx.createGain(); crackle.gain.value = 0.0;
      const lfo = this._src(this.noise); const lfoF = ctx.createBiquadFilter(); lfoF.type = 'lowpass'; lfoF.frequency.value = 30;
      const lfoG = ctx.createGain(); lfoG.gain.value = 1.2;
      lfo.connect(lfoF).connect(lfoG).connect(crackle.gain); lfo.start();
      n.connect(hp).connect(crackle).connect(out); n.start();
    });
    // spray hiss
    mk('spray', (out) => {
      const n = this._src(this.noise);
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 5200; bp.Q.value = 0.7;
      const g = ctx.createGain(); g.gain.value = 0.5;
      n.connect(bp).connect(g).connect(out); n.start();
    });
    // robot servos (pitch follows speed)
    mk('servo', (out) => {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 320;
      const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = 640;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400;
      const g = ctx.createGain(); g.gain.value = 0.08;
      o.connect(lp); o2.connect(lp); lp.connect(g).connect(out); o.start(); o2.start();
      this.servoOsc = [o, o2];
    });
    // hydraulic hum (marriage lift / press)
    mk('hydraulic', (out) => {
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = 85;
      const n = this._src(this.brown); const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600;
      const g = ctx.createGain(); g.gain.value = 0.25;
      o.connect(g); n.connect(lp).connect(g); g.connect(out); o.start(); n.start();
    });
    // QC scanner tone
    mk('scan', (out) => {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 1320;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 7; const lg = ctx.createGain(); lg.gain.value = 40;
      lfo.connect(lg).connect(o.frequency); lfo.start();
      const g = ctx.createGain(); g.gain.value = 0.05;
      o.connect(g).connect(out); o.start();
    });
    // forklift reverse beeper is event-based
  }

  loop(name, level, x, y, z, pitch) {
    const L = this.loops[name];
    if (!L) return;
    L.gain.gain.setTargetAtTime(level, this.t, 0.06);
    if (x !== undefined) this.setPos(L.pan, x, y, z);
    if (name === 'servo' && pitch && this.servoOsc) {
      this.servoOsc[0].frequency.setTargetAtTime(220 + pitch * 420, this.t, 0.05);
      this.servoOsc[1].frequency.setTargetAtTime(440 + pitch * 840, this.t, 0.05);
    }
  }

  // ------------------------------------------------------------------ one-shots
  pressHit(x, y, z) {
    if (!this.enabled) return;
    const ctx = this.ctx, t = this.t;
    const p = this.panner(x, y, z, 9, 1.0);
    // body thump
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.35);
    const g = ctx.createGain(); g.gain.setValueAtTime(1.2, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    o.connect(g).connect(p); o.start(t); o.stop(t + 0.65);
    // impact noise
    const n = this._src(this.noise, false);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(3000, t); lp.frequency.exponentialRampToValueAtTime(200, t + 0.25);
    const ng = ctx.createGain(); ng.gain.setValueAtTime(0.9, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    n.connect(lp).connect(ng).connect(p); n.start(t); n.stop(t + 0.4);
    // metallic ring
    for (const f of [523, 1187, 1873]) {
      const r = ctx.createOscillator(); r.type = 'sine'; r.frequency.value = f;
      const rg = ctx.createGain(); rg.gain.setValueAtTime(0.06, t); rg.gain.exponentialRampToValueAtTime(0.0005, t + 1.1);
      r.connect(rg).connect(p); r.start(t); r.stop(t + 1.15);
    }
    // hydraulic release hiss
    const h = this._src(this.noise, false);
    const hb = ctx.createBiquadFilter(); hb.type = 'bandpass'; hb.frequency.value = 3000; hb.Q.value = 0.6;
    const hg = ctx.createGain(); hg.gain.setValueAtTime(0.0001, t + 0.25); hg.gain.linearRampToValueAtTime(0.22, t + 0.35); hg.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
    h.connect(hb).connect(hg).connect(p); h.start(t + 0.2); h.stop(t + 1.0);
  }

  ratchet(x, y, z) {
    if (!this.enabled) return;
    const ctx = this.ctx, t = this.t;
    const p = this.panner(x, y, z, 4, 1.4);
    for (let i = 0; i < 7; i++) {
      const n = this._src(this.noise, false);
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 3;
      const g = ctx.createGain(); const s = t + i * 0.045;
      g.gain.setValueAtTime(0.4, s); g.gain.exponentialRampToValueAtTime(0.001, s + 0.03);
      n.connect(bp).connect(g).connect(p); n.start(s); n.stop(s + 0.04);
    }
  }

  clunk(x, y, z, vol = 0.5) {
    if (!this.enabled) return;
    const ctx = this.ctx, t = this.t;
    const p = this.panner(x, y, z, 4, 1.3);
    const o = ctx.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(180, t); o.frequency.exponentialRampToValueAtTime(70, t + 0.12);
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    o.connect(g).connect(p); o.start(t); o.stop(t + 0.22);
  }

  slideDoor(x, y, z) {
    if (!this.enabled) return;
    const ctx = this.ctx, t = this.t;
    const p = this.panner(x, y, z, 4, 1.2);
    const n = this._src(this.noise, false);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(400, t); bp.frequency.linearRampToValueAtTime(1600, t + 0.7);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.25, t + 0.15); g.gain.linearRampToValueAtTime(0.0001, t + 0.9);
    n.connect(bp).connect(g).connect(p); n.start(t); n.stop(t + 1);
  }

  rollup(x, y, z) {
    if (!this.enabled) return;
    const ctx = this.ctx, t = this.t;
    const p = this.panner(x, y, z, 8, 1);
    for (let i = 0; i < 40; i++) {
      const s = t + i * 0.07;
      const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = 140 + Math.random() * 60;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.06, s); g.gain.exponentialRampToValueAtTime(0.001, s + 0.05);
      o.connect(g).connect(p); o.start(s); o.stop(s + 0.06);
    }
    const m = ctx.createOscillator(); m.type = 'sawtooth'; m.frequency.value = 55;
    const mg = ctx.createGain(); mg.gain.setValueAtTime(0.08, t); mg.gain.linearRampToValueAtTime(0.0001, t + 2.8);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 300;
    m.connect(lp).connect(mg).connect(p); m.start(t); m.stop(t + 2.9);
  }

  beep(x, y, z, f = 1000, len = 0.25, vol = 0.12) {
    if (!this.enabled) return;
    const ctx = this.ctx, t = this.t;
    const p = x === undefined ? this.sfx : this.panner(x, y, z, 4, 1.4);
    const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = f;
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.setValueAtTime(vol, t + len * 0.8); g.gain.linearRampToValueAtTime(0, t + len);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3000;
    o.connect(lp).connect(g).connect(p); o.start(t); o.stop(t + len + 0.02);
  }

  ui(kind = 'click') {
    if (!this.enabled) return;
    const ctx = this.ctx, t = this.t;
    const seq = { click: [[1400, 0.04]], hover: [[900, 0.02]], open: [[660, .06], [990, .08]], order: [[523, .12], [659, .12], [784, .12], [1047, .3]], pass: [[784, .1], [1047, .25]], lap: [[523, .1], [659, .1], [784, .1], [1047, .12], [1319, .4]] }[kind] || [[1000, .05]];
    let s = t;
    for (const [f, d] of seq) {
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
      const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 2;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(0.18, s + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, s + d + 0.15);
      const g2 = ctx.createGain(); g2.gain.value = 0.25;
      o.connect(g); o2.connect(g2).connect(g); g.connect(this.sfx);
      o.start(s); o2.start(s); o.stop(s + d + 0.2); o2.stop(s + d + 0.2);
      s += d;
    }
  }

  // ------------------------------------------------------------------ car engine
  engineStart() {
    if (!this.enabled || this.eng) return;
    const ctx = this.ctx;
    const out = ctx.createGain(); out.gain.value = 0; out.connect(this.sfx);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 2;
    const o1 = ctx.createOscillator(); o1.type = 'sawtooth';
    const o2 = ctx.createOscillator(); o2.type = 'square';
    const o3 = ctx.createOscillator(); o3.type = 'sawtooth';
    const g1 = ctx.createGain(); g1.gain.value = 0.35;
    const g2 = ctx.createGain(); g2.gain.value = 0.18;
    const g3 = ctx.createGain(); g3.gain.value = 0.12;
    o1.connect(g1).connect(lp); o2.connect(g2).connect(lp); o3.connect(g3).connect(lp);
    // combustion rumble AM
    const am = ctx.createGain(); am.gain.value = 0.7;
    const lfo = ctx.createOscillator(); lfo.type = 'square'; const lg = ctx.createGain(); lg.gain.value = 0.3;
    lfo.connect(lg).connect(am.gain);
    lp.connect(am).connect(out);
    // intake / exhaust noise
    const n = this._src(this.noise); const nb = ctx.createBiquadFilter(); nb.type = 'bandpass'; nb.frequency.value = 800; nb.Q.value = 0.8;
    const ng = ctx.createGain(); ng.gain.value = 0.0; n.connect(nb).connect(ng).connect(out);
    // tyre squeal
    const sq = this._src(this.noise); const sb = ctx.createBiquadFilter(); sb.type = 'bandpass'; sb.frequency.value = 1300; sb.Q.value = 9;
    const sg = ctx.createGain(); sg.gain.value = 0; sq.connect(sb).connect(sg).connect(this.sfx);
    for (const s of [o1, o2, o3, lfo, n, sq]) s.start();
    this.eng = { out, lp, o1, o2, o3, lfo, ng, sg, sb };
    out.gain.setTargetAtTime(0.3, this.t, 0.3);
    // starter
    const t = this.t;
    const st = ctx.createOscillator(); st.type = 'sawtooth'; st.frequency.setValueAtTime(30, t); st.frequency.linearRampToValueAtTime(70, t + 0.6);
    const stg = ctx.createGain(); stg.gain.setValueAtTime(0.25, t); stg.gain.linearRampToValueAtTime(0, t + 0.7);
    st.connect(stg).connect(this.sfx); st.start(t); st.stop(t + 0.75);
  }

  engineUpdate(rpm, throttle, slip) {
    const e = this.eng;
    if (!e) return;
    const t = this.t;
    const f = rpm / 60 * 4; // V8 firing frequency (4 pulses per rev)
    e.o1.frequency.setTargetAtTime(f * 0.5, t, 0.03);
    e.o2.frequency.setTargetAtTime(f * 0.25, t, 0.03);
    e.o3.frequency.setTargetAtTime(f * 1.005, t, 0.03);
    e.lfo.frequency.setTargetAtTime(f * 0.125, t, 0.03);
    e.lp.frequency.setTargetAtTime(500 + throttle * 1800 + rpm * 0.12, t, 0.05);
    e.out.gain.setTargetAtTime(0.22 + throttle * 0.22, t, 0.05);
    e.ng.gain.setTargetAtTime(throttle * 0.08, t, 0.05);
    e.sg.gain.setTargetAtTime(Math.min(slip, 1) * 0.22, t, 0.05);
    e.sb.frequency.setTargetAtTime(1100 + slip * 300, t, 0.05);
  }

  engineStop() {
    const e = this.eng;
    if (!e) return;
    e.out.gain.setTargetAtTime(0, this.t, 0.15);
    e.sg.gain.setTargetAtTime(0, this.t, 0.05);
    const keep = e;
    setTimeout(() => { for (const s of [keep.o1, keep.o2, keep.o3, keep.lfo]) try { s.stop(); } catch (_) {} }, 800);
    this.eng = null;
  }

  // ------------------------------------------------------------------ generative music (title & finish)
  music(on) {
    if (!this.enabled) return;
    this.musicBus.gain.setTargetAtTime(on ? 0.22 : 0, this.t, on ? 1.2 : 0.8);
    clearTimeout(this._musicStop);
    if (on && !this._musicTimer) this._scheduleMusic();
    if (!on && this._musicTimer) {
      this._musicStop = setTimeout(() => { clearInterval(this._musicTimer); this._musicTimer = null; }, 2500);
    }
  }

  _scheduleMusic() {
    const ctx = this.ctx;
    const chords = [[57, 60, 64, 69], [53, 57, 60, 65], [55, 59, 62, 67], [52, 55, 59, 64]];
    const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400; lp.connect(this.musicBus);
    const delay = ctx.createDelay(); delay.delayTime.value = 0.375; const fb = ctx.createGain(); fb.gain.value = 0.35;
    delay.connect(fb).connect(delay); delay.connect(this.musicBus);
    let bar = 0;
    let next = this.t + 0.1;
    const step = () => {
      while (next < this.t + 1.0) {
        const ch = chords[bar % 4];
        // pad
        for (const m of ch) {
          for (const det of [-6, 6]) {
            const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hz(m); o.detune.value = det;
            const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, next); g.gain.linearRampToValueAtTime(0.025, next + 0.8); g.gain.linearRampToValueAtTime(0.0001, next + 3.1);
            o.connect(g).connect(lp); o.start(next); o.stop(next + 3.2);
          }
        }
        // bass
        const b = ctx.createOscillator(); b.type = 'triangle'; b.frequency.value = hz(ch[0] - 24);
        const bg = ctx.createGain(); bg.gain.setValueAtTime(0.18, next); bg.gain.exponentialRampToValueAtTime(0.001, next + 2.9);
        b.connect(bg).connect(this.musicBus); b.start(next); b.stop(next + 3);
        // arpeggio
        for (let i = 0; i < 8; i++) {
          const s = next + i * 0.375;
          const m = ch[[0, 2, 1, 3, 2, 1, 3, 2][i]] + 12;
          const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = hz(m);
          const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(0.05, s + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, s + 0.3);
          o.connect(g); g.connect(this.musicBus); g.connect(delay); o.start(s); o.stop(s + 0.32);
        }
        // soft kick
        for (let i = 0; i < 4; i++) {
          const s = next + i * 0.75;
          const k = ctx.createOscillator(); k.frequency.setValueAtTime(120, s); k.frequency.exponentialRampToValueAtTime(40, s + 0.15);
          const kg = ctx.createGain(); kg.gain.setValueAtTime(0.25, s); kg.gain.exponentialRampToValueAtTime(0.001, s + 0.25);
          k.connect(kg).connect(this.musicBus); k.start(s); k.stop(s + 0.3);
        }
        next += 3.0; bar++;
      }
    };
    step();
    this._musicTimer = setInterval(step, 400);
  }
}

export const audio = new AudioEngine();
