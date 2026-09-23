/** One lightweight media element; files load only when playback is attempted. */
export class RecordingPlayer {
  private audio?: HTMLAudioElement;
  private index = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private generation = 0;
  private hidden = false;
  enabled = true;
  onStateChange?: (enabled: boolean) => void;
  constructor(private readonly tracks: readonly string[]) {}
  private readonly unlock = (): void => { this.resume(); };
  start(): void {
    window.addEventListener('pointerdown', this.unlock, true);
    window.addEventListener('keydown', this.unlock, true);
    this.resume();
  }
  private element(): HTMLAudioElement {
    if (!this.audio) {
      this.audio = new Audio();
      this.audio.preload = 'none';
      this.audio.volume = .45;
      this.audio.addEventListener('ended', () => {
        if (!this.enabled || this.hidden) return;
        this.index = (this.index + 1) % this.tracks.length;
        this.timer = setTimeout(() => { this.timer = undefined; this.resume(); }, 1500);
      });
    }
    return this.audio;
  }
  private async play(): Promise<void> {
    if (!this.enabled || this.hidden || !this.tracks.length || this.timer) return;
    const audio = this.element(), url = this.tracks[this.index];
    if (audio.getAttribute('src') !== url) audio.src = url;
    if (!audio.paused) return;
    await audio.play();
    if (!this.enabled || this.hidden) audio.pause();
    else {
      window.removeEventListener('pointerdown', this.unlock, true);
      window.removeEventListener('keydown', this.unlock, true);
    }
  }
  private failure(error: unknown, token: number): void {
    // A blocked autoplay remains armed for the visitor's first gesture.
    if (token !== this.generation || (error instanceof DOMException && error.name === 'NotAllowedError')) return;
    this.enabled = false; this.audio?.pause(); this.onStateChange?.(false);
  }
  async toggle(): Promise<boolean> {
    const token = ++this.generation;
    clearTimeout(this.timer); this.timer = undefined;
    this.enabled = !this.enabled;
    if (!this.enabled) this.audio?.pause();
    else try { await this.play(); } catch (error) { this.failure(error, token); }
    this.onStateChange?.(this.enabled);
    return this.enabled;
  }
  suspend(): void { this.hidden = true; clearTimeout(this.timer); this.timer = undefined; this.audio?.pause(); }
  resume(): void {
    this.hidden = document.hidden;
    const token = this.generation;
    if (this.enabled) void this.play().catch(error => this.failure(error, token));
  }
}
