import * as THREE from 'three';
import { Fn, attribute, clamp, dot, float, floor, fract, length, max, mix, positionGeometry, positionLocal, renderGroup, sin, uniform, vec2, vec3 } from 'three/tsl';
import type { Node } from 'three/webgpu';

/**
 * The town's one wind clock, shared by every swaying plant: the near grass field, the forest, shrubs, flowers, meadow tufts
 * and reeds. It follows the game's own elapsed time, which `?capture=1` freezes, never TSL's global `time`, and stands still
 * under prefers-reduced-motion. In the render group, so all materials read one value per frame.
 */
export const windTime = uniform(0).setGroup(renderGroup);
/** Prevailing wind, blowing toward +x+z (unit vector in the ground plane). */
export const WIND_DIRECTION = new THREE.Vector2(.8, .6);

const reducedMotion = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
const WIND_PARAM = import.meta.env?.DEV && typeof location !== 'undefined' ? new URLSearchParams(location.search).get('wind') : null;
/**
 * Dev-only review switches (sub-plan 17): ?wind=off builds the town as before it, the forest, planting and reeds still and
 * the leaf cards plainly alpha-tested; ?wind=<seconds> pins the clock there, so stills can compare two moments of the wind.
 */
export const WIND_OFF = WIND_PARAM === 'off';
const pinned = WIND_PARAM !== null && WIND_PARAM !== '' && Number.isFinite(Number(WIND_PARAM)) ? Number(WIND_PARAM) : null;
/** Once per frame with the game's elapsed seconds. */
export function updateWind(time: number): void { windTime.value = pinned ?? (reducedMotion?.matches ? 0 : time); }

type F = Node<'float'>; type V2 = Node<'vec2'>; type V3 = Node<'vec3'>;
// A sin-free hash (Hoskins) keeps large world coordinates stable, as in ground-material.ts.
const hash = (p: V2): F => { const q = fract(vec3(p.x, p.y, p.x).mul(.1031)).toVar(); q.addAssign(dot(q, q.yzx.add(33.33))); return fract(q.x.add(q.y).mul(q.z)); };
const noise = (p: V2): F => {
  const i = floor(p).toVar(), f = fract(p).toVar(), u = f.mul(f).mul(float(3).sub(f.mul(2))).toVar();
  return mix(mix(hash(i), hash(i.add(vec2(1, 0))), u.x), mix(hash(i.add(vec2(0, 1))), hash(i.add(vec2(1, 1))), u.x), u.y);
};
const downwind = (xz: V2): F => xz.x.mul(WIND_DIRECTION.x).add(xz.y.mul(WIND_DIRECTION.y));
/** Gust strength (0–1) at `xz`: fronts about 18 m apart travel downwind at 2.5 m/s; between them the plants lean less. */
const gustAt = (xz: V2): F => noise(vec2(downwind(xz).sub(windTime.mul(2.5)).div(18), xz.x.mul(WIND_DIRECTION.y).sub(xz.y.mul(WIND_DIRECTION.x)).div(26)));

/**
 * Horizontal sway of a plant tip at world position `xz`, in metres per metre of height: slow gusts roll across the ground
 * along the wind, and each plant flutters at its own `phase` (0–1). Callers scale it by height and bend; one that also needs
 * the gust itself passes gustAt(xz) in, so the noise is evaluated once.
 */
export function windSway(xz: V2, phase: F, gust: F = gustAt(xz).toVar()): V2 {
  const flutter = sin(windTime.mul(mix(1.7, 2.6, phase)).add(phase.mul(6.2831853)).add(downwind(xz).mul(.35))).mul(.35);
  const lean = gust.mul(gust).mul(.75).add(.1).add(flutter.mul(gust.mul(.6).add(.4)));
  return vec2(WIND_DIRECTION.x, WIND_DIRECTION.y).mul(lean);
}

/** Per-instance attribute of a swaying instanced plant: its root (the instance matrix's translation) and uniform scale. */
export const WIND_ROOT = 'windRoot';
/** The windRoot values of `matrices` (16 floats per instance), read off each instance matrix once at load. */
export function windRoots(matrices: ArrayLike<number>): Float32Array {
  const count = Math.floor(matrices.length / 16), roots = new Float32Array(count * 4);
  for (let i = 0, m = 0; i < count; i++, m += 16) {
    roots[i * 4] = matrices[m + 12]; roots[i * 4 + 1] = matrices[m + 13]; roots[i * 4 + 2] = matrices[m + 14];
    roots[i * 4 + 3] = Math.hypot(matrices[m], matrices[m + 1], matrices[m + 2]);
  }
  return roots;
}
/** Gives `geometry` an empty windRoot attribute for `count` instances; the owner refills it alongside the instance matrices. */
export function addWindRoots(geometry: THREE.BufferGeometry, count: number): THREE.InstancedBufferAttribute {
  const roots = new THREE.InstancedBufferAttribute(new Float32Array(count * 4), 4); geometry.setAttribute(WIND_ROOT, roots); return roots;
}
const root = (): Node<'vec4'> => attribute<'vec4'>(WIND_ROOT, 'vec4');
/** The bent position keeps roughly its distance from the root: a tip displaced sideways by `bend` sinks by bend² / 2h. */
const bent = (position: V3, bend: V2, height: F): V3 => vec3(position.x.add(bend.x), position.y.sub(dot(bend, bend).div(max(height.mul(2), .02))), position.z.add(bend.y));

/**
 * Position node of an instanced plant that bends from its root (shrubs, flowers, meadow tufts, reeds): the grass field's sway
 * at the root, growing with the square of the height above it so the base stays planted. At `reach` metres up the tip leans
 * `stiffness` times windSway's lean; `flutter` metres adds a quick shiver to each leaf. `position` is the plant's own
 * position node (positionLocal, after instancing). Each plant's phase comes from its root, so neighbours never move in step.
 */
export function plantSway(position: V3, reach: number, stiffness: number, flutter = 0): V3 {
  // Inside an Fn: the hash's variables and assignments need its stack.
  return Fn(() => {
    const base = root().toVar(), height = max(position.y.sub(base.y), 0).toVar(), phase = hash(base.xz.mul(.731).add(17.7)).toVar(), gust = gustAt(base.xz).toVar();
    const bend = windSway(base.xz, phase, gust).mul(height.mul(height).mul(stiffness / reach)).toVar();
    const swayed = bent(position, bend, height);
    if (flutter <= 0) return swayed;
    // Model-space position: every vertex of a leaf shares nearly the same shiver, so leaves move whole.
    const leaf = noise(positionGeometry.xz.mul(5.3).add(positionGeometry.y.mul(3.1))).toVar();
    const shiver = sin(windTime.mul(mix(6.5, 9.5, phase)).add(leaf.mul(6.2831853))).mul(gust.mul(.6).add(.4)).mul(flutter).mul(clamp(height.div(reach), 0, 1));
    return swayed.add(vec3(leaf.sub(.5), .6, fract(leaf.mul(7.3)).sub(.5)).mul(shiver));
  })() as unknown as V3;
}

/**
 * Position node of the forest's instanced trees, `height` metres tall at scale 1: the whole crown leans and rocks with the
 * gusts at its trunk, branches bob on phases of their own, and with `leaves` the cards flutter. Every amplitude grows with
 * height in the tree, so the trunk's foot stays put. Bark and foliage share all but the flutter, so leaves stay on their twigs.
 * `far` keeps only the crown's lean, for the forest's distant detail: beyond its 36 m switch the bob and flutter span about a
 * pixel, and dropping them saves most of the vertex work on the many far trees.
 */
export function treeSway(height: number, leaves: boolean, far = false): V3 {
  return Fn(() => {
    const base = root().toVar(), position = positionLocal, size = base.w.mul(height).toVar(), rise = max(position.y.sub(base.y), 0).toVar();
    const up = clamp(rise.div(size), 0, 1.1).toVar(), phase = hash(base.xz.mul(.37).add(4.1)).toVar(), gust = gustAt(base.xz).toVar();
    // Large and slow: the crown leans about 2% of the tree's height per unit of windSway lean, a few centimetres to a quarter metre at the top.
    const crown = windSway(base.xz, phase, gust).mul(size.mul(.02)).mul(up.mul(up)).toVar();
    if (far) return bent(position, crown, rise);
    // Branches: limbs farther from the trunk and higher up bob more, each region of the model on its own phase.
    const spread = length(position.xz.sub(base.xz)).div(size), limb = noise(vec2(positionGeometry.x.add(positionGeometry.z.mul(.61)), positionGeometry.y.add(positionGeometry.z.mul(.37))).mul(.45));
    const bob = sin(windTime.mul(mix(2.1, 2.9, phase)).add(limb.mul(6.2831853)).add(phase.mul(6.2831853))).mul(gust.mul(.7).add(.3)).mul(size.mul(.016)).mul(spread).mul(up).toVar();
    let swayed: V3 = bent(position, crown, rise).add(vec3(bob.mul(WIND_DIRECTION.x * .4), bob, bob.mul(WIND_DIRECTION.y * .4)));
    if (leaves) {
      // Leaf flutter, a couple of centimetres at about 1.5 Hz; neighbouring cards share a phase over roughly 40 cm.
      const card = noise(vec2(positionGeometry.x.add(positionGeometry.y.mul(.7)), positionGeometry.z.sub(positionGeometry.y.mul(.4))).mul(2.5)).toVar();
      const flutter = sin(windTime.mul(mix(8, 12, card)).add(card.mul(6.2831853)).add(phase.mul(3.1))).mul(gust.mul(.6).add(.4)).mul(.022).mul(up);
      swayed = swayed.add(vec3(card.sub(.5), .5, fract(card.mul(5.7)).sub(.5)).mul(flutter));
    }
    return swayed;
  })() as unknown as V3;
}
