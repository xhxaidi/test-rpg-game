// The quest and everything the player reads: the HUD, dialogue and banners, what the NPCs and the sealed gate say,
// the ember shards beetles drop (they fly to you), and the gate waking rune by rune until it opens.
import * as THREE from 'three';
import { scene, cam } from './stage.js';
import { V, C, R, pick, lerp, smooth } from './util.js';
import { mesh, interact } from './builders.js';
import { GX, GZ, VOID, runes, gateLight } from './village.js';
import { hero, maren, stranger, cat } from './people.js';
import { feel, burst, glow } from './fx.js';
import { hit, clearPressed } from './input.js';

export const $ = id => document.getElementById(id);
let embers = 0, gateState = 0, gateOpen = 0, gateOpening = false;   // embers carried, runes lit, how far the gate is open
export function hud() {
  $('hearts').textContent = '♥'.repeat(Math.max(0, hero.hp)) + '♡'.repeat(5 - Math.max(0, hero.hp));
  $('embers').textContent = `◆ ${embers} ember${embers === 1 ? '' : 's'}` + (gateOpen ? '' : `   runes ${gateState}/5`);
}

// ---- dialogue: the box types each line out; E (or space / J) finishes the line, then moves on ----
export const talk = { lines: null, i: 0, shown: 0, done: null };
function say([name, lines, done]) {
  Object.assign(talk, { lines, i: 0, shown: 0, done });
  $('talk').style.display = 'block'; $('talk').querySelector('b').textContent = name;
}
function advance() {
  const l = talk.lines[talk.i];
  if (talk.shown < l.length) { talk.shown = l.length; return; }
  if (++talk.i < talk.lines.length) { talk.shown = 0; return; }
  const d = talk.done; talk.lines = null; $('talk').style.display = 'none'; d?.();
}
export function banner(text, secs = 3.5) { const b = $('banner'); b.textContent = text; b.style.opacity = 1; clearTimeout(banner.t); banner.t = setTimeout(() => b.style.opacity = 0, secs * 1000); }
export function updateDialogue(rdt) {    // while talking the world holds still (dt = 0), ambient life goes on
  if (!talk.lines) return;
  if (hit(['e', 'enter', ' ', 'j'])) advance();
  if (talk.lines) { const l = talk.lines[talk.i]; talk.shown = Math.min(l.length, talk.shown + rdt * 45); $('talk').querySelector('span').textContent = l.slice(0, talk.shown | 0); }
  clearPressed();
}

// ---- who says what: the sealed gate takes your embers; the NPCs' lines change once it's open ----
function gateTalk() {
  if (gateOpen) return ['The open gate', ['Warm light. Bells, very far away.', 'Not yet. The village still needs its embers kept.']];
  if (!embers) return ['The sealed gate', ['A stone arch over a dark that moves like breathing.', `Five hollow runes wait in the stone. ${gateState} of them glow.`, 'Something on the other side is humming.']];
  const n = Math.min(embers, 5 - gateState);
  return ['The sealed gate', [`You press ${n} ember${n > 1 ? 's' : ''} into the runes. The stone drinks the warmth.`,
    gateState + n >= 5 ? 'All five runes burn. The dark in the arch begins to thin...' : `${gateState + n} of five runes glow now.`],
    () => { embers -= n; for (let i = 0; i < n; i++) setTimeout(() => { gateState++; burst(V(GX, 3.2, GZ + 0.6), 18, C(3, 1.6, .4), 4); feel.shake = 0.15; hud(); if (gateState >= 5) gateOpening = true; }, 350 * i); hud(); }];
}
const gateSpot = { p: V(GX, 0, GZ + 1.6), r: 1.8, label: 'The sealed gate', talk: gateTalk };
interact.push(gateSpot);
interact.push({ p: maren.pos, r: 1.7, label: 'Maren', talk: () => ['Maren', gateOpen > 0 ? [
  '...Do you hear that? I had forgotten the sound.', 'Go on, then. Whatever was waiting behind that gate, it is waiting for you now.'] : [
  'Evening, traveller. You came up the south road? Nobody comes up the south road.',
  'The shellbacks crawl out of the wood at dusk. They carry embers in their bellies... warm little things.',
  'The gate behind my shop was sealed the night the bell stopped. Seven years now. Some say it is waiting to be fed.']] });
interact.push({ p: stranger.pos, r: 1.7, label: '???', talk: () => ['???', gateOpen > 0 ? [
  'So. Now you remember the way.', 'Do not look back at the well. It has already forgotten you.'] : [
  'Lean over the water. Go on. It hums your name.', 'Not the name you gave at the south road. The other one.',
  'Five embers wake the arch. Then we shall see who you were.']] });
interact.push({ p: cat.pos, r: 1.1, label: 'Cat', talk: () => ['Cat', [pick(['Mrrp.', 'The cat stares past you, toward the old gate.', 'It blinks slowly. You feel oddly forgiven.', 'Purr.'])]] });

// the nearest thing you can talk to (E talks); its prompt floats over it
let near = null;
export function updateInteract() {
  near = null; let nd = 1e9;
  if (!talk.lines && hero.state === 'move') for (const s of interact) { const d = Math.hypot(s.p.x - hero.pos.x, s.p.z - hero.pos.z); if (d < s.r && d < nd) { nd = d; near = s; } }
  if (near && hit(['e', 'enter'])) { say(near.talk()); clearPressed(); }
}
export function showPrompt() {
  const pr = $('prompt');
  if (near && !talk.lines) {
    const s = V(near.p.x, 1.9, near.p.z).project(cam);
    pr.style.display = 'block'; pr.textContent = `E · ${near.label}`;
    pr.style.left = `${(s.x + 1) / 2 * innerWidth}px`; pr.style.top = `${(1 - s.y) / 2 * innerHeight}px`;
  } else pr.style.display = 'none';
}

// ---- ember shards dropped by beetles: pop out, bob, then fly to you ----
const shards = [];
const SHARD_M = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.4, 1.7, 0.45) });
export function dropShard(p) {
  const m = mesh(new THREE.OctahedronGeometry(0.14, 0), SHARD_M, p.x, 0.5, p.z); m.castShadow = false;
  shards.push({ m, v: V((Math.random() - .5) * 2, 4, (Math.random() - .5) * 2), t: 0 });
}
export function updateShards(dt, t) {
  for (let i = shards.length - 1; i >= 0; i--) {
    const s = shards[i]; s.t += dt;
    const to = V().subVectors(hero.pos, s.m.position).setY(0), d = to.length();
    if (s.t > 0.6 && d < 2.6 && hero.state !== 'down') { s.m.position.addScaledVector(to.normalize(), dt * (4 + 10 / (d + 0.3))); s.m.position.y = lerp(s.m.position.y, 0.7, dt * 8); }
    else { s.v.y -= 12 * dt; s.m.position.addScaledVector(s.v, dt); if (s.m.position.y < 0.45) { s.m.position.y = 0.45 + Math.sin(t * 3 + i) * 0.08; s.v.set(0, 0, 0); } }
    s.m.rotation.y += dt * 3;
    if (Math.random() < dt * 8) glow.emit(s.m.position, V((Math.random() - .5) * .3, 0.6, (Math.random() - .5) * .3), C(1.6, .7, .2), 0.6, -0.2, 1);
    if (s.t > 0.6 && d < 0.5) { scene.remove(s.m); shards.splice(i, 1); embers++; hud(); burst(V(hero.pos.x, 0.8, hero.pos.z), 10, C(3.2, 1.7, .4), 3); }
  }
}

// ---- the gate wakes rune by rune, then opens ----
export function updateGate(rdt, t) {
  runes.forEach((r, i) => { r.lit = lerp(r.lit, i < gateState ? 1 : 0, 1 - Math.exp(-rdt * 3)); const k = r.lit * (0.8 + 0.2 * Math.sin(t * 3 + i)); r.m.color.setRGB(0.07 + 2.2 * k, 0.05 + 1.05 * k, 0.04 + 0.22 * k); });
  if (gateOpening && gateOpen < 1) {
    gateOpen = Math.min(1, gateOpen + rdt / 3);
    if (Math.random() < 0.5) glow.emit(V(GX + R(-1, 1), R(0.2, 3.2), GZ + 0.5), V(R(-.4, .4), R(0.2, 1), R(1, 2.5)), C(2.6, 1.8, .9), 2.5, -0.1, 0.4);
    feel.shake = Math.max(feel.shake, 0.08);
    if (gateOpen >= 1) { banner('Somewhere, a bell rings.', 5); hud(); gateSpot.label = 'The open gate'; }
  }
  VOID.uniforms.open.value = smooth(gateOpen, 0, 1);
  if (gateOpen >= 1 && Math.random() < rdt * 6) glow.emit(V(GX + R(-1, 1), R(0.2, 3), GZ + 0.5), V(R(-.3, .3), R(0.1, .6), R(0.6, 1.6)), C(2.2, 1.5, .7), 3, -0.05, 0.3);
  gateLight.color.setRGB(lerp(0.54, 1, gateOpen), lerp(0.42, 0.75, gateOpen), lerp(1, 0.4, gateOpen));
  gateLight.intensity = 3 + gateState * 1.2 + gateOpen * 16 + Math.sin(t * 1.3) * 0.8;
}
