// End-to-end test: drives the whole experience headlessly through the debug API,
// fails on any console error / page error / failed request, and captures screenshots.
//   npm run dev   (in another terminal)
//   npm test
import { chromium } from 'playwright';
import fs from 'fs';

const URL = process.env.URL || 'http://localhost:5173/';
const OUT = process.env.OUT || 'tests/screens';
fs.mkdirSync(OUT, { recursive: true });
const log = (...a) => console.log('[e2e]', ...a);
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); log(ok ? 'PASS' : 'FAIL', name, detail); };

const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(`[console.error] ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
page.on('requestfailed', (r) => errors.push(`[requestfailed] ${r.url()}`));
page.on('response', (r) => { if (r.status() >= 400) errors.push(`[http ${r.status()}] ${r.url()}`); });

const shot = async (name) => { await page.screenshot({ path: `${OUT}/${name}.png` }); log('screenshot', name); };
const G = (fn, arg) => page.evaluate(fn, arg);
const fps = () => page.evaluate(() => new Promise((r) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 1500) requestAnimationFrame(f); else r(Math.round(n / 1.5)); }; requestAnimationFrame(f); }));

const t0 = Date.now();
await page.goto(URL);
await page.waitForSelector('#loading:not(.hidden)');
await page.waitForTimeout(400);
await shot('01_loading');
await page.waitForFunction(() => window.__game?.mode === 'title', null, { timeout: 90000 });
check('loads to title screen', true, `${((Date.now() - t0) / 1000).toFixed(1)} s`);
await page.waitForTimeout(1200);
await shot('02_title');

// --- start & entrance
await page.click('#start-btn');
await page.waitForFunction(() => window.__game.mode === 'walk');
await page.waitForTimeout(900);
await shot('03_entrance');
check('fps at entrance >= 50', (await fps()) >= 50, String(await fps()));

// walk into the lobby with real key presses
await G(() => window.__game.teleport(-46, 24, Math.PI));
await page.keyboard.down('KeyW');
await page.waitForTimeout(2600);
await page.keyboard.up('KeyW');
const pz = (await G(() => window.__game.state)).player[1];
check('player walks through sliding doors into lobby', pz < 19.5, `z=${pz.toFixed(2)}`);
await shot('04_lobby');

// --- configurator
await G(() => window.__game.teleport(-46, 15.2, Math.PI));
await page.waitForTimeout(300);
const prompt = await page.textContent('#prompt');
check('kiosk shows interaction prompt', /configurator/i.test(prompt), prompt);
await page.keyboard.press('KeyE');
await page.waitForSelector('#config:not(.hidden)');
await page.click('.swatch[data-id="blue"]');
await page.click('#cfg-wheels .card[data-id="turbine"]');
await page.click('#cfg-extras .card[data-id="spoiler"]');
await page.waitForTimeout(1500);
await shot('05_configurator');
await page.click('#cfg-order');
await page.waitForTimeout(500);
const st0 = await G(() => window.__game.state);
check('order placed with order number', /^GW-\d{5}$/.test(st0.order || ''), st0.order);
check('HUD order tracker visible', await page.isVisible('#order-panel'));
await shot('06_order_hud');

// --- each station
const stations = [
  [1, 'stamping', 0.42, [-31.5, 4.2, 4.5], [-36, 1.6, -8]],
  [2, 'bodyshop', 0.6, [-15.5, 3.6, 3.2], [-20, 1.2, -4]],
  [3, 'paint', 0.55, [1.5, 3.6, 7.5], [-3, 1.2, -4]],
  [4, 'engine', 0.42, [18, 2.8, 3.4], [13, 1.4, -4]],
  [5, 'final', 0.62, [33, 3.4, 3.6], [28, 1.0, -4]],
  [6, 'qc', 0.35, [47.5, 3.6, 4.2], [42, 1.4, -4]],
];
for (const [i, name, p, cam, target] of stations) {
  const ok = await G(([i, p]) => window.__game.toStation(i, p), [i, p]);
  await G(([c, t]) => window.__game.setCam(c, t), [cam, target]);
  await page.waitForTimeout(700);
  const st = await G(() => window.__game.state);
  check(`player car reaches station ${i} (${name})`, ok && st.status.slot === i, JSON.stringify(st.status));
  await shot(`07_station_${i}_${name}`);
  // the same moment as the player sees it from the walkway (third-person camera)
  await G(() => window.__game.setCam(null));
  await G(([x]) => window.__game.teleport(x + 2.5, 4.6, Math.PI + 0.35), [target[0]]);
  await page.waitForTimeout(500);
  await shot(`07_station_${i}_${name}_player`);
  if (i === 2) { await page.waitForTimeout(400); await shot('07_station_2_bodyshop_b'); }
}
await G(() => window.__game.setCam(null));
// info panel
await G(() => window.__game.teleport(-20 - 1.6, 3.2, Math.PI));
await page.waitForTimeout(300);
await page.keyboard.press('KeyE');
await page.waitForTimeout(400);
check('info panel opens with E', await page.isVisible('#info'));
await shot('08_info_panel');
await page.keyboard.press('KeyE');
await page.waitForTimeout(300);
check('info panel closes with E', !(await page.isVisible('#info')));

// --- delivery
const delivered = await G(() => window.__game.toStation(7));
await page.waitForTimeout(300);
const st7 = await G(() => window.__game.state);
check('car delivered to delivery bay', delivered && st7.status.phase === 'done', JSON.stringify(st7.status));
await G(() => window.__game.teleport(50.5, 6.8, Math.PI / 2));
await page.waitForTimeout(800);
await shot('09_finished_car');
const p2 = await page.textContent('#prompt');
check('get-in prompt near finished car', /get in/i.test(p2), p2);
await page.keyboard.press('KeyE');
await page.waitForTimeout(1200);
check('entered car (drive mode)', (await G(() => window.__game.state)).mode === 'drive');
await shot('10_in_car');

// --- drive out + lap with autopilot (real time)
await G(() => { window.__game.autopilot = true; });
let lapDone = false, sawTrack = false, startT = Date.now();
while (Date.now() - startT < 150000) {
  await page.waitForTimeout(1000);
  const s = await G(() => window.__game.state);
  if (!sawTrack && s.lap.running && s.lap.time > 6) { sawTrack = true; await shot('11_test_track'); check('fps on track >= 50', (await fps()) >= 50, String(await fps())); }
  if (s.finished) { lapDone = true; break; }
}
const sEnd = await G(() => window.__game.state);
check('drove out of factory and completed a lap', lapDone, JSON.stringify(sEnd.lap));
await page.waitForTimeout(800);
await shot('12_finish_screen');
const dl = page.waitForEvent('download', { timeout: 10000 }).catch(() => null);
await page.click('#fin-photo-btn');
const d = await dl;
if (d) await d.saveAs(`${OUT}/13_photo.png`);
check('photo saved as image download', !!d, d ? d.suggestedFilename() : 'no download');
await page.waitForTimeout(500);
await shot('14_finish_with_photo');

const au = await G(() => ({ state: window.__game.audioState?.() }));
check('Web Audio running (procedural sound)', au.state === 'running', au.state);
check('no console/page errors', errors.length === 0, errors.slice(0, 10).join(' | '));
log(`total ${((Date.now() - t0) / 1000).toFixed(0)} s`);
fs.writeFileSync(`${OUT}/results.json`, JSON.stringify({ results, errors }, null, 2));
await browser.close();
const failed = results.filter((r) => !r.ok);
log(failed.length ? `${failed.length} FAILED` : 'ALL PASSED');
process.exit(failed.length ? 1 : 0);
