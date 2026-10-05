// The scene's light, fog and shadow constants and the loading view the probe bakes look from. They live here rather than in
// main.ts because saved reflection probes (scripts/probe-signature.ts) hash src/render but only main.ts's bake methods: a
// change here must invalidate the probes, a change to the HUD must not.
import type { SkyPhase } from '../world/sky';

// The map's range fog; walking, the cpu tier fogs linearly from CPU_FOG_NEAR to its full-fog distance (GraphicsProfile.fog).
export const MAP_FOG = { near: 240, far: 630 }, CPU_FOG_NEAR = 42;
// Walking with the distant ranges (sub-plan 26): the valley mist's altitude band on them in metres, and their haze per metre.
export const MIST = { low: 25, high: 150, aerial: 1.2e-4 };
// The physical day sky (sub-plan 26) lights about a quarter less than the painted one, its zenith being a deeper blue: this
// keeps the town's shade as bright as before (arrival-meadow and meadow-ground matched within one grey level).
export const PHYSICAL_DAY_FILL = 1.35;
// Sub-plan 21 (the owner chose its moderate contrast): a stronger sun against a weaker sky fill, so cast shadows read as
// shadows. Horizontal sunlit ground keeps its old brightness while shade loses about a third: sunlit to shaded about 2.8:1,
// from 1.8:1. Moonlight is rebalanced the same way at the same overall level; emissions are untouched.
export type Light = { sun: number; environment: number; hemi: number };
export const LIGHT: Record<SkyPhase, Light> = { day: { sun: 3.35, environment: .6, hemi: .36 }, night: { sun: .42, environment: .24, hemi: .17 } };
// The cpu tier has no environment light and no shadows: its hemisphere carries the fill, and the contrast shows in form shading.
export const CPU_LIGHT: Record<SkyPhase, Light> = { day: { sun: 2.75, environment: 0, hemi: .92 }, night: { sun: .38, environment: 0, hemi: .22 } };
// 02's look a, before the sky carried the fill.
export const LEGACY_LIGHT: Record<SkyPhase, Light> = { day: { sun: 2.4, environment: .5, hemi: 1.2 }, night: { sun: .32, environment: .2, hemi: .28 } };
/** Sun (or moon) colour and the hemisphere's sky and ground colours per phase. */
export const LIGHT_COLOUR: Record<SkyPhase, { sun: string; sky: string; ground: string }> = {
  day: { sun: '#fff0ce', sky: '#e9f4f0', ground: '#73805c' }, night: { sun: '#c9d6ee', sky: '#8ea4c6', ground: '#121820' },
};
/** Sun (or moon), sky environment and hemisphere strengths for a phase. CPU has no PMREM environment: its hemisphere fills. */
export function phaseLight(phase: SkyPhase, cpu: boolean, legacy: boolean, classicSky: boolean): Light {
  const light = (cpu ? CPU_LIGHT : legacy ? LEGACY_LIGHT : LIGHT)[phase];
  return phase === 'night' || classicSky ? light : { ...light, environment: light.environment * PHYSICAL_DAY_FILL };
}
// The map shadow box stays on the town centre; walking boxes follow the player.
export const SHADOW_TARGET = [0, 0, -60] as const;
// Far enough along the light that the ±160 m map box keeps every caster and receiver between near and far for suns above ~20°.
export const SUN_DISTANCE = 400;
// Walking boxes trade reach for ~5 cm (2048) and ~8 cm (1024) texels, led ahead of the view so the edge falls into the fog; the map keeps the whole town.
// The depth bias is a fixed few centimetres in world units; the normal offset follows texel size.
// Shadows fade out between 72% and 90% of the walking half-size: with the lead and the quarter-box re-bake drift, that band stays inside the box across the whole view.
export const SHADOW = { walk: 50, walkReduced: 40, map: 160, lead: .3, fade: [.72, .9], bias: .05, normalBias: .6, size: 2048, reducedSize: 1024 };
/** The loading map's view, which the probe bakes copy: position, the point it looks at, and its field of view (wide, narrow screens). */
export const LOADING_VIEW = { position: [62, 44, 69], target: [0, 2, -13], fov: 44, narrowFov: 72 } as const;
