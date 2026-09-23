import * as THREE from 'three';

/** Bake the sky once: the background and the jewelry reflections see the same cubemap. */
export function createSky(renderer: THREE.WebGLRenderer, mobile: boolean, night = false): { background: THREE.CubeTexture; environment: THREE.Texture } {
  const scene = new THREE.Scene();
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: {
      sun: { value: new THREE.Vector3(-35, 70, 35).normalize() },
      moon: { value: new THREE.Vector3(25, 38, -70).normalize() },
      night: { value: night ? 1 : 0 },
    },
    vertexShader: 'varying vec3 direction; void main(){direction=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: `
      varying vec3 direction; uniform vec3 sun; uniform vec3 moon; uniform float night;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
      float fbm(vec2 p){float n=0.0,a=.5; for(int i=0;i<5;i++){n+=a*noise(p);p=mat2(.8,-.6,.6,.8)*p*2.03+17.2;a*=.5;}return n;}
      void main(){
        vec3 d=normalize(direction); float elevation=max(d.y,0.0);
        vec3 day=mix(vec3(.65,.79,.84),vec3(.14,.39,.68),pow(elevation,.45));
        float light=max(dot(d,sun),0.0);
        day+=vec3(1.0,.78,.46)*pow(light,18.0)*.14;
        day+=vec3(5.0,4.4,3.2)*smoothstep(.99955,.99985,light);
        vec2 p=d.xz/(max(d.y,.015)+.16)*3.8+vec2(3.1,8.4);
        float density=fbm(p+fbm(p*.65)*1.8);
        float cloud=smoothstep(.48,.69,density)*smoothstep(.015,.16,d.y);
        vec3 clouds=mix(vec3(.57,.66,.73),vec3(1.25,1.24,1.17),smoothstep(.48,.76,density));
        day=mix(day,clouds,cloud*.96);
        day=mix(vec3(.24,.31,.18),day,smoothstep(-.18,.025,d.y));
        vec3 dark=mix(vec3(.02,.04,.08),vec3(.05,.08,.16),pow(elevation,.55));
        vec2 skyUV=vec2(atan(d.z,d.x)/6.2831853+.5,acos(clamp(d.y,-1.,1.))/3.14159265);
        vec2 grid=skyUV*vec2(360.,180.), cell=floor(grid), offset=vec2(hash(cell+7.1),hash(cell+19.7))*.64+.18;
        float starSeed=hash(cell), star=exp(-dot(fract(grid)-offset,fract(grid)-offset)*140.)*step(.967,starSeed);
        dark+=mix(vec3(.65,.8,1.),vec3(1.,.9,.72),hash(cell+31.))*star*(1.5+hash(cell+13.)*2.)*smoothstep(.03,.2,d.y);
        float moonLight=max(dot(d,moon),0.0);
        dark+=vec3(.42,.5,.68)*pow(moonLight,22.0)*.2;
        vec3 moonRight=normalize(cross(moon,vec3(0.,1.,0.))), moonUp=normalize(cross(moonRight,moon));
        vec2 lunar=vec2(dot(d,moonRight),dot(d,moonUp))/.043;
        float disc=1.-smoothstep(.94,1.,length(lunar));
        float craters=.74+.16*fbm(lunar*8.)+.1*noise(lunar*27.);
        float phase=smoothstep(-.7,-.4,lunar.x+.2*sqrt(max(0.,1.-lunar.y*lunar.y)));
        dark=mix(dark,vec3(1.25,1.23,1.13)*craters*mix(.12,1.,phase),disc*step(0.,moonLight));
        dark=mix(vec3(.04,.06,.04),dark,smoothstep(-.12,.04,d.y));
        gl_FragColor=vec4(mix(day,dark,night),1.0);
      }`,
  });
  const geometry = new THREE.SphereGeometry(10, 24, 16); scene.add(new THREE.Mesh(geometry, material));
  const target = new THREE.WebGLCubeRenderTarget(night ? (mobile ? 512 : 1024) : (mobile ? 256 : 512), { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
  new THREE.CubeCamera(.1, 20, target).update(renderer, scene);
  const pmrem = new THREE.PMREMGenerator(renderer), environment = pmrem.fromCubemap(target.texture).texture;
  pmrem.dispose(); geometry.dispose(); material.dispose();
  return { background: target.texture, environment };
}
