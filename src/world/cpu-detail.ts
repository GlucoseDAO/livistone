import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Classic and node standard materials alike: the Lambert copies of the rocks and lake drop their node shading, as the classic copies dropped GLSL patches. */
const standard = (material: THREE.Material): material is THREE.MeshStandardMaterial => material instanceof THREE.MeshStandardMaterial || (material as THREE.MeshStandardNodeMaterial).isMeshStandardNodeMaterial === true;

/** CPU rendering keeps the same town and collision world, with cheap lighting and boundary-locked visual meshes. */
export async function prepareCpuDetail(root: THREE.Object3D, reflection: THREE.CubeTexture): Promise<{ before: number; after: number }> {
  const { MeshoptSimplifier } = await import('meshoptimizer/simplifier'); await MeshoptSimplifier.ready;
  const geometries = new Map<THREE.BufferGeometry, THREE.BufferGeometry>(), materials = new Map<THREE.Material, THREE.Material>();
  let before = 0, after = 0;
  const meshes: THREE.Mesh[] = [];
  root.traverse(object => {
    if (object instanceof THREE.PointLight) object.visible = false;
    if (object instanceof THREE.Points) object.visible = false;
    if (object instanceof THREE.Mesh) meshes.push(object);
  });
  for (let i = 0; i < meshes.length; i++) {
    const mesh = meshes[i];
    const convert = (source: THREE.Material): THREE.Material => {
      const cached = materials.get(source); if (cached) return cached;
      if (!standard(source)) return source;
      const material = new THREE.MeshLambertMaterial({ color: source.color, map: source.map, emissive: source.emissive, emissiveIntensity: source.emissiveIntensity, emissiveMap: source.emissiveMap, vertexColors: source.vertexColors, transparent: source.transparent, opacity: source.opacity, alphaTest: source.alphaTest, side: source.side, depthWrite: source.depthWrite, flatShading: source.flatShading, fog: source.fog });
      material.name = source.name; material.userData = { ...source.userData };
      // The Nut of Power crystal keeps its rim and distance solidity (city-hall.ts): at its bare opacity it vanished against the sky.
      if (source.userData.cityHallCrystal) { const { colorNode, opacityNode } = source as unknown as THREE.MeshStandardNodeMaterial; Object.assign(material, { colorNode, opacityNode }); }
      if (source.metalness > .4) { material.envMap = reflection; material.reflectivity = .28; }
      materials.set(source, material); return material;
    };
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(convert) : convert(mesh.material);
    const source = mesh.geometry, count = source.index?.count ?? source.getAttribute('position')?.count ?? 0;
    const instances = mesh instanceof THREE.InstancedMesh ? mesh.count : 1; before += count / 3 * instances;
    // The river sheet keeps every vertex: its baked bank-to-deep colour gradient lives in them. Meshes whose vertices must stay
    // exact, such as contact-shadow patches lying on the ground triangles, opt out with userData.keepGeometry.
    if (count > 3600 && !Array.isArray(mesh.material) && !mesh.userData.keepGeometry && mesh.name !== 'Textured meadow and soil' && mesh.name !== 'River water' && !mesh.name.includes('walking network') && !mesh.name.includes('kerb') && !mesh.name.includes('path borders')) {
      let geometry = geometries.get(source);
      if (!geometry) {
        const position = source.getAttribute('position');
        if (!(position instanceof THREE.BufferAttribute) || position.itemSize !== 3) { after += count / 3 * instances; continue; }
        const positions = new Float32Array(position.array), remap = MeshoptSimplifier.generatePositionRemap(positions, 3);
        const indices = source.index ? Uint32Array.from(source.index.array, n => remap[n]) : Uint32Array.from({ length: position.count }, (_, n) => remap[n]);
        const [simplified] = MeshoptSimplifier.simplify(indices, positions, 3, Math.floor(indices.length * .22 / 3) * 3, .004, ['LockBorder']);
        geometry = source.clone(); geometry.setIndex(new THREE.BufferAttribute(simplified, 1)); geometry.clearGroups(); geometries.set(source, geometry);
      }
      mesh.geometry = geometry;
      if (mesh.userData.fullGeo) { mesh.userData.fullGeo = geometry; mesh.userData.reducedGeo = geometry; }
    }
    after += (mesh.geometry.index?.count ?? mesh.geometry.getAttribute('position').count) / 3 * instances;
    // Yield between chunks so loading progress and scrolling remain responsive.
    if (i % 24 === 23) await new Promise<void>(resolve => setTimeout(resolve, 0));
  }
  const groups = new Map<string, THREE.Mesh[]>();
  for (const mesh of meshes) {
    if (!mesh.visible || mesh instanceof THREE.InstancedMesh || !mesh.parent || !(mesh.material instanceof THREE.MeshLambertMaterial) || mesh.material.transparent || Object.keys(mesh.userData).length) continue;
    const key = mesh.parent.uuid + ':' + mesh.material.uuid + ':' + !!mesh.geometry.index + ':' + Object.keys(mesh.geometry.attributes).sort().join(',');
    const group = groups.get(key) ?? []; group.push(mesh); groups.set(key, group);
  }
  for (const group of groups.values()) {
    if (group.length < 3) continue;
    const parts = group.map(mesh => { mesh.updateMatrix(); return mesh.geometry.clone().applyMatrix4(mesh.matrix); });
    const geometry = mergeGeometries(parts); parts.forEach(part => part.dispose());
    if (!geometry) continue;
    const batch = new THREE.Mesh(geometry, group[0].material); batch.name = 'CPU static architecture'; group[0].parent!.add(batch);
    group.forEach(mesh => { mesh.visible = false; });
  }
  return { before, after };
}
