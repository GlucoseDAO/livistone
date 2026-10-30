import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { ColliderSpec } from '../game/physics';
import { guardRail, solidMesh, walkwayGeometry } from './walkway';
import { STUMP_BRIDGES } from './stump-of-life-layout';

/** Visitor routes join the geographic islands and courtyard, separate from the engraved floor connections. */
export function createStumpBridges(parent: THREE.Group, colliders: ColliderSpec[], timber: THREE.Material, silver: THREE.Material): void {
  for (const bridge of STUMP_BRIDGES) {
    const width = bridge.width, group = new THREE.Group(); group.name = 'Stump of Life · ' + bridge.name; parent.add(group);
    const start = new THREE.Vector3(bridge.from.x, bridge.from.y, bridge.from.z), end = new THREE.Vector3(bridge.to.x, bridge.to.y, bridge.to.z), direction = end.clone().sub(start), side = new THREE.Vector3(-direction.z, 0, direction.x).normalize();
    const segments = Math.ceil(direction.length() / .3), points = Array.from({ length: segments + 1 }, (_, i) => start.clone().lerp(end, i / segments)), geometry = walkwayGeometry(points, width), p = geometry.getAttribute('position');
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(Array.from({ length: p.count }, (_, i) => [p.getX(i) / 2, p.getZ(i) / 2]).flat(), 2));
    solidMesh(group, colliders, geometry, timber, 'Continuous timber walking deck');
    const structure: THREE.BufferGeometry[] = [];
    for (const sign of [-1, 1]) {
      // At the Matsu fork a rail must stop where another walking deck joins it.
      // Rendering and collision use these same open rail runs.
      let run: THREE.Vector3[] = [];
      const flush = (): void => { if (run.length > 1) guardRail(group, colliders, run, silver); run = []; };
      for (const point of points.map(point => point.clone().addScaledVector(side, sign * (width / 2 - .06)))) {
        const junction = STUMP_BRIDGES.some(other => {
          if (other === bridge) return false;
          const dx = other.to.x - other.from.x, dz = other.to.z - other.from.z;
          const t = ((point.x - other.from.x) * dx + (point.z - other.from.z) * dz) / (dx * dx + dz * dz);
          return t >= -.04 && t <= 1.04 && Math.hypot(point.x - other.from.x - t * dx, point.z - other.from.z - t * dz) < other.width / 2 + .35;
        });
        if (junction) flush(); else run.push(point);
      }
      flush();
      const beam = new THREE.BoxGeometry(.14, .16, direction.length()).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction.clone().normalize()));
      beam.translate((start.x + end.x) / 2 + side.x * sign * .8, (start.y + end.y) / 2 - .12, (start.z + end.z) / 2 + side.z * sign * .8); structure.push(beam);
    }
    for (let i = 0; i < points.length; i += 6) {
      const point = points[i];
      for (const sign of [-1, 1]) {
        const height = point.y + 2.3, foot = point.clone().addScaledVector(side, sign * .8);
        structure.push(new THREE.CylinderGeometry(.075, .11, height, 8).translate(foot.x, -2.3 + height / 2 - .08, foot.z));
      }
    }
    const merged = mergeGeometries(structure.map(g => g.index ? g.toNonIndexed() : g))!;
    solidMesh(group, colliders, merged, timber, 'Buried timber supports'); structure.forEach(g => g.dispose());
    const joints: THREE.BufferGeometry[] = [];
    for (let i = 1; i < 32; i++) { const point = start.clone().lerp(end, i / 32); joints.push(new THREE.BoxGeometry(width, .003, .015).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), side)).translate(point.x, point.y + .002, point.z)); }
    const lines = new THREE.Mesh(mergeGeometries(joints)!, silver); lines.name = 'Timber deck joints'; group.add(lines); joints.forEach(g => g.dispose());
  }
}
