import * as THREE from 'three';

/** Environment-lit water; broad flow and fine capillary ripples share downstream motion. */
export function riverMaterial(): THREE.MeshStandardMaterial {
  const time = { value: 0 };
  const material = new THREE.MeshStandardMaterial({ color: '#46685c', roughness: .29, metalness: .18, envMapIntensity: 1.25, side: THREE.DoubleSide });
  material.userData.time = time;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.riverTime = time;
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vRiver;\nvarying vec2 vRiverUv;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvRiver = position; vRiverUv = uv;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
      uniform float riverTime; varying vec3 vRiver; varying vec2 vRiverUv;
      float ripple(vec2 p) {
        p += vec2(sin(p.y*.71+p.x*.28),cos(p.x*.57-p.y*.38))*.65;
        return sin(p.x*1.45+p.y*2.8)*.025 + sin(p.x*3.1-p.y*4.2)*.013 + sin(p.x*7.3+p.y*6.7)*.005;
      }`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      float bank = pow(abs(vRiverUv.y*2.0-1.0), 5.0);
      float flow = ripple(vRiver.xz-vec2(riverTime*.42,riverTime*.06));
      diffuseColor.rgb *= mix(vec3(.58,.77,.79),vec3(1.12,1.03,.80),bank);
      diffuseColor.rgb += flow * .12;
      float fringe = smoothstep(.92,1.0,abs(vRiverUv.y*2.0-1.0));
      diffuseColor.rgb = mix(diffuseColor.rgb,vec3(.38,.42,.31),fringe*.28);`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      vec2 p = vRiver.xz-vec2(riverTime*.42,riverTime*.06);
      float dx = (ripple(p+vec2(.04,0.0))-ripple(p-vec2(.04,0.0)))/.08;
      float dz = (ripple(p+vec2(0.0,.04))-ripple(p-vec2(0.0,.04)))/.08;
      normal = normalize(normal + mat3(viewMatrix)*vec3(-dx,0.0,-dz));`);
  };
  material.customProgramCacheKey = () => 'livistone-river-flow-v1'; return material;
}
