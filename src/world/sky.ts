import * as THREE from 'three';
import { Fn, acos, atan, clamp, dot, exp, float, floor, fract, length, max, mix, normalize, positionLocal, pow, sin, smoothstep, sqrt, step, vec2, vec3 } from 'three/tsl';
import type { Node } from 'three/webgpu';
import { graphicsProfile } from '../game/graphics';
import type { GraphicsTier } from '../game/graphics';
import { toneMapped } from '../render/tone';
export { acesFilmic } from '../render/tone';

export type SkyPhase = 'day' | 'night';
/** Unit vectors toward the painted sun and moon; the directional light and its shadows come from the same place. */
export const SUN_DIR = new THREE.Vector3(-35, 70, 35).normalize(), MOON_DIR = new THREE.Vector3(25, 38, -70).normalize();
/** Tone-mapping exposure per phase; HORIZON_HAZE is pre-mapped against it (render/tone.ts scales it per curve). */
export const SKY_EXPOSURE: Record<SkyPhase, number> = { day: .96, night: .72 };
// Linear radiance at the horizon: the gradient's base, the day haze band drawn over it, and the night base.
const DAY_BASE = [.72, .82, .86], DAY_HAZE = [.74, .83, .87], HAZE_BAND = .38, NIGHT_BASE = [.02, .04, .08];
const HORIZON = { day: DAY_BASE.map((v, i) => v * (1 - HAZE_BAND) + DAY_HAZE[i] * HAZE_BAND), night: NIGHT_BASE };

/** Map-background radiance per phase: the painted sky just above the horizon, before tone mapping, so the flat map background
 *  tone-maps to exactly the displayed horizon. */
export const HORIZON_RADIANCE: Record<SkyPhase, THREE.Color> = {
  day: new THREE.Color().setRGB(HORIZON.day[0], HORIZON.day[1], HORIZON.day[2], THREE.LinearSRGBColorSpace),
  night: new THREE.Color().setRGB(HORIZON.night[0], HORIZON.night[1], HORIZON.night[2], THREE.LinearSRGBColorSpace),
};
/** That horizon as displayed (tone-mapped, linear) under the active curve: the map's range fog and the cpu tier's linear fog mix
 *  toward it after the mapping (render/output.ts). */
export const HORIZON_HAZE: Record<SkyPhase, THREE.Color> = { day: toneMapped(HORIZON.day, SKY_EXPOSURE.day), night: toneMapped(HORIZON.night, SKY_EXPOSURE.night) };

// Star and cloud hashes use sin() of large arguments, whose precision is driver-specific: their exact placement can differ
// between GPUs and between the WebGPU and WebGL 2 backends.
type V2 = Node<'vec2'>;
const hash = Fn(([p]: [V2]) => fract(sin(dot(p, vec2(127.1, 311.7))).mul(43758.5453))).setLayout({ name: 'skyHash', type: 'float', inputs: [{ name: 'p', type: 'vec2' }] });
const noise = Fn(([p]: [V2]) => {
  const i = floor(p), f = fract(p), s = f.mul(f).mul(float(3).sub(f.mul(2)));
  return mix(mix(hash(i), hash(i.add(vec2(1, 0))), s.x), mix(hash(i.add(vec2(0, 1))), hash(i.add(vec2(1, 1))), s.x), s.y);
}).setLayout({ name: 'skyNoise', type: 'float', inputs: [{ name: 'p', type: 'vec2' }] });
const fbm = Fn(([start]: [V2]) => {
  const p = vec2(start).toVar(), n = float(0).toVar(), a = float(.5).toVar();
  // Each octave turns by (.8x + .6y, -.6x + .8y) and doubles.
  for (let i = 0; i < 5; i++) { n.addAssign(a.mul(noise(p))); p.assign(vec2(p.x.mul(.8).add(p.y.mul(.6)), p.x.mul(-.6).add(p.y.mul(.8))).mul(2.03).add(17.2)); a.mulAssign(.5); }
  return n;
}).setLayout({ name: 'skyFbm', type: 'float', inputs: [{ name: 'p', type: 'vec2' }] });

const MOON_RIGHT = MOON_DIR.clone().cross(new THREE.Vector3(0, 1, 0)).normalize(), MOON_UP = MOON_RIGHT.clone().cross(MOON_DIR).normalize();

// Each bake is either day or night, so only that half of the sky is built. The haze bake (aerial perspective's fog colour,
// render/aerial.ts) looks at the horizon wherever a ray points below it, and leaves out the sun disc, moon disc and stars: tiny
// and bright, they would blot a 64 px bake, and the air in front of a hill scatters none of them.
const below = (haze: boolean): Node<'vec3'> => { const d = normalize(positionLocal); return haze ? normalize(vec3(d.x, max(d.y, 0), d.z).add(vec3(1e-4, 0, 0))) : d; };
const daySky = (darkGround: boolean, haze = false) => Fn(() => {
  const d = below(haze).toVar(), elevation = max(d.y, 0), light = max(dot(d, vec3(SUN_DIR)), 0).toVar();
  const day = mix(vec3(...DAY_BASE), vec3(.12, .33, .61), pow(elevation, .48)).toVar();
  day.addAssign(vec3(1, .78, .46).mul(pow(light, 18)).mul(.14));
  if (!haze) day.addAssign(vec3(5, 4.4, 3.2).mul(smoothstep(.99955, .99985, light)));
  const p = d.xz.div(max(d.y, .015).add(.16)).mul(3.8).add(vec2(3.1, 8.4)).toVar();
  const density = fbm(p.add(fbm(p.mul(.65)).mul(1.8))).toVar();
  const banks = smoothstep(.32, .68, noise(p.mul(.37).add(vec2(11, 3))));
  const cloud = smoothstep(.47, .68, density).mul(mix(.3, 1, banks)).mul(smoothstep(.015, .16, d.y));
  const clouds = mix(vec3(.57, .66, .73), vec3(1.25, 1.24, 1.17), smoothstep(.48, .76, density));
  day.assign(mix(day, clouds, cloud.mul(.96)));
  const band = pow(float(1).sub(clamp(d.y, 0, 1)), 8);
  day.assign(mix(day, vec3(...DAY_HAZE).add(vec3(.09, .04, 0).mul(pow(light, 6))), band.mul(HAZE_BAND)));
  if (haze) return day;
  const ground = darkGround ? mix(vec3(.24, .31, .18), vec3(.08, .095, .06), smoothstep(0, .3, d.y.negate())) : vec3(.24, .31, .18);
  return mix(ground, day, smoothstep(-.18, .025, d.y));
})();
const nightSky = (haze = false) => Fn(() => {
  const d = below(haze).toVar(), elevation = max(d.y, 0);
  const dark = mix(vec3(...NIGHT_BASE), vec3(.05, .08, .16), pow(elevation, .55)).toVar();
  if (haze) return dark.add(vec3(.42, .5, .68).mul(pow(max(dot(d, vec3(MOON_DIR)), 0), 22)).mul(.2));
  const skyUV = vec2(atan(d.z, d.x).div(6.2831853).add(.5), acos(clamp(d.y, -1, 1)).div(3.14159265));
  const grid = skyUV.mul(vec2(360, 180)).toVar(), cell = floor(grid).toVar(), offset = vec2(hash(cell.add(7.1)), hash(cell.add(19.7))).mul(.64).add(.18);
  const g = fract(grid).sub(offset), star = exp(dot(g, g).negate().mul(140)).mul(step(.967, hash(cell)));
  dark.addAssign(mix(vec3(.65, .8, 1), vec3(1, .9, .72), hash(cell.add(31))).mul(star).mul(float(1.5).add(hash(cell.add(13)).mul(2))).mul(smoothstep(.03, .2, d.y)));
  const moonLight = max(dot(d, vec3(MOON_DIR)), 0).toVar();
  dark.addAssign(vec3(.42, .5, .68).mul(pow(moonLight, 22)).mul(.2));
  const lunar = vec2(dot(d, vec3(MOON_RIGHT)), dot(d, vec3(MOON_UP))).div(.043).toVar();
  const disc = float(1).sub(smoothstep(.94, 1, length(lunar)));
  const craters = float(.74).add(fbm(lunar.mul(8)).mul(.16)).add(noise(lunar.mul(27)).mul(.1));
  const phase = smoothstep(-.7, -.4, lunar.x.add(sqrt(max(0, float(1).sub(lunar.y.mul(lunar.y)))).mul(.2)));
  dark.assign(mix(dark, vec3(1.25, 1.23, 1.13).mul(craters).mul(mix(.12, 1, phase)), disc.mul(step(0, moonLight))));
  return mix(vec3(.04, .06, .04), dark, smoothstep(-.12, .04, d.y));
})();

/** Bake the sky once: the background and the jewelry reflections see the same cubemap.
 *  darkGround shades the lower hemisphere, hidden behind terrain, like shaded surroundings: polished metal then shows a
 *  dark-below, bright-above horizon line instead of a flat sky tint, until reflection probes capture the real town.
 *  `haze` is the aerial perspective's fog colour (render/aerial.ts): the same sky, 64 px a face with mipmaps, horizon below.
 *  The cpu tier keeps linear fog and gets the background there instead. */
export function createSky(renderer: THREE.WebGPURenderer, mobile: boolean, night = false, tier: GraphicsTier = mobile ? 'mobile' : 'gpu', darkGround = false): { background: THREE.CubeTexture; environment: THREE.Texture; haze: THREE.CubeTexture } {
  const profile = graphicsProfile(tier), scene = new THREE.Scene();
  const material = new THREE.MeshBasicNodeMaterial({ side: THREE.BackSide, depthWrite: false, fog: false });
  material.colorNode = night ? nightSky() : daySky(darkGround);
  const geometry = new THREE.SphereGeometry(10, 24, 16), sphere = new THREE.Mesh(geometry, material); scene.add(sphere);
  const bake = (size: number, type: THREE.TextureDataType): THREE.CubeTexture => {
    const target = new THREE.CubeRenderTarget(size, { type, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
    new THREE.CubeCamera(.1, 20, target).update(renderer, scene); return target.texture;
  };
  const background = bake(night ? profile.skyNight : profile.skyDay, tier === 'cpu' ? THREE.UnsignedByteType : THREE.HalfFloatType);
  if (tier === 'cpu') { geometry.dispose(); material.dispose(); return { background, environment: background, haze: background }; }
  const hazeMaterial = new THREE.MeshBasicNodeMaterial({ side: THREE.BackSide, depthWrite: false, fog: false });
  hazeMaterial.colorNode = night ? nightSky(true) : daySky(darkGround, true); sphere.material = hazeMaterial;
  const haze = bake(64, THREE.HalfFloatType);
  const pmrem = new THREE.PMREMGenerator(renderer), environment = pmrem.fromCubemap(background).texture;
  pmrem.dispose(); geometry.dispose(); material.dispose(); hazeMaterial.dispose();
  return { background, environment, haze };
}
