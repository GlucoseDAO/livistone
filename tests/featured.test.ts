import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { FEATURED_CANDIDATES, featuredPiece, townHour } from '../src/game/featured';
import { COLLECTION } from '../src/game/exhibits';

const manifest = JSON.parse(readFileSync('data/catalogue/models.json', 'utf8')) as { models: { id: string; use: string }[] };
const sources = JSON.parse(readFileSync('public/models/jewelry/sources.json', 'utf8')) as Record<string, { sources: { sha256: string }[]; levels: { triangles: number; deviationOfFeature: number }[] }>;

describe('featured jewelry models', () => {
  it('only features pieces whose poster hangs in that building, each with a built model', () => {
    for (const [building, pieces] of Object.entries(FEATURED_CANDIDATES)) for (const piece of pieces!) {
      expect(COLLECTION.find((exhibit) => exhibit.discovery === piece)?.location, piece).toBe(building);
      expect(manifest.models.find((model) => model.id === piece)?.use, piece).toBe('featured');
      expect(existsSync(`public/models/jewelry/${piece}.glb`), piece).toBe(true);
    }
  });
  it('changes with the hour, the same for everyone, through every candidate', () => {
    expect(townHour(Date.UTC(2026, 9, 4, 13, 59))).toBe(townHour(Date.UTC(2026, 9, 4, 13, 0)));
    expect(townHour(Date.UTC(2026, 9, 4, 14, 0))).toBe(townHour(Date.UTC(2026, 9, 4, 13, 0)) + 1);
    for (const [building, pieces] of Object.entries(FEATURED_CANDIDATES)) {
      const seen = new Set(Array.from({ length: pieces!.length }, (_, hour) => featuredPiece(building, hour)));
      expect(seen.size).toBe(pieces!.length);
      expect(featuredPiece(building, -1)).not.toBeNull();
    }
    expect(featuredPiece('glucose', 0)).toBeNull();
  });
  it('keeps the derivatives small and records where each came from', () => {
    for (const model of manifest.models) {
      const record = sources[model.id]; expect(record, model.id).toBeDefined();
      expect(record.sources.every((source) => /^[0-9a-f]{64}$/.test(source.sha256))).toBe(true);
      // The near level stays within the hero budget (inclusion analysis §6) and close to the printed wire.
      expect(record.levels[0].triangles).toBeLessThanOrEqual(30000);
      expect(record.levels[0].deviationOfFeature).toBeLessThan(.2);
    }
  });
});
