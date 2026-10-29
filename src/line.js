// The pulsed assembly line: all cars advance one slot per takt cycle, every
// station animates the car that is currently dwelling in it.
import * as THREE from 'three';
import layout from './data/layout.json';
import { CarBuild, randomConfig, stampWindow, weldWindow, finalWindow, FINAL_GROUPS, STAMP_ORDER, WELD_ORDER, BODY_Y, ease } from './carBuild.js';
import { RobotArm } from './robots.js';
import { child, shadows } from './assets.js';
import { Particles, Flash } from './fx.js';
import { ScreenCanvas, FONT } from './textures.js';

export const MOVE = 6, DWELL = 26, CYCLE = MOVE + DWELL;
const SLOTS = layout.slots;
const LZ = layout.lineZ;
const X = SLOTS.map((s) => s.x);
const SPAWN_X = -58;
const PRESS = { x: X[1], z: -11 };
const TABLE = { x: X[1] - 5.2, z: -11 };
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const V = (x, y, z) => new THREE.Vector3(x, y, z);

export class AssemblyLine {
  constructor({ scene, assets, audio, colliders }) {
    this.scene = scene; this.assets = assets; this.audio = audio; this.colliders = colliders;
    this.cars = [];
    this.t = MOVE; // start at the beginning of a dwell
    this.cycle = 0;
    this.unitsToday = 1184;
    this.events = [];
    this.sparks = new Particles(scene, 1400, { size: 0.045, additive: true, gravity: -9.8, drag: 0.6, bounce: 0.3 });
    this.mist = new Particles(scene, 1600, { size: 0.75, additive: false, gravity: 0.15, drag: 2.0, bounce: 0, opacity: 0.32 });
    this.dust = new Particles(scene, 300, { size: 0.35, additive: false, gravity: -0.3, drag: 2.5, bounce: 0, opacity: 0.25 });
    this.flashes = [new Flash(scene), new Flash(scene)];
    this.stationActive = new Array(SLOTS.length).fill(false);
    this._build();
    // fill the line so it is busy from the start
    for (let s = 0; s <= 6; s++) this._spawn(s);
    this.update(0);
  }

  // ------------------------------------------------------------------ static machinery
  _build() {
    const { scene, assets } = this;
    const add = (o, x, y, z, ry = 0, sh = true) => { o.position.set(x, y, z); o.rotation.y = ry; if (sh) shadows(o, true, true); scene.add(o); return o; };
    // conveyor
    for (let x = -58; x <= 54; x += 4) add(assets.clone('conveyor'), x, 0, LZ, 0, false).traverse((m) => { if (m.isMesh) m.receiveShadow = true; });
    for (const z of [0.0, 4.0]) add(assets.clone('conveyor'), layout.delivery.x - 0.5, 0, z, Math.PI / 2, false);

    // --- stamping
    this.press = add(assets.clone('press'), PRESS.x, 0, PRESS.z);
    this.ram = child(this.press, 'press_ram');
    this.ramRest = this.ram.position.y;
    add(assets.clone('press_table'), TABLE.x, 0, TABLE.z);
    this.sheets = [];
    for (let i = 0; i < 12; i++) {
      const s = assets.clone('sheet');
      s.position.set(TABLE.x, 0.94 + i * 0.02, TABLE.z);
      scene.add(s);
      this.sheets.push(s);
    }
    this.flyingSheet = assets.clone('sheet');
    scene.add(this.flyingSheet);
    this.pressRobot = new RobotArm(assets, 'tool_grip', PRESS.x + 3.4, -7.4, scene);
    this.colliders.addCenter(PRESS.x, PRESS.z, 5.4, 4.4, 9);
    this.colliders.addCenter(TABLE.x, TABLE.z, 2.0, 1.4, 1);
    add(assets.clone('rack'), PRESS.x - 4, 0, -16.5);

    // --- body shop
    const bx = X[2];
    this.weldRobots = [[-2.3, -2.9], [2.3, -2.9], [-2.3, 2.9], [2.3, 2.9]].map(([dx, dz]) => new RobotArm(assets, 'tool_weld', bx + dx, LZ + dz, scene));
    // --- paint shop
    const pb = layout.paintBooth;
    const px = (pb.x0 + pb.x1) / 2;
    add(assets.clone('paint_booth'), px, 0, LZ);
    add(assets.clone('paint_booth_glass'), px, 0, LZ, 0, false);
    add(assets.clone('paint_booth_curtain'), px, 0, LZ, 0, false);
    this.sprayRobots = [[-2.6, -2.7], [2.6, -2.7], [-2.6, 2.7], [2.6, 2.7]].map(([dx, dz]) => new RobotArm(assets, 'tool_spray', X[3] + dx, LZ + dz, scene));
    this.colliders.addCenter(px, LZ, 14.2, 8.2, 5.4);
    const boothLight = new THREE.PointLight(0xfff6ea, 40, 14, 1.4);
    boothLight.position.set(px, 4.2, LZ);
    scene.add(boothLight);
    // --- engine marriage
    const ex = X[4];
    this.marriage = add(assets.clone('marriage'), ex, 0, LZ);
    this.beam = child(this.marriage, 'marriage_beam');
    this.agv = add(assets.clone('agv'), ex, 0, LZ - 7);
    this.agvTable = child(this.agv, 'agv_table');
    this.agvScissor = child(this.agv, 'agv_scissor');
    this.nutRobots = [[-1.9, 2.9], [1.9, 2.9]].map(([dx, dz]) => new RobotArm(assets, 'tool_nut', ex + dx, LZ + dz, scene));
    for (const sx of [-2.8, 2.8]) for (const sz of [-2.2, 2.2]) this.colliders.addCenter(ex + sx, LZ + sz, 0.5, 0.5, 6);
    // --- final assembly
    const fx = X[5];
    this.gripRobots = [[-1.6, -3.0], [1.9, -3.0]].map(([dx, dz]) => new RobotArm(assets, 'tool_grip', fx + dx, LZ + dz, scene));
    this.wheelRobots = [[-1.4, 2.9], [1.5, 2.9]].map(([dx, dz]) => new RobotArm(assets, 'tool_nut', fx + dx, LZ + dz, scene));
    add(assets.clone('cart'), fx - 4.2, 0, LZ - 3.6, Math.PI / 2);
    add(assets.clone('cart'), fx + 4.2, 0, LZ + 3.2, Math.PI / 2);
    for (let i = 0; i < 3; i++) { // spare wheels on the cart
      const w = assets.clone('wheel_sport'); w.position.set(fx + 4.2, 1.7 + 0.0, LZ + 3.2 - 0.6 + i * 0.6); w.rotation.x = Math.PI / 2; scene.add(w);
    }
    // --- QC
    const qx = X[6];
    add(assets.clone('qc_rails'), qx, 0, LZ);
    this.gate = add(assets.clone('qc_gate'), qx - 3.2, 0, LZ);
    const beamMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 1.4, 2.0), transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    this.scanSheet = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 3.4), beamMat);
    this.scanSheet.rotation.y = Math.PI / 2;
    this.scanSheet.position.set(0.0, 1.85, 0);
    this.gate.add(this.scanSheet);
    const lineMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 5, 7), toneMapped: false });
    this.scanLines = [];
    for (let i = 0; i < 6; i++) {
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 4.4), lineMat);
      this.gate.add(l);
      this.scanLines.push(l);
    }
    this.qcScreen = new ScreenCanvas(768, 432);
    const sf = add(assets.clone('screen_frame'), qx, 4.9, LZ - 4.6, 0);
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(6, 3.38), new THREE.MeshBasicMaterial({ map: this.qcScreen.texture, toneMapped: false }));
    plane.position.set(0, 0, 0.04);
    sf.add(plane);
    this.qcState = '';
    // --- beacons + consoles per station
    this.beacons = [];
    for (let i = 1; i <= 6; i++) {
      const pole = add(assets.clone('beacon_pole'), X[i] + 3.6, 0, 0.25, 0, false);
      const light = assets.clone('beacon_light');
      light.position.set(X[i] + 3.6, 1.25, 0.25);
      light.traverse((m) => { if (m.isMesh && m.material.name === 'BeaconLens') m.material = m.material.clone(); });
      scene.add(light);
      this.beacons.push(light);
      add(assets.clone('console'), X[i] - 3.4, 0, 1.25, Math.PI);
      this.colliders.addCenter(X[i] - 3.4, 1.25, 0.8, 0.5, 1.2);
    }
  }

  // ------------------------------------------------------------------ cars
  _spawn(slot, cfg) {
    const car = new CarBuild(this.assets, cfg || randomConfig());
    const entry = { car, slot, isPlayer: false, done: false, buildStart: 0 };
    car.root.position.set(slot === 0 ? SPAWN_X : X[slot], 0, LZ);
    this.scene.add(car.root);
    this.cars.push(entry);
    return entry;
  }

  /** Assign the player's order to the car waiting at the loading bay. */
  claimForPlayer(cfg) {
    let e = this.cars.find((c) => c.slot === 0);
    if (!e) e = this._spawn(0);
    e.isPlayer = true;
    e.car.setConfig(cfg);
    this.player = e;
    return e;
  }

  get phase() { return this.t < MOVE ? 'move' : 'dwell'; }
  get dwellP() { return clamp01((this.t - MOVE) / DWELL); }
  timeToNextAdvance() { return CYCLE - this.t; }

  /** Player car status for the HUD. */
  playerStatus() {
    const e = this.player;
    if (!e) return null;
    if (e.delivered) return { slot: 7, phase: 'done', p: 1, overall: 1 };
    const moving = this.phase === 'move';
    const p = moving ? 0 : this.dwellP;
    let overall = 0;
    if (e.slot >= 1 && e.slot <= 6) overall = (e.slot - 1 + (moving ? 0 : p)) / 6;
    if (e.slot >= 7) overall = 1;
    return { slot: e.slot, phase: this.phase, p, overall, moving };
  }

  // ------------------------------------------------------------------ update
  update(dt) {
    this.t += dt;
    while (this.t >= CYCLE) {
      this.t -= CYCLE;
      this._advance();
    }
    const moving = this.phase === 'move';
    const mp = ease(clamp01(this.t / MOVE));
    const p = this.dwellP;
    this.stationActive.fill(false);
    this.servoLevel = 0;
    let weld = 0, spray = 0, hyd = 0, scan = 0;
    const byslot = [];

    for (const e of this.cars) {
      if (e.delivered) continue;
      const car = e.car;
      let x;
      if (moving) {
        const from = e.slot === 0 ? SPAWN_X : X[e.slot - 1];
        x = THREE.MathUtils.lerp(from, X[e.slot], mp);
      } else x = X[e.slot];
      if (e.slot < 7 || moving) car.root.position.set(x, 0, LZ);
      byslot[e.slot] = e;
      if (moving) car.applyState(e.slot - 1, 1, {});
    }

    // per-station animation during dwell
    const live = (s) => (!moving && byslot[s] ? byslot[s] : null);
    this._stamp(live(1), p, dt);
    weld = this._body(live(2), p, dt);
    spray = this._paint(live(3), p, dt);
    hyd = this._engine(live(4), p, dt);
    this._final(live(5), p, dt);
    scan = this._qc(live(6), p, dt);
    this._exit(byslot[7], p, dt, moving);
    if (!moving && byslot[0]) byslot[0].car.applyState(0, p, {});

    for (const r of this.allRobots()) { r.update(dt); this.servoLevel = Math.max(this.servoLevel, Math.min(1, r.speed / 2.5)); }
    this.sparks.update(dt);
    this.mist.update(dt);
    this.dust.update(dt);

    // beacons
    this.beacons.forEach((b, i) => {
      const on = this.stationActive[i + 1];
      b.rotation.y += dt * (on ? 9 : 0);
      b.traverse((m) => { if (m.isMesh && m.material.name === 'BeaconLens') m.material.emissiveIntensity = on ? 4 : 0.15; });
    });

    // audio
    const a = this.audio;
    if (a.enabled) {
      a.loop('weld', weld * 0.55, X[2], 1.5, LZ);
      a.loop('spray', spray * 0.35, X[3], 1.5, LZ);
      a.loop('hydraulic', hyd * 0.5, X[4], 1.5, LZ);
      a.loop('scan', scan * 0.4, X[6], 2, LZ);
      a.loop('servo', this.servoLevel * 0.25, this._servoAt || X[2], 1.5, LZ, this.servoLevel);
    }
  }

  allRobots() {
    return [this.pressRobot, ...this.weldRobots, ...this.sprayRobots, ...this.nutRobots, ...this.gripRobots, ...this.wheelRobots];
  }

  _advance() {
    this.cycle++;
    // cars leave the end of the line
    for (const e of [...this.cars]) {
      if (e.slot >= 7 && !e.isPlayer) { e.car.dispose(); this.cars.splice(this.cars.indexOf(e), 1); }
    }
    for (const e of this.cars) if (!e.delivered) e.slot++;
    this._spawn(0);
    this.events.push({ type: 'advance', cycle: this.cycle });
  }

  // ------------------------------------------------------------------ stations
  _stamp(e, p, dt) {
    const N = STAMP_ORDER.length;
    // which panel is in work?
    let k = -1, w = 0;
    for (let i = 0; i < N; i++) { const wi = stampWindow(i, p); if (wi >= 0 && wi < 1) { k = i; w = wi; } }
    let started = 0;
    for (let i = 0; i < N; i++) if (stampWindow(i, p) >= 0) started++;
    this.sheets.forEach((s, i) => (s.visible = i < N - (e ? started : 0)));
    // ram
    let ramY = this.ramRest;
    const bottom = 2.78;
    this.flyingSheet.visible = false;
    if (e && k >= 0) {
      this.stationActive[1] = true;
      if (w < 0.2) {
        const t = ease(w / 0.2);
        this.flyingSheet.visible = true;
        this.flyingSheet.position.set(THREE.MathUtils.lerp(TABLE.x, PRESS.x, t), THREE.MathUtils.lerp(0.94 + (N - k) * 0.02, 1.34, t) + Math.sin(t * Math.PI) * 0.4, TABLE.z);
      } else if (w < 0.35) {
        this.flyingSheet.visible = true;
        this.flyingSheet.position.set(PRESS.x, 1.34, PRESS.z);
        const t = (w - 0.2) / 0.15;
        ramY = THREE.MathUtils.lerp(this.ramRest, bottom, t * t);
      } else if (w < 0.55) {
        ramY = THREE.MathUtils.lerp(bottom, this.ramRest, ease((w - 0.35) / 0.2));
      }
      if (this._lastHit !== k && w >= 0.35) {
        this._lastHit = k;
        this.audio.pressHit(PRESS.x, 2, PRESS.z);
        this.events.push({ type: 'pressHit', x: PRESS.x, z: PRESS.z });
        for (let i = 0; i < 2; i++) this.dust.emit(V(PRESS.x + (Math.random() - 0.5) * 3, 1.4, PRESS.z + (Math.random() - 0.5) * 2.5), 14, { speed: 1.5, spread: 1, up: 0.3, color: [0.55, 0.55, 0.55], life: 1.6, jitter: 0.6 });
      }
    } else if (!e) this._lastHit = -1;
    this.ram.position.y = ramY;
    // transfer robot follows the panel in transit
    if (e) {
      const pressLocal = V(PRESS.x - e.car.root.position.x, 1.36 - BODY_Y, PRESS.z - LZ);
      e.car.applyState(1, p, { pressLocal });
      if (k >= 0 && w >= 0.5) {
        const name = STAMP_ORDER[k];
        const P = e.car.parts.get(name);
        const wp = P.obj.localToWorld(P.center.clone().setY(P.center.y + 0.1));
        this.pressRobot.reach(wp);
        this._servoAt = PRESS.x;
      } else this.pressRobot.park(V(PRESS.x, 1, PRESS.z));
    } else this.pressRobot.park(V(PRESS.x, 1, PRESS.z));
  }

  _body(e, p, dt) {
    const robots = this.weldRobots;
    if (!e) { robots.forEach((r) => r.park(V(X[2], 1, LZ))); this.flashes[0].set(null, false); this.flashes[1].set(null, false); return 0; }
    e.car.applyState(2, p, {});
    this.stationActive[2] = true;
    let k = -1, w = 0;
    for (let i = 0; i < WELD_ORDER.length; i++) { const wi = weldWindow(i, p); if (wi >= 0 && wi < 1) { k = i; w = wi; } }
    let welding = 0;
    const used = new Set();
    if (k >= 0) {
      const name = WELD_ORDER[k];
      const P = e.car.parts.get(name);
      const c = P.obj.localToWorld(P.center.clone().add(V(0, 0.25, 0)));
      // choose the two closest robots
      const order = robots.map((r, i) => [r.root.position.distanceTo(c), i]).sort((a, b) => a[0] - b[0]);
      if (w < 0.45) {
        robots[order[0][1]].reach(c); used.add(order[0][1]);
      } else {
        const tt = performance.now() / 1000;
        for (let j = 0; j < 2; j++) {
          const r = robots[order[j][1]];
          used.add(order[j][1]);
          const seam = c.clone().add(V(Math.sin(tt * 2.1 + j * 2) * 0.55, Math.sin(tt * 3.3 + j) * 0.1, Math.cos(tt * 1.7 + j) * 0.25));
          r.reach(seam);
          const tip = r.tip;
          if (tip.distanceTo(seam) < 0.6) {
            welding = 1;
            this.sparks.emit(tip, Math.ceil(dt * 260), { speed: 4.5, spread: 1, up: 1.2, life: 0.6 });
            this.flashes[j].set(tip, Math.random() < 0.8);
          } else this.flashes[j].set(null, false);
        }
        this._servoAt = X[2];
      }
    }
    if (welding === 0) { this.flashes[0].set(null, false); this.flashes[1].set(null, false); }
    robots.forEach((r, i) => { if (!used.has(i)) r.park(e.car.root.position); });
    return welding;
  }

  _paint(e, p, dt) {
    const robots = this.sprayRobots;
    if (!e) { robots.forEach((r) => r.park(V(X[3], 1, LZ))); return 0; }
    e.car.applyState(3, p, {});
    this.stationActive[3] = true;
    const spraying = p > 0.06 && p < 0.92;
    const tt = performance.now() / 1000;
    const cx = e.car.root.position.x;
    // coat colour: primer (grey) -> base (paint) -> clear (white haze)
    const col = p < 0.25 ? [0.7, 0.7, 0.72] : p < 0.75 ? [e.car.color.r, e.car.color.g, e.car.color.b] : [0.95, 0.95, 1.0];
    robots.forEach((r, i) => {
      if (!spraying) return r.park(e.car.root.position);
      const side = i < 2 ? -1 : 1;
      const sweep = Math.sin(tt * 1.3 + i * 1.7);
      const target = V(cx + sweep * 1.9 + (i % 2 ? 0.6 : -0.6), 1.1 + 0.25 * Math.sin(tt * 2 + i), LZ + side * 0.75);
      r.reach(target);
      const dir = target.clone().sub(r.tip).normalize();
      this.mist.emit(r.tip, Math.ceil(dt * 110), { speed: 2.2, spread: 0.25, up: 0.1, color: col, life: 1.0, dir: dir.multiplyScalar(3), jitter: 0.05 });
    });
    if (spraying) this._servoAt = X[3];
    return spraying ? 1 : 0;
  }

  _engine(e, p, dt) {
    const ex = X[4];
    const LIFT = 1.45;
    const lift = e ? smooth(0.08, 0.2, p) * LIFT * (1 - smooth(0.8, 0.95, p)) : 0;
    const clampY = (l) => BODY_Y + 0.26 + l + 1.1;
    let beamY = 3.2;
    if (e) {
      const engaged = p > 0.06 && p < 0.96;
      beamY = engaged ? clampY(lift) : THREE.MathUtils.lerp(3.2, clampY(0), p < 0.5 ? smooth(0, 0.06, p) : 1 - smooth(0.95, 1, p));
    }
    this.beam.position.y = beamY;
    // AGV in/out
    let agvZ = LZ - 7, table = 0;
    if (e) {
      agvZ = LZ - 7 + 7 * (smooth(0.15, 0.33, p) - smooth(0.74, 0.9, p));
      table = smooth(0.35, 0.5, p) * (1 - smooth(0.68, 0.74, p));
    }
    const restTop = 0.44;                                   // table top at rest (world)
    const marriedY = BODY_Y + LIFT;                         // powertrain origin when married
    const ptRestY = restTop - 0.2;                          // powertrain origin resting on table
    const ptY = THREE.MathUtils.lerp(ptRestY, marriedY, table);
    this.agv.position.set(ex, 0, agvZ);
    this.agvTable.position.y = 0.4 + (ptY - ptRestY);
    this.agvScissor.scale.y = 0.05 + (ptY - ptRestY) * 0.95;
    if (!e) { this.nutRobots.forEach((r) => r.park(V(ex, 1, LZ))); return 0; }
    this.stationActive[4] = true;
    e.car.setBodyLift(lift);
    const married = p >= 0.5;
    const ptLocal = married ? null : V(0, ptY - (BODY_Y + lift), agvZ - LZ);
    e.car.applyState(4, p, { powertrain: ptLocal });
    // bolting
    const bolting = p > 0.5 && p < 0.68;
    this.nutRobots.forEach((r, i) => {
      if (bolting) {
        const target = V(ex + (i ? 1.33 : -1.3), BODY_Y + lift + 0.15, LZ + 0.35 * (i ? 1 : -1));
        r.reach(target);
        if (Math.random() < dt * 3) this.audio.ratchet(target.x, target.y, target.z);
      } else r.park(e.car.root.position);
    });
    if (bolting) this._servoAt = ex;
    const moving = (p > 0.06 && p < 0.22) || (p > 0.33 && p < 0.52) || (p > 0.66 && p < 0.96);
    return moving ? 1 : 0;
  }

  _final(e, p, dt) {
    const fx = X[5];
    if (!e) { this.finalFocus = null; [...this.gripRobots, ...this.wheelRobots].forEach((r) => r.park(V(fx, 1, LZ))); return; }
    e.car.applyState(5, p, {});
    this.stationActive[5] = true;
    let k = -1, w = 0;
    for (let i = 0; i < FINAL_GROUPS.length; i++) { const wi = finalWindow(i, p); if (wi >= 0 && wi < 1) { k = i; w = wi; } }
    const g = FINAL_GROUPS[k];
    let gripTarget = null, wheelTarget = null;
    if (g) {
      if (g.wheel !== undefined) {
        const wh = e.car.wheels[g.wheel];
        wheelTarget = wh.pivot.getWorldPosition(new THREE.Vector3());
        wheelTarget.z += wh.left ? -0.25 : 0.25;
        if (w >= 0.7 && this._lastRatchet !== k) { this._lastRatchet = k; this.audio.ratchet(wheelTarget.x, wheelTarget.y, wheelTarget.z); }
      } else {
        const name = g.extra ? e.car.cfg.extra : g.parts[0];
        const P = e.car.parts.get(name);
        gripTarget = P.obj.localToWorld(P.center.clone().add(V(0, 0.15, 0)));
        if (w >= 0.7 && this._lastClunk !== k) { this._lastClunk = k; this.audio.clunk(gripTarget.x, gripTarget.y, gripTarget.z, 0.4); }
      }
    }
    this.finalFocus = null;
    if (g && (g.wheel !== undefined ? !e.car.wheels[g.wheel].left : g.parts && g.parts[0] === 'seat_L')) {
      const t = wheelTarget || gripTarget;
      if (t) this.finalFocus = { x: t.x, z: LZ + 1.75 };
    }
    const pick = (list, t) => list.map((r) => [r, r.root.position.distanceTo(t)]).sort((a, b) => a[1] - b[1])[0][0];
    const gr = gripTarget ? pick(this.gripRobots, gripTarget) : null;
    for (const r of this.gripRobots) r === gr ? r.reach(gripTarget) : r.park(e.car.root.position);
    if (wheelTarget) {
      // wheel robots: the one on the right side does right wheels; left wheels via the grip robots
      const wr = wheelTarget.z > LZ ? pick(this.wheelRobots, wheelTarget) : pick(this.gripRobots, wheelTarget);
      for (const r of [...this.wheelRobots, ...this.gripRobots]) if (r === wr) r.reach(wheelTarget); else if (this.wheelRobots.includes(r)) r.park(e.car.root.position);
    } else this.wheelRobots.forEach((r) => r.park(e.car.root.position));
    this._servoAt = fx;
  }

  _qc(e, p, dt) {
    const qx = X[6];
    let gx = -3.2;
    if (e) gx = -3.2 + 6.4 * smooth(0.05, 0.5, p) - 6.4 * smooth(0.52, 0.7, p);
    this.gate.position.x = qx + gx;
    const scanning = e && p > 0.05 && p < 0.5;
    this.scanSheet.visible = !!scanning;
    const tt = performance.now() / 1000;
    this.scanLines.forEach((l, i) => {
      l.visible = !!scanning;
      l.position.set(0, 0.3 + ((tt * 1.7 + i / 6) % 1) * 3.2, 0);
    });
    let state = 'IDLE';
    if (e) {
      e.car.applyState(6, p, {});
      this.stationActive[6] = true;
      const blink = p > 0.55 && p < 0.75 && Math.floor(p * 60) % 2 === 0;
      e.car.setLights(blink || p > 0.78, blink);
      state = p < 0.05 ? 'READY' : p < 0.5 ? 'SCAN' : p < 0.78 ? 'TEST' : 'PASS';
      if (state === 'PASS' && this.qcState !== 'PASS' && e.isPlayer) this.audio.ui('pass');
      this._drawQC(e, p, state);
    } else if (this.qcState !== 'IDLE') this._drawQC(null, 0, 'IDLE');
    this.qcState = state;
    return scanning ? 1 : 0;
  }

  _drawQC(e, p, state) {
    const key = state + (e ? Math.floor(p * 40) : '');
    if (key === this._qcKey) return;
    this._qcKey = key;
    this.qcScreen.draw((c, w, h) => {
      c.fillStyle = '#05080d'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#0a7cff'; c.fillRect(0, 0, w, 54);
      c.fillStyle = '#fff'; c.font = `800 30px ${FONT}`; c.fillText('QUALITY GATE  Q6', 24, 38);
      if (!e) { c.fillStyle = '#7a8799'; c.font = `600 34px ${FONT}`; c.fillText('Waiting for vehicle…', 24, 140); return; }
      c.font = `600 22px ${FONT}`; c.fillStyle = '#9fb0c4';
      c.fillText(`VIN GW${(100000 + (e.car.root.id * 7919) % 899999)}  ·  ${e.car.colorName.toUpperCase()}`, 24, 92);
      const checks = [['Panel gaps', 0.15], ['Paint thickness', 0.28], ['Geometry', 0.42], ['Lights', 0.6], ['Electrics', 0.7], ['Brakes', 0.76]];
      checks.forEach(([name, at], i) => {
        const y = 140 + i * 38;
        const ok = p >= at;
        c.fillStyle = ok ? '#33e07a' : '#4a5566';
        c.font = `700 24px ${FONT}`;
        c.fillText(ok ? '✔' : '…', 30, y);
        c.fillStyle = ok ? '#e9eef5' : '#6c7889';
        c.fillText(name, 70, y);
        if (ok) { c.fillStyle = '#33e07a'; c.fillText('OK', w - 110, y); }
      });
      if (state === 'PASS') {
        c.fillStyle = '#33e07a'; c.fillRect(w - 250, 120, 220, 120);
        c.fillStyle = '#04140a'; c.font = `900 64px ${FONT}`; c.fillText('PASS', w - 228, 202);
      } else {
        c.fillStyle = '#0a7cff'; c.fillRect(24, h - 34, (w - 48) * Math.min(1, p / 0.78), 10);
      }
    });
  }

  _exit(e, p, dt, moving) {
    if (!e || moving) return;
    const car = e.car;
    car.applyState(7, 1, {});
    // lower onto own wheels
    const down = smooth(0.0, 0.1, p);
    car.skid.position.y = 0.18 - down * 0.6;
    car.skid.visible = down < 1;
    car.setBodyLift(-down * (BODY_Y - 0.22));
    const ex = X[7];
    if (e.isPlayer) {
      const t = smooth(0.12, 0.35, p);
      car.root.position.set(ex + t * (layout.delivery.x - ex), 0, LZ + t * (layout.delivery.z - LZ));
      if (p >= 0.36 && !e.delivered) {
        e.delivered = true;
        car.setBodyLift(-(BODY_Y - 0.22));
        this.cars.splice(this.cars.indexOf(e), 1);
        this.unitsToday++;
        this.events.push({ type: 'delivered', entry: e });
      }
      return;
    }
    // drive out through the roll-up door and away
    const t = smooth(0.15, 0.85, p);
    const path = this._exitPath || (this._exitPath = new THREE.CatmullRomCurve3([V(ex, 0, LZ), V(62, 0, LZ), V(78, 0, LZ), V(92, 0, LZ - 6), V(98, 0, LZ - 30), V(100, 0, LZ - 60)]));
    const pos = path.getPointAt(t);
    const tan = path.getTangentAt(Math.min(0.999, t));
    car.root.position.copy(pos);
    car.root.rotation.y = Math.atan2(-tan.z, tan.x);
    const prev = e._prevT || 0;
    const v = (t - prev) * path.getLength() / Math.max(dt, 1e-4);
    e._prevT = t;
    for (const w of car.wheels) w.spinner.rotation.z -= (v * dt) / 0.34;
    car.setLights(true, false);
    car.root.visible = t < 0.98;
    if (!e.counted && t > 0.3) { e.counted = true; this.unitsToday++; }
  }

  /** World x of each slot (for HUD / camera). */
  static slotX(i) { return X[i]; }
}
