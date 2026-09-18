import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { stationRingGeometry } from '../src/world/station-ring';
import { STATION_LOCAL as STATION } from '../src/world/station-layout';

describe('Embryo ring shank', () => {
  for (const mobile of [false, true]) it(`has actual openwork through a deep curved wall (${mobile ? 'mobile' : 'desktop'})`, () => {
    const geometry = stationRingGeometry(mobile), material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    const ring = new THREE.Mesh(geometry, material), ray = new THREE.Raycaster(); ring.updateMatrixWorld(); ray.far = 9;
    try {
      // Rays start inside the band, behind the front lip. A flat washer with holes
      // punched through its face cannot provide these alternating solid/open rays.
      for (const depth of [1.15, 2.2, 3.2]) {
        let silver = 0, openings = 0;
        for (let i = 0; i < 40; i++) {
          const a = 1 + i / 39 * 4.3;
          ray.set(new THREE.Vector3(STATION.entranceX, 6.45, STATION.entranceZ - depth), new THREE.Vector3(Math.sin(a), Math.cos(a), 0));
          if (ray.intersectObject(ring).length) silver++; else openings++;
        }
        expect(silver).toBeGreaterThan(6); expect(openings).toBeGreaterThan(3);
      }
      ray.far = 12; ray.set(new THREE.Vector3(STATION.entranceX, 6.45, STATION.entranceZ + 3), new THREE.Vector3(0, 0, -1));
      expect(ray.intersectObject(ring)).toHaveLength(0);
    } finally { geometry.dispose(); material.dispose(); }
  });
});
