import { describe, expect, it } from 'vitest';
import { mitoringAmberMaterial, setMitoringAmberQuality } from '../src/world/mitoring-materials';

describe('Mitoring amber quality', () => {
  it('uses single-pass partial transparency without refraction or clearcoat in reduced detail', () => {
    const amber = mitoringAmberMaterial(true);
    expect(amber.transmission).toBe(0); expect(amber.clearcoat).toBe(0);
    expect(amber.transparent).toBe(true); expect(amber.opacity).toBeGreaterThan(.5); expect(amber.opacity).toBeLessThan(1);
    expect(amber.depthWrite).toBe(false); expect(amber.forceSinglePass).toBe(true);
    amber.dispose();
  });

  it('preserves amber absorption and active night emission through repeated quality changes', () => {
    const amber = mitoringAmberMaterial(false), absorption = amber.attenuationColor.getHex(), thickness = amber.thickness;
    amber.emissive.set(amber.userData.nightEmission.color); amber.emissiveIntensity = amber.userData.nightEmission.intensity;
    const glow = amber.emissive.getHex(), intensity = amber.emissiveIntensity;
    for (const low of [true, false, true, false]) {
      setMitoringAmberQuality(amber, low);
      expect(amber.transmission > 0).toBe(!low); expect(amber.clearcoat > 0).toBe(!low);
      expect(amber.attenuationColor.getHex()).toBe(absorption); expect(amber.thickness).toBe(thickness);
      expect(amber.emissive.getHex()).toBe(glow); expect(amber.emissiveIntensity).toBe(intensity);
    }
    amber.dispose();
  });
});
