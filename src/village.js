// The village, laid out after the reference: five houses, Maren's shop with its awning and glowing jars, the inn's
// sign and props, a bench and bird bath, the glowing well, the ivy-eaten old carriage, the sealed gate with its five
// runes, lanterns, trees, the wood all around, bushes, hedges, rocks and stumps.
import * as THREE from 'three';
import { scene } from './stage.js';
import { V, V2, R, rnd, pick, TIME, fbm, canvasTex, uvScale, line } from './util.js';
import { pathAt, outside, boxes, circles, blocked } from './map.js';
import { lam, mesh, IRON, WOOD, STONE_M, DARKWOOD, blob, petal, IVY, BLOOM, interact, house, tree, bush, hedge, barrel, crate, pot,
  lantern, sign } from './builders.js';

export let awning, wellLight, carEyes, gateLight;   // animated from the loop

house({ x: -10, z: -6, w: 10, d: 6, h: 4.6, ridge: 'x', pitch: 0.8, floors: [2.3], stone: 0.5, shutters: '#6f8a6a',
  door: [-1.2, 1.1, 1.95], chimney: [2.8, -1.4],
  wins: [[-3.6, .85, 1.1, 1.05, 1], [1.4, .85, 1.1, 1.05, 0], [3.6, .85, 1.0, 1.05, 1], [-3.6, 2.85, 1, 1, 0, 1], [-1.2, 2.85, 1, 1, 1, 1], [1.4, 2.85, 1, 1, 0, 1], [3.6, 2.85, 1, 1, 1, 1]],
  talk: ['Locked door', ['Through the keyhole: a table set for two, candles still burning.', 'The dust on the chairs is very thick.']] });
house({ x: 2, z: -5, w: 7, d: 6, h: 3.0, ridge: 'z', pitch: 0.85, stone: 0.35, plaster: '#ecdcbc', ivy: 8,
  door: [1.9, 1.1, 2.0], wins: [[-1.4, .7, 2.4, 1.3, 1], [0, 3.55, .8, .9, 1]] });
house({ x: 11.5, z: -12, w: 9, d: 7, h: 3.2, ridge: 'x', pitch: 0.75, curtains: '#4f7a4a', chimney: [-2.8, -2], roof: 0xf2d8cc,
  door: [2.4, 1.1, 1.95], wins: [[-2.8, .85, 1.3, 1.2, 1, 1], [-0.4, .85, 1.3, 1.2, 0, 1]],
  talk: ['Green door', ['A wreath of dried flowers hangs on the door.', 'Every flower in it is one that does not grow here.']] });
house({ x: 11, z: 6, w: 8, d: 9, h: 4.8, ridge: 'z', pitch: 0.8, floors: [2.4], stone: 0.6, shutters: '#7a6a8a', ivy: 16,
  door: [2.0, 1.2, 2.1], chimney: [-2.6, -2, 0.9, 1.0],
  wins: [[-2.0, .9, 1.4, 1.2, 1, 1], [-2.0, 3.0, 1.1, 1.05, 1, 1], [1.8, 3.0, 1.1, 1.05, 0, 1], [0, 5.5, .9, 1.0, 1]],
  talk: ['Note on the door', ['"Gone to look for the bell-ringer. Back by supper."', 'The paper is yellow and soft with age.']] });
house({ x: -10, z: 19, w: 10, d: 7, h: 3.6, ridge: 'x', pitch: 0.78, stone: 0.4, chimney: [-3.4, -2.2], roof: 0xf6dcd0,
  door: [0.6, 1.3, 2.1], wins: [[-3.6, .95, 1.5, 1.25, 1, 1], [-1.6, .95, 1.0, 1.25, 1], [3.2, .95, 1.8, 1.25, 1, 1]],
  talk: ['The Tired Lantern', ['The inn door is locked.', 'Inside, someone hums the same three notes. Over and over.']] });

// the shop's striped awning, goods table and glowing jars ("bottled embers")
{
  const AWN = canvasTex(16, 12, (g, w, h) => {
    for (let x = 0; x < w; x++) { g.fillStyle = (x >> 1) % 2 ? '#ece6d6' : '#8796a6'; g.fillRect(x, 0, 1, h - 2); }
    for (let x = 0; x < w; x++) if ((x >> 1) % 2) { g.fillStyle = (x >> 1) % 4 === 1 ? '#ece6d6' : '#8796a6'; g.fillRect(x, h - 2, 1, 1); }
  });
  AWN.wrapS = THREE.RepeatWrapping; AWN.repeat.x = 3;
  const a = mesh(new THREE.PlaneGeometry(7.4, 1.65), lam(0xffffff, { map: AWN, side: THREE.DoubleSide, alphaTest: 0.5 }), 2, 2.32, -4.25);
  a.rotation.x = -Math.PI / 2 + 0.38; awning = a;
  for (const s of [-1, 1]) mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.0, 5), DARKWOOD, 2 + s * 3.5, 1.0, -3.55);
  mesh(uvScale(new THREE.BoxGeometry(2.0, 0.1, 0.7), 1, 0.3), WOOD, -0.2, 0.78, -4.55);
  for (const [lx, lz] of [[-1.1, -4.8], [0.7, -4.8], [-1.1, -4.3], [0.7, -4.3]]) mesh(new THREE.BoxGeometry(0.08, 0.76, 0.08), DARKWOOD, lx, 0.38, lz);
  for (let i = 0; i < 7; i++) mesh(new THREE.SphereGeometry(0.07, 6, 5), lam(pick([0xc8382a, 0xd85a2a, 0x9aba3a])), -1 + R(0, 0.7), 0.88, -4.5 + R(-.2, .2));
  const JAR = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 1.3, 0.35) });
  for (let i = 0; i < 4; i++) mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.18, 6), JAR, 0.05 + i * 0.17, 0.92, -4.6 + (i % 2) * 0.12);
  boxes.push([-1.3, -5, 0.8, -4.1]);
  for (let i = 0; i < 3; i++) mesh(new THREE.SphereGeometry(0.28, 8, 6), lam(0xd8782a), 5.9 + i * 0.25, 0.2, -4.0 + (i % 2) * 0.4).scale.y = 0.7;
  crate(6.3, -3.4); crate(6.3, -3.4, 0.5, 0.7);
}
// signs and props by the inn
sign(-11.3, 2.5, 19, (g, w, h) => {
  g.fillStyle = '#6a4a2e'; g.fillRect(0, 0, w, h); g.fillStyle = '#3a2818'; g.fillRect(0, 0, w, 1); g.fillRect(0, h - 1, w, 1);
  g.fillStyle = '#e8d8b0'; g.fillRect(3, 3, 5, 5); g.fillRect(8, 4, 2, 1); g.fillRect(9, 4, 1, 3); g.fillRect(8, 6, 2, 1);
  g.fillStyle = '#ffffff'; g.fillRect(3, 2, 5, 1);
});
barrel(-14.3, 19.9); barrel(-13.6, 20.5, 0.9); crate(-5.2, 19.6); crate(-4.7, 20.2, 0.55); pot(-7.6, 19.6); pot(-6.9, 19.7, 0.8);
// steps and pots at the big house, a bench, the bird bath
pot(9.4, 6.5); pot(14.6, 6.5, 1.1); pot(4.6, -4.2, 0.9);
{
  mesh(uvScale(new THREE.BoxGeometry(1.7, 0.08, 0.45), 1, 0.3), WOOD, 8.6, 0.46, 7.3);
  mesh(uvScale(new THREE.BoxGeometry(1.7, 0.36, 0.06), 1, 0.3), WOOD, 8.6, 0.78, 7.08);
  for (const s of [-1, 1]) mesh(new THREE.BoxGeometry(0.08, 0.46, 0.4), DARKWOOD, 8.6 + s * 0.75, 0.23, 7.3);
  boxes.push([7.75, 7.05, 9.45, 7.55]);
  const bath = mesh(new THREE.LatheGeometry([[0.001, 0], [0.22, 0], [0.12, 0.12], [0.1, 0.55], [0.38, 0.66], [0.42, 0.78], [0.001, 0.72]].map(([a, b]) => V2(a, b)), 12), STONE_M, 5.6, 0, 7.2);
  circles.push([5.6, 7.2, 0.42]);
}
// the well: a stone cistern with a spout pillar, a beam and a hanging bucket; its water glows teal from below
const WATER = new THREE.ShaderMaterial({
  uniforms: { time: TIME, glow: { value: 1 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
  fragmentShader: `uniform float time, glow; varying vec2 vUv;
    void main(){
      vec2 p = vUv * vec2(9., 7.);
      float r = sin(p.x * 1.7 + time * 1.3 + sin(p.y * 2.1 + time)) + sin(p.y * 2.3 - time * 1.1 + sin(p.x * 1.3 - time * .7));
      vec3 c = mix(vec3(.004, .025, .035), vec3(.02, .1, .11), .5 + .25 * r) * glow;
      c += vec3(.4, .9, .8) * pow(max(0., r - 1.1), 2.) * .35;
      gl_FragColor = vec4(c, 1.);
    }`,
});
{
  const wx = -9.5, wz = 3.5, W = 3.6, Dp = 2.8, H = 0.85, T = 0.35;
  for (const [x, z, w, d] of [[0, -Dp / 2 + T / 2, W, T], [0, Dp / 2 - T / 2, W, T], [-W / 2 + T / 2, 0, T, Dp], [W / 2 - T / 2, 0, T, Dp]])
    mesh(uvScale(new THREE.BoxGeometry(w, H, d), w / 2.5, H / 2.5), STONE_M, wx + x, H / 2, wz + z);
  const water = mesh(new THREE.PlaneGeometry(W - T * 2, Dp - T * 2), WATER, wx, H - 0.15, wz); water.rotation.x = -Math.PI / 2; water.castShadow = false;
  mesh(uvScale(new THREE.BoxGeometry(0.9, 3.3, 0.9), 0.36, 1.3), STONE_M, wx - 1.15, 1.65, wz - 1.25);
  mesh(new THREE.BoxGeometry(1.05, 0.14, 1.05), lam(0x5a5248), wx - 1.15, 3.34, wz - 1.25);
  mesh(new THREE.BoxGeometry(0.16, 0.12, 0.4), STONE_M, wx - 1.15, 1.5, wz - 0.65);
  const stream = mesh(new THREE.PlaneGeometry(0.1, 0.8), WATER, wx - 1.15, 1.05, wz - 0.48); stream.castShadow = false;
  mesh(new THREE.BoxGeometry(0.16, 3.0, 0.16), DARKWOOD, wx + 1.6, 1.5, wz - 1.25);
  mesh(new THREE.BoxGeometry(3.0, 0.16, 0.16), DARKWOOD, wx + 0.2, 3.0, wz - 1.25);
  mesh(new THREE.CylinderGeometry(0.008, 0.008, 1.3, 3), IRON, wx + 0.5, 2.3, wz - 1.25);
  mesh(new THREE.CylinderGeometry(0.16, 0.13, 0.26, 8), WOOD, wx + 0.5, 1.55, wz - 1.25);
  boxes.push([wx - W / 2, wz - Dp / 2 - 0.4, wx + W / 2, wz + Dp / 2]);
  const L = new THREE.PointLight(0x5fe0d0, 4, 6, 1.6); L.position.set(wx, 1.4, wz); scene.add(L); wellLight = L;
  interact.push({ p: V(wx + 0.5, 0, wz + 1.9), r: 1.5, label: 'The well', talk: () => ['The well', ['The water glows faintly, from somewhere far below.', 'Your reflection moves half a second late.']] });
  barrel(wx - 2.4, wz + 2.7); barrel(wx + 2.5, wz + 3.1, 0.9); bush(wx - 2.9, wz - 1.5, 1, 5); bush(wx - 2.6, wz + 1.0, 0.8);
}
// the old carriage-without-horses, eaten by ivy; its glass eyes still flicker
{
  const RUST = canvasTex(64, 32, (g, w, h) => {
    g.fillStyle = '#4e6672'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const n = fbm(x * 0.12, y * 0.16) + Math.random() * 0.15;
      if (n > 0.62) { g.fillStyle = n > 0.72 ? '#6a3a22' : '#8a4a2a'; g.fillRect(x, y, 1, 1); }
      else if (Math.random() < 0.08) { g.fillStyle = '#5c7682'; g.fillRect(x, y, 1, 1); }
    }
  });
  const car = new THREE.Group(); car.position.set(6.4, 0, -8.6); car.rotation.y = 0.25; scene.add(car);
  const paint = lam(0xffffff, { map: RUST });
  mesh(new THREE.BoxGeometry(3.4, 0.7, 1.6), paint, 0, 0.6, 0, car);
  mesh(new THREE.BoxGeometry(1.9, 0.62, 1.45), paint, -0.25, 1.26, 0, car);
  mesh(new THREE.BoxGeometry(1.95, 0.42, 1.5), lam(0x1e2a30), -0.25, 1.26, 0, car).scale.set(0.97, 0.9, 1.01);
  for (const [x, z] of [[-1.1, 0.75], [1.1, 0.75], [-1.1, -0.75], [1.1, -0.75]]) mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.24, 10).rotateX(Math.PI / 2), lam(0x1a1816), x, 0.28, z, car);
  carEyes = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 1.6, 1.5) });
  for (const z of [-0.5, 0.5]) mesh(new THREE.SphereGeometry(0.11, 8, 6), carEyes, 1.7, 0.72, z, car);
  car.updateMatrixWorld();
  const at = (x, y, z) => V(x, y, z).applyMatrix4(car.matrixWorld);
  for (let i = 0; i < 14; i++) { const p = at(R(-1.6, 1.6), R(0.9, 1.6), R(-0.8, 0.8)); blob(p.x, p.y, p.z, R(0.22, 0.4), pick(IVY)); if (rnd() < 0.4) petal(p.x, p.y + 0.3, p.z + 0.1, 0.07, pick(BLOOM)); }
  for (const [x, z] of [[-1, 0], [1, 0]]) { const p = at(x, 0, z); circles.push([p.x, p.z, 0.95]); }
  interact.push({ p: at(0.4, 0, 1.6), r: 1.6, label: 'Old carriage', talk: () => ['Old carriage', ['A carriage with no horses, swallowed by ivy.', 'Its round glass eyes still flicker, now and then. Nobody here knows who rode in it.']] });
}
// the sealed gate behind the shop: a stone arch over a swirling dark, five runes that wake one ember at a time
// (what happens at the gate is in quest.js)
export const GX = -3, GZ = -17.6;
export const VOID = new THREE.ShaderMaterial({
  uniforms: { time: TIME, open: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
  fragmentShader: `uniform float time, open; varying vec2 vUv;
    void main(){
      vec2 p = vUv - vec2(.5, .38); float a = atan(p.y, p.x), r = length(p);
      float sw = .5 + .5 * sin(a * 3. + r * 16. - time * 1.4);
      vec3 dark = vec3(.015, .01, .04) + vec3(.22, .1, .42) * sw * exp(-r * 3.2) * (.6 + .4 * sin(time * .7));
      float spk = step(.992, fract(sin(dot(floor(vUv * vec2(22., 30.)), vec2(12.9898, 78.233))) * 43758.5453 + time * .05));
      dark += vec3(1.4, .8, .3) * spk;
      vec3 warm = vec3(3.6, 2.5, 1.3) * (1.1 - r * .9) + vec3(1.) * sw * .4;
      gl_FragColor = vec4(mix(dark, warm, open), 1.);
    }`,
});
export const runes = [];
{
  const outer = new THREE.Shape([V2(-2.3, 0), V2(2.3, 0), V2(2.3, 4.6), V2(-2.3, 4.6)]);
  const hole = new THREE.Path(); hole.moveTo(-1.1, 0); hole.lineTo(1.1, 0); hole.lineTo(1.1, 2.5); hole.absarc(0, 2.5, 1.1, 0, Math.PI, false); hole.lineTo(-1.1, 0);
  outer.holes.push(hole);
  const geo = uvScale(new THREE.ExtrudeGeometry(outer, { depth: 0.9, bevelEnabled: false }).translate(0, 0, -0.45), 0.4, 0.4);
  mesh(geo, STONE_M, GX, 0, GZ);
  mesh(uvScale(new THREE.BoxGeometry(5.0, 0.4, 1.2), 2, 0.2), STONE_M, GX, 4.8, GZ);
  const vg = new THREE.ShapeGeometry(new THREE.Shape(hole.getPoints(16)));
  const p = vg.attributes.position, uv = vg.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + 1.1) / 2.2, p.getY(i) / 3.6);
  mesh(vg, VOID, GX, 0, GZ).castShadow = false;
  const GLYPHS = [[0, 0, 2, 4], [0, 2, 4, 2], [2, 0, 0, 4], [0, 0, 4, 4], [4, 0, 0, 4], [2, 0, 2, 4], [0, 4, 4, 0], [1, 1, 3, 3]];
  for (let i = 0; i < 5; i++) {
    const a = Math.PI * (0.1 + 0.2 * i), x = Math.cos(a) * 1.6, y = 2.5 + Math.sin(a) * 1.6;
    const t = canvasTex(6, 6, g => { g.fillStyle = '#fff'; for (let k = 0; k < 2; k++) { const [a, b, c, d] = GLYPHS[(i * 3 + k * 5) % GLYPHS.length]; line(g, a + 1, b + 1, c + 1, d + 1, 1); } });
    t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;    // thin strokes on a foreshortened face: no mip blur
    const m = new THREE.MeshBasicMaterial({ map: t, alphaTest: 0.5, color: 0x332820 });
    const r = mesh(new THREE.PlaneGeometry(0.55, 0.55), m, GX - x, y, GZ + 0.47); r.castShadow = false;
    runes.push({ m, lit: 0 });
  }
  gateLight = new THREE.PointLight(0x8a6cff, 3, 7, 1.5); gateLight.position.set(GX, 1.6, GZ + 0.9); scene.add(gateLight);
  boxes.push([GX - 2.3, GZ - 0.45, GX + 2.3, GZ + 0.45]);
  for (let i = 0; i < 10; i++) blob(GX + R(-2.4, 2.4), R(3.6, 5.0), GZ + R(0.2, 0.6), R(0.2, 0.42), pick(IVY));
  hedge(GX - 6, GZ + 4.2, GX - 3.2, GZ + 0.4); hedge(GX + 3.2, GZ + 0.4, GX + 5.6, GZ + 4.2);
  hedge(GX - 3.2, GZ - 0.1, GX - 2.5, GZ - 0.1); hedge(GX + 2.5, GZ - 0.1, GX + 3.2, GZ - 0.1);
  boxes.push([GX - 6.3, GZ - 0.3, GX - 2.3, GZ + 0.6], [GX + 2.3, GZ - 0.3, GX + 6, GZ + 0.6]);
}

// lanterns, trees, bushes, hedges, rocks and stumps
lantern(4.2, 10.4); lantern(-4.7, -5.4); lantern(-2.6, 17.6); lantern(-6.2, -14.6); lantern(9.2, -4.4);
for (const [x, z, s] of [[-15.6, -1.6, 1.1], [-16.2, 6.4, 1.2], [-14.2, 10.6, 1], [8, 14.2, 1.3], [12.6, 13.6, 1.2], [15.8, 18.4, 1.3],
  [9.8, 19.8, 1.25], [4.6, 22, 1], [16.2, -6.6, 1], [-9, -16.8, 1.15], [3.6, -18.2, 1.1], [-16.6, 14, 1], [6.8, 26.4, 1.1],
  [-6.5, 26.2, 1.2], [-13, 25.8, 1.2], [16.4, 1.2, 0.95], [-16.4, -12, 1.1], [-12.5, -19, 1.2], [8.8, -20.4, 1.1]]) tree(x, z, s, true, rnd());
for (let x = -34; x <= 34; x += 3.3) for (let z = -36; z <= 40; z += 3.3) {      // the wood all around
  const tx = x + R(-1.2, 1.2), tz = z + R(-1.2, 1.2), o = outside(tx, tz);
  if (o > 0.4 && o < 14 && pathAt(tx, tz) > 1.2) tree(tx, tz, R(1.0, 1.45), o < 3, rnd());
}
bush(-14.4, -5.0, 1, 6); bush(-5.6, -5.2, 0.8, 4); bush(7.6, 7.0, 0.9, 7); bush(15.3, 7.2, 1); bush(-15.4, 20.6, 1, 5); bush(-4.6, 12.2, 0.9, 5);
bush(13.2, 10.8, 1.1, 6); bush(17, 4.4, 1); bush(-6.4, -3.8, 0.8); bush(-1.4, -12.8, 0.9, 4); bush(15.4, -9.6, 1, 5); bush(5.8, 17.6, 1, 4);
hedge(-14.6, -5.3, -13.3, -5.3); hedge(13.2, -4.1, 15.2, -4.1);
const ROCK = lam(0x8a7a64), STUMP = lam(0x6a4a30);
for (let k = 0, n = 0; n < 26 && k < 800; k++) {
  const x = R(-17, 17), z = R(-19, 25);
  if (pathAt(x, z) < 1 || blocked(x, z, 1.2)) continue;
  n++;
  if (rnd() < 0.6) { const r = R(0.25, 0.6), m = mesh(new THREE.DodecahedronGeometry(r, 0), ROCK, x, r * 0.35, z); m.rotation.set(R(0, 3), R(0, 3), 0); m.scale.y = 0.6; circles.push([x, z, r * 0.8]); }
  else { mesh(new THREE.CylinderGeometry(0.32, 0.4, 0.4, 8), STUMP, x, 0.2, z); circles.push([x, z, 0.45]); }
}
