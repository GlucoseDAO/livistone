import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { HORIZON_HAZE, HORIZON_RADIANCE, MOON_DIR, SKY_EXPOSURE, SKY_GAIN, SUN_DIR } from '../src/world/sky';
import { horizonMean, skyRadiance, transmittance } from '../src/world/atmosphere';
import { mitoringAmberMaterial, mitoringSilverMaterial } from '../src/world/mitoring-materials';
import { gatewayMaterials } from '../src/world/gateway-materials';
import { cityHallCrystalMaterial, createCityHallFacade } from '../src/world/city-hall';
import { stationAmberMaterial } from '../src/world/station-amber';
import { waterMaterial } from '../src/world/water-material';
import { NEUTRAL_GAIN, toneMapped, untoneMapped } from '../src/render/tone';

describe('sky coherence', () => {
  it('shares unit sun and moon directions above the horizon', () => {
    for (const direction of [SUN_DIR, MOON_DIR]) { expect(direction.length()).toBeCloseTo(1, 6); expect(direction.y).toBeGreaterThan(.3); }
  });

  it('pre-tone-maps the haze so fog lands on the displayed horizon', () => {
    // The horizon as the output pass shows it under Khronos PBR Neutral (sub-plan 21); the classic ACES fit showed d6dadc / 0d1e35.
    expect(HORIZON_HAZE.day.getHexString(THREE.SRGBColorSpace)).toBe('e2eff4');
    expect(HORIZON_HAZE.night.getHexString(THREE.SRGBColorSpace)).toBe('082a47');
    expect(toneMapped([0, 0, 0], SKY_EXPOSURE.day).getHex()).toBe(0);
    const [dim, bright] = [.2, 2].map(v => toneMapped([v, v, v], 1).r); expect(bright).toBeGreaterThan(dim); expect(toneMapped([40, 40, 40], 1).r).toBeLessThanOrEqual(1);
  });

  it('fogs toward the horizon radiance, which the output pass tone-maps onto the displayed haze', () => {
    // The painted sky just above the horizon: the day gradient base under the .38 haze band, and the night base.
    expect(HORIZON_RADIANCE.day.toArray().map(v => +v.toFixed(4))).toEqual([.7276, .8238, .8638]);
    expect(HORIZON_RADIANCE.night.toArray()).toEqual([.02, .04, .08]);
    for (const phase of ['day', 'night'] as const) {
      const radiance = HORIZON_RADIANCE[phase].toArray();
      expect(toneMapped(radiance, SKY_EXPOSURE[phase]).getHex()).toBe(HORIZON_HAZE[phase].getHex());
    }
    // Fogging toward the mapped haze as if it were radiance would tone-map it twice: dark night hills (#002746).
    expect(toneMapped(HORIZON_HAZE.night.toArray(), SKY_EXPOSURE.night).getHexString(THREE.SRGBColorSpace)).toBe('002746');
  });

  it('tone-maps with Neutral, matched at middle grey to the classic ACES fit the lights were tuned with', () => {
    // 18% grey at the day exposure displays as #7c7c7c, as it did under ACES; within one 8-bit level either side of the gain.
    expect(toneMapped([.18, .18, .18], SKY_EXPOSURE.day).getHexString(THREE.SRGBColorSpace)).toBe('7c7c7c');
    expect(NEUTRAL_GAIN).toBeGreaterThan(1.39); expect(NEUTRAL_GAIN).toBeLessThan(1.42);
    let previous = -1;
    for (let v = 0; v <= 8; v += .05) { const shown = toneMapped([v, v, v], 1).g; expect(shown).toBeGreaterThanOrEqual(previous - 1e-9); expect(shown).toBeLessThanOrEqual(1); previous = shown; }
  });

  it('inverts the tone curve, so additive halos raise the display by their own amount', () => {
    for (const radiance of [[.01, .02, .05], [.2, .3, .1], [.6, .7, .8], [.002, .001, .004], [1.2, .9, .4]]) {
      const shown = toneMapped(radiance, SKY_EXPOSURE.night).toArray();
      if (Math.max(...shown) > .98) continue;
      const again = toneMapped(untoneMapped(shown, SKY_EXPOSURE.night), SKY_EXPOSURE.night).toArray();
      again.forEach((v, i) => expect(Math.abs(v - shown[i]), `${radiance}`).toBeLessThan(4e-3));
    }
  });

  it('tags hero materials so they keep their own reflection strength', () => {
    const gateway = gatewayMaterials(true), group = new THREE.Group(); createCityHallFacade(group, true);
    const hall = ['City Hall brass clasps', 'City Hall silver pins'].map(name => (group.getObjectByName(name) as THREE.Mesh).material as THREE.Material);
    const heroes = [mitoringAmberMaterial(true), mitoringSilverMaterial(), gateway.silver, gateway.gem, cityHallCrystalMaterial(true), stationAmberMaterial(true), waterMaterial('gpu'), ...hall];
    for (const material of heroes) expect(material.userData.heroEnv, material.name).toBe(true);
    expect(gateway.limestone.userData.heroEnv).toBeUndefined();
  });

  it('calibrates the physical sky so its horizon meets the fog, and reddens a low sun by itself (sub-plan 26)', () => {
    const luma = (c: readonly number[]): number => c[0] * .2126 + c[1] * .7152 + c[2] * .0722;
    expect(luma(horizonMean(SUN_DIR)) * SKY_GAIN).toBeCloseTo(luma(HORIZON_RADIANCE.day.toArray()), 6);
    expect(SKY_GAIN).toBeGreaterThan(.7); expect(SKY_GAIN).toBeLessThan(1.4);
    // The zenith is a deeper, bluer sky than the horizon haze.
    const zenith = skyRadiance(new THREE.Vector3(0, 1, 0), SUN_DIR), horizon = horizonMean(SUN_DIR);
    expect(zenith[2] / zenith[0]).toBeGreaterThan(horizon[2] / horizon[0]); expect(luma(zenith)).toBeLessThan(luma(horizon));
    // Golden hour (05) needs only a sun direction: at 8° the sunlight is redder and dimmer than at today's 54°.
    const high = transmittance(0, SUN_DIR.y), low = transmittance(0, Math.sin(8 * Math.PI / 180));
    expect(low[0] / low[2]).toBeGreaterThan(high[0] / high[2] * 1.5); expect(low[1]).toBeLessThan(high[1]);
  });
});
