import * as THREE from 'three';
import { Fn, If, abs, attribute, cameraViewMatrix, clamp, cos, dFdx, dFdy, dot, float, floor, fract, length, max, mix, normalLocal, normalize, positionLocal, positionView, pow, property, select, sin, smoothstep, sqrt, step, texture, vec2, vec3, vec4, vertexStage } from 'three/tsl';
import type { Node } from 'three/webgpu';
import type { GraphicsTier } from '../game/graphics';

/**
 * Terrain ground shading (realism sub-plan 03), as TSL node builders for the terrain's node material:
 * - anti-tiling: gpu hex tiling (3 taps, Mikkelsen 2022), mobile a 2-tap rotated blend, cpu plain;
 * - two scales per layer, blended by view distance;
 * - macro meadow patches (30–80 m value noise, evaluated per vertex: ALU only);
 * - height-based blending of meadow, sparse grass, soil and rock;
 * - gpu: detail normals by reoriented normal blending, plus roughness; mobile: roughness only.
 * Each small builder below is one of the former GLSL functions; WGSL and the WebGL 2 fallback compile the same graph.
 */
export type GroundLook = 'a' | 'b';
export const GROUND_LAYERS = ['meadow', 'sparse', 'soil'] as const;

/** Dev-only `?ground=a|b` comparison switch (separate from the river's `?look`); production keeps the restrained look until the owner picks. */
export function groundLook(): GroundLook {
  if (!import.meta.env.DEV || typeof location === 'undefined') return 'a';
  return new URLSearchParams(location.search).get('ground') === 'b' ? 'b' : 'a';
}

/** Files under textures/ground/ for a tier: gpu 1024 px albedo + 512 px nrh; mobile 512 + 256; cpu albedo only. */
export function groundTextureFiles(tier: GraphicsTier): string[] {
  const albedo = tier === 'gpu' ? 1024 : 512;
  return GROUND_LAYERS.flatMap(layer => tier === 'cpu' ? [`${layer}-albedo-${albedo}.webp`] : [`${layer}-albedo-${albedo}.webp`, `${layer}-nrh-${albedo / 2}.webp`]);
}

// Means of the flattened derivatives, from public/textures/ground/sources.json (scripts/build-ground-textures.py).
const MEAN = { meadow: [.2787, .2056, .0933], sparse: [.0762, .046, .0083], soil: [.1266, .0922, .0348] };
const ROUGH = { meadow: .685, sparse: .943, soil: .92 };

// Final linear albedo targets. a: the approved subdued spring green, brought down to a plausible
// grass albedo; b: a richer meadow with stronger patches and more visible soil.
const LOOKS = {
  a: { meadow: [.155, .172, .056], lush: [.112, .15, .042], dry: [.2, .184, .068], clover: [.12, .158, .062], sparse: [.13, .11, .045], soil: .9,
    lushMix: .6, dryMix: .55, cloverMix: .45, value: .14, sparseDry: .3, bareDry: 0, wear: [.1, .25, .5], hue: .65, contrast: 1, normal: 1.8, roughFloor: .25, relief: .16, clumpValue: .18, hollow: [.8, .78, .74] },
  b: { meadow: [.138, .166, .048], lush: [.082, .132, .034], dry: [.24, .205, .075], clover: [.1, .152, .058], sparse: [.15, .12, .045], soil: 1,
    lushMix: 1, dryMix: 1, cloverMix: .7, value: .26, sparseDry: .65, bareDry: .4, wear: [.09, .22, .6], hue: .7, contrast: 1.1, normal: 2.3, roughFloor: .1, relief: .22, clumpValue: .26, hollow: [.72, .68, .62] },
};

type F = Node<'float'>; type V2 = Node<'vec2'>; type V3 = Node<'vec3'>;
// The former GLSL inlined its constants to four decimals; keep them identical.
const r4 = (n: number): number => +n.toFixed(4);
const v3 = (v: readonly number[]): V3 => vec3(r4(v[0]), r4(v[1]), r4(v[2]));
const LUMA = vec3(.2126, .7152, .0722);
const luma = (v: readonly number[]): number => r4(v[0] * .2126 + v[1] * .7152 + v[2] * .0722);
/** mat2(c, s, -s, c) * v; v * that matrix is rotate(v, c, -s). */
const rotate = (v: V2, c: number | F, s: number | F): V2 => vec2(v.x.mul(c).sub(v.y.mul(s)), v.x.mul(s).add(v.y.mul(c)));

// Hashes and value noise without sin(), so large world coordinates stay stable. Shared by both stages.
const hash12 = Fn(([p]: [V2]) => {
  const q = fract(vec3(p.x, p.y, p.x).mul(.1031)).toVar(); q.addAssign(dot(q, q.yzx.add(33.33)));
  return fract(q.x.add(q.y).mul(q.z));
}).setLayout({ name: 'groundHash12', type: 'float', inputs: [{ name: 'p', type: 'vec2' }] });
const hash22 = Fn(([p]: [V2]) => {
  const q = fract(vec3(p.x, p.y, p.x).mul(vec3(.1031, .1030, .0973))).toVar(); q.addAssign(dot(q, q.yzx.add(33.33)));
  return fract(vec2(q.x, q.x).add(q.yz).mul(q.zy));
}).setLayout({ name: 'groundHash22', type: 'vec2', inputs: [{ name: 'p', type: 'vec2' }] });
const valueNoise = Fn(([p]: [V2]) => {
  const i = floor(p).toVar(), f = fract(p), u = f.mul(f).mul(float(3).sub(f.mul(2))).toVar();
  return mix(mix(hash12(i), hash12(i.add(vec2(1, 0))), u.x), mix(hash12(i.add(vec2(0, 1))), hash12(i.add(vec2(1, 1))), u.x), u.y);
}).setLayout({ name: 'groundValueNoise', type: 'float', inputs: [{ name: 'p', type: 'vec2' }] });

/** Macro patches at 30–80 m: x lush, y dry (one signed moisture field, so they never cancel), z clover, w value. */
const macroField = Fn(([xz]: [V2]) => {
  const turned = rotate(xz, .8, .6).toVar();
  const moisture = valueNoise(xz.div(58).add(3.7)).mul(.65).add(valueNoise(turned.div(24).sub(11.2)).mul(.35)).toVar();
  const clover = valueNoise(turned.div(34).add(vec2(-23, 9))).mul(.7).add(valueNoise(xz.div(13).add(2)).mul(.3));
  const value = valueNoise(xz.div(80).add(vec2(17.1, -5.3))).mul(.6).add(valueNoise(turned.div(31).add(4.1)).mul(.4));
  // smoothstep(.5, .36, m) written as 1 - smoothstep(.36, .5, m): WGSL leaves reversed edges undefined.
  return vec4(smoothstep(.5, .64, moisture), float(1).sub(smoothstep(.36, .5, moisture)), smoothstep(.52, .68, clover), value);
}).setLayout({ name: 'groundMacroField', type: 'vec4', inputs: [{ name: 'xz', type: 'vec2' }] });

// Value noise with its analytic gradient (after Quilez): x value, yz d/dp.
const noiseGradient = Fn(([p]: [V2]) => {
  const i = floor(p).toVar(), f = fract(p).toVar(), u = f.mul(f).mul(float(3).sub(f.mul(2))).toVar(), du = f.mul(6).mul(float(1).sub(f));
  const a = hash12(i).toVar(), b = hash12(i.add(vec2(1, 0))).toVar(), c = hash12(i.add(vec2(0, 1))).toVar(), k = a.sub(b).sub(c).add(hash12(i.add(vec2(1, 1)))).toVar();
  return vec3(a.add(b.sub(a).mul(u.x)).add(c.sub(a).mul(u.y)).add(k.mul(u.x).mul(u.y)), du.mul(vec2(b.sub(a), c.sub(a)).add(k.mul(u.yx))));
}).setLayout({ name: 'groundNoiseGradient', type: 'vec3', inputs: [{ name: 'p', type: 'vec2' }] });
// Tussock relief at 0.4–1 m, which a photo tile cannot show from eye height: x height 0..1, yz slope per metre.
const clumpsOf = Fn(([xz]: [V2]) => {
  const a = noiseGradient(xz.div(.95)).toVar(), b = noiseGradient(rotate(xz, .8, .6).div(.41).add(7.3)).toVar();
  return vec3(a.x.mul(.62).add(b.x.mul(.38)), a.yz.mul(.62 / .95).add(rotate(b.yz, .8, -.6).mul(.38 / .41)));
}).setLayout({ name: 'groundClumps', type: 'vec3', inputs: [{ name: 'xz', type: 'vec2' }] });

/** One sampled layer: albedo, detail normal in layer space, roughness and height 0..1. */
interface Layer { albedo: V3; normal: V2; rough: F; height: F }
const layerVar = (rough: number, height: number): Layer => ({ albedo: vec3(0).toVar(), normal: vec2(0).toVar(), rough: float(rough).toVar(), height: float(height).toVar() });
const assignLayer = (target: Layer, source: Layer): void => { target.albedo.assign(source.albedo); target.normal.assign(source.normal); target.rough.assign(source.rough); target.height.assign(source.height); };
const mixLayers = (a: Layer, b: Layer, t: F): Layer => ({ albedo: mix(a.albedo, b.albedo, t), normal: mix(a.normal, b.normal, t), rough: mix(a.rough, b.rough, t), height: mix(a.height, b.height, t) });

// Packed nrh: normal.xy (OpenGL), roughness, height stored in alpha as .5 + h / 2. Explicit gradients keep every tap legal
// inside the branches below.
function tap(albedo: THREE.Texture, nrh: THREE.Texture, uv: V2, dx: V2, dy: V2): Layer {
  const n = texture(nrh, uv).grad(dx, dy);
  return { albedo: texture(albedo, uv).grad(dx, dy).rgb, normal: n.xy.mul(2).sub(1), rough: n.z, height: clamp(n.w.mul(2).sub(1), 0, 1) };
}
// Without an nrh map, value stands in for height and the layer keeps its mean roughness.
function colourTap(albedo: THREE.Texture, uv: V2, dx: V2, dy: V2, meanLuma: number, meanRough: number): Layer {
  const c = texture(albedo, uv).grad(dx, dy).rgb;
  return { albedo: c, normal: vec2(0), rough: float(meanRough), height: clamp(dot(c, LUMA).div(meanLuma).mul(.5), 0, 1) };
}

// Hex tiling after Mikkelsen, "Practical Real-Time Hex-Tiling" (JCGT 2022): each hexagon shows a randomly rotated and offset
// copy; the three nearest are blended with height-sharpened weights.
const HEX_DENSITY = .75;
function hexTap(albedo: THREE.Texture, nrh: THREE.Texture, uv: V2, dx: V2, dy: V2, vertex: V2): Layer {
  const centre = vec2(vertex.x.add(vertex.y.mul(.5)), vertex.y.mul(.8660254)).div(3.4641016 * HEX_DENSITY);
  const angle = hash12(vertex).sub(.5).mul(6.2831853), c = cos(angle).toVar(), s = sin(angle).toVar();
  const sample = tap(albedo, nrh, rotate(uv.sub(centre), c, s).add(centre).add(hash22(vertex.add(17))), rotate(dx, c, s), rotate(dy, c, s));
  return { ...sample, normal: rotate(sample.normal, c, s.negate()) }; // back from the copy's rotation into layer space
}
function hex(albedo: THREE.Texture, nrh: THREE.Texture, uv: V2, dx: V2, dy: V2): Layer {
  const st = uv.mul(HEX_DENSITY * 3.4641016), skewed = vec2(st.x.sub(st.y.mul(.57735027)), st.y.mul(1.15470054)).toVar(), base = floor(skewed).toVar();
  const t = fract(skewed).toVar(), tz = float(1).sub(t.x).sub(t.y), s = step(0, tz.negate()).toVar(), s2 = s.mul(2).sub(1);
  const w = vec3(tz.negate().mul(s2), s.sub(t.y.mul(s2)), s.sub(t.x.mul(s2)));
  const a = hexTap(albedo, nrh, uv, dx, dy, base.add(vec2(s, s))), b = hexTap(albedo, nrh, uv, dx, dy, base.add(vec2(s, float(1).sub(s)))), c = hexTap(albedo, nrh, uv, dx, dy, base.add(vec2(float(1).sub(s), s)));
  const aV = { albedo: a.albedo.toVar(), normal: a.normal.toVar(), rough: a.rough.toVar(), height: a.height.toVar() };
  const bV = { albedo: b.albedo.toVar(), normal: b.normal.toVar(), rough: b.rough.toVar(), height: b.height.toVar() };
  const cV = { albedo: c.albedo.toVar(), normal: c.normal.toVar(), rough: c.rough.toVar(), height: c.height.toVar() };
  const k = mix(vec3(1), vec3(aV.height, bV.height, cV.height).add(.2), .6).mul(pow(w, vec3(7))).toVar(); k.divAssign(dot(k, vec3(1)));
  k.assign(k.mul(k).mul(k)); k.divAssign(dot(k, vec3(1))); // narrow the blended seams so they keep the scan's contrast
  const sum = <T extends V3 | V2 | F>(x: T, y: T, z: T): T => x.mul(k.x).add(y.mul(k.y)).add(z.mul(k.z)) as T;
  return { albedo: sum(aV.albedo, bV.albedo, cV.albedo), normal: sum(aV.normal, bV.normal, cV.normal), rough: sum(aV.rough, bV.rough, cV.rough), height: sum(aV.height, bV.height, cV.height) };
}
// Mobile: a second rotated, offset copy masked by tile-scale noise, sharpened by value. One nrh tap follows whichever copy
// dominates (roughness and height only steer blending here).
function twoTap(albedo: THREE.Texture, nrh: THREE.Texture, uv: V2, dx: V2, dy: V2): Layer {
  const uvB = rotate(uv, .6, .8).add(vec2(.37, .61)).toVar(), dxB = rotate(dx, .6, .8), dyB = rotate(dy, .6, .8);
  const a = texture(albedo, uv).grad(dx, dy).rgb.toVar(), b = texture(albedo, uvB).grad(dxB, dyB).rgb.toVar();
  const t = smoothstep(.35, .65, valueNoise(uv.mul(1.3)).add(dot(b, LUMA).sub(dot(a, LUMA)).mul(1.5))).toVar(), useB = t.greaterThan(.5);
  const n = texture(nrh, select(useB, uvB, uv)).grad(select(useB, dxB, dx), select(useB, dyB, dy));
  return { albedo: mix(a, b, t), normal: vec2(0), rough: n.z, height: clamp(n.w.mul(2).sub(1), 0, 1) };
}

/** One layer at a near and a far scale, blended by view distance. scale = (near m, far m, rotation). */
function groundLayer(tier: GraphicsTier, albedo: THREE.Texture, nrh: THREE.Texture, xz: V2, dx: V2, dy: V2, scale: [number, number, number], far: F, meanLuma: number, meanRough: number): Layer {
  const c = Math.cos(scale[2]), s = Math.sin(scale[2]), uv = rotate(xz, c, s).toVar(), gx = rotate(dx, c, s).toVar(), gy = rotate(dy, c, s).toVar();
  const nearLayer = layerVar(meanRough, .5), farLayer = layerVar(meanRough, .5);
  If(far.lessThan(1), () => {
    const [u, x, y] = [uv.div(scale[0]), gx.div(scale[0]), gy.div(scale[0])];
    assignLayer(nearLayer, tier === 'gpu' ? hex(albedo, nrh, u, x, y) : tier === 'mobile' ? twoTap(albedo, nrh, u, x, y) : colourTap(albedo, u, x, y, meanLuma, meanRough));
  });
  If(far.greaterThan(0), () => {
    const uvFar = rotate(uv, .8, -.6).div(scale[1]).add(.31), x = rotate(gx, .8, -.6).div(scale[1]), y = rotate(gy, .8, -.6).div(scale[1]);
    if (tier === 'gpu') { const sample = tap(albedo, nrh, uvFar, x, y); assignLayer(farLayer, { ...sample, normal: rotate(sample.normal, .8, .6) }); }
    else assignLayer(farLayer, colourTap(albedo, uvFar, x, y, meanLuma, meanRough));
  });
  const blended = mixLayers(nearLayer, farLayer, far);
  return { ...blended, normal: rotate(blended.normal, c, -s) }; // layer space back to world x/z
}

// Height-aware splatting (after Mishkinis): a layer shows where its height plus weight leads, with a soft band.
function heightWeights(weights: V3, heights: V3, band: number): V3 {
  const a = heights.add(weights.mul(1.6)).toVar(), b = max(a.sub(max(max(a.x, a.y), a.z).sub(band)), 0).toVar();
  return b.div(max(dot(b, vec3(1)), 1e-4));
}
// Re-centre a scan on a palette colour, keeping its per-texel value and part of its own hue.
function tint(albedo: V3, mean: readonly number[], target: V3, hue: number, contrast: number): V3 {
  const meanLuma = luma(mean), value = max(dot(albedo, LUMA), 1e-4);
  return target.mul(pow(value.div(meanLuma), contrast)).mul(mix(vec3(1), albedo.div(value).div(v3(mean.map(m => m / meanLuma))), hue));
}
// Reoriented normal blending (Barré-Brisebois & Hill) of a ground-plane detail normal onto the surface normal.
function reorient(surface: V3, detail: V3): V3 {
  const n1 = vec3(surface.x, surface.z, surface.y.add(1)).toVar(), n2 = detail.mul(vec3(-1, -1, 1)).toVar();
  const r = n1.mul(dot(n1, n2)).div(n1.z).sub(n2).toVar();
  return normalize(vec3(r.x, r.z, r.y));
}

// What the colour stage leaves for the roughness and normal stages; each terrain shader declares its own copies.
const GROUND = {
  roughness: property('float', 'groundRoughness'), detail: property('vec2', 'groundDetail'), relief: property('vec2', 'groundRelief'), rock: property('float', 'groundRock'),
  weights: property('vec3', 'groundWeights'), p: property('vec3', 'groundP'), dpx: property('vec3', 'groundPdx'), dpy: property('vec3', 'groundPdy'),
};

export interface GroundMaps { albedo: THREE.Texture[]; nrh: THREE.Texture[]; rock: THREE.Texture; rockNormal: THREE.Texture | null }

/**
 * Nodes for the vertex-coloured terrain: colour on every tier, roughness on gpu and mobile, detail normals on gpu. The cpu
 * tier uses the colour on a Lambert node material. Vertex colours still multiply the result, as they did the GLSL patch.
 */
export function groundNodes(tier: GraphicsTier, look: GroundLook, maps: GroundMaps, grassVertexColour: THREE.Color): { colorNode: V3; roughnessNode: F | null; normalNode: V3 | null } {
  const L = LOOKS[look], [meadowAlbedo, sparseAlbedo, soilAlbedo] = maps.albedo, [meadowNrh, sparseNrh, soilNrh] = maps.nrh;
  const colorNode = Fn(() => {
    const n = normalize(normalLocal).toVar(), xz = positionLocal.xz.toVar(), dx = dFdx(xz).toVar(), dy = dFdy(xz).toVar();
    const p = positionLocal.mul(.065).toVar(); GROUND.p.assign(p); GROUND.dpx.assign(dFdx(p)); GROUND.dpy.assign(dFdy(p));
    const far = smoothstep(10, 40, positionView.length()).toVar(), macro = vertexStage(macroField(positionLocal.xz)).toVar(), soil = attribute<'float'>('groundSoil', 'float');
    // Clumps fade once a 0.4 m tussock spans only a few pixels.
    const clumpFade = float(1).sub(smoothstep(.025, .09, max(length(dx), length(dy)))).toVar(), clumps = vec3(.5, 0, 0).toVar();
    If(clumpFade.greaterThan(0), () => { clumps.assign(clumpsOf(xz)); });
    const clump = mix(.5, clumps.x, clumpFade).toVar(); GROUND.relief.assign(clumps.yz.mul(clumpFade));
    // Baked path wear and banks, plus look-dependent dry and bare patches. Sparse grass sits between the meadow and worn soil,
    // so paths fray instead of ending at a soft smear.
    const wear = smoothstep(r4(L.wear[0]), r4(L.wear[1]), soil).toVar();
    const soilW = clamp(wear.mul(r4(L.wear[2])).add(smoothstep(.3, .5, soil).mul(.5)).add(L.bareDry ? macro.y.mul(r4(L.bareDry)).mul(valueNoise(xz.div(6))) : 0), 0, 1).toVar();
    const sparseW = float(1).sub(soilW).mul(clamp(wear.add(macro.y.mul(r4(L.sparseDry))), 0, 1)).toVar();
    const layerW = vec3(float(1).sub(soilW).sub(sparseW), sparseW, soilW).toVar();
    const meadow = groundLayer(tier, meadowAlbedo, meadowNrh, xz, dx, dy, [2.5, 11, 0], far, luma(MEAN.meadow), r4(ROUGH.meadow));
    const meadowL = { albedo: meadow.albedo.toVar(), normal: meadow.normal.toVar(), rough: meadow.rough.toVar(), height: meadow.height.toVar() };
    const sparseL = layerVar(1, -2), soilL = layerVar(1, -2);
    // Heights are 0..1, so a layer more than (1 + band) / 1.6 behind the leader can never show; skip its taps.
    If(max(layerW.x, layerW.z).sub(sparseW).lessThan(.73), () => { assignLayer(sparseL, groundLayer(tier, sparseAlbedo, sparseNrh, xz, dx, dy, [2.8, 12, 1.9], far, luma(MEAN.sparse), r4(ROUGH.sparse))); });
    If(max(layerW.x, layerW.y).sub(soilW).lessThan(.73), () => { assignLayer(soilL, groundLayer(tier, soilAlbedo, soilNrh, xz, dx, dy, [2.1, 9, 4.2], far, luma(MEAN.soil), r4(ROUGH.soil))); });
    // Grass stands on the tussocks; worn soil and sparse grass collect in the hollows between them.
    const blendW = heightWeights(layerW, vec3(meadowL.height.add(clump.sub(.5).mul(.5)), sparseL.height, soilL.height.add(float(.5).sub(clump).mul(.3))), .18).toVar();
    const palette = mix(v3(L.meadow), v3(L.lush), macro.x.mul(r4(L.lushMix))).toVar();
    palette.assign(mix(palette, v3(L.dry), macro.y.mul(r4(L.dryMix))));
    palette.assign(mix(palette, v3(L.clover), macro.z.mul(r4(L.cloverMix)).mul(float(1).sub(macro.y))).mul(macro.w.sub(.5).mul(r4(L.value * 2)).add(1)));
    const ground = tint(meadowL.albedo, MEAN.meadow, palette, r4(L.hue), r4(L.contrast)).mul(blendW.x)
      .add(tint(sparseL.albedo, MEAN.sparse, v3(L.sparse).mul(macro.w.sub(.5).mul(.2).add(1)), .85, 1.15).mul(blendW.y))
      .add(soilL.albedo.mul(r4(L.soil)).mul(blendW.z)).toVar();
    // Tussock tops catch more light and fresh growth; hollows are shaded and browner.
    ground.mulAssign(mix(v3(L.hollow), vec3(r4(1 + L.clumpValue * .6)), smoothstep(.15, .85, clump)));
    // The vertex colours keep their baked freshness and shade; divide out their grass baseline.
    ground.divAssign(v3([grassVertexColour.r, grassVertexColour.g, grassVertexColour.b]));
    GROUND.detail.assign(meadowL.normal.mul(blendW.x).add(sparseL.normal.mul(blendW.y)).add(soilL.normal.mul(blendW.z)));
    const height = dot(blendW, vec3(meadowL.height, sparseL.height, soilL.height)).toVar();
    // Damp hollows in worn soil and lush patches are a little glossier.
    GROUND.roughness.assign(mix(dot(blendW, vec3(meadowL.rough, sparseL.rough, soilL.rough)), 1, r4(L.roughFloor)).sub(soilW.mul(float(1).sub(soilL.height)).mul(blendW.z).mul(.25)).sub(macro.x.mul(.05)));
    const weights = pow(abs(n), vec3(4)).toVar(); weights.divAssign(max(dot(weights, vec3(1)), .001)); GROUND.weights.assign(weights);
    const exposed = clamp(smoothstep(.18, .65, float(1).sub(abs(n.y))).add(smoothstep(58, 105, positionLocal.y).mul(.5)), 0, 1).toVar();
    GROUND.rock.assign(0);
    // Flat garden ground skips the rock taps; cliffs keep their triplanar detail.
    If(exposed.greaterThan(.01), () => {
      const rock = texture(maps.rock, p.yz).grad(GROUND.dpx.yz, GROUND.dpy.yz).rgb.mul(weights.x).add(texture(maps.rock, p.xz).grad(GROUND.dpx.xz, GROUND.dpy.xz).rgb.mul(weights.y)).add(texture(maps.rock, p.xy).grad(GROUND.dpx.xy, GROUND.dpy.xy).rgb.mul(weights.z)).toVar();
      GROUND.rock.assign(heightWeights(vec3(float(1).sub(exposed), exposed, 0), vec3(height, clamp(dot(rock, LUMA).mul(2.2), 0, 1), -2), .2).y);
      ground.assign(mix(ground, rock.mul(1.8), GROUND.rock)); GROUND.roughness.assign(mix(GROUND.roughness, .9, GROUND.rock));
    });
    return ground;
  })();
  if (tier === 'cpu') return { colorNode, roughnessNode: null, normalNode: null };
  const roughnessNode = clamp(GROUND.roughness, .4, 1);
  if (tier !== 'gpu' || !maps.rockNormal) return { colorNode, roughnessNode, normalNode: null };
  const rockNormal = maps.rockNormal;
  const normalNode = Fn(() => {
    const n = normalize(normalLocal).toVar(), w = GROUND.weights, p = GROUND.p;
    const detail = vec3(GROUND.detail.mul(r4(L.normal)).mul(float(1).sub(smoothstep(25, 90, positionView.length()).mul(.6))).sub(GROUND.relief.mul(r4(L.relief))), 0).toVar();
    detail.z.assign(sqrt(max(float(1).sub(dot(detail.xy, detail.xy)), .05)));
    const world = reorient(n, detail).toVar();
    If(GROUND.rock.greaterThan(.001), () => {
      const nx = texture(rockNormal, p.yz).grad(GROUND.dpx.yz, GROUND.dpy.yz).xy.mul(2).sub(1), ny = texture(rockNormal, p.xz).grad(GROUND.dpx.xz, GROUND.dpy.xz).xy.mul(2).sub(1), nz = texture(rockNormal, p.xy).grad(GROUND.dpx.xy, GROUND.dpy.xy).xy.mul(2).sub(1);
      const rockDetail = vec3(0, nx.y, nx.x).mul(w.x).add(vec3(ny.x, 0, ny.y).mul(w.y)).add(vec3(nz.x, nz.y, 0).mul(w.z));
      world.assign(normalize(mix(world, normalize(n.add(rockDetail.mul(.32))), GROUND.rock)));
    });
    return normalize(cameraViewMatrix.mul(vec4(world, 0)).xyz);
  })();
  return { colorNode, roughnessNode, normalNode };
}
