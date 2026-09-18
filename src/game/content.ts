import { STATION } from '../world/station-layout';
import { GLUCOSE_PAVILION } from '../world/glucose-layout';
import { RESEARCH_POSTERS } from './research';
import { COLLECTION } from './exhibits';
import { GARDENS } from '../world/living-waters-layout';

export type LandmarkId = 'city-hall' | 'energy' | 'science' | 'station' | 'glucose' | 'living-waters' | 'mycelium-garden';
export interface Landmark {
  id: LandmarkId;
  zone?: 'town' | 'gardens';
  name: string;
  artifact: string;
  description: string;
  x: number;
  z: number;
  color: string;
  /** A clear approach outside the entrance, with the walking camera facing inward. */
  entrance: { x: number; y: number; z: number; yaw: number };
  /** Horizontal footprint scale of the building shell; the Mitoring hall is an elongated ellipsoid. */
  stretch: { x: number; z: number };
}
export const LANDMARKS: Landmark[] = [
  { id: 'city-hall', entrance: { x: 0, y: 1.05, z: -11, yaw: 0 }, name: 'City Hall', artifact: 'The Nut of Power', x: 0, z: -21, color: '#b89a5d', stretch: { x: 1, z: 1 }, description: 'Walnut, crystal, and brass come together at the heart of Livistone. Step into the atrium and discover the artifact that connects them all.' },
  { id: 'energy', entrance: { x: -29, y: 1.05, z: 3, yaw: 0 }, name: 'Ministry of Energy', artifact: 'The Mitoring', x: -29, z: -9, color: '#c88a38', stretch: { x: 14 / 7.1, z: 6.6 / 7.1 }, description: 'A long amber hall wrapped in folded silver cristae, entered through the ring itself. Explore a garden of energy, inspired by the tiny structures that power living cells.' },
  { id: 'science', entrance: { x: 29, y: 1.05, z: -1, yaw: 0 }, name: 'Ministry of Science', artifact: 'The Nanot of Power', x: 29, z: -11, color: '#819e96', stretch: { x: 1, z: 1 }, description: 'An intricate silver lattice of struts and folded strands shelters a place of curiosity. Inside, small structures reveal extraordinary possibilities.' },
  { id: 'station', entrance: { x: STATION.entranceX, y: 1.05, z: STATION.entranceZ - 4, yaw: Math.PI }, name: 'Embryo Station', artifact: 'The Embryo Ring', x: STATION.x, z: STATION.z, color: '#d5a044', stretch: { x: 4.1, z: 1.4 }, description: 'A silver ring opens into an amber-roofed railway station. Arrive at the southern station and step out facing the Livistone bridge. The train and both railway lines belong to this arrival station.' },
  { id: 'glucose', entrance: { x: GLUCOSE_PAVILION.x, y: 1.05, z: GLUCOSE_PAVILION.z + GLUCOSE_PAVILION.radius + 5.4, yaw: 0 }, name: 'Glucose Commons', artifact: 'Human insulin · GlucoseDAO', x: GLUCOSE_PAVILION.x, z: GLUCOSE_PAVILION.z, color: '#78a99b', stretch: { x: 1.35, z: 1.35 }, description: 'Follow the eastern station garden path to an open pavilion beneath two ribbons traced from a human insulin structure. Six source-linked posters introduce Livia’s GlucoseDAO work, from Sugar-Sugar to open forecasting tools. A smaller glucose molecule marks the difference between the two molecules.' },
  { id: 'living-waters', entrance: { x: GARDENS.x + GARDENS.pavilionX, y: 1.05, z: GARDENS.z + GARDENS.pavilionZ - 9, yaw: Math.PI }, name: 'Vittoria Lake', artifact: 'Living Waters · town gardens', x: GARDENS.x - 10, z: GARDENS.z, color: '#81bcc0', stretch: { x: 6, z: 6 }, description: 'Walk north from City Hall into Living Waters, part of the same town gardens. Walk a branching silver network between shallow water eyes and enter an aquamarine pavilion inspired by Vittoria Amazonica and Dewdrop.' },
  { id: 'mycelium-garden', entrance: { x: GARDENS.x + 74, y: 1.05, z: GARDENS.z - 25, yaw: -2 }, name: 'Mycelium Rain Garden', artifact: 'Silver mushroom grove', x: GARDENS.x + 75, z: GARDENS.z, color: '#81a791', stretch: { x: 3, z: 4 }, description: 'At Living Waters, follow the eastern path into mushroom sculptures with curled silver gills and opal hearts inspired by the Mycelium ring. Folded crowns collect rain above a dry loop; a visible silver rill links the opalescent basin to Vittoria Lake.' },
];
export const CIVIC_LANDMARKS = LANDMARKS.filter((landmark) => ['city-hall', 'energy', 'science'].includes(landmark.id));
export interface Discovery {
  id: string;
  landmark: LandmarkId;
  title: string;
  category: string;
  body: string;
  links?: { label: string; url: string }[];
}
export const DISCOVERIES: Discovery[] = [
  ...RESEARCH_POSTERS,
  { id: 'living-vittoria', landmark: 'living-waters', title: 'Vittoria’s water eyes', category: 'LIVING WATERS / LIVISTONE INTERPRETATION', body: 'Livia’s Vittoria Amazonica pendant is silver and aquamarine, made in 2022. Here, its broad lily-pad form and branching openwork become a shallow landscape of water eyes and walkable silver nerves. The lake and garden ecology are new Livistone fiction. Several paths lead around the cells to the blue pavilion; the shallow water is safe to walk through.', links: [{ label: 'Vittoria and the Survival collection', url: 'https://livia.glucosedao.org/pieces/' }] },
  { id: 'living-dewdrop', landmark: 'living-waters', title: 'Two stones, one pavilion', category: 'VITTORIA × DEWDROP', body: 'This pavilion combines Vittoria’s aquamarine identity with the faceted droplet and curling silver embrace of the separate Dewdrop ring. Dewdrop’s real stone is treated Swiss blue topaz, not aquamarine. The two open entries, dry room and view across the lake are architectural inventions for Livistone.', links: [{ label: 'Livia’s source catalogue', url: 'https://livia.glucosedao.org/pieces/' }] },
  { id: 'living-mycelium', landmark: 'mycelium-garden', title: 'A crown that lets water go', category: 'MYCELIUM / MATERIAL STORY', body: 'Livia describes designing Mycelium’s folded silver setting so water could drain away from its porous opal. Mushrooms and fungi informed the solution. Livistone enlarges that idea into open silver mushroom crowns around opal hearts and visible drainage rills. The garden is an imagined landscape, not a claim about ecological or medical performance. Follow the dry loop toward the lake and the civic gardens.', links: [{ label: 'Mycelium in the artist’s catalogue', url: 'https://livia.glucosedao.org/pieces/' }] },
  ...COLLECTION.filter((piece) => piece.location && !['nut', 'mitoring', 'nanot'].includes(piece.discovery)).map((piece): Discovery => ({ id: piece.discovery, landmark: piece.location!, title: piece.title, category: piece.collection ?? 'LIVIA ZAHARIA', body: piece.description })),
  { id: 'nut', landmark: 'city-hall', title: 'One Nut to connect them all', category: 'THE NUT OF POWER', body: 'In Livia Lore, the Nut of Power is the supreme artifact, with dominion over every other creation. The original pendant joins a walnut shell and amethyst with brass. Here, its two halves become the walls of City Hall: an organic shelter and a luminous place for people to gather.' },
  { id: 'artifactor', landmark: 'city-hall', title: 'The Artifactor & the Herbalist', category: 'LIVIA LORE', body: 'Livia is both an Artifactor and a Herbalist. She forges artifacts through digital modeling and traditional metalworking, and draws inspiration from the living world. Livistone imagines those two practices at the scale of a town: precision and nature growing together.' },
  { id: 'mitoring', landmark: 'energy', title: 'A little powerhouse', category: 'THE MITORING', body: 'The Mitoring holds amber within folds of sterling silver. Its structure recalls mitochondrial cristae, the inner folds associated with cellular energy. In the lore, the ring grants energy and endurance. In Livistone, its warm folds shelter the Ministry of Energy.' },
  { id: 'shelter', landmark: 'energy', title: 'A garden for every season', category: 'LIFE IN LIVISTONE', body: 'A new story for Livistone: its winter gardens offer sheltered places to gather, while trees and deep eaves shade the summer paths. The town celebrates energy through thoughtful spaces, living greenery, and the gentle amber light of the Mitoring.' },
  { id: 'nanot', landmark: 'science', title: 'The smallest possibilities', category: 'THE NANOT OF POWER', body: 'The Nanot pendant translates nanoparticle-inspired forms into an open silver lattice. Livia Lore gives it powers of nanotechnology and biotechnology. The Ministry of Science expands its distinctive folded strands into an inhabited structure.' },
  { id: 'connections', landmark: 'science', title: 'A world of connections', category: 'THE BIOLOGY COLLECTION', body: 'The artifacts belong to a wider exploration of cells, living forms, and natural materials. The shapes of the nucleus, mitochondrion, and microscopic structures become jewelry. In Livistone, those same connections become a walk between buildings.' },
  { id: 'embryo-station', landmark: 'station', title: 'A departure, a beginning', category: 'THE EMBRYO STATION', body: 'Livia’s Embryo Ring holds raw amber in an organic embrace of sterling-silver prongs. In Livia Lore, it blesses new projects and beginnings. Livistone gives that idea a place in the town: a railway station for journeys yet to come. The pierced ring becomes the entrance, amber becomes a shelter over the platform, and the silver prongs hold it above the garden. The station and its ultra-fast train are new Livistone fiction. Leave its ring entrance facing the Livistone bridge, then follow the civic footpaths to the northern Living Waters gardens.' },
];
export const SPAWN = { x: 0, y: 1.05, z: 58 };
export const STORAGE_KEY = 'livistone-progress-v1';
export interface Progress { version: 1; discovered: string[]; visited: LandmarkId[]; }
export function parseProgress(value: string | null): Progress {
  const empty: Progress = { version: 1, discovered: [], visited: [] };
  if (!value) return empty;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || !('version' in parsed) || parsed.version !== 1) return empty;
    const data = parsed as Partial<Progress>;
    return {
      version: 1,
      discovered: Array.isArray(data.discovered) ? [...new Set(data.discovered.filter((id) => DISCOVERIES.some((d) => d.id === id)))] : [],
      visited: Array.isArray(data.visited) ? [...new Set(data.visited.filter((id) => LANDMARKS.some((l) => l.id === id)))] : [],
    };
  } catch { return empty; }
}
export function readProgress(): Progress {
  try { return parseProgress(localStorage.getItem(STORAGE_KEY)); } catch { return parseProgress(null); }
}
export function writeProgress(progress: Progress): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(progress)); } catch { /* Exploration remains available without storage. */ }
}
