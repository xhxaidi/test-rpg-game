// Emberhollow: a small top-down action RPG in a pixel-art village at dusk.
// Modules build their part of the world when imported, in this order; the loop below runs one frame of everything.
import * as THREE from 'three';
import { renderer, placeCamera, placeSun, render } from './stage.js';
import { V, clamp, TIME } from './util.js';
import './textures.js';
import './map.js';
import './builders.js';
import './village.js';
import { PUSHERS } from './foliage.js';
import { hero, cat, updateCat, updateNPCs } from './people.js';
import { feel, sparks, glow, bits, puffs, flash, updateDebris } from './fx.js';
import { $, talk, hud, updateDialogue, updateInteract, updateShards, updateGate, showPrompt } from './quest.js';
import { clearPressed } from './input.js';
import { updateHero } from './hero.js';
import { beetles, spawnBeetles, updateBeetles } from './beetles.js';
import { updateAmbient, updateRays } from './ambient.js';

const clock = new THREE.Clock(), focus = V(0.4, 0, 9);
let realT = 0, started = false;
hud();
setTimeout(() => { $('title').style.opacity = 0; started = true; }, 2600);
setTimeout(() => { $('hint').style.opacity = 0.35; }, 16000);
renderer.setAnimationLoop(() => {
  const rdt = Math.max(0.001, Math.min(clock.getDelta(), 0.05)); realT += rdt;
  const t = realT; TIME.value = t;
  updateDialogue(rdt);                                   // dialogue: the world holds still, ambient life goes on
  let dt = talk.lines || !started ? 0 : rdt;
  if (feel.stop > 0) { feel.stop -= rdt; dt = 0; }       // hit-stop
  updateInteract();                                      // the nearest thing you can talk to; E talks

  updateHero(dt, t);
  if (dt) spawnBeetles(dt);
  updateBeetles(dt, t);
  updateCat(dt, t);
  updateNPCs(t, rdt);
  updateShards(dt, t);
  updateDebris(dt);
  updateGate(rdt, t);

  // particles and ambient life
  sparks.update(dt); glow.update(rdt, t); bits.update(rdt, t); puffs.update(rdt);
  updateAmbient(t, rdt, focus);
  flash.intensity = Math.max(0, flash.intensity - rdt * 40);
  feel.hurtFx = Math.max(0, feel.hurtFx - rdt * 2.5);
  PUSHERS.value[0].copy(hero.pos);                       // the grass parts around the hero, the beetles and the cat
  beetles.forEach((b, i) => i < 4 && PUSHERS.value[i + 1].copy(b.pos));
  for (let i = beetles.length + 1; i < 6; i++) PUSHERS.value[i].set(999, 0, 999);
  PUSHERS.value[5].copy(cat.pos);

  // camera: follow with a little lead, shake, snap to whole art pixels
  const lead = V(hero.vel.x, 0, hero.vel.z).multiplyScalar(0.25);
  focus.lerp(V(hero.pos.x, 0, hero.pos.z).add(lead), 1 - Math.exp(-rdt * 4.5));
  focus.x = clamp(focus.x, -9.5, 9.5); focus.z = clamp(focus.z, -13.5, 19.5);
  feel.shake = Math.max(0, feel.shake - rdt * 1.8);
  placeCamera(focus.clone().add(V((Math.random() - .5), 0, (Math.random() - .5)).multiplyScalar(feel.shake * 0.6)));
  placeSun(focus);
  updateRays(t, rdt, focus);

  showPrompt();                                          // over the nearest thing you can talk to
  if (dt || !started) clearPressed();                    // presses during a hit-stop carry over
  render(Math.max(feel.fade, started ? 0 : 1), feel.hurtFx);
});
