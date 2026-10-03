import * as THREE from 'three';
import { Fn, If, abs, attribute, dot, float, floor, fract, max, min, mix, normalWorld, positionLocal, positionWorld, pow, select, sin, smoothstep, texture, uniform, vec2, vec3, vertexStage } from 'three/tsl';
import type { Node } from 'three/webgpu';
import type { GraphicsTier } from '../game/graphics';
import { WATER_LEVEL } from './water-surface';

type F = Node<'float'>; type V2 = Node<'vec2'>; type V3 = Node<'vec3'>;

/** Game time for the riverbed caustics. Town.update sets it with the river's own clock, so ?capture=1 freezes both. */
export const shoreTime = uniform(0);
/** The gravel scan sub-plan 03 reserved for the shore (Poly Haven Gravel Floor 02). The cpu tier shades the banks by colour alone. */
export function shoreTextureFiles(tier: GraphicsTier): string[] { return tier === 'cpu' ? [] : ['gravel-albedo-512.webp', 'gravel-nrh-256.webp']; }
export interface ShoreMaps { albedo: THREE.Texture; nrh: THREE.Texture }

/** waterDistance (waterways.ts) as nodes: signed metres to the nearest river or tributary bank, negative inside the channel. */
export const channelDistance = Fn(([xz]: [V2]) => {
  const x = xz.x, z = xz.y;
  const centre = float(26).add(sin(x.mul(.036)).mul(4)).add(sin(x.mul(.075)).mul(3).mul(min(abs(x).div(35), 1)));
  const river = abs(z.sub(centre)).sub(7.3).sub(sin(x.mul(.19)).mul(.38)).sub(sin(x.mul(.53)).mul(.18));
  // Both tributaries at once: the nearer one always lies on the same side as x.
  const offset = float(57).add(sin(z.add(12).mul(.065)).mul(6)), width = float(3.5).add(sin(z.mul(.21)).mul(.45)).mul(min(z.add(58).div(8), 1));
  return min(river, select(z.greaterThan(-58).and(z.lessThan(32)), abs(abs(x).sub(offset)).sub(width), float(1e4)));
}).setLayout({ name: 'shoreChannelDistance', type: 'float', inputs: [{ name: 'xz', type: 'vec2' }] });

// Hash without sine and quintic gradient noise; large world coordinates stay stable.
const hash22 = Fn(([p]: [V2]) => {
  const q = fract(vec3(p.x, p.y, p.x).mul(vec3(.1031, .1030, .0973))).toVar(); q.addAssign(dot(q, q.yzx.add(33.33)));
  return fract(vec2(q.x, q.x).add(q.yz).mul(q.zy));
}).setLayout({ name: 'shoreHash22', type: 'vec2', inputs: [{ name: 'p', type: 'vec2' }] });
const gradientNoise = Fn(([p]: [V2]) => {
  const i = floor(p).toVar(), f = fract(p).toVar(), u = f.mul(f).mul(f).mul(f.mul(f.mul(6).sub(15)).add(10)).toVar();
  const corner = (x: number, y: number): F => dot(hash22(i.add(vec2(x, y))).mul(2).sub(1), f.sub(vec2(x, y)));
  return mix(mix(corner(0, 0), corner(1, 0), u.x), mix(corner(0, 1), corner(1, 1), u.x), u.y);
}).setLayout({ name: 'shoreGradientNoise', type: 'float', inputs: [{ name: 'p', type: 'vec2' }] });
/** Thin bright contours where two drifting noise fields cross zero: the web of light that surface ripples focus on a shallow bed. */
const causticWeb = Fn(([p, t]: [V2, F]) => {
  const a = gradientNoise(p.mul(3.1).add(vec2(t.mul(.17), t.mul(-.09))));
  const b = gradientNoise(vec2(p.x.mul(.8).sub(p.y.mul(.6)), p.x.mul(.6).add(p.y.mul(.8))).mul(4).add(vec2(t.mul(-.11).add(5.3), t.mul(.14).add(5.3))));
  return pow(max(float(1).sub(abs(a).mul(3.2)), 0), 5).add(pow(max(float(1).sub(abs(b).mul(3.2)), 0), 5)).mul(.6);
}).setLayout({ name: 'shoreCausticWeb', type: 'float', inputs: [{ name: 'p', type: 'vec2' }, { name: 't', type: 'float' }] });

/** The ground stage's values the shore adjusts in place: colour (before vertex colours multiply it), roughness and detail normals. */
export interface GroundShore { ground: V3; roughness: F; detail: V2; relief: V2 }

/**
 * River shores on the terrain, called at the end of the ground's colour stage (the terrain's local positions are world positions):
 * - gravel patches either side of the waterline, from the shore scan (gpu and mobile);
 * - a darker wet band that reaches a ragged 0.4 m up the bank, glossy above the water;
 * - dark silt under the river, deepening with the water;
 * - on gpu, caustics drifting over the shallow bed, seen through the transparent river.
 * `divisor` is the grass vertex colour the ground stage divides out, so the targets here are final albedos.
 */
export function shoreGround(tier: GraphicsTier, maps: ShoreMaps | null, target: GroundShore, dx: V2, dy: V2, divisor: THREE.Color): void {
  // Per vertex: the field is linear across the banks, and the mask only needs to know which ground is near a channel.
  const bank = float(1).sub(smoothstep(.6, 2.4, vertexStage(channelDistance(positionLocal.xz)))).toVar();
  If(bank.greaterThan(0), () => {
    const xz = positionLocal.xz, depth = float(WATER_LEVEL).sub(positionLocal.y).toVar(), keep = vec3(1 / divisor.r, 1 / divisor.g, 1 / divisor.b);
    // A ragged tide line rather than a contour.
    const wet = bank.mul(float(1).sub(smoothstep(.03, .42, depth.negate().add(gradientNoise(xz.mul(.9)).mul(.16))))).toVar();
    const under = bank.mul(smoothstep(.02, .22, depth)).toVar();
    if (maps) {
      // Gravel washes into patches, mostly at and under the waterline: up to 0.45 m up the bank and 0.7 m under the water.
      const reach = float(1).sub(smoothstep(.15, .45, depth.negate())).mul(float(1).sub(smoothstep(.3, .7, depth)));
      const patches = smoothstep(-.02, .22, gradientNoise(xz.mul(.35).add(3.7)).add(gradientNoise(xz.mul(1.3).sub(2.1)).mul(.35)));
      const gravel = bank.mul(reach).mul(patches).toVar();
      If(gravel.greaterThan(.01), () => {
        const uv = xz.div(1.7), gx = dx.div(1.7), gy = dy.div(1.7), nrh = texture(maps.nrh, uv).grad(gx, gy).toVar();
        // The bright grey scan re-centred on a darker, warmer river gravel, keeping each stone's value.
        target.ground.assign(mix(target.ground, texture(maps.albedo, uv).grad(gx, gy).rgb.mul(vec3(.4, .36, .3)).mul(keep), gravel));
        target.roughness.assign(mix(target.roughness, nrh.z, gravel)); target.detail.assign(mix(target.detail, nrh.xy.mul(2).sub(1), gravel));
      });
    }
    // Wet ground darkens and, above the water, takes a film of gloss; the water film also smooths its relief.
    target.ground.mulAssign(mix(1, .56, wet)); target.roughness.assign(mix(target.roughness, .2, wet.mul(float(1).sub(under))));
    target.detail.mulAssign(float(1).sub(wet.mul(.5))); target.relief.mulAssign(float(1).sub(wet));
    // Under the river: dark silt, darker with depth.
    target.ground.assign(mix(target.ground, vec3(.075, .07, .052).mul(keep), under.mul(.6)).mul(mix(1, .55, under.mul(smoothstep(.15, 1.3, depth)))));
    if (tier === 'gpu') If(under.greaterThan(.01).and(depth.lessThan(1.25)), () => {
      const strength = under.mul(smoothstep(.03, .2, depth)).mul(float(1).sub(smoothstep(.4, 1.2, depth)));
      target.ground.mulAssign(causticWeb(xz, shoreTime).mul(strength).mul(1.4).add(1));
    });
  });
}

/**
 * River rocks on gpu and mobile: moss on upward faces, from the baked `moss` mask and the world normal after each rock's
 * lean, broken into patches that differ from rock to rock; and a dark wet band where a rock meets the river, glossy above it.
 * Vertex colours still multiply the colour, so the moss target divides them back out.
 */
export function rockShore(base: V3): { colorNode: V3; roughnessNode: F } {
  const y = positionWorld.y, patches = smoothstep(-.15, .3, gradientNoise(positionWorld.xz.mul(2.3).add(positionWorld.y)));
  const moss = attribute<'float'>('moss', 'float').mul(smoothstep(.3, .8, normalWorld.y)).mul(patches).mul(1.35).clamp(0, .92);
  const tone = gradientNoise(positionWorld.xz.mul(7.3)).mul(.5).add(1), green = vec3(.052, .085, .022).mul(tone).div(max(attribute<'vec3'>('color', 'vec3'), vec3(.05)));
  const wet = float(1).sub(smoothstep(.02, .26, y.sub(WATER_LEVEL))), under = smoothstep(0, .12, float(WATER_LEVEL).sub(y));
  return { colorNode: mix(base, green, moss).mul(mix(1, .58, wet)), roughnessNode: mix(1, .34, wet.mul(float(1).sub(under))).max(moss.mul(.9)) };
}
