// Particle effects: welding sparks (HDR, bloom), paint mist, dust.
import * as THREE from 'three';
import { dotTexture } from './textures.js';

const DOT = dotTexture();

export class Particles {
  constructor(scene, max, { size = 0.05, additive = true, gravity = -9.8, drag = 0.4, bounce = 0.35, opacity = 1 } = {}) {
    this.max = max;
    this.gravity = gravity; this.drag = drag; this.bounce = bounce;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.base = new Float32Array(max * 3);
    this.cursor = 0;
    const g = this.geo = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    this.mat = new THREE.PointsMaterial({
      size, map: DOT, vertexColors: true, transparent: true, opacity,
      depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, toneMapped: !additive,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    for (let i = 0; i < max; i++) this.pos[i * 3 + 1] = -100;
    scene.add(this.points);
  }

  emit(p, n, { speed = 3, spread = 1, up = 1, color = [9, 5.5, 2], life = 0.6, dir = null, jitter = 0.02 } = {}) {
    for (let k = 0; k < n; k++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.max;
      const s = speed * (0.4 + Math.random() * 0.8);
      let vx = (Math.random() - 0.5) * 2 * spread, vy = Math.random() * up, vz = (Math.random() - 0.5) * 2 * spread;
      if (dir) { vx += dir.x; vy += dir.y; vz += dir.z; }
      const l = Math.hypot(vx, vy, vz) || 1;
      this.vel[i * 3] = vx / l * s; this.vel[i * 3 + 1] = vy / l * s; this.vel[i * 3 + 2] = vz / l * s;
      this.pos[i * 3] = p.x + (Math.random() - 0.5) * jitter;
      this.pos[i * 3 + 1] = p.y + (Math.random() - 0.5) * jitter;
      this.pos[i * 3 + 2] = p.z + (Math.random() - 0.5) * jitter;
      this.base[i * 3] = color[0]; this.base[i * 3 + 1] = color[1]; this.base[i * 3 + 2] = color[2];
      this.life[i] = this.maxLife[i] = life * (0.5 + Math.random() * 0.8);
    }
  }

  update(dt) {
    const { pos, vel, col, life, maxLife, base } = this;
    const dragF = Math.exp(-this.drag * dt);
    for (let i = 0; i < this.max; i++) {
      if (life[i] <= 0) continue;
      life[i] -= dt;
      const j = i * 3;
      if (life[i] <= 0) { pos[j + 1] = -100; col[j] = col[j + 1] = col[j + 2] = 0; continue; }
      vel[j + 1] += this.gravity * dt;
      vel[j] *= dragF; vel[j + 1] *= dragF; vel[j + 2] *= dragF;
      pos[j] += vel[j] * dt; pos[j + 1] += vel[j + 1] * dt; pos[j + 2] += vel[j + 2] * dt;
      if (pos[j + 1] < 0.02 && vel[j + 1] < 0) { pos[j + 1] = 0.02; vel[j + 1] *= -this.bounce; vel[j] *= 0.6; vel[j + 2] *= 0.6; }
      const f = life[i] / maxLife[i];
      const cool = Math.min(1, f * 1.6);
      col[j] = base[j] * cool; col[j + 1] = base[j + 1] * cool * cool; col[j + 2] = base[j + 2] * cool * cool * cool;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
  }
}

/** A flickering light + glow sprite used for weld flashes. */
export class Flash {
  constructor(scene, color = 0xbfe0ff) {
    this.light = new THREE.PointLight(color, 0, 9, 1.6);
    scene.add(this.light);
    const m = new THREE.SpriteMaterial({ map: DOT, color: new THREE.Color(12, 14, 18), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, transparent: true });
    this.sprite = new THREE.Sprite(m);
    this.sprite.scale.setScalar(0.5);
    this.sprite.visible = false;
    scene.add(this.sprite);
  }
  set(p, on) {
    if (on) {
      const fl = 0.4 + Math.random() * 0.9;
      this.light.position.copy(p);
      this.light.intensity = 25 * fl;
      this.sprite.position.copy(p);
      this.sprite.visible = true;
      this.sprite.scale.setScalar(0.25 + fl * 0.45);
    } else {
      this.light.intensity = 0;
      this.sprite.visible = false;
    }
  }
}
