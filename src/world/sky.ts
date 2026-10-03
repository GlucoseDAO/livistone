import * as THREE from 'three';
import { Break, Fn, If, Loop, abs, acos, atan, clamp, cos, dot, exp, float, floor, fract, length, max, min, mix, normalize, positionLocal, pow, sin, smoothstep, sqrt, step, texture3D, vec2, vec3, vec4 } from 'three/tsl';
import type { Node } from 'three/webgpu';
import { graphicsProfile } from '../game/graphics';
import type { GraphicsTier } from '../game/graphics';
import { ATMOSPHERE, atmosphereRadiance, horizonMean, skyRadiance, transmittance } from './atmosphere';
import { cloudNoise } from './cloud-noise';
import { toneMapped } from '../render/tone';

export type SkyPhase = 'day' | 'night';
/** Unit vectors toward the painted sun and moon; the directional light and its shadows come from the same place. */
export const SUN_DIR = new THREE.Vector3(-35, 70, 35).normalize(), MOON_DIR = new THREE.Vector3(25, 38, -70).normalize();
/** Tone-mapping exposure per phase; HORIZON_HAZE is pre-mapped against it. */
export const SKY_EXPOSURE: Record<SkyPhase, number> = { day: .96, night: .72 };
// Linear radiance at the horizon: the gradient's base, the day haze band drawn over it, and the night base.
const DAY_BASE = [.72, .82, .86], DAY_HAZE = [.74, .83, .87], HAZE_BAND = .38, NIGHT_BASE = [.02, .04, .08];
const HORIZON = { day: DAY_BASE.map((v, i) => v * (1 - HAZE_BAND) + DAY_HAZE[i] * HAZE_BAND), night: NIGHT_BASE };

/** Dev-only `?sky=classic`: the hand-painted gradient sky of rounds 1–2, for review against the physical one (sub-plan 26). */
export type SkyLook = 'physical' | 'classic';
export function skyLook(): SkyLook {
  if (!import.meta.env.DEV || typeof location === 'undefined') return 'physical';
  return new URLSearchParams(location.search).get('sky') === 'classic' ? 'classic' : 'physical';
}

/** Map-background radiance per phase: the painted sky just above the horizon, before tone mapping, so the flat map background
 *  tone-maps to exactly the displayed horizon. */
export const HORIZON_RADIANCE: Record<SkyPhase, THREE.Color> = {
  day: new THREE.Color().setRGB(HORIZON.day[0], HORIZON.day[1], HORIZON.day[2], THREE.LinearSRGBColorSpace),
  night: new THREE.Color().setRGB(HORIZON.night[0], HORIZON.night[1], HORIZON.night[2], THREE.LinearSRGBColorSpace),
};
/** That horizon as displayed (Neutral-mapped, linear, render/tone.ts): the map's range fog, the cpu tier's linear fog and the
 *  distant ranges' mist mix toward it after the mapping (render/output.ts). */
export const HORIZON_HAZE: Record<SkyPhase, THREE.Color> = { day: toneMapped(HORIZON.day, SKY_EXPOSURE.day), night: toneMapped(HORIZON.night, SKY_EXPOSURE.night) };

type F = Node<'float'>; type V2 = Node<'vec2'>; type V3 = Node<'vec3'>;
const luma = (c: readonly number[]): number => c[0] * .2126 + c[1] * .7152 + c[2] * .0722;
/**
 * The physical sky's one calibration: a single gain that sets the mean radiance 2° above the horizon to the fog's horizon, so
 * fogged surfaces still meet the sky without a seam. The last few degrees then blend to that exact colour (a low haze layer).
 */
export const SKY_GAIN = luma(HORIZON.day) / luma(horizonMean(SUN_DIR));
const gained = (c: readonly number[]): [number, number, number] => [c[0] * SKY_GAIN, c[1] * SKY_GAIN, c[2] * SKY_GAIN];
// Cloud lighting from the same atmosphere: sunlight at the cloud layer, skylight from above and light bounced from the ground.
const CLOUD = { bottom: 1500, top: 3300, reach: 32000, haze: 30000, extinction: .045 } as const;
const sunAtClouds = gained(transmittance(CLOUD.bottom + 600, SUN_DIR.y).map(v => v * ATMOSPHERE.sun));
const skyAbove = gained([0, 1, 2, 3, 4, 5, 6, 7].reduce((sum, i) => {
  const a = i / 8 * Math.PI * 2, view = new THREE.Vector3(Math.cos(a) * .8, .6, Math.sin(a) * .8).normalize(), r = skyRadiance(view, SUN_DIR, 16, 6);
  return sum.map((v, c) => v + r[c] / 8);
}, [0, 0, 0]));
const groundBounce = sunAtClouds.map((v, c) => .1 * (v * SUN_DIR.y / Math.PI + skyAbove[c]));
const sunDisc = gained(transmittance(ATMOSPHERE.eye, SUN_DIR.y).map(v => v * 8 / SKY_GAIN));

// Hashes without sin(), so star and jitter placement is the same on every GPU and on both backends.
const hash13 = Fn(([p]: [V3]) => {
  const q = fract(p.mul(.1031)).toVar(); q.addAssign(dot(q, q.zyx.add(31.32)));
  return fract(q.x.add(q.y).mul(q.z));
}).setLayout({ name: 'skyHash13', type: 'float', inputs: [{ name: 'p', type: 'vec3' }] });
const hash33 = Fn(([p]: [V3]) => {
  const q = fract(p.mul(vec3(.1031, .103, .0973))).toVar(); q.addAssign(dot(q, q.yxz.add(33.33)));
  return fract(q.xxy.add(q.yxx).mul(q.zyx));
}).setLayout({ name: 'skyHash33', type: 'vec3', inputs: [{ name: 'p', type: 'vec3' }] });
const valueNoise3 = Fn(([p]: [V3]) => {
  const i = floor(p).toVar(), f = fract(p), u = f.mul(f).mul(float(3).sub(f.mul(2))).toVar();
  const corner = (x: number, y: number, z: number): F => hash13(i.add(vec3(x, y, z)));
  return mix(mix(mix(corner(0, 0, 0), corner(1, 0, 0), u.x), mix(corner(0, 1, 0), corner(1, 1, 0), u.x), u.y), mix(mix(corner(0, 0, 1), corner(1, 0, 1), u.x), mix(corner(0, 1, 1), corner(1, 1, 1), u.x), u.y), u.z);
}).setLayout({ name: 'skyValueNoise3', type: 'float', inputs: [{ name: 'p', type: 'vec3' }] });
const fbm3 = (p: V3, octaves: number): F => {
  let sum: F = float(0), amplitude = .5, q = p;
  for (let i = 0; i < octaves; i++) { sum = sum.add(valueNoise3(q).mul(amplitude)); q = q.mul(2.03).add(vec3(17.3, -4.1, 9.7)); amplitude *= .5; }
  return sum.div(1 - amplitude * 2);
};
const henyeyGreenstein = (cosine: F, g: number): F => float((1 - g * g) / (4 * Math.PI)).div(pow(float(1 + g * g).sub(cosine.mul(2 * g)), 1.5));

/** Steps per bake: the clouds' view march and light march, and the atmosphere's view march. */
const QUALITY: Record<GraphicsTier, { clouds: number; light: number; air: number; noise: number }> = {
  gpu: { clouds: 56, light: 6, air: 16, noise: 48 }, mobile: { clouds: 40, light: 5, air: 12, noise: 40 }, cpu: { clouds: 20, light: 3, air: 8, noise: 32 },
};

/**
 * Fair-weather cumulus between 1.5 and 3.3 km, ray-marched through 3D noise with sunlight marched toward the sun (self-shadowing),
 * a two-lobe phase for the silver lining, three scattering octaves for bright interiors (Hillaire 2016) and haze with distance.
 * Returns the clouds' light and the share of the sky behind them that stays visible.
 */
function cloudLayer(d: V3, noise: THREE.Data3DTexture, q: typeof QUALITY.gpu): Node<'vec4'> {
  const sun = vec3(SUN_DIR), cosine = dot(d, sun).toVar();
  const phase = (k: number): F => mix(henyeyGreenstein(cosine, .72 * .5 ** k), henyeyGreenstein(cosine, -.22 * .5 ** k), .28);
  const density = (x: F, h: F, z: F, detail: boolean): F => {
    const fraction = h.sub(CLOUD.bottom).div(CLOUD.top - CLOUD.bottom).toVar();
    const coverage = smoothstep(.2, .85, texture3D(noise, vec3(x.div(52000).add(.31), .43, z.div(52000).add(.77))).b).mul(.32).add(.26).toVar();
    // Flat bases, rounded tops that climb where the coverage is thicker.
    const profile = smoothstep(0, .09, fraction).mul(float(1).sub(smoothstep(coverage.mul(.6).add(.3), 1, fraction)));
    const shape = texture3D(noise, vec3(x, h.mul(1.4), z).div(7800).add(vec3(.13, .52, .71))).r;
    const base = clamp(shape.mul(profile).sub(float(1).sub(coverage)).div(coverage), 0, 1).toVar();
    if (!detail) return base;
    const wisps = texture3D(noise, vec3(x, h, z).div(1500).add(vec3(.4, .1, .9))).g, erosion = mix(.42, .22, fraction);
    return clamp(base.sub(wisps.mul(erosion)).div(float(1).sub(wisps.mul(erosion))), 0, 1);
  };
  return Fn(() => {
    const r = float(ATMOSPHERE.planet + ATMOSPHERE.eye), mu = max(d.y, .002);
    const shell = (radius: number): F => { const b = r.mul(mu); return b.negate().add(sqrt(b.mul(b).sub(r.mul(r)).add(radius * radius))); };
    const enter = shell(ATMOSPHERE.planet + CLOUD.bottom).toVar(), leave = min(shell(ATMOSPHERE.planet + CLOUD.top), enter.add(CLOUD.reach)).toVar();
    const ds = leave.sub(enter).div(q.clouds).toVar(), offset = hash13(d.mul(4111)).toVar();
    const light = vec3(0).toVar(), transmitted = float(1).toVar(), veil = float(0).toVar();
    If(enter.lessThan(90000), () => {
      Loop(q.clouds, ({ i }) => {
        If(transmitted.lessThan(.01), () => { Break(); });
        const t = enter.add(float(i).add(offset).mul(ds)).toVar(), x = d.x.mul(t).toVar(), z = d.z.mul(t).toVar();
        const h = sqrt(r.mul(r).add(t.mul(t)).add(r.mul(t).mul(mu).mul(2))).sub(ATMOSPHERE.planet).toVar(), sample = density(x, h, z, true).toVar();
        If(sample.greaterThan(.002), () => {
          // Optical depth toward the sun through segments that double in length (40 m to 1.3 km).
          const depth = float(0).toVar();
          let along = 0;
          for (let k = 0; k < q.light; k++) {
            const segment = 40 * 2 ** k; along += segment / 2;
            depth.addAssign(density(x.add(SUN_DIR.x * along), h.add(SUN_DIR.y * along), z.add(SUN_DIR.z * along), false).mul(segment * CLOUD.extinction * 1.6));
            along += segment / 2;
          }
          const sunlight = vec3(0).toVar();
          for (let k = 0; k < 3; k++) sunlight.addAssign(vec3(...sunAtClouds).mul(phase(k)).mul(exp(depth.mul(-(.5 ** k)))).mul(.5 ** k));
          const fraction = h.sub(CLOUD.bottom).div(CLOUD.top - CLOUD.bottom);
          const ambient = mix(vec3(...groundBounce), vec3(...skyAbove), clamp(fraction.mul(1.3).add(.1), 0, 1)).mul(.75);
          const extinction = sample.mul(CLOUD.extinction), through = exp(extinction.mul(ds).negate()).toVar();
          // Energy-conserving step (Hillaire 2016); far clouds fade into the sky in front of them.
          const scattered = sunlight.add(ambient).mul(float(1).sub(through)), clear = exp(t.div(-CLOUD.haze));
          light.addAssign(scattered.mul(transmitted).mul(clear)); veil.addAssign(transmitted.mul(float(1).sub(through)).mul(float(1).sub(clear)));
          transmitted.mulAssign(through);
        });
      });
    });
    return vec4(light, transmitted.add(veil));
  })();
}

// Each bake is either day or night, so only that half of the sky is built. The haze bake (the aerial perspective's fog colour,
// render/aerial.ts) looks at the horizon wherever a ray points below it, and leaves out the sun disc, moon disc and stars: tiny
// and bright, they would blot a 64 px bake, and the air in front of a hill scatters none of them.
const below = (haze: boolean): V3 => { const d = normalize(positionLocal); return haze ? normalize(vec3(d.x, max(d.y, 0), d.z).add(vec3(1e-4, 0, 0))) : d; };
/**
 * Low in the view, what stands behind a far town silhouette is not open sky but the distant ranges' valley mist (sub-plan 26),
 * which the output pass fogs toward the horizon colour. The haze bake therefore settles on that colour up to about 2° and
 * reaches the open sky only by about 17°: far trees and hillsides fade into the mist behind them, tall ones into the sky.
 */
const settle = (sky: V3, d: V3, horizon: readonly number[]): V3 => mix(sky, vec3(...horizon), float(1).sub(smoothstep(.03, .3, d.y)));
function physicalDay(darkGround: boolean, tier: GraphicsTier, noise: THREE.Data3DTexture, haze = false): V3 {
  const q = QUALITY[tier];
  return Fn(() => {
    const d = below(haze).toVar(), lifted = normalize(vec3(d.x, max(d.y, 0), d.z));
    const sky = atmosphereRadiance(lifted, SUN_DIR, [SKY_GAIN, SKY_GAIN, SKY_GAIN], q.air).toVar();
    // The sun's disc, a little larger than the true 0.27° so it reads at screen resolution, with limb darkening.
    const sunAngle = acos(clamp(dot(d, vec3(SUN_DIR)), -1, 1)).toVar();
    if (!haze) sky.addAssign(vec3(...sunDisc).mul(float(1).sub(smoothstep(.0085, .0105, sunAngle))).mul(float(.55).add(cos(sunAngle.div(.0105).mul(1.4)).mul(.45))));
    If(d.y.greaterThan(0), () => {
      const clouds = cloudLayer(d, noise, q).toVar();
      sky.assign(sky.mul(clouds.w).add(clouds.xyz));
    });
    // A low haze layer: the last few degrees settle on the fog's exact horizon colour.
    sky.assign(mix(sky, vec3(...HORIZON.day), pow(float(1).sub(clamp(d.y.div(.22), 0, 1)), 7)));
    if (haze) return settle(sky, d, HORIZON.day);
    // Below the horizon the haze continues to about 11° down: from a raised eye, ground past the walking far plane that the
    // distant ranges do not cover shows as the same haze. Lower still, darkGround as in the classic sky.
    const ground = darkGround ? mix(vec3(.24, .31, .18), vec3(.08, .095, .06), smoothstep(.2, .5, d.y.negate())) : vec3(.24, .31, .18);
    return mix(ground, sky, smoothstep(-.34, -.2, d.y));
  })();
}

const MILKY_WAY = new THREE.Vector3(.42, .5, -.76).normalize(), GALACTIC_CENTRE = new THREE.Vector3(.66, .28, .7).normalize().projectOnPlane(MILKY_WAY).normalize();
/** Night: a moonlit gradient, stars of graded brightness and colour, a faint Milky Way with dust lanes, and the moon. */
function physicalNight(size: number, haze = false): V3 {
  // Star discs about one cube texel wide: smaller ones would fall between texels.
  const texel = Math.PI / 2 / size;
  return Fn(() => {
    const d = below(haze).toVar(), elevation = max(d.y, 0), visible = smoothstep(.02, .18, d.y).toVar();
    const dark = mix(vec3(...NIGHT_BASE), vec3(.032, .052, .115), pow(elevation, .5)).toVar();
    if (haze) { const moon = max(dot(d, vec3(MOON_DIR)), 0); return settle(dark.add(vec3(.42, .5, .68).mul(pow(moon, 22)).mul(.2)).add(vec3(.1, .13, .2).mul(pow(moon, 4)).mul(.04)), d, HORIZON.night); }
    // The band: brightness falls off with galactic latitude and toward the anticentre, broken by fbm clumps and dark lanes.
    const latitude = dot(d, vec3(MILKY_WAY)).toVar(), centre = dot(d, vec3(GALACTIC_CENTRE)).mul(.5).add(.5);
    const band = exp(latitude.mul(latitude).div(-.06)).mul(mix(.35, 1.3, pow(centre, 2))).toVar();
    const clumps = fbm3(d.mul(7), 5).toVar(), lanes = smoothstep(.45, .75, fbm3(d.mul(11).add(5.2), 4)).mul(exp(latitude.mul(latitude).div(-.006)));
    dark.addAssign(vec3(.5, .55, .72).mul(band).mul(smoothstep(.3, .85, clumps)).mul(float(1).sub(lanes.mul(.85))).mul(.08).mul(visible));
    // Stars: one candidate per cell of a 3D grid around the sphere, so cells keep their size near the zenith.
    for (const [cells, chance, bright] of [[95, .02, 1.3], [240, .008, .35]] as const) {
      const grid = d.mul(cells).toVar(), cell = floor(grid).toVar(), random = hash33(cell).toVar();
      const position = normalize(cell.add(random.mul(.7).add(.15))), gap = length(d.sub(position)).toVar();
      const inBand = band.mul(cells > 100 ? 1.1 : .3).add(1);
      const magnitude = pow(hash13(cell.add(41.3)), 7).mul(bright * 3.5).add(bright * .08), colour = mix(vec3(.7, .82, 1), vec3(1, .86, .66), hash13(cell.add(7.7)));
      dark.addAssign(colour.mul(magnitude).mul(exp(gap.mul(gap).div(-(texel * texel * .55)))).mul(step(float(1 - chance).div(inBand), hash13(cell.add(19.1)))).mul(visible));
    }
    const moonLight = max(dot(d, vec3(MOON_DIR)), 0).toVar();
    dark.addAssign(vec3(.42, .5, .68).mul(pow(moonLight, 22)).mul(.2).add(vec3(.1, .13, .2).mul(pow(moonLight, 4)).mul(.04)));
    const lunar = vec2(dot(d, vec3(MOON_RIGHT)), dot(d, vec3(MOON_UP))).div(.043).toVar();
    const disc = float(1).sub(smoothstep(.94, 1, length(lunar)));
    // Maria: broad darker basins; craters as small bright speckle.
    const maria = smoothstep(.42, .62, fbm3(vec3(lunar.mul(1.6), 3.1), 3)).mul(.32), craters = fbm3(vec3(lunar.mul(9), 8.4), 3).mul(.16);
    const phase = smoothstep(-.7, -.4, lunar.x.add(sqrt(max(0, float(1).sub(lunar.y.mul(lunar.y)))).mul(.2)));
    dark.assign(mix(dark, vec3(1.25, 1.23, 1.13).mul(float(.86).sub(maria).add(craters)).mul(mix(.12, 1, phase)), disc.mul(step(0, moonLight))));
    return mix(vec3(.04, .06, .04), dark, smoothstep(-.34, -.2, d.y));
  })();
}

// --- The rounds 1–2 painted sky, kept for ?sky=classic ------------------------------------------------------------------------
// Star and cloud hashes use sin() of large arguments, whose precision is driver-specific: their exact placement can differ
// between GPUs and between the WebGPU and WebGL 2 backends.
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

const classicDay = (darkGround: boolean, haze = false) => Fn(() => {
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
  if (haze) return settle(day, d, HORIZON.day);
  const ground = darkGround ? mix(vec3(.24, .31, .18), vec3(.08, .095, .06), smoothstep(0, .3, d.y.negate())) : vec3(.24, .31, .18);
  return mix(ground, day, smoothstep(-.18, .025, d.y));
})();
const classicNight = (haze = false) => Fn(() => {
  const d = below(haze).toVar(), elevation = max(d.y, 0);
  const dark = mix(vec3(...NIGHT_BASE), vec3(.05, .08, .16), pow(elevation, .55)).toVar();
  if (haze) return settle(dark.add(vec3(.42, .5, .68).mul(pow(max(dot(d, vec3(MOON_DIR)), 0), 22)).mul(.2)), d, HORIZON.night);
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

/** Cube face size of each bake: the physical sky's clouds want twice the painted sky's day resolution on every tier. */
function bakeSize(tier: GraphicsTier, night: boolean, look: SkyLook): number {
  const profile = graphicsProfile(tier);
  return night ? profile.skyNight : look === 'classic' ? profile.skyDay / 2 : profile.skyDay;
}

export type Sky = { background: THREE.CubeTexture; environment: THREE.Texture; haze: THREE.CubeTexture };
/** Bake the sky once: the background and the jewelry reflections see the same cubemap.
 *  darkGround shades the lower hemisphere, hidden behind terrain, like shaded surroundings: polished metal then shows a
 *  dark-below, bright-above horizon line instead of a flat sky tint, until reflection probes capture the real town.
 *  `haze` is the aerial perspective's fog colour (render/aerial.ts): the same sky, 64 px a face with mipmaps, horizon below.
 *  The cpu tier keeps linear fog and gets the background there instead. */
export function createSky(renderer: THREE.WebGPURenderer, mobile: boolean, night = false, tier: GraphicsTier = mobile ? 'mobile' : 'gpu', darkGround = false, look: SkyLook = skyLook()): Sky {
  const steps = skyBake(renderer, mobile, night, tier, darkGround, look);
  for (;;) { const step = steps.next(); if (step.done) return step.value; }
}
/**
 * createSky in steps, a cube face or the prefilter at a time, for a sky first needed after loading: the night baked in the
 * background (sub-plan 07) took a frame of about half a second on an integrated GPU in one piece.
 */
export function* skyBake(renderer: THREE.WebGPURenderer, mobile: boolean, night = false, tier: GraphicsTier = mobile ? 'mobile' : 'gpu', darkGround = false, look: SkyLook = skyLook()): Generator<void, Sky> {
  const scene = new THREE.Scene(), size = bakeSize(tier, night, look);
  const material = new THREE.MeshBasicNodeMaterial({ side: THREE.BackSide, depthWrite: false, fog: false });
  const clouds = look === 'physical' && !night ? cloudNoise(QUALITY[tier].noise) : null;
  const colour = (haze: boolean): V3 => look === 'classic' ? (night ? classicNight(haze) : classicDay(darkGround, haze)) : night ? physicalNight(size, haze) : physicalDay(darkGround, tier, clouds!, haze);
  material.colorNode = colour(false);
  const geometry = new THREE.SphereGeometry(10, 24, 16), sphere = new THREE.Mesh(geometry, material); scene.add(sphere);
  // CubeCamera.update() one face per step: mipmaps once the last face is in, the prefilter told the cube changed.
  const bake = function* (faces: number): Generator<void, THREE.CubeRenderTarget> {
    const target = new THREE.CubeRenderTarget(faces, { type: tier === 'cpu' ? THREE.UnsignedByteType : THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
    const cameras = new THREE.CubeCamera(.1, 20, target); cameras.updateMatrixWorld(); cameras.coordinateSystem = renderer.coordinateSystem; cameras.updateCoordinateSystem();
    for (let face = 0; face < 6; face++) {
      const previous = renderer.getRenderTarget(), cube = renderer.getActiveCubeFace(), level = renderer.getActiveMipmapLevel();
      target.texture.generateMipmaps = face === 5; renderer.setRenderTarget(target, face); renderer.render(scene, cameras.children[face] as THREE.Camera);
      renderer.setRenderTarget(previous, cube, level); if (face < 5) yield;
    }
    target.texture.needsPMREMUpdate = true; return target;
  };
  const target = yield* bake(size);
  if (tier === 'cpu') { clouds?.dispose(); geometry.dispose(); material.dispose(); return { background: target.texture, environment: target.texture, haze: target.texture }; }
  yield;
  // The reflections keep the classic bake size: PMREM grows fourfold per doubling of the cube, and every lit surface samples it.
  const small = size > bakeSize(tier, night, 'classic') ? yield* bake(bakeSize(tier, night, 'classic')) : null;
  if (small) yield;
  const pmrem = new THREE.PMREMGenerator(renderer), environment = pmrem.fromCubemap((small ?? target).texture).texture;
  yield;
  const hazeMaterial = new THREE.MeshBasicNodeMaterial({ side: THREE.BackSide, depthWrite: false, fog: false });
  hazeMaterial.colorNode = colour(true); sphere.material = hazeMaterial;
  const haze = (yield* bake(64)).texture;
  small?.dispose(); clouds?.dispose(); pmrem.dispose(); geometry.dispose(); material.dispose(); hazeMaterial.dispose();
  return { background: target.texture, environment, haze };
}
