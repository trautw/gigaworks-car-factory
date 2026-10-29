// Third-person character controller with collision-aware orbit camera.
import * as THREE from 'three';
import { shadows } from './assets.js';
import { Rig } from './npc.js';

const UP = new THREE.Vector3(0, 1, 0);

export class Player {
  constructor(assets, scene, colliders) {
    this.root = assets.clone('player');
    shadows(this.root, true, false);
    scene.add(this.root);
    this.rig = new Rig(this.root, 'player');
    this.colliders = colliders;
    this.pos = this.root.position;
    this.vel = new THREE.Vector2();
    this.camYaw = 0;
    this.camPitch = 0.16;
    this.camDist = 4.6;
    this.curDist = 4.6;
    this.speed = 0;
    this._target = new THREE.Vector3();
    this._dir = new THREE.Vector3();
  }

  place(x, z, facing) {
    this.pos.set(x, 0, z);
    this.root.rotation.y = facing;
    this.camYaw = facing + Math.PI;
    this.vel.set(0, 0);
  }

  update(dt, input, extraColliders, allowMove = true) {
    // look
    this.camYaw -= input.mouseDX * 0.0026;
    this.camPitch = THREE.MathUtils.clamp(this.camPitch + input.mouseDY * 0.0022, -0.35, 1.15);
    if (input.down('ArrowLeft')) this.camYaw += dt * 2;
    if (input.down('ArrowRight')) this.camYaw -= dt * 2;
    // move relative to the camera
    let mx = 0, mz = 0;
    if (allowMove) {
      if (input.down('KeyW', 'ArrowUp')) mz += 1;
      if (input.down('KeyS', 'ArrowDown')) mz -= 1;
      if (input.down('KeyA')) mx -= 1;
      if (input.down('KeyD')) mx += 1;
    }
    const run = input.down('ShiftLeft', 'ShiftRight');
    const max = run ? 6.8 : 3.3;
    const fx = -Math.sin(this.camYaw), fz = -Math.cos(this.camYaw);
    const rx = -fz, rz = fx;
    let wx = fx * mz + rx * mx, wz = fz * mz + rz * mx;
    const l = Math.hypot(wx, wz);
    if (l > 0) { wx /= l; wz /= l; }
    const k = 1 - Math.exp(-(l > 0 ? 10 : 12) * dt);
    this.vel.x += (wx * max - this.vel.x) * k;
    this.vel.y += (wz * max - this.vel.y) * k;
    let nx = this.pos.x + this.vel.x * dt, nz = this.pos.z + this.vel.y * dt;
    const r = this.colliders.resolveCircle(nx, nz, 0.35, extraColliders);
    if (r.hit) {
      // remove velocity into the wall
      const vn = this.vel.x * r.nx + this.vel.y * r.nz;
      if (vn < 0) { this.vel.x -= vn * r.nx; this.vel.y -= vn * r.nz; }
    }
    this.pos.x = r.x; this.pos.z = r.z;
    this.speed = this.vel.length();
    if (this.speed > 0.2) {
      const target = Math.atan2(this.vel.x, this.vel.y);
      let d = target - this.root.rotation.y;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.root.rotation.y += d * (1 - Math.exp(-12 * dt));
    }
    this.rig.pose(dt, this.speed, this.speed > 0.1 ? 'walk' : 'idle', performance.now() / 1000);
  }

  /** Orbit camera behind the player, pulled in when something is in the way. */
  updateCamera(cam, dt) {
    const t = this._target.set(this.pos.x, 1.55, this.pos.z);
    const cp = Math.cos(this.camPitch);
    const d = this._dir.set(Math.sin(this.camYaw) * cp, Math.sin(this.camPitch), Math.cos(this.camYaw) * cp).normalize();
    let dist = this.colliders.raycast(t, d, this.camDist);
    dist = Math.max(0.15, dist - 0.3);
    this.curDist = dist < this.curDist ? dist : this.curDist + (dist - this.curDist) * (1 - Math.exp(-4 * dt));
    cam.position.copy(t).addScaledVector(d, this.curDist);
    if (cam.position.y < 0.3) cam.position.y = 0.3;
    cam.lookAt(t.x, t.y + 0.1, t.z);
    // hide the character when the camera is very close
    this.root.visible = this.curDist > 0.9;
  }
}
