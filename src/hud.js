// HUD: order tracker, objective, mini-map, speedometer, prompts, speech bubbles.
import * as THREE from 'three';
import layout from './data/layout.json';
import track from './data/track.json';
import { COLORS, WHEELS, EXTRAS } from './data/content.js';
import { fmtTime } from './laps.js';

const $ = (id) => document.getElementById(id);
const H = layout.hall;
const STEPS = layout.slots.slice(1, 7).map((s) => s.name);

export class HUD {
  constructor() {
    this.el = $('hud');
    this.mm = $('minimap').getContext('2d');
    this.bubbleEls = new Map();
    const ol = $('op-steps');
    ol.innerHTML = [...STEPS, 'Delivery'].map((s) => `<li>${s}</li>`).join('');
    this.stepEls = [...ol.children];
    this._toastT = 0;
    this._v = new THREE.Vector3();
  }
  show(on) { this.el.classList.toggle('hidden', !on); }

  setOrder(order) {
    $('order-panel').classList.toggle('hidden', !order);
    if (!order) return;
    const col = COLORS.find((c) => c.id === order.cfg.color);
    $('op-swatch').style.background = col.hex;
    $('op-number').textContent = order.number;
    $('op-config').textContent = `${col.name} · ${WHEELS.find((w) => w.id === order.cfg.wheels).name} wheels · ${EXTRAS.find((e) => e.id === order.cfg.extra).name.toLowerCase()}`;
  }

  updateOrder(st, waitS) {
    if (!st) return;
    let text, active;
    if (st.phase === 'done') { text = 'Ready for pickup at the delivery bay'; active = 7; }
    else if (st.slot === 0) { text = `At the loading bay · enters line in ${Math.ceil(waitS)} s`; active = -1; }
    else if (st.moving) { text = `Moving to ${layout.slots[st.slot].name}…`; active = st.slot - 1; }
    else if (st.slot === 7) { text = 'Rolling off the line…'; active = 6; }
    else { text = `${layout.slots[st.slot].name} · ${Math.round(st.p * 100)}%`; active = st.slot - 1; }
    $('op-station').textContent = text;
    $('op-fill').style.width = `${(st.overall * 100).toFixed(1)}%`;
    this.stepEls.forEach((li, i) => {
      li.classList.toggle('done', i < active || (i === 6 && st.phase === 'done'));
      li.classList.toggle('active', i === active && st.phase !== 'done');
    });
    const remain = st.phase === 'done' ? 0 : st.slot === 0 ? waitS + 6 * 32 : (7 - st.slot) * 32 - (st.moving ? 0 : st.p * 26);
    $('op-eta').textContent = st.phase === 'done' ? 'Build complete ✔' : `Estimated completion in ${Math.max(0, Math.round(remain))} s`;
  }

  objective(text) {
    if (text !== this._obj) { $('objective').textContent = text; this._obj = text; }
    $('objective').classList.toggle('hidden', !text);
  }

  controls(mode) {
    const html = mode === 'drive'
      ? '<span><kbd>W</kbd> throttle</span><span><kbd>S</kbd> brake / reverse</span><span><kbd>A</kbd><kbd>D</kbd> steer</span><span><kbd>Space</kbd> handbrake</span><span><kbd>R</kbd> reset</span><span><kbd>E</kbd> exit car</span>'
      : '<span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> walk</span><span><kbd>Shift</kbd> run</span><span><kbd>Mouse</kbd> look</span><span><kbd>E</kbd> interact</span><span><kbd>T</kbd> hold: fast-forward</span><span><kbd>M</kbd> mute</span>';
    if (html !== this._ctl) { $('controls-hint').innerHTML = html; this._ctl = html; }
  }

  prompt(text) {
    const el = $('prompt');
    if (!text) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    if (text !== this._prompt) { el.innerHTML = text; this._prompt = text; }
  }

  toast(text, secs = 3) {
    const el = $('toast');
    el.textContent = text;
    el.classList.remove('hidden');
    el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
    this._toastT = secs;
  }

  fastForward(on) { $('ff-badge').classList.toggle('hidden', !on); }
  lookHint(on) { $('crosshair-hint').classList.toggle('hidden', !on); }

  drive(on, v, lap) {
    $('drive-panel').classList.toggle('hidden', !on);
    if (!on) return;
    $('speed').textContent = Math.round(v.speed * 3.6);
    $('gear').textContent = v.vLong < -0.5 && v.throttle ? 'R' : String(v.gear);
    $('lap-time').textContent = lap.running ? fmtTime(lap.time) : lap.lastLap ? fmtTime(lap.lastLap) : '--:--.---';
    $('lap-status').textContent = !lap.running ? 'Drive to the start line to begin your lap'
      : lap.next < 3 ? `Checkpoint ${lap.next + 1} / 3` : 'Final sector – go for the line!';
  }

  update(dt, camera, bubbles) {
    if (this._toastT > 0) { this._toastT -= dt; if (this._toastT <= 0) $('toast').classList.add('hidden'); }
    // speech bubbles projected into screen space
    const seen = new Set();
    for (const b of bubbles) {
      const p = this._v.copy(b.pos).project(camera);
      const dist = camera.position.distanceTo(b.pos);
      if (p.z > 1 || dist > 14) continue;
      seen.add(b.id);
      let el = this.bubbleEls.get(b.id);
      if (!el) { el = document.createElement('div'); el.className = 'bubble'; $('bubbles').appendChild(el); this.bubbleEls.set(b.id, el); }
      el.textContent = b.text;
      el.style.left = `${(p.x * 0.5 + 0.5) * innerWidth}px`;
      el.style.top = `${(-p.y * 0.5 + 0.5) * innerHeight}px`;
    }
    for (const [id, el] of this.bubbleEls) if (!seen.has(id)) { el.remove(); this.bubbleEls.delete(id); }
  }

  /** Mini-map: zoomed factory plan inside, wider area view outdoors. */
  minimap(player, heading, myCar, lineCars, stationActive, checkpointNext) {
    const c = this.mm, W = 220, Hh = 220;
    const inside = player.x > H.x0 - 6 && player.x < H.x1 + 6 && player.z > H.z0 - 6 && player.z < H.z1 + 30;
    let cx, cz, s;
    if (inside) { cx = 0; cz = 0; s = 1.65; } else { cx = player.x; cz = player.z; s = 0.75; }
    const tx = (x) => W / 2 + (x - cx) * s;
    const tz = (z) => Hh / 2 + (z - cz) * s;
    c.clearRect(0, 0, W, Hh);
    c.fillStyle = 'rgba(14,32,18,0.85)'; c.fillRect(0, 0, W, Hh);
    // track
    c.strokeStyle = '#3d434b'; c.lineWidth = track.width * s; c.lineJoin = 'round';
    c.beginPath(); track.points.forEach(([x, z], i) => (i ? c.lineTo(tx(x), tz(z)) : c.moveTo(tx(x), tz(z)))); c.closePath(); c.stroke();
    c.strokeStyle = '#5a626c'; c.lineWidth = 1; c.stroke();
    // door road
    c.fillStyle = '#3d434b'; c.fillRect(tx(60), tz(-10), 52 * s, 12 * s);
    // start line + checkpoints
    const [sx, sz] = track.points[0];
    c.fillStyle = '#fff'; c.fillRect(tx(sx) - 1.5, tz(sz) - track.width * s / 2, 3, track.width * s);
    if (checkpointNext) { c.fillStyle = '#ffd34d'; c.beginPath(); c.arc(tx(checkpointNext[0]), tz(checkpointNext[1]), 4, 0, 7); c.fill(); }
    // factory
    c.fillStyle = 'rgba(70,80,92,0.95)'; c.fillRect(tx(H.x0), tz(H.z0), (H.x1 - H.x0) * s, (H.z1 - H.z0) * s);
    c.strokeStyle = '#9fb0c4'; c.lineWidth = 1.5; c.strokeRect(tx(H.x0), tz(H.z0), (H.x1 - H.x0) * s, (H.z1 - H.z0) * s);
    const lob = layout.lobby;
    c.fillStyle = 'rgba(160,190,220,0.35)'; c.fillRect(tx(lob.x0), tz(lob.z0), (lob.x1 - lob.x0) * s, (lob.z1 - lob.z0) * s);
    // line
    c.strokeStyle = '#d9a514'; c.lineWidth = 2.2;
    c.beginPath(); c.moveTo(tx(-58), tz(layout.lineZ)); c.lineTo(tx(54), tz(layout.lineZ)); c.stroke();
    c.fillStyle = 'rgba(255,211,77,0.5)'; c.fillRect(tx(layout.fenceX0), tz(1.4), (H.x1 - 4 - layout.fenceX0) * s, 7.2 * s);
    layout.slots.forEach((st, i) => {
      if (i === 0 || i === 7) return;
      c.fillStyle = stationActive[i] ? '#00c2ff' : '#6d7a8a';
      c.fillRect(tx(st.x) - 5, tz(layout.lineZ) - 5, 10, 10);
      if (inside) { c.fillStyle = '#dbe5f0'; c.font = '600 8px system-ui'; c.textAlign = 'center'; c.fillText(String(i), tx(st.x), tz(layout.lineZ) + 3); }
    });
    // kiosk
    c.fillStyle = '#00c2ff'; c.beginPath(); c.arc(tx(layout.kiosk.x), tz(layout.kiosk.z), 3, 0, 7); c.fill();
    // cars on line
    for (const e of lineCars) {
      const p = e.car.root.position;
      c.fillStyle = e.isPlayer ? '#fff' : '#' + e.car.color.getHexString();
      c.fillRect(tx(p.x) - 2.5, tz(p.z) - 1.5, 5, 3);
    }
    if (myCar) {
      c.strokeStyle = '#fff'; c.lineWidth = 2; c.fillStyle = '#' + myCar.color.getHexString();
      c.beginPath(); c.arc(tx(myCar.root.position.x), tz(myCar.root.position.z), 5, 0, 7); c.fill(); c.stroke();
    }
    // player arrow
    c.save(); c.translate(tx(player.x), tz(player.z)); c.rotate(-heading + Math.PI);
    c.fillStyle = '#00c2ff'; c.strokeStyle = '#fff'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(0, -8); c.lineTo(6, 6); c.lineTo(0, 3); c.lineTo(-6, 6); c.closePath(); c.fill(); c.stroke();
    c.restore();
    $('mm-label').textContent = inside ? 'FACTORY' : 'TEST TRACK';
  }
}
