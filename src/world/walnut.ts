import * as THREE from 'three';

// The shell has irregular raised cells and branching furrows, rather than timber grain.
export function walnutMaterial(): THREE.MeshStandardMaterial {
  const size = 256, color = document.createElement('canvas'), relief = document.createElement('canvas');
  color.width = relief.width = size; color.height = relief.height = size;
  const ctx = color.getContext('2d')!, bump = relief.getContext('2d')!;
  const pixels = ctx.createImageData(size, size), heights = bump.createImageData(size, size);
  const seeds = Array.from({ length: 80 }, (_, i) => ({ x: (i % 8 + .5 + Math.sin(i * 17.3) * .46) / 8, y: (Math.floor(i / 8) + .5 + Math.cos(i * 12.7) * .46) / 10 }));
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size + Math.sin(y * .048) * .055 + Math.sin(y * .13) * .016, v = y / size + Math.sin(x * .041) * .03;
    let first = Infinity, second = Infinity;
    for (const seed of seeds) {
      const dx = Math.min(Math.abs(u - seed.x), 1 - Math.abs(u - seed.x)), dy = Math.min(Math.abs(v - seed.y), 1 - Math.abs(v - seed.y));
      const d = dx * dx + dy * dy * .65;
      if (d < first) { second = first; first = d; } else if (d < second) second = d;
    }
    const raised = THREE.MathUtils.smoothstep(Math.sqrt(second) - Math.sqrt(first), .0002, .009);
    const grain = Math.sin(x * 3.17 + y * 7.23) * 3, i = (y * size + x) * 4;
    pixels.data.set([140 + raised * 34 + grain, 95 + raised * 34 + grain, 54 + raised * 30 + grain, 255], i);
    heights.data.set([raised * 220, raised * 220, raised * 220, 255], i);
  }
  ctx.putImageData(pixels, 0, 0); bump.putImageData(heights, 0, 0);
  const map = new THREE.CanvasTexture(color), bumpMap = new THREE.CanvasTexture(relief);
  map.colorSpace = THREE.SRGBColorSpace;
  for (const texture of [map, bumpMap]) { texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(1.7, 1.5); }
  return new THREE.MeshStandardMaterial({ color: '#ead3ab', map, bumpMap, bumpScale: .45, roughness: .72, side: THREE.DoubleSide });
}

export function walnutRadius(phi: number, theta: number, radius: number): number {
  const lobes = .25 * Math.cos(phi * 7 + Math.sin(theta * 4) * .8);
  const wrinkles = .13 * Math.sin(phi * 23 + Math.sin(theta * 11) * 1.4) + .08 * Math.cos(theta * 27 + phi * 9);
  return radius + (lobes + wrinkles) * Math.max(0, Math.sin(theta)) ** .6 * Math.max(0, Math.sin(phi)) ** .4;
}
