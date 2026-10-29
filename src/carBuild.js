// One car on the line, built from separate Blender parts. Every part's pose is a
// pure function of (slot, progress) so the line can be fast-forwarded or jumped.
import * as THREE from 'three';
import { COLORS, WHEELS, EXTRAS } from './data/content.js';

export const SKID_Y = 0.18;
export const BODY_Y = 0.28;          // body origin height while on the skid
export const WHEEL_POS = [           // hub positions (three coords, body frame); left = -z
  { name: 'FL', x: 1.38, z: -0.80, front: true, left: true },
  { name: 'FR', x: 1.38, z: 0.80, front: true, left: false },
  { name: 'RL', x: -1.33, z: -0.80, front: false, left: true },
  { name: 'RR', x: -1.33, z: 0.80, front: false, left: false },
];
export const WHEEL_R = 0.34;

export const STAMP_ORDER = ['body_floor', 'fender_L', 'fender_R', 'quarter_L', 'quarter_R', 'hood', 'trunk', 'roof', 'bumper_F', 'bumper_R', 'door_L', 'door_R'];
export const WELD_ORDER = ['fender_L', 'fender_R', 'quarter_L', 'quarter_R', 'bumper_F', 'bumper_R', 'roof', 'hood', 'trunk'];
const EXPL = {
  body_floor: [0, 0, 0],
  fender_L: [0.35, 0.6, -1.05], fender_R: [0.35, 0.6, 1.05],
  quarter_L: [-0.35, 0.6, -1.05], quarter_R: [-0.35, 0.6, 1.05],
  hood: [0.55, 1.05, 0], trunk: [-0.6, 1.05, 0], roof: [0, 1.25, 0],
  bumper_F: [1.0, 0.3, 0], bumper_R: [-1.0, 0.3, 0],
  door_L: [0, 0.35, -1.35], door_R: [0, 0.35, 1.35],
  mirror_L: [0, 0.35, -1.35], mirror_R: [0, 0.35, 1.35], trim_L: [0, 0.35, -1.35], trim_R: [0, 0.35, 1.35],
};
// Final assembly: groups installed one after another. src = offset of the source pose.
export const FINAL_GROUPS = [
  { parts: ['door_L', 'mirror_L', 'trim_L'], fromExpl: true, label: 'Doors' },
  { parts: ['door_R', 'mirror_R', 'trim_R'], fromExpl: true, label: 'Doors' },
  { parts: ['glass_front'], src: [0.6, 2.4, -3.2], label: 'Windscreen' },
  { parts: ['glass_rear'], src: [-0.6, 2.4, -3.2], label: 'Rear glass' },
  { parts: ['glass_L', 'glass_R'], src: [0, 2.4, -3.2], label: 'Side glass' },
  { parts: ['seat_L', 'seat_R', 'dashboard'], src: [0, 1.6, 3.0], label: 'Seats & dashboard' },
  { parts: ['headlight_L', 'headlight_R', 'taillight_L', 'taillight_R', 'grille'], src: [0, 1.3, -3.0], label: 'Lights' },
  { wheel: 0, label: 'Wheels' }, { wheel: 1, label: 'Wheels' }, { wheel: 2, label: 'Wheels' }, { wheel: 3, label: 'Wheels' },
  { extra: true, src: [0, 3.2, 0], label: 'Extra' },
];
export const FINAL_A0 = 0.03, FINAL_W = 0.078;

const PRIMER = new THREE.Color(0.62, 0.64, 0.67);
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const ease = (t) => t * t * (3 - 2 * t);

export function stampWindow(k, p) { const a = 0.03 + k * 0.075; return (p - a) / 0.075; }
export function weldWindow(k, p) { const a = 0.04 + k * 0.1; return (p - a) / 0.1; }
export function finalWindow(k, p) { const a = FINAL_A0 + k * FINAL_W; return (p - a) / FINAL_W; }

export function randomConfig() {
  return {
    color: COLORS[Math.floor(Math.random() * COLORS.length)].id,
    wheels: WHEELS[Math.floor(Math.random() * WHEELS.length)].id,
    extra: EXTRAS[Math.floor(Math.random() * EXTRAS.length)].id,
  };
}

let glassMat = null;

export class CarBuild {
  constructor(assets, cfg) {
    this.assets = assets;
    this.root = new THREE.Group();
    this.root.name = 'carInstance';
    this.skid = assets.clone('skid');
    this.skid.position.y = SKID_Y;
    this.root.add(this.skid);
    this.body = new THREE.Group();
    this.body.position.y = BODY_Y;
    this.root.add(this.body);

    this.paint = new THREE.MeshPhysicalMaterial({
      name: 'PaintInstance', color: PRIMER.clone(), metalness: 0.8, roughness: 0.42,
      clearcoat: 0, clearcoatRoughness: 0.06, envMapIntensity: 1.2, side: THREE.DoubleSide,
    });
    if (!glassMat) {
      glassMat = new THREE.MeshPhysicalMaterial({ name: 'GlassInstance', color: 0x05080b, metalness: 0.3, roughness: 0.03, transparent: true, opacity: 0.82, side: THREE.DoubleSide, envMapIntensity: 1.6, depthWrite: false });
    }
    this.stripeMat = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.3, metalness: 0.2, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 });
    this.headMat = null; this.tailMat = null;

    this.parts = new Map();
    const tpl = assets.get('car');
    for (const c of tpl.children) {
      if (c.name.startsWith('wheel_') || c.name === 'brake') continue;
      const o = c.clone(true);
      this._materials(o);
      const small = /^(seat|dashboard|trim|mirror|headlight|taillight|grille|glass|powertrain|stripes|roofrack)/.test(c.name);
      o.traverse((m) => { if (m.isMesh) { m.castShadow = !small; m.receiveShadow = !/^glass/.test(c.name); } });
      this.body.add(o);
      const inst = { p: c.position.clone(), q: c.quaternion.clone() };
      const e = EXPL[c.name] || [0, 0, 0];
      const expl = { p: inst.p.clone().add(new THREE.Vector3(...e)), q: inst.q.clone() };
      const box = new THREE.Box3().setFromObject(c.clone(true).translateX(0));
      const center = box.getCenter(new THREE.Vector3()).sub(c.position);
      center.y = box.min.y - c.position.y; // rest the panel's lowest point on the die
      this.parts.set(c.name, { obj: o, inst, expl, center });
    }
    this.wheels = WHEEL_POS.map((w) => {
      const pivot = new THREE.Group();
      pivot.position.set(w.x, WHEEL_R, w.z);
      const spinner = new THREE.Group();
      pivot.add(spinner);
      this.body.add(pivot);
      return { ...w, pivot, spinner, mesh: null, inst: pivot.position.clone(), steer: 0, spin: 0 };
    });
    this.cfg = null;
    this.setConfig(cfg || randomConfig());
    this._tmpV = new THREE.Vector3();
    this._tmpQ = new THREE.Quaternion();
    this.paintF = -1;
    this.lightsOn = false;
  }

  _materials(o) {
    o.traverse((m) => {
      if (!m.isMesh) return;
      const swap = (mat) => {
        if (mat.name === 'Paint') return this.paint;
        if (mat.name === 'Glass') return glassMat;
        if (mat.name === 'Stripe') return this.stripeMat;
        if (mat.name === 'HeadLight') { if (!this.headMat) { this.headMat = mat.clone(); } return this.headMat; }
        if (mat.name === 'TailLight') { if (!this.tailMat) { this.tailMat = mat.clone(); } return this.tailMat; }
        return mat;
      };
      m.material = Array.isArray(m.material) ? m.material.map(swap) : swap(m.material);
    });
  }

  setConfig(cfg) {
    this.cfg = { ...cfg };
    const col = COLORS.find((c) => c.id === cfg.color) || COLORS[0];
    this.color = new THREE.Color(col.hex);
    const lum = this.color.r * 0.3 + this.color.g * 0.59 + this.color.b * 0.11;
    this.stripeMat.color.set(lum > 0.55 ? 0x111111 : 0xf2f2f2);
    // rebuild wheels with the selected style
    const wdef = WHEELS.find((w) => w.id === cfg.wheels) || WHEELS[0];
    for (const w of this.wheels) {
      w.spinner.clear();
      const mesh = this.assets.clone(wdef.mesh);
      const brake = this.assets.clone('brake');
      const holder = new THREE.Group();
      holder.add(mesh, brake);
      if (!w.left) holder.rotation.y = Math.PI;
      mesh.traverse((m) => { if (m.isMesh) m.castShadow = true; });
      w.spinner.add(holder);
      w.mesh = holder;
    }
    for (const e of EXTRAS) {
      const p = this.parts.get(e.id);
      if (p) p.enabledExtra = e.id === cfg.extra;
    }
    this.paintF = -1; // force paint refresh
  }

  get colorName() { return (COLORS.find((c) => c.id === this.cfg.color) || COLORS[0]).name; }

  // ------------------------------------------------------------------ poses
  _set(name, mode, t = 1, from = null, arc = 0.8) {
    const P = this.parts.get(name);
    if (!P) return;
    const o = P.obj;
    if (P.enabledExtra === false) { o.visible = false; return; }
    if (mode === 'hidden') { o.visible = false; return; }
    o.visible = true;
    if (mode === 'installed') { o.position.copy(P.inst.p); o.quaternion.copy(P.inst.q); return; }
    if (mode === 'exploded') { o.position.copy(P.expl.p); o.quaternion.copy(P.expl.q); return; }
    // transit: from pose -> installed (or explicit to)
    const to = mode.to || P.inst;
    const fr = from;
    const e = ease(clamp01(t));
    o.position.lerpVectors(fr.p, to.p, e);
    o.position.y += Math.sin(Math.PI * e) * arc;
    o.quaternion.slerpQuaternions(fr.q, to.q, e);
  }

  partPose(name, which) { return this.parts.get(name)[which]; }

  /** World position of a part (current). */
  partWorld(name, out = new THREE.Vector3()) {
    const P = this.parts.get(name);
    return P.obj.getWorldPosition(out);
  }

  setWheel(i, mode, t = 1) {
    const w = this.wheels[i];
    if (mode === 'hidden') { w.pivot.visible = false; return; }
    w.pivot.visible = true;
    if (mode === 'installed') { w.pivot.position.copy(w.inst); return; }
    const src = w.inst.clone().add(new THREE.Vector3(0, 0.7, w.left ? -2.6 : 2.6));
    const e = ease(clamp01(t));
    w.pivot.position.lerpVectors(src, w.inst, e);
    w.pivot.position.y += Math.sin(Math.PI * e) * 0.3;
  }

  setPaint(f) {
    if (Math.abs(f - this.paintF) < 1e-4) return;
    this.paintF = f;
    this.paint.color.copy(PRIMER).lerp(this.color, f);
    this.paint.metalness = THREE.MathUtils.lerp(0.8, 0.45, f);
    this.paint.roughness = THREE.MathUtils.lerp(0.42, 0.2, f);
    this.paint.clearcoat = f;
  }

  setLights(on, brake = false) {
    if (this.headMat) this.headMat.emissiveIntensity = on ? 3.6 : 0.25;
    if (this.tailMat) this.tailMat.emissiveIntensity = brake ? 12 : on ? 3 : 0.3;
  }

  /** Raise/lower the body relative to the skid (engine marriage, delivery). */
  setBodyLift(y) { this.body.position.y = BODY_Y + y; }

  // ------------------------------------------------------------------ state per station
  /**
   * slot: line slot index (0 loading … 7 delivery); p: dwell progress 0..1.
   * extra: { powertrain: {p: Vector3} | null } from the engine station.
   */
  applyState(slot, p, extra = {}) {
    const S = (s) => slot > s || (slot === s && p >= 1);
    // stamping (1) + body shop (2)
    STAMP_ORDER.forEach((name, k) => {
      if (name.startsWith('door')) return; // doors are handled with the final-assembly groups
      if (slot < 1) return this._set(name, 'hidden');
      let state = 'exploded';
      if (slot === 1) {
        const w = stampWindow(k, p);
        if (w < 0.35) return this._set(name, 'hidden');
        if (w < 1) return this._stampTransit(name, w, extra);
      }
      if (name === 'body_floor') return this._set(name, 'installed');
      const wk = WELD_ORDER.indexOf(name);
      if (wk >= 0 && slot >= 2) {
        if (S(2)) return this._set(name, 'installed');
        if (slot === 2) {
          const w = weldWindow(wk, p);
          if (w <= 0) return this._set(name, 'exploded');
          if (w < 0.45) return this._set(name, 'transit', w / 0.45, this.parts.get(name).expl, 0.25);
          return this._set(name, 'installed');
        }
      }
      this._set(name, state);
    });

    // paint (3)
    this.setPaint(slot < 3 ? 0 : slot > 3 ? 1 : smooth(0.12, 0.8, p));

    // powertrain (4)
    const pt = this.parts.get('powertrain');
    if (slot < 4) this._set('powertrain', 'hidden');
    else if (slot > 4 || !extra.powertrain) this._set('powertrain', 'installed');
    else { pt.obj.visible = true; pt.obj.position.copy(extra.powertrain); pt.obj.quaternion.copy(pt.inst.q); }

    // final assembly (5)
    FINAL_GROUPS.forEach((g, k) => {
      let w;
      if (slot < 5) w = -1; else if (slot > 5) w = 2; else w = finalWindow(k, p);
      const t = w / 0.7;
      if (g.wheel !== undefined) {
        if (w <= 0) this.setWheel(g.wheel, 'hidden');
        else if (t < 1) this.setWheel(g.wheel, 'transit', t);
        else this.setWheel(g.wheel, 'installed');
        return;
      }
      const names = g.extra ? [this.cfg.extra] : g.parts;
      for (const name of names) {
        const P = this.parts.get(name);
        if (!P) continue;
        if (g.fromExpl) {
          const door = name.endsWith('L') ? 'door_L' : 'door_R';
          if (slot < 1) this._set(name, 'hidden');
          else if (slot === 1) {
            if (name === door) this._stampDoor(name, p, extra);
            else this._set(name, stampWindow(STAMP_ORDER.indexOf(door), p) >= 1 ? 'exploded' : 'hidden');
          } else if (w <= 0) this._set(name, 'exploded');
          else if (t < 1) this._set(name, 'transit', t, P.expl, 0.15);
          else this._set(name, 'installed');
        } else {
          if (w <= 0) this._set(name, 'hidden');
          else if (t < 1) {
            const from = { p: P.inst.p.clone().add(new THREE.Vector3(...g.src)), q: P.inst.q };
            this._set(name, 'transit', t, from, 0.2);
          } else this._set(name, 'installed');
        }
      }
      if (g.extra) for (const e of EXTRAS) if (e.id !== this.cfg.extra) this._set(e.id, 'hidden');
    });
  }

  _stampDoor(name, p, extra) {
    const w = stampWindow(STAMP_ORDER.indexOf(name), p);
    if (w < 0.35) return this._set(name, 'hidden');
    if (w < 1) return this._stampTransit(name, w, extra);
    this._set(name, 'exploded');
  }

  /** Panel lies on the press die (w 0.35..0.5), then is transferred onto the skid. */
  _stampTransit(name, w, extra) {
    const P = this.parts.get(name);
    const bed = extra.pressLocal || new THREE.Vector3(0, 1.1, -7);
    const from = { p: bed.clone().sub(P.center), q: P.inst.q };
    if (w < 0.5) return this._set(name, { to: from }, 1, from, 0);
    const target = name === 'body_floor' ? P.inst : P.expl;
    this._set(name, { to: target }, (w - 0.5) / 0.5, from, 2.4);
  }

  dispose() {
    this.root.removeFromParent();
    this.paint.dispose();
    this.stripeMat.dispose();
  }
}
