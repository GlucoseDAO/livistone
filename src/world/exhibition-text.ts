import * as THREE from 'three';
import type { Exhibit } from '../game/exhibits';

export const TEXT_WIDTH = 960, TEXT_HEIGHT = 1560;
export const TEXT_ACTIONS = [
  { action: 'info', label: '1  About this piece', x: 64, y: 860, width: 832, height: 96 },
  { action: 'browse', label: '2  Explore other pieces', x: 64, y: 972, width: 832, height: 96 },
  { action: 'left', label: '↶', x: 64, y: 1084, width: 150, height: 96 },
  { action: 'pause', label: 'Pause rotation', x: 230, y: 1084, width: 500, height: 96 },
  { action: 'right', label: '↷', x: 746, y: 1084, width: 150, height: 96 },
  { action: 'photo', label: '3  Open photograph', x: 64, y: 1196, width: 832, height: 96 },
  { action: 'lore', label: '4  About this place', x: 64, y: 1308, width: 832, height: 96 },
];
export function textAction(u: number, v: number): string | undefined {
  const x = u * TEXT_WIDTH, y = (1 - v) * TEXT_HEIGHT;
  return TEXT_ACTIONS.find((r) => x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height)?.action;
}
/** Pixel aspect is matched to unwrapped cylinder arc width / height, never its chord. */
export function informationTexture(exhibit: Exhibit, paused: boolean): THREE.CanvasTexture {
  const canvas = document.createElement('canvas'); canvas.width = TEXT_WIDTH; canvas.height = TEXT_HEIGHT;
  const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#f2efde'; ctx.fillRect(0, 0, TEXT_WIDTH, TEXT_HEIGHT);
  ctx.fillStyle = '#28483d'; ctx.font = '25px sans-serif'; ctx.fillText('LIVIA ZAHARIA · JEWELRY GALLERY', 64, 90);
  const wrap = (text: string, font: string, y: number, lineHeight: number): number => {
    ctx.font = font; let line = '';
    for (const word of text.split(/\s+/)) {
      const next = line ? line + ' ' + word : word;
      if (line && ctx.measureText(next).width > 832) { ctx.fillText(line, 64, y); y += lineHeight; line = word; } else line = next;
    }
    if (line) ctx.fillText(line, 64, y); return y + lineHeight;
  };
  let y = wrap(exhibit.title, '64px Georgia', 192, 74) + 20;
  y = wrap(exhibit.type + ' · ' + exhibit.year, '34px sans-serif', y, 45);
  y = wrap(exhibit.materials, '34px sans-serif', y, 45);
  y = wrap(exhibit.dimensions, '34px sans-serif', y, 45) + 26;
  // Fit by reducing font size uniformly; never compress glyph widths with fillText(maxWidth).
  let fontSize = 36;
  for (; fontSize > 24; fontSize--) {
    ctx.font = `${fontSize}px sans-serif`; let lines = 1, line = '';
    for (const word of exhibit.description.split(/\s+/)) { const next = line + ' ' + word; if (ctx.measureText(next).width > 832) { lines++; line = word; } else line = next; }
    if (y + lines * fontSize * 1.4 <= 810) break;
  }
  wrap(exhibit.description, `${fontSize}px sans-serif`, y, fontSize * 1.4);
  for (const r of TEXT_ACTIONS) {
    ctx.fillStyle = '#dce6d6'; ctx.fillRect(r.x, r.y, r.width, r.height);
    ctx.strokeStyle = '#9caf96'; ctx.lineWidth = 2; ctx.strokeRect(r.x, r.y, r.width, r.height);
    ctx.fillStyle = '#28483d'; ctx.font = '34px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(r.action === 'pause' ? (paused ? 'Resume rotation' : r.label) : r.label, r.x + r.width / 2, r.y + 60); ctx.textAlign = 'left';
  }
  ctx.font = '25px sans-serif'; ctx.fillText('Click / tap a label · P pause · [ / ] rotate', 64, 1480);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8; return texture;
}
