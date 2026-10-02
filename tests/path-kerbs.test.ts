import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { pathKerbs } from '../src/world/path-kerbs';
import { gatewayApproachWidth } from '../src/world/gateway-layout';
import { Physics } from '../src/game/physics';

const curves = [new THREE.LineCurve3(new THREE.Vector3(0, .13, -10), new THREE.Vector3(0, .13, 10)), new THREE.LineCurve3(new THREE.Vector3(0, .13, 0), new THREE.Vector3(10, .13, 0))];
describe('dimensional path borders', () => {
  it('places gateway kerbs outside the full apron and tapers to the normal path', () => {
    const curve = new THREE.LineCurve3(new THREE.Vector3(0, .13, 40), new THREE.Vector3(0, .13, 64));
    const geometry = pathKerbs([curve], p => gatewayApproachWidth(p.z), () => 0, () => false, false), p = geometry.getAttribute('position');
    let apron = 0, narrow = 0;
    for (let i = 0; i < p.count; i++) {
      const x = Math.abs(p.getX(i)), z = p.getZ(i);
      expect(x + .001).toBeGreaterThanOrEqual(gatewayApproachWidth(z) / 2);
      if (z > 48 && z < 53) { expect(x).toBeGreaterThanOrEqual(1.949); apron++; }
      if (z > 59) { expect(x).toBeLessThan(1.581); narrow++; }
    }
    expect(apron).toBeGreaterThan(0); expect(narrow).toBeGreaterThan(0); geometry.dispose();
  });
  for (const reduced of [false, true]) it(`leaves junctions open and permits walking over low kerbs (${reduced ? 'reduced' : 'rich'})`, async () => {
    const geometry = pathKerbs(curves, 2.6, () => 0, () => false, reduced), p = geometry.getAttribute('position');
    const physics = await Physics.create([{ type: 'box', position: [0, -.1, 0], size: [20, .1, 20] }, { type: 'mesh', vertices: new Float32Array(p.array), indices: Uint32Array.from({ length: p.count }, (_, i) => i) }]);
    try {
      physics.teleport({ x: 0, y: 1.05, z: 5 });
      for (let i = 0; i < 100; i++) physics.step(0, -3);
      expect(Math.abs(physics.position().z)).toBeLessThan(.2);
      for (let i = 0; i < 120; i++) physics.step(3, 0);
      expect(physics.position().x).toBeGreaterThan(5.8);
      for (let i = 0; i < 80; i++) physics.step(0, 3);
      expect(physics.position().z).toBeGreaterThan(3.7);
      expect(physics.position().y).toBeGreaterThan(.8);
      expect(p.count / 3).toBeLessThan(1200);
    } finally { physics.dispose(); geometry.dispose(); }
  });
});
