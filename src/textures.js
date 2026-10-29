// Procedural canvas textures (no image files are downloaded or shipped).
import * as THREE from 'three';

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function canvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function noiseFill(ctx, w, h, base, amp, seed, blobs = 0, blobAmp = 0) {
  const r = rng(seed);
  const img = ctx.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    const n = (r() - 0.5) * amp;
    img.data[i * 4] = base[0] + n;
    img.data[i * 4 + 1] = base[1] + n;
    img.data[i * 4 + 2] = base[2] + n;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  for (let i = 0; i < blobs; i++) {
    const x = r() * w, y = r() * h, rad = 10 + r() * w * 0.18;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    const a = (r() * blobAmp).toFixed(3);
    const dark = r() < 0.6;
    g.addColorStop(0, dark ? `rgba(0,0,0,${a})` : `rgba(255,255,255,${a})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
}

function tex(c, repeat = 1, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Polished factory concrete: one 8 m tile with saw-cut joints. */
export function concreteTexture() {
  const c = canvas(512);
  const ctx = c.getContext('2d');
  noiseFill(ctx, 512, 512, [150, 152, 154], 18, 11, 40, 0.12);
  ctx.strokeStyle = 'rgba(40,40,45,0.55)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, 510, 510);
  // faint tyre marks
  ctx.strokeStyle = 'rgba(20,20,20,0.06)';
  ctx.lineWidth = 14;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath(); ctx.moveTo(0, 120 + i * 140); ctx.bezierCurveTo(200, 80 + i * 150, 300, 200 + i * 120, 512, 160 + i * 130); ctx.stroke();
  }
  return tex(c);
}

export function lobbyTileTexture() {
  const c = canvas(512);
  const ctx = c.getContext('2d');
  noiseFill(ctx, 512, 512, [214, 216, 219], 8, 5, 12, 0.05);
  ctx.strokeStyle = 'rgba(120,124,130,0.6)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 4; i++) {
    ctx.beginPath(); ctx.moveTo(i * 128, 0); ctx.lineTo(i * 128, 512); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i * 128); ctx.lineTo(512, i * 128); ctx.stroke();
  }
  return tex(c);
}

export function asphaltTexture() {
  const c = canvas(512);
  const ctx = c.getContext('2d');
  noiseFill(ctx, 512, 512, [58, 59, 62], 34, 21, 30, 0.10);
  const r = rng(3);
  for (let i = 0; i < 2500; i++) {
    const v = 90 + r() * 80;
    ctx.fillStyle = `rgba(${v},${v},${v},0.5)`;
    ctx.fillRect(r() * 512, r() * 512, 1.5, 1.5);
  }
  return tex(c);
}

export function grassTexture() {
  const c = canvas(512);
  const ctx = c.getContext('2d');
  noiseFill(ctx, 512, 512, [70, 104, 44], 30, 31, 60, 0.18);
  const r = rng(9);
  for (let i = 0; i < 4000; i++) {
    const g = 90 + r() * 70;
    ctx.strokeStyle = `rgba(${g * 0.6},${g},${g * 0.35},0.6)`;
    const x = r() * 512, y = r() * 512;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (r() - 0.5) * 3, y - 3 - r() * 4); ctx.stroke();
  }
  return tex(c);
}

export function concreteLightTexture() {
  const c = canvas(256);
  const ctx = c.getContext('2d');
  noiseFill(ctx, 256, 256, [170, 170, 166], 20, 41, 10, 0.08);
  ctx.strokeStyle = 'rgba(60,60,60,0.4)';
  ctx.strokeRect(0.5, 0.5, 255, 255);
  return tex(c);
}

/** Soft round sprite for particles. */
export function dotTexture() {
  const c = canvas(64);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.85)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  return t;
}

/** Dynamic canvas used for in-world screens. Call .draw(fn) then it updates. */
export class ScreenCanvas {
  constructor(w = 1024, h = 576) {
    this.canvas = canvas(w, h);
    this.ctx = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;
    this.w = w; this.h = h;
  }
  draw(fn) {
    fn(this.ctx, this.w, this.h);
    this.texture.needsUpdate = true;
  }
}

export const FONT = '"SF Pro Display","Segoe UI",system-ui,-apple-system,"Helvetica Neue",Arial,sans-serif';
