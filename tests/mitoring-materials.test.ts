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

describe('Mitoring amber at night', () => {
  it('eases its own highlights past a knee by night only, keeping their hue, and keeps the roll-off through copies', () => {
    const amber = mitoringAmberMaterial(false), knee = amber.peak!.knee as unknown as { value: number };
    amber.userData.onNight(false); expect(knee.value).toBeGreaterThan(1e5);
    amber.userData.onNight(true); expect(knee.value).toBeLessThan(1); expect(amber.peak!.span).toBeGreaterThan(0);
    // Neutral turns radiance whose brightest channel passes about 2 toward white: the eased peak stays well below that.
    expect(knee.value + amber.peak!.span).toBeLessThan(2);
    expect((amber.clone() as typeof amber).peak).toBe(amber.peak);
    amber.userData.onNight(false); expect(knee.value).toBeGreaterThan(1e5);
    amber.dispose();
  });
});
