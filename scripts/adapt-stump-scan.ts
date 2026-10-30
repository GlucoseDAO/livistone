/** Adapt CC0 timber and rigidly lift the digital cap; preserve every cap/map buffer byte. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

interface View { buffer: number; byteOffset?: number; byteLength: number; target?: number }
interface Accessor { bufferView: number; byteOffset?: number; componentType: number; count: number; type: string; min?: number[]; max?: number[] }
interface Primitive { attributes: Record<string, number>; indices?: number; material?: number; mode?: number }
interface Mesh { name?: string; primitives: Primitive[] }
interface Material { name?: string; doubleSided?: boolean; normalTexture?: { index: number }; occlusionTexture?: { index: number; strength: number }; pbrMetallicRoughness?: { metallicFactor?: number; roughnessFactor?: number; baseColorFactor?: number[]; baseColorTexture?: { index: number }; metallicRoughnessTexture?: { index: number } } }
interface Gltf { asset: object; buffers: { byteLength: number; uri?: string }[]; bufferViews: View[]; accessors: Accessor[]; meshes: Mesh[]; nodes: { name?: string; mesh?: number; [key: string]: unknown }[]; materials: Material[]; textures: { sampler?: number; source: number }[]; images: { uri?: string; bufferView?: number; mimeType?: string; name?: string }[]; samplers: object[]; [key: string]: unknown }
export interface Glb { json: Gltf; bin: Buffer }
const hash = (bytes: Uint8Array | string): string => createHash('sha256').update(bytes).digest('hex');
export function readGlb(path: string): Glb {
  const bytes = readFileSync(path); if (bytes.readUInt32LE(0) !== 0x46546c67) throw new Error('Expected a binary glTF');
  const length = bytes.readUInt32LE(12), json = JSON.parse(bytes.subarray(20, 20 + length).toString()) as Gltf;
  const binStart = 20 + length; if (bytes.readUInt32LE(binStart + 4) !== 0x004e4942) throw new Error('Expected an embedded BIN chunk');
  return { json, bin: bytes.subarray(binStart + 8, binStart + 8 + bytes.readUInt32LE(binStart)) };
}
function viewBytes(model: Glb, index: number): Buffer { const view = model.json.bufferViews[index], offset = view.byteOffset ?? 0; return model.bin.subarray(offset, offset + view.byteLength); }
export function capIntegrity(model: Glb): { geometry: string; texture: string } {
  const mesh = model.json.meshes.find(mesh => mesh.name === 'Giant_Solid_DNA_Cap'); if (!mesh) throw new Error('Missing DNA cap');
  const data: Buffer[] = [Buffer.from(JSON.stringify(mesh))];
  for (const primitive of mesh.primitives) for (const index of [...Object.values(primitive.attributes), ...(primitive.indices === undefined ? [] : [primitive.indices])]) data.push(viewBytes(model, model.json.accessors[index].bufferView));
  const material = model.json.materials[mesh.primitives[0].material!], texture = material.pbrMetallicRoughness?.baseColorTexture;
  if (!texture) throw new Error('Missing original DNA image');
  const image = model.json.images[model.json.textures[texture.index].source];
  return { geometry: hash(Buffer.concat(data)), texture: hash(viewBytes(model, image.bufferView!)) };
}
function encode(model: Glb): Buffer {
  const rawJson = Buffer.from(JSON.stringify(model.json)), json = Buffer.concat([rawJson, Buffer.alloc((4 - rawJson.length % 4) % 4, 32)]);
  const bin = Buffer.concat([model.bin, Buffer.alloc((4 - model.bin.length % 4) % 4)]), bytes = Buffer.alloc(28 + json.length + bin.length);
  bytes.writeUInt32LE(0x46546c67, 0); bytes.writeUInt32LE(2, 4); bytes.writeUInt32LE(bytes.length, 8); bytes.writeUInt32LE(json.length, 12); bytes.writeUInt32LE(0x4e4f534a, 16); json.copy(bytes, 20);
  const start = 20 + json.length; bytes.writeUInt32LE(bin.length, start); bytes.writeUInt32LE(0x004e4942, start + 4); bin.copy(bytes, start + 8); return bytes;
}
interface Vertex { position: number[]; normal: number[]; uv: number[] }
function interpolate(a: Vertex, b: Vertex, t: number): Vertex {
  const mix = (x: number[], y: number[]): number[] => x.map((value, i) => value + (y[i] - value) * t);
  return { position: mix(a.position, b.position), normal: mix(a.normal, b.normal), uv: mix(a.uv, b.uv) };
}
function clip(polygon: Vertex[], distance: (vertex: Vertex) => number): Vertex[] {
  const result: Vertex[] = []; if (!polygon.length) return result;
  let previous = polygon[polygon.length - 1], prior = distance(previous);
  for (const current of polygon) { const next = distance(current); if ((prior >= 0) !== (next >= 0)) result.push(interpolate(previous, current, prior / (prior - next))); if (next >= 0) result.push(current); previous = current; prior = next; }
  return result;
}
function sourceArray(json: Gltf, bin: Buffer, accessorIndex: number): number[] {
  const accessor = json.accessors[accessorIndex], view = json.bufferViews[accessor.bufferView], count = ({ SCALAR: 1, VEC2: 2, VEC3: 3 } as Record<string, number>)[accessor.type], offset = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0), size = accessor.componentType === 5126 ? 4 : 2;
  if (accessor.componentType !== 5126 && accessor.componentType !== 5123) throw new Error('Unsupported scan component type');
  return Array.from({ length: accessor.count * count }, (_, i) => size === 4 ? bin.readFloatLE(offset + i * size) : bin.readUInt16LE(offset + i * size));
}

export function adaptStump(sourcePath: string, scanPath: string, outputPath: string): void {
  const original = readGlb(sourcePath), model: Glb = { json: structuredClone(original.json), bin: Buffer.from(original.bin) }, before = capIntegrity(original);
  const scan = JSON.parse(readFileSync(scanPath, 'utf8')) as Gltf, scanDir = dirname(scanPath), scanBin = readFileSync(resolve(scanDir, scan.buffers[0].uri!)), primitive = scan.meshes[0].primitives[0];
  const positions = sourceArray(scan, scanBin, primitive.attributes.POSITION), normals = sourceArray(scan, scanBin, primitive.attributes.NORMAL), uvs = sourceArray(scan, scanBin, primitive.attributes.TEXCOORD_0), indices = sourceArray(scan, scanBin, primitive.indices!);
  // The source includes a conical forest-floor apron. Keep its photographed bark and cavities, but give the seat a clear
  // standing trunk and a low buttress transition instead of magnifying the apron into the whole body.
  const centre = [-.06, .04], nativeBase = .025, nativeTop = .30, bottom = .25, top = 2.013, verticalScale = (top - bottom) / (nativeTop - nativeBase), rootRadii = [3.5, 3.5], capLift = 1.10;
  const smooth = (value: number, low: number, high: number): number => { const t = Math.max(0, Math.min(1, (value - low) / (high - low))); return t * t * (3 - 2 * t); };
  const trunkRadius = (radius: number, height: number): number => {
    const t = Math.max(0, Math.min(1, (height - nativeBase) / (nativeTop - nativeBase))), reference = .22 + .335 * (1 - t) ** 1.45;
    const target = 1.30 + .72 * Math.max(0, 1 - t / .38) ** 2 + .10 * Math.sin(Math.PI * t), exponent = 1 - .7 * smooth(t, .2, .7);
    const mapped = target * (radius / reference) ** exponent, limit = 1.49 + 1.26 * (1 - smooth(t, .35, .8)), shoulder = limit - .08;
    return mapped <= shoulder ? mapped : shoulder + .08 * (1 - Math.exp(-(mapped - shoulder) / .08));
  };
  const vertices: Vertex[] = [];
  for (let i = 0; i < positions.length / 3; i++) {
    const x = positions[i * 3] - centre[0], y = positions[i * 3 + 1], z = positions[i * 3 + 2] - centre[1], radius = Math.max(1e-6, Math.hypot(x, z)), ux = x / radius, uz = z / radius, mapped = trunkRadius(radius, y), scale = mapped / radius, epsilon = 1e-5;
    const dr = (trunkRadius(radius + epsilon, y) - trunkRadius(Math.max(1e-7, radius - epsilon), y)) / (2 * epsilon), dy = (trunkRadius(radius, y + epsilon) - trunkRadius(radius, y - epsilon)) / (2 * epsilon);
    // Inverse-transpose in the radial/tangential frame keeps the scan normals consistent with the reshaped trunk.
    const radial = normals[i * 3] * ux + normals[i * 3 + 2] * uz, nx = (normals[i * 3] - radial * ux) / scale + radial / Math.max(dr, .01) * ux, nz = (normals[i * 3 + 2] - radial * uz) / scale + radial / Math.max(dr, .01) * uz;
    const normal = [nx, (normals[i * 3 + 1] - dy * (nx * ux + nz * uz)) / verticalScale, nz], length = Math.hypot(...normal);
    vertices.push({ position: [ux * mapped, bottom + (y - nativeBase) * verticalScale, uz * mapped], normal: normal.map(value => value / length), uv: uvs.slice(i * 2, i * 2 + 2) });
  }
  const outPositions: number[] = [], outNormals: number[] = [], outUvs: number[] = [], outIndices: number[] = [], vertexMap = new Map<string, number>();
  const add = (vertex: Vertex): number => {
    const key = [...vertex.position, ...vertex.uv, ...vertex.normal].map(value => value.toFixed(7)).join(','); const found = vertexMap.get(key); if (found !== undefined) return found;
    const index = outPositions.length / 3, length = Math.hypot(...vertex.normal);
    outPositions.push(vertex.position[0] + 10.64391425710376, vertex.position[1], vertex.position[2] - 3.4787374527067465); outNormals.push(...vertex.normal.map(value => value / length)); outUvs.push(...vertex.uv); vertexMap.set(key, index); return index;
  };
  for (let i = 0; i < indices.length; i += 3) {
    let polygon = [vertices[indices[i]], vertices[indices[i + 1]], vertices[indices[i + 2]]];
    polygon = clip(polygon, vertex => vertex.position[1] - bottom); polygon = clip(polygon, vertex => top - vertex.position[1]);
    for (let side = 0; side < 64 && polygon.length; side++) { const angle = side * Math.PI * 2 / 64, x = Math.cos(angle) / rootRadii[0], z = Math.sin(angle) / rootRadii[1]; polygon = clip(polygon, vertex => 1 - vertex.position[0] * x - vertex.position[2] * z); }
    for (let j = 1; j < polygon.length - 1; j++) { const triangle = [polygon[0], polygon[j], polygon[j + 1]], ids = triangle.map(add); if (new Set(ids).size === 3) outIndices.push(...ids); }
  }
  const scanIndexCount = outIndices.length;
  // Close only boundaries introduced by the radial trimming planes, not natural scan openings.
  const geometricKey = (index: number): string => outPositions.slice(index * 3, index * 3 + 3).map(value => value.toFixed(5)).join(',');
  const edges = new Map<string, { a: number; b: number; count: number }>();
  for (let i = 0; i < outIndices.length; i += 3) for (let j = 0; j < 3; j++) {
    const a = outIndices[i + j], b = outIndices[i + (j + 1) % 3], key = [geometricKey(a), geometricKey(b)].sort().join('|'), prior = edges.get(key);
    if (prior) prior.count++; else edges.set(key, { a, b, count: 1 });
  }
  let closedRadialEdges = 0;
  const localVertex = (index: number, normal: number[]): Vertex => ({ position: [outPositions[index * 3] - 10.64391425710376, outPositions[index * 3 + 1], outPositions[index * 3 + 2] + 3.4787374527067465], normal, uv: outUvs.slice(index * 2, index * 2 + 2) });
  const panelTriangle = (triangle: Vertex[], normal: number[]): void => {
    const [a, b, c] = triangle.map(vertex => vertex.position), ab = b.map((v, i) => v - a[i]), ac = c.map((v, i) => v - a[i]), cross = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
    if (Math.hypot(...cross) < 1e-10) return;
    if (cross.reduce((sum, value, i) => sum + value * normal[i], 0) < 0) triangle.reverse();
    outIndices.push(...triangle.map(add));
  };
  for (const edge of edges.values()) {
    if (edge.count !== 1) continue;
    for (let side = 0; side < 64; side++) {
      const angle = side * Math.PI * 2 / 64, plane = [Math.cos(angle) / rootRadii[0], 0, Math.sin(angle) / rootRadii[1]], magnitude = Math.hypot(...plane), normal = plane.map(value => value / magnitude), a = localVertex(edge.a, normal), b = localVertex(edge.b, normal);
      if (Math.max(a.position[1], b.position[1]) <= bottom + 1e-6 || [a, b].some(vertex => Math.abs(1 - vertex.position[0] * plane[0] - vertex.position[2] * plane[2]) > 1e-5)) continue;
      const floor = (vertex: Vertex): Vertex => ({ position: [vertex.position[0], bottom, vertex.position[2]], normal, uv: vertex.uv });
      const af = floor(a), bf = floor(b); panelTriangle([a, b, bf], normal); panelTriangle([a, bf, af], normal); closedRadialEdges++; break;
    }
  }
  if (outIndices.length < 15000 || !outPositions.every(Number.isFinite)) throw new Error('Scan adaptation unexpectedly empty or invalid');
  const append = (bytes: Buffer, target?: number): number => {
    const padding = Buffer.alloc((4 - model.bin.length % 4) % 4), offset = model.bin.length + padding.length; model.bin = Buffer.concat([model.bin, padding, bytes]);
    const index = model.json.bufferViews.length; model.json.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length, ...(target ? { target } : {}) }); return index;
  };
  const attribute = (values: number[], type: string, componentType: number): number => {
    const components = type === 'VEC3' ? 3 : type === 'VEC2' ? 2 : 1, bytes = componentType === 5126 ? Buffer.from(new Float32Array(values).buffer) : Buffer.from(new Uint32Array(values).buffer), index = model.json.accessors.length;
    const accessor: Accessor = { bufferView: append(bytes, type === 'SCALAR' ? 34963 : 34962), componentType, count: values.length / components, type };
    if (type === 'VEC3') { accessor.min = Array.from({ length: 3 }, (_, axis) => Math.min(...values.filter((_, i) => i % 3 === axis))); accessor.max = Array.from({ length: 3 }, (_, axis) => Math.max(...values.filter((_, i) => i % 3 === axis))); }
    model.json.accessors.push(accessor); return index;
  };
  const attributes = { POSITION: attribute(outPositions, 'VEC3', 5126), NORMAL: attribute(outNormals, 'VEC3', 5126), TEXCOORD_0: attribute(outUvs, 'VEC2', 5126) }, indexAccessor = attribute(outIndices.slice(0, scanIndexCount), 'SCALAR', 5125), closureIndices = outIndices.length > scanIndexCount ? attribute(outIndices.slice(scanIndexCount), 'SCALAR', 5125) : undefined;
  const twigPositions: number[] = [], twigNormals: number[] = [], twigIndices: number[] = [];
  const twig = (points: number[][], baseRadius: number, tipRadius: number): void => {
    const start = twigPositions.length / 3, rings = 13, sides = 8;
    const point = (t: number): number[] => { const u = 1 - t; return [0, 1, 2].map(axis => u ** 3 * points[0][axis] + 3 * u * u * t * points[1][axis] + 3 * u * t * t * points[2][axis] + t ** 3 * points[3][axis]); };
    for (let ring = 0; ring < rings; ring++) {
      const t = ring / (rings - 1), p = point(t), before = point(Math.max(0, t - .001)), after = point(Math.min(1, t + .001)), d = after.map((value, axis) => value - before[axis]), horizontal = Math.hypot(d[0], d[2]), total = Math.hypot(...d), side = [-d[2] / horizontal, 0, d[0] / horizontal], up = [-d[0] * d[1] / (horizontal * total), horizontal / total, -d[2] * d[1] / (horizontal * total)], radius = baseRadius * (1 - t) ** 1.15 + tipRadius * t;
      p[1] = Math.max(p[1] - .012, bottom + radius * .55 * up[1]);
      for (let edge = 0; edge < sides; edge++) {
        const angle = edge / sides * Math.PI * 2, c = Math.cos(angle), s = Math.sin(angle), normal = side.map((value, axis) => value * c + up[axis] * s / .55), length = Math.hypot(...normal);
        twigPositions.push(p[0] + side[0] * radius * c + up[0] * radius * .55 * s + 10.64391425710376, p[1] + up[1] * radius * .55 * s, p[2] + side[2] * radius * c + up[2] * radius * .55 * s - 3.4787374527067465); twigNormals.push(...normal.map(value => value / length));
        if (ring < rings - 1) { const a = start + ring * sides + edge, b = start + ring * sides + (edge + 1) % sides, c = a + sides, d = b + sides; twigIndices.push(a, c, b, b, c, d); }
      }
    }
    for (let edge = 1; edge < sides - 1; edge++) { twigIndices.push(start, start + edge, start + edge + 1); const end = start + (rings - 1) * sides; twigIndices.push(end, end + edge + 1, end + edge); }
  };
  // Four fine roots meet the native floor drawing's root tips; the other branches remain unequal and asymmetric.
  const floorEnds = [[-123, 123], [-159, 43], [-174, -47], [-120, -118]], rootAngles = [.12, .54, 1.04, 1.63, ...floorEnds.map(([x, z]) => (Math.atan2(z, x) + Math.PI * 2) % (Math.PI * 2)), 4.5, 4.95, 5.42, 5.98];
  rootAngles.forEach((angle, i) => {
    const floorEnd = floorEnds[i - 4], reach = floorEnd ? Math.min(3.48, Math.hypot(...floorEnd) * (.5 / 156) / .165) : 2.92 + .44 * (.5 + .5 * Math.sin(i * 2.73 + .8)), turn = .10 * Math.sin(i * 1.9), polar = (radius: number, y: number, twist: number): number[] => [Math.cos(angle + twist) * radius, y, Math.sin(angle + twist) * radius];
    const start = polar(1.22 + .15 * Math.sin(i), .78 + .12 * Math.sin(i * 1.7), -.04), fork = polar(2.12, .38, turn);
    twig([start, polar(1.72, .56, 0), polar(2.62, .30, turn), polar(reach, .27, floorEnd ? 0 : turn + .10 * Math.sin(i))], .145 + .025 * Math.sin(i * 2.1), .018);
    if (i % 3 !== 1) twig([fork, polar(2.40, .34, turn + .08), polar(2.76, .28, turn + .21), polar(Math.min(3.40, reach + .06), .264, turn + .29)], .070, .010);
  });
  const twigAttributes = { POSITION: attribute(twigPositions, 'VEC3', 5126), NORMAL: attribute(twigNormals, 'VEC3', 5126) }, twigIndex = attribute(twigIndices, 'SCALAR', 5125);
  model.json.samplers ??= [];
  const sampler = model.json.samplers.length; model.json.samplers.push({ magFilter: 9729, minFilter: 9987 });
  const textureMap: number[] = [], textureSources: object[] = []; mkdirSync(dirname(outputPath), { recursive: true });
  for (const image of scan.images) {
    const input = resolve(scanDir, image.uri!), converted = resolve(dirname(outputPath), image.name! + '-2k.jpg');
    execFileSync('magick', [input, '-resize', '2048x2048>', '-sampling-factor', '4:4:4', '-quality', '94', converted]);
    const imageIndex = model.json.images.length; model.json.images.push({ name: image.name, mimeType: 'image/jpeg', bufferView: append(readFileSync(converted)) });
    textureMap.push(model.json.textures.length); model.json.textures.push({ source: imageIndex, sampler });
    textureSources.push({ original: input, source_sha256: hash(readFileSync(input)), resized_sha256: hash(readFileSync(converted)), pixels: 2048, jpeg_quality: 94, original_uvs_preserved: true });
  }
  const material = structuredClone(scan.materials[0]); material.name = 'Rob Tuytel · organic stump scan · CC0'; material.normalTexture!.index = textureMap[scan.textures[scan.materials[0].normalTexture!.index].source];
  const pbr = material.pbrMetallicRoughness!; pbr.baseColorTexture!.index = textureMap[scan.textures[pbr.baseColorTexture!.index].source]; pbr.metallicRoughnessTexture!.index = textureMap[scan.textures[pbr.metallicRoughnessTexture!.index].source];
  const materialIndex = model.json.materials.length; model.json.materials.push(material);
  const closureMaterialIndex = model.json.materials.length;
  model.json.materials.push({ name: 'Generated trim ends · matte dark brown · no photographed grain', doubleSided: true, pbrMetallicRoughness: { baseColorFactor: [.09, .05, .026, 1], metallicFactor: 0, roughnessFactor: 1 } });
  const twigMaterialIndex = model.json.materials.length;
  model.json.materials.push({ name: 'Generated fine branching roots · warm weathered wood · digital addition', pbrMetallicRoughness: { baseColorFactor: [.28, .19, .11, 1], metallicFactor: 0, roughnessFactor: 1 } });
  const woodIndex = model.json.meshes.findIndex(mesh => mesh.name === 'Giant_Wood_Stump'); if (woodIndex < 0) throw new Error('Missing original wood mesh');
  model.json.meshes[woodIndex] = { name: 'Giant_Wood_Stump', primitives: [{ attributes, indices: indexAccessor, material: materialIndex, mode: 4 }, ...closureIndices === undefined ? [] : [{ attributes: { POSITION: attributes.POSITION, NORMAL: attributes.NORMAL }, indices: closureIndices, material: closureMaterialIndex, mode: 4 }], { attributes: twigAttributes, indices: twigIndex, material: twigMaterialIndex, mode: 4 }] };
  const capNodeNames = ['Giant_Solid_Cap_Edge', 'Giant_Solid_DNA_Cap'], capTransforms: object[] = [];
  model.json.nodes.forEach((node, index) => {
    if (!capNodeNames.includes(node.name ?? '')) return;
    if (node.matrix) throw new Error('Expected the reviewed cap nodes to use translation rather than a matrix');
    const translation = node.translation as number[] | undefined, before = translation ?? [0, 0, 0];
    node.translation = [before[0], before[1] + capLift, before[2]];
    capTransforms.push({ node_index: index, name: node.name, original_translation: translation ?? null, output_translation: node.translation });
  });
  if (capTransforms.length !== 2) throw new Error('Expected both parts of the solid cap');
  model.json.buffers[0].byteLength = model.bin.length;
  if (!model.bin.subarray(0, original.bin.length).equals(original.bin)) throw new Error('Original embedded data changed');
  for (const key of ['scenes', 'scene'] as const) if (JSON.stringify(model.json[key]) !== JSON.stringify(original.json[key])) throw new Error(`Original ${key} changed`);
  model.json.nodes.forEach((node, index) => {
    const expected = structuredClone(original.json.nodes[index]);
    if (capNodeNames.includes(expected.name ?? '')) { const prior = expected.translation as number[] | undefined; expected.translation = [prior?.[0] ?? 0, (prior?.[1] ?? 0) + capLift, prior?.[2] ?? 0]; }
    if (JSON.stringify(node) !== JSON.stringify(expected)) throw new Error('A scene node changed beyond the permitted rigid cap lift');
  });
  for (let i = 0; i < original.json.meshes.length; i++) if (i !== woodIndex && JSON.stringify(original.json.meshes[i]) !== JSON.stringify(model.json.meshes[i])) throw new Error('A nonwood mesh changed');
  const after = capIntegrity(model); if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('DNA cap or its image changed');
  const bytes = encode(model); writeFileSync(outputPath, bytes);
  const provenance = { method: 'CC0 photographed trunk adaptation with generated fine branching roots; no AI-generated wood', author: 'Rob Tuytel', source: 'https://polyhaven.com/a/tree_stump_01', license: 'CC0 1.0', license_url: 'https://polyhaven.com/license', original_source_sha256: hash(readFileSync(sourcePath)), output_sha256: hash(bytes), original_binary_byte_length: original.bin.length, original_binary_sha256: hash(original.bin), protected_nonwood_mesh_definitions_sha256: hash(JSON.stringify(original.json.meshes.filter((_, i) => i !== woodIndex))), original_nodes_sha256: hash(JSON.stringify(original.json.nodes)), protected_noncap_nodes_sha256: hash(JSON.stringify(original.json.nodes.filter(node => !capNodeNames.includes(node.name ?? '')))), permitted_cap_node_transforms: capTransforms, scan_geometry_sha256: hash(scanBin), scan_json_sha256: hash(readFileSync(scanPath)), textures: textureSources, transformations: { source_centre_xz: centre, radial_remap: 'Height-dependent median-radius compensation; lower buttress transition and a soft crown limit below the unchanged cap', native_vertical_clip: [nativeBase, nativeTop], digital_vertical_range: [bottom, top], vertical_scale: verticalScale, artistic_vertical_adaptation: true, root_clip_semiaxes_m: rootRadii, base_radial_target_m: 2.02, crown_radial_target_m: 1.30, base_z_compression: 1, max_root_radius_m: Math.max(...[outPositions, twigPositions].flatMap(values => Array.from({ length: values.length / 3 }, (_, i) => Math.hypot(values[i * 3] - 10.64391425710376, values[i * 3 + 2] + 3.4787374527067465)))), root_clip: 'Smooth radial profile with original photographed knots and grain; 64-plane outer guard; no repeated radial grooves or hard perimeter skirt', radial_boundary_edges_closed: closedRadialEdges, radial_closure: 'Newly cut perimeter edges only are closed vertically to island y=.25 with planar cut-end panels; existing natural source cavities elsewhere remain. Generated closures use a separate untextured matte dark brown material, with no source grain or normal texture; preserved scan surfaces retain their original UVs/PBR.', digital_centre_xz: [10.64391425710376, -3.4787374527067465], cap_node_lift_m: capLift, cap_top_y_m: 2.04 }, output_vertices: (outPositions.length + twigPositions.length) / 3, output_triangles: (outIndices.length + twigIndices.length) / 3, original_binary_prefix_unchanged: true, nonwood_mesh_definitions_unchanged: true, scene_graph_changes: 'Only the two cap nodes are translated rigidly upward by 1.10 m; all other nodes, scenes, cap/map geometry buffers, UVs and DNA image are unchanged', cap_before: before, cap_after: after, generated_fine_roots: { method: 'Twenty unequal tapered branch tubes with asymmetric forks, gently flattened against the floor; digital additions inspired by the approved reference', photographed_scan_geometry: false, main_roots: rootAngles.length, fork_roots: rootAngles.filter((_, i) => i % 3 !== 1).length, vertices: twigPositions.length / 3, triangles: twigIndices.length / 3, material: 'Untextured warm weathered wood; no claim of photographed bark on the generated twigs' }, physical_specimen_claim: false, note: 'The raw asset retains its immutable 3.4 m DNA cap and all map/scientific resources. Runtime wrappers place the artwork at a 500 mm cap and 45 cm seat height. The CC0 scan supplies the reshaped trunk and photographed grain; fine branching roots are explicitly generated additions. This is not the actual Taiwanese material specimen. The separate physical proposal is unchanged.' };
  writeFileSync(outputPath.replace(/\.glb$/, '.organic.json'), JSON.stringify(provenance, null, 2) + '\n'); console.log(JSON.stringify({ outputPath, bytes: bytes.length, vertices: provenance.output_vertices, triangles: provenance.output_triangles, cap: after }, null, 2));
}
if (process.argv[1]?.endsWith('adapt-stump-scan.ts')) adaptStump(process.argv[2] ?? 'output/testing/stump-organic/before/source.glb', process.argv[3] ?? '../stump-of-life/output/references/tree_stump_01/4k/tree_stump_01_4k.gltf', process.argv[4] ?? 'output/testing/stump-organic/candidate.glb');
