// Arcade-sim car: bicycle-model tyre forces, rear-wheel drive, handbrake drift,
// visual suspension (pitch/roll/bounce), steering and wheel spin.
import * as THREE from 'three';
import layout from './data/layout.json';
import track from './data/track.json';

const P = {
  mass: 1300, inertia: 1750, a: 1.38, b: 1.33,
  engineForce: 10500, brakeForce: 15000, reverseForce: 5000,
  drag: 0.42, rolling: 40, cAlpha: 82000, mu: 1.25, muHandbrake: 0.42,
  maxSteer: 0.6,
};
const G = 9.81;
const H = layout.hall;
const TP = track.points;
const HW = track.width / 2;

export function trackDistance(x, z) {
  let best = 1e9, bi = 0;
  for (let i = 0; i < TP.length; i += 1) {
    const dx = TP[i][0] - x, dz = TP[i][1] - z;
    const d = dx * dx + dz * dz;
    if (d < best) { best = d; bi = i; }
  }
  return { d: Math.sqrt(best), i: bi };
}

function surface(x, z) {
  if (x > H.x0 && x < H.x1 && z > H.z0 && z < H.z1) return 'floor';
  if (x > 59 && x < 113 && z > -10.5 && z < 2.5) return 'road';
  if (x > -62 && x < 70 && z > 19 && z < 33) return 'road';
  const pk = layout.parking;
  if (x > pk.x0 && x < pk.x1 && z > pk.z0 && z < pk.z1) return 'road';
  const td = trackDistance(x, z);
  if (td.d < HW + 1.0) return 'road';
  return 'grass';
}

export class Vehicle {
  constructor(car, colliders, audio) {
    this.car = car;
    this.colliders = colliders;
    this.audio = audio;
    this.pos = new THREE.Vector2(car.root.position.x, car.root.position.z);
    this.heading = car.root.rotation.y;
    this.vel = new THREE.Vector2();
    this.r = 0;
    this.steer = 0;
    this.throttle = 0;
    this.brake = 0;
    this.handbrake = false;
    this.speed = 0;
    this.vLong = 0;
    this.slip = 0;
    this.rpm = 900;
    this.gear = 1;
    this.pitch = 0; this.pitchV = 0;
    this.roll = 0; this.rollV = 0;
    this.bounce = 0; this.bounceV = 0;
    this.topSpeed = 0;
    this.camPos = null;
    this.camLook = new THREE.Vector3();
    this.camYawOff = 0;
    this.lastAx = 0; this.lastAy = 0;
    this.surface = 'floor';
    this.bodyBase = 0;   // body offset above root (wheels touching ground)
    this.bodyY = car.body.position.y;
  }

  update(dt, input, active) {
    // ---------------- input
    let thr = 0, brk = 0, steerIn = 0;
    if (active) {
      if (input.down('KeyW', 'ArrowUp')) thr = 1;
      if (input.down('KeyS', 'ArrowDown')) brk = 1;
      if (input.down('KeyA', 'ArrowLeft')) steerIn += 1;
      if (input.down('KeyD', 'ArrowRight')) steerIn -= 1;
      if (input.steerAxis !== undefined) steerIn = input.steerAxis;
      this.handbrake = input.down('Space');
    } else { this.handbrake = true; }
    const speed = this.vel.length();
    const steerMax = P.maxSteer / (1 + speed / 16);
    this.steer += (steerIn * steerMax - this.steer) * (1 - Math.exp(-(steerIn ? 7 : 9) * dt));

    // forward vs reverse logic: S brakes when moving forward, reverses when nearly stopped
    let drive = 0, braking = 0;
    if (thr) { if (this.vLong < -0.5) braking = 1; else drive = 1; }
    if (brk) { if (this.vLong > 0.5) braking = 1; else drive = -1; }
    this.throttle = Math.abs(drive);
    this.braking = braking > 0;

    const surf = this.surface = surface(this.pos.x, this.pos.y);
    const gripK = surf === 'grass' ? 0.62 : 1;
    const rollK = surf === 'grass' ? 2.5 : 1;

    const sub = 4, h = dt / sub;
    let slipMax = 0, axSum = 0, aySum = 0;
    for (let s = 0; s < sub; s++) {
      const th = this.heading;
      const c = Math.cos(th), sn = Math.sin(th);
      const vLong = this.vel.x * c - this.vel.y * sn;
      const vLat = this.vel.x * sn + this.vel.y * c;
      const sp = Math.hypot(vLong, vLat);
      const d = this.steer;
      const L = P.a + P.b;
      const Nf = P.mass * G * P.b / L, Nr = P.mass * G * P.a / L;

      // longitudinal
      let Fx = 0;
      if (drive > 0) Fx += P.engineForce * (1 - Math.min(1, Math.max(0, vLong) / 75)) * (1 - this._shiftCut());
      if (drive < 0) Fx -= vLong > -7 ? P.reverseForce : 0;
      if (braking) Fx -= Math.sign(vLong) * Math.min(P.brakeForce, Math.abs(vLong) * P.mass / h * 0.5);
      if (this.handbrake) Fx -= Math.sign(vLong) * Math.min(4500, Math.abs(vLong) * P.mass / h * 0.5);
      Fx -= P.drag * vLong * Math.abs(vLong) + P.rolling * rollK * vLong;

      // tyre lateral forces
      const vfx = vLong, vfz = vLat - this.r * P.a;
      const wLat = vfx * Math.sin(d) + vfz * Math.cos(d);
      const wLong = vfx * Math.cos(d) - vfz * Math.sin(d);
      const slipF = Math.atan2(wLat, Math.abs(wLong) + 0.5);
      const slipR = Math.atan2(vLat + this.r * P.b, Math.abs(vLong) + 0.5);
      const muF = P.mu * gripK;
      let muR = (this.handbrake ? P.muHandbrake : P.mu) * gripK;
      // traction circle on the driven rear axle: power oversteer
      const driveR = Math.abs(drive > 0 ? Fx : 0);
      const maxR = muR * Nr;
      const latBudget = Math.sqrt(Math.max(0.5 * maxR * maxR, maxR * maxR - driveR * driveR * 0.3));
      const Ff = THREE.MathUtils.clamp(-P.cAlpha * slipF, -muF * Nf, muF * Nf);
      const Fr = THREE.MathUtils.clamp(-P.cAlpha * (this.handbrake ? 0.45 : 1) * slipR, -latBudget, latBudget);

      const FxL = Fx - Ff * Math.sin(d);
      const FzL = Ff * Math.cos(d) + Fr;
      const tq = -P.a * Ff * Math.cos(d) + P.b * Fr;

      let ax = FxL / P.mass, az = FzL / P.mass;
      // low-speed kinematic blend keeps parking-speed manoeuvres stable
      const kin = 1 - THREE.MathUtils.clamp(sp / 4, 0, 1);
      let rDot = tq / P.inertia;
      if (kin > 0) {
        const rKin = vLong * Math.tan(d) / L;
        this.r += (rKin - this.r) * kin * Math.min(1, 12 * h);
        rDot *= 1 - kin;
        az += (-vLat * 8) * kin;
      }
      this.r += rDot * h;
      this.r *= 1 - 0.4 * h;
      // to world
      const wx = ax * c + az * sn;
      const wz = -ax * sn + az * c;
      this.vel.x += wx * h; this.vel.y += wz * h;
      if (!drive && sp < 0.3 && (braking || this.handbrake || !thr)) { this.vel.multiplyScalar(Math.max(0, 1 - 6 * h)); }
      this.heading += this.r * h;
      this.pos.x += this.vel.x * h; this.pos.y += this.vel.y * h;
      slipMax = Math.max(slipMax, Math.abs(slipR) * (sp > 6 ? 1 : 0), Math.abs(slipF) * 0.6 * (sp > 6 ? 1 : 0));
      axSum += ax; aySum += az;
    }
    this.lastAx = axSum / sub; this.lastAy = aySum / sub;

    // ---------------- collisions (two circles)
    const c = Math.cos(this.heading), sn = Math.sin(this.heading);
    let bumped = 0;
    for (const off of [1.35, -1.35]) {
      const cx = this.pos.x + c * off, cz = this.pos.y - sn * off;
      const res = this.colliders.resolveCircle(cx, cz, 1.0, this.extra);
      if (res.hit) {
        this.pos.x += res.x - cx; this.pos.y += res.z - cz;
        const vn = this.vel.x * res.nx + this.vel.y * res.nz;
        if (vn < 0) {
          this.vel.x -= vn * res.nx * 1.3; this.vel.y -= vn * res.nz * 1.3;
          this.vel.multiplyScalar(0.8);
          this.r *= 0.5;
          bumped = Math.max(bumped, -vn);
        }
      }
    }
    if (bumped > 2) this.audio.clunk(this.pos.x, 0.5, this.pos.y, Math.min(1, bumped / 10));

    // ---------------- derived
    this.vLong = this.vel.x * c - this.vel.y * sn;
    this.speed = this.vel.length();
    this.topSpeed = Math.max(this.topSpeed, this.speed);
    this.slip = THREE.MathUtils.clamp((slipMax - 0.12) * 3, 0, 1) * (this.surface === 'grass' ? 0.2 : 1);
    // gears / rpm
    const v = Math.abs(this.vLong);
    const gears = [0, 13, 24, 35, 46, 58, 80];
    let g = 1;
    while (g < 6 && v > gears[g]) g++;
    if (g !== this.gear) { this._shiftT = 0.12; this.gear = g; }
    this._shiftT = Math.max(0, (this._shiftT || 0) - dt);
    const lo = gears[g - 1], hi = gears[g];
    const targetRpm = 1000 + ((v - lo) / (hi - lo)) * 5800 * (g === 1 ? 1 : 0.85) + (g > 1 ? 1500 : 0);
    this.rpm += ((this.throttle ? Math.max(targetRpm, 2200) : targetRpm) - this.rpm) * (1 - Math.exp(-8 * dt));
    this.rpm = THREE.MathUtils.clamp(this.rpm, 850, 7600);
    this.audio.engineUpdate(this.rpm, this.throttle, this.slip);

    // ---------------- visuals
    const car = this.car;
    car.root.position.set(this.pos.x, 0, this.pos.y);
    car.root.rotation.y = this.heading;
    // spring-damper body motion
    const kS = 60, dS = 9;
    this.pitchV += (-this.lastAx * 0.006 - this.pitch) * kS * dt - this.pitchV * dS * dt;
    this.pitch += this.pitchV * dt;
    this.rollV += (this.lastAy * 0.009 - this.roll) * kS * dt - this.rollV * dS * dt;
    this.roll += this.rollV * dt;
    const rough = this.surface === 'grass' ? 0.02 : 0.002;
    this.bounceV += ((Math.random() - 0.5) * rough * speed * 8 - this.bounce * 140) * dt - this.bounceV * 10 * dt;
    this.bounce += this.bounceV * dt;
    this.bodyY += (this.bodyBase - this.bodyY) * (1 - Math.exp(-3 * dt));
    car.body.position.y = this.bodyY + this.bounce;
    car.body.rotation.z = THREE.MathUtils.clamp(this.pitch, -0.06, 0.06);
    car.body.rotation.x = THREE.MathUtils.clamp(-this.roll, -0.07, 0.07);
    for (const w of car.wheels) {
      w.spinner.rotation.z -= (this.vLong * dt) / 0.34;
      if (w.front) w.pivot.rotation.y = this.steer;
      // wheels counter the body roll so they stay on the ground
      w.pivot.position.y = 0.34 - (car.body.position.y - this.bodyBase);
    }
    car.setLights(true, this.braking || (this.handbrake && speed > 1));
  }

  _shiftCut() { return this._shiftT > 0 ? 0.7 : 0; }

  /** Chase camera with collision and mouse orbit. */
  updateCamera(cam, dt, input) {
    const c = Math.cos(this.heading), sn = Math.sin(this.heading);
    this.camYawOff -= input.mouseDX * 0.003;
    if (!input.mouseDX) this.camYawOff *= Math.exp(-1.5 * dt);
    this.camYawOff = THREE.MathUtils.clamp(this.camYawOff, -2.6, 2.6);
    const back = this.vLong < -2 ? -1 : 1;
    const yaw = this.heading + (back < 0 ? Math.PI : 0) + this.camYawOff;
    const dist = 7.2 + this.speed * 0.03;
    const target = new THREE.Vector3(this.pos.x, 1.2, this.pos.y);
    const dir = new THREE.Vector3(-Math.cos(yaw), 0.36, Math.sin(yaw)).normalize();
    let d = this.colliders.raycast(target, dir, dist);
    d = Math.max(0.3, d - 0.3);
    const desired = target.clone().addScaledVector(dir, d);
    if (!this.camPos) this.camPos = desired.clone();
    this.camPos.lerp(desired, 1 - Math.exp(-6 * dt));
    cam.position.copy(this.camPos);
    this.camLook.set(this.pos.x + c * 2.2, 0.9, this.pos.y - sn * 2.2);
    cam.lookAt(this.camLook);
    cam.fov += ((60 + this.speed * 0.3) - cam.fov) * (1 - Math.exp(-3 * dt));
    cam.updateProjectionMatrix();
  }
}
