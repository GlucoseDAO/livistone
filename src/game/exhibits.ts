import type { LandmarkId } from './content';

export interface Exhibit {
  landmark?: LandmarkId; discovery: string; title: string; type: string; materials: string; dimensions: string; year: string;
  description: string; photos: { file: string; alt: string }[];
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
export const COLLECTION: Exhibit[] = [...EXHIBITS,
  { discovery: 'amberbow', title: 'Amberbow Ring', type: 'Ring', materials: 'Silver, amber', dimensions: '1.8 × 3.8 × 3.3 cm', year: '2023',
    description: 'An amber and silver ring, presented in the Survival collection at Romanian Jewelry Week 2023.',
    photos: [{ file: 'amberbow-1.jpg', alt: 'Amberbow ring in silver and amber, studio photograph' }, { file: 'amberbow-2.jpg', alt: 'A second view of the Amberbow ring' }] },
  { discovery: 'ammonite', title: 'Ammonite Ring', type: 'Ring', materials: 'Sterling silver, agate', dimensions: '4.2 × 3.5 × 2.6 cm', year: '2023',
    description: 'A sterling-silver and agate ring, presented in the Beloved food collection at Romanian Jewelry Week 2024.',
    photos: [{ file: 'ammonite-1.jpg', alt: 'Ammonite ring in sterling silver and agate' }, { file: 'ammonite-2.jpg', alt: 'A second studio view of the Ammonite ring' }] },
  { discovery: 'beanut', title: 'Beanut (Fasolaluna)', type: 'Pendant', materials: 'Sterling silver, epidote and prehnite', dimensions: '1.9 × 1.5 × 6.8 cm', year: '2019',
    description: 'The stone came first: Livia designed the silver setting around it. The name combines the bean-shaped stone with its nut-like setting. Presented at Romanian Jewelry Week 2021.',
    photos: [{ file: 'beanut-1.jpg', alt: 'Beanut pendant with epidote and prehnite in sterling silver' }, { file: 'beanut-2.jpg', alt: 'A second studio view of the Beanut pendant' }] },
];
/** Contain the entire photograph; cylinder width is measured along its arc. */
export function photoSize(width: number, height: number, maxWidth = 2.8, maxHeight = 2.3): { width: number; height: number } {
  const ratio = width > 0 && height > 0 ? width / height : 1;
  return ratio > maxWidth / maxHeight ? { width: maxWidth, height: maxWidth / ratio } : { width: maxHeight * ratio, height: maxHeight };
}
export function photoURL(file: string): string { return import.meta.env.BASE_URL + 'images/jewelry/' + file; }
