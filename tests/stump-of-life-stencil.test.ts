import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { STUMP_STENCIL as S, STUMP_STENCIL_SCALE, createStumpStencil, createStumpStencilGeometry, stumpStencilLocal, stumpStencilPoint, stumpStencilTangent, stumpStencilNameGlyphs, stumpStencilCurveGlyphs } from '../src/world/stump-of-life-stencil';

describe('Stump of Life proposal floor stencil', () => {
  it('retains all four native paths, circle names and venue separations', () => {
    const native = JSON.parse(readFileSync('public/images/stump-of-life/floor-stencil.sources.json', 'utf8'));
    expect(S.connections).toEqual(native.circles); expect(S.capGuideDiameter * STUMP_STENCIL_SCALE).toBeCloseTo(.5, 10); expect(S.circleRadius).toBe(native.circle_radius); expect(S.nameRadius).toBe(native.name_baseline_radius);
    expect(S.connections.map(connection => connection.label)).toEqual(['35 km · oldest record', '297 km · Penghu site', '273 km · east-coast records', '417 km · Green Island']);
    for (const connection of S.connections) {
      expect(stumpStencilPoint(connection.curve, 0)).toEqual(connection.curve[0]); expect(stumpStencilPoint(connection.curve, 1)).toEqual(connection.curve[3]);
      expect(connection.curve[0]).toEqual([connection.centre[0] + S.circleRadius, connection.centre[1]]);
      for (let i = 0; i <= 100; i++) { const [dx, dy] = stumpStencilTangent(connection.curve, i / 100); expect(dx).toBeGreaterThan(0); expect(Number.isFinite(dy)).toBe(true); }
    }
  });

  it('places every name on the outside circumference and each phrase above its smooth curve', () => {
    for (const connection of S.connections) {
      const names = stumpStencilNameGlyphs(connection, () => 10), phrase = stumpStencilCurveGlyphs(connection, () => 10);
      expect(names.map(glyph => glyph.character).join('')).toBe(connection.name); expect(phrase.map(glyph => glyph.character).join('')).toBe(connection.label);
      for (const glyph of names) expect(Math.hypot(glyph.x - connection.centre[0], glyph.y - connection.centre[1])).toBeCloseTo(S.nameRadius, 9);
      expect(names[0].angle).toBeGreaterThan(0); expect(names.at(-1)!.angle).toBeLessThan(0);
      expect(new Set(phrase.map(glyph => glyph.angle.toFixed(6))).size).toBeGreaterThan(10);
      expect(phrase.every(glyph => glyph.x > connection.curve[0][0] && glyph.x < connection.curve[3][0])).toBe(true);
    }
  });

  it('creates a single flat ink mesh with no obstacles or circle interior geometry', () => {
    expect(stumpStencilLocal(S.origin).toArray()).toEqual([0, .253, 0]);
    const geometry = createStumpStencilGeometry(), position = geometry.getAttribute('position'), normal = geometry.getAttribute('normal');
    for (let i = 0; i < position.count; i++) { expect(position.getY(i)).toBeCloseTo(.253, 6); expect(normal.getY(i)).toBeGreaterThan(.99); }
    const group = createStumpStencil({ labels: false }); expect(group.children).toHaveLength(1); expect(group.userData.stencil.distances).toContain('not migration routes or walking paths');
    for (const connection of S.connections) {
      const centre = stumpStencilLocal(connection.centre);
      for (let i = 0; i < position.count; i++) expect(Math.hypot(position.getX(i) - centre.x, position.getZ(i) - centre.z)).toBeGreaterThan((S.circleRadius - 1.31) * STUMP_STENCIL_SCALE);
    }
    geometry.dispose();
  });
});
