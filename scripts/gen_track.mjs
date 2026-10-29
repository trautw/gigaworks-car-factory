// Generates the dense test-track centerline (src/data/track.json) from control points.
// Both the Blender track script and the game read the generated file.
import * as THREE from 'three';
import fs from 'fs';
const ctrl = [
  [127, -4], [170, -4], [215, -4], [246, 4], [263, 28], [257, 56], [234, 72],
  [205, 70], [188, 56], [168, 64], [146, 76], [116, 68], [98, 44], [102, 14]
];
const curve = new THREE.CatmullRomCurve3(ctrl.map(([x, z]) => new THREE.Vector3(x, 0, z)), true, 'centripetal');
const len = curve.getLength();
const N = Math.round(len / 2);
const pts = curve.getSpacedPoints(N).slice(0, N).map(p => [+p.x.toFixed(3), +p.z.toFixed(3)]);
// start line on the main straight
let start = 0, best = 1e9;
pts.forEach(([x, z], i) => { const d = Math.hypot(x - 160, z + 4); if (d < best) { best = d; start = i; } });
const rot = pts.slice(start).concat(pts.slice(0, start));
fs.writeFileSync(new URL('../src/data/track.json', import.meta.url), JSON.stringify({ width: 13, length: +len.toFixed(1), points: rot }));
console.log('track length', len.toFixed(1), 'points', rot.length);
