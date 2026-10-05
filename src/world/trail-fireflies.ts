import * as THREE from 'three';
import { TRAIL_CURVE } from './mountain-layout';
import { terrainSurfaceHeight } from './terrain';
import { addGlow } from './night-lighting';
import { windTime } from './wind';

/** A few soft, bodiless lights per bend; the existing nearest-light pool lights the trail below them. */
export class TrailFireflies {
  private readonly lights: { glow: THREE.Sprite; rest: THREE.Vector3; phase: number }[] = [];
  constructor(parent: THREE.Group, mobile: boolean) {
    const root = new THREE.Group(); root.name = 'Jepii Mici · drifting lights'; parent.add(root);
    const count = mobile ? 24 : 42;
    for (let i = 0; i < count; i++) {
      const p = TRAIL_CURVE.getPointAt(.02 + i / (count - 1) * .91), tangent = TRAIL_CURVE.getTangentAt(.02 + i / (count - 1) * .91);
      p.x += tangent.z * (i % 2 ? 1 : -1) * .85; p.z -= tangent.x * (i % 2 ? 1 : -1) * .85;
      p.y = terrainSurfaceHeight(p.x, p.z) + 1.15 + (i % 3) * .22;
      const glow = addGlow(root, p, i % 3 ? '#e5f6b1' : '#fff0bd', 1.15, 4.5, 5.5, .78); glow.name = 'Flying trail light'; glow.userData.moving = true;
      this.lights.push({ glow, rest: p.clone(), phase: i * 2.399 });
    }
  }
  update(): void {
    const t = windTime.value as number;
    for (const { glow, rest, phase } of this.lights) {
      glow.position.set(rest.x + Math.sin(t * .6 + phase) * .32, rest.y + Math.sin(t * .85 + phase) * .23, rest.z + Math.cos(t * .5 + phase) * .28);
      (glow.material as THREE.SpriteMaterial).opacity = .56 + .2 * (.5 + .5 * Math.sin(t * .75 + phase));
    }
  }
}
