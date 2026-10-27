// Renderer, scene, the top-down camera, lights and the pixel look. The scene renders into a low-res target; a post
// pass tone-maps it, darkens the edges (vignette), flashes red when you're hurt, fades to black, Bayer-dithers it to
// a few colours per channel and upscales it nearest-neighbour.
import * as THREE from 'three';
import { V, V2, clamp } from './util.js';

const PX = 4;        // screen pixels per "art" pixel
const LEVELS = 9.0;  // colour levels per channel after dithering

export const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.BasicShadowMap;
document.body.appendChild(renderer.domElement);

export const scene = new THREE.Scene();
renderer.setClearColor(0x101a0e);
scene.fog = new THREE.Fog(0x332c40, 58, 92);     // a violet haze toward the north edge of the view

// top-down oblique ortho camera, looking north; it follows the hero and snaps to whole art pixels so nothing crawls
const PITCH = 0.92;
export const CAM_DIR = V(0, Math.sin(PITCH), Math.cos(PITCH)), CAM_UP = V(0, Math.cos(PITCH), -Math.sin(PITCH));
export const cam = new THREE.OrthographicCamera();
cam.position.copy(CAM_DIR).multiplyScalar(60); cam.lookAt(0, 0, 0);
let VIEW = 6.8;                                   // half the view height, world units

// lights: low golden sun from the west, cool violet sky fill so the shade reads mysterious
scene.add(new THREE.HemisphereLight(0x8a96c8, 0x4a3a2a, 0.95));
const SUN_DIR = V(-0.66, 0.76, 0.3).normalize();
const sun = new THREE.DirectionalLight(0xffcf94, 4.3);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.04;
Object.assign(sun.shadow.camera, { left: -21, right: 21, top: 21, bottom: -21, near: 1, far: 110 });
scene.add(sun, sun.target);
const LX = V().crossVectors(V(0, 1, 0), SUN_DIR).normalize(), LY = V().crossVectors(SUN_DIR, LX), SH_T = 42 / 2048;
export function placeSun(f) {      // shadow camera follows the view, snapped to its own texels so shadows don't shimmer
  const a = Math.round(f.dot(LX) / SH_T) * SH_T, b = Math.round(f.dot(LY) / SH_T) * SH_T;
  sun.target.position.copy(LX).multiplyScalar(a).addScaledVector(LY, b).addScaledVector(SUN_DIR, f.dot(SUN_DIR));
  sun.position.copy(sun.target.position).addScaledVector(SUN_DIR, 55);
}

// ---- low-res target + dither pass (with a vignette for the dark edges, a hurt flash and fades) ----
const rt = new THREE.WebGLRenderTarget(1, 1, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, type: THREE.HalfFloatType });
const post = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
  uniforms: { tex: { value: rt.texture }, res: { value: V2(1, 1) }, levels: { value: LEVELS }, exposure: { value: 1.35 }, fade: { value: 1 }, hurt: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`,
  fragmentShader: `
    uniform sampler2D tex; uniform vec2 res; uniform float levels, exposure, fade, hurt; varying vec2 vUv;
    vec3 aces(vec3 x){ return clamp(x * (2.51 * x + .03) / (x * (2.43 * x + .59) + .14), 0., 1.); }
    float bayer4(vec2 p){
      int x = int(mod(p.x, 4.)), y = int(mod(p.y, 4.));
      int m[16] = int[16](0,8,2,10, 12,4,14,6, 3,11,1,9, 15,7,13,5);
      return float(m[y * 4 + x]) / 16. - 0.5;
    }
    void main(){
      vec2 px = floor(vUv * res);
      vec3 c = pow(aces(max(texture2D(tex, (px + .5) / res).rgb, 0.) * exposure), vec3(1. / 2.2));
      vec2 q = (vUv - .5) * vec2(res.x / res.y, 1.);
      float vig = smoothstep(.38, 1.05, length(q));
      c *= 1. - .55 * vig;                                        // dark, mysterious edges
      c = mix(c, vec3(.75, .08, .05), hurt * vig * .8);
      c *= 1. - fade;
      c = floor(c * (levels - 1.) + .5 + bayer4(px)) / (levels - 1.);
      gl_FragColor = vec4(clamp(c, 0., 1.), 1.);
    }`,
}));
const postScene = new THREE.Scene(); postScene.add(post);
const postCam = new THREE.Camera();
let lw = 1, lh = 1;
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h);
  lw = Math.ceil(w / PX); lh = Math.ceil(h / PX);
  rt.setSize(lw, lh);
  post.material.uniforms.res.value.set(lw, lh);
  const half = w > h ? VIEW : VIEW * 1.25;       // a little more height on portrait screens
  Object.assign(cam, { left: -half * lw / lh, right: half * lw / lh, top: half, bottom: -half, near: 1, far: 160 });
  cam.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();
addEventListener('wheel', e => { VIEW = clamp(VIEW * (1 + e.deltaY * 0.001), 6, 13); resize(); }, { passive: true });

// put the camera over focus point f, snapped to whole art pixels
export function placeCamera(f) {
  const pxw = (cam.top - cam.bottom) / lh;
  const p = f.clone().addScaledVector(CAM_DIR, 60), a = Math.round(p.x / pxw) * pxw, b = Math.round(p.dot(CAM_UP) / pxw) * pxw;
  cam.position.set(a, 0, 0).addScaledVector(CAM_UP, b).addScaledVector(CAM_DIR, p.dot(CAM_DIR));
}

export function render(fade, hurt) {
  post.material.uniforms.fade.value = fade;
  post.material.uniforms.hurt.value = hurt;
  renderer.setRenderTarget(rt); renderer.render(scene, cam);
  renderer.setRenderTarget(null); renderer.render(postScene, postCam);
}
