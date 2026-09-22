import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const NEAR = 36;

export function forestLod(distance: number, fogFar: number): 'full' | 'reduced' | 'hidden' {
  if (distance >= fogFar * .72) return 'hidden';
  return distance < NEAR ? 'full' : 'reduced';
}

function thinFoliage(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const copy = geo.clone();
  if (!copy.index) return copy;
  const index = Array.from(copy.index.array), reduced: number[] = [];
  for (let i = 0; i < index.length; i += 12) reduced.push(...index.slice(i, i + 6));
  copy.setIndex(reduced); return copy;
}

type Cell = { center: THREE.Vector3; trunk: THREE.InstancedMesh[]; foliage: THREE.InstancedMesh[] };

/** Reuse textured model geometry in spatial batches, keeping draw calls bounded. */
export class Forest extends THREE.Group {
  sites: THREE.Vector3[] = [];
  private cells: Cell[] = [];
  async load(mobile: boolean): Promise<void> {
    const loader = new GLTFLoader();
    const models = await Promise.all(['oak', 'ash'].map((name) => loader.loadAsync(import.meta.env.BASE_URL + 'models/trees/' + name + '.glb')));
    for (let species = 0; species < models.length; species++) {
      const parts: THREE.Mesh[] = []; models[species].scene.updateMatrixWorld(true);
      models[species].scene.traverse((o) => { if (o instanceof THREE.Mesh) parts.push(o); });
      const grouped = new Map<string, { p: THREE.Vector3; index: number }[]>();
      this.sites.forEach((p, index) => {
        if (index % 2 !== species) return;
        const key = Math.floor(p.x / 48) + ':' + Math.floor(p.z / 48);
        const cell = grouped.get(key) ?? []; cell.push({ p, index }); grouped.set(key, cell);
      });
      const cells = [...grouped.values()].map((sites) => {
        const center = new THREE.Vector3();
        for (const { p } of sites) center.add(p);
        center.multiplyScalar(1 / sites.length);
        const cell: Cell = { center, trunk: [], foliage: [] }; this.cells.push(cell);
        return { sites, cell };
      });
      for (const source of parts) {
        const geo = source.geometry.clone().applyMatrix4(source.matrixWorld);
        const reduced = source.name === 'foliage' ? thinFoliage(geo) : null;
        const material = source.material as THREE.MeshStandardMaterial;
        material.envMapIntensity = .35;
        if (material.map) material.map.anisotropy = 4;
        for (const { sites, cell } of cells) {
          const batch = new THREE.InstancedMesh(mobile && reduced ? reduced : geo, material, sites.length);
          const matrix = new THREE.Matrix4(), quaternion = new THREE.Quaternion(), color = new THREE.Color();
          sites.forEach(({ p, index }, i) => {
            const scale = .66 + ((index * 317) % 100) / 100 * .48;
            quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), index * 2.399);
            matrix.compose(p, quaternion, new THREE.Vector3(scale, scale * (1 + (index % 3) * .035), scale));
            batch.setMatrixAt(i, matrix);
            color.setHSL(.21 + (index % 5) * .009, source.name === 'foliage' ? .14 : .03, .65 + (index % 4) * .06);
            batch.setColorAt(i, color);
          });
          batch.castShadow = source.name !== 'foliage'; batch.receiveShadow = true; batch.computeBoundingSphere(); batch.name = source.name; this.add(batch);
          if (reduced) {
            batch.userData.fullGeo = mobile ? reduced : geo; batch.userData.reducedGeo = reduced;
            cell.foliage.push(batch);
          } else cell.trunk.push(batch);
        }
      }
    }
  }
  update(camera: THREE.Camera, fogFar: number, mapView: boolean): void {
    const origin = camera.position;
    for (const cell of this.cells) {
      const lod = forestLod(origin.distanceTo(cell.center), fogFar);
      const show = lod !== 'hidden', useFull = !mapView && lod === 'full';
      for (const mesh of cell.trunk) mesh.visible = show || mapView;
      for (const mesh of cell.foliage) {
        mesh.visible = show && !mapView;
        const full = mesh.userData.fullGeo as THREE.BufferGeometry, reduced = mesh.userData.reducedGeo as THREE.BufferGeometry;
        mesh.geometry = useFull ? full : reduced;
      }
    }
  }
}
