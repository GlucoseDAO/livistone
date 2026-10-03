import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ROCK_DETAIL, ROCK_STRETCH, createRiverRocks, inStream, rockColliders, rockGeometry, rockMatrix, rockReach, rockWeights, streamRockSites } from '../src/world/river-rocks';
import { riverRockSites } from '../src/world/stone';
import { layoutAllows } from '../src/world/landscape';
import { WATER_EDGE, WATER_LEVEL, waterSurfaceGeometry } from '../src/world/water-surface';
import { GARDEN_BRIDGES, waterDistance } from '../src/world/waterways';
import { terrainHeight, terrainSurfaceHeight, terrainSurfaceNormal, townTerrainGeometry } from '../src/world/terrain';
import type { RockSite } from '../src/world/water-surface';

/** The rendered surface of one rock: base positions plus its relative morph blend, under its instance transform. */
function renderedRock(geometry: THREE.BufferGeometry, site: RockSite): THREE.Mesh {
  const base = geometry.getAttribute('position'), targets = geometry.morphAttributes.position!, w = rockWeights(site), matrix = rockMatrix(site);
  const positions = new Float32Array(base.count * 3), p = new THREE.Vector3();
  for (let i = 0; i < base.count; i++) {
    p.fromBufferAttribute(base, i); targets.forEach((target, k) => { p.x += w[k] * target.getX(i); p.y += w[k] * target.getY(i); p.z += w[k] * target.getZ(i); });
    p.applyMatrix4(matrix).toArray(positions, i * 3);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(positions, 3)); g.setIndex(geometry.index!);
  return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
}
function lowest(mesh: THREE.Mesh): THREE.Vector3 {
  const p = mesh.geometry.getAttribute('position'), result = new THREE.Vector3(0, Infinity, 0);
  for (let i = 0; i < p.count; i++) if (p.getY(i) < result.y) result.set(p.getX(i), p.getY(i), p.getZ(i));
  return result;
}

describe('rounded river rock shapes', () => {
  for (const tier of ['gpu', 'mobile', 'cpu'] as const) it(`welds a smooth ${tier} icosphere with three relative morph variants and texture/moss attributes`, () => {
    const geometry = rockGeometry(ROCK_DETAIL[tier]), detail = ROCK_DETAIL[tier], position = geometry.getAttribute('position');
    expect(geometry.index!.count / 3).toBe(20 * (detail + 1) ** 2);
    expect(position.count).toBe(10 * (detail + 1) ** 2 + 2);
    for (const name of ['normal', 'uv', 'color', 'moss']) expect(geometry.getAttribute(name).count).toBe(position.count);
    expect(geometry.morphTargetsRelative).toBe(true);
    expect(geometry.morphAttributes.position).toHaveLength(3); expect(geometry.morphAttributes.normal).toHaveLength(3);
    // Every vertex is shared by its neighbouring faces (no faceted duplicates), and no shading crease is sharper than 45°.
    const keys = new Set<string>(); for (let i = 0; i < position.count; i++) keys.add([position.getX(i), position.getY(i), position.getZ(i)].map(v => v.toFixed(5)).join());
    expect(keys.size).toBe(position.count);
    const normal = geometry.getAttribute('normal'), index = geometry.index!, a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), face = new THREE.Triangle(), n = new THREE.Vector3(), v = new THREE.Vector3();
    for (let f = 0; f < index.count; f += 3) {
      face.set(a.fromBufferAttribute(position, index.getX(f)), b.fromBufferAttribute(position, index.getX(f + 1)), c.fromBufferAttribute(position, index.getX(f + 2))).getNormal(n);
      for (let k = 0; k < 3; k++) expect(v.fromBufferAttribute(normal, index.getX(f + k)).dot(n)).toBeGreaterThan(Math.cos(Math.PI / 4));
    }
    const moss = geometry.getAttribute('moss'), uv = geometry.getAttribute('uv');
    for (let i = 0; i < position.count; i++) {
      expect(moss.getX(i)).toBeGreaterThanOrEqual(0); expect(moss.getX(i)).toBeLessThanOrEqual(1);
      // Upper faces carry the moss; the stereographic UVs stay finite and continuous over everything above the buried pole.
      if (position.getY(i) < -.3) expect(moss.getX(i)).toBeLessThan(.2);
      if (position.getY(i) > -.2) { expect(Math.abs(uv.getX(i) - .5)).toBeLessThan(1); expect(Math.abs(uv.getY(i) - .5)).toBeLessThan(1); }
    }
  });
  it('keeps every blend inside the unit footprint that rockField and the clearances assume', () => {
    const geometry = rockGeometry(ROCK_DETAIL.gpu), base = geometry.getAttribute('position'), targets = geometry.morphAttributes.position!;
    const sites = riverRockSites(false), extent = new THREE.Vector3();
    for (const site of sites.slice(0, 120)) {
      const w = rockWeights(site); expect(w.every(x => x >= 0) && w[0] + w[1] + w[2] < 1).toBe(true);
      for (let i = 0; i < base.count; i++) {
        let x = base.getX(i), y = base.getY(i), z = base.getZ(i);
        targets.forEach((t, k) => { x += w[k] * t.getX(i); y += w[k] * t.getY(i); z += w[k] * t.getZ(i); });
        extent.set(Math.max(extent.x, Math.abs(x)), Math.max(extent.y, Math.abs(y)), Math.max(extent.z, Math.abs(z)));
      }
    }
    expect(extent.x).toBeLessThan(1.001); expect(extent.y).toBeLessThan(1.001); expect(extent.z).toBeLessThan(1.001);
    expect(extent.x).toBeGreaterThan(.9); expect(extent.z).toBeGreaterThan(.9);
  });
  it('draws all rocks as one instanced, morph-blended, shadow-casting mesh', () => {
    for (const mobile of [false, true]) {
      const sites = riverRockSites(mobile), rocks = createRiverRocks(sites, new THREE.MeshStandardMaterial({ vertexColors: true }), mobile ? 'mobile' : 'gpu');
      expect(rocks.count).toBe(sites.length); expect(rocks.morphTexture).not.toBeNull(); expect(rocks.instanceColor).not.toBeNull();
      expect(rocks.castShadow).toBe(true); expect(rocks.geometry.index!.count / 3).toBe(mobile ? 180 : 320);
      const matrix = new THREE.Matrix4(), weights = new THREE.Mesh(rocks.geometry);
      for (const i of [0, 7, sites.length - 1]) {
        rocks.getMatrixAt(i, matrix); rockMatrix(sites[i]).elements.forEach((value, k) => expect(matrix.elements[k]).toBeCloseTo(value, 5));
        rocks.getMorphAt(i, weights); weights.morphTargetInfluences!.forEach((value, k) => expect(value).toBeCloseTo(rockWeights(sites[i])[k], 6));
      }
    }
  });
});

describe('river rock placement', () => {
  const desktop = riverRockSites(false), mobile = riverRockSites(true);
  it('adds a few rocks standing in the shallow edge on both tiers, mobile taking a prefix of desktop', () => {
    const stream = desktop.filter(inStream), small = mobile.filter(inStream);
    expect(stream).toHaveLength(16); expect(small).toHaveLength(10);
    expect(small).toEqual(stream.slice(0, 10)); expect(streamRockSites(false)).toEqual(stream);
    expect(riverRockSites(false)).toEqual(desktop);
    // Bank rocks keep the seeded layout; only the few a stream rock would overlap give way.
    expect(desktop.length - stream.length).toBeGreaterThan(410); expect(mobile.length - small.length).toBeGreaterThan(220);
  });
  it('seats every stream rock in the bed and lets it break the surface, clear of bridges, routes and other rocks', () => {
    const geometry = rockGeometry(ROCK_DETAIL.gpu);
    for (const site of desktop.filter(inStream)) {
      const mesh = renderedRock(geometry, site); mesh.geometry.computeBoundingBox(); const box = mesh.geometry.boundingBox!, bottom = lowest(mesh);
      expect(waterDistance(site.x, site.z)).toBeLessThan(WATER_EDGE - .05);
      expect(box.min.y).toBeLessThan(WATER_LEVEL - .2); expect(box.max.y).toBeGreaterThan(WATER_LEVEL + .2);
      expect(bottom.y).toBeLessThan(terrainSurfaceHeight(bottom.x, bottom.z) - .02);
      // Settled against the bank, part of the way: never upright on the slope, never lying flat along it.
      const lean = Math.asin(Math.hypot(...site.lean!)) * 180 / Math.PI, slope = Math.acos(terrainSurfaceNormal(site.x, site.z).y) * 180 / Math.PI;
      expect(lean).toBeGreaterThan(slope * .25); expect(lean).toBeLessThan(slope * 1.01);
      const reach = rockReach(site.s);
      expect(Math.abs(site.x) >= 6 + reach || site.z < 8 || site.z > 46).toBe(true);
      for (const b of GARDEN_BRIDGES) expect(Math.abs(site.z - b.z) >= 5 + reach || Math.abs(site.x - b.x) >= 12 + reach).toBe(true);
      expect(layoutAllows(site.x, site.z, reach)).toBe(true);
      for (const other of desktop) if (other !== site) expect(Math.hypot(other.x - site.x, other.z - site.z)).toBeGreaterThan((rockReach(other.s) + reach) * .9);
    }
  });
  for (const mobileTier of [false, true]) it(`buries the underside of every ${mobileTier ? 'mobile' : 'desktop'} rock, so none floats on a slope or over the channel`, () => {
    const geometry = rockGeometry(ROCK_DETAIL[mobileTier ? 'mobile' : 'gpu']), base = geometry.getAttribute('position'), direction = new THREE.Vector3();
    const underside: number[] = []; for (let i = 0; i < base.count; i++) if (direction.fromBufferAttribute(base, i).normalize().y < -.45) underside.push(i);
    let worst = -Infinity;
    for (const site of mobileTier ? mobile : desktop) {
      const p = renderedRock(geometry, site).geometry.getAttribute('position');
      for (const i of underside) worst = Math.max(worst, p.getY(i) - terrainSurfaceHeight(p.getX(i), p.getZ(i)));
    }
    expect(worst).toBeLessThan(.03);
  });
  it('rests bank rocks on the triangulated ground rather than the analytic bank, sinking them only where a slope would lift them', () => {
    const sinks = desktop.filter(r => !inStream(r)).map(site => {
      const resting = Math.max(terrainSurfaceHeight(site.x, site.z) + site.s * .26, -.62 - site.s * .2);
      expect(site.lean).toBeUndefined(); expect(site.y).toBeLessThanOrEqual(resting + 1e-9); expect(resting - site.y).toBeLessThan(site.s * .5);
      return resting - site.y;
    }).sort((a, b) => a - b);
    expect(sinks[Math.floor(sinks.length / 2)]).toBeLessThan(.01);
  });
  it('stirs the baked water around every stream rock', () => {
    const water = waterSurfaceGeometry(desktop), bankOnly = waterSurfaceGeometry(desktop.filter(r => !inStream(r)));
    const position = water.getAttribute('position'), rock = water.getAttribute('rock');
    for (const site of desktop.filter(inStream)) {
      let foam = 0;
      for (let i = 0; i < position.count; i++) if (Math.hypot(position.getX(i) - site.x, position.getZ(i) - site.z) < rockReach(site.s) + 1 && rock.getX(i) > .95) foam++;
      expect(foam).toBeGreaterThan(2);
    }
    const stirred = (g: THREE.BufferGeometry): number => { const r = g.getAttribute('rock'); let n = 0; for (let i = 0; i < r.count; i++) if (r.getX(i) > .5) n++; return n; };
    expect(stirred(water)).toBeGreaterThan(stirred(bankOnly) + 100);
  });
});

describe('rock colliders', () => {
  const sites = riverRockSites(false), collider = rockColliders(sites);
  it('is one trimesh with a closed 80-triangle hull per rock', () => {
    expect(collider.type).toBe('mesh'); if (collider.type !== 'mesh') return;
    expect(collider.vertices.length).toBe(sites.length * 42 * 3); expect(collider.indices.length).toBe(sites.length * 80 * 3);
    expect(Math.max(...collider.indices)).toBe(sites.length * 42 - 1);
  });
  for (const tier of ['gpu', 'mobile', 'cpu'] as const) it(`agrees with the rendered ${tier} rock along rays from its centre`, () => {
    if (collider.type !== 'mesh') return;
    const geometry = rockGeometry(ROCK_DETAIL[tier]), ray = new THREE.Raycaster(), direction = new THREE.Vector3(), centre = new THREE.Vector3();
    let total = 0, error = 0;
    sites.forEach((site, r) => {
      if (r % 9 && !inStream(site)) return;
      const rendered = renderedRock(geometry, site), hull = new THREE.BufferGeometry();
      hull.setAttribute('position', new THREE.BufferAttribute(collider.vertices.slice(r * 42 * 3, (r + 1) * 42 * 3), 3));
      hull.setIndex(Array.from(collider.indices.slice(r * 240, (r + 1) * 240), n => n - r * 42));
      const solid = new THREE.Mesh(hull, rendered.material);
      centre.set(site.x, site.y, site.z);
      for (let i = 0; i < 26; i++) {
        // Directions spread over the sphere, in the rock's own stretched frame so flat rocks are probed evenly.
        const y = 1 - (i + .5) / 13, ring = Math.sqrt(1 - y * y), phi = i * 2.4 + r;
        direction.set(Math.cos(phi) * ring * ROCK_STRETCH[0], y * ROCK_STRETCH[1], Math.sin(phi) * ring * ROCK_STRETCH[2]).applyAxisAngle(new THREE.Vector3(0, 1, 0), site.yaw).normalize();
        ray.set(centre, direction);
        const seen = ray.intersectObject(rendered)[0], felt = ray.intersectObject(solid)[0];
        expect(seen).toBeDefined(); expect(felt).toBeDefined();
        const gap = felt.distance - seen.distance; error += Math.abs(gap); total++;
        expect(Math.abs(gap)).toBeLessThan(seen.distance * .1 + .01);
      }
    });
    expect(error / total).toBeLessThan(.035);
  });
});

describe('triangulated ground surface', () => {
  it('matches the walking terrain mesh and its face normals along the river', () => {
    const terrain = new THREE.Mesh(townTerrainGeometry(), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })), ray = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0);
    let seed = 3; const rand = (): number => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    for (let i = 0; i < 40; i++) {
      const x = (rand() - .5) * 180, z = -55 + rand() * 100;
      ray.set(new THREE.Vector3(x, 50, z), down); const hit = ray.intersectObject(terrain)[0];
      expect(terrainSurfaceHeight(x, z)).toBeCloseTo(hit.point.y, 4);
      expect(terrainSurfaceNormal(x, z).dot(hit.face!.normal.clone().transformDirection(terrain.matrixWorld).multiplyScalar(Math.sign(hit.face!.normal.y)))).toBeGreaterThan(.99999);
    }
    for (const [x, z] of [[4, 20], [-58, -12], [36, 30]]) expect(terrainSurfaceHeight(x, z)).toBeCloseTo(terrainHeight(x, z), 6);
    terrain.geometry.dispose();
  });
});
