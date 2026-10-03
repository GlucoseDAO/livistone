// A single-scattering atmosphere (Rayleigh, Mie and ozone over a spherical planet, after Nishita 1993 and Hillaire 2020's
// parameters), evaluated by ray marching. sky.ts bakes it into the sky cube once per phase through the TSL copy below; this CPU
// copy calibrates that bake so its horizon lands on the fog colour (HORIZON_RADIANCE), and gives the clouds their sunlight.
// Only the sun direction changes between phases: a golden-hour sun near 8° reddens through the same optical depths.
import * as THREE from 'three';
import { Fn, Loop, dot, exp, float, max, sqrt, vec3 } from 'three/tsl';
import type { Node } from 'three/webgpu';

/** Metres and per-metre coefficients. Mie is a hazy summer day: about three times the clear-sky aerosol. */
export const ATMOSPHERE = {
  planet: 6360e3, top: 6460e3, eye: 150,
  rayleigh: [5.802e-6, 13.558e-6, 33.1e-6] as const, rayleighHeight: 8000,
  mieScatter: 12e-6, mieExtinction: 13.3e-6, mieHeight: 1200, mieG: .78,
  ozone: [.65e-6, 1.881e-6, .085e-6] as const, ozoneCentre: 25000, ozoneWidth: 15000,
  sun: 20,
};
const A = ATMOSPHERE;
type Triple = [number, number, number];

/** Distance along a ray from height `r` (from the planet centre, ray elevation sine `mu`) to the sphere of `radius`, or -1. */
function sphereExit(r: number, mu: number, radius: number): number {
  const b = r * mu, c = r * r - radius * radius, disc = b * b - c;
  return disc < 0 ? -1 : -b + Math.sqrt(disc);
}
function densities(h: number): Triple {
  return [Math.exp(-h / A.rayleighHeight), Math.exp(-h / A.mieHeight), Math.max(0, 1 - Math.abs(h - A.ozoneCentre) / A.ozoneWidth)];
}
const extinction = ([r, m, o]: Triple, c: number): number => A.rayleigh[c] * r + A.mieExtinction * m + A.ozone[c] * o;

/** Transmittance from height h (metres above ground) toward a direction of elevation sine mu, through the whole atmosphere. */
export function transmittance(h: number, mu: number, steps = 24): Triple {
  const r = A.planet + h, length = sphereExit(r, mu, A.top), ds = length / steps, depth: Triple = [0, 0, 0];
  // The planet shadows directions below its horizon.
  if (sphereExit(r, mu, A.planet) > 0 && mu < 0 && r * r * (mu * mu - 1) + A.planet * A.planet > 0) return [0, 0, 0];
  for (let i = 0; i < steps; i++) {
    const t = (i + .5) * ds, height = Math.sqrt(r * r + t * t + 2 * r * t * mu) - A.planet, d = densities(height);
    for (let c = 0; c < 3; c++) depth[c] += extinction(d, c) * ds;
  }
  return depth.map(v => Math.exp(-v)) as Triple;
}
export function rayleighPhase(cosine: number): number { return 3 / (16 * Math.PI) * (1 + cosine * cosine); }
/** Cornette–Shanks, a Henyey–Greenstein that keeps Rayleigh's symmetric term. */
export function miePhase(cosine: number, g = A.mieG): number {
  const g2 = g * g; return 3 / (8 * Math.PI) * ((1 - g2) * (1 + cosine * cosine)) / ((2 + g2) * Math.pow(1 + g2 - 2 * g * cosine, 1.5));
}
/** Sky radiance (sun irradiance A.sun) along `view` from the eye, before calibration. */
export function skyRadiance(view: THREE.Vector3, sun: THREE.Vector3, steps = 32, lightSteps = 12): Triple {
  const r = A.planet + A.eye, mu = Math.max(view.y, 0), cosine = view.dot(sun), length = sphereExit(r, mu, A.top);
  const pr = rayleighPhase(cosine), pm = miePhase(cosine), radiance: Triple = [0, 0, 0], depth: Triple = [0, 0, 0];
  let previous = 0;
  for (let i = 0; i < steps; i++) {
    // Steps grow quadratically: the dense air near the eye gets the finest ones.
    const t0 = previous, t1 = length * ((i + 1) / steps) ** 2, t = (t0 + t1) / 2, ds = t1 - t0; previous = t1;
    const pr2 = r * r + t * t + 2 * r * t * mu, height = Math.sqrt(pr2) - A.planet, d = densities(height);
    const sunMu = (r * sun.y + t * cosine) / Math.sqrt(pr2), light = transmittance(height, sunMu, lightSteps);
    for (let c = 0; c < 3; c++) {
      const step = extinction(d, c) * ds; depth[c] += step / 2;
      radiance[c] += Math.exp(-depth[c]) * light[c] * (A.rayleigh[c] * d[0] * pr + A.mieScatter * d[1] * pm) * ds;
      depth[c] += step / 2;
    }
  }
  return radiance.map(v => v * A.sun) as Triple;
}
/** Mean radiance around the horizon at the given elevation (radians): what the fog has to match. */
export function horizonMean(sun: THREE.Vector3, elevation = .035, azimuths = 24): Triple {
  const sum: Triple = [0, 0, 0], view = new THREE.Vector3();
  for (let i = 0; i < azimuths; i++) {
    const a = i / azimuths * Math.PI * 2; view.set(Math.cos(a) * Math.cos(elevation), Math.sin(elevation), Math.sin(a) * Math.cos(elevation));
    skyRadiance(view, sun).forEach((v, c) => { sum[c] += v / azimuths; });
  }
  return sum;
}

// --- TSL copy for the bake ---------------------------------------------------------------------------------------------------
type F = Node<'float'>; type V3 = Node<'vec3'>;
const RAYLEIGH = vec3(...A.rayleigh), OZONE = vec3(...A.ozone);
const exitDistance = (r: F, mu: F, radius: number): F => { const b = r.mul(mu); return b.negate().add(sqrt(max(b.mul(b).sub(r.mul(r)).add(radius * radius), 0))); };
const extinctionAt = (height: F): V3 => RAYLEIGH.mul(exp(height.div(-A.rayleighHeight))).add(exp(height.div(-A.mieHeight)).mul(A.mieExtinction))
  .add(OZONE.mul(max(float(1).sub(height.sub(A.ozoneCentre).abs().div(A.ozoneWidth)), 0)));
/** TSL: optical depth (per channel) from height h toward elevation sine mu, to the top of the atmosphere. */
const sunDepth = Fn(([h, mu]: [F, F]) => {
  const r = h.add(A.planet), length = exitDistance(r, mu, A.top), ds = length.div(8), depth = vec3(0).toVar();
  Loop(8, ({ i }) => {
    const t = float(i).add(.5).mul(ds), height = sqrt(r.mul(r).add(t.mul(t)).add(r.mul(t).mul(mu).mul(2))).sub(A.planet);
    depth.addAssign(extinctionAt(height).mul(ds));
  });
  return depth;
}).setLayout({ name: 'atmosphereSunDepth', type: 'vec3', inputs: [{ name: 'h', type: 'float' }, { name: 'mu', type: 'float' }] });

/** TSL: calibrated sky radiance along a unit view direction (rays below the horizon are lifted to it). */
export const atmosphereRadiance = (view: V3, sun: THREE.Vector3, gain: Triple, steps = 16): V3 => Fn(() => {
  const r = float(A.planet + A.eye), mu = max(view.y, 0).toVar(), cosine = dot(view, vec3(sun)).toVar(), length = exitDistance(r, mu, A.top).toVar();
  const g2 = A.mieG * A.mieG, pr = cosine.mul(cosine).add(1).mul(3 / (16 * Math.PI)).toVar();
  const pm = cosine.mul(cosine).add(1).mul(3 / (8 * Math.PI) * (1 - g2) / (2 + g2)).div(float(1 + g2).sub(cosine.mul(2 * A.mieG)).pow(1.5)).toVar();
  const radiance = vec3(0).toVar(), depth = vec3(0).toVar(), previous = float(0).toVar();
  Loop(steps, ({ i }) => {
    const t1 = length.mul(float(i).add(1).div(steps).pow(2)).toVar(), t = previous.add(t1).mul(.5), ds = t1.sub(previous).toVar(); previous.assign(t1);
    const p2 = r.mul(r).add(t.mul(t)).add(r.mul(t).mul(mu).mul(2)).toVar(), height = sqrt(p2).sub(A.planet).toVar();
    const sunMu = r.mul(sun.y).add(t.mul(cosine)).div(sqrt(p2)), step = extinctionAt(height).mul(ds).toVar();
    depth.addAssign(step.mul(.5));
    const scatter = RAYLEIGH.mul(exp(height.div(-A.rayleighHeight))).mul(pr).add(exp(height.div(-A.mieHeight)).mul(A.mieScatter).mul(pm));
    radiance.addAssign(exp(depth.add(sunDepth(height, sunMu)).negate()).mul(scatter).mul(ds));
    depth.addAssign(step.mul(.5));
  });
  return radiance.mul(vec3(...gain).mul(A.sun));
})();
