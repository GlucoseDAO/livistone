// Thin transmissive shells (the Mitoring amber, the Nut of Power crystal) seen from inside, as the classic renderer showed them.
import * as THREE from 'three';
import { EnvironmentBRDF, F_Schlick, attenuationColor, attenuationDistance, cameraPosition, cameraProjectionMatrix, cameraViewMatrix, clearcoat, clearcoatNormalView, diffuseContribution, exp, float, frontFacing, ior, length, log, log2, materialEmissive, max, modelScale, normalWorld, positionViewDirection, positionWorld, refract, roughness, screenSize, specularColorBlended, specularF90, textureBicubicLevel, thickness, transmission, vec2, vec3, vec4, viewportOpaqueMipTexture } from 'three/tsl';
import { PhysicalLightingModel } from 'three/webgpu';
import type { Node, NodeBuilder } from 'three/webgpu';

type V3 = Node<'vec3'>;
/**
 * The classic renderer drew a double-sided transmissive surface's back faces into its transmission target first, so from
 * inside a shell with outward normals, where every fragment is a back face, the shell was seen through a second layer of
 * itself: twice the tint, absorption, refraction and blur, with that layer's own light behind it. WebGPU samples the opaque
 * scene once. This adds the second layer back, taking its light as this fragment's own: both are the same lit wall a short
 * refraction apart. Front faces, the view from outside, keep the single layer.
 */
class ShellLighting extends PhysicalLightingModel {
  finish(builder: NodeBuilder): void {
    super.finish(builder);
    if (!this.transmission) return;
    const { outgoingLight, backdrop } = builder.context as unknown as { outgoingLight: V3; backdrop: Node<'vec4'> };
    const v = cameraPosition.sub(positionWorld).normalize();
    const ray = refract(v.negate(), normalWorld.normalize(), float(1).div(ior)).normalize().mul(thickness.mul(modelScale));
    // One layer's weight on what lies behind it, as getIBLVolumeRefraction computes it: Fresnel, tint, Beer–Lambert absorption,
    // and the transmission and clearcoat shares of the final colour.
    const absorbed = attenuationDistance.notEqual(0).select(exp(log(attenuationColor).div(attenuationDistance).mul(length(ray))), vec3(1));
    const fresnel = EnvironmentBRDF({ dotNV: normalWorld.dot(v).clamp(), specularColor: specularColorBlended, specularF90, roughness }) as unknown as V3;
    const coat = this.clearcoat ? float(1).sub(clearcoat.mul((F_Schlick({ dotVH: clearcoatNormalView.dot(positionViewDirection).clamp(), f0: vec3(.04), f90: vec3(1) }) as unknown as V3).x)) : float(1);
    const share = transmission.mul(coat), through = vec3(1).sub(fresnel).mul(diffuseContribution).mul(absorbed).mul(share).toVar();
    // The scene behind both layers, refracted twice and blurred about √2 as far (half a mip level more).
    const exit = cameraProjectionMatrix.mul(cameraViewMatrix.mul(vec4(positionWorld.add(ray.mul(2)), 1)));
    const uv = exit.xy.div(exit.w).add(1).div(2), lod = log2(screenSize.x).mul(roughness.mul(ior.mul(2).sub(2).clamp())).add(.5);
    const behind = textureBicubicLevel(viewportOpaqueMipTexture(vec2(uv.x, uv.y.oneMinus())), lod).rgb;
    const own = outgoingLight.sub(backdrop.rgb.mul(share)).toVar();
    outgoingLight.assign(frontFacing.select(outgoingLight, own.mul(through.add(1)).add(materialEmissive.mul(through)).add(through.mul(through).mul(behind))));
  }
}
/** Three's physical material, with the classic second layer when transmissive and seen from inside (see ShellLighting). */
export class ShellMaterial extends THREE.MeshPhysicalNodeMaterial {
  /**
   * Optional highlight roll-off before fog and tone mapping: radiance whose brightest channel passes `knee` eases toward `knee +
   * span`, scaled as a whole so its hue holds. Khronos PBR Neutral turns a blown-out colour toward white instead, which left
   * the Mitoring's night hot spots peach-white; a uniform `knee` far above any radiance switches it off without a rebuild.
   */
  peak: { knee: Node<'float'>; span: number } | null = null;
  copy(source: ShellMaterial): this { super.copy(source); this.peak = source.peak; return this; }
  setupLightingModel(): PhysicalLightingModel { return new ShellLighting(this.useClearcoat, this.useSheen, this.useIridescence, this.useAnisotropy, this.useTransmission, this.useDispersion); }
  setupOutput(builder: NodeBuilder, outputNode: Node<'vec4'>): Node<'vec4'> {
    if (this.peak) {
      const { knee, span } = this.peak, top = max(outputNode.r, max(outputNode.g, outputNode.b)), eased = knee.add(float(span).mul(float(1).sub(exp(max(top.sub(knee), 0).div(-span)))));
      outputNode = vec4(outputNode.rgb.mul(top.greaterThan(knee).select(eased.div(top), float(1))), outputNode.a) as unknown as Node<'vec4'>;
    }
    return super.setupOutput(builder, outputNode) as Node<'vec4'>;
  }
}
