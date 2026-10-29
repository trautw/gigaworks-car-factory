// Simple axis-aligned box colliders for the player, cars and the camera.
import * as THREE from 'three';

export class Colliders {
  constructor() {
    this.boxes = [];
  }

  /** Add a box by min/max in world space (x,z extent; y range for camera rays). */
  add(x0, z0, x1, z1, y0 = 0, y1 = 20, tag = '') {
    const b = { x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1), y0, y1, tag, enabled: true };
    this.boxes.push(b);
    return b;
  }

  addCenter(x, z, w, d, h = 20, tag = '') {
    return this.add(x - w / 2, z - d / 2, x + w / 2, z + d / 2, 0, h, tag);
  }

  /** Push a circle (x,z,r) out of all boxes. Returns {x,z,hit,nx,nz}. */
  resolveCircle(x, z, r, extra = null) {
    let hit = false, nx = 0, nz = 0;
    const list = extra ? this.boxes.concat(extra) : this.boxes;
    for (let iter = 0; iter < 2; iter++) {
      for (const b of list) {
        if (!b.enabled || b.noMove || b.y0 > 2.0) continue;
        const cx = Math.max(b.x0, Math.min(x, b.x1));
        const cz = Math.max(b.z0, Math.min(z, b.z1));
        let dx = x - cx, dz = z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        hit = true;
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2);
          x = cx + (dx / d) * r; z = cz + (dz / d) * r;
          nx = dx / d; nz = dz / d;
        } else {
          // centre inside box: push out on the shallowest axis
          const pens = [[x - b.x0 + r, -1, 0], [b.x1 - x + r, 1, 0], [z - b.z0 + r, 0, -1], [b.z1 - z + r, 0, 1]];
          pens.sort((a, c) => a[0] - c[0]);
          const [p, sx, sz] = pens[0];
          x += sx * p; z += sz * p; nx = sx; nz = sz;
        }
      }
    }
    return { x, z, hit, nx, nz };
  }

  /** Distance along a ray until the first box hit (3D slab test). */
  raycast(origin, dir, maxDist) {
    let best = maxDist;
    for (const b of this.boxes) {
      if (!b.enabled || b.noCam) continue;
      let tmin = 0, tmax = best;
      const o = [origin.x, origin.y, origin.z], d = [dir.x, dir.y, dir.z];
      const mn = [b.x0, b.y0, b.z0], mx = [b.x1, b.y1, b.z1];
      let ok = true;
      for (let i = 0; i < 3; i++) {
        if (Math.abs(d[i]) < 1e-9) {
          if (o[i] < mn[i] || o[i] > mx[i]) { ok = false; break; }
        } else {
          let t1 = (mn[i] - o[i]) / d[i], t2 = (mx[i] - o[i]) / d[i];
          if (t1 > t2) [t1, t2] = [t2, t1];
          tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
          if (tmin > tmax) { ok = false; break; }
        }
      }
      if (ok && tmin < best && tmin > 0.0) best = tmin;
    }
    return best;
  }

  /** Debug helper geometry. */
  debugMesh() {
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: 0xff00ff, wireframe: true });
    for (const b of this.boxes) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(b.x1 - b.x0, b.y1 - b.y0, b.z1 - b.z0), mat);
      m.position.set((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2);
      g.add(m);
    }
    return g;
  }
}
