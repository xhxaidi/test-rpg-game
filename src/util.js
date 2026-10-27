// Small shared helpers: vectors and colours, the seeded random used for the fixed village layout, value noise,
// canvas textures and the shared wind/shader clock.
import * as THREE from 'three';

export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const V2 = (x, y) => new THREE.Vector2(x, y);
export const C = (r, g, b) => new THREE.Color(r, g, b);
export const { clamp, smoothstep: smooth, lerp } = THREE.MathUtils;
export const rnd = (() => { let s = 20261025; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();   // fixed layout
export const R = (a, b) => a + (b - a) * rnd();
export const pick = a => a[rnd() * a.length | 0];
export const wrapA = a => Math.atan2(Math.sin(a), Math.cos(a));
export const TIME = { value: 0 };                // shader clock: wind, water, the gate's swirl

// ---- noise ----
export const hash = (x, y) => { const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return v - Math.floor(v); };
export function noise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export const fbm = (x, y) => noise(x, y) * 0.6 + noise(x * 2.3 + 5, y * 2.3) * 0.3 + noise(x * 5 + 9, y * 5) * 0.1;

// ---- textures (canvas) ----
export function canvasTex(w, h, draw, rep = false) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearMipmapLinearFilter;   // mipmapped so it doesn't sparkle
  if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
export const uvScale = (geo, su, sv) => { const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv); return geo; };
export function line(g, x0, y0, x1, y1, s = 2) { // crisp pixel line (canvas strokes antialias)
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) | 0;
  for (let i = 0; i <= n; i++) g.fillRect(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), s, s);
}
