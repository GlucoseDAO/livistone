import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { graphicsProfile } from '../src/game/graphics';
import { addGlow, NightLighting } from '../src/world/night-lighting';
import { STATION_FITTINGS } from '../src/world/station-layout';
import { createStationStructure } from '../src/world/station';

describe('Night lighting', () => {
  it('keeps a fixed pool of lights and hands each to a nearer source without a jump', () => {
    const root = new THREE.Group(), scene = new THREE.Scene(), count = graphicsProfile('mobile').lights;
    // One more source than lights, 5 m apart along a walk: every step past the middle swaps one.
    for (let i = 0; i <= count; i++) addGlow(root, new THREE.Vector3(i * 5, 3, 0), '#ffcf79', 4.5, 36, 10);
    const lighting = new NightLighting(root, scene, true, 'mobile'); lighting.setNight(true);
    const lights = scene.children.filter((object): object is THREE.PointLight => object instanceof THREE.PointLight);
    expect(lights).toHaveLength(count);
    const camera = new THREE.PerspectiveCamera(), at = (): Map<number, number> => {
      const shares = new Map<number, number>();
      for (const light of lights) shares.set(Math.round(light.position.x), (shares.get(Math.round(light.position.x)) ?? 0) + light.intensity);
      return shares;
    };
    let previous: Map<number, number> | undefined, largest = 0, faded = 0;
    for (let x = -10; x <= count * 5 + 10; x += .05) {
      camera.position.set(x, 1.6, 0); lighting.update(camera);
      const shares = at();
      if (previous) for (let i = 0; i <= count; i++) largest = Math.max(largest, Math.abs((shares.get(i * 5) ?? 0) - (previous.get(i * 5) ?? 0)));
      faded = Math.max(faded, ...[...shares.values()].map(intensity => intensity > 0 && intensity < 30 ? 1 : 0));
      previous = shares;
    }
    // Without the fade a swap moved all 36 at once; the walk's 5 cm steps now change any source by under 2.
    expect(largest).toBeLessThan(2); expect(faded).toBe(1); expect(scene.children.filter(object => object instanceof THREE.PointLight)).toHaveLength(count);
  });

  it('gives every platform lamp of the detailed station a halo and a light source', () => {
    const root = new THREE.Group();
    createStationStructure(root, [], false, new THREE.MeshStandardMaterial());
    const halos: THREE.Sprite[] = [];
    root.traverse(object => { if (object instanceof THREE.Sprite && object.userData.nightGlow) halos.push(object); });
    for (const [x, z] of STATION_FITTINGS.lamps) {
      const halo = halos.find(sprite => Math.hypot(sprite.position.x - x, sprite.position.z - z) < .01);
      expect(halo, `lamp at ${x}, ${z}`).toBeDefined(); expect(halo!.userData.lightSource.intensity).toBeGreaterThan(0);
    }
    root.traverse(object => { if (object instanceof THREE.Mesh) object.geometry.dispose(); });
  });
});
