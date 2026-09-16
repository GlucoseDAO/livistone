export type LandmarkId = 'city-hall' | 'energy' | 'science';
export interface Landmark {
  id: LandmarkId;
  name: string;
  artifact: string;
  description: string;
  x: number;
  z: number;
  color: string;
}
export const LANDMARKS: Landmark[] = [
  { id: 'city-hall', name: 'City Hall', artifact: 'The Nut of Power', x: 0, z: -21, color: '#b89a5d', description: 'Walnut, crystal, and brass come together at the heart of Livistone. Step into the atrium and discover the artifact that connects them all.' },
  { id: 'energy', name: 'Ministry of Energy', artifact: 'The Mitoring', x: -29, z: -9, color: '#c88a38', description: 'Folded silver embraces warm amber. Explore a garden of energy, inspired by the tiny structures that power living cells.' },
  { id: 'science', name: 'Ministry of Science', artifact: 'The Nanot of Power', x: 29, z: -11, color: '#819e96', description: 'An intricate silver lattice shelters a place of curiosity. Inside, small structures reveal extraordinary possibilities.' },
];
export interface Discovery {
  id: string;
  landmark: LandmarkId;
  title: string;
  category: string;
  body: string;
  action?: string;
}
export const DISCOVERIES: Discovery[] = [
  { id: 'nut', landmark: 'city-hall', title: 'One Nut to connect them all', category: 'THE NUT OF POWER', body: 'In Livia Lore, the Nut of Power is the supreme artifact, with dominion over every other creation. The original pendant joins a walnut shell and amethyst with brass. Here, its two halves become the walls of City Hall: an organic shelter and a luminous place for people to gather.' },
  { id: 'artifactor', landmark: 'city-hall', title: 'The Artifactor & the Herbalist', category: 'LIVIA LORE', body: 'Livia is both an Artifactor and a Herbalist. She forges artifacts through digital modeling and traditional metalworking, and draws inspiration from the living world. Livistone imagines those two practices at the scale of a town: precision and nature growing together.' },
  { id: 'mitoring', landmark: 'energy', title: 'A little powerhouse', category: 'THE MITORING', body: 'The Mitoring holds amber within folds of sterling silver. Its structure recalls mitochondrial cristae, the inner folds associated with cellular energy. In the lore, the ring grants energy and endurance. In Livistone, its warm folds shelter the Ministry of Energy.', action: 'Awaken the amber' },
  { id: 'shelter', landmark: 'energy', title: 'A garden for every season', category: 'LIFE IN LIVISTONE', body: 'A new story for Livistone: its winter gardens offer sheltered places to gather, while trees and deep eaves shade the summer paths. The town celebrates energy through thoughtful spaces, living greenery, and the gentle amber light of the Mitoring.' },
  { id: 'nanot', landmark: 'science', title: 'The smallest possibilities', category: 'THE NANOT OF POWER', body: 'The Nanot pendant translates nanoparticle-inspired forms into an open silver lattice. Livia Lore gives it powers of nanotechnology and biotechnology. The Ministry of Science expands its distinctive folded strands into an inhabited structure. Turn the model to follow the pattern.', action: 'Set the model in motion' },
  { id: 'connections', landmark: 'science', title: 'A world of connections', category: 'THE BIOLOGY COLLECTION', body: 'The artifacts belong to a wider exploration of cells, living forms, and natural materials. The shapes of the nucleus, mitochondrion, and microscopic structures become jewelry. In Livistone, those same connections become a walk between buildings.' },
];
export const SPAWN = { x: 0, y: 1.05, z: 44 };
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
