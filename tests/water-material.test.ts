import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { WATER_EDGE, WATER_LEVEL, waterDepth, waterFlow, waterSurfaceGeometry } from '../src/world/water-surface';
import { cpuWaterColour, waterMaterial } from '../src/world/water-material';
import { riverRockSites } from '../src/world/stone';
import { riverCenter, tributaryCenter, waterDistance } from '../src/world/waterways';
import { terrainHeight } from '../src/world/terrain';

const tangent = (f: (t: number) => number, t: number): [number, number] => { const d = (f(t + .01) - f(t - .01)) / .02, l = Math.hypot(1, d); return [1 / l, d / l]; };
const luminance = (c: THREE.Color): number => c.r * .2126 + c.g * .7152 + c.b * .0722;
const angle = (a: { x: number; z: number }, b: { x: number; z: number }): number => Math.acos(Math.min(1, a.x * b.x + a.z * b.z));

describe('baked river flow', () => {
  it('points downstream along the main river and both tributaries, as a unit tangent', () => {
    // Away from the two confluences near x = ±60, where the flow turns.
    for (const x of [-420, -150, -100, -35, 0, 12, 35, 90, 300]) for (const offset of [-5, 0, 5]) {
      const flow = waterFlow(x, riverCenter(x) + offset), [tx, tz] = tangent(riverCenter, x);
      expect(Math.hypot(flow.x, flow.z)).toBeCloseTo(1, 6);
      expect(flow.x).toBeGreaterThan(.9);
      // Within the 7 m half-width the nearest centreline point stays close to the same x.
      if (!offset) expect(flow.x * tx + flow.z * tz).toBeGreaterThan(.9999);
      expect(waterFlow(x + 2, riverCenter(x + 2) + offset).along).toBeGreaterThan(flow.along);
    }
    for (const side of [-1, 1]) for (const z of [-54, -40, -25, -12, 0, 10]) for (const offset of [-2, 0, 2]) {
      const flow = waterFlow(tributaryCenter(z, side) + offset, z);
      expect(Math.hypot(flow.x, flow.z)).toBeCloseTo(1, 6);
      // Tributaries run south (+z) into the river.
      expect(flow.z).toBeGreaterThan(.88);
      expect(waterFlow(tributaryCenter(z + 2, side) + offset, z + 2).along).toBeGreaterThan(flow.along);
    }
  });
  it('turns each tributary smoothly into the river with no jump in direction or distance', () => {
    for (const side of [-1, 1]) {
      let previous = waterFlow(tributaryCenter(5, side), 5);
      for (let z = 5.5; z <= 26; z += .5) {
        const flow = waterFlow(tributaryCenter(z, side), z);
        expect(angle(previous, flow)).toBeLessThan(.3);
        expect(Math.abs(flow.along - previous.along)).toBeLessThan(1.5);
        previous = flow;
      }
      // By the river's centreline the junction has become the main river's eastward flow.
      expect(previous.x).toBeGreaterThan(.9);
    }
  });
});

describe('baked river surface', () => {
  const rocks = riverRockSites(false), geometry = waterSurfaceGeometry(rocks);
  const position = geometry.getAttribute('position'), flow = geometry.getAttribute('flow'), depth = geometry.getAttribute('depth'), rock = geometry.getAttribute('rock');
  it('carries unit flow, non-negative depth and rock proximity on every vertex inside the shared bank outline', () => {
    expect(position.count).toBeGreaterThan(10000);
    for (const name of ['flow', 'along', 'across', 'depth', 'rock', 'normal']) expect(geometry.getAttribute(name).count).toBe(position.count);
    let deepest = 0, stirred = 0, corners = 0;
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i), z = position.getZ(i);
      expect(position.getY(i)).toBeCloseTo(WATER_LEVEL, 6);
      // Clip points interpolate the curved distance field linearly along 1 m cell edges: millimetres off,
      // except a few at the inner corners of the two confluences, where the field has a kink.
      const outside = waterDistance(x, z) - WATER_EDGE; expect(outside).toBeLessThan(.35); if (outside > .01) corners++;
      expect(Math.hypot(flow.getX(i), flow.getY(i))).toBeCloseTo(1, 5);
      expect(depth.getX(i)).toBeGreaterThanOrEqual(0);
      expect(depth.getX(i)).toBeCloseTo(Math.max(0, WATER_LEVEL - terrainHeight(x, z)), 3);
      expect(rock.getX(i)).toBeGreaterThanOrEqual(0); expect(rock.getX(i)).toBeLessThanOrEqual(1);
      deepest = Math.max(deepest, depth.getX(i)); if (rock.getX(i) > 0) stirred++;
    }
    expect(corners).toBeLessThan(12);
    expect(deepest).toBeCloseTo(1.58, 2);
    expect(stirred).toBeGreaterThan(0);
  });
  it('fades to zero depth on the bank outline and deepens toward the channel floor', () => {
    let edges = 0;
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i), z = position.getZ(i), d = waterDistance(x, z);
      if (Math.abs(d - WATER_EDGE) < .01) { edges++; expect(depth.getX(i)).toBeLessThan(.01); }
      if (d < -2.7) expect(depth.getX(i)).toBeGreaterThan(1.55);
    }
    expect(edges).toBeGreaterThan(1000);
    for (const x of [-80, 0, 50]) {
      let last = -1;
      for (let offset = 6.7; offset > 3; offset -= .25) { const value = waterDepth(x, riverCenter(x) + offset); expect(value).toBeGreaterThanOrEqual(last); last = value; }
    }
  });
});

describe('water materials', () => {
  it('blends gpu and mobile water over the bed through its own lighting output and tags it for the hero environment', () => {
    const materials = new Set<THREE.Material>();
    for (const tier of ['gpu', 'mobile'] as const) for (const look of ['a', 'b'] as const) {
      const material = waterMaterial(tier, { look }) as THREE.MeshPhysicalNodeMaterial;
      expect(material.isMeshPhysicalNodeMaterial).toBe(true); expect(material.ior).toBeCloseTo(1.333, 6);
      expect(material.transparent).toBe(true); expect(material.depthWrite).toBe(false); expect(material.side).toBe(THREE.FrontSide);
      expect(material.userData.heroEnv).toBe(true); expect(material.userData.time.value).toBe(0); expect(material.userData.time.isNode).toBe(true);
      expect(material.userData.look).toBe(look); expect(material.userData.layers).toBe(tier === 'gpu' ? 2 : 1);
      // The surface stage sets body colour, ripple normal and foam roughness; the lighting model rebuilds the output and alpha.
      for (const node of [material.colorNode, material.normalNode, material.roughnessNode]) expect(node?.isNode).toBe(true);
      const lighting = (material as unknown as { setupLightingModel(): THREE.PhysicalLightingModel }).setupLightingModel();
      expect(lighting).toBeInstanceOf(THREE.PhysicalLightingModel); expect(lighting.constructor.name).toBe('WaterLighting');
      materials.add(material);
    }
    expect(materials.size).toBe(4);
  });
  it('keeps cpu water opaque, with absorption baked from depth into vertex colours', () => {
    const material = waterMaterial('cpu', { look: 'a' });
    expect(material).toBeInstanceOf(THREE.MeshLambertMaterial); expect(material.transparent).toBe(false); expect((material as THREE.MeshLambertMaterial).vertexColors).toBe(true);
    const colour = cpuWaterColour('a'), bank = colour(0, 0), mid = colour(.6, 0), deep = colour(1.58, 0);
    // The wet olive bank turns into a bluer, lighter body as the water deepens.
    expect(bank.b / bank.r).toBeLessThan(mid.b / mid.r); expect(mid.b / mid.r).toBeLessThan(deep.b / deep.r);
    expect(luminance(deep)).toBeGreaterThan(luminance(bank));
    const geometry = waterSurfaceGeometry([], colour, 2);
    expect(geometry.getAttribute('color').count).toBe(geometry.getAttribute('position').count);
  });
});
