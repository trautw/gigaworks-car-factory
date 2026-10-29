import './style.css';
import * as THREE from 'three';
import layout from './data/layout.json';
import track from './data/track.json';
import { View } from './renderer.js';
import { loadAssets } from './assets.js';
import { Colliders } from './colliders.js';
import { World } from './world.js';
import { AssemblyLine, CYCLE } from './line.js';
import { FactoryLife } from './npc.js';
import { Player } from './player.js';
import { Vehicle, trackDistance } from './vehicle.js';
import { LapTimer, fmtTime } from './laps.js';
import { HUD } from './hud.js';
import { UI } from './ui.js';
import { Input } from './input.js';
import { audio } from './audio.js';
import { COLORS, WHEELS, EXTRAS } from './data/content.js';

const $ = (id) => document.getElementById(id);
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
const H = layout.hall;

const G = {
  mode: 'loading',
  order: null,
  timeScale: 1,
  simTime: 0,
  camOverride: null,
  finishedOnce: false,
};
window.__game = G;

async function boot() {
  const view = new View($('app'));
  const setLoad = (f, text) => { $('load-fill').style.width = `${(f * 100).toFixed(0)}%`; if (text) $('load-text').textContent = text; };
  setLoad(0.02, 'Loading models…');
  const assets = await loadAssets((f) => setLoad(0.02 + f * 0.6, `Loading models… ${Math.round(f * 100)}%`));
  const steps = [
    ['Pouring the factory floor…', () => { G.colliders = new Colliders(); G.world = new World({ scene: view.scene, assets, colliders: G.colliders, audio }); }],
    ['Calibrating robots…', () => { G.line = new AssemblyLine({ scene: view.scene, assets, audio, colliders: G.colliders }); }],
    ['Waking up the night shift…', () => { G.life = new FactoryLife({ scene: view.scene, assets, audio }); }],
    ['Fuelling the test track…', () => { G.player = new Player(assets, view.scene, G.colliders); G.player.place(layout.playerStart.x, layout.playerStart.z, Math.PI); }],
    ['Compiling shaders…', () => { view.renderer.compile(view.scene, view.camera); }],
  ];
  for (let i = 0; i < steps.length; i++) {
    setLoad(0.62 + (i / steps.length) * 0.36, steps[i][0]);
    await nextFrame();
    steps[i][1]();
  }
  G.view = view; G.assets = assets;
  // floating "your car" marker (pure effect geometry)
  G.marker = assets.clone('marker');
  G.marker.traverse((m) => { if (m.isMesh) { m.material = m.material.clone(); m.material.emissiveIntensity = 5; } });
  G.marker.visible = false;
  view.scene.add(G.marker);
  G.input = new Input(view.renderer.domElement);
  G.hud = new HUD();
  G.ui = new UI(audio);
  G.lap = new LapTimer();
  wireUI();
  setLoad(1, 'Ready');
  // warm-up frame
  view.camera.position.set(-20, 12, 75); view.camera.lookAt(-15, 6, 10);
  view.render();
  await nextFrame();
  $('loading').classList.add('hidden');
  $('title').classList.remove('hidden');
  G.mode = 'title';
  const startAudio = () => { audio.start(); audio.setEnvironment(false); if (G.mode === 'title') audio.music(true); };
  addEventListener('pointerdown', startAudio, { once: true });
  addEventListener('keydown', startAudio, { once: true });
  $('start-btn').onclick = () => startGame();
  if (new URLSearchParams(location.search).has('autostart')) startGame();
  let last = performance.now();
  view.renderer.setAnimationLoop((now) => {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    frame(dt);
  });
}

function startGame() {
  audio.start();
  audio.music(false);
  audio.ui('open');
  $('title').classList.add('hidden');
  fade(() => {
    G.mode = 'walk';
    G.hud.show(true);
    G.input.requestLock();
    G.gameStart = G.simTime;
  });
}

function fade(mid) {
  const f = $('fade');
  f.style.opacity = 1;
  setTimeout(() => { mid(); f.style.opacity = 0; }, 450);
}

function wireUI() {
  const ui = G.ui;
  ui.onConfigChange = (cfg) => G.world.setDisplayConfig(cfg);
  ui.onCancel = () => { ui.closeConfig(); G.mode = 'walk'; G.input.requestLock(); };
  ui.onOrder = (cfg) => placeOrder(cfg);
  addEventListener('keydown', (e) => {
    if (e.code === 'KeyM' && audio.ctx) { audio.master.gain.value = audio.master.gain.value > 0 ? 0 : 0.8; G.hud.toast(audio.master.gain.value ? 'Sound on' : 'Sound muted', 1.2); }
    if (e.code === 'Escape' && G.mode === 'config') ui.onCancel();
  });
}

function placeOrder(cfg) {
  const number = 'GW-' + String(10000 + Math.floor(Math.random() * 89999));
  const col = COLORS.find((c) => c.id === cfg.color);
  G.order = { number, cfg, placedAt: G.simTime, summary: `${col.name} · ${WHEELS.find((w) => w.id === cfg.wheels).name} · ${EXTRAS.find((e) => e.id === cfg.extra).name}` };
  G.entry = G.line.claimForPlayer(cfg);
  G.world.drawKiosk(G.order);
  G.hud.setOrder(G.order);
  G.ui.closeConfig();
  G.mode = 'walk';
  G.input.requestLock();
  G.hud.toast(`Order ${number} confirmed – follow your car down the line!`, 4);
}
G.placeOrder = placeOrder;

// ---------------------------------------------------------------------- frame
const tmpV = new THREE.Vector3();
let screenT = 0;

function frame(dt) {
  const { view, input, hud, line, life, world, player } = G;
  const cam = view.camera;
  if (G.mode === 'title') {
    G.simTime += dt;
    line.update(dt); life.update(dt, null); world.update(dt, null, null, line.cars);
    const t = G.simTime * 0.06;
    cam.position.set(-16 + Math.sin(t) * 40, 6 + Math.sin(t * 0.7) * 2, 66 + Math.cos(t) * 8);
    cam.lookAt(-18, 12, 14);
    world.display.root.rotation.y += dt * 0.3;
    view.followShadow(tmpV.set(-20, 0, 20));
    view.render();
    return;
  }

  const walking = G.mode === 'walk';
  const ff = walking && input.down('KeyT') && !G.vehicle?.active;
  G.timeScale = ff ? 6 : 1;
  hud.fastForward(ff);
  const sdt = dt * G.timeScale;
  G.simTime += sdt;
  line.update(sdt);
  for (const ev of line.events.splice(0)) onLineEvent(ev);
  life.update(sdt, G.mode === 'drive' ? null : player.pos, line.finalFocus);
  const vpos = G.vehicle ? G.vehicle.car.root.position : null;
  world.update(dt, G.mode === 'drive' ? null : player.pos, vpos, line.cars);
  world.display.root.rotation.y += dt * 0.25;

  // dynamic colliders for the player: line cars, workers, forklifts, parked own car
  const extra = life.colliders();
  for (const e of line.cars) {
    const p = e.car.root.position;
    if (e.car.root.visible) extra.push({ x0: p.x - 2.4, x1: p.x + 2.4, z0: p.z - 1.1, z1: p.z + 1.1, y0: 0, y1: 1.5, enabled: true });
  }
  const vehicleExtra = extra.slice();
  if (G.vehicle && G.mode !== 'drive') {
    const p = G.vehicle.car.root.position, h = G.vehicle.heading;
    const c = Math.abs(Math.cos(h)), s = Math.abs(Math.sin(h));
    const hx = 2.3 * c + 1.0 * s, hz = 2.3 * s + 1.0 * c;
    extra.push({ x0: p.x - hx, x1: p.x + hx, z0: p.z - hz, z1: p.z + hz, y0: 0, y1: 1.4, enabled: true });
  }

  let prompt = null;
  if (G.mode === 'walk') {
    player.update(dt, input, extra, true);
    if (!G.camOverride) player.updateCamera(cam, dt);
    // interactions
    let best = null, bd = 1e9;
    for (const it of world.interactables) {
      const d = Math.hypot(it.pos.x - player.pos.x, it.pos.z - player.pos.z);
      if (d < it.radius && d < bd) { best = it; bd = d; }
    }
    if (G.vehicle && !G.vehicle.active) {
      const p = G.vehicle.car.root.position;
      const d = Math.hypot(p.x - player.pos.x, p.z - player.pos.z);
      if (d < 3.6) best = { kind: 'car' };
    }
    if (best) {
      prompt = best.kind === 'car' ? '<kbd>E</kbd> Get in your car'
        : best.kind === 'kiosk' ? (G.order ? `Order ${G.order.number} is in production` : '<kbd>E</kbd> Open configurator')
          : `<kbd>E</kbd> ${best.label}`;
      if (input.hit('KeyE')) interact(best);
    }
  } else if (G.mode === 'config') {
    const t = performance.now() / 1000;
    cam.position.lerp(tmpV.set(-44.2 + Math.sin(t * 0.2) * 0.3, 2.05, 19.2), 1 - Math.exp(-4 * dt));
    cam.lookAt(-40.9, 0.85, 14.4);
  } else if (G.mode === 'info') {
    if (input.hit('KeyE') || input.hit('Escape')) { input.pressed.delete('KeyE'); G.ui.closeInfo(); G.mode = 'walk'; G.input.requestLock(); }
  }

  if (G.marker) {
    const show = G.vehicle && G.mode !== 'drive' && !G.vehicle.everDriven;
    G.marker.visible = !!show;
    if (show) {
      const p = G.vehicle.car.root.position;
      const t = performance.now() / 1000;
      G.marker.position.set(p.x, 2.6 + Math.sin(t * 3) * 0.15, p.z);
      G.marker.rotation.y = t * 1.5;
    }
  }
  if (G.vehicle) {
    const v = G.vehicle;
    const driving = G.mode === 'drive';
    v.extra = vehicleExtra;
    v.update(dt, G.autopilot && driving ? autoInput(v) : input, driving && !G.ui.finishOpen);
    v.active = driving;
    if (driving) {
      if (!G.camOverride) v.updateCamera(cam, dt, input);
      animateDoor(dt);
      const ev = G.lap.update(dt, v.pos.x, v.pos.y);
      if (ev === 'start') { hud.toast('Lap started – go go go!', 2); audio.ui('pass'); }
      if (ev === 'checkpoint') audio.beep(undefined, 0, 0, 1800, 0.08, 0.08);
      if (ev === 'lap') onLap();
      if (input.hit('KeyR')) resetCar();
      if (input.hit('KeyE') && v.speed < 2.5) { input.pressed.delete('KeyE'); exitCar(); }
      else if (input.hit('KeyE')) hud.toast('Slow down to get out', 1.2);
    }
    hud.drive(driving, v, G.lap);
  } else hud.drive(false);

  // HUD
  const st = line.playerStatus();
  if (G.order) hud.updateOrder(st, line.timeToNextAdvance());
  hud.objective(objective(st));
  hud.controls(G.mode === 'drive' ? 'drive' : 'walk');
  hud.el.classList.toggle('driving', G.mode === 'drive');
  hud.prompt(G.mode === 'walk' ? prompt : null);
  hud.lookHint(G.mode === 'walk' && !input.locked && !input.dragging && G.simTime - (G.gameStart || 0) < 8);
  const focus = G.mode === 'drive' ? G.vehicle.car.root.position : player.pos;
  const heading = G.mode === 'drive' ? G.vehicle.heading + Math.PI / 2 : player.root.rotation.y;
  hud.minimap(focus, heading, G.vehicle ? G.vehicle.car : null, line.cars, line.stationActive, G.lap.running && G.lap.next < 3 ? G.lap.checkpoints[G.lap.next] : null);
  hud.update(dt, cam, life.bubbles());

  if (G.camOverride) { cam.position.copy(G.camOverride.pos); cam.lookAt(G.camOverride.target); }
  if (G.shake > 0) {
    G.shake = Math.max(0, G.shake - dt * 0.8);
    cam.position.x += (Math.random() - 0.5) * G.shake * 0.4;
    cam.position.y += (Math.random() - 0.5) * G.shake * 0.4;
  }
  const inside = focus.x > H.x0 && focus.x < H.x1 && focus.z > H.z0 && focus.z < H.z1;
  audio.setEnvironment(inside);
  audio.setListener(cam);
  screenT -= dt;
  if (screenT <= 0) { screenT = 1; world.drawProduction(productionStats(st)); }
  // indoors the shadow frustum covers the whole hall so the roof always blocks the sun
  const shadowAt = G.camOverride ? G.camOverride.target : focus;
  const inHall = shadowAt.x > H.x0 - 2 && shadowAt.x < H.x1 + 2 && shadowAt.z > H.z0 - 2 && shadowAt.z < H.z1 + 2;
  view.followShadow(inHall ? tmpV.set(0, 0, -1) : shadowAt);
  input.endFrame();
  view.render();
}

function objective(st) {
  if (G.mode === 'drive') {
    if (G.finishedOnce) return 'Enjoy the track – press R to reset onto the circuit';
    if (G.lap.running) return 'Complete a full lap of the test track';
    const p = G.vehicle.car.root.position;
    if (p.x < H.x1) return 'Drive out through the roll-up door ahead →';
    return 'Follow the road to the start line';
  }
  if (!G.order) {
    const p = G.player.pos;
    return p.z > H.z1 ? 'Walk into the GIGAWORKS lobby' : 'Order your car at the configurator kiosk';
  }
  if (G.vehicle) return 'Your car is ready! Walk to the delivery bay and press E to get in';
  if (!st) return '';
  if (st.slot === 0) return `Your car enters the line in ${Math.ceil(G.line.timeToNextAdvance())} s – walk to the Stamping press`;
  const name = layout.slots[Math.min(st.slot, 7)].name;
  if (st.slot >= 7) return 'Your car is rolling off the line – head to the delivery bay';
  return st.moving ? `Your car is moving to ${name} – follow it` : `Watch your car at ${name}`;
}

function productionStats(st) {
  const d = new Date();
  const names = ['Stamping', 'Body', 'Paint', 'Engine', 'Final', 'QC'];
  return {
    clock: d.toTimeString().slice(0, 5),
    units: G.line.unitsToday,
    oee: (91.5 + Math.sin(G.simTime * 0.01) * 1.4).toFixed(1),
    running: G.line.phase === 'dwell',
    stations: names.map((n, i) => ({ name: n, active: G.line.stationActive[i + 1], p: G.line.stationActive[i + 1] ? G.line.dwellP : 0 })),
    order: G.order && st ? { number: G.order.number, where: st.phase === 'done' ? 'READY FOR PICKUP' : st.slot === 0 ? 'LOADING BAY' : layout.slots[Math.min(st.slot, 7)].name.toUpperCase(), progress: st.overall } : null,
  };
}

function onLineEvent(ev) {
  if (ev.type === 'pressHit') {
    const d = Math.hypot(ev.x - G.player.pos.x, ev.z - G.player.pos.z);
    if (d < 25 && G.mode === 'walk') G.shake = Math.max(G.shake || 0, 0.25 * (1 - d / 25));
  }
  if (ev.type === 'delivered' && ev.entry.isPlayer) {
    G.deliveredAt = G.simTime;
    G.vehicle = new Vehicle(ev.entry.car, G.colliders, audio);
    G.vehicle.bodyBase = 0;
    G.vehicle.active = false;
    G.hud.toast('Your car is finished! It is waiting in the delivery bay.', 4);
    audio.ui('pass');
  }
}

function interact(it) {
  G.input.pressed.delete('KeyE');
  if (it.kind === 'kiosk' && !G.order) {
    G.mode = 'config';
    G.input.releaseLock();
    G.ui.openConfig();
  } else if (it.kind === 'info') {
    G.mode = 'info';
    G.input.releaseLock();
    G.ui.openInfo(it.index);
  } else if (it.kind === 'car') enterCar();
}

function enterCar() {
  const v = G.vehicle;
  if (!v) return;
  G.mode = 'drive';
  v.everDriven = true;
  G.player.root.visible = false;
  G.player.root.position.set(0, -50, 0);
  v.active = true;
  v.camPos = null;
  G.doorT = 0;
  audio.clunk(v.pos.x, 1, v.pos.y, 0.5);
  audio.engineStart();
  G.hud.toast('Drive it out through the roll-up door!', 3);
  G.input.requestLock();
}

function exitCar() {
  const v = G.vehicle;
  G.mode = 'walk';
  v.active = false;
  audio.engineStop();
  const h = v.heading;
  G.player.place(v.pos.x - 1.9 * Math.sin(h), v.pos.y - 1.9 * Math.cos(h), h + Math.PI / 2);
  G.player.root.visible = true;
  G.player.curDist = 1;
}

function animateDoor(dt) {
  if (G.doorT === undefined || G.doorT > 1.6) return;
  G.doorT += dt;
  const door = G.vehicle.car.parts.get('door_L').obj;
  const t = G.doorT;
  const open = t < 0.5 ? t / 0.5 : t < 1.0 ? 1 : Math.max(0, 1 - (t - 1.0) / 0.5);
  door.rotation.y = -1.0 * Math.sin(open * Math.PI / 2);
  if (t >= 1.5 && !G.doorClosed) { G.doorClosed = true; audio.clunk(G.vehicle.pos.x, 1, G.vehicle.pos.y, 0.6); }
}

function resetCar() {
  const v = G.vehicle;
  const { i } = trackDistance(v.pos.x, v.pos.y);
  const pts = track.points;
  const [x, z] = pts[i], [x2, z2] = pts[(i + 2) % pts.length];
  v.pos.set(x, z);
  v.heading = Math.atan2(-(z2 - z), x2 - x);
  v.vel.set(0, 0); v.r = 0;
  v.camPos = null;
  G.hud.toast('Car reset to the track', 1.2);
}

function onLap() {
  audio.ui('lap');
  if (G.finishedOnce) { G.hud.toast(`Lap ${fmtTime(G.lap.lastLap)}${G.lap.lastLap === G.lap.best ? ' – new best!' : ''}`, 3); return; }
  G.finishedOnce = true;
  const cfg = G.order.cfg;
  G.input.releaseLock();
  audio.music(true);
  G.ui.openFinish({
    order: G.order.number,
    color: COLORS.find((c) => c.id === cfg.color).name,
    spec: `${WHEELS.find((w) => w.id === cfg.wheels).name} · ${EXTRAS.find((e) => e.id === cfg.extra).name}`,
    build: (G.deliveredAt || G.simTime) - G.order.placedAt,
    lap: G.lap.lastLap,
    top: G.vehicle.topSpeed,
  }, {
    photo: () => takePhoto(),
    drive: () => { G.ui.closeFinish(); audio.music(false); G.input.requestLock(); },
    restart: () => location.reload(),
  });
}

/** Render the car from a flattering angle and save it as a PNG. */
function takePhoto() {
  const { view } = G;
  const v = G.vehicle;
  const car = v.car.root;
  const h = v.heading;
  const cam = new THREE.PerspectiveCamera(34, innerWidth / innerHeight, 0.1, 2000);
  const local = new THREE.Vector3(5.6, 1.15, -4.2).applyAxisAngle(new THREE.Vector3(0, 1, 0), h);
  cam.position.copy(car.position).add(local);
  cam.lookAt(car.position.x, 0.75, car.position.z);
  view.renderPass.camera = cam;
  view.followShadow(car.position);
  view.composer.render();
  view.renderPass.camera = view.camera;
  const W = 1600, Hh = 900;
  const out = document.createElement('canvas');
  out.width = W; out.height = Hh;
  const c = out.getContext('2d');
  const src = view.renderer.domElement;
  const sAspect = src.width / src.height;
  let sw = src.width, sh = src.height, sx = 0, sy = 0;
  if (sAspect > W / Hh) { sw = src.height * W / Hh; sx = (src.width - sw) / 2; } else { sh = src.width * Hh / W; sy = (src.height - sh) / 2; }
  c.drawImage(src, sx, sy, sw, sh, 0, 0, W, Hh);
  const g = c.createLinearGradient(0, Hh - 170, 0, Hh);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.75)');
  c.fillStyle = g; c.fillRect(0, Hh - 170, W, 170);
  c.fillStyle = '#0a7cff'; c.fillRect(48, Hh - 104, 56, 56);
  c.fillStyle = '#fff'; c.font = '800 40px system-ui, Arial'; c.fillText('G', 62, Hh - 61);
  c.font = '800 38px system-ui, Arial'; c.fillText('GIGAWORKS  GT COUPE', 124, Hh - 64);
  const col = COLORS.find((x) => x.id === G.order.cfg.color).name;
  c.font = '500 24px system-ui, Arial'; c.fillStyle = '#cfe3ff';
  c.fillText(`${col} · Order ${G.order.number} · Lap ${fmtTime(G.lap.lastLap || G.lap.best)}`, 124, Hh - 30);
  const url = out.toDataURL('image/png');
  G.ui.showPhoto(url);
  const a = document.createElement('a');
  a.href = url; a.download = `gigaworks-${G.order.number}.png`;
  document.body.appendChild(a); a.click(); a.remove();
  G.lastPhoto = url;
  audio.ui('click');
  return url;
}

// ---------------------------------------------------------------------- autopilot (testing)
function autoInput(v) {
  const pts = track.points;
  const p = v.car.root.position;
  let target;
  if (p.x < 112 && Math.abs(p.z - layout.lineZ) < 12 && !G.lap.running) target = { x: Math.max(p.x + 14, 70), z: layout.lineZ };
  else {
    const { i } = trackDistance(p.x, p.z);
    const look = Math.round(4 + v.speed * 0.2);
    const [x, z] = pts[(i + look) % pts.length];
    target = { x, z };
  }
  if (p.x < 58 && p.z > -1) target = { x: p.x + 6, z: layout.lineZ }; // leave the delivery bay
  const desired = Math.atan2(-(target.z - p.z), target.x - p.x);
  let d = desired - v.heading; d = Math.atan2(Math.sin(d), Math.cos(d));
  // look further ahead for corner speed
  const { i } = trackDistance(p.x, p.z);
  const ahead = Math.round(6 + v.speed * 0.35);
  const [ax, az] = pts[(i + 3) % pts.length], [bx, bz] = pts[(i + ahead) % pts.length];
  const bend = Math.abs(Math.atan2(Math.sin(Math.atan2(bz - az, bx - ax) - Math.atan2(az - p.z, ax - p.x)), Math.cos(Math.atan2(bz - az, bx - ax) - Math.atan2(az - p.z, ax - p.x))));
  const keys = new Set();
  const vmax = G.lap.running || p.x > 100 ? Math.max(10, 34 - bend * 30) : 14;
  if (v.speed < vmax) keys.add('KeyW'); else if (v.speed > vmax + 3) keys.add('KeyS');
  return { down: (...c) => c.some((k) => keys.has(k)), steerAxis: THREE.MathUtils.clamp(d * 2.2, -1, 1), mouseDX: 0, mouseDY: 0, hit: () => false };
}

// ---------------------------------------------------------------------- debug / test API
Object.defineProperty(G, 'state', {
  get() {
    return {
      mode: G.mode, order: G.order?.number, status: G.line?.playerStatus(), lap: G.lap && { running: G.lap.running, time: G.lap.time, last: G.lap.lastLap, next: G.lap.next },
      player: G.player && [G.player.pos.x, G.player.pos.z], vehicle: G.vehicle && [G.vehicle.pos.x, G.vehicle.pos.y, G.vehicle.speed], finished: G.finishedOnce,
    };
  }
});
Object.assign(G, {
  start: () => startGame(),
  /** Simulate factory time without rendering. */
  ff(seconds, step = 0.1) {
    for (let t = 0; t < seconds; t += step) {
      G.line.update(step); G.life.update(step, G.player.pos); G.simTime += step;
      for (const ev of G.line.events.splice(0)) onLineEvent(ev);
    }
  },
  /** Fast-forward until the player's car dwells at slot i with progress p. */
  toStation(i, p = 0.5) {
    for (let n = 0; n < 4000; n++) {
      const st = G.line.playerStatus();
      if (st && ((st.slot === i && !st.moving && st.p >= p) || (i >= 7 && st.phase === 'done'))) return true;
      G.ff(0.2);
    }
    return false;
  },
  teleport(x, z, facing = 0) { G.player.place(x, z, facing); },
  setCam(pos, target) { G.camOverride = pos ? { pos: new THREE.Vector3(...pos), target: new THREE.Vector3(...target) } : null; },
  openKiosk() { interact({ kind: 'kiosk' }); },
  openInfo(i) { interact({ kind: 'info', index: i }); },
  enterCar() { enterCar(); },
  takePhoto: () => takePhoto(),
  audioState: () => audio.ctx?.state,
  resetCar: () => resetCar(),
});

boot().catch((e) => {
  console.error(e);
  $('load-text').textContent = 'Failed to start: ' + e.message;
});
