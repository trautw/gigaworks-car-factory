// Overlays: configurator, station info, finish screen + photo capture.
import { COLORS, WHEELS, EXTRAS, STATION_INFO } from './data/content.js';
import { fmtTime } from './laps.js';

const $ = (id) => document.getElementById(id);

function wheelIcon(style) {
  const c = document.createElement('canvas');
  c.width = 56; c.height = 56;
  const x = c.getContext('2d');
  x.translate(28, 28);
  x.fillStyle = '#111'; x.beginPath(); x.arc(0, 0, 26, 0, 7); x.fill();
  x.fillStyle = style === 'turbine' ? '#222' : '#c9ced6'; x.beginPath(); x.arc(0, 0, 18, 0, 7); x.fill();
  if (style === 'sport') { x.fillStyle = '#2a2d33'; for (let i = 0; i < 5; i++) { x.rotate(Math.PI * 2 / 5); x.beginPath(); x.moveTo(4, -3); x.lineTo(16, -6); x.lineTo(16, 6); x.lineTo(4, 3); x.fill(); } }
  if (style === 'turbine') { x.strokeStyle = '#e8e8e8'; x.lineWidth = 2; for (let i = 0; i < 12; i++) { x.rotate(Math.PI / 6); x.beginPath(); x.moveTo(4, 0); x.quadraticCurveTo(10, 5, 17, 2); x.stroke(); } }
  if (style === 'aero') { x.fillStyle = '#e9ebee'; x.beginPath(); x.arc(0, 0, 15, 0, 7); x.fill(); x.fillStyle = '#222'; for (let i = 0; i < 6; i++) { x.rotate(Math.PI / 3); x.beginPath(); x.arc(10, 0, 2.5, 0, 7); x.fill(); } }
  x.fillStyle = '#888'; x.beginPath(); x.arc(0, 0, 4, 0, 7); x.fill();
  return c;
}

export class UI {
  constructor(audio) {
    this.audio = audio;
    this.cfg = { color: 'red', wheels: 'sport', extra: 'spoiler' };
    this.onConfigChange = () => {};
    this.onOrder = () => {};
    this.onCancel = () => {};
    this._buildConfig();
    $('info-close').onclick = () => this.closeInfo();
  }

  _buildConfig() {
    const cols = $('cfg-colors');
    for (const c of COLORS) {
      const d = document.createElement('div');
      d.className = 'swatch';
      d.style.background = c.hex;
      d.title = c.name;
      d.dataset.id = c.id;
      d.onclick = () => this._select('color', c.id);
      cols.appendChild(d);
    }
    const mk = (box, list, key) => {
      for (const it of list) {
        const d = document.createElement('div');
        d.className = 'card';
        d.dataset.id = it.id;
        if (key === 'wheels') d.appendChild(wheelIcon(it.id));
        d.insertAdjacentHTML('beforeend', `<b>${it.name}</b><small>${it.desc}</small>`);
        d.onclick = () => this._select(key, it.id);
        box.appendChild(d);
      }
    };
    mk($('cfg-wheels'), WHEELS, 'wheels');
    mk($('cfg-extras'), EXTRAS, 'extra');
    $('cfg-order').onclick = () => { this.audio.ui('order'); this.onOrder({ ...this.cfg }); };
    $('cfg-cancel').onclick = () => { this.audio.ui('click'); this.onCancel(); };
    this._refresh();
  }

  _select(key, id) {
    this.cfg[key] = id;
    this.audio.ui('click');
    this._refresh();
    this.onConfigChange({ ...this.cfg });
  }

  _refresh() {
    for (const el of $('cfg-colors').children) el.classList.toggle('sel', el.dataset.id === this.cfg.color);
    for (const el of $('cfg-wheels').children) el.classList.toggle('sel', el.dataset.id === this.cfg.wheels);
    for (const el of $('cfg-extras').children) el.classList.toggle('sel', el.dataset.id === this.cfg.extra);
    $('cfg-color-name').textContent = COLORS.find((c) => c.id === this.cfg.color).name;
  }

  openConfig() { $('config').classList.remove('hidden'); this.audio.ui('open'); this.onConfigChange({ ...this.cfg }); }
  closeConfig() { $('config').classList.add('hidden'); }
  get configOpen() { return !$('config').classList.contains('hidden'); }

  openInfo(i) {
    const s = STATION_INFO[i];
    $('info-step').textContent = s.step;
    $('info-title').textContent = s.title;
    $('info-body').textContent = s.body;
    $('info-facts').innerHTML = s.facts.map(([v, k]) => `<div class="fact"><b>${v}</b><small>${k}</small></div>`).join('');
    $('info').classList.remove('hidden');
    this.audio.ui('open');
  }
  closeInfo() { $('info').classList.add('hidden'); this.audio.ui('click'); }
  get infoOpen() { return !$('info').classList.contains('hidden'); }

  openFinish(data, handlers) {
    $('fin-order').textContent = data.order;
    $('fin-color').textContent = data.color;
    $('fin-spec').textContent = data.spec;
    $('fin-build').textContent = fmtBuild(data.build);
    $('fin-lap').textContent = fmtTime(data.lap);
    $('fin-top').textContent = `${Math.round(data.top * 3.6)} km/h`;
    $('fin-photo-wrap').classList.add('hidden');
    $('finish').classList.remove('hidden');
    $('fin-photo-btn').onclick = handlers.photo;
    $('fin-drive').onclick = handlers.drive;
    $('fin-restart').onclick = handlers.restart;
  }
  closeFinish() { $('finish').classList.add('hidden'); }
  get finishOpen() { return !$('finish').classList.contains('hidden'); }

  showPhoto(url) {
    $('fin-photo').src = url;
    $('fin-photo-wrap').classList.remove('hidden');
  }
}

export function fmtBuild(s) {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.round(s - m * 60)).padStart(2, '0')} min`;
}
