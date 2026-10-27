// The people: person() builds a small figure of capsules and spheres with a cloak lathe open at the front. The hero
// (rust-red hooded cloak, orange hair, a lantern at the hip, a sword on a rig that sweeps around the shoulder), Maren
// the shopkeeper, the hooded stranger at the well, and the cat. Also how the NPCs idle and how the cat wanders.
import * as THREE from 'three';
import { scene } from './stage.js';
import { V, V2, R, clamp, lerp, wrapA } from './util.js';
import { blocked, collide, circles } from './map.js';
import { lam, mesh, cap, LAMP_GLASS } from './builders.js';

function person(o) {
  const g = new THREE.Group(), pivot = new THREE.Group(), body = new THREE.Group();
  pivot.position.y = 0.55; body.position.y = -0.55; g.add(pivot); pivot.add(body); scene.add(g);
  const M = c => lam(c), mats = [];
  const mm = c => { const m = M(c); mats.push(m); return m; };
  const legs = [-1, 1].map(s => {
    const p = new THREE.Group(); p.position.set(0.08 * s, 0.42, 0); body.add(p);
    mesh(cap(0.065, 0.2).translate(0, -0.15, 0), mm(o.pants), 0, 0, 0, p);
    mesh(new THREE.BoxGeometry(0.12, 0.1, 0.2), mm(o.boots), 0, -0.36, 0.03, p);
    return p;
  });
  mesh(cap(0.15, 0.2), mm(o.shirt), 0, 0.66, 0, body);
  const cloak = new THREE.Group(); cloak.position.set(0, 0.92, -0.01); body.add(cloak);
  const hem = o.long ? -0.9 : -0.56;
  mesh(new THREE.LatheGeometry([[0.1, 0.02], [0.2, -0.1], [0.25, -0.3], [o.long ? 0.3 : 0.29, hem]].map(([r, y]) => V2(r, y)), 14, o.long ? 0.3 : 0.65, Math.PI * 2 - (o.long ? 0.6 : 1.3)),
    mm(o.cloak), 0, 0, 0, cloak).material.side = THREE.DoubleSide;
  const head = new THREE.Group(); head.position.y = 1.07; body.add(head);
  mesh(new THREE.SphereGeometry(0.16, 14, 10), mm(o.skin), 0, 0, 0, head);
  if (o.hair) { const hm = mm(o.hair); mesh(new THREE.SphereGeometry(0.17, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), hm, 0, 0.02, -0.02, head);
    if (o.bun) mesh(new THREE.SphereGeometry(0.08, 8, 6), hm, 0, 0.12, -0.15, head); }
  if (o.hood) {
    mesh(new THREE.SphereGeometry(0.195, 14, 10, Math.PI / 2 + 0.85, Math.PI * 2 - 1.7, 0, Math.PI * 0.78), mm(o.cloak), 0, 0.01, -0.01, head).material.side = THREE.DoubleSide;
    mesh(new THREE.ConeGeometry(0.08, 0.2, 6).rotateX(-2.2), mm(o.cloak), 0, 0.14, -0.2, head);
  }
  const eyeM = o.eyes ? new THREE.MeshBasicMaterial({ color: o.eyes }) : mm(0x241a14);
  for (const s of [-1, 1]) mesh(new THREE.BoxGeometry(0.035, 0.05, 0.02), eyeM, s * 0.055, 0.0, 0.155, head);
  const arms = [-1, 1].map(s => {
    const p = new THREE.Group(); p.position.set(0.19 * s, 0.86, 0); body.add(p);
    mesh(cap(0.05, 0.2).translate(0, -0.13, 0), mm(o.cloak), 0, 0, 0, p);
    mesh(new THREE.SphereGeometry(0.05, 8, 6), mm(o.skin), 0, -0.3, 0, p);
    return p;
  });
  if (o.scale) g.scale.setScalar(o.scale);
  return { g, pivot, body, legs, arms, cloak, head, mats, pos: g.position, yaw: 0, phase: 0 };
}
export function walkPose(P, k, dt, t) {   // legs, arm swing, bob, lean, cloak trailing
  const s = Math.sin(P.phase);
  P.legs[0].rotation.x = s * 0.85 * k; P.legs[1].rotation.x = -s * 0.85 * k;
  P.arms[1].rotation.x = -s * 0.7 * k;
  if (!P.sword) P.arms[0].rotation.x = s * 0.7 * k;
  P.body.position.y = -0.55 + Math.abs(Math.cos(P.phase)) * 0.06 * k + 0.008 * Math.sin(t * 2.4);
  P.body.rotation.x = 0.16 * k;
  P.cloak.rotation.x = lerp(P.cloak.rotation.x, -0.12 - 0.35 * k + 0.05 * Math.sin(t * 3.1 + P.phase), 1 - Math.exp(-dt * 8));
}

// the hero: rust-red hooded cloak, orange hair, a lantern at the hip, a sword on a rig that sweeps around the shoulder
export const hero = person({ cloak: 0x8e3526, shirt: 0xd8c8a0, pants: 0x4a3a2c, boots: 0x2e2420, skin: 0xf0c8a8, hair: 0xc8642e, hood: true });
hero.pos.set(0.4, 0, 13.5); hero.yaw = Math.PI;
Object.assign(hero, { vel: V(), hp: 5, inv: 0, flash: 0, state: 'move', t: 0, combo: 0, queued: false, hits: new Set(), dir: V(0, 0, -1), sword: true });
hero.arms[0].visible = false;
export const rig = new THREE.Group(); rig.position.set(-0.17, 0.86, 0); rig.rotation.order = 'YXZ'; hero.body.add(rig);
{
  const sleeve = lam(0x8e3526), skin = lam(0xf0c8a8); hero.mats.push(sleeve, skin);
  mesh(cap(0.05, 0.18).rotateZ(Math.PI / 2), sleeve, 0.13, 0, 0, rig);
  mesh(new THREE.SphereGeometry(0.05, 8, 6), skin, 0.29, 0, 0, rig);
  mesh(new THREE.BoxGeometry(0.14, 0.035, 0.035), lam(0x3a2418), 0.3, 0, 0, rig);
  mesh(new THREE.BoxGeometry(0.03, 0.05, 0.22), lam(0xc9a36b), 0.38, 0, 0, rig);
  const BLADE = new THREE.MeshPhongMaterial({ color: 0xd8dce4, specular: 0xffffff, shininess: 80, emissive: 0x202428 });
  mesh(new THREE.BoxGeometry(0.78, 0.02, 0.065), BLADE, 0.79, 0, 0, rig);
  mesh(new THREE.ConeGeometry(0.033, 0.12, 4).rotateZ(-Math.PI / 2), BLADE, 1.24, 0, 0, rig);
  mesh(new THREE.BoxGeometry(0.12, 0.16, 0.1), lam(0x3a2a1e), 0.2, 0.52, 0.02, hero.body);
  mesh(new THREE.BoxGeometry(0.1, 0.12, 0.08), LAMP_GLASS, 0.22, 0.38, 0.02, hero.body).castShadow = false;
  const L = new THREE.PointLight(0xffb06a, 2.2, 4.5, 1.6); L.position.set(0.25, 0.5, 0.2); hero.body.add(L);
}

// NPCs: Maren the shopkeeper, the hooded stranger at the well, and a cat (what they say is in quest.js)
export const maren = person({ cloak: 0x5f7a4a, shirt: 0x7a4a3a, pants: 0x7a4a3a, boots: 0x3a2a20, skin: 0xe8c4a8, hair: 0xc8c4bc, bun: true, long: true, scale: 0.95 });
maren.pos.set(1.0, 0, -3.95); maren.yaw = 0.2;
export const stranger = person({ cloak: 0x2e2a48, shirt: 0x24203a, pants: 0x24203a, boots: 0x1a1820, skin: 0x17131e, hood: true, long: true, eyes: new THREE.Color(0.5, 2.4, 2.1), scale: 1.12 });
stranger.pos.set(-6.6, 0, 6.2); stranger.yaw = -2.4;
circles.push([1.0, -3.95, 0.35], [-6.6, 6.2, 0.4]);
export const cat = (() => {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body); scene.add(g);
  const fur = lam(0xd9893a), dark = lam(0x9a5420);
  mesh(cap(0.1, 0.26).rotateX(Math.PI / 2), fur, 0, 0.24, 0, body);
  const head = new THREE.Group(); head.position.set(0, 0.36, 0.24); body.add(head);
  mesh(new THREE.SphereGeometry(0.11, 10, 8), fur, 0, 0, 0, head);
  for (const s of [-1, 1]) {
    mesh(new THREE.ConeGeometry(0.04, 0.09, 4), dark, s * 0.06, 0.1, -0.01, head);
    mesh(new THREE.BoxGeometry(0.025, 0.025, 0.02), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.9, 2.0, 0.4) }), s * 0.045, 0.02, 0.1, head);
  }
  const legs = [[-1, 1], [1, 1], [-1, -1], [1, -1]].map(([sx, sz]) => {
    const p = new THREE.Group(); p.position.set(sx * 0.06, 0.18, sz * 0.13); body.add(p);
    mesh(cap(0.03, 0.12).translate(0, -0.09, 0), fur, 0, 0, 0, p); return p;
  });
  const tail = []; let par = body;
  for (let i = 0; i < 4; i++) {
    const p = new THREE.Group(); p.position.set(0, i ? 0.1 : 0.28, i ? 0 : -0.2); par.add(p);
    mesh(cap(0.025, 0.08).translate(0, 0.05, 0), i % 2 ? dark : fur, 0, 0, 0, p); tail.push(p); par = p;
  }
  g.position.set(-1.5, 0, 4);
  return { g, body, head, legs, tail, pos: g.position, yaw: 0, phase: 0, state: 'sit', t: 2, target: V(), sitK: 1 };
})();

// ---- the cat: trots between spots around the plaza, sits, comes to sit by you when you stand still ----
export function updateCat(dt, t) {
  const c = cat; c.t -= dt;
  const toHero = V().subVectors(hero.pos, c.pos).setY(0), dh = toHero.length();
  if (c.state === 'sit' && c.t <= 0) {
    if (dh < 6 && hero.vel.length() < 0.3 && Math.random() < 0.6) c.target.copy(hero.pos).add(V(Math.random() - .5, 0, 0.8 + Math.random() * 0.4));
    else c.target.set(R(-6, 6), 0, R(-2, 9));
    c.state = 'walk';
  }
  let sp = 0;
  if (c.state === 'walk') {
    const d = V().subVectors(c.target, c.pos).setY(0), l = d.length();
    if (l < 0.3 || blocked(c.target.x, c.target.z, 0.2)) { c.state = 'sit'; c.t = R(3, 8); }
    else { sp = 1.5; c.pos.addScaledVector(d, sp * dt / l); c.yaw += wrapA(Math.atan2(d.x, d.z) - c.yaw) * (1 - Math.exp(-dt * 8)); collide(c.pos, 0.2); }
  } else if (dh < 3) c.yaw += wrapA(Math.atan2(toHero.x, toHero.z) - c.yaw) * (1 - Math.exp(-dt * 3));
  c.sitK = lerp(c.sitK, c.state === 'sit' ? 1 : 0, 1 - Math.exp(-dt * 6));
  c.phase += sp * dt * 12;
  c.legs.forEach((L, i) => L.rotation.x = Math.sin(c.phase + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.6 * (sp > 0 ? 1 : 0) + (i > 1 ? c.sitK * -1.2 : 0));
  c.body.rotation.x = -c.sitK * 0.5; c.body.position.y = -c.sitK * 0.05;
  c.tail.forEach((p, i) => { p.rotation.x = i ? 0.35 : -0.6 - 0.4 * c.sitK; p.rotation.z = Math.sin(t * (c.sitK > 0.5 ? 1.5 : 4) + i * 0.8) * 0.3; });
  c.head.rotation.y = Math.sin(t * 0.4) * 0.4 * c.sitK;
  c.g.rotation.y = c.yaw;
}

// NPCs breathe, sway and turn their heads toward you; Maren waves when you're close
export function updateNPCs(t, rdt) {
  for (const P of [maren, stranger]) {
    const d = Math.hypot(hero.pos.x - P.pos.x, hero.pos.z - P.pos.z);
    const look = d < 4 ? clamp(wrapA(Math.atan2(hero.pos.x - P.pos.x, hero.pos.z - P.pos.z) - P.yaw), -1, 1) : 0;
    P.head.rotation.y = lerp(P.head.rotation.y, look, 1 - Math.exp(-rdt * 4));
    P.body.position.y = -0.55 + 0.008 * Math.sin(t * 1.8 + P.pos.x);
    P.body.rotation.z = 0.03 * Math.sin(t * 0.7 + P.pos.z);
    P.g.rotation.y = P.yaw;
  }
  maren.arms[0].rotation.x = -0.5 + (Math.hypot(hero.pos.x - maren.pos.x, hero.pos.z - maren.pos.z) < 3.5 ? -1.6 - 0.4 * Math.sin(t * 8) : 0);
  maren.arms[0].rotation.z = 0.2;
  stranger.arms.forEach(a => a.rotation.x = -0.15);
}
