import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/** Reuse textured model geometry in spatial batches, keeping draw calls bounded. */
export class Forest extends THREE.Group {
  sites: THREE.Vector3[] = [];
  async load(mobile: boolean): Promise<void> {
    const loader = new GLTFLoader();
    const models = await Promise.all(['oak', 'ash'].map((name) => loader.loadAsync(import.meta.env.BASE_URL + 'models/trees/' + name + '.glb')));
    for (let species = 0; species < models.length; species++) {
      const parts: THREE.Mesh[] = []; models[species].scene.updateMatrixWorld(true);
      models[species].scene.traverse((o) => { if (o instanceof THREE.Mesh) parts.push(o); });
      const cells = new Map<string, { p: THREE.Vector3; index: number }[]>();
      this.sites.forEach((p, index) => {
        if (index % 2 !== species) return;
        const key = Math.floor(p.x / 48) + ':' + Math.floor(p.z / 48);
        const cell = cells.get(key) ?? []; cell.push({ p, index }); cells.set(key, cell);
      });
      for (const source of parts) {
        const geo = source.geometry.clone().applyMatrix4(source.matrixWorld);
        // Distant/mobile foliage can use one of each crossed pair of leaf cards.
        if (mobile && source.name === 'foliage' && geo.index) {
          const index = Array.from(geo.index.array); const reduced: number[] = [];
          for (let i = 0; i < index.length; i += 12) reduced.push(...index.slice(i, i + 6));
          geo.setIndex(reduced);
        }
        const material = source.material as THREE.MeshStandardMaterial;
        material.envMapIntensity = .35;
        if (material.map) material.map.anisotropy = 4;
        for (const sites of cells.values()) {
          const batch = new THREE.InstancedMesh(geo, material, sites.length);
          const matrix = new THREE.Matrix4(), quaternion = new THREE.Quaternion(), color = new THREE.Color();
          sites.forEach(({ p, index }, i) => {
            const scale = .66 + ((index * 317) % 100) / 100 * .48;
            quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), index * 2.399);
            matrix.compose(p, quaternion, new THREE.Vector3(scale, scale * (1 + (index % 3) * .035), scale));
            batch.setMatrixAt(i, matrix);
            color.setHSL(.21 + (index % 5) * .009, source.name === 'foliage' ? .14 : .03, .65 + (index % 4) * .06);
            batch.setColorAt(i, color);
          });
          batch.castShadow = true; batch.receiveShadow = true; batch.computeBoundingSphere(); batch.name = source.name; this.add(batch);
        }
      }
    }
  }
}
