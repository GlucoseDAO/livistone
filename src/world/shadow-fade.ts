import * as THREE from 'three';

/** View-distance band (start, end) in metres over which sun shadows fade out; an end of 0 keeps them at every distance. */
export const shadowFade = { x: 0, y: 0 };

const DIRECTIONAL = /\? (getShadow\( directionalShadowMap\[ i \],[^;]*?vDirectionalShadowCoord\[ i \] \)) : 1\.0;/;

/**
 * Fade sun shadows with view distance. The walking shadow box covers only the near town, so re-centring it would pop distant shadows in
 * and out; fading them out well inside the box hides both its edge and every re-bake. Lit materials share `shadowFade` itself, because
 * UniformsUtils.clone copies a plain (non-three) object by reference. Call before any material compiles; returns false if three's
 * shader chunk no longer matches, which leaves shadows unfaded rather than broken.
 */
export function installShadowFade(): boolean {
  if (THREE.ShaderLib.standard.uniforms.shadowFade) return true;
  if (!DIRECTIONAL.test(THREE.ShaderChunk.lights_fragment_begin)) return false;
  THREE.ShaderChunk.lights_fragment_begin = THREE.ShaderChunk.lights_fragment_begin.replace(DIRECTIONAL,
    '? mix( $1, 1.0, shadowFade.y > 0.0 ? smoothstep( shadowFade.x, shadowFade.y, length( geometryPosition ) ) : 0.0 ) : 1.0;');
  THREE.ShaderChunk.lights_pars_begin = 'uniform vec2 shadowFade;\n' + THREE.ShaderChunk.lights_pars_begin;
  for (const id of ['standard', 'physical', 'lambert', 'phong', 'toon']) THREE.ShaderLib[id].uniforms.shadowFade = { value: shadowFade };
  return true;
}
