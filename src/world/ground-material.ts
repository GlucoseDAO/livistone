import * as THREE from 'three';
import type { GraphicsTier } from '../game/graphics';

/**
 * Terrain ground shading (realism sub-plan 03). One shader patch on the existing terrain material:
 * - anti-tiling: gpu hex tiling (3 taps, Mikkelsen 2022), mobile a 2-tap rotated blend, cpu plain;
 * - two scales per layer, blended by view distance;
 * - macro meadow patches (30–80 m value noise, evaluated per vertex: ALU only);
 * - height-based blending of meadow, sparse grass, soil and rock;
 * - gpu: detail normals by reoriented normal blending, plus roughness; mobile: roughness only.
 * The GLSL is kept in small self-contained functions so it can be ported to TSL later.
 */
export type GroundLook = 'a' | 'b';
export const GROUND_LAYERS = ['meadow', 'sparse', 'soil'] as const;

/** Dev-only `?look=a|b` comparison switch; production keeps the restrained look. */
export function groundLook(): GroundLook {
  if (!import.meta.env.DEV || typeof location === 'undefined') return 'a';
  return new URLSearchParams(location.search).get('look') === 'b' ? 'b' : 'a';
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

const vec3 = (v: readonly number[]): string => `vec3(${v.map(n => n.toFixed(4)).join(',')})`;
const float = (n: number): string => n.toFixed(4);

/** Shared by both stages: hashes and value noise without sin(), so large world coordinates stay stable. */
const NOISE = /* glsl */`
float groundHash12(vec2 p) { vec3 q = fract(vec3(p.xyx) * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
vec2 groundHash22(vec2 p) { vec3 q = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973)); q += dot(q, q.yzx + 33.33); return fract((q.xx + q.yz) * q.zy); }
float groundValueNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(groundHash12(i), groundHash12(i + vec2(1, 0)), u.x), mix(groundHash12(i + vec2(0, 1)), groundHash12(i + vec2(1, 1)), u.x), u.y);
}`;

/** Macro patches at 30–80 m: x lush, y dry (one signed moisture field, so they never cancel), z clover, w value. */
const MACRO = /* glsl */`
vec4 groundMacroField(vec2 xz) {
  const mat2 turn = mat2(.8, .6, -.6, .8);
  float moisture = groundValueNoise(xz / 58.0 + 3.7) * .65 + groundValueNoise(turn * xz / 24.0 - 11.2) * .35;
  float clover = groundValueNoise(turn * xz / 34.0 + vec2(-23.0, 9.0)) * .7 + groundValueNoise(xz / 13.0 + 2.0) * .3;
  float value = groundValueNoise(xz / 80.0 + vec2(17.1, -5.3)) * .6 + groundValueNoise(turn * xz / 31.0 + 4.1) * .4;
  return vec4(smoothstep(.5, .64, moisture), smoothstep(.5, .36, moisture), smoothstep(.52, .68, clover), value);
}`;

const SAMPLING = /* glsl */`
struct GroundLayer { vec3 albedo; vec2 normal; float rough; float height; };
const vec3 GROUND_LUMA = vec3(.2126, .7152, .0722);

mat2 groundRotation(float angle) { float c = cos(angle), s = sin(angle); return mat2(c, s, -s, c); }

// Value noise with its analytic gradient (after Quilez): x value, yz d/dp.
vec3 groundNoiseGradient(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f), du = 6.0 * f * (1.0 - f);
  float a = groundHash12(i), b = groundHash12(i + vec2(1, 0)), c = groundHash12(i + vec2(0, 1)), d = groundHash12(i + vec2(1, 1)), k = a - b - c + d;
  return vec3(a + (b - a) * u.x + (c - a) * u.y + k * u.x * u.y, du * (vec2(b - a, c - a) + k * u.yx));
}

// Tussock relief at 0.4–1 m, which a photo tile cannot show from eye height: x height 0..1, yz slope per metre.
vec3 groundClumps(vec2 xz) {
  const mat2 turn = mat2(.8, .6, -.6, .8);
  vec3 a = groundNoiseGradient(xz / .95), b = groundNoiseGradient(turn * xz / .41 + 7.3);
  return vec3(a.x * .62 + b.x * .38, a.yz * (.62 / .95) + (b.yz * turn) * (.38 / .41));
}

// Packed nrh: normal.xy (OpenGL), roughness, height stored in alpha as .5 + h / 2.
GroundLayer groundTap(sampler2D albedoMap, sampler2D nrhMap, vec2 uv, vec2 dx, vec2 dy) {
  vec4 n = textureGrad(nrhMap, uv, dx, dy);
  return GroundLayer(textureGrad(albedoMap, uv, dx, dy).rgb, n.xy * 2.0 - 1.0, n.z, clamp(n.w * 2.0 - 1.0, 0.0, 1.0));
}

// Without an nrh map, value stands in for height and the layer keeps its mean roughness.
GroundLayer groundColourTap(sampler2D albedoMap, vec2 uv, vec2 dx, vec2 dy, float meanLuma, float meanRough) {
  vec3 c = textureGrad(albedoMap, uv, dx, dy).rgb;
  return GroundLayer(c, vec2(0.0), meanRough, clamp(dot(c, GROUND_LUMA) / meanLuma * .5, 0.0, 1.0));
}

GroundLayer groundMix(GroundLayer a, GroundLayer b, float t) {
  return GroundLayer(mix(a.albedo, b.albedo, t), mix(a.normal, b.normal, t), mix(a.rough, b.rough, t), mix(a.height, b.height, t));
}

// Hex tiling after Mikkelsen, "Practical Real-Time Hex-Tiling" (JCGT 2022): each hexagon shows a
// randomly rotated and offset copy; the three nearest are blended with height-sharpened weights.
void groundHexGrid(vec2 st, out vec3 w, out vec2 v1, out vec2 v2, out vec2 v3) {
  st *= 3.4641016;
  vec2 skewed = vec2(st.x - .57735027 * st.y, 1.15470054 * st.y), base = floor(skewed);
  vec3 t = vec3(fract(skewed), 0.0); t.z = 1.0 - t.x - t.y;
  float s = step(0.0, -t.z), s2 = 2.0 * s - 1.0;
  w = vec3(-t.z * s2, s - t.y * s2, s - t.x * s2);
  v1 = base + vec2(s, s); v2 = base + vec2(s, 1.0 - s); v3 = base + vec2(1.0 - s, s);
}

GroundLayer groundHexTap(sampler2D albedoMap, sampler2D nrhMap, vec2 uv, vec2 dx, vec2 dy, vec2 vertex, float density) {
  vec2 centre = vec2(vertex.x + .5 * vertex.y, .8660254 * vertex.y) / (3.4641016 * density);
  mat2 r = groundRotation((groundHash12(vertex) - .5) * 6.2831853);
  GroundLayer s = groundTap(albedoMap, nrhMap, r * (uv - centre) + centre + groundHash22(vertex + 17.0), r * dx, r * dy);
  s.normal = s.normal * r; // back from the copy's rotation into layer space
  return s;
}

GroundLayer groundHex(sampler2D albedoMap, sampler2D nrhMap, vec2 uv, vec2 dx, vec2 dy) {
  const float density = .75;
  vec3 w; vec2 v1, v2, v3; groundHexGrid(uv * density, w, v1, v2, v3);
  GroundLayer a = groundHexTap(albedoMap, nrhMap, uv, dx, dy, v1, density), b = groundHexTap(albedoMap, nrhMap, uv, dx, dy, v2, density), c = groundHexTap(albedoMap, nrhMap, uv, dx, dy, v3, density);
  vec3 k = mix(vec3(1.0), vec3(a.height, b.height, c.height) + .2, .6) * pow(w, vec3(7.0)); k /= dot(k, vec3(1.0));
  k = k * k * k; k /= dot(k, vec3(1.0)); // narrow the blended seams so they keep the scan's contrast
  return GroundLayer(a.albedo * k.x + b.albedo * k.y + c.albedo * k.z, a.normal * k.x + b.normal * k.y + c.normal * k.z, a.rough * k.x + b.rough * k.y + c.rough * k.z, a.height * k.x + b.height * k.y + c.height * k.z);
}

// Mobile: a second rotated, offset copy masked by tile-scale noise, sharpened by value. One nrh tap
// follows whichever copy dominates (roughness and height only steer blending here).
GroundLayer groundTwoTap(sampler2D albedoMap, sampler2D nrhMap, vec2 uv, vec2 dx, vec2 dy) {
  const mat2 r = mat2(.6, .8, -.8, .6);
  vec2 uvB = r * uv + vec2(.37, .61);
  vec3 a = textureGrad(albedoMap, uv, dx, dy).rgb, b = textureGrad(albedoMap, uvB, r * dx, r * dy).rgb;
  float t = smoothstep(.35, .65, groundValueNoise(uv * 1.3) + (dot(b, GROUND_LUMA) - dot(a, GROUND_LUMA)) * 1.5);
  vec4 n = t > .5 ? textureGrad(nrhMap, uvB, r * dx, r * dy) : textureGrad(nrhMap, uv, dx, dy);
  return GroundLayer(mix(a, b, t), vec2(0.0), n.z, clamp(n.w * 2.0 - 1.0, 0.0, 1.0));
}

// One layer at a near and a far scale, blended by view distance. scale = (near m, far m, rotation).
GroundLayer groundLayer(sampler2D albedoMap, sampler2D nrhMap, vec2 xz, vec2 dx, vec2 dy, vec3 scale, float far, float meanLuma, float meanRough) {
  mat2 rot = groundRotation(scale.z);
  vec2 uv = rot * xz, gx = rot * dx, gy = rot * dy;
  GroundLayer nearLayer = GroundLayer(vec3(0.0), vec2(0.0), meanRough, .5), farLayer = nearLayer;
  if (far < 1.0) {
#if defined(GROUND_GPU)
    nearLayer = groundHex(albedoMap, nrhMap, uv / scale.x, gx / scale.x, gy / scale.x);
#elif defined(GROUND_MOBILE)
    nearLayer = groundTwoTap(albedoMap, nrhMap, uv / scale.x, gx / scale.x, gy / scale.x);
#else
    nearLayer = groundColourTap(albedoMap, uv / scale.x, gx / scale.x, gy / scale.x, meanLuma, meanRough);
#endif
  }
  if (far > 0.0) {
    mat2 turn = mat2(.8, -.6, .6, .8); vec2 uvFar = turn * uv / scale.y + .31;
#if defined(GROUND_GPU)
    farLayer = groundTap(albedoMap, nrhMap, uvFar, turn * gx / scale.y, turn * gy / scale.y); farLayer.normal = farLayer.normal * turn;
#else
    farLayer = groundColourTap(albedoMap, uvFar, turn * gx / scale.y, turn * gy / scale.y, meanLuma, meanRough);
#endif
  }
  GroundLayer s = groundMix(nearLayer, farLayer, far);
  s.normal = s.normal * rot; // layer space back to world x/z
  return s;
}

// Height-aware splatting (after Mishkinis): a layer shows where its height plus weight leads, with a soft band.
vec3 groundHeightWeights(vec3 weights, vec3 heights, float band) {
  vec3 a = heights + weights * 1.6;
  vec3 b = max(a - (max(max(a.x, a.y), a.z) - band), 0.0);
  return b / max(dot(b, vec3(1.0)), 1e-4);
}

// Re-centre a scan on a palette colour, keeping its per-texel value and part of its own hue.
vec3 groundTint(vec3 albedo, vec3 mean, vec3 target, float hue, float contrast) {
  float meanLuma = dot(mean, GROUND_LUMA), luma = max(dot(albedo, GROUND_LUMA), 1e-4);
  vec3 chroma = mix(vec3(1.0), (albedo / luma) / (mean / meanLuma), hue);
  return target * pow(luma / meanLuma, contrast) * chroma;
}

// Reoriented normal blending (Barré-Brisebois & Hill) of a ground-plane detail normal onto the surface normal.
vec3 groundReorient(vec3 surface, vec3 detail) {
  vec3 n1 = vec3(surface.x, surface.z, surface.y) + vec3(0.0, 0.0, 1.0), n2 = detail * vec3(-1.0, -1.0, 1.0);
  vec3 r = n1 * dot(n1, n2) / n1.z - n2;
  return normalize(vec3(r.x, r.z, r.y));
}`;

export interface GroundMaps { albedo: THREE.Texture[]; nrh: THREE.Texture[]; rock: THREE.Texture; rockNormal: THREE.Texture | null }

/** Patch a MeshStandardMaterial (or the CPU tier's Lambert copy) that renders the vertex-coloured terrain. */
export function groundShaderPatch(tier: GraphicsTier, look: GroundLook, maps: GroundMaps, grassVertexColour: THREE.Color): (shader: THREE.WebGLProgramParametersWithUniforms) => void {
  const L = LOOKS[look], gpu = tier === 'gpu', define = gpu ? '#define GROUND_GPU' : tier === 'mobile' ? '#define GROUND_MOBILE' : '#define GROUND_CPU';
  const luma = (v: readonly number[]): string => float(v[0] * .2126 + v[1] * .7152 + v[2] * .0722);
  return (shader) => {
    GROUND_LAYERS.forEach((layer, i) => { shader.uniforms[`${layer}Albedo`] = { value: maps.albedo[i] }; shader.uniforms[`${layer}Nrh`] = { value: maps.nrh[i] }; });
    shader.uniforms.rockColor = { value: maps.rock }; shader.uniforms.rockNormal = { value: maps.rockNormal };
    shader.vertexShader = 'attribute float groundSoil; varying float groundSoilWeight; varying vec3 groundPosition; varying vec3 groundNormal; varying vec4 groundMacro;\n' + NOISE + MACRO + '\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ngroundPosition = position; groundNormal = normal; groundSoilWeight = groundSoil; groundMacro = groundMacroField(position.xz);');
    shader.fragmentShader = `${define}
uniform sampler2D meadowAlbedo; uniform sampler2D meadowNrh; uniform sampler2D sparseAlbedo; uniform sampler2D sparseNrh; uniform sampler2D soilAlbedo; uniform sampler2D soilNrh;
uniform sampler2D rockColor; uniform sampler2D rockNormal;
varying float groundSoilWeight; varying vec3 groundPosition; varying vec3 groundNormal; varying vec4 groundMacro;
${NOISE}${SAMPLING}
` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', /* glsl */`
      vec3 groundN = normalize(groundNormal);
      vec2 groundXZ = groundPosition.xz, groundDx = dFdx(groundXZ), groundDy = dFdy(groundXZ);
      vec3 groundP = groundPosition * .065, groundPdx = dFdx(groundP), groundPdy = dFdy(groundP);
      float groundDistance = length(vViewPosition), groundFar = smoothstep(10.0, 40.0, groundDistance);
      vec4 macro = groundMacro;
      // Clumps fade once a 0.4 m tussock spans only a few pixels.
      float groundFootprint = max(length(groundDx), length(groundDy)), clumpFade = 1.0 - smoothstep(.025, .09, groundFootprint);
      vec3 clumps = clumpFade > 0.0 ? groundClumps(groundXZ) : vec3(.5, 0.0, 0.0);
      float clump = mix(.5, clumps.x, clumpFade);
      // Baked path wear and banks, plus look-dependent dry and bare patches. Sparse grass sits
      // between the meadow and worn soil, so paths fray instead of ending at a soft smear.
      float wear = smoothstep(${float(L.wear[0])}, ${float(L.wear[1])}, groundSoilWeight);
      float soilW = clamp(wear * ${float(L.wear[2])} + smoothstep(.3, .5, groundSoilWeight) * .5 + macro.y * ${float(L.bareDry)} * groundValueNoise(groundXZ / 6.0), 0.0, 1.0);
      float sparseW = (1.0 - soilW) * clamp(wear + macro.y * ${float(L.sparseDry)}, 0.0, 1.0);
      vec3 layerW = vec3(1.0 - soilW - sparseW, sparseW, soilW);
      GroundLayer meadowL = groundLayer(meadowAlbedo, meadowNrh, groundXZ, groundDx, groundDy, vec3(2.5, 11.0, 0.0), groundFar, ${luma(MEAN.meadow)}, ${float(ROUGH.meadow)});
      GroundLayer sparseL = GroundLayer(vec3(0.0), vec2(0.0), 1.0, -2.0), soilL = sparseL;
      // Heights are 0..1, so a layer more than (1 + band) / 1.6 behind the leader can never show; skip its taps.
      if (max(layerW.x, layerW.z) - sparseW < .73) sparseL = groundLayer(sparseAlbedo, sparseNrh, groundXZ, groundDx, groundDy, vec3(2.8, 12.0, 1.9), groundFar, ${luma(MEAN.sparse)}, ${float(ROUGH.sparse)});
      if (max(layerW.x, layerW.y) - soilW < .73) soilL = groundLayer(soilAlbedo, soilNrh, groundXZ, groundDx, groundDy, vec3(2.1, 9.0, 4.2), groundFar, ${luma(MEAN.soil)}, ${float(ROUGH.soil)});
      // Grass stands on the tussocks; worn soil and sparse grass collect in the hollows between them.
      vec3 blendW = groundHeightWeights(layerW, vec3(meadowL.height + (clump - .5) * .5, sparseL.height, soilL.height + (.5 - clump) * .3), .18);
      vec3 palette = mix(${vec3(L.meadow)}, ${vec3(L.lush)}, macro.x * ${float(L.lushMix)});
      palette = mix(palette, ${vec3(L.dry)}, macro.y * ${float(L.dryMix)});
      palette = mix(palette, ${vec3(L.clover)}, macro.z * ${float(L.cloverMix)} * (1.0 - macro.y)) * (1.0 + (macro.w - .5) * ${float(L.value * 2)});
      vec3 ground = groundTint(meadowL.albedo, ${vec3(MEAN.meadow)}, palette, ${float(L.hue)}, ${float(L.contrast)}) * blendW.x
        + groundTint(sparseL.albedo, ${vec3(MEAN.sparse)}, ${vec3(L.sparse)} * (1.0 + (macro.w - .5) * .2), .85, 1.15) * blendW.y
        + soilL.albedo * ${float(L.soil)} * blendW.z;
      // Tussock tops catch more light and fresh growth; hollows are shaded and browner.
      ground *= mix(${vec3(L.hollow)}, vec3(1.0 + ${float(L.clumpValue)} * .6), smoothstep(.15, .85, clump));
      // The vertex colours keep their baked freshness and shade; divide out their grass baseline.
      ground /= ${vec3([grassVertexColour.r, grassVertexColour.g, grassVertexColour.b])};
      vec2 groundDetail = meadowL.normal * blendW.x + sparseL.normal * blendW.y + soilL.normal * blendW.z;
      float groundHeight = dot(blendW, vec3(meadowL.height, sparseL.height, soilL.height));
      float groundRoughness = dot(blendW, vec3(meadowL.rough, sparseL.rough, soilL.rough));
      // Damp hollows in worn soil and lush patches are a little glossier.
      groundRoughness = mix(groundRoughness, 1.0, ${float(L.roughFloor)}) - soilW * (1.0 - soilL.height) * blendW.z * .25 - macro.x * .05;
      vec3 weights = pow(abs(groundN), vec3(4.0)); weights /= max(dot(weights, vec3(1.0)), .001);
      float exposed = clamp(smoothstep(.18, .65, 1.0 - abs(groundN.y)) + smoothstep(58.0, 105.0, groundPosition.y) * .5, 0.0, 1.0), rockW = 0.0;
      // Flat garden ground skips the rock taps; cliffs keep their triplanar detail.
      if (exposed > .01) {
        vec3 rock = textureGrad(rockColor, groundP.yz, groundPdx.yz, groundPdy.yz).rgb * weights.x + textureGrad(rockColor, groundP.xz, groundPdx.xz, groundPdy.xz).rgb * weights.y + textureGrad(rockColor, groundP.xy, groundPdx.xy, groundPdy.xy).rgb * weights.z;
        rockW = groundHeightWeights(vec3(1.0 - exposed, exposed, 0.0), vec3(groundHeight, clamp(dot(rock, GROUND_LUMA) * 2.2, 0.0, 1.0), -2.0), .2).y;
        ground = mix(ground, rock * 1.8, rockW); groundRoughness = mix(groundRoughness, .9, rockW);
      }
      diffuseColor.rgb *= ground;
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = clamp(groundRoughness, .4, 1.0);');
    if (gpu) shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', /* glsl */`
      vec3 groundDetailN = vec3(groundDetail * ${float(L.normal)} * (1.0 - smoothstep(25.0, 90.0, groundDistance) * .6) - clumps.yz * ${float(L.relief)} * clumpFade, 0.0);
      groundDetailN.z = sqrt(max(1.0 - dot(groundDetailN.xy, groundDetailN.xy), .05));
      vec3 groundWorldN = groundReorient(groundN, groundDetailN);
      if (rockW > .001) {
        vec2 nx = textureGrad(rockNormal, groundP.yz, groundPdx.yz, groundPdy.yz).xy * 2.0 - 1.0, ny = textureGrad(rockNormal, groundP.xz, groundPdx.xz, groundPdy.xz).xy * 2.0 - 1.0, nz = textureGrad(rockNormal, groundP.xy, groundPdx.xy, groundPdy.xy).xy * 2.0 - 1.0;
        vec3 rockDetail = vec3(0.0, nx.y, nx.x) * weights.x + vec3(ny.x, 0.0, ny.y) * weights.y + vec3(nz.x, nz.y, 0.0) * weights.z;
        groundWorldN = normalize(mix(groundWorldN, normalize(groundN + rockDetail * .32), rockW));
      }
      normal = normalize(mat3(viewMatrix) * groundWorldN);
    `);
  };
}
