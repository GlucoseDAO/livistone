import * as THREE from 'three';
import { RAILWAY, STATION } from './station-layout';

function hash(x: number, z: number): number { const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return n - Math.floor(n); }
function noise(x: number, z: number): number {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(hash(ix, iz), hash(ix + 1, iz), u), THREE.MathUtils.lerp(hash(ix, iz + 1), hash(ix + 1, iz + 1), u), v);
}
export function mountainHeight(x: number, z: number): number {
  const r = Math.hypot(x / 1.12, z), phi = Math.atan2(x, z);
  const rise = THREE.MathUtils.smoothstep(r, 115, 230), fall = 1 - THREE.MathUtils.smoothstep(r, 300, 440);
  const ridge = 1 - Math.abs(noise(x * .027 + noise(x * .009, z * .009) * 3, z * .027) * 2 - 1);
  const crest = 20 + 18 * Math.sin(phi * 3 + 1) ** 2 + 20 * Math.sin(phi * 5 - .8) ** 6;
  const gullies = 3 * noise(x * .075, z * .075) + .7 * noise(x * .19, z * .19);
  const riverValley = .18 + .82 * THREE.MathUtils.smoothstep(Math.abs(z - 26), 12, 72);
  const original = -2 + rise * fall * riverValley * (crest + ridge * ridge * 26 + gullies);
  const spur = 24 * Math.exp(-(((Math.abs(x) - RAILWAY.portalX - 40) / 28) ** 2) - ((z - STATION.trackZ) / 28) ** 2) - 2;
  return Math.max(original, spur);
}

/** Subtract the rail clearance from the actual hillside triangles, including both far exits. */
function cutRailwayOpening(source: THREE.BufferGeometry): THREE.BufferGeometry {
  const pos = source.getAttribute('position'), color = source.getAttribute('color'), normal = source.getAttribute('normal'), positions: number[] = [], colors: number[] = [], normals: number[] = [];
  type Vertex = number[];
  const planes = [(v: Vertex): number => v[2] - STATION.trackZ + 4.55, (v: Vertex): number => STATION.trackZ + 4.55 - v[2], (v: Vertex): number => RAILWAY.clearanceHeight - v[1]];
  const clip = (polygon: Vertex[], distance: (v: Vertex) => number, inside: boolean): Vertex[] => {
    const result: Vertex[] = [];
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i], b = polygon[(i + 1) % polygon.length], da = distance(a) * (inside ? 1 : -1), db = distance(b) * (inside ? 1 : -1);
      if (da >= 0) result.push(a);
      if ((da > 0 && db < 0) || (da < 0 && db > 0)) { const t = da / (da - db); result.push(a.map((value, k) => value + (b[k] - value) * t)); }
    }
    return result;
  };
  const emit = (polygon: Vertex[]): void => { for (let i = 1; i < polygon.length - 1; i++) for (const v of [polygon[0], polygon[i], polygon[i + 1]]) { positions.push(...v.slice(0, 3)); colors.push(...v.slice(3, 6)); normals.push(...v.slice(6)); } };
  const index = source.index!;
  for (let i = 0; i < index.count; i += 3) {
    let polygon = [0, 1, 2].map((j) => { const n = index.getX(i + j); return [pos.getX(n), pos.getY(n), pos.getZ(n), color.getX(n), color.getY(n), color.getZ(n), normal.getX(n), normal.getY(n), normal.getZ(n)]; });
    if (planes.some((plane) => polygon.every((v) => plane(v) <= 0))) { emit(polygon); continue; }
    for (const plane of planes) { emit(clip(polygon, plane, false)); polygon = clip(polygon, plane, true); if (!polygon.length) break; }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3)); g.normalizeNormals(); source.dispose(); return g;
}

export function mountainGeometry(mobile: boolean): THREE.BufferGeometry {
    const angular = mobile ? 256 : 512, radial = mobile ? 60 : 112;
    const positions: number[] = [], colors: number[] = [], indices: number[] = [], color = new THREE.Color();
    for (let j = 0; j <= radial; j++) for (let i = 0; i <= angular; i++) {
      const phi = i / angular * Math.PI * 2, r = 101 + j / radial * 345, x = Math.sin(phi) * r * 1.12, z = Math.cos(phi) * r, y = mountainHeight(x, z);
      positions.push(x, y, z);
      const slope = Math.hypot(mountainHeight(x + 1, z) - mountainHeight(x - 1, z), mountainHeight(x, z + 1) - mountainHeight(x, z - 1)) / 2;
      const rock = THREE.MathUtils.smoothstep(slope, .65, 1.6) * .85 + THREE.MathUtils.smoothstep(y, 48, 80) * .45;
      color.set('#577943').lerp(new THREE.Color('#c0beb2'), Math.min(1, rock)); color.multiplyScalar(.8 + noise(x * .13, z * .13) * .35); colors.push(color.r, color.g, color.b);
      if (i < angular && j < radial) { const n = j * (angular + 1) + i; indices.push(n, n + angular + 1, n + 1, n + 1, n + angular + 1, n + angular + 2); }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geo.setIndex(indices); geo.computeVertexNormals();
    return cutRailwayOpening(geo);
}

export class Mountains extends THREE.Group {
  readonly ready: Promise<void>;
  constructor(mobile: boolean) {
    super(); this.name = 'Ridged mountain landscape';
    const geo = mountainGeometry(mobile);
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .96 });
    const landscape = new THREE.Mesh(geo, material); landscape.receiveShadow = true; this.add(landscape);
    const loader = new THREE.TextureLoader();
    this.ready = Promise.all([loader.loadAsync(import.meta.env.BASE_URL + 'textures/mountains/rock-color.jpg'), loader.loadAsync(import.meta.env.BASE_URL + 'textures/mountains/rock-normal.jpg')]).then(([rock, normal]) => {
      rock.colorSpace = THREE.SRGBColorSpace;
      for (const texture of [rock, normal]) { texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.anisotropy = mobile ? 2 : 4; }
      // Triplanar maps keep scanned cliff detail at a consistent scale on steep faces.
      material.onBeforeCompile = (shader) => {
        shader.uniforms.rockColor = { value: rock }; shader.uniforms.rockNormal = { value: normal };
        shader.vertexShader = 'varying vec3 mountainPosition; varying vec3 mountainNormal;\n' + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nmountainPosition=position; mountainNormal=normal;');
        shader.fragmentShader = 'uniform sampler2D rockColor; uniform sampler2D rockNormal; varying vec3 mountainPosition; varying vec3 mountainNormal;\n' + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
          vec3 weights=pow(abs(normalize(mountainNormal)),vec3(4.0)); weights/=max(dot(weights,vec3(1.0)),.001);
          vec3 p=mountainPosition*.065;
          vec3 rock=texture2D(rockColor,p.yz).rgb*weights.x+texture2D(rockColor,p.xz).rgb*weights.y+texture2D(rockColor,p.xy).rgb*weights.z;
          diffuseColor.rgb*=rock*1.8;
        `);
        if (!mobile) shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `
          vec2 nx=texture2D(rockNormal,p.yz).xy*2.0-1.0, ny=texture2D(rockNormal,p.xz).xy*2.0-1.0, nz=texture2D(rockNormal,p.xy).xy*2.0-1.0;
          vec3 detail=vec3(0.0,nx.y,nx.x)*weights.x+vec3(ny.x,0.0,ny.y)*weights.y+vec3(nz.x,nz.y,0.0)*weights.z;
          normal=normalize(mat3(viewMatrix)*(normalize(mountainNormal)+detail*.32));
        `);
      };
      material.needsUpdate = true;
    }).catch(() => { /* Vertex-coloured ridges remain visible if a texture cannot be loaded. */ });
  }
}
