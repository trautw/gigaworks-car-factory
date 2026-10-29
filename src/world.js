// Static world assembly: factory + outdoor GLBs, procedural textures, colliders,
// doors, parked cars, lobby display car, info stands, screens, vegetation.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import layout from './data/layout.json';
import track from './data/track.json';
import { child, shadows } from './assets.js';
import { concreteTexture, lobbyTileTexture, asphaltTexture, grassTexture, concreteLightTexture, ScreenCanvas, FONT } from './textures.js';
import { CarBuild, randomConfig, BODY_Y } from './carBuild.js';
import { STATION_INFO } from './data/content.js';

const H = layout.hall;
const LZ = layout.lineZ;

export class World {
  constructor({ scene, assets, colliders, audio }) {
    this.scene = scene; this.assets = assets; this.colliders = colliders; this.audio = audio;
    this.interactables = [];
    this.screens = [];
    this._factory();
    this._outdoor();
    this._colliders();
    this._parkedCars();
    this._displayCar();
    this._infoStands();
    this._screens();
    this._vegetation();
    this.doorOpen = 0;
    this.rollOpen = 0;
    this.rollTarget = 0;
  }

  _factory() {
    const f = this.factory = this.assets.get('factory');
    this.scene.add(this.assets.scenes.factory);
    shadows(f, true, true);
    const conc = concreteTexture();
    const tiles = lobbyTileTexture();
    f.traverse((o) => {
      if (!o.isMesh) return;
      const m = o.material;
      if (m.name === 'FactoryFloor') { m.map = conc; m.color.set(0xffffff); m.roughness = 0.38; m.metalness = 0.0; m.envMapIntensity = 0.6; o.castShadow = false; }
      if (m.name === 'LobbyFloor') { m.map = tiles; m.color.set(0xffffff); m.roughness = 0.12; o.castShadow = false; }
      if (m.name === 'FacadeGlass') { m.transparent = true; m.opacity = 0.32; m.depthWrite = false; m.roughness = 0.03; m.metalness = 0.6; m.envMapIntensity = 1.8; o.castShadow = false; }
      if (m.name === 'Skylight') { m.emissiveIntensity = 3.2; o.castShadow = false; }
      if (m.name === 'SignGlow') { m.emissiveIntensity = 3.2; o.castShadow = false; }
      if (m.name === 'LampPanel') { m.emissiveIntensity = 4; o.castShadow = false; }
      if (o.name === 'floor_markings' || o.name === 'fence') o.castShadow = false;
    });
    this.slideL = child(f, 'slide_door_L');
    this.slideR = child(f, 'slide_door_R');
    this.slideL0 = this.slideL.position.x;
    this.slideR0 = this.slideR.position.x;
    this.rollup = child(f, 'rollup_door');
    this.kioskAnchor = child(f, 'kiosk_screen');
  }

  _outdoor() {
    const o = this.assets.scenes.outdoor;
    // instancing templates live at the origin of the outdoor scene: detach them
    for (const n of ['tree_pine', 'tree_round', 'light_pole', 'cone', 'board']) this.assets.get(n).removeFromParent();
    this.scene.add(o);
    const asph = asphaltTexture();
    const grass = grassTexture();
    const conc = concreteLightTexture();
    o.traverse((m) => {
      if (!m.isMesh) return;
      m.receiveShadow = true;
      m.castShadow = !['ground', 'track', 'parking', 'apron', 'door_road', 'east_apron', 'access_road', 'ground_lines'].includes(m.name) && !m.name.startsWith('curb') && !m.name.startsWith('edge') && !m.name.startsWith('runoff');
      const mat = m.material;
      if (mat.name === 'Asphalt') { mat.map = asph; mat.color.set(0xffffff); mat.roughness = 0.9; }
      if (mat.name === 'Grass') { mat.map = grass; mat.color.set(0xffffff); mat.roughness = 1; }
      if (mat.name === 'Concrete') { mat.map = conc; mat.color.set(0xffffff); }
      if (mat.name === 'TrackSign' || mat.name === 'LampGlow') mat.emissiveIntensity = 3;
    });
  }

  _colliders() {
    const c = this.colliders;
    const T = 0.6;
    const ent = layout.entrance, lob = layout.lobby, ru = layout.rollup;
    // perimeter walls
    c.add(H.x0 - T, H.z0 - T, H.x1 + T, H.z0 + T, 0, H.height, 'wall');
    c.add(H.x0 - T, H.z0, H.x0 + T, H.z1, 0, H.height, 'wall');
    c.add(H.x1 - T, H.z0, H.x1 + T, ru.z - ru.width / 2, 0, H.height, 'wall');
    c.add(H.x1 - T, ru.z + ru.width / 2, H.x1 + T, H.z1, 0, H.height, 'wall');
    c.add(H.x1 - T, ru.z - ru.width / 2, H.x1 + T, ru.z + ru.width / 2, ru.height, H.height, 'wall');
    this.rollCollider = c.add(H.x1 - 0.3, ru.z - ru.width / 2, H.x1 + 0.3, ru.z + ru.width / 2, 0, ru.height, 'rollup');
    c.add(H.x0, H.z1 - T, ent.x - ent.width / 2, H.z1 + T, 0, H.height, 'wall');
    c.add(ent.x + ent.width / 2, H.z1 - T, H.x1, H.z1 + T, 0, H.height, 'wall');
    c.add(ent.x - ent.width / 2, H.z1 - T, ent.x + ent.width / 2, H.z1 + T, ent.height, H.height, 'wall');
    this.entranceCollider = c.add(ent.x - ent.width / 2, H.z1 - 0.3, ent.x + ent.width / 2, H.z1 + 0.3, 0, ent.height, 'door');
    // roof (camera only)
    const roof = c.add(H.x0, H.z0, H.x1, H.z1, H.height - 0.3, H.height + 1, 'roof');
    roof.noMove = true;
    // lobby partitions
    c.add(lob.x0 - 2, lob.z0 - 0.15, lob.gateX0, lob.z0 + 0.15, 0, 3.2, 'glass');
    c.add(lob.gateX1, lob.z0 - 0.15, lob.x1, lob.z0 + 0.15, 0, 3.2, 'glass');
    c.add(lob.x1 - 0.15, lob.z0, lob.x1 + 0.15, H.z1, 0, 3.2, 'glass');
    // lobby furniture
    c.addCenter(-53.5, 15.5, 1.3, 4.3, 1.2);
    c.addCenter(-57.7, 15, 0.4, 8, 5);
    c.addCenter(layout.kiosk.x, layout.kiosk.z, 1.4, 0.9, 2);
    c.add(-42.2, 10.4, -35.8, 16.8, 0, 0.3, 'plinth');
    // safety fence
    c.add(layout.fenceX0, layout.fenceZ - 0.15, layout.fenceX1, layout.fenceZ + 0.15, 0, 1.15, 'fence');
    // pillars
    for (let x = H.x0 + 10; x < H.x1; x += 10) for (const z of [-14, 10]) c.addCenter(x, z, 0.8, 0.8, H.height);
    for (const cc of c.boxes) if (cc.tag === 'fence' || cc.tag === 'plinth') cc.noCam = true;
  }

  /** Static parked cars, merged per material into a single mesh each. */
  _parkedCars() {
    const pk = layout.parking;
    const spots = [];
    for (const row of [31.0, 47.0]) for (let k = 0; k < 13; k++) {
      if (Math.random() < 0.35) continue;
      spots.push([pk.x0 + 3 + k * 3.6 + 1.8, row, row > 40 ? Math.PI / 2 : -Math.PI / 2]);
    }
    const byMat = new Map();
    const tmp = new THREE.Matrix4();
    for (const [x, z, ry] of spots) {
      const car = new CarBuild(this.assets, randomConfig());
      car.applyState(7, 1, {});
      car.setPaint(1);
      car.setLights(false);
      car.skid.visible = false;
      car.setBodyLift(-BODY_Y);
      car.root.position.set(x, 0, z);
      car.root.rotation.y = ry;
      car.root.updateMatrixWorld(true);
      const paintKey = 'paint_' + car.cfg.color;
      car.root.traverse((m) => {
        if (!m.isMesh || !m.visible) return;
        let vis = true; let p = m; while (p) { if (!p.visible) vis = false; p = p.parent; }
        if (!vis || m.parent === car.skid || m.parent?.parent === car.skid) return;
        const mat = m.material;
        const key = mat.name === 'PaintInstance' ? paintKey : mat.uuid;
        if (!byMat.has(key)) byMat.set(key, { mat: mat.name === 'PaintInstance' ? mat.clone() : mat, geos: [] });
        const g = m.geometry.clone();
        for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
        if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
        g.applyMatrix4(tmp.copy(m.matrixWorld));
        byMat.get(key).geos.push(g.index ? g.toNonIndexed() : g);
      });
      car.dispose();
    }
    for (const { mat, geos } of byMat.values()) {
      const merged = mergeGeometries(geos, false);
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = true; mesh.receiveShadow = true;
      this.scene.add(mesh);
    }
    for (const [x, z] of spots) this.colliders.addCenter(x, z, 2.0, 4.6, 1.4, 'parked');
  }

  _displayCar() {
    const car = this.display = new CarBuild(this.assets, { color: 'red', wheels: 'sport', extra: 'spoiler' });
    car.applyState(7, 1, {});
    car.skid.visible = false;
    car.setBodyLift(-BODY_Y);
    car.setLights(true);
    car.root.position.set(-39.0, 0.25, 13.6);
    car.root.rotation.y = -0.6;
    this.scene.add(car.root);
    // spotlights on the plinth
    const spot = new THREE.SpotLight(0xffffff, 60, 14, 0.5, 0.6, 1.5);
    spot.position.set(-39, 7.5, 18);
    spot.target = car.root;
    this.scene.add(spot);
  }

  setDisplayConfig(cfg) {
    this.display.setConfig(cfg);
    this.display.applyState(7, 1, {});
    this.display.setPaint(1);
  }

  _infoStands() {
    const ix = (i) => layout.slots[i].x;
    for (let i = 0; i < layout.slots.length; i++) {
      const x = i === 7 ? layout.delivery.x - 4.5 : ix(i) - 1.6;
      const z = i === 7 ? layout.delivery.z + 2.5 : 2.3;
      const st = this.assets.clone('info_stand');
      st.position.set(x, 0, z);
      shadows(st, true, true);
      this.scene.add(st);
      // panel face with title
      const sc = new ScreenCanvas(512, 352);
      sc.draw((c, w, h) => {
        c.fillStyle = '#071019'; c.fillRect(0, 0, w, h);
        c.fillStyle = '#0a7cff'; c.fillRect(0, 0, w, 10);
        c.fillStyle = '#00c2ff'; c.font = `800 26px ${FONT}`; c.fillText(STATION_INFO[i].step, 28, 58);
        c.fillStyle = '#fff'; c.font = `800 52px ${FONT}`; c.fillText(STATION_INFO[i].title.toUpperCase(), 28, 128);
        c.fillStyle = '#9fb0c4'; c.font = `500 24px ${FONT}`;
        const words = STATION_INFO[i].body.split(' ');
        let line = '', y = 180;
        for (const wd of words) { if (c.measureText(line + wd).width > w - 56) { c.fillText(line, 28, y); line = ''; y += 32; if (y > 270) break; } line += wd + ' '; }
        if (y <= 270) c.fillText(line, 28, y);
        c.fillStyle = '#fff'; c.font = `700 24px ${FONT}`; c.fillText('Press  E  to read more', 28, h - 26);
      });
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.94, 0.64), new THREE.MeshBasicMaterial({ map: sc.texture, toneMapped: false }));
      plane.position.set(0, 1.35, 0.075);
      plane.rotation.x = -0.35;
      st.add(plane);
      this.colliders.addCenter(x, z, 0.8, 0.6, 1.6);
      this.interactables.push({ kind: 'info', index: i, pos: new THREE.Vector3(x, 1, z + 0.6), radius: 2.2, label: `Read: ${STATION_INFO[i].title}` });
    }
  }

  _screens() {
    for (const x of [-28, 5, 36]) {
      const sf = this.assets.clone('screen_frame');
      sf.position.set(x, 7.2, 0.4);
      this.scene.add(sf);
      const sc = new ScreenCanvas(1024, 580);
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(6, 3.4), new THREE.MeshBasicMaterial({ map: sc.texture, toneMapped: false }));
      plane.position.set(0, 0, 0.04);
      sf.add(plane);
      this.screens.push(sc);
    }
    this.kioskScreen = new ScreenCanvas(768, 480);
    const kp = new THREE.Mesh(new THREE.PlaneGeometry(1.36, 0.82), new THREE.MeshBasicMaterial({ map: this.kioskScreen.texture, toneMapped: false }));
    this.kioskAnchor.getWorldPosition(kp.position);
    kp.position.z += 0.02;
    kp.rotation.x = -0.25;
    this.scene.add(kp);
    this.interactables.push({ kind: 'kiosk', pos: new THREE.Vector3(layout.kiosk.x, 1, layout.kiosk.z + 1.0), radius: 2.0, label: 'Open configurator' });
    this.drawKiosk(null);
  }

  drawKiosk(order) {
    this.kioskScreen.draw((c, w, h) => {
      const g = c.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#06101c'); g.addColorStop(1, '#0b2440');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      c.fillStyle = '#0a7cff'; c.fillRect(32, 36, 54, 54);
      c.fillStyle = '#fff'; c.font = `800 40px ${FONT}`; c.fillText('G', 45, 78);
      c.font = `800 34px ${FONT}`; c.fillText('GIGAWORKS', 104, 76);
      if (!order) {
        c.font = `800 58px ${FONT}`; c.fillText('BUILD YOUR', 32, 200); c.fillText('GT COUPE', 32, 266);
        c.fillStyle = '#8fd8ff'; c.font = `600 28px ${FONT}`; c.fillText('Colour · Wheels · Extras', 32, 318);
        c.fillStyle = '#fff'; c.fillRect(32, 370, 330, 66);
        c.fillStyle = '#0a2440'; c.font = `800 28px ${FONT}`; c.fillText('PRESS  E  TO START', 52, 414);
      } else {
        c.fillStyle = '#33e07a'; c.font = `800 34px ${FONT}`; c.fillText('ORDER CONFIRMED', 32, 170);
        c.fillStyle = '#fff'; c.font = `900 72px ${FONT}`; c.fillText(order.number, 32, 260);
        c.fillStyle = '#9fb0c4'; c.font = `600 26px ${FONT}`; c.fillText(order.summary, 32, 312);
        c.fillStyle = '#8fd8ff'; c.fillText('Follow your car down the line →', 32, 400);
      }
    });
  }

  drawProduction(stats) {
    for (const [i, sc] of this.screens.entries()) {
      sc.draw((c, w, h) => {
        c.fillStyle = '#04080d'; c.fillRect(0, 0, w, h);
        c.fillStyle = '#0a7cff'; c.fillRect(0, 0, w, 70);
        c.fillStyle = '#fff'; c.font = `800 38px ${FONT}`; c.fillText('LIVE PRODUCTION', 30, 48);
        c.font = `600 26px ${FONT}`; c.textAlign = 'right'; c.fillText(stats.clock, w - 30, 46); c.textAlign = 'left';
        const tiles = [['UNITS TODAY', stats.units.toLocaleString('en-US')], ['TAKT TIME', '32.0 s'], ['OEE', stats.oee + ' %'], ['LINE', stats.running ? 'RUNNING' : 'INDEXING']];
        tiles.forEach(([k, v], j) => {
          const x = 30 + j * 245;
          c.fillStyle = '#0d1824'; c.fillRect(x, 96, 225, 150);
          c.fillStyle = '#7f90a6'; c.font = `700 20px ${FONT}`; c.fillText(k, x + 16, 132);
          c.fillStyle = j === 3 ? '#33e07a' : '#fff'; c.font = `800 48px ${FONT}`; c.fillText(v, x + 16, 206);
        });
        c.fillStyle = '#7f90a6'; c.font = `700 20px ${FONT}`; c.fillText('STATIONS', 30, 292);
        stats.stations.forEach((s, j) => {
          const x = 30 + j * 163;
          c.fillStyle = s.active ? '#0a7cff' : '#18222e'; c.fillRect(x, 306, 150, 90);
          c.fillStyle = '#fff'; c.font = `700 19px ${FONT}`; c.fillText(s.name, x + 10, 336);
          c.font = `600 17px ${FONT}`; c.fillStyle = s.active ? '#dff1ff' : '#6c7a8b'; c.fillText(s.active ? 'IN PROCESS' : 'IDLE', x + 10, 370);
          c.fillStyle = '#33e07a'; c.fillRect(x + 10, 380, 130 * s.p, 6);
        });
        if (stats.order) {
          c.fillStyle = '#0d1824'; c.fillRect(30, 420, w - 60, 130);
          c.fillStyle = '#8fd8ff'; c.font = `700 22px ${FONT}`; c.fillText('CUSTOMER ORDER  ' + stats.order.number, 50, 458);
          c.fillStyle = '#fff'; c.font = `800 40px ${FONT}`; c.fillText(stats.order.where, 50, 510);
          c.fillStyle = '#0a7cff'; c.fillRect(50, 524, (w - 100) * stats.order.progress, 10);
        } else {
          c.fillStyle = '#7f90a6'; c.font = `600 28px ${FONT}`; c.fillText(i === 0 ? 'Order your own car at the lobby kiosk!' : 'Zero accidents · 412 days', 30, 500);
        }
      });
    }
  }

  _vegetation() {
    const mats = [];
    const rand = (a, b) => a + Math.random() * (b - a);
    const pts = track.points;
    const nearTrack = (x, z, d) => pts.some(([px, pz]) => Math.hypot(px - x, pz - z) < d);
    const inFactory = (x, z) => x > H.x0 - 8 && x < H.x1 + 14 && z > H.z0 - 8 && z < 60;
    for (let i = 0; i < 220; i++) {
      const x = rand(-160, 330), z = rand(-150, 170);
      if (inFactory(x, z) || nearTrack(x, z, 16)) continue;
      if (x > 55 && x < 115 && z > -16 && z < 8) continue; // door road
      if (x > -70 && x < 75 && z > 18 && z < 62) continue; // parking & access
      mats.push(new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand(0, 6.28)), new THREE.Vector3().setScalar(rand(0.8, 1.5))));
    }
    const half = Math.floor(mats.length / 2);
    this.instance('tree_pine', mats.slice(0, half));
    this.instance('tree_round', mats.slice(half));
    // light poles along the parking and track straight
    const poles = [];
    for (let x = -58; x <= 0; x += 18) poles.push(new THREE.Matrix4().makeTranslation(x, 0, 39));
    for (let x = 70; x <= 110; x += 20) poles.push(new THREE.Matrix4().makeTranslation(x, 0, -12));
    this.instance('light_pole', poles);
    // cones at the door road
    const cones = [];
    for (let x = 64; x <= 100; x += 6) for (const z of [-10.5, 2.5]) cones.push(new THREE.Matrix4().makeTranslation(x, 0, z));
    this.instance('cone', cones);
    // boards around the track
    const boards = [];
    for (const i of [30, 70, 110, 150, 190]) {
      const [x, z] = pts[i]; const [x2, z2] = pts[(i + 1) % pts.length];
      const tx = x2 - x, tz = z2 - z, l = Math.hypot(tx, tz);
      const nx = -tz / l, nz = tx / l;
      const m = new THREE.Matrix4().compose(new THREE.Vector3(x + nx * 13, 0, z + nz * 13), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(tx, tz) + Math.PI / 2), new THREE.Vector3(1, 1, 1));
      boards.push(m);
    }
    this.instance('board', boards);
  }

  /** Instance every mesh of a template node at the given matrices. */
  instance(name, matrices) {
    if (!matrices.length) return;
    const tpl = this.assets.clone(name);
    tpl.updateMatrixWorld(true);
    const tmp = new THREE.Matrix4();
    tpl.traverse((m) => {
      if (!m.isMesh) return;
      const im = new THREE.InstancedMesh(m.geometry, m.material, matrices.length);
      matrices.forEach((mt, i) => im.setMatrixAt(i, tmp.multiplyMatrices(mt, m.matrixWorld)));
      im.castShadow = true; im.receiveShadow = true;
      this.scene.add(im);
    });
  }

  // ------------------------------------------------------------------ doors
  update(dt, playerPos, vehiclePos, lineCars) {
    const ent = layout.entrance;
    const near = (p, x, z, r) => p && Math.hypot(p.x - x, p.z - z) < r;
    const wantDoor = near(playerPos, ent.x, H.z1, 4.5) || near(vehiclePos, ent.x, H.z1, 6);
    const prev = this.doorOpen;
    this.doorOpen = THREE.MathUtils.clamp(this.doorOpen + (wantDoor ? dt : -dt) * 1.8, 0, 1);
    if (prev === 0 && this.doorOpen > 0) this.audio.slideDoor(ent.x, 1.5, H.z1);
    const o = THREE.MathUtils.smoothstep(this.doorOpen, 0, 1) * (ent.width / 2 - 0.1);
    this.slideL.position.x = this.slideL0 - o;
    this.slideR.position.x = this.slideR0 + o;
    this.entranceCollider.enabled = this.doorOpen < 0.7;

    // roll-up door opens for cars leaving or the player's car
    const ru = layout.rollup;
    let want = near(vehiclePos, H.x1, ru.z, 22);
    for (const e of lineCars) if (e.slot === 7 && !e.isPlayer && e.car.root.visible && Math.abs(e.car.root.position.x - H.x1) < 18) want = true;
    if (want && this.rollTarget === 0) this.audio.rollup(H.x1, 3, ru.z);
    this.rollTarget = want ? 1 : 0;
    this.rollOpen = THREE.MathUtils.clamp(this.rollOpen + (this.rollTarget ? dt * 0.45 : -dt * 0.3), 0, 1);
    this.rollup.scale.y = Math.max(0.03, 1 - this.rollOpen);
    this.rollCollider.enabled = this.rollOpen < 0.8;
  }
}
