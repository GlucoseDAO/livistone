import * as THREE from 'three';
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { groundNodes } from '../src/world/ground-material';
import { channelDistance, rockShore, shoreTextureFiles, shoreTime } from '../src/world/shore-nodes';
import { ROCK_DETAIL, createRiverRocks, rockGeometry } from '../src/world/river-rocks';
import { riverRockSites } from '../src/world/stone';
import { waterDistance } from '../src/world/waterways';
import { uniform } from 'three/tsl';
import type { Node } from 'three/webgpu';

const texture = (): THREE.Texture => new THREE.DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1);

/**
 * Evaluates a scalar TSL graph on the CPU, for the few node kinds a channel formula uses. Anything else throws, so a rewrite of
 * the shader that this cannot read fails here instead of passing unchecked.
 */
type Value = number | boolean | number[];
interface GraphNode { isConstNode?: boolean; isUniformNode?: boolean; isVarNode?: boolean; isSplitNode?: boolean; isOperatorNode?: boolean; isMathNode?: boolean; condNode?: GraphNode; ifNode?: GraphNode; elseNode?: GraphNode; node?: GraphNode; aNode?: GraphNode; bNode?: GraphNode; value?: unknown; components?: string; op?: string; method?: string; constructor: { name: string } }
function evaluate(node: GraphNode): Value {
  if (node.isConstNode) return node.value as number;
  if (node.isUniformNode) { const v = node.value as THREE.Vector2; return [v.x, v.y]; }
  if (node.isVarNode) return evaluate(node.node!);
  if (node.isSplitNode) { const v = evaluate(node.node!) as number[]; return node.components!.length === 1 ? v['xyzw'.indexOf(node.components!)] : [...node.components!].map(c => v['xyzw'.indexOf(c)]); }
  if (node.condNode) return evaluate(node.condNode) ? evaluate(node.ifNode!) : evaluate(node.elseNode!);
  const a = evaluate(node.aNode!) as number, b = node.bNode ? evaluate(node.bNode) as number : NaN;
  if (node.isOperatorNode) {
    const ops: Record<string, (a: number, b: number) => Value> = { '+': (a, b) => a + b, '-': (a, b) => a - b, '*': (a, b) => a * b, '/': (a, b) => a / b, '>': (a, b) => a > b, '<': (a, b) => a < b, '&&': (a, b) => !!a && !!b };
    if (ops[node.op!]) return ops[node.op!](a, b);
  }
  if (node.isMathNode) {
    const methods: Record<string, (a: number, b: number) => number> = { sin: Math.sin, abs: Math.abs, min: Math.min, max: Math.max };
    if (methods[node.method!]) return methods[node.method!](a, b);
  }
  throw new Error(`Unsupported node ${node.constructor.name} ${node.op ?? node.method ?? ''}`);
}

describe('river shore shading', () => {
  it('loads the shore gravel scan on gpu and mobile only, from files that exist', () => {
    expect(shoreTextureFiles('cpu')).toEqual([]);
    for (const tier of ['gpu', 'mobile'] as const) {
      const files = shoreTextureFiles(tier); expect(files).toHaveLength(2);
      for (const file of files) expect(existsSync(`public/textures/ground/${file}`)).toBe(true);
    }
  });
  it('builds the ground nodes on every tier with and without the gravel, keeping roughness free to drop for the wet band', () => {
    for (const tier of ['gpu', 'mobile', 'cpu'] as const) for (const shore of [null, { albedo: texture(), nrh: texture() }]) {
      const maps = { albedo: [texture(), texture(), texture()], nrh: [texture(), texture(), texture()], rock: texture(), rockNormal: tier === 'gpu' ? texture() : null, shore };
      const nodes = groundNodes(tier, 'a', maps, new THREE.Color('#c5c5a4'));
      expect(nodes.colorNode.isNode).toBe(true);
      expect(nodes.roughnessNode?.isNode ?? false).toBe(tier !== 'cpu'); expect(nodes.normalNode?.isNode ?? false).toBe(tier === 'gpu');
    }
    // Caustics share the game clock with the river, so a frozen capture freezes them.
    expect(shoreTime.isNode).toBe(true); expect(shoreTime.value).toBe(0);
  });
  it('keeps the shader’s channel field identical to waterDistance across the whole town', () => {
    // shore-nodes.ts repeats waterways.ts in TSL; this pins the two formulas together, river, tributaries and their joins alike.
    const xz = new THREE.Vector2(), input = uniform(xz), field = (channelDistance as unknown as { shaderNode: { jsFunc: (inputs: unknown[]) => GraphNode } }).shaderNode.jsFunc([input]);
    let samples = 0, worst = 0;
    const check = (x: number, z: number): void => { xz.set(x, z); worst = Math.max(worst, Math.abs((evaluate(field) as number) - waterDistance(x, z))); samples++; };
    for (let z = -270; z <= 150; z += 1.7) for (let x = -240; x <= 240; x += 1.9) check(x, z);
    // Densely across every bank, where the field decides the shore shading, and around the tributary ends at z = -58 and 32.
    for (let x = -90; x <= 90; x += .37) for (let d = -9; d <= 9; d += .23) check(x, 26 + d + Math.sin(x) * 4);
    for (const side of [-1, 1]) for (let z = -62; z <= 36; z += .31) for (let d = -6; d <= 6; d += .29) check(side * 57 + d, z);
    expect(samples).toBeGreaterThan(80000); expect(worst).toBeLessThan(1e-9);
  });
  it('gives river rocks moss and a wet band through nodes, and bakes lichen only for the cpu tier, which drops node shading', () => {
    const nodes = rockShore(uniform(new THREE.Color('#ffffff')) as unknown as Node<'vec3'>);
    expect(nodes.colorNode.isNode).toBe(true); expect(nodes.roughnessNode.isNode).toBe(true);
    const plain = rockGeometry(ROCK_DETAIL.gpu, false), baked = rockGeometry(ROCK_DETAIL.gpu, true), moss = plain.getAttribute('moss');
    const a = plain.getAttribute('color'), b = baked.getAttribute('color');
    let greener = 0, mossy = 0, bare = 0;
    for (let i = 0; i < moss.count; i++) {
      if (moss.getX(i) === 0) { bare++; expect(b.getX(i)).toBeCloseTo(a.getX(i), 6); expect(b.getY(i)).toBeCloseTo(a.getY(i), 6); }
      else if (moss.getX(i) > .4) { mossy++; if (b.getY(i) / b.getX(i) > a.getY(i) / a.getX(i) + .02) greener++; }
    }
    expect(bare).toBeGreaterThan(20); expect(mossy).toBeGreaterThan(5); expect(greener).toBe(mossy);
    const material = new THREE.MeshStandardMaterial({ vertexColors: true }), sites = riverRockSites(true);
    const colours = (tier: 'gpu' | 'cpu'): THREE.BufferAttribute => createRiverRocks(sites, material, tier).geometry.getAttribute('color') as THREE.BufferAttribute;
    expect(Array.from(colours('gpu').array)).toEqual(Array.from(rockGeometry(ROCK_DETAIL.gpu, false).getAttribute('color').array));
    expect(Array.from(colours('cpu').array)).toEqual(Array.from(rockGeometry(ROCK_DETAIL.cpu, true).getAttribute('color').array));
  });
});
