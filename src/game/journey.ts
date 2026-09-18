/** A bounded trip with a loading checkpoint inside the tunnel. The caller advances it only in travel mode. */
export class Journey {
  phase: 'departing' | 'waiting' | 'arriving' | 'complete' = 'departing';
  elapsed = 0;
  constructor(readonly outbound: boolean) {}
  step(dt: number, ready: boolean): 'transfer' | 'complete' | null {
    if (this.phase === 'complete') return null;
    if (this.phase !== 'waiting') this.elapsed = Math.min(9, this.elapsed + Math.max(0, dt));
    if (this.phase === 'departing' && this.elapsed >= 9) this.phase = 'waiting';
    if (this.phase === 'waiting' && ready) { this.phase = 'arriving'; this.elapsed = 0; return 'transfer'; }
    if (this.phase === 'arriving' && this.elapsed >= 9) { this.phase = 'complete'; return 'complete'; }
    return null;
  }
  get offset(): number {
    const t = this.elapsed / 9, smooth = t * t * (3 - 2 * t), direction = this.outbound ? 1 : -1;
    return this.phase === 'arriving' ? -direction * 160 * (1 - smooth) : this.phase === 'complete' ? 0 : direction * 160 * smooth;
  }
  get darkness(): number { return this.phase === 'waiting' ? 1 : this.phase === 'departing' ? Math.max(0, this.elapsed - 8) : this.phase === 'arriving' ? Math.max(0, 1 - this.elapsed) : 0; }
}
