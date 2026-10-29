// Performance + camera-collision test at laptop-like settings (1440x900 @ DPR 2,
// renderer caps at 1.5). vsync / frame limiter disabled so headroom above 60 shows.
import { chromium } from 'playwright';
import fs from 'fs';
const URL = process.env.URL || 'http://localhost:5173/';
const OUT = process.env.OUT || 'tests/screens';
fs.mkdirSync(OUT, { recursive: true });
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log('[perf]', ok ? 'PASS' : 'FAIL', name, detail); };
const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-gpu-vsync', '--disable-frame-rate-limit'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(URL);
await page.waitForFunction(() => window.__game?.mode === 'title', null, { timeout: 90000 });
await page.evaluate(() => window.__game.start());
await page.waitForFunction(() => window.__game.mode === 'walk');
const G = (fn, arg) => page.evaluate(fn, arg);
const measure = async (label, shot) => {
  await page.waitForTimeout(600);
  const r = await G(() => new Promise((res) => {
    const info = window.__game.view.renderer.info;
    let n = 0; const t0 = performance.now();
    const f = () => { n++; if (performance.now() - t0 < 2500) requestAnimationFrame(f); else res({ fps: Math.round(n / ((performance.now() - t0) / 1000)), calls: info.render.calls, tris: info.render.triangles, px: window.__game.view.renderer.getPixelRatio() }); };
    requestAnimationFrame(f);
  }));
  if (shot) await page.screenshot({ path: `${OUT}/${shot}.png` });
  check(`FPS >= 60 @ ${label}`, r.fps >= 60, `${r.fps} fps, ${r.calls} draw calls, ${(r.tris / 1e6).toFixed(2)} M tris, pixelRatio ${r.px}`);
  return r;
};
await measure('entrance (outdoor, parking lot)');
await G(() => { window.__game.placeOrder({ color: 'red', wheels: 'sport', extra: 'spoiler' }); window.__game.toStation(2, 0.6); window.__game.teleport(-17.5, 4.6, Math.PI + 0.35); });
await measure('body shop walkway mid-weld', 'perf_bodyshop');
await G(() => { window.__game.teleport(-52, 5.5, Math.PI / 2); const p = window.__game.player; p.camYaw = -Math.PI / 2 + Math.PI; });
await measure('west end looking down the whole line', 'perf_line_east');
// shadow light-leak check: from the lobby gate looking east and from the delivery bay looking west
await G(() => { window.__game.teleport(-42, 8, Math.PI / 2); window.__game.player.camYaw = -Math.PI / 2; window.__game.player.camPitch = 0.25; });
await page.waitForTimeout(700); await page.screenshot({ path: `${OUT}/shadow_from_lobby_east.png` });
await G(() => { window.__game.teleport(52, 7, -Math.PI / 2); window.__game.player.camYaw = Math.PI / 2; window.__game.player.camPitch = 0.25; });
await page.waitForTimeout(700); await page.screenshot({ path: `${OUT}/shadow_from_delivery_west.png` });

// --- camera collision
const camAfter = async (setup, ms = 700) => { await G(setup); await page.waitForTimeout(ms); return G(() => window.__game.view.camera.position.toArray()); };
let c = await camAfter(() => { window.__game.teleport(-58.9, 5, 0); window.__game.player.camYaw = -Math.PI / 2; window.__game.player.camPitch = 0.1; });
check('camera stays inside hall at west wall', c[0] > -59.4, `cam x=${c[0].toFixed(2)} (wall face -59.4)`);
c = await camAfter(() => { window.__game.teleport(-50, -12.3, 0); window.__game.player.camYaw = Math.PI; window.__game.player.camPitch = 0.1; });
check('camera does not pass through a pillar', c[2] > -13.6, `cam z=${c[2].toFixed(2)} (pillar face -13.6)`);
c = await camAfter(() => { window.__game.teleport(-46, 11.2, 0); window.__game.player.camYaw = Math.PI; window.__game.player.camPitch = 0.1; });
check('camera blocked by lobby glass partition', c[2] > 10.1, `cam z=${c[2].toFixed(2)} (glass at 10.0)`);
c = await camAfter(() => { window.__game.teleport(-52, 21.6, 0); window.__game.player.camYaw = Math.PI; window.__game.player.camPitch = 0.1; });
check('camera blocked by facade glass from outside', c[2] > 20.5, `cam z=${c[2].toFixed(2)}`);
await G(() => { window.__game.toStation(7); window.__game.enterCar(); });
await page.waitForTimeout(500);
await measure('driving inside the hall (delivery bay)', 'perf_drive_hall');
let worst = 0;
for (let i = 0; i < 12; i++) {
  c = await camAfter(() => { window.__game.vehicle.camYawOff = Math.PI; }, 120);
  worst = Math.max(worst, c[0]);
}
check('car chase camera stays inside east wall', worst < 59.4, `max cam x=${worst.toFixed(2)} (wall face 59.4)`);
await G(() => { window.__game.autopilot = true; });
await page.waitForFunction(() => window.__game.state.lap.running, null, { timeout: 60000 });
await measure('test track while driving', 'perf_track');
check('no errors during perf run', errors.length === 0, errors.join(' | '));
fs.writeFileSync(`${OUT}/perf_results.json`, JSON.stringify(results, null, 2));
await browser.close();
process.exit(results.some((r) => !r.ok) ? 1 : 0);
