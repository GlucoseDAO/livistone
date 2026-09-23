import { DISCOVERIES, LANDMARKS } from './content';
import type { LandmarkId } from './content';
import { COLLECTION } from './exhibits';
import { GATEWAY } from '../world/gateway-layout';

export interface NearbyStory { id: string; title: string; sentence: string }
const stories: Record<string, NearbyStory> = {
  'kings-chapel': { id: 'kings-chapel', title: 'King’s Chapel Double Ring', sentence: 'The entrance arch enlarges Livia’s two-finger silver ring, with its long green tourmaline held above the bridge.' },
  nut: { id: 'nut', title: 'The Nut of Power', sentence: 'In Livia Lore, this walnut-and-amethyst pendant rules all her artifacts; in Livistone, its two halves become City Hall.' },
  mitoring: { id: 'mitoring', title: 'Mitoring', sentence: 'An amber ring wrapped in silver folds inspired by mitochondria becomes Livistone’s Ministry of Energy.' },
  nanot: { id: 'nanot', title: 'The Nanot of Power', sentence: 'Livia’s nanoparticle-inspired silver pendant becomes the open lattice around the Ministry of Science.' },
  'embryo-station': { id: 'embryo-station', title: 'Embryo Ring', sentence: 'The raw amber and silver embrace of Livia’s Embryo Ring becomes a station for new beginnings.' },
  timeface: { id: 'timeface', title: 'Timeface Tower', sentence: 'A silver hourglass becomes a walkable spiral gallery overlooking the town.' },
  'glucose-livia': { id: 'glucose-livia', title: 'Glucose Commons', sentence: 'Walk beneath a human insulin structure and explore Livia’s glucose research and machine learning projects.' },
  'living-vittoria': { id: 'living-vittoria', title: 'Vittoria Amazonica', sentence: 'Livia’s silver-and-aquamarine pendant inspires the lake’s water eyes and branching silver paths.' },
  'future-house-story': { id: 'future-house-story', title: 'Camel Dalí · Future House', sentence: 'Livia’s copper, printed material and leather camel becomes a lakeside house you enter through its neck.' },
  'living-mycelium': { id: 'living-mycelium', title: 'Mycelium', sentence: 'The Mycelium ring’s curled silver folds and opal heart become this mushroom grove.' },
  'materialized-enhancements': { id: 'materialized-enhancements', title: 'Materialized Enhancements', sentence: 'This faceted hill grows out of Livia’s gene knowledgebase, character-building game and printable bioart project.' },
};
const placeStories: Record<LandmarkId, string> = { station: 'embryo-station', energy: 'mitoring', science: 'nanot', 'city-hall': 'nut', timeface: 'timeface', glucose: 'glucose-livia', 'living-waters': 'living-vittoria', 'future-house': 'future-house-story', 'mycelium-garden': 'living-mycelium', enhancement: 'materialized-enhancements' };
export function storyFor(id: string): NearbyStory | null {
  if (stories[id]) return stories[id];
  const discovery = DISCOVERIES.find(d => d.id === id); if (!discovery) return null;
  const piece = COLLECTION.find(p => p.discovery === id), body = piece?.story ?? discovery.body;
  return { id, title: piece?.title ?? discovery.title, sentence: body.split(/(?<=[.!?])\s/)[0] };
}
export function nearbyArchitecture(x: number, z: number): NearbyStory | null {
  // Arrivals should meet the ring gateway, even while the station behind them is closer.
  if (Math.abs(x) < 13 && z >= 25 && z <= 61) return stories['kings-chapel'];
  let distance = Math.hypot(x, z - GATEWAY.z), result: NearbyStory | null = distance < 24 ? stories['kings-chapel'] : null;
  if (!result) distance = 42;
  for (const landmark of LANDMARKS) {
    const d = Math.hypot(x - landmark.x, z - landmark.z);
    if (d < distance) { distance = d; result = stories[placeStories[landmark.id]]; }
  }
  return result;
}
