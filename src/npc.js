// Factory life: workers (operate / patrol / react to the player), forklifts, cranes.
import * as THREE from 'three';
import layout from './data/layout.json';
import { child, shadows } from './assets.js';
import { WORKER_LINES } from './data/content.js';

const X = layout.slots.map((s) => s.x);
const LZ = layout.lineZ;

/** Procedural animation for the rigid-limb character rigs. */
export class Rig {
  constructor(root, prefix) {
    this.root = root;
    const g = (n) => child(root, `${prefix}_${n}`);
    this.hips = g('hips'); this.torso = g('torso'); this.head = g('head');
    this.armL = g('arm_L'); this.armR = g('arm_R'); this.foreL = g('fore_L'); this.foreR = g('fore_R');
    this.legL = g('leg_L'); this.legR = g('leg_R'); this.shinL = g('shin_L'); this.shinR = g('shin_R');
    this.hipsY = this.hips.position.y;
    this.phase = Math.random() * 6;
  }

  /** speed in m/s; mode: walk | operate | wave | idle | sit */
  pose(dt, speed, mode = 'walk', t = 0) {
    const run = Math.min(1, Math.max(0, (speed - 2.5) / 3));
    this.phase += dt * (speed * (2.1 - run * 0.5) + (speed > 0.05 ? 1.5 : 0));
    const s = Math.sin(this.phase), c = Math.cos(this.phase);
    const amp = Math.min(1, speed / 1.6) * (0.55 + run * 0.35);
    this.legL.rotation.x = s * amp; this.legR.rotation.x = -s * amp;
    this.shinL.rotation.x = Math.max(0, -c) * amp * 1.3; this.shinR.rotation.x = Math.max(0, c) * amp * 1.3;
    this.hips.position.y = this.hipsY + Math.abs(c) * 0.04 * amp;
    this.torso.rotation.x = -0.05 - run * 0.2;
    this.torso.rotation.y = s * 0.08 * amp;
    this.armL.rotation.set(-s * amp * 0.9, 0, 0.06);
    this.armR.rotation.set(s * amp * 0.9, 0, -0.06);
    this.foreL.rotation.x = -0.3 - run * 0.9; this.foreR.rotation.x = -0.3 - run * 0.9;
    this.head.rotation.set(0, 0, 0);
    if (mode === 'operate') {
      this.armL.rotation.set(-1.0 + Math.sin(t * 2.3) * 0.12, 0, 0.15);
      this.armR.rotation.set(-1.1 + Math.sin(t * 2.9 + 1) * 0.15, 0, -0.15);
      this.foreL.rotation.x = -0.6 + Math.sin(t * 3.1) * 0.2; this.foreR.rotation.x = -0.5 + Math.sin(t * 2.2) * 0.25;
      this.head.rotation.x = 0.25 + Math.sin(t * 0.7) * 0.05;
      this.torso.rotation.x = 0.12;
    } else if (mode === 'wave') {
      this.armR.rotation.set(0, 0, -2.5 - Math.sin(t * 9) * 0.25);
      this.foreR.rotation.x = 0;
      this.head.rotation.x = -0.1;
    } else if (mode === 'idle') {
      this.head.rotation.y = Math.sin(t * 0.5) * 0.4;
    }
  }
}

class Worker {
  constructor(assets, scene, opts) {
    this.root = assets.clone('worker');
    shadows(this.root, true, false);
    scene.add(this.root);
    this.rig = new Rig(this.root, 'worker');
    Object.assign(this, { mode: 'operate', speed: 1.3, wait: 0, wpi: 0 }, opts);
    this.root.position.set(this.x, 0, this.z);
    this.root.rotation.y = this.face ?? 0;
    this.react = 0;
    this.cool = Math.random() * 3;
    this.t = Math.random() * 10;
    this.bubble = null;
  }

  update(dt, player) {
    this.t += dt;
    this.cool -= dt;
    const pos = this.root.position;
    const dp = player ? Math.hypot(player.x - pos.x, player.z - pos.z) : 99;
    if (dp < 3.2 && this.cool <= 0 && this.react <= 0) {
      this.react = 3.2;
      this.cool = 12;
      this.bubble = WORKER_LINES[Math.floor(Math.random() * WORKER_LINES.length)];
    }
    if (this.react > 0) {
      this.react -= dt;
      if (this.react <= 0) this.bubble = null;
      const target = Math.atan2(player.x - pos.x, player.z - pos.z);
      this.root.rotation.y = lerpAngle(this.root.rotation.y, target, 1 - Math.exp(-6 * dt));
      this.rig.pose(dt, 0, this.react > 1.0 ? 'wave' : 'idle', this.t);
      return;
    }
    if (this.tech) {
      // final-assembly technician: walk to the current install point and work there
      const tx = this.focus ? this.focus.x : this.x, tz = this.focus ? this.focus.z : this.z;
      const dx = tx - pos.x, dz = tz - pos.z, d = Math.hypot(dx, dz);
      if (d > 0.15) {
        const v = Math.min(2.2, d * 4);
        pos.x += dx / d * v * dt; pos.z += dz / d * v * dt;
        this.root.rotation.y = lerpAngle(this.root.rotation.y, Math.atan2(dx, dz), 1 - Math.exp(-10 * dt));
        this.rig.pose(dt, v, 'walk', this.t);
      } else {
        this.root.rotation.y = lerpAngle(this.root.rotation.y, Math.PI, 1 - Math.exp(-8 * dt));
        this.rig.pose(dt, 0, this.focus ? 'operate' : 'idle', this.t * (this.focus ? 2.5 : 1));
      }
      return;
    }
    if (this.mode === 'patrol') {
      if (this.wait > 0) { this.wait -= dt; this.rig.pose(dt, 0, 'idle', this.t); return; }
      const wp = this.path[this.wpi];
      const dx = wp[0] - pos.x, dz = wp[1] - pos.z, d = Math.hypot(dx, dz);
      if (d < 0.3) { this.wpi = (this.wpi + 1) % this.path.length; this.wait = 1 + Math.random() * 3; return; }
      const v = Math.min(this.speed, d / Math.max(dt, 1e-3));
      pos.x += dx / d * v * dt; pos.z += dz / d * v * dt;
      this.root.rotation.y = lerpAngle(this.root.rotation.y, Math.atan2(dx, dz), 1 - Math.exp(-8 * dt));
      this.rig.pose(dt, v, 'walk', this.t);
    } else {
      this.root.rotation.y = lerpAngle(this.root.rotation.y, this.face ?? 0, 1 - Math.exp(-4 * dt));
      this.rig.pose(dt, 0, this.mode, this.t);
    }
  }
}

function lerpAngle(a, b, k) {
  let d = b - a;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  return a + d * k;
}

class Forklift {
  constructor(assets, scene, path, offset, audio) {
    this.root = assets.clone('forklift');
    shadows(this.root, true, true);
    scene.add(this.root);
    this.fork = child(this.root, 'forklift_fork');
    this.beacon = child(this.root, 'forklift_beacon');
    this.beacon.traverse((m) => { if (m.isMesh) { m.material = m.material.clone(); m.material.emissiveIntensity = 4; } });
    this.crate = assets.clone('crate');
    this.crate.position.set(1.65, 0.25, 0);
    this.fork.add(this.crate);
    this.curve = new THREE.CatmullRomCurve3(path.map(([x, z]) => new THREE.Vector3(x, 0, z)), true, 'centripetal');
    this.len = this.curve.getLength();
    this.s = offset * this.len;
    this.audio = audio;
    this.speed = 3.2;
    this.t = 0;
  }
  update(dt, blockers) {
    this.t += dt;
    const p = this.root.position;
    // slow down if the player is in front
    let v = this.speed;
    for (const b of blockers) {
      if (!b) continue;
      const fwd = this.curve.getTangentAt((this.s / this.len) % 1);
      const dx = b.x - p.x, dz = b.z - p.z;
      const ahead = dx * fwd.x + dz * fwd.z;
      if (ahead > 0 && ahead < 5 && Math.abs(dx * fwd.z - dz * fwd.x) < 1.6) {
        v = 0;
        if (this.t > 1.2) { this.t = 0; this.audio.beep(p.x, 2, p.z, 1600, 0.12, 0.25); this.audio.beep(p.x, 2, p.z, 1250, 0.12, 0.2); }
      }
    }
    this.s = (((this.s + v * Math.max(0, dt)) % this.len) + this.len) % this.len;
    const u = this.s / this.len;
    const pt = this.curve.getPointAt(u), tan = this.curve.getTangentAt(u);
    p.copy(pt);
    this.root.rotation.y = Math.atan2(-tan.z, tan.x);
    this.fork.position.y = 0.4 + Math.max(0, Math.sin(u * Math.PI * 4)) * 1.2;
    this.crate.visible = u < 0.5;
    this.beacon.rotation.y += dt * 8;
  }
}

class Crane {
  constructor(assets, scene, x0, x1, phase) {
    this.root = assets.clone('crane');
    this.root.position.set(x0, 0, -14.75);
    shadows(this.root, true, false);
    scene.add(this.root);
    this.trolley = child(this.root, 'crane_trolley');
    this.hook = assets.clone('crane_hook');
    this.cable = assets.clone('crane_cable');
    this.crate = assets.clone('crate');
    scene.add(this.hook, this.cable, this.crate);
    shadows(this.crate, true, false);
    this.x0 = x0; this.x1 = x1; this.t = phase;
  }
  update(dt) {
    this.t += dt;
    const t = this.t;
    const cyc = (t % 40) / 40;
    // pick at x0, carry to x1, drop, return
    const move = (a, b, u) => a + (b - a) * (0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, u))));
    let x, drop, carry;
    if (cyc < 0.2) { x = this.x0; drop = Math.sin(cyc / 0.2 * Math.PI) * 6.5; carry = cyc > 0.1; }
    else if (cyc < 0.5) { x = move(this.x0, this.x1, (cyc - 0.2) / 0.3); drop = 0; carry = true; }
    else if (cyc < 0.7) { x = this.x1; drop = Math.sin((cyc - 0.5) / 0.2 * Math.PI) * 6.5; carry = cyc < 0.6; }
    else { x = move(this.x1, this.x0, (cyc - 0.7) / 0.3); drop = 0; carry = false; }
    this.root.position.x = x;
    const tz = Math.sin(t * 0.21) * 3.5;
    this.trolley.position.z = tz;
    const hy = 9.4 - drop;
    const wz = -14.75 + tz;
    this.hook.position.set(x, hy, wz);
    this.cable.position.set(x, 10.0, wz);
    this.cable.scale.y = Math.max(0.05, 10.0 - hy);
    this.crate.visible = true;
    if (carry) this.crate.position.set(x, hy - 1.3, wz);
    else if (cyc < 0.1 || cyc >= 0.7) this.crate.position.set(this.x0, 0, -14.75);
    else this.crate.position.set(this.x1, 0, -14.75);
  }
}

export class FactoryLife {
  constructor({ scene, assets, audio }) {
    this.workers = [];
    const W = (o) => this.workers.push(new Worker(assets, scene, o));
    // console operators facing the line
    for (let i = 1; i <= 6; i++) W({ x: X[i] - 3.4, z: 1.95, face: Math.PI, mode: 'operate' });
    // final assembly technicians inside the cell
    W({ x: X[5] - 0.2, z: -1.3, face: Math.PI, mode: 'operate', tech: true });
    W({ x: X[4] + 3.6, z: -1.2, face: Math.PI, mode: 'operate' });
    // receptionist
    W({ x: -54.4, z: 15.0, face: Math.PI / 2, mode: 'idle' });
    // patrols
    W({ x: -40, z: 5, mode: 'patrol', path: [[-40, 5], [-5, 5.5], [30, 5], [44, 6.5], [10, 6]] });
    W({ x: 20, z: 6, mode: 'patrol', path: [[20, 6], [46, 5], [50, 9], [0, 7], [-30, 6.5]] });
    W({ x: -30, z: -9, mode: 'patrol', path: [[-30, -9.5], [10, -9.5], [40, -9.8], [0, -10]], speed: 1.1 });
    W({ x: -50, z: 8, mode: 'patrol', path: [[-50, 7.5], [-44, 9.2], [-36, 8], [-52, 4]], speed: 1.0 });
    this.forklifts = [
      new Forklift(assets, scene, [[-50, -12], [0, -12], [50, -12], [54, -15], [50, -18], [0, -18], [-50, -18], [-54, -15]], 0, audio),
      new Forklift(assets, scene, [[-50, -12], [0, -12], [50, -12], [54, -15], [50, -18], [0, -18], [-50, -18], [-54, -15]], 0.5, audio),
    ];
    this.cranes = [new Crane(assets, scene, -45, -10, 0), new Crane(assets, scene, 10, 45, 17)];
    this.audio = audio;
    this.clankT = 2;
  }

  update(dt, player, focus = null) {
    for (const w of this.workers) {
      if (w.tech) w.focus = focus;
      w.update(dt, player);
    }
    for (const f of this.forklifts) f.update(dt, [player]);
    for (const c of this.cranes) c.update(dt);
    this.clankT -= dt;
    if (this.clankT < 0) {
      this.clankT = 1.5 + Math.random() * 4;
      this.audio.clank(-50 + Math.random() * 100, 3, -18 + Math.random() * 20);
    }
  }

  /** Dynamic colliders for the player (workers and forklifts). */
  colliders() {
    const out = [];
    for (const w of this.workers) { const p = w.root.position; out.push({ x0: p.x - 0.25, x1: p.x + 0.25, z0: p.z - 0.25, z1: p.z + 0.25, y0: 0, y1: 1.8, enabled: true }); }
    for (const f of this.forklifts) { const p = f.root.position; out.push({ x0: p.x - 1.2, x1: p.x + 1.2, z0: p.z - 1.2, z1: p.z + 1.2, y0: 0, y1: 3, enabled: true }); }
    return out;
  }

  bubbles() {
    return this.workers.filter((w) => w.bubble).map((w) => ({ text: w.bubble, pos: w.root.position.clone().setY(2.15), id: w }));
  }
}
