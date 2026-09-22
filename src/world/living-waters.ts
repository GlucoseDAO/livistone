import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { ColliderSpec } from '../game/physics';
import type { Interactive } from './world';
import { GARDENS, GARDEN_PANELS, GARDEN_PATHS, LAKE_OUTLINE, WATER_EYES, gardenHeight, rainPlantAllowed } from './living-waters-layout';
import type { Point } from './living-waters-layout';
import { MYCELIUM_RADIUS, myceliumCrown, myceliumStem, myceliumOpal } from './mycelium';
import { COLLECTION, photoSize, photoURL } from '../game/exhibits';
import { drawDewdropRing } from '../game/jewelry-art';

function shape(points: Point[]): THREE.Shape { return new THREE.Shape(points.map(([x, z]) => new THREE.Vector2(x, -z))); }
function random(seed: number): () => number { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }
export class LivingWaters {
  readonly root = new THREE.Group();
  readonly colliders: ColliderSpec[] = [];
  readonly interactives: Interactive[] = [];
  readonly panels: THREE.Mesh[] = [];
  private readonly water = new THREE.MeshStandardMaterial({ color: '#7bafaa', vertexColors: true, metalness: .34, roughness: .25, envMapIntensity: 1.2 });
  private readonly waterTime = { value: 0 };
  private readonly silver = new THREE.MeshStandardMaterial({ color: '#d9e0d6', metalness: .63, roughness: .32 });
  private readonly stone = new THREE.MeshStandardMaterial({ color: '#d4cfbc', roughness: .91 });
  private readonly rain: THREE.Points;
  private readonly drips: THREE.Points;
  private readonly drainage: THREE.Curve<THREE.Vector3>[] = [];
  constructor(private mobile: boolean) {
    this.root.name = 'Living Waters · town gardens'; this.root.position.set(GARDENS.x, 0, GARDENS.z);
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
    this.pavilion();
    this.mushrooms(); this.wetlandPlanting();
    for (const [name, [x, z]] of Object.entries(GARDEN_PANELS)) {
      const id = 'living-' + name, jewelry = name === 'vittoria' || name === 'dewdrop';
      for (const dx of [-1, 1]) this.mesh(new THREE.CylinderGeometry(.045, .065, jewelry ? 1.7 : 1.35, 6), this.silver, true, x + dx, jewelry ? .85 : .675, z);
      if (!jewelry) {
        const panel = this.mesh(new THREE.BoxGeometry(2.6, 1.65, .1), new THREE.MeshBasicMaterial({ color: '#f0ecdf' }), true, x, 1.8, z);
        panel.userData.discovery = id; this.panels.push(panel); this.interactives.push({ id, object: panel, position: new THREE.Vector3(x + GARDENS.x, 1.8, z + GARDENS.z) });
        continue;
      }
      this.mesh(new THREE.BoxGeometry(2.72, 2.9, .1), new THREE.MeshStandardMaterial({ color: '#3a4d44', roughness: .8 }), true, x, 1.82, z);
      const photo = new THREE.Mesh(new THREE.PlaneGeometry(2.52, 1.32), new THREE.MeshBasicMaterial({ color: '#c4cebd', toneMapped: false }));
      photo.position.set(x, 2.4, z + .06); photo.userData.discovery = id; photo.userData.kind = 'photo'; if (name === 'vittoria') photo.userData.piece = 'vittoria-amazonica';
      const caption = new THREE.Mesh(new THREE.PlaneGeometry(2.52, 1.32), new THREE.MeshBasicMaterial({ color: '#f0ecdf', toneMapped: false }));
      caption.position.set(x, 1.18, z + .06); caption.userData.discovery = id; caption.userData.kind = 'caption';
      this.root.add(photo, caption); this.panels.push(photo, caption); this.interactives.push({ id, object: caption, position: new THREE.Vector3(x + GARDENS.x, 1.8, z + GARDENS.z) });
    }
    const channel = new THREE.CatmullRomCurve3([[75, 0], [72, 10], [63, 17], [53, 14], [42, 8]].map(([x, z]) => new THREE.Vector3(x, .035, z)));
    this.drainage.push(channel);
    this.mesh(new THREE.TubeGeometry(channel, 70, .28, 6, false), this.silver, false);
    this.mesh(new THREE.TubeGeometry(channel, 70, .18, 5, false), this.water, false, 0, .08);
    this.mesh(new THREE.CylinderGeometry(3.6, 3.9, .14, 40), this.water, false, 75, .025, 0);
    this.mesh(new THREE.IcosahedronGeometry(1.1, 1), new THREE.MeshStandardMaterial({ color: '#bddacf', metalness: .45, roughness: .2 }), true, 75, .65, 0);
    const rain = new Float32Array((mobile ? 150 : 460) * 3), drips = new Float32Array(this.drainage.length * 6 * 3), fall = random(3304);
    for (let i = 0; i < rain.length; i += 3) { rain[i] = -48 + fall() * 152; rain[i + 1] = fall() * 9; rain[i + 2] = -40 + fall() * 76; }
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
    const sites: THREE.Vector3[] = [], rand = random(2201);
    for (let i = 0; i < (this.mobile ? 420 : 900); i++) {
      const lake = rand() < .7, a = rand() * Math.PI * 2, r = 44 + rand() * 10;
      const x = lake ? Math.cos(a) * r : 54 + rand() * 48, z = lake ? Math.sin(a) * r : -30 + rand() * 61;
      if (rainPlantAllowed(x, z, .55)) sites.push(new THREE.Vector3(x, gardenHeight(x, z), z));
    }
    const reeds = new THREE.InstancedMesh(geometry, new THREE.MeshStandardMaterial({ color: '#466347', roughness: .9, side: THREE.DoubleSide }), sites.length), matrix = new THREE.Matrix4(), rotation = new THREE.Quaternion();
    sites.forEach((p, i) => { const scale = .4 + rand() * .5; matrix.compose(p, rotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * Math.PI * 2), new THREE.Vector3(scale, scale, scale)); reeds.setMatrixAt(i, matrix); }); reeds.computeBoundingSphere(); this.root.add(reeds);
    const pads: { x: number; y: number; z: number; angle: number; scale: number }[] = [], jitter = random(4417);
    WATER_EYES.forEach((cell) => {
      const x = cell.reduce((sum, p) => sum + p[0], 0) / cell.length, z = cell.reduce((sum, p) => sum + p[1], 0) / cell.length;
      const count = 1 + (jitter() < .45 ? 1 : 0) + (jitter() < .2 ? 1 : 0);
      for (let j = 0; j < count; j++) pads.push({ x: x + (jitter() - .5) * 1.8, y: -.05 + jitter() * .024, z: z + (jitter() - .5) * 1.8, angle: jitter() * Math.PI * 2, scale: .75 + jitter() * .45 });
    });
    const leaves = new THREE.InstancedMesh(new THREE.CircleGeometry(.6, this.mobile ? 8 : 14, .1, Math.PI * 1.88).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#6a8c55', roughness: .65, side: THREE.DoubleSide }), pads.length);
    pads.forEach((pad, i) => { matrix.compose(new THREE.Vector3(pad.x, pad.y, pad.z), rotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), pad.angle), new THREE.Vector3(pad.scale, 1, pad.scale)); leaves.setMatrixAt(i, matrix); }); leaves.computeBoundingSphere(); this.root.add(leaves);
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
  private mushrooms(): void {
    const sites: { x: number; z: number; scale: number; height: number }[] = [], rand = random(8142);
    for (let i = 0; i < 900 && sites.length < (this.mobile ? 26 : 44); i++) {
      const x = 55 + rand() * 45, z = -30 + rand() * 58, scale = .8 + rand() * .55, height = 3.6 + rand() * 2.8;
      if (!rainPlantAllowed(x, z, scale * MYCELIUM_RADIUS) || sites.some(p => Math.hypot(x - p.x, z - p.z) < (p.scale + scale) * MYCELIUM_RADIUS + .4)) continue;
      sites.push({ x, z, scale, height });
    }
    const silver = new THREE.MeshStandardMaterial({ color: '#c7c3b7', roughness: .27, metalness: .9 });
    const opal = new THREE.MeshPhysicalMaterial({ color: '#ffffff', vertexColors: true, metalness: .15, roughness: .18, iridescence: this.mobile ? .35 : 1, iridescenceIOR: 1.38, iridescenceThicknessRange: [180, 420], clearcoat: .9 });
    opal.userData.myceliumOpal = true;
    const crowns = new THREE.InstancedMesh(myceliumCrown(this.mobile), silver, sites.length), stems = new THREE.InstancedMesh(myceliumStem(this.mobile), silver, sites.length);
    const stones = new THREE.InstancedMesh(myceliumOpal(this.mobile), opal, sites.length), matrix = new THREE.Matrix4(), rotation = new THREE.Quaternion();
    crowns.name = 'Mycelium · curled open silver gills'; stones.name = 'Mycelium · opal hearts'; stems.name = 'Mycelium · branching stems';
    sites.forEach((site, i) => {
      rotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * Math.PI * 2);
      matrix.compose(new THREE.Vector3(site.x, site.height, site.z), rotation, new THREE.Vector3(site.scale, site.scale, site.scale)); crowns.setMatrixAt(i, matrix);
      matrix.compose(new THREE.Vector3(site.x, 0, site.z), rotation, new THREE.Vector3(site.scale, site.height - .4 * site.scale, site.scale)); stems.setMatrixAt(i, matrix);
      matrix.compose(new THREE.Vector3(site.x, site.height + .5 * site.scale, site.z), rotation, new THREE.Vector3(site.scale, site.scale * .72, site.scale)); stones.setMatrixAt(i, matrix);
      this.colliders.push({ type: 'box', position: [GARDENS.x + site.x, site.height / 2, GARDENS.z + site.z], size: [.38 * site.scale, site.height / 2, .38 * site.scale] });
      this.colliders.push({ type: 'box', position: [GARDENS.x + site.x, site.height + .15 * site.scale, GARDENS.z + site.z], size: [site.scale * MYCELIUM_RADIUS, .75 * site.scale, site.scale * MYCELIUM_RADIUS] });
      if (i % 2 === 0) this.drainage.push(new THREE.CatmullRomCurve3([
        new THREE.Vector3(site.x + .6 * site.scale, site.height + .65 * site.scale, site.z), new THREE.Vector3(site.x + 2.15 * site.scale, site.height + .35 * site.scale, site.z),
        new THREE.Vector3(site.x + 2.4 * site.scale, site.height - .15 * site.scale, site.z), new THREE.Vector3(site.x + 2.4 * site.scale, .12, site.z),
      ]));
    });
    for (const object of [crowns, stems, stones]) { object.castShadow = object.receiveShadow = true; object.computeBoundingSphere(); this.root.add(object); }
    const shrubs: { x: number; z: number; scale: number; height: number }[] = [], bush = random(9021);
    for (let i = 0; i < 1400 && shrubs.length < (this.mobile ? 18 : 34); i++) {
      const x = 54 + bush() * 48, z = -31 + bush() * 60, scale = .28 + bush() * .2, height = .98 + bush() * .42;
      if (!rainPlantAllowed(x, z, scale * MYCELIUM_RADIUS) || [...sites, ...shrubs].some(p => Math.hypot(x - p.x, z - p.z) < (p.scale + scale) * MYCELIUM_RADIUS + .28)) continue;
      shrubs.push({ x, z, scale, height });
    }
    if (shrubs.length) {
      const lowCrowns = new THREE.InstancedMesh(myceliumCrown(this.mobile), silver, shrubs.length), lowStems = new THREE.InstancedMesh(myceliumStem(this.mobile), silver, shrubs.length);
      const lowStones = new THREE.InstancedMesh(myceliumOpal(this.mobile), opal, shrubs.length);
      lowCrowns.name = 'Mycelium · ring-scale shrubs'; lowStems.name = 'Mycelium · ring-scale stems'; lowStones.name = 'Mycelium · ring-scale opals';
      shrubs.forEach((site, i) => {
        rotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), bush() * Math.PI * 2);
        matrix.compose(new THREE.Vector3(site.x, site.height, site.z), rotation, new THREE.Vector3(site.scale, site.scale, site.scale)); lowCrowns.setMatrixAt(i, matrix);
        matrix.compose(new THREE.Vector3(site.x, 0, site.z), rotation, new THREE.Vector3(site.scale, site.height - .12 * site.scale, site.scale)); lowStems.setMatrixAt(i, matrix);
        matrix.compose(new THREE.Vector3(site.x, site.height + .12 * site.scale, site.z), rotation, new THREE.Vector3(site.scale, site.scale * .7, site.scale)); lowStones.setMatrixAt(i, matrix);
        this.colliders.push({ type: 'box', position: [GARDENS.x + site.x, site.height / 2, GARDENS.z + site.z], size: [.28 * site.scale, site.height / 2, .28 * site.scale] });
        this.colliders.push({ type: 'box', position: [GARDENS.x + site.x, site.height + .08 * site.scale, GARDENS.z + site.z], size: [site.scale * MYCELIUM_RADIUS, .42 * site.scale, site.scale * MYCELIUM_RADIUS] });
      });
      for (const object of [lowCrowns, lowStems, lowStones]) { object.castShadow = object.receiveShadow = true; object.computeBoundingSphere(); this.root.add(object); }
    }
  }
  addInterpretation(id: string, title: string, body: string): void {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 640; const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#f0ecdf'; ctx.fillRect(0, 0, 1024, 640); ctx.fillStyle = '#2a5044'; ctx.font = '56px Georgia'; ctx.fillText(title, 45, 90); ctx.font = '31px sans-serif';
    let y = 170, line = ''; for (const word of body.split(' ')) { if (ctx.measureText(line + word).width > 910) { ctx.fillText(line, 45, y); y += 45; line = ''; } line += word + ' '; } ctx.fillText(line, 45, y); ctx.font = '28px sans-serif'; ctx.fillText('E / tap to read the story and sources', 45, 585);
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
    const panel = this.panels.find(p => p.userData.discovery === id && p.userData.kind !== 'photo'); if (!panel) { map.dispose(); return; }
    const material = panel.material as THREE.MeshBasicMaterial; material.color.set('#ffffff'); material.map = map; material.needsUpdate = true;
  }
  presentLakeJewelry(): void {
    const wrap = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, width: number, line: number): number => {
      let current = '';
      for (const word of text.split(' ')) {
        if (current && ctx.measureText(current + ' ' + word).width > width) { ctx.fillText(current, x, y); y += line; current = word; }
        else current += (current ? ' ' : '') + word;
      }
      ctx.fillText(current, x, y); return y + line;
    };
    const caption = (id: string, title: string, body: string): void => {
      const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 540; const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#f4f0e5'; ctx.fillRect(0, 0, 1024, 540);
      ctx.fillStyle = '#25473b'; ctx.font = '48px Georgia'; ctx.fillText(title, 40, 70);
      ctx.fillStyle = '#445c4b'; ctx.font = '28px sans-serif'; wrap(ctx, body, 40, 130, 940, 38);
      ctx.fillStyle = '#25473b'; ctx.font = '26px sans-serif'; ctx.fillText('Click / E · story and livia.glucosedao.org/pieces', 40, 500);
      const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
      const panel = this.panels.find(p => p.userData.discovery === id && p.userData.kind === 'caption'); if (!panel) { map.dispose(); return; }
      const material = panel.material as THREE.MeshBasicMaterial; material.color.set('#ffffff'); material.map = map; material.needsUpdate = true;
    };
    caption('living-vittoria', 'Vittoria Amazonica', 'Silver and aquamarine, 2022. Survival, Romanian Jewelry Week 2023. The lake reads its lily-pad form. Dewdrop, a separate topaz ring, stands by the pavilion.');
    caption('living-dewdrop', 'Dewdrop Ring', 'Adjustable silver around treated Swiss blue topaz. A faceted droplet in an open embrace. Vittoria Amazonica, the aquamarine pendant, has its own stand on the lake.');
    const dewdrop = this.panels.find(p => p.userData.discovery === 'living-dewdrop' && p.userData.kind === 'photo');
    if (dewdrop) {
      const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 540; const ctx = canvas.getContext('2d')!;
      drawDewdropRing(ctx, 0, 0, 1024, 540);
      ctx.fillStyle = '#e8f2ef'; ctx.textAlign = 'center'; ctx.font = '36px Georgia'; ctx.fillText('Dewdrop · Swiss blue topaz', 512, 500);
      const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
      const material = dewdrop.material as THREE.MeshBasicMaterial; material.color.set('#ffffff'); material.map = map; material.needsUpdate = true;
    }
    const vittoria = COLLECTION.find(p => p.discovery === 'vittoria-amazonica'), photo = this.panels.find(p => p.userData.discovery === 'living-vittoria' && p.userData.kind === 'photo');
    if (vittoria && photo) {
      new THREE.TextureLoader().load(photoURL(vittoria.photos[0].thumb ?? vittoria.photos[0].file), (map) => {
        map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4;
        const image = map.image as HTMLImageElement, size = photoSize(image.naturalWidth, image.naturalHeight, 2.52, 1.32);
        photo.geometry.dispose(); photo.geometry = new THREE.PlaneGeometry(size.width, size.height);
        const material = photo.material as THREE.MeshBasicMaterial; material.color.set('#ffffff'); material.map = map; material.needsUpdate = true;
      });
    }
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
