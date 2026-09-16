export class Input {
  readonly keys = new Set<string>();
  moveX = 0;
  moveZ = 0;
  yaw = 0;
  pitch = 0;
  active = false;
  private lookPointer: number | null = null;
  private joystickPointer: number | null = null;
  private last = { x: 0, y: 0 };
  private origin = { x: 0, y: 0 };
  private readonly knob: HTMLElement;
  constructor(private canvas: HTMLCanvasElement, private joystick: HTMLElement, private onAction: (action: string) => void) {
    this.knob = joystick.querySelector<HTMLElement>('.stick-knob')!;
    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code) && this.active) e.preventDefault();
      if (this.active) this.keys.add(e.code);
      if (!e.repeat && e.code === 'KeyM') this.onAction('map');
      if (!e.repeat && e.code === 'KeyE' && this.active) this.onAction('interact');
      if (!e.repeat && e.code === 'Escape') this.onAction('escape');
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.clear());
    document.addEventListener('visibilitychange', () => this.clear());
    document.addEventListener('mousemove', (e) => {
      if (this.active && document.pointerLockElement === this.canvas) this.look(e.movementX, e.movementY);
    });
    canvas.addEventListener('pointerdown', (e) => {
      if (!this.active || this.lookPointer !== null) return;
      this.lookPointer = e.pointerId;
      this.last = { x: e.clientX, y: e.clientY };
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!this.active || this.lookPointer !== e.pointerId || document.pointerLockElement === canvas) return;
      this.look(e.clientX - this.last.x, e.clientY - this.last.y);
      this.last = { x: e.clientX, y: e.clientY };
    });
    const stopLook = (e: PointerEvent): void => { if (this.lookPointer === e.pointerId) this.lookPointer = null; };
    canvas.addEventListener('pointerup', stopLook);
    canvas.addEventListener('pointercancel', stopLook);
    canvas.addEventListener('lostpointercapture', stopLook);
    joystick.addEventListener('pointerdown', (e) => {
      if (!this.active || this.joystickPointer !== null) return;
      e.preventDefault();
      this.joystickPointer = e.pointerId;
      const box = joystick.getBoundingClientRect();
      this.origin = { x: box.left + box.width / 2, y: box.top + box.height / 2 };
      joystick.setPointerCapture(e.pointerId);
      this.updateStick(e);
    });
    joystick.addEventListener('pointermove', (e) => { if (this.joystickPointer === e.pointerId) this.updateStick(e); });
    const stopStick = (e: PointerEvent): void => {
      if (this.joystickPointer === e.pointerId) { this.joystickPointer = null; this.moveX = 0; this.moveZ = 0; this.knob.style.transform = ''; }
    };
    joystick.addEventListener('pointerup', stopStick);
    joystick.addEventListener('pointercancel', stopStick);
    joystick.addEventListener('lostpointercapture', stopStick);
  }
  private updateStick(e: PointerEvent): void {
    const dx = e.clientX - this.origin.x;
    const dy = e.clientY - this.origin.y;
    const length = Math.hypot(dx, dy);
    const scale = Math.min(length, 35) / (length || 1);
    this.moveX = dx * scale / 35;
    this.moveZ = -dy * scale / 35;
    this.knob.style.transform = 'translate(' + dx * scale + 'px,' + dy * scale + 'px)';
  }
  private look(dx: number, dy: number): void {
    this.yaw -= dx * 0.0028;
    this.pitch = Math.max(-1.3, Math.min(1.3, this.pitch - dy * 0.0028));
  }
  direction(): { x: number; z: number; speed: number } {
    let x = this.moveX + Number(this.keys.has('KeyD') || this.keys.has('ArrowRight')) - Number(this.keys.has('KeyA') || this.keys.has('ArrowLeft'));
    let z = this.moveZ + Number(this.keys.has('KeyW') || this.keys.has('ArrowUp')) - Number(this.keys.has('KeyS') || this.keys.has('ArrowDown'));
    const length = Math.max(1, Math.hypot(x, z)); x /= length; z /= length;
    return { x: x * Math.cos(this.yaw) - z * Math.sin(this.yaw), z: -x * Math.sin(this.yaw) - z * Math.cos(this.yaw), speed: this.keys.has('ShiftLeft') ? 6.5 : 4.2 };
  }
  clear(): void {
    this.keys.clear(); this.moveX = 0; this.moveZ = 0; this.lookPointer = null; this.joystickPointer = null; this.knob.style.transform = '';
  }
  async capture(): Promise<void> {
    if (matchMedia('(pointer: coarse)').matches || !this.canvas.requestPointerLock) return;
    try { await this.canvas.requestPointerLock(); } catch { /* Drag-to-look remains available. */ }
  }
}
