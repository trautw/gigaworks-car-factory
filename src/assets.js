// Loads the Blender-made .glb files with byte-accurate progress.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const FILES = ['factory', 'machines', 'car', 'characters', 'outdoor'];

export async function loadAssets(onProgress) {
  const loader = new GLTFLoader();
  const loaded = {};
  const prog = Object.fromEntries(FILES.map((f) => [f, 0]));
  const report = () => onProgress(FILES.reduce((a, f) => a + prog[f], 0) / FILES.length);
  await Promise.all(FILES.map((name) => new Promise((resolve, reject) => {
    loader.load(`${import.meta.env.BASE_URL}models/${name}.glb`, (g) => {
      prog[name] = 1; report();
      loaded[name] = g.scene;
      resolve();
    }, (e) => {
      if (e.total) { prog[name] = Math.min(0.99, e.loaded / e.total); report(); }
    }, reject);
  })));
  return new Assets(loaded);
}

export class Assets {
  constructor(scenes) {
    this.scenes = scenes;
    this.index = new Map();
    for (const s of Object.values(scenes)) {
      s.updateMatrixWorld(true);
      s.traverse((o) => {
        if (!o.isMesh) return;
        const m = o.material;
        if (/Glass|Curtain|BeaconLens/.test(m.name)) {
          m.transparent = true;
          m.depthWrite = false;
          m.opacity = /Curtain/.test(m.name) ? 0.55 : /BeaconLens/.test(m.name) ? 0.9 : 0.3;
          m.side = THREE.DoubleSide;
          o.castShadow = false;
          o.renderOrder = 2;
        }
      });
      s.traverse((o) => { if (o.name && !this.index.has(o.name)) this.index.set(o.name, o); });
    }
  }
  /** The original node (not cloned). */
  get(name) {
    const o = this.index.get(name);
    if (!o) throw new Error('Missing model node: ' + name);
    return o;
  }
  /** A clone positioned at origin (local transform reset unless keep). */
  clone(name, keepTransform = false) {
    const c = this.get(name).clone(true);
    if (!keepTransform) { c.position.set(0, 0, 0); c.rotation.set(0, 0, 0); c.scale.set(1, 1, 1); }
    return c;
  }
}

/** Enable shadows on a hierarchy. */
export function shadows(obj, cast = true, receive = true) {
  obj.traverse((o) => { if (o.isMesh) { o.castShadow = cast; o.receiveShadow = receive; } });
  return obj;
}

/** Find a child by exact name inside a hierarchy. */
export function child(root, name) {
  let f = null;
  root.traverse((o) => { if (!f && o.name === name) f = o; });
  return f;
}

/** Collect materials in a hierarchy by material name. */
export function materialsByName(root) {
  const m = new Map();
  root.traverse((o) => {
    if (!o.isMesh) return;
    for (const mat of Array.isArray(o.material) ? o.material : [o.material]) {
      if (!m.has(mat.name)) m.set(mat.name, []);
      m.get(mat.name).push({ mesh: o, mat });
    }
  });
  return m;
}

export { THREE };
