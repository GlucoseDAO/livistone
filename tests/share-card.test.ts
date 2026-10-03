import { describe, expect, it } from 'vitest';
import { readFileSync, statSync } from 'node:fs';

// Link previews (Telegram, WhatsApp, Slack, social networks) read these tags; without them they fall back to the first large
// image on the page, which was the loading portrait.
const html = readFileSync('index.html', 'utf8');
const meta = (key: string) => html.match(new RegExp(`<meta (?:property|name)="${key}" content="([^"]*)"`))?.[1];
const ORIGIN = 'https://livistone.liviazaharia.com/';

/** Width and height from a baseline or progressive JPEG's start-of-frame segment. */
function jpegSize(bytes: Buffer): { width: number; height: number } {
  for (let i = 2; i < bytes.length;) {
    const marker = bytes[i + 1]!, length = bytes.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xc2) return { height: bytes.readUInt16BE(i + 5), width: bytes.readUInt16BE(i + 7) };
    i += 2 + length;
  }
  throw new Error('No JPEG frame header');
}

describe('share card', () => {
  const image = meta('og:image')!;
  it('points every preview at one absolute in-game image on the production host', () => {
    expect(image.startsWith(ORIGIN)).toBe(true);
    expect(meta('og:image:secure_url')).toBe(image); expect(meta('twitter:image')).toBe(image);
    expect(meta('twitter:card')).toBe('summary_large_image'); expect(meta('og:url')).toBe(ORIGIN);
    for (const key of ['og:title', 'og:description', 'og:image:alt', 'twitter:title', 'twitter:description', 'twitter:image:alt']) expect(meta(key)).toBeTruthy();
  });
  it('ships the declared 1200×630 JPEG, small enough for WhatsApp', () => {
    const file = `public/${image.slice(ORIGIN.length)}`, bytes = readFileSync(file);
    expect(meta('og:image:type')).toBe('image/jpeg');
    expect(jpegSize(bytes)).toEqual({ width: Number(meta('og:image:width')), height: Number(meta('og:image:height')) });
    expect(Number(meta('og:image:width')) / Number(meta('og:image:height'))).toBeCloseTo(1.905, 2);
    expect(statSync(file).size).toBeLessThan(300 * 1024);
  });
});
