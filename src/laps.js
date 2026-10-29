// Lap timing with ordered checkpoints so a lap only counts once the full loop is driven.
import track from './data/track.json';

const PTS = track.points;
const N = PTS.length;
const CHECKS = [Math.round(N * 0.25), Math.round(N * 0.5), Math.round(N * 0.75)];

export class LapTimer {
  constructor() {
    const [x0, z0] = PTS[0], [x1, z1] = PTS[1];
    const l = Math.hypot(x1 - x0, z1 - z0);
    this.o = { x: x0, z: z0 };
    this.t = { x: (x1 - x0) / l, z: (z1 - z0) / l };
    this.reset();
  }
  reset() {
    this.running = false;
    this.time = 0;
    this.next = 0;
    this.prevSide = null;
    this.laps = [];
    this.best = null;
  }
  get checkpoints() { return CHECKS.map((i) => PTS[i]); }

  /** Returns 'start' | 'lap' | 'checkpoint' | null */
  update(dt, x, z) {
    let ev = null;
    if (this.running) this.time += dt;
    if (this.running && this.next < CHECKS.length) {
      const [cx, cz] = PTS[CHECKS[this.next]];
      if (Math.hypot(cx - x, cz - z) < 20) { this.next++; ev = 'checkpoint'; }
    }
    const dx = x - this.o.x, dz = z - this.o.z;
    const along = dx * this.t.x + dz * this.t.z;
    const lat = Math.abs(dx * this.t.z - dz * this.t.x);
    const side = along >= 0;
    if (this.prevSide === false && side && lat < 12) {
      if (!this.running) { this.running = true; this.time = 0; this.next = 0; ev = 'start'; }
      else if (this.next >= CHECKS.length) {
        this.laps.push(this.time);
        this.best = this.best === null ? this.time : Math.min(this.best, this.time);
        this.lastLap = this.time;
        this.time = 0; this.next = 0;
        ev = 'lap';
      }
    }
    if (lat < 30) this.prevSide = side; else this.prevSide = null;
    return ev;
  }
}

export function fmtTime(t) {
  if (t === null || t === undefined) return '--:--.---';
  const m = Math.floor(t / 60), s = t - m * 60;
  return `${String(m).padStart(2, '0')}:${s.toFixed(3).padStart(6, '0')}`;
}
