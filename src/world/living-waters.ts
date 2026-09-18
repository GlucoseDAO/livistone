import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Forest } from './forest';
import { meadowMaterial } from './planting';
import type { ColliderSpec } from '../game/physics';
import type { Interactive } from './world';
import { createMaglevTrain } from './train';
import { GARDENS, GARDEN_PATHS, LAKE_OUTLINE, WATER_EYES, gardenHeight, rainPlantAllowed } from './living-waters-layout';
import type { Point } from './living-waters-layout';

function shape(points: Point[]): THREE.Shape { return new THREE.Shape(points.map(([x, z]) => new THREE.Vector2(x, -z))); }
export class LivingWaters {
  readonly root = new THREE.Group();
  readonly colliders: ColliderSpec[] = [];
  readonly interactives: Interactive[] = [];
  readonly train: THREE.Group;
  readonly panels: THREE.Mesh[] = [];
  private readonly water = new THREE.MeshStandardMaterial({ color: '#7bafaa', vertexColors: true, metalness: .34, roughness: .25, envMapIntensity: 1.2 });
  private readonly waterTime = { value: 0 };
  private readonly terrain: THREE.Mesh;
  private readonly silver = new THREE.MeshStandardMaterial({ color: '#d9e0d6', metalness: .63, roughness: .32 });
  private readonly stone = new THREE.MeshStandardMaterial({ color: '#d4cfbc', roughness: .91 });
  private readonly rain: THREE.Points;
  private readonly drips: THREE.Points;
  private readonly drainage: THREE.Curve<THREE.Vector3>[] = [];
  private readonly forest = new Forest();
  constructor(private mobile: boolean) {
    this.root.name = 'Living Waters'; this.root.position.x = GARDENS.x;
    const terrain = new THREE.PlaneGeometry(500, 450, 125, 113).rotateX(-Math.PI / 2).translate(25, 0, -10), position = terrain.getAttribute('position');
    const colors: number[] = [], color = new THREE.Color();
    for (let i = 0; i < position.count; i++) { const x = position.getX(i), z = position.getZ(i), distance = Math.hypot(x - 25, z); position.setY(i, gardenHeight(x, z) + Math.max(0, distance - 105) * .09 * (1 + Math.sin(x * .025) * Math.cos(z * .033)) * THREE.MathUtils.smoothstep(Math.abs(z + 82), 9, 24));
      color.setHSL(.23 + Math.sin(x * .07 + z * .08) * .009, .24, .33 + Math.sin(x * .05) * Math.cos(z * .07) * .035); colors.push(color.r, color.g, color.b); }
    terrain.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); terrain.computeVertexNormals();
    this.terrain = this.mesh(terrain, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }), true);
    this.water.onBeforeCompile = (shader) => {
      shader.uniforms.waterTime = this.waterTime;
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWater;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWater = position;');
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nuniform float waterTime; varying vec3 vWater;');
      shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        vec2 p = vWater.xz; float t = waterTime;
        vec2 ripple = vec2(sin(p.x*2.8+p.y*1.7-t*.8), cos(p.y*3.1-p.x*1.4-t*.6))*.047;
        normal = normalize(normal + mat3(viewMatrix)*vec3(ripple.x,0.,ripple.y));`);
    };
    this.water.customProgramCacheKey = () => 'living-waters-ripples-v1';
    const network = shape(LAKE_OUTLINE); WATER_EYES.forEach((cell) => network.holes.push(new THREE.Path(cell.map(([x, z]) => new THREE.Vector2(x, -z)))));
    this.mesh(new THREE.ShapeGeometry(network).rotateX(-Math.PI / 2), this.silver, true, 0, .12);
    WATER_EYES.forEach((cell, index) => {
      const mesh = this.mesh(this.waterEye(cell), this.water, false, 0, -.08 + index % 3 * .012); mesh.castShadow = false;
      const outline = cell.map(([x, z]) => new THREE.Vector3(x, .14, z)); outline.push(outline[0].clone());
      this.mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(outline, false, 'catmullrom', 0), cell.length * 3, .085, 5, false), this.stone, false);
    });
    for (const path of GARDEN_PATHS) this.path(path, 2.2);
    this.pavilion(); this.platform();
    const local: ColliderSpec[] = []; this.train = createMaglevTrain(this.root, local, mobile);
    for (const spec of local) {
      if (spec.type === 'box') this.colliders.push({ ...spec, position: [spec.position[0] + GARDENS.x, spec.position[1], spec.position[2]] });
      else { const vertices = spec.vertices.slice(); for (let i = 0; i < vertices.length; i += 3) vertices[i] += GARDENS.x; this.colliders.push({ ...spec, vertices }); }
    }
    for (const z of [-79, -85]) for (const dz of [-.8, .8]) this.mesh(new THREE.BoxGeometry(300, .18, .24), this.silver, true, -100, .12, z + dz);
    this.umbrellas(); this.wetlandPlanting();
    for (let i = 0; i < (mobile ? 34 : 64); i++) { const angle = i * 2.399, x = Math.cos(angle) * (55 + i % 5 * 3), z = Math.sin(angle) * (53 + i % 7 * 2); if (z < -35 || x > 48) continue;
      this.forest.sites.push(new THREE.Vector3(x, 0, z)); this.colliders.push({ type: 'box', position: [GARDENS.x + x, 2, z], size: [.3, 2, .3] }); }
    this.root.add(this.forest);
    const channel = new THREE.CatmullRomCurve3([[75, 0], [72, 10], [63, 17], [53, 14], [42, 8]].map(([x, z]) => new THREE.Vector3(x, .035, z)));
    this.drainage.push(channel);
    this.mesh(new THREE.TubeGeometry(channel, 70, .28, 6, false), this.silver, false);
    this.mesh(new THREE.TubeGeometry(channel, 70, .18, 5, false), this.water, false, 0, .08);
    this.mesh(new THREE.CylinderGeometry(3.6, 3.9, .14, 40), this.water, false, 75, .025, 0);
    this.mesh(new THREE.IcosahedronGeometry(1.1, 1), new THREE.MeshStandardMaterial({ color: '#bddacf', metalness: .45, roughness: .2 }), true, 75, .65, 0);
    const rain = new Float32Array((mobile ? 150 : 460) * 3), drips = new Float32Array(this.drainage.length * 6 * 3);
    for (let i = 0; i < rain.length; i += 3) { rain[i] = 56 + (i * 7.71 % 44); rain[i + 1] = i * .618 % 9; rain[i + 2] = -29 + (i * 3.37 % 57); }
    for (let i = 0; i < drips.length / 3; i++) { const p = this.drainage[i % this.drainage.length].getPoint((i % 6) / 6); drips[i * 3] = p.x; drips[i * 3 + 1] = p.y + .1; drips[i * 3 + 2] = p.z; }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(rain, 3)); this.rain = new THREE.Points(geometry, new THREE.PointsMaterial({ color: '#e1f3ef', size: .09, transparent: true, opacity: .7 })); this.root.add(this.rain);
    const dripGeo = new THREE.BufferGeometry(); dripGeo.setAttribute('position', new THREE.BufferAttribute(drips, 3)); this.drips = new THREE.Points(dripGeo, new THREE.PointsMaterial({ color: '#c7eeef', size: .16 })); this.root.add(this.drips);
    for (const particles of [this.rain, this.drips]) (particles.material as THREE.PointsMaterial).onBeforeCompile = (shader) => { shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\nif (length((gl_PointCoord - .5) * vec2(1.8, .8)) > .45) discard;'); };
  }
  private waterEye(cell: Point[]): THREE.BufferGeometry {
    const center = cell.reduce(([x, z], p) => [x + p[0] / cell.length, z + p[1] / cell.length] as Point, [0, 0] as Point), vertices = [center[0], 0, center[1]], colors = [.37, .65, .65], indices: number[] = [];
    cell.forEach(([x, z], i) => { vertices.push(x, 0, z); colors.push(.78, .87, .68); indices.push(0, (i + 1) % cell.length + 1, i + 1); });
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
  }
  private wetlandPlanting(): void {
    const bladeParts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 9; i++) { const blade = new THREE.PlaneGeometry(.075, .6 + i % 3 * .18, 1, 3), p = blade.getAttribute('position');
      for (let j = 0; j < p.count; j++) { const y = p.getY(j) + .4; p.setXYZ(j, p.getX(j) + y * y * .4, y, 0); } blade.rotateY(i * 2.399); bladeParts.push(blade); }
    const geometry = mergeGeometries(bladeParts)!; bladeParts.forEach(g => g.dispose());
    const sites: THREE.Vector3[] = [];
    for (let i = 0; i < (this.mobile ? 420 : 900); i++) { const a = i * 2.399, r = 46.5 + i * .713 % 7, x = i % 3 ? Math.cos(a) * r : 54 + i * 7.717 % 48, z = i % 3 ? Math.sin(a) * r : -30 + i * 9.339 % 61;
      if (rainPlantAllowed(x, z, .55)) sites.push(new THREE.Vector3(x, gardenHeight(x, z), z)); }
    const reeds = new THREE.InstancedMesh(geometry, new THREE.MeshStandardMaterial({ color: '#466347', roughness: .9, side: THREE.DoubleSide }), sites.length), matrix = new THREE.Matrix4(), rotation = new THREE.Quaternion();
    sites.forEach((p, i) => { const scale = .4 + i * .618 % .5; matrix.compose(p, rotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), i), new THREE.Vector3(scale, scale, scale)); reeds.setMatrixAt(i, matrix); }); reeds.computeBoundingSphere(); this.root.add(reeds);
    const leaves = new THREE.InstancedMesh(new THREE.CircleGeometry(.6, this.mobile ? 8 : 14, .1, Math.PI * 1.88).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#6a8c55', roughness: .65, side: THREE.DoubleSide }), WATER_EYES.length * 2);
    WATER_EYES.forEach((cell, i) => { const x = cell.reduce((sum, p) => sum + p[0], 0) / cell.length, z = cell.reduce((sum, p) => sum + p[1], 0) / cell.length;
      for (let j = 0; j < 2; j++) { matrix.compose(new THREE.Vector3(x + j * .8, -.045 + i % 3 * .012, z + j * .6), rotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), i + j), new THREE.Vector3(1, 1, 1)); leaves.setMatrixAt(i * 2 + j, matrix); } }); leaves.computeBoundingSphere(); this.root.add(leaves);
  }
  private mesh(geometry: THREE.BufferGeometry, material: THREE.Material, solid = false, x = 0, y = 0, z = 0): THREE.Mesh {
    if (material === this.water && !geometry.hasAttribute('color')) geometry.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(geometry.getAttribute('position').count * 3).fill(1), 3));
    const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; this.root.add(mesh);
    if (solid) { mesh.updateWorldMatrix(true, false); const world = geometry.clone().applyMatrix4(mesh.matrixWorld); this.colliders.push({ type: 'mesh', vertices: new Float32Array(world.getAttribute('position').array), indices: world.index ? new Uint32Array(world.index.array) : Uint32Array.from({ length: world.getAttribute('position').count }, (_, i) => i) }); world.dispose(); }
    return mesh;
  }
  private path(curve: THREE.Curve<THREE.Vector3>, width: number): void {
    const vertices: number[] = [], indices: number[] = [], steps = 100;
    for (let i = 0; i <= steps; i++) { const p = curve.getPoint(i / steps), tangent = curve.getTangent(i / steps), side = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize().multiplyScalar(width / 2);
      for (const sign of [-1, 1]) vertices.push(p.x + side.x * sign, p.y, p.z + side.z * sign);
      if (i < steps) { const n = i * 2; indices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2); }
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geometry.setIndex(indices); geometry.computeVertexNormals(); this.mesh(geometry, this.stone, true);
  }
  private pavilion(): void {
    const x = GARDENS.pavilionX, z = GARDENS.pavilionZ;
    this.mesh(new THREE.CylinderGeometry(6, 6.15, .18, 10), this.stone, true, x, .09, z);
    const blue = new THREE.MeshStandardMaterial({ color: '#8bc6d0', roughness: this.mobile ? .26 : .16, metalness: .35, transparent: !this.mobile, opacity: this.mobile ? 1 : .47, side: THREE.DoubleSide });
    const points = [new THREE.Vector2(5.7, .18), new THREE.Vector2(6, 3.8), new THREE.Vector2(4.6, 6.8), new THREE.Vector2(1.2, 9.7), new THREE.Vector2(0, 10.1)];
    for (let i = 0; i < 10; i++) {
      const angle = i * Math.PI / 5;
      const doorway = i === 4 || i === 5 || i === 1 || i === 2;
      const profile = doorway ? [new THREE.Vector2(5.95, 3.2), ...points.slice(1)] : points;
      this.mesh(new THREE.LatheGeometry(profile, 1, angle, Math.PI / 5), blue, true, x, 0, z);
    }
    const embrace = Array.from({ length: 40 }, (_, i) => { const a = -.5 + i / 39 * Math.PI * 1.65; return new THREE.Vector3(x + Math.sin(a) * 6.3, 2.8 + i / 39 * 3.7, z + Math.cos(a) * 6.3); });
    this.mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(embrace), this.mobile ? 60 : 120, .27, 8, false), this.silver, true);
  }
  private platform(): void {
    this.mesh(new THREE.BoxGeometry(64, .18, 10), this.stone, true, -2, .09, -70.5);
    for (const x of [-14, 10]) {
      const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute([x - 1.16, .18, -75.5, x + 1.16, .18, -75.5, x - 1.16, .7, -77.75, x + 1.16, .7, -77.75], 3)); geometry.setIndex([0, 2, 1, 1, 2, 3]); geometry.computeVertexNormals(); this.mesh(geometry, this.stone, true);
    }
    for (const [left, right] of [[-34, -15.4], [-12.6, 8.6], [11.4, 30]]) this.mesh(new THREE.BoxGeometry(right - left, .85, .11), this.silver, true, (left + right) / 2, .6, -75.6);
    for (const x of [-25, -20, 20, 25]) this.mesh(new THREE.CylinderGeometry(.1, .12, 3.4, 8), this.silver, true, x, 1.7, -68);
    this.mesh(new THREE.BoxGeometry(56, .15, 5), this.stone, true, 0, 3.45, -68);
  }
  private umbrellas(): void {
    const vertices: number[] = [], indices: number[] = [], segments = this.mobile ? 40 : 80, rings = 8;
    for (let row = 0; row <= rings; row++) for (let col = 0; col <= segments; col++) { const a = col / segments * Math.PI * 2, t = row / rings, r = .13 + t * 1.25, y = Math.sin(t * Math.PI) * .4 - t * .17 + Math.sin(a * 10) * t * .11;
      vertices.push(Math.cos(a) * r, y, Math.sin(a) * r); if (row < rings && col < segments) { const n = row * (segments + 1) + col; indices.push(n, n + 1, n + segments + 1, n + 1, n + segments + 2, n + segments + 1); }
    }
    const crown = new THREE.BufferGeometry(); crown.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); crown.setIndex(indices); crown.computeVertexNormals();
    const sites: { x: number; z: number; scale: number; height: number }[] = [];
    for (let i = 0; i < 700 && sites.length < (this.mobile ? 44 : 90); i++) { const x = 55 + (i * 19.718 % 45), z = -30 + (i * 13.337 % 58), scale = .65 + (i * .618 % .7), height = 1.45 + (i * .31 % 1.4);
      if (!rainPlantAllowed(x, z, scale * 1.45) || sites.some((p) => Math.hypot(x - p.x, z - p.z) < (p.scale + scale) * 1.4)) continue; sites.push({ x, z, scale, height });
    }
    const skin = new THREE.MeshStandardMaterial({ color: '#71998a', roughness: .53, metalness: .28, side: THREE.DoubleSide });
    const crowns = new THREE.InstancedMesh(crown, skin, sites.length), stems = new THREE.InstancedMesh(new THREE.CylinderGeometry(.07, .12, 1, 6), this.silver, sites.length), matrix = new THREE.Matrix4(), rotation = new THREE.Quaternion();
    const ribs: THREE.BufferGeometry[] = [];
    sites.forEach((site, i) => {
      matrix.compose(new THREE.Vector3(site.x, site.height, site.z), rotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), i), new THREE.Vector3(site.scale, site.scale, site.scale)); crowns.setMatrixAt(i, matrix);
      matrix.compose(new THREE.Vector3(site.x, site.height / 2, site.z), new THREE.Quaternion(), new THREE.Vector3(1, site.height, 1)); stems.setMatrixAt(i, matrix);
      this.colliders.push({ type: 'box', position: [GARDENS.x + site.x, site.height / 2, site.z], size: [.12, site.height / 2, .12] });
      this.colliders.push({ type: 'box', position: [GARDENS.x + site.x, site.height + .08, site.z], size: [site.scale * 1.38, .3 * site.scale, site.scale * 1.38] });
      // Radial silver ribs articulate the folded crown and carry visible water toward its rim.
      for (let rib = 0; rib < (this.mobile ? 5 : 10); rib++) { const a = rib * Math.PI * 2 / (this.mobile ? 5 : 10) + i, points = Array.from({ length: 7 }, (_, j) => { const t = j / 6, r = (.13 + t * 1.25) * site.scale; return new THREE.Vector3(site.x + Math.cos(a) * r, site.height + (Math.sin(t * Math.PI) * .4 - t * .17) * site.scale + .025, site.z + Math.sin(a) * r); });
        ribs.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 9, .018, 3, false));
        if (rib === 0 && i % 3 === 0) { const drop = points.slice(3), edge = drop[drop.length - 1]; drop.push(new THREE.Vector3(edge.x, .12, edge.z)); this.drainage.push(new THREE.CatmullRomCurve3(drop)); }
      }
    });
    if (ribs.length) { this.mesh(mergeGeometries(ribs)!, this.silver); ribs.forEach((geometry) => geometry.dispose()); }
    crowns.castShadow = true; crowns.receiveShadow = true; crowns.computeBoundingSphere(); stems.computeBoundingSphere(); this.root.add(crowns, stems);
  }
  addInterpretation(id: string, title: string, body: string, x: number, z: number): void {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 640; const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#f0ecdf'; ctx.fillRect(0, 0, 1024, 640); ctx.fillStyle = '#2a5044'; ctx.font = '56px Georgia'; ctx.fillText(title, 45, 90); ctx.font = '31px sans-serif';
    let y = 170, line = ''; for (const word of body.split(' ')) { if (ctx.measureText(line + word).width > 910) { ctx.fillText(line, 45, y); y += 45; line = ''; } line += word + ' '; } ctx.fillText(line, 45, y); ctx.font = '28px sans-serif'; ctx.fillText('E / tap to read the story and sources', 45, 585);
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
    for (const dx of [-1, 1]) this.mesh(new THREE.CylinderGeometry(.045, .065, 1.35, 6), this.silver, true, x + dx, .675, z);
    const panel = this.mesh(new THREE.BoxGeometry(2.6, 1.65, .1), new THREE.MeshBasicMaterial({ map }), true, x, 1.8, z); panel.userData.discovery = id; this.panels.push(panel); this.interactives.push({ id, object: panel, position: new THREE.Vector3(x + GARDENS.x, 1.8, z) });
  }
  async loadAssets(): Promise<void> {
    (this.terrain.material as THREE.Material).dispose(); const meadow = meadowMaterial(); meadow.map!.repeat.set(155, 140); this.terrain.material = meadow;
    await this.forest.load(this.mobile);
  }
  update(time: number, dt: number, reducedMotion: boolean): void {
    if (reducedMotion) return; this.waterTime.value = time;
    const p = this.rain.geometry.getAttribute('position'); for (let i = 0; i < p.count; i++) p.setY(i, (p.getY(i) - dt * 3.8 + 9) % 9); p.needsUpdate = true;
    const drops = this.drips.geometry.getAttribute('position');
    for (let i = 0; i < drops.count; i++) { const route = this.drainage[i % this.drainage.length], point = route.getPoint((time * .16 + Math.floor(i / this.drainage.length) / 6) % 1); drops.setXYZ(i, point.x, point.y + .1, point.z); } drops.needsUpdate = true;
  }
  dispose(): void {
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
    this.root.traverse((object) => { if (object instanceof THREE.Mesh || object instanceof THREE.Points) { geometries.add(object.geometry); for (const material of Array.isArray(object.material) ? object.material : [object.material]) { materials.add(material); for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value); } } });
    geometries.forEach((g) => g.dispose()); materials.forEach((m) => m.dispose()); textures.forEach((t) => t.dispose());
  }
}
