// The beetles ("shellbacks"): glossy split shell, black head with stag mandibles, glowing amber eyes, six legs on a
// tripod gait. At most three at a time wander in from the wood, chase, rear up (wind-up), charge and recover; knocked
// back and flashed when hit; on death the shell halves fly off, the body flips and sinks, and an ember is left behind.
import * as THREE from 'three';
import { scene } from './stage.js';
import { V, C, R, pick, lerp, wrapA } from './util.js';
import { collide } from './map.js';
import { mesh, cap } from './builders.js';
import { hero } from './people.js';
import { feel, burst, grassBurst, dust, glow, puffs, debris, flash } from './fx.js';
import { dropShard } from './quest.js';
import { hurtHero } from './hero.js';

const EYE = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 1.6, 0.4) });
export const beetles = [];
function makeBeetle(x, z) {
  const shell = new THREE.MeshPhongMaterial({ color: 0x8a3418, specular: 0x8a6a58, shininess: 45 });
  const dark = new THREE.MeshPhongMaterial({ color: 0x1d1814, specular: 0x4a4440, shininess: 30 });
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body); body.position.y = 0.3; scene.add(g);
  const halves = [-1, 1].map(s => {
    const m = mesh(new THREE.SphereGeometry(0.4, 14, 8, s > 0 ? Math.PI / 2 : -Math.PI / 2, Math.PI, 0, Math.PI / 2), shell, s * 0.012, 0.02, -0.16, body);
    m.scale.set(0.95, 0.72, 1.35); m.material.side = THREE.DoubleSide; return m;
  });
  mesh(new THREE.SphereGeometry(0.37, 12, 6), dark, 0, 0.02, -0.16, body).scale.set(0.92, 0.3, 1.3);
  mesh(new THREE.SphereGeometry(0.22, 12, 8), dark, 0, 0.06, 0.32, body).scale.set(1.25, 0.72, 0.85);
  mesh(new THREE.SphereGeometry(0.15, 10, 8), dark, 0, 0.05, 0.52, body).scale.set(1.2, 0.8, 1);
  for (const s of [-1, 1]) mesh(new THREE.SphereGeometry(0.035, 6, 4), EYE, s * 0.13, 0.09, 0.58, body);
  const mands = [-1, 1].map(s => {
    const p = new THREE.Group(); p.position.set(s * 0.08, 0.06, 0.62); p.rotation.x = -0.3; body.add(p);
    const m = mesh(new THREE.TorusGeometry(0.22, 0.034, 5, 10, 1.75).rotateX(Math.PI / 2).translate(-0.22, 0, 0), dark, 0, 0, 0, p);
    m.scale.x = s; mesh(new THREE.ConeGeometry(0.03, 0.1, 4).rotateX(Math.PI / 2), dark, -s * 0.12, 0.02, 0.12, p);
    return p;
  });
  const legs = [];
  for (const s of [-1, 1]) for (const [j, lz, fwd] of [[0, 0.3, 0.6], [1, 0.08, 0], [2, -0.14, -0.6]]) {
    const pv = new THREE.Group(); pv.position.set(s * 0.2, -0.02, lz); pv.scale.x = s; body.add(pv);
    const hip = new THREE.Group(); pv.add(hip);
    mesh(cap(0.025, 0.22).rotateZ(Math.PI / 2).translate(0.13, 0, 0), dark, 0, 0, 0, hip);
    const knee = new THREE.Group(); knee.position.x = 0.27; knee.rotation.z = -1.6; hip.add(knee);
    mesh(cap(0.02, 0.28).rotateZ(Math.PI / 2).translate(0.16, 0, 0), dark, 0, 0, 0, knee);
    legs.push({ pv, hip, s, fwd, ph: (j + (s > 0 ? 1 : 0)) % 2 * Math.PI });
  }
  g.position.set(x, 0, z);
  const sc = R(0.95, 1.15); g.scale.setScalar(sc);
  const b = { g, body, halves, mands, legs, shell, dark, pos: g.position, vel: V(), yaw: Math.atan2(-x, -z), hp: 3, state: 'enter', t: 0,
    cd: 1, flash: 0, r: 0.5 * sc, stuck: 0, detour: 0, side: 1, aim: V(), goal: V(R(-6, 6), 0, R(-2, 12)), phase: 0, open: 0 };
  beetles.push(b);
  return b;
}
const SPAWNS = [[0.5, 31], [23, 9.4], [-22, 2], [-0.5, 31]];
let spawnT = 6;
export function spawnBeetles(dt) {
  spawnT -= dt;
  if (spawnT <= 0 && beetles.filter(b => b.state !== 'dead').length < 3) { const [x, z] = pick(SPAWNS); makeBeetle(x + R(-1, 1), z); spawnT = 5 + Math.random() * 5; }
}
export function clearBeetles() {         // the hero went down: the living ones leave, and the wood is quiet a while
  [...beetles].forEach(b => b.state !== 'dead' && removeBeetle(b)); spawnT = 6;
}

export function hurtBeetle(b, dmg, dir) {
  b.hp -= dmg; b.flash = 1; feel.stop = Math.max(feel.stop, dmg > 1 ? 0.11 : 0.075); feel.shake = Math.max(feel.shake, dmg > 1 ? 0.35 : 0.2);
  const p = V(b.pos.x - dir.x * 0.3, 0.5, b.pos.z - dir.z * 0.3);
  burst(p, 14, C(3.2, 3, 2.4), 7, 1.2); burst(p, 6, C(3.2, 1.6, .4), 5);
  grassBurst(b.pos, 10);
  b.vel.copy(dir).multiplyScalar(dmg > 1 ? 10 : 7);
  if (b.hp <= 0) return killBeetle(b, dir);
  Object.assign(b, { state: 'hurt', t: 0 });
}
function killBeetle(b, dir) {
  Object.assign(b, { state: 'dead', t: 0 }); feel.stop = 0.12; feel.shake = 0.45;
  const side = V(Math.cos(b.yaw), 0, -Math.sin(b.yaw));
  b.halves.forEach((m, i) => {
    scene.attach(m);
    const s = i ? 1 : -1;
    debris.push({ m, v: side.clone().multiplyScalar(s * (2 + Math.random() * 1.5)).add(dir.clone().multiplyScalar(2.5)).setY(4 + Math.random() * 2),
      w: V(Math.random() * 12 - 6, Math.random() * 10 - 5, Math.random() * 12 - 6), life: 4.5 });
  });
  const p = V(b.pos.x, 0.45, b.pos.z);
  burst(p, 26, C(3.4, 1.8, 0.5), 8, 2); burst(p, 10, C(3, 3, 2.6), 9, 1);
  for (let i = 0; i < 20; i++) glow.emit(p, V(Math.random() - .5, Math.random() * 1.5 + .5, Math.random() - .5).multiplyScalar(3), C(2.4, 1.1, 0.3), 1 + Math.random(), 2, 1.5);
  for (let i = 0; i < 5; i++) puffs.emit(V(p.x + (Math.random() - .5) * .5, 0.3, p.z + (Math.random() - .5) * .5), V((Math.random() - .5) * 1.5, 0.8, (Math.random() - .5) * 1.5), 0.32, 0.9, 0x221c1a);
  const L = flash; L.position.set(p.x, 1, p.z); L.intensity = 14;
  dropShard(b.pos); spawnT = Math.min(spawnT, 4 + Math.random() * 4);
}
function removeBeetle(b) { scene.remove(b.g); beetles.splice(beetles.indexOf(b), 1); }
function updateBeetle(b, dt, t) {
  b.t += dt; b.cd -= dt; b.flash = Math.max(0, b.flash - dt * 6);
  const to = V().subVectors(hero.pos, b.pos).setY(0), dist = to.length(); to.normalize();
  let want = null, speed = 0;
  if (b.state === 'dead') {
    b.body.rotation.z = lerp(b.body.rotation.z, Math.PI, 1 - Math.exp(-dt * 10));
    b.body.position.y = 0.3 + Math.max(0, Math.sin(Math.min(1, b.t / 0.45) * Math.PI)) * 0.4;
    b.legs.forEach((L, i) => { L.hip.rotation.z = 0.4 + Math.sin(t * 30 + i) * 0.4 * Math.max(0, 1 - b.t / 1.5); });
    b.vel.multiplyScalar(Math.exp(-dt * 5)); b.pos.addScaledVector(b.vel, dt);
    if (b.t > 2.5) b.pos.y -= dt * 0.25;
    if (b.t > 4) removeBeetle(b);
    return;
  }
  if (b.state === 'enter') { want = V().subVectors(b.goal, b.pos).setY(0); speed = 1.7; if (want.length() < 1 || dist < 8) b.state = 'chase'; want.normalize(); }
  else if (b.state === 'chase') {
    want = to; speed = hero.state === 'down' ? 0 : 2.1;
    if (dist < 2.8 && b.cd <= 0 && hero.state !== 'down') Object.assign(b, { state: 'windup', t: 0 });
  } else if (b.state === 'windup') {
    b.yaw += wrapA(Math.atan2(to.x, to.z) - b.yaw) * (1 - Math.exp(-dt * 10)); b.aim.set(Math.sin(b.yaw), 0, Math.cos(b.yaw));
    b.vel.multiplyScalar(Math.exp(-dt * 10));
    if (b.t > 0.55) { Object.assign(b, { state: 'charge', t: 0 }); dust(b.pos, 3); }
  } else if (b.state === 'charge') {
    b.vel.copy(b.aim).multiplyScalar(8.5 * (1 - b.t / 0.5));
    if (dist < 0.75 + b.r * 0.4) { hurtHero(b.pos); Object.assign(b, { state: 'recover', t: 0 }); }
    if (b.t > 0.45) Object.assign(b, { state: 'recover', t: 0 });
    if (Math.random() < 0.4) dust(b.pos, 1, 0.1);
  } else if (b.state === 'recover') { b.vel.multiplyScalar(Math.exp(-dt * 6)); if (b.t > 0.7) Object.assign(b, { state: 'chase', cd: 0.8 + Math.random() * 1.2 }); }
  else if (b.state === 'hurt') { b.vel.multiplyScalar(Math.exp(-dt * 8)); if (b.t > 0.3) Object.assign(b, { state: 'chase', cd: Math.max(b.cd, 0.4) }); }
  if (want && b.detour > 0) want.applyAxisAngle(V(0, 1, 0), b.side * 1.3);     // sidestep whatever it's stuck on
  b.detour -= dt;
  if (want) { b.vel.lerp(want.clone().multiplyScalar(speed), 1 - Math.exp(-dt * 6)); if (b.vel.length() > 0.2) b.yaw += wrapA(Math.atan2(b.vel.x, b.vel.z) - b.yaw) * (1 - Math.exp(-dt * 7)); }
  for (const o of beetles) if (o !== b && o.state !== 'dead') {           // keep apart
    const d = V().subVectors(b.pos, o.pos).setY(0), l = d.length();
    if (l < 1.1 && l > 1e-4) b.pos.addScaledVector(d, (1.1 - l) / l * 0.5);
  }
  const was = b.pos.clone();
  b.pos.addScaledVector(b.vel, dt); collide(b.pos, b.r, false);
  b.stuck = want && speed && b.pos.distanceTo(was) < speed * dt * 0.3 ? b.stuck + dt : 0;
  if (b.stuck > 0.3) { b.detour = 0.7; b.side = Math.random() < 0.5 ? -1 : 1; b.stuck = 0; }
  const hd = V().subVectors(b.pos, hero.pos).setY(0), hl = hd.length(), hm = b.r + 0.3;   // shoulder off the hero
  if (hl < hm && hl > 1e-4 && hero.state !== 'roll') b.pos.addScaledVector(hd, (hm - hl) / hl);
  b.g.rotation.y = b.yaw;
  const sp = b.vel.length(); b.phase += sp * dt * 9;
  b.legs.forEach(L => {
    const s = Math.sin(b.phase + L.ph), lift = Math.max(0, Math.cos(b.phase + L.ph));
    L.pv.rotation.y = -L.s * (L.fwd + s * 0.4 * Math.min(1, sp));
    L.hip.rotation.z = 0.45 + lift * 0.35 * Math.min(1, sp);
  });
  const wind = b.state === 'windup' ? Math.min(1, b.t / 0.3) : 0;
  b.body.rotation.x = lerp(b.body.rotation.x, -0.4 * wind + (b.state === 'charge' ? 0.12 : 0), 1 - Math.exp(-dt * 14));
  b.body.position.set(wind ? (Math.random() - 0.5) * 0.04 : 0, 0.3 + Math.abs(Math.sin(b.phase)) * 0.015 + wind * 0.1, 0);
  b.open = lerp(b.open, b.state === 'windup' ? 1 : b.state === 'charge' ? -0.2 : 0.25 + 0.1 * Math.sin(t * 3), 1 - Math.exp(-dt * 12));
  b.mands.forEach((m, i) => m.rotation.y = (i ? 1 : -1) * (0.15 + b.open * 0.55));
  b.shell.emissive.setScalar(b.flash * 1.5); b.dark.emissive.setScalar(b.flash * 1.5);
}
export function updateBeetles(dt, t) { [...beetles].forEach(b => updateBeetle(b, dt, t)); }
