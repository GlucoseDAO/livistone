import * as THREE from 'three';
import { RAILWAY, STATION } from './station-layout';

export { landscapeHeight as mountainHeight } from './terrain';
import { landscapeHeight, terrainNoise } from './terrain';
import { meadowMaterial } from './planting';

/** Subtract the rail clearance from the actual hillside triangles, including both far exits. */
function cutRailwayOpening(source: THREE.BufferGeometry): THREE.BufferGeometry {
  const pos = source.getAttribute('position'), color = source.getAttribute('color'), normal = source.getAttribute('normal'), positions: number[] = [], colors: number[] = [], normals: number[] = [];
  type Vertex = number[];
  // The Dark Nut mouths flare wider than the lined bore; cut that same apron out of the hillside.
  const flare = (v: Vertex): number => 1 - THREE.MathUtils.smoothstep(Math.min(Math.abs(Math.abs(v[0]) - RAILWAY.portalX), Math.abs(Math.abs(v[0]) - RAILWAY.exitX)), 7, 20);
  const tunnelPlanes = [(v: Vertex): number => v[2] - RAILWAY.centerZ + RAILWAY.boreHalfWidth + .45 + flare(v) * 2.2, (v: Vertex): number => RAILWAY.centerZ + RAILWAY.boreHalfWidth + .45 + flare(v) * 2.2 - v[2], (v: Vertex): number => RAILWAY.clearanceHeight + flare(v) * 2 - v[1]];
  const floorPlanes = [(v: Vertex): number => v[2] - RAILWAY.centerZ + 7, (v: Vertex): number => RAILWAY.centerZ + 7 - v[2], (v: Vertex): number => STATION.railHalfLength - Math.abs(v[0])];
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
    const planes = polygon.every(v => v[1] <= .02) ? floorPlanes : tunnelPlanes;
    if (planes.some((plane) => polygon.every((v) => plane(v) <= 0))) { emit(polygon); continue; }
    for (const plane of planes) { emit(clip(polygon, plane, false)); polygon = clip(polygon, plane, true); if (!polygon.length) break; }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3)); g.normalizeNormals(); source.dispose(); return g;
}

export function mountainGeometry(mobile: boolean): THREE.BufferGeometry {
    // Two-metre cells match the walking terrain; distant ridges use wider cells in both quality tiers.
    const axis = (start: number, end: number, nearStart: number, nearEnd: number): number[] => {
      const values: number[] = []; for (let value = start; value <= end; value += value >= nearStart && value < nearEnd ? 2 : Math.abs(value) > 520 ? 32 : mobile ? 8 : 4) values.push(value); return values;
    };
    const xs = axis(-1400, 1400, -240, 240), zs = axis(-1280, 1280, -270, 150);
    const positions: number[] = [], colors: number[] = [], indices: number[] = [], color = new THREE.Color(), grass = new THREE.Color('#50663b'), stone = new THREE.Color('#a6a294');
    for (let j = 0; j < zs.length; j++) for (let i = 0; i < xs.length; i++) {
      const x = xs[i], z = zs[j], y = landscapeHeight(x, z);
      positions.push(x, y, z);
      const slope = Math.hypot(landscapeHeight(x + 1, z) - landscapeHeight(x - 1, z), landscapeHeight(x, z + 1) - landscapeHeight(x, z - 1)) / 2;
      const rock = Math.min(1, THREE.MathUtils.smoothstep(slope, .6, 1.7) * .85 + THREE.MathUtils.smoothstep(y, 58, 100) * .65);
      color.copy(grass).lerp(stone, rock).multiplyScalar(.88 + terrainNoise(x * .045, z * .045) * .24);
      colors.push(color.r, color.g, color.b);
      if (i < xs.length - 1 && j < zs.length - 1) { const n = j * xs.length + i; indices.push(n, n + xs.length, n + 1, n + 1, n + xs.length, n + xs.length + 1); }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geo.setIndex(indices); geo.computeVertexNormals();
    return cutRailwayOpening(geo);
}

export class Mountains extends THREE.Group {
  readonly ready: Promise<void>;
  constructor(mobile: boolean) {
    super(); this.name = 'Continuous valley and mountain ridges';
    const geo = mountainGeometry(mobile);
    const meadow = meadowMaterial(), grass = meadow.map!; meadow.dispose();
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .96 });
    const landscape = new THREE.Mesh(geo, material); landscape.receiveShadow = true; this.add(landscape);
    const loader = new THREE.TextureLoader();
    this.ready = Promise.all([loader.loadAsync(import.meta.env.BASE_URL + 'textures/mountains/rock-color.jpg'), loader.loadAsync(import.meta.env.BASE_URL + 'textures/mountains/rock-normal.jpg')]).then(([rock, normal]) => {
      rock.colorSpace = THREE.SRGBColorSpace;
      for (const texture of [rock, normal]) { texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.anisotropy = mobile ? 2 : 4; }
      // Triplanar maps keep scanned cliff detail at a consistent scale on steep faces.
      material.onBeforeCompile = (shader) => {
        shader.uniforms.grassColor = { value: grass }; shader.uniforms.rockColor = { value: rock }; shader.uniforms.rockNormal = { value: normal };
        shader.vertexShader = 'varying vec3 mountainPosition; varying vec3 mountainNormal;\n' + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nmountainPosition=position; mountainNormal=normal;');
        shader.fragmentShader = 'uniform sampler2D grassColor; uniform sampler2D rockColor; uniform sampler2D rockNormal; varying vec3 mountainPosition; varying vec3 mountainNormal;\n' + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
          vec3 weights=pow(abs(normalize(mountainNormal)),vec3(4.0)); weights/=max(dot(weights,vec3(1.0)),.001);
          vec3 p=mountainPosition*.065;
          vec3 rock=texture2D(rockColor,p.yz).rgb*weights.x+texture2D(rockColor,p.xz).rgb*weights.y+texture2D(rockColor,p.xy).rgb*weights.z;
          float exposed=clamp(smoothstep(.18,.65,1.0-abs(normalize(mountainNormal).y)) + smoothstep(58.0,105.0,mountainPosition.y)*.5,0.0,1.0);
          vec3 meadow=texture2D(grassColor,mountainPosition.xz/7.0).rgb;
          diffuseColor.rgb*=mix(meadow*1.65,rock*1.8,exposed);
        `);
        if (!mobile) shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `
          vec2 nx=texture2D(rockNormal,p.yz).xy*2.0-1.0, ny=texture2D(rockNormal,p.xz).xy*2.0-1.0, nz=texture2D(rockNormal,p.xy).xy*2.0-1.0;
          vec3 detail=vec3(0.0,nx.y,nx.x)*weights.x+vec3(ny.x,0.0,ny.y)*weights.y+vec3(nz.x,nz.y,0.0)*weights.z;
          normal=normalize(mat3(viewMatrix)*(normalize(mountainNormal)+detail*.32*exposed));
        `);
      };
      material.needsUpdate = true;
    }).catch(() => { /* Vertex-coloured ridges remain visible if a texture cannot be loaded. */ });
  }
}
