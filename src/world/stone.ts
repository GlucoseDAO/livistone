import * as THREE from 'three';

/** One four-metre tile, with separate colour and relief so mortar stays recessed. */
export function pavingMaterial(): THREE.MeshStandardMaterial {
  const canvas = document.createElement('canvas'), relief = document.createElement('canvas');
  canvas.width = canvas.height = relief.width = relief.height = 512;
  const ctx = canvas.getContext('2d')!, bump = relief.getContext('2d')!;
  let seed = 725; const rand = (): number => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  ctx.fillStyle = '#9b9582'; ctx.fillRect(0, 0, 512, 512); bump.fillStyle = '#555555'; bump.fillRect(0, 0, 512, 512);
  for (let row = 0; row < 8; row++) for (let col = -1; col < 4; col++) {
    const x = col * 128 + (row % 2) * 64, y = row * 64, light = 72 + rand() * 12;
    const points = [[x + 3, y + 3], [x + 123, y + 2], [x + 126, y + 59], [x + 4, y + 62]];
    for (const c of [ctx, bump]) {
      c.beginPath(); points.forEach(([px, py], i) => i ? c.lineTo(px, py) : c.moveTo(px, py)); c.closePath();
      c.fillStyle = c === ctx ? `hsl(42, ${14 + rand() * 9}%, ${light}%)` : '#d9d9d9'; c.fill();
      c.strokeStyle = c === ctx ? 'rgba(255,250,228,.45)' : '#aaaaaa'; c.lineWidth = 2; c.stroke();
    }
  }
  for (let i = 0; i < 38000; i++) {
    const x = rand() * 512, y = rand() * 512, size = .5 + rand() * 2;
    ctx.fillStyle = i % 2 ? 'rgba(69,61,42,.09)' : 'rgba(255,252,226,.15)'; ctx.fillRect(x, y, size, size);
    bump.fillStyle = 'rgba(65,65,65,.12)'; bump.fillRect(x, y, size, size);
  }
  const map = new THREE.CanvasTexture(canvas), bumpMap = new THREE.CanvasTexture(relief);
  for (const t of [map, bumpMap]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; }
  map.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({ map, bumpMap, bumpScale: .035, roughness: .94, side: THREE.DoubleSide });
}

export function rockGeometry(): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(1, 2), p = g.getAttribute('position'), colors: number[] = [], color = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const r = 1 + .12 * Math.sin(x * 13 + z * 7) * Math.cos(y * 11 - x * 4);
    p.setXYZ(i, x * r, y * r, z * r);
    color.set('#c2cbcf').multiplyScalar(.78 + .18 * Math.sin(x * 19 + y * 9 + z * 13));
    if (y > .2) color.lerp(new THREE.Color('#7b8976'), .32 + .18 * Math.sin(z * 17));
    colors.push(color.r, color.g, color.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); g.computeVertexNormals(); return g;
}

export function rockMaterial(mobile: boolean): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
  // Retain scanned mineral detail, but remove the source map's rusty brown cast.
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
      #ifdef USE_MAP
        vec4 sampledDiffuseColor = texture2D(map, vMapUv);
        float mineral = dot(sampledDiffuseColor.rgb, vec3(.2126, .7152, .0722));
        diffuseColor.rgb *= mix(vec3(.55), vec3(1.05), mineral);
      #endif`);
  };
  material.customProgramCacheKey = () => 'cool-river-limestone-v1';
  const loader = new THREE.TextureLoader();
  loader.load(import.meta.env.BASE_URL + 'textures/mountains/rock-color.jpg', (map) => {
    map.colorSpace = THREE.SRGBColorSpace; map.wrapS = map.wrapT = THREE.RepeatWrapping; map.anisotropy = mobile ? 2 : 4;
    material.map = map; material.needsUpdate = true;
  }, undefined, () => { /* Vertex colour keeps the stones usable without the optional surface map. */ });
  if (!mobile) loader.load(import.meta.env.BASE_URL + 'textures/mountains/rock-normal.jpg', (map) => {
    map.wrapS = map.wrapT = THREE.RepeatWrapping; material.normalMap = map; material.normalScale.set(.65, .65); material.needsUpdate = true;
  }, undefined, () => { /* The silhouette remains modelled if relief cannot load. */ });
  return material;
}
