import type { Landmark } from './content';

/** Only registered places can choose an arrival; URL text never becomes a model path or arbitrary position. */
export function placeFromUrl(href: string, landmarks: readonly Landmark[]): Landmark | undefined {
  const id = new URL(href).searchParams.get('place');
  return landmarks.find(landmark => landmark.id === id);
}

/** Keep the current origin, base path, other query parameters and hash when sharing a named destination. */
export function placeUrl(href: string, id: string, landmarks: readonly Landmark[]): string | undefined {
  if (!landmarks.some(landmark => landmark.id === id)) return undefined;
  const url = new URL(href); url.searchParams.set('place', id);
  return url.href;
}
