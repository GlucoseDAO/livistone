// TSL port of the sky.ts ShaderMaterial (WebGPU build only). Constants and operation order follow the GLSL line by line, so
// the WebGL 2 fallback bakes the same cubemap; star and cloud hashes use sin() of large arguments, whose precision is
// driver-specific, so their exact placement can differ between GPUs. Re-port when sub-plan 02 changes the GLSL sky.
import * as THREE from 'three/webgpu';
import type { Node } from 'three/webgpu';
import { Fn, acos, atan, clamp, dot, exp, float, floor, fract, length, max, mix, normalize, positionLocal, pow, sin, smoothstep, sqrt, step, vec2, vec3 } from 'three/tsl';
import { graphicsProfile } from '../game/graphics';
import type { GraphicsTier } from '../game/graphics';
import type { SceneRenderer, Sky } from './types';

type V2 = Node<'vec2'>;
const hash = Fn(([p]: [V2]) => fract(sin(dot(p, vec2(127.1, 311.7))).mul(43758.5453))).setLayout({ name: 'skyHash', type: 'float', inputs: [{ name: 'p', type: 'vec2' }] });
const noise = Fn(([p]: [V2]) => {
  const i = floor(p), f = fract(p), s = f.mul(f).mul(float(3).sub(f.mul(2)));
  return mix(mix(hash(i), hash(i.add(vec2(1, 0))), s.x), mix(hash(i.add(vec2(0, 1))), hash(i.add(vec2(1, 1))), s.x), s.y);
}).setLayout({ name: 'skyNoise', type: 'float', inputs: [{ name: 'p', type: 'vec2' }] });
const fbm = Fn(([start]: [V2]) => {
  const p = vec2(start).toVar(), n = float(0).toVar(), a = float(.5).toVar();
  // GLSL mat2(.8,-.6,.6,.8) is column-major: (.8x + .6y, -.6x + .8y).
  for (let i = 0; i < 5; i++) { n.addAssign(a.mul(noise(p))); p.assign(vec2(p.x.mul(.8).add(p.y.mul(.6)), p.x.mul(-.6).add(p.y.mul(.8))).mul(2.03).add(17.2)); a.mulAssign(.5); }
  return n;
}).setLayout({ name: 'skyFbm', type: 'float', inputs: [{ name: 'p', type: 'vec2' }] });

const SUN = new THREE.Vector3(-35, 70, 35).normalize(), MOON = new THREE.Vector3(25, 38, -70).normalize();
const MOON_RIGHT = MOON.clone().cross(new THREE.Vector3(0, 1, 0)).normalize(), MOON_UP = MOON_RIGHT.clone().cross(MOON).normalize();

// The GLSL mixes day and night by a 0/1 uniform; each bake is one or the other, so only that half is compiled.
const daySky = Fn(() => {
  const d = normalize(positionLocal).toVar(), elevation = max(d.y, 0), light = max(dot(d, vec3(SUN)), 0).toVar();
  const day = mix(vec3(.72, .82, .86), vec3(.12, .33, .61), pow(elevation, .48)).toVar();
  day.addAssign(vec3(1, .78, .46).mul(pow(light, 18)).mul(.14));
  day.addAssign(vec3(5, 4.4, 3.2).mul(smoothstep(.99955, .99985, light)));
  const p = d.xz.div(max(d.y, .015).add(.16)).mul(3.8).add(vec2(3.1, 8.4)).toVar();
  const density = fbm(p.add(fbm(p.mul(.65)).mul(1.8))).toVar();
  const banks = smoothstep(.32, .68, noise(p.mul(.37).add(vec2(11, 3))));
  const cloud = smoothstep(.47, .68, density).mul(mix(.3, 1, banks)).mul(smoothstep(.015, .16, d.y));
  const clouds = mix(vec3(.57, .66, .73), vec3(1.25, 1.24, 1.17), smoothstep(.48, .76, density));
  day.assign(mix(day, clouds, cloud.mul(.96)));
  const haze = pow(float(1).sub(clamp(d.y, 0, 1)), 8);
  day.assign(mix(day, vec3(.74, .83, .87).add(vec3(.09, .04, 0).mul(pow(light, 6))), haze.mul(.38)));
  return mix(vec3(.24, .31, .18), day, smoothstep(-.18, .025, d.y));
});
const nightSky = Fn(() => {
  const d = normalize(positionLocal).toVar(), elevation = max(d.y, 0);
  const dark = mix(vec3(.02, .04, .08), vec3(.05, .08, .16), pow(elevation, .55)).toVar();
  const skyUV = vec2(atan(d.z, d.x).div(6.2831853).add(.5), acos(clamp(d.y, -1, 1)).div(3.14159265));
  const grid = skyUV.mul(vec2(360, 180)).toVar(), cell = floor(grid).toVar(), offset = vec2(hash(cell.add(7.1)), hash(cell.add(19.7))).mul(.64).add(.18);
  const g = fract(grid).sub(offset), star = exp(dot(g, g).negate().mul(140)).mul(step(.967, hash(cell)));
  dark.addAssign(mix(vec3(.65, .8, 1), vec3(1, .9, .72), hash(cell.add(31))).mul(star).mul(float(1.5).add(hash(cell.add(13)).mul(2))).mul(smoothstep(.03, .2, d.y)));
  const moonLight = max(dot(d, vec3(MOON)), 0).toVar();
  dark.addAssign(vec3(.42, .5, .68).mul(pow(moonLight, 22)).mul(.2));
  const lunar = vec2(dot(d, vec3(MOON_RIGHT)), dot(d, vec3(MOON_UP))).div(.043).toVar();
  const disc = float(1).sub(smoothstep(.94, 1, length(lunar)));
  const craters = float(.74).add(fbm(lunar.mul(8)).mul(.16)).add(noise(lunar.mul(27)).mul(.1));
  const phase = smoothstep(-.7, -.4, lunar.x.add(sqrt(max(0, float(1).sub(lunar.y.mul(lunar.y)))).mul(.2)));
  dark.assign(mix(dark, vec3(1.25, 1.23, 1.13).mul(craters).mul(mix(.12, 1, phase)), disc.mul(step(0, moonLight))));
  return mix(vec3(.04, .06, .04), dark, smoothstep(-.12, .04, d.y));
});

/** Bake the sky once: the background and the jewelry reflections see the same cubemap (as sky.ts does for WebGL). */
export function createNodeSky(renderer: SceneRenderer, mobile: boolean, night: boolean, tier: GraphicsTier, darkGround: boolean): Sky {
  void darkGround; // TODO(B2): the TSL sky does not yet shade the lower hemisphere.
  void mobile;
  const profile = graphicsProfile(tier), scene = new THREE.Scene(), webgpu = renderer as unknown as THREE.WebGPURenderer;
  const material = new THREE.MeshBasicNodeMaterial({ side: THREE.BackSide, depthWrite: false, fog: false });
  material.colorNode = night ? nightSky() : daySky();
  const geometry = new THREE.SphereGeometry(10, 24, 16); scene.add(new THREE.Mesh(geometry, material));
  const target = new THREE.CubeRenderTarget(night ? profile.skyNight : profile.skyDay, { type: tier === 'cpu' ? THREE.UnsignedByteType : THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
  new THREE.CubeCamera(.1, 20, target).update(webgpu, scene);
  if (tier === 'cpu') { geometry.dispose(); material.dispose(); return { background: target.texture, environment: target.texture }; }
  const pmrem = new THREE.PMREMGenerator(webgpu), environment = pmrem.fromCubemap(target.texture).texture;
  pmrem.dispose(); geometry.dispose(); material.dispose();
  return { background: target.texture, environment };
}
