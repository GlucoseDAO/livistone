import { COLLECTION, photoURL } from '../game/exhibits';
import type { Exhibit } from '../game/exhibits';
import { DISCOVERIES } from '../game/content';

export interface AlbumImage { src: string; alt: string; title: string; facts: string; source?: string; discovery?: string }
export function panelExhibit(id: string): Exhibit | undefined {
  const source = ({ 'winter-gate-story': 'eye-of-winter', 'eyelense-gate-story': 'eyelense' } as Record<string, string>)[id] ?? id;
  return COLLECTION.find(piece => piece.discovery === source);
}
export function panelCollection(id: string): string[] {
  const current = DISCOVERIES.find(d => d.id === id);
  if (!current) return [];
  const place = (key: string, fallback: string) => COLLECTION.find(p => p.discovery === key)?.location ?? fallback;
  const hall = place(id, current.landmark);
  return DISCOVERIES.filter(d => place(d.id, d.landmark) === hall).map(d => d.id);
}
export function pieceImages(pieces: readonly Exhibit[]): AlbumImage[] {
  return pieces.flatMap(piece => piece.photos.map(photo => ({ src: photoURL(photo.file), alt: photo.alt,
    title: piece.title, facts: `${piece.type} · ${piece.year} · ${piece.materials} · ${piece.dimensions}. ${piece.story ?? piece.description}`,
    source: piece.source, discovery: piece.discovery })));
}
export function panelImages(id: string): AlbumImage[] {
  return panelCollection(id).flatMap(key => {
    const piece = panelExhibit(key);
    if (piece) return pieceImages([piece]).map(image => ({ ...image, discovery: key }));
    const discovery = DISCOVERIES.find(d => d.id === key)!;
    return (discovery.slides ?? []).filter(s => s.image).map(s => ({ src: s.image!, alt: s.imageAlt ?? s.title,
      title: s.title, facts: s.body, discovery: key }));
  });
}
