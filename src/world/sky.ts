import * as THREE from 'three';

/** Bake daylight once: the background and the jewelry reflections see the same sky. */
export function createSky(renderer: THREE.WebGLRenderer, mobile: boolean): { background: THREE.CubeTexture; environment: THREE.Texture } {
  const scene = new THREE.Scene();
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { sun: { value: new THREE.Vector3(-35, 70, 35).normalize() } },
    vertexShader: 'varying vec3 direction; void main(){direction=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: `
      varying vec3 direction; uniform vec3 sun;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
      float fbm(vec2 p){float n=0.0,a=.5; for(int i=0;i<5;i++){n+=a*noise(p);p=mat2(.8,-.6,.6,.8)*p*2.03+17.2;a*=.5;}return n;}
      void main(){
        vec3 d=normalize(direction); float elevation=max(d.y,0.0);
        vec3 sky=mix(vec3(.65,.79,.84),vec3(.14,.39,.68),pow(elevation,.45));
        float light=max(dot(d,sun),0.0);
        sky+=vec3(1.0,.78,.46)*pow(light,18.0)*.14;
        sky+=vec3(5.0,4.4,3.2)*smoothstep(.99955,.99985,light);
        vec2 p=d.xz/(max(d.y,.015)+.16)*3.8+vec2(3.1,8.4);
        float density=fbm(p+fbm(p*.65)*1.8);
        float cloud=smoothstep(.48,.69,density)*smoothstep(.015,.16,d.y);
        vec3 clouds=mix(vec3(.57,.66,.73),vec3(1.25,1.24,1.17),smoothstep(.48,.76,density));
        sky=mix(sky,clouds,cloud*.96);
        sky=mix(vec3(.24,.31,.18),sky,smoothstep(-.18,.025,d.y));
        gl_FragColor=vec4(sky,1.0);
      }`,
  });
  const geometry = new THREE.SphereGeometry(10, 24, 16); scene.add(new THREE.Mesh(geometry, material));
  const target = new THREE.WebGLCubeRenderTarget(mobile ? 256 : 512, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
  new THREE.CubeCamera(.1, 20, target).update(renderer, scene);
  const pmrem = new THREE.PMREMGenerator(renderer), environment = pmrem.fromCubemap(target.texture).texture;
  pmrem.dispose(); geometry.dispose(); material.dispose();
  return { background: target.texture, environment };
}
