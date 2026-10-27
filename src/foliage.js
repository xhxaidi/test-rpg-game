// Everything leafy, instanced and swaying in one shared wind: the blobs the builders placed (tree canopies, bushes,
// hedges, ivy), ~11000 grass tufts that part around whoever walks through them (PUSHERS), and the little flowers.
import * as THREE from 'three';
import { scene } from './stage.js';
import { V, R, rnd, pick, smooth, TIME, hash, fbm } from './util.js';
import { pathAt, outside, blocked } from './map.js';
import { lam, blobs, petals, petal } from './builders.js';

// ---- wind for everything leafy: windAt() is the world sway of a point h above the ground at ip; toLocal() turns
// a world offset into the instance's own (scaled) axes ----
const WIND = `uniform float time;
  vec3 windAt(vec3 ip, float h) {
    float gust = 0.6 + 0.4 * sin(time * 0.6 + ip.x * 0.15 + ip.z * 0.1);
    return vec3(0.85, 0.0, 0.5) * h * gust * (0.28 + 0.16 * sin(time * 2.1 + dot(ip.xz, vec2(0.9, 0.6))));
  }
  vec3 toLocal(vec3 w) {
    return vec3(dot(instanceMatrix[0].xyz, w) / dot(instanceMatrix[0].xyz, instanceMatrix[0].xyz), 0.0,
                dot(instanceMatrix[2].xyz, w) / dot(instanceMatrix[2].xyz, instanceMatrix[2].xyz));
  }
`;
const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), e4 = new THREE.Euler(), c4 = new THREE.Color();
// foliage: lumpy icosahedra, smooth normals, a leafy pixel speckle in world space, swaying more higher up
{
  const geo = new THREE.IcosahedronGeometry(1, 2), p = geo.attributes.position, nrm = geo.attributes.normal;
  for (let i = 0; i < p.count; i++) {
    const v = V(p.getX(i), p.getY(i), p.getZ(i)), k = 1 + 0.16 * (hash(v.x * 7 + v.z * 3, v.y * 5) - 0.5);
    p.setXYZ(i, v.x * k, v.y * k, v.z * k); v.normalize(); nrm.setXYZ(i, v.x, v.y, v.z);
  }
  const mat = lam(0xffffff);
  mat.onBeforeCompile = sh => {
    sh.uniforms.time = TIME;
    sh.vertexShader = WIND + 'varying vec3 vWp;\n' + sh.vertexShader
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec3 ip = instanceMatrix[3].xyz;
        transformed += toLocal(windAt(ip, 1.0) * 0.35 * smoothstep(0.4, 3.5, ip.y)) * (0.75 + 0.25 * position.y);`)
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        vWp = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;`);
    sh.fragmentShader = 'varying vec3 vWp;\n' + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
        diffuseColor.rgb *= 0.72 + 0.5 * fract(sin(dot(floor(vWp * 6.0), vec3(12.9898, 78.233, 37.719))) * 43758.5453);`);
  };
  const im = new THREE.InstancedMesh(geo, mat, blobs.length);
  blobs.forEach(([x, y, z, r, col, sy], i) => {
    im.setMatrixAt(i, m4.compose(V(x, y, z), q4.setFromEuler(e4.set(0, hash(x, z) * 6, 0)), V(r, r * sy, r)));
    im.setColorAt(i, c4.set(col));
  });
  im.castShadow = im.receiveShadow = true; scene.add(im);
}
// grass: tufts of four tapered blades, dark at the root, lit at the tip; they sway and part around whoever walks
// through them (pushers: the hero, the beetles and the cat, updated every frame)
export const PUSHERS = { value: Array.from({ length: 6 }, () => V(999, 0, 999)) };
{
  const pos = [], col = [], idx = [];
  for (const [bx, bz, a, hh] of [[0, 0, 0.2, 1], [0.07, 0.05, 1.4, 0.8], [-0.07, -0.03, 2.6, 0.9], [0.02, -0.07, 4.2, 0.7]]) {
    const base = pos.length / 3, ax = Math.cos(a), az = -Math.sin(a), lx = Math.sin(a), lz = Math.cos(a);
    for (let i = 0; i <= 3; i++) {
      const v = i / 3, w = 0.04 * (1 - v * 0.9), off = 0.22 * v * v, c = 0.42 + 0.68 * v;
      for (const s of [-1, 1]) { pos.push(bx + ax * w * s + lx * off, v * hh, bz + az * w * s + lz * off); col.push(c * (1 + 0.2 * v), c, c * (1 - 0.3 * v)); }
      if (i < 3) { const b = base + i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map((_, k) => k % 3 === 1 ? 1 : 0), 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  mat.onBeforeCompile = sh => {
    sh.uniforms.time = TIME; sh.uniforms.pushers = PUSHERS;
    sh.vertexShader = WIND + 'uniform vec3 pushers[6];\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec3 ip = instanceMatrix[3].xyz, pw = vec3(0.0);
      for (int i = 0; i < 6; i++) {
        vec2 d = ip.xz - pushers[i].xz; float l = length(d);
        pw += vec3(d.x, 0.0, d.y) / max(l, 1e-3) * 0.45 * smoothstep(0.95, 0.15, l);
      }
      transformed += toLocal(windAt(ip, 1.0) * 0.45 + pw) * position.y * position.y;`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n  normal = normalize(vNormal);');
  };
  const tufts = [];
  for (let k = 0; tufts.length < 11000 && k < 90000; k++) {
    const x = R(-27, 27), z = R(-27, 33), pd = pathAt(x, z);
    if (pd < 0.2 || blocked(x, z, 0.15) || outside(x, z) > 7) continue;
    const dens = fbm(x * 0.22 + 9, z * 0.22);
    if (rnd() > dens * 1.25 - 0.1) continue;
    tufts.push([x, z, (0.22 + 0.42 * dens + R(0, 0.12)) * smooth(pd, 0.2, 1.0), R(1.1, 1.8)]);
  }
  const GREENS = ['#5a8236', '#6c9440', '#4c7230', '#7c9c44', '#8aa048', '#a8a850'];
  const im = new THREE.InstancedMesh(geo, mat, tufts.length);
  tufts.forEach(([x, z, h, s], i) => {
    im.setMatrixAt(i, m4.compose(V(x, 0, z), q4.setFromEuler(e4.set(0, R(0, 6.28), 0)), V(s, h, s)));
    im.setColorAt(i, c4.set(GREENS[rnd() < 0.12 ? 5 : rnd() * 5 | 0]));
  });
  im.receiveShadow = true; scene.add(im);
}
// little flower clusters in the grass (one colour per cluster), plus every petal placed by the builders
{
  for (let k = 0, n = 0; n < 150 && k < 3000; k++) {
    const x = R(-20, 20), z = R(-21, 28);
    if (pathAt(x, z) < 0.8 || blocked(x, z, 0.3)) continue;
    n++; const col = pick(['#f3ecd2', '#ffd75e', '#ff9a48', '#f3ecd2', '#e8584a', '#b893e0']);
    for (let i = 0, m = 4 + (rnd() * 6 | 0); i < m; i++) petal(x + R(-.35, .35), R(0.28, 0.48), z + R(-.3, .3), R(0.045, 0.06), col);
  }
  const mat = lam(0xffffff);
  mat.onBeforeCompile = sh => {
    sh.uniforms.time = TIME;
    sh.vertexShader = WIND + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec3 ip = instanceMatrix[3].xyz; transformed += toLocal(windAt(ip, 1.0) * 0.12 * min(ip.y * 3.0, 1.0));`);
  };
  const im = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), mat, petals.length);
  petals.forEach(([x, y, z, s, col], i) => {
    im.setMatrixAt(i, m4.compose(V(x, y, z), q4.identity(), V(s, s * 0.7, s)));
    im.setColorAt(i, c4.set(col));
  });
  im.castShadow = true; scene.add(im);
}
