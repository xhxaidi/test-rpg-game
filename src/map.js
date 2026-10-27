// The map: cobbled paths (polylines with a radius) that everything is laid out around, the edge of the village and
// the wood beyond it, collision (boxes and circles), and the painted ground texture.
import * as THREE from 'three';
import { scene } from './stage.js';
import { clamp, smooth, hash, fbm, canvasTex } from './util.js';

const PATHS = [   // [radius, x, z, x, z, ...]
  [5.2, 0, 2],                                   // the plaza
  [2.4, 0.5, 6, -0.5, 14, 0.8, 22, 0, 33],         // south road, out into the wood
  [2.0, 1.2, 0, 2.8, -4.2],                        // to the shop steps
  [1.4, -3, 0, -3.3, -9, -3, -14],                 // alley up to the gate
  [2.3, -3, -16.4],                                // gate clearing
  [1.5, -4, 1, -11, -5.3],                         // to the timber house
  [1.6, 4, 3, 9, 4.5, 13, 6.6],                    // to the big house
  [1.7, 3, 9, 10, 9.6, 26, 9.4],                   // east road
  [1.4, -4, 4, -7.6, 6.4],                         // to the well
  [1.3, -2.5, 13, -4, 20.6, -9.5, 20.4],           // to the inn
  [1.2, 5, -2, 7, -6.5],                           // to the old carriage
];
const segDist = (x, z, ax, az, bx, bz) => {
  const dx = bx - ax, dz = bz - az, t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0, 1);
  return Math.hypot(x - ax - dx * t, z - az - dz * t);
};
export function pathAt(x, z) {   // < 0 on the cobbles, ragged edge
  let d = 1e9;
  for (const [r, ...p] of PATHS) {
    if (p.length === 2) d = Math.min(d, Math.hypot(x - p[0], z - p[1]) - r);
    else for (let i = 0; i + 3 < p.length; i += 2) d = Math.min(d, segDist(x, z, p[i], p[i + 1], p[i + 2], p[i + 3]) - r);
  }
  const patch = (fbm(x * 0.7 + 20, z * 0.7 - 7) - 0.67) * 7;     // > 0: a patch of grass left in the paving
  return Math.max(d + (fbm(x * 0.5 + 3, z * 0.5) - 0.5) * 1.4, patch);
}
export const onGrass = (x, z) => pathAt(x, z) > 0.3;
export const outside = (x, z) => Math.max(Math.abs(x) - 18, -20.5 - z, z - 26);   // > 0 beyond the village, in the wood
export const boxes = [], circles = [];            // [x0, z0, x1, z1], [x, z, r]
export const blocked = (x, z, r = 0) => boxes.some(([a, b, c, d]) => x > a - r && x < c + r && z > b - r && z < d + r)
  || circles.some(([cx, cz, cr]) => Math.hypot(x - cx, z - cz) < cr + r);
export function collide(p, r, bound = true) {
  for (const [x0, z0, x1, z1] of boxes) {
    const cx = clamp(p.x, x0, x1), cz = clamp(p.z, z0, z1), dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    if (d2 > 1e-8) { const d = Math.sqrt(d2), k = (r - d) / d; p.x += dx * k; p.z += dz * k; continue; }
    const m = Math.min(p.x - x0, x1 - p.x, p.z - z0, z1 - p.z);   // inside: out the nearest side
    if (m === p.x - x0) p.x = x0 - r; else if (m === x1 - p.x) p.x = x1 + r; else if (m === p.z - z0) p.z = z0 - r; else p.z = z1 + r;
  }
  for (const [x, z, cr] of circles) {
    const dx = p.x - x, dz = p.z - z, d = Math.hypot(dx, dz), m = cr + r;
    if (d < m && d > 1e-6) { p.x = x + dx / d * m; p.z = z + dz / d * m; }
  }
  if (bound) { p.x = clamp(p.x, -17.5, 17.5); p.z = clamp(p.z, -19.6, 26); }
}

// ---- ground: cobbles (cell noise, lit from the top-left), dirt fringe, grass in swathes, darker forest floor ----
const G0X = -32, G0Z = -32, GW = 64, GD = 70, GT = 13;
const groundTex = canvasTex(GW * GT, GD * GT, (g, w, h) => {
  const img = g.createImageData(w, h), S = 0.43;
  const STONES = [[165, 154, 134], [179, 168, 145], [150, 139, 120], [138, 128, 112], [188, 177, 154], [157, 148, 128]];
  const GR = [[61, 90, 38], [74, 106, 44], [88, 122, 50], [104, 138, 56], [122, 154, 64]];
  for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
    const x = G0X + (px + 0.5) / GT, z = G0Z + (py + 0.5) / GT, r = Math.random();
    const pd = pathAt(x, z), out = outside(x, z);
    let c;
    if (pd < 0.25 + r * 0.15) {
      const cx = Math.floor(x / S), cz = Math.floor(z / S);
      let d1 = 9, d2 = 9, id = 0, ox = 0, oz = 0;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
        const gx = cx + i, gz = cz + j, sx = (gx + 0.15 + 0.7 * hash(gx, gz)) * S, sz = (gz + 0.15 + 0.7 * hash(gz + 17, gx)) * S;
        const d = Math.hypot(x - sx, z - sz);
        if (d < d1) { d2 = d1; d1 = d; id = hash(gx * 3 + 1, gz * 7 + 2); ox = x - sx; oz = z - sz; } else if (d < d2) d2 = d;
      }
      const moss = fbm(x * 0.6 + 11, z * 0.6) + pd * 0.3;
      if (d2 - d1 < 0.09) c = moss > 0.6 ? [78, 98, 46] : [84, 76, 64];
      else if (pd > 0 && hash(cx, cz) < 0.45) c = [118, 94, 66];                       // stones thin out into dirt
      else {
        c = STONES[id * STONES.length | 0].slice();
        const k = 1 - (ox + oz) * 0.45 + (r - 0.5) * 0.04;                             // rounded, lit from the top-left
        c = c.map(v => v * k);
        if (moss > 0.66 && id < 0.4) c = [c[0] * 0.75, c[1] * 0.9, c[2] * 0.6];
      }
    } else if (pd < 0.6 + r * 0.2) c = r < 0.4 ? [116, 92, 64] : r < 0.7 ? [104, 82, 58] : [126, 102, 70];
    else {
      const k = fbm(x * 0.32 + 40, z * 0.32) + (r - 0.5) * 0.18;
      c = GR[clamp(Math.floor(k * 6.2 - 1), 0, 4)].slice();
      if (out > 0) { const f = 1 - 0.35 * smooth(out, 0, 6); c = [c[0] * f * 1.05, c[1] * f, c[2] * f * 0.9]; }
    }
    img.data.set([c[0], c[1], c[2], 255], (py * w + px) * 4);
  }
  g.putImageData(img, 0, 0);
  const FL = ['#f3ecd2', '#ffd75e', '#ff9a48', '#f0f0e0', '#e8584a'];      // painted flower specks in the grass
  for (let i = 0; i < 900; i++) {
    const x = G0X + Math.random() * GW, z = G0Z + Math.random() * GD;
    if (pathAt(x, z) < 1 || outside(x, z) > 3) continue;
    g.fillStyle = FL[Math.random() * FL.length | 0];
    for (let k = 0; k < 4 + Math.random() * 6; k++) g.fillRect((x - G0X) * GT + (Math.random() - 0.5) * 9 | 0, (z - G0Z) * GT + (Math.random() - 0.5) * 9 | 0, 1, 1);
  }
});
const ground = new THREE.Mesh(new THREE.PlaneGeometry(GW, GD), new THREE.MeshLambertMaterial({ map: groundTex }));
ground.rotation.x = -Math.PI / 2; ground.position.set(G0X + GW / 2, 0, G0Z + GD / 2); ground.receiveShadow = true; scene.add(ground);
