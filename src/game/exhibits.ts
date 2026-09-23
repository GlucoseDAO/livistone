import catalogue from './jewelry-catalogue.json' with { type: 'json' };
import archive from './archive-catalogue.json' with { type: 'json' };
import type { LandmarkId } from './content';
import { PIECE_STORIES } from './piece-stories';

export interface Exhibit {
  landmark?: LandmarkId; discovery: string; title: string; type: string; materials: string; dimensions: string; year: string;
  description: string; story?: string; location?: LandmarkId | null; collection?: string; source?: string; photos: { file: string; thumb?: string; alt: string }[];
}
export const CATALOGUE_URL = 'https://livia.glucosedao.org/pieces/';
export const EXHIBITS: Exhibit[] = [
  { landmark: 'city-hall', discovery: 'nut', title: 'The Nut of Power', type: 'Pendant', materials: 'Brass, walnut, amethyst', dimensions: '3.4 × 3.4 cm', year: '2024',
    description: 'A walnut half-shell and a polished stone sphere meet at broad brass bands. Natural relief, transparent stone and visible fasteners give the pendant its contrasting surfaces.',
    photos: [{ file: 'IMG_3493.jpg', alt: 'The Nut of Power pendant: walnut, polished stone and brass clasps' }, { file: 'IMG_3496.jpg', alt: 'Another view of the Nut of Power pendant from Livia’s studio archive' }] },
  { landmark: 'energy', discovery: 'mitoring', title: 'Mitoring', type: 'Ring', materials: 'Amber, sterling silver', dimensions: '3.2 × 2.2 cm', year: '2024',
    description: 'Amber sits inside a folded silver setting. The ring interprets the mitochondrion and its cristae as a small wearable sculpture in the Biology collection.',
    photos: [{ file: 'IMG_3475.jpg', alt: 'Mitoring: amber surrounded by folded sterling-silver loops' }, { file: 'IMG_3480.jpg', alt: 'Mitoring photographed from a second angle, showing the silver setting' }] },
  { landmark: 'science', discovery: 'nanot', title: 'The Nanot of Power', type: 'Pendant', materials: 'Sterling silver', dimensions: '3.2 × 3.2 cm', year: '2024',
    description: 'Angular, folded silver strands surround an open spherical body. The pendant belongs to the artist’s exploration of biological and nanoparticle-inspired forms.',
    photos: [{ file: 'IMG_3433.jpg', alt: 'Nanot pendant: an open silver lattice with angular folds and dark inclusions' }, { file: 'IMG_3434.jpg', alt: 'A second studio photograph of the Nanot pendant and its folded metal structure' }] },
];
/** Curated manifest: every physical piece belongs to exactly one place. Full photographs are viewer-only. */
export const COLLECTION: Exhibit[] = [...catalogue, ...archive].map((piece) => ({ ...piece, location: (piece.discovery === 'timeface' ? 'timeface' : ['eyelense', 'deep-sea-pearl'].includes(piece.discovery) ? 'future-house' : piece.location) as LandmarkId | null, landmark: EXHIBITS.find((anchor) => anchor.discovery === piece.discovery)?.landmark, story: PIECE_STORIES[piece.discovery] ?? ('story' in piece ? piece.story : undefined) }));
/** Contain the entire photograph within the available panel or viewer area. */
export function photoSize(width: number, height: number, maxWidth = 2.8, maxHeight = 2.3): { width: number; height: number } {
  const ratio = width > 0 && height > 0 ? width / height : 1;
  return ratio > maxWidth / maxHeight ? { width: maxWidth, height: maxWidth / ratio } : { width: maxHeight * ratio, height: maxHeight };
}
export function photoURL(file: string): string { return import.meta.env.BASE_URL + 'images/jewelry/' + file; }
