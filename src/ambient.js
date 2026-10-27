// Ambient life: fireflies near the greenery (teal ones by the well), dust motes in the light, falling leaves, chimney
// smoke, the well breathing motes, flickering lamps, windows and carriage eyes, the awning stirring, and slow sun shafts.
import * as THREE from 'three';
import { scene, CAM_DIR } from './stage.js';
import { V, C, R, rnd, pick, noise, canvasTex } from './util.js';
import { outside } from './map.js';
import { blobs, trees, chimneys, lamps, houseMats } from './builders.js';
import { awning, wellLight, carEyes } from './village.js';
import { cloud, glow, bits, puffs } from './fx.js';

const FIRE = 110, fireGeo = cloud(FIRE, 2), flies = [];
for (let k = 0; flies.length < FIRE && k < 5000; k++) {
  const b = blobs[(rnd() * blobs.length) | 0], near = rnd() < 0.15;
  const c = near ? V(-9.5 + R(-3, 3), 0, 3.5 + R(-3, 3)) : V(b[0] + R(-2, 2), 0, b[2] + R(-2, 2));
  if (outside(c.x, c.z) < 4) flies.push({ c, ph: rnd() * 6.28, w: R(0.6, 1.6), h: R(0.4, 2.2), teal: near });
}
const MOTES = 140, moteGeo = cloud(MOTES, 1), motes = Array.from({ length: MOTES }, () => ({ p: V(R(-14, 14), R(0.3, 4), R(-12, 12)), ph: rnd() * 6.28, w: R(1, 3) }));
const BEAM_TEX = canvasTex(64, 1, (g, w) => {
  for (let x = 0; x < w; x++) { const k = Math.sin(Math.PI * (x + 0.5) / w) ** 2 * 255 | 0; g.fillStyle = `rgb(${k},${k},${k})`; g.fillRect(x, 0, 1, 1); }
});
BEAM_TEX.magFilter = BEAM_TEX.minFilter = THREE.LinearFilter;
const RAY_DIR = V(-0.5, 0.82, -0.28).normalize(), VIEW_DIR = CAM_DIR.clone().negate();
const rays = Array.from({ length: 6 }, () => {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0), new THREE.MeshBasicMaterial({ map: BEAM_TEX, color: 0xffd49a, opacity: 0,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  m.frustumCulled = false; scene.add(m);
  return { m, axis: V(), life: rnd() * 10, dur: 1, peak: 0, ph: 0, off: V() };
});
function respawnRay(r) {
  r.off.set(R(-15, 15), 0, R(-11, 11));
  r.axis.copy(RAY_DIR).add(V(R(-.06, .06), 0, R(-.06, .06))).normalize();
  r.m.scale.set(R(0.4, 2.4), R(10, 16), 1);
  r.dur = R(7, 14); r.life = 0; r.peak = R(0.05, 0.11); r.ph = rnd() * 6;
}
rays.forEach(r => { respawnRay(r); r.life = rnd() * r.dur; });

const c4 = new THREE.Color(), m4 = new THREE.Matrix4();
export function updateAmbient(t, rdt, focus) {
  {
    const pos = fireGeo.attributes.position.array, col = fireGeo.attributes.color.array;
    flies.forEach((f, i) => {
      pos.set([f.c.x + Math.sin(t * 0.31 * f.w + f.ph) * 0.9 + Math.sin(t * 1.3 + f.ph) * 0.15, f.h + Math.sin(t * 0.5 * f.w + f.ph * 2) * 0.35, f.c.z + Math.cos(t * 0.27 * f.w + f.ph) * 0.9], i * 3);
      const k = Math.max(0, Math.sin(t * f.w + f.ph)) ** 3 * 1.8;
      col.set(f.teal ? [k * 0.4, k * 1.3, k * 1.1] : [k * 1.4, k * 1.1, k * 0.35], i * 3);
    });
    fireGeo.attributes.position.needsUpdate = fireGeo.attributes.color.needsUpdate = true;
    const mp = moteGeo.attributes.position.array, mc = moteGeo.attributes.color.array;
    motes.forEach((m, i) => {
      m.p.y += rdt * 0.08; m.p.x += rdt * 0.12; if (m.p.y > 4.5) m.p.y = 0.3;
      const x = focus.x + ((m.p.x - focus.x + 15) % 30 + 30) % 30 - 15, z = focus.z + ((m.p.z - focus.z + 12) % 24 + 24) % 24 - 12;
      mp.set([x, m.p.y, z], i * 3);
      const k = 0.35 + 1.6 * Math.max(0, Math.sin(t * m.w + m.ph)) ** 8;
      mc.set([k * 0.6, k * 0.5, k * 0.3], i * 3);
    });
    moteGeo.attributes.position.needsUpdate = moteGeo.attributes.color.needsUpdate = true;
  }
  if (Math.random() < rdt * 2.5) {                       // a leaf lets go
    const tr = trees[(Math.random() * trees.length) | 0];
    if (Math.abs(tr.x - focus.x) < 16 && Math.abs(tr.z - focus.z) < 14)
      bits.emit(V(tr.x + (Math.random() - .5) * 2.5, tr.y, tr.z + (Math.random() - .5) * 2), V(0.4, 0, 0.2), c4.set(pick(['#c8a03a', '#d8782a', '#8aa048', '#b85a2a'])), 6, 0.35, 0.4, 1.2);
  }
  chimneys.forEach((c, i) => {
    if (Math.random() < rdt * 2.6) puffs.emit(V(c.x + (Math.random() - .5) * .2, c.y, c.z), V(0.35, 0.7, 0.1), 0.22 + Math.random() * 0.12, 3.2, pick([0x9a948c, 0x8a847e, 0xaaa49a]));
  });
  if (Math.random() < rdt * 1.5) glow.emit(V(-9.5 + R(-1.3, 1.3), 0.7, 3.5 + R(-1, 1)), V(0, 0.5, 0), C(0.4, 1.4, 1.2), 2.2, -0.05, 0.2);   // the well breathes motes
  lamps.forEach((L, i) => L.intensity = 9 * (0.88 + 0.12 * noise(t * 6, i * 7)));
  houseMats.forEach((m, i) => m.emissiveIntensity = 1.6 * (0.9 + 0.1 * noise(t * 2.5, i * 13)));
  carEyes.color.setRGB(0.6, 1.6, 1.5).multiplyScalar(noise(t * 4, 3) > 0.35 ? 1 : 0.15);
  wellLight.intensity = 4 + Math.sin(t * 1.7) * 0.8;
  awning.rotation.x = -Math.PI / 2 + 0.38 + Math.sin(t * 2.3) * 0.015;
}
// sun shafts follow the view around, each fading in and out and coming back somewhere else
export function updateRays(t, rdt, focus) {
  rays.forEach(r => {
    r.life += rdt; if (r.life > r.dur) respawnRay(r);
    r.m.position.set(focus.x + r.off.x, 0, focus.z + r.off.z);
    const zb = VIEW_DIR.clone().addScaledVector(r.axis, -VIEW_DIR.dot(r.axis)).normalize().negate();
    r.m.quaternion.setFromRotationMatrix(m4.makeBasis(V().crossVectors(r.axis, zb), r.axis, zb));
    r.m.material.opacity = r.peak * Math.sin(Math.PI * r.life / r.dur) ** 2 * (0.85 + 0.15 * Math.sin(t * 1.3 + r.ph));
  });
}
