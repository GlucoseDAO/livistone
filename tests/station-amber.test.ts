import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { setStationAmberQuality, stationAmberCoreMaterial, stationAmberMaterial } from '../src/world/station-amber';

describe('Embryo station amber (sub-plan 28, round 2: deeper honey)', () => {
  it('darkens the stone toward its underside', () => {
    const map = stationAmberMaterial(true).map!, { data, width, height } = map.image as { data: Uint8Array; width: number; height: number };
    // v = .5 is the soffit (the section angle π), v = .25 a side.
    const row = (v: number): number => { let sum = 0; const y = Math.round(v * height); for (let x = 0; x < width; x++) sum += data[(y * width + x) * 4] + data[(y * width + x) * 4 + 1]; return sum / width; };
    expect(row(.5)).toBeLessThan(row(.25) * .75);
  });

  it('keeps its own optics per tier: the cored stone leaves the glow to its core, an opaque or coreless one glows by itself', () => {
    const rich = stationAmberMaterial(false), core = stationAmberCoreMaterial(rich), mobile = stationAmberMaterial(true);
    expect(rich.transmission).toBeGreaterThan(0); expect(mobile.transmission).toBe(0);
    expect(rich.colorNode).toBeTruthy(); expect(rich.emissiveNode).toBeTruthy(); expect(core.emissiveNode).toBeTruthy();
    const glow = (material: THREE.Material): number => material.userData.dayEmission.intensity;
    expect(glow(mobile)).toBeGreaterThan(glow(rich) * 3);
    setStationAmberQuality(rich, true); expect(rich.transmission).toBe(0); expect(glow(rich)).toBe(glow(mobile));
    // A phone set to rich detail has no core behind its stone: it turns transmissive but keeps glowing by itself.
    setStationAmberQuality(mobile, false); expect(mobile.transmission).toBeGreaterThan(0); expect(glow(mobile)).toBe(glow(rich));
    // The core and the stone glow more at night than by day.
    for (const material of [rich, core, mobile]) expect(material.userData.nightEmission.intensity).toBeGreaterThan(glow(material));
  });
});
