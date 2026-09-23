import { STATION } from '../world/station-layout';
import { GLUCOSE_PAVILION } from '../world/glucose-layout';
import { RESEARCH_POSTERS } from './research';
import { ENHANCEMENT_POSTERS, ENHANCEMENT_URL, enhancementImage } from './enhancement';
import { COLLECTION } from './exhibits';
import { GARDENS } from '../world/living-waters-layout';
import type { ResearchFigure } from './research-art';
import { TIME_TOWER } from '../world/waterways';

export type LandmarkId = 'city-hall' | 'energy' | 'science' | 'station' | 'glucose' | 'living-waters' | 'mycelium-garden' | 'timeface' | 'future-house' | 'enhancement';
export interface Landmark {
  id: LandmarkId;
  zone?: 'town' | 'gardens';
  name: string;
  artifact: string;
  description: string;
  x: number;
  z: number;
  color: string;
  /** A clear approach outside the entrance. Station arrivals face the city gate; other halls face inward. */
  entrance: { x: number; y: number; z: number; yaw: number };
  /** Horizontal footprint scale of the building shell; the Mitoring hall is an elongated ellipsoid. */
  stretch: { x: number; z: number };
}
export const LANDMARKS: Landmark[] = [
  { id: 'station', entrance: { x: STATION.entranceX, y: 1.05, z: STATION.entranceZ - 4, yaw: 0 }, name: 'Embryo Station', artifact: 'The Embryo Ring', x: STATION.x, z: STATION.z, color: '#d5a044', stretch: { x: 4.1, z: 1.4 }, description: 'A silver ring opens into an amber-roofed railway station. Arrive at the southern station looking toward the city gate and the Livistone bridge. The train and both railway lines belong to this arrival station.' },
  { id: 'energy', entrance: { x: -29, y: 1.05, z: 3, yaw: 0 }, name: 'Ministry of Energy', artifact: 'The Mitoring', x: -29, z: -9, color: '#c88a38', stretch: { x: 14 / 7.1, z: 6.6 / 7.1 }, description: 'A long amber hall wrapped in folded silver cristae, entered through the ring itself. Explore a garden of energy, inspired by the tiny structures that power living cells.' },
  { id: 'science', entrance: { x: 29, y: 1.05, z: -1, yaw: 0 }, name: 'Ministry of Science', artifact: 'The Nanot of Power', x: 29, z: -11, color: '#819e96', stretch: { x: 1, z: 1 }, description: 'An intricate silver lattice of struts and folded strands shelters a place of curiosity. Inside, small structures reveal extraordinary possibilities.' },
  { id: 'city-hall', entrance: { x: 0, y: 1.05, z: -11, yaw: 0 }, name: 'City Hall', artifact: 'The Nut of Power', x: 0, z: -21, color: '#b89a5d', stretch: { x: 1, z: 1 }, description: 'Walnut, crystal, and brass come together at the heart of Livistone. Step into the atrium and discover the artifact that connects them all.' },
  { id: 'timeface', entrance: { x: TIME_TOWER.x + 6.55, y: 1.25, z: TIME_TOWER.z + 2, yaw: 0 }, name: 'Timeface Tower', artifact: 'Earlier explorations · spiral gallery', x: TIME_TOWER.x, z: TIME_TOWER.z, color: '#b3c6cb', stretch: { x: 1.35, z: 1.35 }, description: 'A round plaza opens onto a continuous spiral walk around the silver hourglass. Follow older works from the studio archive to a viewing terrace above the town.' },
  { id: 'glucose', entrance: { x: GLUCOSE_PAVILION.x, y: 1.05, z: GLUCOSE_PAVILION.z + GLUCOSE_PAVILION.radius + 5.4, yaw: 0 }, name: 'Glucose Commons', artifact: 'Human insulin · GlucoseDAO', x: GLUCOSE_PAVILION.x, z: GLUCOSE_PAVILION.z, color: '#78a99b', stretch: { x: 1.35, z: 1.35 }, description: 'Follow the eastern station garden path to an open pavilion beneath two ribbons traced from a human insulin structure. Six chapter posters open into original images and text from Livia’s supplied research folder: why glucose matters, how it is measured, GlucoseDAO, Sugar-Sugar, forecasting tools and the insulin sculpture.' },
  { id: 'living-waters', entrance: { x: GARDENS.x + GARDENS.pavilionX, y: 1.05, z: GARDENS.z + GARDENS.pavilionZ - 9, yaw: Math.PI }, name: 'Vittoria Lake', artifact: 'Living Waters · town gardens', x: GARDENS.x - 10, z: GARDENS.z, color: '#81bcc0', stretch: { x: 6, z: 6 }, description: 'Walk north from City Hall into Living Waters, part of the same town gardens. Walk a branching silver network between shallow water eyes and enter an aquamarine pavilion inspired by Vittoria Amazonica and Dewdrop.' },
  { id: 'future-house', entrance: { x: -35, y: 1.2, z: -105, yaw: Math.PI / 2 }, name: 'Future House', artifact: 'Camel Dalí · a lakeside exhibition', x: -64, z: -110, color: '#c98c65', stretch: { x: 1.8, z: 2 }, description: 'A camel bends toward Vittoria Lake. Climb its copper neck into a dark printed cabin held by leather bands, with an exhibition of recent works and views over the water.' },
  { id: 'mycelium-garden', entrance: { x: GARDENS.x + 74, y: 1.05, z: GARDENS.z - 25, yaw: -2 }, name: 'Mycelium Rain Garden', artifact: 'Silver mushroom grove', x: GARDENS.x + 75, z: GARDENS.z, color: '#81a791', stretch: { x: 3, z: 4 }, description: 'At Living Waters, follow the eastern path into tall mushroom sculptures and lower ring-scale silver shrubs with curled gills and opal hearts, both following the Mycelium ring. Folded crowns collect rain above a dry loop; a visible silver rill links the opalescent basin to Vittoria Lake.' },
  { id: 'enhancement', entrance: { x: 100, y: 1.05, z: -154.617, yaw: .575 }, name: 'Materialized Enhancements', artifact: 'Voronoi hill · design your character', x: 82, z: -178, color: '#b95f3d', stretch: { x: 5, z: 4.5 }, description: 'Behind the mycelium grove, an original Voronoi crystal grows into a violet faceted hill. In front stand photo posters and six gene-category crystals grown by the project’s own pipeline; click any poster to open enhancement.bio. Follow marked facets or walk through the lit cave and internal ramp to a human monument with a Voronoi chest.' },
];
export const CIVIC_LANDMARKS = LANDMARKS.filter((landmark) => ['city-hall', 'energy', 'science'].includes(landmark.id));
export interface DiscoverySlide { title: string; body: string; figure?: ResearchFigure; image?: string; imageAlt?: string }
export interface Discovery {
  id: string;
  landmark: LandmarkId;
  title: string;
  category: string;
  body: string;
  links?: { label: string; url: string }[];
  slides?: DiscoverySlide[];
}
const ENHANCEMENT_STORY = 'Materialized Enhancements combines a character-building game, a gene evidence knowledgebase and printable bioart. Pick real genes from real animals, see how far each gene’s evidence reached, then grow a Voronoi crystal from your character. The hill preserves the supplied Voronoi STL, holes and angular cells included, enlarged and coloured like the project’s printed and rendered crystals. The six smaller crystals in front were grown by the project’s pipeline, one from each gene category. The posters show printed pieces, the people holding them and a character report; click any of them to open enhancement.bio. Amber arrows mark an outside climb, and a lit cave leads to an internal ramp and a human figure with a Voronoi chest.';
export const DISCOVERIES: Discovery[] = [
  { id: 'materialized-enhancements', landmark: 'enhancement', title: 'Materialized Enhancements', category: 'BIOART / PARTICIPATE', body: ENHANCEMENT_STORY, links: [{ label: 'Join here — create your character', url: ENHANCEMENT_URL }],
    slides: [{ title: 'A game. A knowledgebase. A bioart project.', body: ENHANCEMENT_STORY }, ...ENHANCEMENT_POSTERS.map(p => ({ title: p.title, body: `${p.body} ${p.credit}.`, image: enhancementImage(p.slug), imageAlt: p.alt }))] },
  { id: 'future-house-story', landmark: 'future-house', title: 'Camel Dalí / Future House', category: 'MATERIALS AND IMAGINATION', body: 'Camel Dalí combines native copper, a PLA printed part and leather ties, as described by Livia. The original Instagram post introduces an organic form and 3D printing. Future House enlarges those materials into a drinking camel: copper legs and neck, a printed exhibition cabin and leather bindings. The building and walkable neck are new Livistone architecture.', links: [{ label: 'Camel Dalí — original Instagram post', url: 'https://www.instagram.com/p/DdDwLqDlcm2/' }] },
  ...RESEARCH_POSTERS,
  { id: 'living-vittoria', landmark: 'living-waters', title: 'Vittoria Amazonica at the lake', category: 'VITTORIA LAKE / TWO WORKS',
    body: 'Livia’s Vittoria Amazonica pendant is silver and aquamarine, made in 2022 and shown in Survival at Romanian Jewelry Week 2023. The lake enlarges its lily-pad form into water eyes and walkable silver nerves; that landscape is new Livistone fiction. The neighbouring stand presents the separate Dewdrop ring.',
    links: [{ label: 'Vittoria Amazonica on Livia’s site', url: 'https://livia.glucosedao.org/pieces/' }],
    slides: [
      { title: 'Vittoria Amazonica', body: 'Silver and aquamarine, 4.5 × 4.5 × 1.0 cm, 2022. Shown in Survival at Romanian Jewelry Week 2023. The pendant’s broad lily-pad form is the same work this garden reads at landscape scale. Studio photographs are on the stand; the lake itself is town fiction.' },
      { title: 'Dewdrop, the other lake work', body: 'Dewdrop is a separate adjustable silver ring around a treated Swiss blue topaz. A faceted droplet sits in an open silver embrace. Its stone is topaz, not the aquamarine of Vittoria. Follow the path to the pavilion stand for that piece.' },
    ] },
  { id: 'living-dewdrop', landmark: 'living-waters', title: 'Dewdrop at the pavilion', category: 'VITTORIA × DEWDROP',
    body: 'The Dewdrop ring is an adjustable silver setting around a treated Swiss blue topaz. A faceted droplet sits in an open silver embrace. The pavilion borrows that silhouette; its civic stone colour follows Vittoria’s aquamarine. Dewdrop’s real stone is topaz. The two open entries and the view across the lake are architectural inventions for Livistone.',
    links: [{ label: 'Dewdrop and Vittoria on Livia’s site', url: 'https://livia.glucosedao.org/pieces/' }],
    slides: [
      { title: 'Dewdrop Ring', body: 'Adjustable silver around treated Swiss blue topaz. The public catalogue describes a faceted droplet in an open silver embrace. Livistone has no local studio photograph of Dewdrop, so the stand draws that silhouette and links to the source page.' },
      { title: 'Vittoria Amazonica, the other lake work', body: 'Vittoria is silver and aquamarine, 2022, shown in Survival at Romanian Jewelry Week 2023. Its lily-pad form becomes the water eyes on the lake stand to the south. The two jewels stay named separately: aquamarine pendant, topaz ring.' },
    ] },
  { id: 'living-mycelium', landmark: 'mycelium-garden', title: 'A crown that lets water go', category: 'MYCELIUM / MATERIAL STORY', body: 'Livia describes designing Mycelium’s folded silver setting so water could drain away from its porous opal. Mushrooms and fungi informed the solution. Livistone enlarges that idea into open silver mushroom crowns around opal hearts and visible drainage rills. The garden is an imagined landscape, not a claim about ecological or medical performance. Follow the dry loop toward the lake and the civic gardens.', links: [{ label: 'Mycelium in the artist’s catalogue', url: 'https://livia.glucosedao.org/pieces/' }] },
  ...COLLECTION.filter((piece) => piece.location && !['nut', 'mitoring', 'nanot'].includes(piece.discovery)).map((piece): Discovery => ({ id: piece.discovery, landmark: piece.location!, title: piece.title, category: piece.collection ?? 'LIVIA ZAHARIA', body: piece.story ?? piece.description })),
  { id: 'nut', landmark: 'city-hall', title: 'One Nut to connect them all', category: 'THE NUT OF POWER', body: 'In Livia Lore, the Nut of Power is the supreme artifact, with dominion over every other creation. The original pendant joins a walnut shell and amethyst with brass. Here, its two halves become the walls of City Hall: an organic shelter and a luminous place for people to gather.' },
  { id: 'artifactor', landmark: 'city-hall', title: 'The Artifactor & the Herbalist', category: 'LIVIA LORE', body: 'Livia is both an Artifactor and a Herbalist. She forges artifacts through digital modeling and traditional metalworking, and draws inspiration from the living world. Livistone imagines those two practices at the scale of a town: precision and nature growing together.' },
  { id: 'mitoring', landmark: 'energy', title: 'A little powerhouse', category: 'THE MITORING', body: 'The Mitoring holds amber within folds of sterling silver. Its structure recalls mitochondrial cristae, the inner folds associated with cellular energy. In the lore, the ring grants energy and endurance. In Livistone, its warm folds shelter the Ministry of Energy.' },
  { id: 'shelter', landmark: 'energy', title: 'A garden for every season', category: 'LIFE IN LIVISTONE', body: 'A new story for Livistone: its winter gardens offer sheltered places to gather, while trees and deep eaves shade the summer paths. The town celebrates energy through thoughtful spaces, living greenery, and the gentle amber light of the Mitoring.' },
  { id: 'nanot', landmark: 'science', title: 'The smallest possibilities', category: 'THE NANOT OF POWER', body: 'The Nanot pendant translates nanoparticle-inspired forms into an open silver lattice. Livia Lore gives it powers of nanotechnology and biotechnology. The Ministry of Science expands its distinctive folded strands into an inhabited structure.' },
  { id: 'connections', landmark: 'science', title: 'A world of connections', category: 'THE BIOLOGY COLLECTION', body: 'The artifacts belong to a wider exploration of cells, living forms, and natural materials. The shapes of the nucleus, mitochondrion, and microscopic structures become jewelry. In Livistone, those same connections become a walk between buildings.' },
  { id: 'embryo-station', landmark: 'station', title: 'A departure, a beginning', category: 'THE EMBRYO STATION', body: 'Livia’s Embryo Ring holds raw amber in an organic embrace of sterling-silver prongs. In Livia Lore, it blesses new projects and beginnings. Livistone gives that idea a place in the town: a railway station for journeys yet to come. The pierced ring becomes the entrance, amber becomes a shelter over the platform, and the silver prongs hold it above the garden. The station and its ultra-fast train are new Livistone fiction. Leave its ring entrance looking toward the city gate and the Livistone bridge, then follow the civic footpaths to the northern Living Waters gardens.' },
  { id: 'train-future', landmark: 'station', title: 'Step into the future', category: 'EMBRYO TRAIN / ANNOUNCEMENT',
    body: 'Inside the parked maglev, the cabin boards say step into the future. They are Livistone announcements, not a scheduled service. Click to open Livia Zaharia’s public catalogue of works and objects, or press E for the story and links.',
    links: [{ label: 'Livia’s works and objects', url: 'https://livia.glucosedao.org/pieces/' }] },
  { id: 'train-science', landmark: 'station', title: 'Science this way', category: 'EMBRYO TRAIN / SCIENCE ≫',
    body: 'Double triangle arrowheads mark the science direction along the cabin: toward the eastern Ministry of Science and Glucose Commons after you leave the train. Click the advertisement to open Livia’s GlucoseDAO science page. Press E for its story and source links.',
    links: [{ label: 'Livia’s works and objects', url: 'https://livia.glucosedao.org/pieces/' }, { label: 'GlucoseDAO science & tech', url: 'https://livia.glucosedao.org/science-tech/glucosedao/' }] },
  { id: 'train-art', landmark: 'station', title: 'Art and geometry this way', category: 'EMBRYO TRAIN / ART ≫',
    body: 'The opposite cabin direction is marked for art and geometry: toward the civic jewelry halls after you leave the train. The announcement opens Livia’s public catalogue of works and objects.',
    links: [{ label: 'Livia’s works and objects', url: 'https://livia.glucosedao.org/pieces/' }] },
];
export const SPAWN = { x: 0, y: 1.05, z: 58, yaw: 0 };
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
