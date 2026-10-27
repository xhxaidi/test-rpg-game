// Builders for the village: mesh helpers and shared materials, the leafy blobs and little flowers that are
// instanced later (foliage.js), and one function per kind of thing: house, tree, bush, hedge, barrel, crate, pot,
// lantern, sign. Builders also register collision (map.js) and things you can talk to (interact).
import * as THREE from 'three';
import { scene } from './stage.js';
import { V, V2, R, rnd, pick, lerp, uvScale, canvasTex } from './util.js';
import { TILE, STONE, PLANK, facade } from './textures.js';
import { boxes, circles } from './map.js';

export const lam = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, ...o });
export function mesh(geo, mat, x = 0, y = 0, z = 0, parent = scene) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m;
}
export const cap = (r, len) => new THREE.CapsuleGeometry(r, len, 3, 8);
export const IRON = lam(0x2a2622), WOOD = lam(0xffffff, { map: PLANK }), STONE_M = lam(0xffffff, { map: STONE }), DARKWOOD = lam(0x3b2a1e);
export const blobs = [], petals = [];            // instanced later: leafy blobs and little flowers
export const blob = (x, y, z, r, col, sy = 1) => blobs.push([x, y, z, r, col, sy]);
export const petal = (x, y, z, s, col) => petals.push([x, y, z, s, col]);
const LEAF = ['#3f6a2a', '#4d7a30', '#5a8a36', '#36592a', '#6b9440', '#4a7032'];
export const IVY = ['#36592a', '#3f6a2a', '#2f4f26', '#4a7032'];
export const BLOOM = ['#e8584a', '#ff8fa0', '#ffd75e', '#f3ecd2', '#ff9a48', '#c77be0'];
export const chimneys = [], interact = [];       // smoke sources; things you can walk up to and talk to (E)

function pentagon(w, h, rise) {
  const g = new THREE.ShapeGeometry(new THREE.Shape([V2(-w / 2, 0), V2(w / 2, 0), V2(w / 2, h), V2(0, h + rise), V2(-w / 2, h)]));
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + w / 2) / w, p.getY(i) / (h + rise));
  return g;
}
export const houseMats = [];
export function house(o) {
  const { x, z, w, d, h, pitch = 0.8 } = o, OV = 0.45, gableFront = o.ridge === 'z';
  const hs = (gableFront ? w : d) / 2, rise = hs * Math.tan(pitch);
  mesh(new THREE.BoxGeometry(w, h, d), lam(o.plaster || 0xe4d6b6), x, h / 2, z - d / 2);
  const fm = facade(w, h, { ...o, gable: gableFront ? rise : 0 }); houseMats.push(fm);
  mesh(gableFront ? pentagon(w, h, rise) : new THREE.PlaneGeometry(w, h).translate(0, h / 2, 0), fm, x, 0, z + 0.01).castShadow = false;
  // roof: two slabs of tiles meeting at a ridge cap (built with the ridge along x, turned for gable fronts)
  const roof = new THREE.Group(); roof.position.set(x, h, z - d / 2); if (gableFront) roof.rotation.y = Math.PI / 2; scene.add(roof);
  const span = hs + OV, sl = span / Math.cos(pitch), len = (gableFront ? d : w) + OV * 2;
  const rm = lam(o.roof || 0xffffff, { map: TILE });
  for (const s of [-1, 1]) {
    const m = mesh(uvScale(new THREE.BoxGeometry(len, 0.14, sl), len / 3.8, sl / 3.8), rm, 0, rise - span * Math.tan(pitch) / 2, s * span / 2, roof);
    m.rotation.x = s * pitch;
  }
  mesh(new THREE.BoxGeometry(len, 0.16, 0.24), lam(0x6e2e24), 0, rise + 0.07, 0, roof);
  if (o.chimney) {
    const [cx, cz, cw = 0.7] = o.chimney, top = h + rise + (o.chimney[3] || 0.8);
    mesh(uvScale(new THREE.BoxGeometry(cw, top - h + 0.5, cw), cw / 2.5, (top - h) / 2.5), STONE_M, x + cx, (top + h - 0.5) / 2, z - d / 2 + cz);
    mesh(new THREE.BoxGeometry(cw + 0.16, 0.12, cw + 0.16), lam(0x5a5248), x + cx, top, z - d / 2 + cz);
    chimneys.push(V(x + cx, top + 0.1, z - d / 2 + cz));
  }
  // flower boxes, door step, ivy hanging from the eaves and climbing the corners
  for (const [cx, y, ww, , , fb] of o.wins) if (fb) {
    mesh(new THREE.BoxGeometry(ww + 0.25, 0.2, 0.26), DARKWOOD, x + cx, y - 0.2, z + 0.14);
    const col = pick(BLOOM);
    for (let i = 0; i < 9; i++) petal(x + cx + R(-ww / 2, ww / 2), y - 0.04 + R(0, 0.1), z + 0.16 + R(-0.06, 0.08), R(0.06, 0.09), rnd() < 0.7 ? col : pick(BLOOM));
    for (let i = 0; i < 3; i++) blob(x + cx + R(-ww / 2, ww / 2), y - 0.08, z + 0.2, R(0.12, 0.18), pick(IVY));
  }
  if (o.door) {
    mesh(uvScale(new THREE.BoxGeometry(o.door[1] + 0.5, 0.14, 0.5), 0.6, 0.2), STONE_M, x + o.door[0], 0.07, z + 0.25);
    if (o.talk) interact.push({ p: V(x + o.door[0], 0, z + 0.7), r: 1.3, label: o.talk[0], talk: () => o.talk });
  }
  const side = rnd() < 0.5 ? -1 : 1;
  for (let i = 0; i < (o.ivy ?? 12); i++) {          // one corner climbs, the other gets a hanging tuft or two
    const climb = i < (o.ivy ?? 12) * 0.7, s = climb ? side : -side;
    const ix = x + s * (w / 2 - R(0, climb ? 0.6 : 1.4)), iy = climb ? R(0.2, h) * R(0.6, 1) : h - R(0.1, 0.7);
    blob(ix, iy, z + R(0.05, 0.25), R(0.18, 0.36), pick(IVY));
    if (rnd() < 0.3) petal(ix + R(-.2, .2), iy + R(-.1, .2), z + 0.36, 0.07, pick(BLOOM));
  }
  boxes.push([x - w / 2, z - d, x + w / 2, z]);
}
export function tree(x, z, s = 1, trunk = true, tint = 0) {
  const H = (2.8 + rnd() * 1.2) * s;
  if (trunk) { mesh(new THREE.CylinderGeometry(0.16 * s, 0.26 * s, H, 7), lam(0x5a4030), x, H / 2, z); circles.push([x, z, 0.35 * s]); }
  const autumn = tint > 0.86 ? ['#8a8a3a', '#a07a30', '#7a8a34'] : LEAF;
  blob(x, H + 0.3 * s, z, 1.45 * s, pick(autumn), 0.85);
  for (let i = 0, n = 11 + (rnd() * 6 | 0); i < n; i++) {
    const a = rnd() * 6.28, r = Math.sqrt(rnd()) * 1.55 * s, up = R(-0.6, 0.9) * s;
    blob(x + Math.cos(a) * r, H + up, z + Math.sin(a) * r * 0.85, R(0.55, 0.95) * s * (1 - 0.25 * r / (1.55 * s)), pick(autumn), 0.9);
  }
  trees.push(V(x, H, z));
}
export const trees = [];                         // tree tops, where falling leaves come from
export const bush = (x, z, s = 1, flowers = 0) => {
  for (let i = 0; i < 3; i++) blob(x + R(-.4, .4) * s, 0.35 * s, z + R(-.3, .3) * s, R(0.4, 0.6) * s, pick(LEAF));
  const col = pick(BLOOM); for (let i = 0; i < flowers; i++) petal(x + R(-.6, .6) * s, R(0.55, 0.85) * s, z + R(-.2, .6) * s, 0.08, col);
};
export const hedge = (x0, z0, x1, z1) => { const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 0.55); for (let i = 0; i <= n; i++) blob(lerp(x0, x1, i / n) + R(-.1, .1), 0.45, lerp(z0, z1, i / n), R(0.45, 0.6), pick(LEAF), 1.1); };
const BARREL_GEO = uvScale(new THREE.LatheGeometry([[0.001, 0], [0.3, 0], [0.36, 0.22], [0.38, 0.45], [0.36, 0.68], [0.3, 0.9], [0.001, 0.9]].map(([a, b]) => V2(a, b)), 12), 3, 1);
export function barrel(x, z, s = 1) {
  const b = mesh(BARREL_GEO, WOOD, x, 0, z); b.scale.setScalar(s);
  for (const y of [0.18, 0.72]) mesh(new THREE.TorusGeometry(0.37, 0.025, 4, 14), IRON, 0, y, 0, b).rotation.x = Math.PI / 2;
  circles.push([x, z, 0.38 * s]);
}
export function crate(x, z, s = 0.7, y = 0) { mesh(uvScale(new THREE.BoxGeometry(s, s, s), s / 2, s / 2), WOOD, x, y + s / 2, z).rotation.y = R(-.3, .3); if (!y) circles.push([x, z, s * 0.6]); }
export function pot(x, z, s = 1) {
  mesh(new THREE.LatheGeometry([[0.001, 0], [0.16, 0], [0.22, 0.28], [0.26, 0.33], [0.001, 0.31]].map(([a, b]) => V2(a * s, b * s)), 10), lam(0xb0603e), x, 0, z);
  blob(x, 0.42 * s, z, 0.25 * s, pick(LEAF)); const c = pick(BLOOM);
  for (let i = 0; i < 6; i++) petal(x + R(-.2, .2) * s, (0.5 + R(0, .15)) * s, z + R(-.1, .2) * s, 0.07, c);
  circles.push([x, z, 0.25 * s]);
}
export const LAMP_GLASS = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.4, 2.0, 0.75) });
export const lamps = [];
export function lantern(x, z, h = 2.4) {
  mesh(new THREE.CylinderGeometry(0.05, 0.07, h, 6), IRON, x, h / 2, z);
  mesh(new THREE.CylinderGeometry(0.15, 0.2, 0.14, 8), IRON, x, 0.07, z);
  mesh(new THREE.BoxGeometry(0.24, 0.3, 0.24), LAMP_GLASS, x, h + 0.15, z).castShadow = false;
  mesh(new THREE.ConeGeometry(0.22, 0.18, 4).rotateY(Math.PI / 4), IRON, x, h + 0.39, z);
  for (const s of [-1, 1]) mesh(new THREE.BoxGeometry(0.03, 0.32, 0.03), IRON, x + s * 0.12, h + 0.15, z + 0.12);
  const L = new THREE.PointLight(0xffa04a, 9, 9, 1.5); L.position.set(x, h + 0.1, z); scene.add(L);
  lamps.push(L); circles.push([x, z, 0.2]);
}
export function sign(x, y, z, draw) {
  mesh(new THREE.BoxGeometry(0.06, 0.06, 0.7), IRON, x, y + 0.36, z + 0.33);
  const t = canvasTex(12, 10, draw);
  const m = [WOOD, WOOD, WOOD, WOOD, lam(0xffffff, { map: t }), WOOD];
  mesh(new THREE.BoxGeometry(0.72, 0.6, 0.06), m, x, y, z + 0.62);
}
