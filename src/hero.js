// The hero's moves: walking, the three-hit sword combo (two sweeps, then a spin with more reach and damage,
// auto-aimed at the nearest beetle), the roll (invulnerable), getting hurt, and going down and waking up in the square.
import * as THREE from 'three';
import { V, C, lerp, wrapA } from './util.js';
import { collide, onGrass } from './map.js';
import { hero, rig, walkPose } from './people.js';
import { feel, ARCS, bits, burst, grassBurst, dust } from './fx.js';
import { keys, hit } from './input.js';
import { hud, banner } from './quest.js';
import { beetles, hurtBeetle, clearBeetles } from './beetles.js';

const SWINGS = [
  { dur: 0.3, a0: -2.0, a1: 1.7, at: 0.07, reach: 1.75, dmg: 1, tilt: 0.25 },
  { dur: 0.3, a0: 1.7, a1: -2.0, at: 0.07, reach: 1.75, dmg: 1, tilt: -0.3 },
  { dur: 0.5, a0: -1.6, a1: -1.6 - Math.PI * 2, at: 0.13, reach: 2.15, dmg: 2, tilt: 0.12, spin: true },
];
let arcNext = 0;
const c4 = new THREE.Color();
function startAttack(i) {
  const h = hero, s = SWINGS[i];
  let best = null, bd = 3.4;                                          // aim at the nearest beetle in reach
  for (const b of beetles) if (b.state !== 'dead') { const d = b.pos.distanceTo(h.pos); if (d < bd) { bd = d; best = b; } }
  const ix = (keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0), iz = (keys.s || keys.arrowdown ? 1 : 0) - (keys.w || keys.arrowup ? 1 : 0);
  if (best) h.yaw = Math.atan2(best.pos.x - h.pos.x, best.pos.z - h.pos.z); else if (ix || iz) h.yaw = Math.atan2(ix, iz);
  Object.assign(h, { state: 'attack', t: 0, combo: i, queued: false, swung: false }); h.hits.clear();
  h.vel.set(Math.sin(h.yaw), 0, Math.cos(h.yaw)).multiplyScalar(i === 2 ? 3 : 5.5);
  const a = ARCS[arcNext++ % ARCS.length]; a.visible = true; h.arc = a;
  const u = a.material.uniforms;
  u.a0.value = s.a0; u.a1.value = s.a1; u.r0.value = s.reach * 0.45; u.r1.value = s.reach; u.prog.value = 0; u.fade.value = 1; u.tilt.value = s.tilt;
  a.position.set(h.pos.x, 0.78, h.pos.z); a.rotation.y = h.yaw;
  for (let k = 0; k < 4; k++) bits.emit(V(h.pos.x, 0.3, h.pos.z), V(Math.random() - .5, 1, Math.random() - .5), c4.set('#b8a888'), 0.3, 6, 3);
}
function swingHits(s) {
  const h = hero;
  for (const b of beetles) {
    if (b.state === 'dead' || h.hits.has(b)) continue;
    const dx = b.pos.x - h.pos.x, dz = b.pos.z - h.pos.z, d = Math.hypot(dx, dz);
    if (d > s.reach + b.r) continue;
    const rel = wrapA(Math.atan2(dx, dz) - h.yaw), lo = Math.min(s.a0, s.a1) - 0.35, hi = Math.max(s.a0, s.a1) + 0.35;
    if (!s.spin && (rel < lo || rel > hi)) continue;
    h.hits.add(b); hurtBeetle(b, s.dmg, V(dx, 0, dz).normalize());
  }
}
export function updateHero(dt, t) {
  const h = hero;
  h.inv = Math.max(0, h.inv - dt); h.flash = Math.max(0, h.flash - dt * 5); h.t += dt;
  let ix = (keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0), iz = (keys.s || keys.arrowdown ? 1 : 0) - (keys.w || keys.arrowup ? 1 : 0);
  const il = Math.hypot(ix, iz); if (il) { ix /= il; iz /= il; }
  const canAct = h.state === 'move' || (h.state === 'attack' && h.t > 0.1);
  if (dt && hit(['j', ' ']) && canAct) { if (h.state === 'attack') h.queued = true; else startAttack(0); }
  if (dt && hit(['k', 'shift']) && h.state !== 'roll' && h.state !== 'down' && h.state !== 'hurt') {
    if (il) h.yaw = Math.atan2(ix, iz);
    Object.assign(h, { state: 'roll', t: 0 }); h.inv = Math.max(h.inv, 0.4); dust(h.pos, 4);
    if (h.arc) h.arc.visible = false;
  }
  const fwd = V(Math.sin(h.yaw), 0, Math.cos(h.yaw));
  let k = 0;
  if (h.state === 'move') {
    h.vel.lerp(V(ix, 0, iz).multiplyScalar(4.8), 1 - Math.exp(-dt * 14));
    const sp = h.vel.length(); k = Math.min(1.1, sp / 4.8);
    if (sp > 0.3) h.yaw += wrapA(Math.atan2(h.vel.x, h.vel.z) - h.yaw) * (1 - Math.exp(-dt * 16));
    const before = Math.floor(h.phase / Math.PI); h.phase += sp * dt * 2.5;
    if (Math.floor(h.phase / Math.PI) !== before && sp > 2) { dust(h.pos, 1, 0.12); if (onGrass(h.pos.x, h.pos.z) && Math.random() < 0.5) grassBurst(h.pos, 2); }
  } else if (h.state === 'attack') {
    const s = SWINGS[h.combo], u = h.arc.material.uniforms, p = 1 - (1 - Math.min(1, h.t / (s.dur * 0.55))) ** 3;
    h.vel.multiplyScalar(Math.exp(-dt * 9));
    u.prog.value = p; u.fade.value = Math.max(0, 1 - Math.max(0, h.t - s.dur * 0.45) / (s.dur * 0.55));
    h.arc.position.set(h.pos.x, 0.78, h.pos.z);
    if (h.t >= s.at && !h.swung) { h.swung = true; swingHits(s); }
    if (h.t >= s.dur) {
      h.swung = false; h.arc.visible = u.fade.value > 0;
      if (h.queued && h.combo < 2) startAttack(h.combo + 1); else { h.state = 'move'; h.combo = 0; }
    }
  } else if (h.state === 'roll') {
    const u = h.t / 0.36;
    h.vel.copy(fwd).multiplyScalar(lerp(11, 4, u));
    h.pivot.rotation.x = Math.min(1, u) * Math.PI * 2;
    if (u >= 1) { h.state = 'move'; h.pivot.rotation.x = 0; dust(h.pos, 3); }
  } else if (h.state === 'hurt') {
    h.vel.multiplyScalar(Math.exp(-dt * 7));
    if (h.t > 0.3) h.state = 'move';
  } else if (h.state === 'down') {
    h.vel.set(0, 0, 0);
    h.pivot.rotation.z = lerp(h.pivot.rotation.z, Math.PI / 2, 1 - Math.exp(-dt * 6)); h.pivot.position.y = lerp(h.pivot.position.y, 0.2, 1 - Math.exp(-dt * 6));
    feel.fade = Math.min(1, h.t / 1.4);
    if (h.t > 2.4) {
      Object.assign(h, { state: 'move', hp: 5, inv: 2 }); h.pos.set(0.4, 0, 8); h.pivot.rotation.z = 0; h.pivot.position.y = 0.55;
      clearBeetles(); hud(); banner('The lamps carried you home.', 3);
    }
  }
  if (h.state !== 'down') feel.fade = Math.max(0, feel.fade - dt * 0.8);
  h.pos.addScaledVector(h.vel, dt); collide(h.pos, 0.32);
  h.g.rotation.y = h.yaw;
  walkPose(h, k, dt, t);
  // the sword rig: idle it hangs behind the right hand; in a swing it sweeps through the swing's angles
  if (h.state === 'attack') {
    const s = SWINGS[h.combo], p = 1 - (1 - Math.min(1, h.t / (s.dur * 0.55))) ** 3, phi = lerp(s.a0, s.a1, p);
    const twist = s.spin ? phi - s.a0 : phi * 0.22;
    h.body.rotation.y = twist; rig.rotation.set(0, phi - twist - Math.PI / 2, -0.12);
    h.legs[0].rotation.x = -0.4; h.legs[1].rotation.x = 0.35; h.body.rotation.x = 0.22;
  } else {
    h.body.rotation.y = lerp(wrapA(h.body.rotation.y), 0, 1 - Math.exp(-dt * 12));   // unwound after a spin
    rig.rotation.set(0, lerp(rig.rotation.y, -2.3 - Math.PI / 2 + 0.2 * k, 1 - Math.exp(-dt * 10)), lerp(rig.rotation.z, -1.05, 1 - Math.exp(-dt * 10)));
  }
  h.g.visible = h.inv <= 0 || h.state === 'roll' || Math.floor(h.inv * 14) % 2 === 0;
  h.mats.forEach(m => m.emissive.setRGB(h.flash, h.flash * 0.3, h.flash * 0.2));
}
export function hurtHero(from) {
  const h = hero; if (h.inv > 0 || h.state === 'down') return;
  h.hp--; h.inv = 1.2; h.flash = 1; feel.stop = 0.09; feel.shake = 0.45; feel.hurtFx = 1;
  h.vel.copy(h.pos).sub(from).setY(0).normalize().multiplyScalar(9);
  if (h.arc) h.arc.visible = false;
  burst(V(h.pos.x, 0.7, h.pos.z), 10, C(2.4, 0.5, 0.3), 5);
  if (h.hp <= 0) { Object.assign(h, { state: 'down', t: 0 }); banner('', 0.1); } else Object.assign(h, { state: 'hurt', t: 0 });
  hud();
}
