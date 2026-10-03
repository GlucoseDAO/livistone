import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { acesFilmic, HORIZON_HAZE, HORIZON_RADIANCE, MOON_DIR, SKY_EXPOSURE, SUN_DIR } from '../src/world/sky';
import { mitoringAmberMaterial, mitoringSilverMaterial } from '../src/world/mitoring-materials';
import { gatewayMaterials } from '../src/world/gateway-materials';
import { cityHallCrystalMaterial, createCityHallFacade } from '../src/world/city-hall';
import { stationAmberMaterial } from '../src/world/station-amber';
import { waterMaterial } from '../src/world/water-material';

describe('sky coherence', () => {
  it('shares unit sun and moon directions above the horizon', () => {
    for (const direction of [SUN_DIR, MOON_DIR]) { expect(direction.length()).toBeCloseTo(1, 6); expect(direction.y).toBeGreaterThan(.3); }
  });

  it('pre-tone-maps the haze so fog lands on the displayed horizon', () => {
    // Sampled from day captures: the painted horizon renders as sRGB (212–214, 217–218, 218–220).
    expect(HORIZON_HAZE.day.getHexString(THREE.SRGBColorSpace)).toBe('d6dadc');
    expect(HORIZON_HAZE.night.getHexString(THREE.SRGBColorSpace)).toBe('0d1e35');
    expect(acesFilmic([0, 0, 0], SKY_EXPOSURE.day).getHex()).toBe(0);
    const [dim, bright] = [.2, 2].map(v => acesFilmic([v, v, v], 1).r); expect(bright).toBeGreaterThan(dim); expect(acesFilmic([40, 40, 40], 1).r).toBeLessThanOrEqual(1);
  });

  it('fogs toward the horizon radiance, which the output pass tone-maps onto the displayed haze', () => {
    // The painted sky just above the horizon: the day gradient base under the .38 haze band, and the night base.
    expect(HORIZON_RADIANCE.day.toArray().map(v => +v.toFixed(4))).toEqual([.7276, .8238, .8638]);
    expect(HORIZON_RADIANCE.night.toArray()).toEqual([.02, .04, .08]);
    for (const phase of ['day', 'night'] as const) {
      const radiance = HORIZON_RADIANCE[phase].toArray();
      expect(acesFilmic(radiance, SKY_EXPOSURE[phase]).getHex()).toBe(HORIZON_HAZE[phase].getHex());
    }
    // Fogging toward the mapped haze as if it were radiance would tone-map it twice: the dark night hills (#000719).
    expect(acesFilmic(HORIZON_HAZE.night.toArray(), SKY_EXPOSURE.night).getHexString(THREE.SRGBColorSpace)).toBe('000719');
  });

  it('tags hero materials so they keep their own reflection strength', () => {
    const gateway = gatewayMaterials(true), group = new THREE.Group(); createCityHallFacade(group, true);
    const hall = ['City Hall brass clasps', 'City Hall silver pins'].map(name => (group.getObjectByName(name) as THREE.Mesh).material as THREE.Material);
    const heroes = [mitoringAmberMaterial(true), mitoringSilverMaterial(), gateway.silver, gateway.gem, cityHallCrystalMaterial(true), stationAmberMaterial(true), waterMaterial('gpu'), ...hall];
    for (const material of heroes) expect(material.userData.heroEnv, material.name).toBe(true);
    expect(gateway.limestone.userData.heroEnv).toBeUndefined();
  });
});
