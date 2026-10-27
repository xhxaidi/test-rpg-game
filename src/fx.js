// Effects: particles (crisp spark streaks, glowing points, solid bits like leaves and grass clippings, dust and smoke
// puffs), the hero's slash arcs, flying shell debris, the light that flashes on a kill, and the "game feel" state:
// hit-stop, screen shake, the red hurt flash and the fade to black.
import * as THREE from 'three';
import { scene } from './stage.js';
import { V, C, pick } from './util.js';
import { onGrass } from './map.js';
import { lam } from './builders.js';

export const feel = { stop: 0, shake: 0, hurtFx: 0, fade: 1 };   // hit-stop seconds, shake, hurt flash, fade to black

// ---- particles: crisp spark streaks (lines), glowing points (additive), solid bits (leaves, grass), puffs ----
function streaks(n) {
  const pos = new Float32Array(n * 6), col = new Float32Array(n * 6), geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const obj = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  obj.frustumCulled = false; scene.add(obj);
  const P = Array.from({ length: n }, () => ({ p: V(), v: V(), life: 0, max: 1, c: new THREE.Color() })); let next = 0;
  return {
    emit(p, v, c, max) { const q = P[next++ % n]; q.p.copy(p); q.v.copy(v); q.c.copy(c); q.life = q.max = max; },
    update(dt) {
      P.forEach((q, i) => {
        if (q.life > 0) { q.life -= dt; q.v.y -= 6 * dt; q.v.multiplyScalar(1 - 4 * dt); q.p.addScaledVector(q.v, dt); }
        const k = Math.max(0, q.life / q.max);
        pos.set([q.p.x, q.p.y, q.p.z, q.p.x - q.v.x * 0.045, q.p.y - q.v.y * 0.045, q.p.z - q.v.z * 0.045], i * 6);
        col.set([q.c.r * k, q.c.g * k, q.c.b * k, q.c.r * k * 0.4, q.c.g * k * 0.4, q.c.b * k * 0.4], i * 6);
      });
      geo.attributes.position.needsUpdate = geo.attributes.color.needsUpdate = true;
    },
  };
}
export function cloud(n, size, additive = true) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  const obj = new THREE.Points(geo, new THREE.PointsMaterial({ size, sizeAttenuation: false, vertexColors: true,
    ...(additive ? { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false } : {}) }));
  obj.frustumCulled = false; scene.add(obj); return geo;
}
function dots(n, additive) {
  const geo = cloud(n, 2, additive), pos = geo.attributes.position.array, col = geo.attributes.color.array;
  const P = Array.from({ length: n }, () => ({ p: V(0, -99, 0), v: V(), life: 0, max: 1, c: new THREE.Color(), g: 0, drag: 0, sw: 0, ph: 0 })); let next = 0;
  return {
    emit(p, v, c, max, g = 9, drag = 1, sw = 0) { const q = P[next++ % n]; Object.assign(q, { life: max, max, g, drag, sw, ph: Math.random() * 6 }); q.p.copy(p); q.v.copy(v); q.c.copy(c); },
    update(dt, t) {
      P.forEach((q, i) => {
        if (q.life > 0) {
          q.life -= dt; q.v.y -= q.g * dt; q.v.multiplyScalar(1 - q.drag * dt); q.p.addScaledVector(q.v, dt);
          if (q.sw) q.p.x += Math.sin(t * 3 + q.ph) * q.sw * dt;
          if (q.p.y < 0.03) { q.p.y = 0.03; q.v.set(0, 0, 0); }
        }
        const k = q.life > 0 ? (additive ? Math.min(1, 2 * q.life / q.max) : 1) : 0;
        pos.set(k ? [q.p.x, q.p.y, q.p.z] : [0, -99, 0], i * 3);
        col.set([q.c.r * k, q.c.g * k, q.c.b * k], i * 3);
      });
      geo.attributes.position.needsUpdate = geo.attributes.color.needsUpdate = true;
    },
  };
}
export const sparks = streaks(260), glow = dots(400, true), bits = dots(500, false);
const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), c4 = new THREE.Color();
export const puffs = (() => {
  const N = 140, im = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), lam(0xffffff), N);
  im.castShadow = false; im.receiveShadow = true; im.frustumCulled = false; scene.add(im);
  const P = Array.from({ length: N }, () => ({ p: V(), v: V(), life: 0, max: 1, s: 1 })); let next = 0;
  for (let i = 0; i < N; i++) { im.setMatrixAt(i, m4.makeScale(0, 0, 0)); im.setColorAt(i, c4.set(0xffffff)); }
  return {
    emit(p, v, s, max, col) { const i = next++ % N, q = P[i]; q.p.copy(p); q.v.copy(v); q.s = s; q.life = q.max = max; im.setColorAt(i, c4.set(col)); im.instanceColor.needsUpdate = true; },
    update(dt) {
      P.forEach((q, i) => {
        if (q.life > 0) { q.life -= dt; q.p.addScaledVector(q.v, dt); q.v.multiplyScalar(1 - 1.5 * dt); }
        const u = 1 - Math.max(0, q.life) / q.max, s = q.life > 0 ? q.s * Math.sin(Math.PI * Math.min(1, u * 1.4 + 0.08)) ** 0.7 : 0;
        im.setMatrixAt(i, m4.compose(q.p, q4.identity(), V(s, s, s)));
      });
      im.instanceMatrix.needsUpdate = true;
    },
  };
})();
export function burst(p, n, col, speed, up = 1.5) {
  for (let i = 0; i < n; i++) sparks.emit(p, V(Math.random() - 0.5, Math.random() * up, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.5 + Math.random())), col, 0.25 + Math.random() * 0.25);
}
export function grassBurst(p, n) {
  if (!onGrass(p.x, p.z)) return;
  for (let i = 0; i < n; i++) bits.emit(V(p.x + (Math.random() - .5) * .6, 0.25, p.z + (Math.random() - .5) * .6),
    V((Math.random() - .5) * 3, 2 + Math.random() * 2.5, (Math.random() - .5) * 3), c4.set(pick(['#6c9440', '#8aa048', '#5a8236', '#a8a850'])), 0.7 + Math.random() * 0.5, 9, 2);
}
export const dust = (p, n = 3, s = 0.18) => { for (let i = 0; i < n; i++) puffs.emit(V(p.x + (Math.random() - .5) * .4, 0.1, p.z + (Math.random() - .5) * .4), V((Math.random() - .5) * 1.2, 0.5, (Math.random() - .5) * 1.2), s * (0.7 + Math.random() * 0.6), 0.5 + Math.random() * 0.3, 0xb8a888); };

// slash arcs: a swept ribbon whose head follows the blade and whose tail fades, bright toward its outer edge
export const ARCS = Array.from({ length: 3 }, () => {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 40, 1), new THREE.ShaderMaterial({
    uniforms: { a0: { value: 0 }, a1: { value: 1 }, r0: { value: 0.45 }, r1: { value: 1.5 }, prog: { value: 0 }, fade: { value: 0 }, tilt: { value: 0 }, col: { value: C(1.9, 1.3, 0.3) } },
    vertexShader: `uniform float a0, a1, r0, r1, tilt; varying vec2 vUv;
      void main(){ vUv = uv; float a = mix(a0, a1, uv.x), r = mix(r0, r1, uv.y);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(sin(a) * r, tilt * sin(a) * r, cos(a) * r, 1.); }`,
    fragmentShader: `uniform float prog, fade; uniform vec3 col; varying vec2 vUv;
      void main(){ float b = prog - vUv.x; if (b < 0.) discard;
        float k = exp(-b * 2.4) * smoothstep(min(0.92, 0.25 + b * 1.2), 1., vUv.y) * fade;   // a crescent thinning to its tail
        if (k < 0.05) discard;
        gl_FragColor = vec4(col * k, 1.); }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  }));
  m.frustumCulled = false; m.visible = false; scene.add(m); return m;
});

// shell halves knocked off dead beetles: tumble, bounce, sink
export const debris = [];
export function updateDebris(dt) {
  for (let i = debris.length - 1; i >= 0; i--) {
    const d = debris[i]; d.life -= dt;
    d.v.y -= 14 * dt; d.m.position.addScaledVector(d.v, dt); d.m.rotation.x += d.w.x * dt; d.m.rotation.y += d.w.y * dt; d.m.rotation.z += d.w.z * dt;
    if (d.m.position.y < 0.1) { d.m.position.y = 0.1; d.v.y *= -0.35; d.v.x *= 0.6; d.v.z *= 0.6; d.w.multiplyScalar(0.6); }
    if (d.life < 1) d.m.position.y -= dt * 0.3;
    if (d.life <= 0) { scene.remove(d.m); debris.splice(i, 1); }
  }
}

export const flash = new THREE.PointLight(0xffa040, 0, 7, 1.5); scene.add(flash);   // lights up a kill, fades fast
