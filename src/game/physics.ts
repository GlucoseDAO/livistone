import RAPIER from '@dimforge/rapier3d-compat';
import { SPAWN } from './content';
export type ColliderSpec =
  | { type: 'box'; position: [number, number, number]; size: [number, number, number]; yaw?: number }
  | { type: 'mesh'; vertices: Float32Array; indices: Uint32Array };
export class Physics {
  readonly world: RAPIER.World;
  readonly body: RAPIER.RigidBody;
  readonly collider: RAPIER.Collider;
  private readonly controller: RAPIER.KinematicCharacterController;
  private verticalVelocity = 0;
  static async create(specs: ColliderSpec[]): Promise<Physics> {
    await RAPIER.init();
    return new Physics(specs);
  }
  private constructor(specs: ColliderSpec[]) {
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.world.timestep = 1 / 60;
    for (const spec of specs) {
      if (spec.type === 'box') {
        const desc = RAPIER.ColliderDesc.cuboid(...spec.size).setTranslation(...spec.position);
        if (spec.yaw) desc.setRotation({ x: 0, y: Math.sin(spec.yaw / 2), z: 0, w: Math.cos(spec.yaw / 2) });
        this.world.createCollider(desc);
      } else this.world.createCollider(RAPIER.ColliderDesc.trimesh(spec.vertices, spec.indices));
    }
    this.body = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(SPAWN.x, SPAWN.y, SPAWN.z));
    this.collider = this.world.createCollider(RAPIER.ColliderDesc.capsule(0.53, 0.29), this.body);
    this.controller = this.world.createCharacterController(0.025);
    this.controller.enableAutostep(0.32, 0.25, false);
    this.controller.enableSnapToGround(0.4);
    this.controller.setMaxSlopeClimbAngle(Math.PI / 4);
    this.controller.setMinSlopeSlideAngle(Math.PI / 3);
  }
  step(x: number, z: number, dt = 1 / 60): void {
    this.verticalVelocity = Math.max(-18, this.verticalVelocity - 18 * dt);
    this.controller.computeColliderMovement(this.collider, { x: x * dt, y: this.verticalVelocity * dt, z: z * dt });
    const move = this.controller.computedMovement();
    const pos = this.body.translation();
    this.body.setNextKinematicTranslation({ x: pos.x + move.x, y: pos.y + move.y, z: pos.z + move.z });
    this.world.step();
    if (this.controller.computedGrounded()) this.verticalVelocity = -0.3;
  }
  position(): { x: number; y: number; z: number } { return this.body.translation(); }
  teleport(position: { x: number; y: number; z: number } = SPAWN): void {
    const next = { x: position.x, y: position.y, z: position.z };
    this.body.setTranslation(next, true);
    this.body.setNextKinematicTranslation(next);
    this.verticalVelocity = 0;
  }
  dispose(): void { this.world.free(); }
}
