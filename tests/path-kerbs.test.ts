import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { pathKerbs } from '../src/world/path-kerbs';
import { PathNetwork } from '../src/world/path-network';
import { gatewayApproachWidth } from '../src/world/gateway-layout';
import { Physics } from '../src/game/physics';

const curves = [new THREE.LineCurve3(new THREE.Vector3(0, .13, -10), new THREE.Vector3(0, .13, 10)), new THREE.LineCurve3(new THREE.Vector3(0, .13, 0), new THREE.Vector3(10, .13, 0))];
function kerbs(network: PathNetwork, reduced: boolean): THREE.BufferGeometry {
  const { contours, paving } = network.surface(.5, () => .13); paving.forEach(g => g.dispose());
  return pathKerbs(contours, { surface: () => .13, edge: (x, z) => network.edge(x, z, 1), open: () => false, ends: network.freeEnds, reduced })[0];
}
describe('dimensional path borders', () => {
  it('places gateway kerbs outside the full apron and tapers to the normal path', () => {
    const curve = new THREE.LineCurve3(new THREE.Vector3(0, .13, 40), new THREE.Vector3(0, .13, 64));
    const geometry = kerbs(new PathNetwork([{ curve, width: p => gatewayApproachWidth(p.z) }]), false), p = geometry.getAttribute('position');
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
    const geometry = kerbs(new PathNetwork(curves.map(curve => ({ curve, width: 2.6 }))), reduced), p = geometry.getAttribute('position');
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
  it('turns the kerb round a junction fillet and leaves free ends open', () => {
    const network = new PathNetwork(curves.map(curve => ({ curve, width: 2.6 }))), geometry = kerbs(network, false), p = geometry.getAttribute('position');
    let corner = 0;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      // Nothing on the merged paving; the inner face rests on its edge.
      expect(network.edge(x, z, 1)).toBeGreaterThan(-.01);
      // Each stone sits right at the paving's edge, also round the fillets between the two strips.
      if (x > .3 && z > .3 && Math.hypot(x - 1.3, z - 1.3) < 1.6) corner++;
      // Kerbs stop short of the three free ends.
      for (const end of network.freeEnds) expect(Math.hypot(x - end.x, z - end.z)).toBeGreaterThan(1.7);
    }
    expect(corner).toBeGreaterThan(0); expect(network.freeEnds).toHaveLength(3);
    geometry.dispose();
  });
});
