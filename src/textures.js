// Hand-painted canvas textures for the buildings: roof tiles, stone, planks, and facade() which paints a whole
// half-timbered house front (plus an emissive map so lit windows glow in the shade).
import * as THREE from 'three';
import { hash, canvasTex, line } from './util.js';

// roof tiles: staggered courses of terracotta, a dark shadow line under each course, lit lips, a little moss
export const TILE = canvasTex(48, 48, (g, w, h) => {
  const C = ['#b4523a', '#c2613f', '#a2473a', '#b85c44', '#c96f4a', '#9a4234', '#ad5a3c'];
  for (let r = 0; r < h / 4; r++) for (let k = -1; k <= w / 6; k++) {
    const x = k * 6 + (r % 2) * 3, y = r * 4;
    g.fillStyle = C[hash(k + 40, r) * C.length | 0]; g.fillRect(x, y, 6, 4);
    g.fillStyle = 'rgba(255,214,170,.3)'; g.fillRect(x + 1, y, 3, 1);
    g.fillStyle = 'rgba(80,20,10,.35)'; g.fillRect(x + 4, y + 1, 1, 2);
    g.fillStyle = '#5e2620'; g.fillRect(x + 5, y, 1, 4); g.fillRect(x, y + 3, 1, 1); g.fillRect(x + 4, y + 3, 1, 1);
    g.fillStyle = 'rgba(70,20,14,.6)'; g.fillRect(x + 1, y + 3, 3, 1);
  }
  for (let i = 0; i < 22; i++) { g.fillStyle = ['#6b7a3c', '#7d8a44', '#5a6634'][i % 3]; g.fillRect(hash(i, 3) * w | 0, hash(i, 9) * h | 0, 1 + (hash(i, 5) * 3 | 0), 1 + (hash(i, 7) * 2 | 0)); }
}, true);
export const STONE = canvasTex(36, 32, (g, w, h) => {
  const C = ['#8d8576', '#9b9282', '#7d766a', '#a39a88', '#867e70', '#938a7a'];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const row = y >> 2, bx = (x + (row % 2) * 3) % w, id = Math.floor(bx / 6);
    g.fillStyle = (bx % 6 === 0 || y % 4 === 3) ? '#4f483f' : C[hash(id, row) * C.length | 0];
    if (bx % 6 !== 0 && y % 4 === 0) g.fillStyle = '#aaa290';
    g.fillRect(x, y, 1, 1);
  }
  for (let i = 0; i < 30; i++) { g.fillStyle = Math.random() < .5 ? '#6a7444' : '#5c5448'; g.fillRect(Math.random() * w | 0, Math.random() * h | 0, 1, 1); }
}, true);
export const PLANK = canvasTex(32, 32, (g, w, h) => {
  for (let x = 0; x < w; x += 4) {
    g.fillStyle = ['#7a5434', '#6e4a2e', '#86603a', '#734e30'][(x / 4) % 4]; g.fillRect(x, 0, 4, h);
    g.fillStyle = '#3e2818'; g.fillRect(x + 3, 0, 1, h);
  }
  for (let i = 0; i < 60; i++) { g.fillStyle = 'rgba(40,24,12,.35)'; g.fillRect(Math.random() * w | 0, Math.random() * h | 0, 1, 2); }
}, true);

// one facade: plaster, half-timber frame and braces, stone plinth, windows (lit ones also go in an emissive map so
// they glow in the shade), doors and shutters. Coordinates are world units from the facade's centre-bottom.
const D = 14;                                      // texels per world unit on walls
export function facade(w, h, o) {
  const top = h + (o.gable || 0), W = Math.round(w * D), H = Math.round(top * D);
  const X = x => Math.round((x + w / 2) * D), Y = y => Math.round((top - y) * D);
  const ec = document.createElement('canvas'); ec.width = W; ec.height = H;
  const e = ec.getContext('2d'); e.fillStyle = '#000'; e.fillRect(0, 0, W, H);
  const map = canvasTex(W, H, g => {
    const f = (c, x, y, ww, hh) => { g.fillStyle = c; g.fillRect(X(x), Y(y + hh), Math.max(1, Math.round(ww * D)), Math.max(1, Math.round(hh * D))); };
    g.fillStyle = o.plaster || '#e4d6b6'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < W * H / 5; i++) { g.fillStyle = Math.random() < .5 ? 'rgba(120,100,70,.13)' : 'rgba(255,250,235,.16)'; g.fillRect(Math.random() * W | 0, Math.random() * H | 0, 1, 1); }
    for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(90,80,50,.1)'; g.fillRect(Math.random() * W | 0, Math.random() * H | 0, 4 + Math.random() * 12 | 0, 3 + Math.random() * 8 | 0); }
    const holes = [...o.wins.map(([cx, y, ww, hh]) => [cx - ww / 2 - 0.12, y - 0.1, cx + ww / 2 + 0.12, y + hh + 0.1]),
      ...(o.door ? [[o.door[0] - o.door[1] / 2 - 0.1, 0, o.door[0] + o.door[1] / 2 + 0.1, o.door[2] + 0.1]] : [])];
    const free = (x0, y0, x1, y1) => !holes.some(([a, b, c, d]) => x0 < c && x1 > a && y0 < d && y1 > b);
    const TB = 0.16, wood = o.wood || '#3b2a1e';
    // half timber: rails at the plinth, floors and eaves, posts, braces in the empty panels
    const rails = [o.stone || 0, ...(o.floors || []), h - TB];
    rails.forEach(y => f(wood, -w / 2, y, w, TB));
    const n = Math.max(2, Math.round(w / 1.3)), posts = Array.from({ length: n + 1 }, (_, i) => -w / 2 + i * (w - TB) / n);
    posts.forEach(x => f(wood, x, o.stone || 0, TB, h - (o.stone || 0)));
    g.fillStyle = wood;
    for (let r = 0; r < rails.length - 1; r++) for (let i = 0; i < n; i++) {
      const x0 = posts[i] + TB, x1 = posts[i + 1], y0 = rails[r] + TB, y1 = rails[r + 1];
      if (x1 - x0 > 0.4 && free(x0, y0, x1, y1) && hash(i + 3, r + o.x) < 0.75)
        (i + r) % 2 ? line(g, X(x0), Y(y0), X(x1) - 2, Y(y1)) : line(g, X(x0), Y(y1), X(x1) - 2, Y(y0));
    }
    if (o.gable) {                                   // gable: rafters along the roof line, king post, collar beam
      line(g, X(-w / 2), Y(h), X(0), Y(top) + 2, 2); line(g, X(w / 2) - 2, Y(h), X(0), Y(top) + 2, 2);
      f(wood, -0.08, h, TB, o.gable * 0.95);
      f(wood, -w * 0.28, h + o.gable * 0.45, w * 0.56, TB);
      line(g, X(-w * 0.22), Y(h + o.gable * 0.45), X(-0.1), Y(h), 2); line(g, X(w * 0.22), Y(h + o.gable * 0.45), X(0.1), Y(h), 2);
    }
    if (o.stone) {                                   // stone plinth
      for (let y = 0; y < o.stone * D; y++) for (let x = 0; x < W; x++) {
        const row = y / 4 | 0, bx = x + (row % 2) * 4, edge = bx % 8 === 0 || y % 4 === 3;
        g.fillStyle = edge ? '#5a5248' : ['#8f8778', '#9d9484', '#857d6e', '#a59c8a'][hash(bx >> 3, row) * 4 | 0];
        g.fillRect(x, H - 1 - y, 1, 1);
      }
    }
    for (let y = 0; y < 0.8 * D; y++) { g.fillStyle = `rgba(60,52,36,${0.28 * (1 - y / (0.8 * D))})`; g.fillRect(0, H - 1 - y, W, 1); }
    for (const [cx, y, ww, hh, lit] of o.wins) {     // windows
      const x0 = cx - ww / 2;
      if (o.shutters) { f(o.shutters, x0 - 0.36, y, 0.32, hh); f(o.shutters, x0 + ww + 0.04, y, 0.32, hh);
        g.fillStyle = 'rgba(0,0,0,.25)'; for (const sx of [x0 - 0.36, x0 + ww + 0.04]) for (let k = 1; k < 4; k++) g.fillRect(X(sx), Y(y + hh * k / 4), Math.round(0.32 * D), 1); }
      f('#2b1f16', x0 - 0.08, y - 0.08, ww + 0.16, hh + 0.16);
      f(lit ? '#ffc25e' : '#25323e', x0, y, ww, hh);
      if (lit) { f('#ffe2a4', x0 + ww * 0.25, y + hh * 0.2, ww * 0.5, hh * 0.55); e.fillStyle = '#ff9a3c'; e.fillRect(X(x0), Y(y + hh), Math.round(ww * D), Math.round(hh * D)); }
      else { g.fillStyle = '#4c6478'; line(g, X(x0) + 2, Y(y + hh) + 4, X(x0) + 4, Y(y + hh) + 2, 1); }
      if (o.curtains) { f(o.curtains, x0, y, ww * 0.22, hh); f(o.curtains, x0 + ww * 0.78, y, ww * 0.22, hh); }
      f('#2b1f16', cx - 0.04, y, 0.08, hh); f('#2b1f16', x0, y + hh * 0.55, ww, 0.07);
      f('#b9ae98', x0 - 0.14, y - 0.14, ww + 0.28, 0.08);
    }
    if (o.door) {                                    // arched plank door in a stone frame
      const [cx, ww, hh] = o.door, x0 = X(cx - ww / 2), x1 = X(cx + ww / 2), y1 = Y(0), yt = Y(hh), r = (x1 - x0) / 2;
      for (let y = yt - 2; y < y1; y++) for (let x = x0 - 2; x < x1 + 2; x++) {
        const ay = yt + r - y, inArch = ay <= 0 || Math.hypot(x - (x0 + r), ay) <= r, inFrame = ay <= 0 || Math.hypot(x - (x0 + r), ay) <= r + 2;
        if (inArch && x >= x0 && x < x1) g.fillStyle = (x - x0) % 4 === 3 ? '#3a2416' : ['#6a4228', '#5e3a22', '#744a2c'][((x - x0) >> 2) % 3];
        else if (inFrame) g.fillStyle = '#8a8070'; else continue;
        g.fillRect(x, y, 1, 1);
      }
      g.fillStyle = '#2a2420'; g.fillRect(x0, Y(hh * 0.3), x1 - x0, 1); g.fillRect(x0, Y(hh * 0.7), x1 - x0, 1);
      g.fillStyle = '#d8b46a'; g.fillRect(x1 - 4, Y(hh * 0.48), 2, 2);
    }
  });
  const emissiveMap = new THREE.CanvasTexture(ec);
  emissiveMap.colorSpace = THREE.SRGBColorSpace; emissiveMap.magFilter = THREE.NearestFilter;
  return new THREE.MeshLambertMaterial({ map, emissiveMap, emissive: 0xffffff, emissiveIntensity: 1.6 });
}
