/** One lightweight media element; files load only when playback is attempted. */
export class RecordingPlayer {
  private audio?: HTMLAudioElement;
  private index = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private generation = 0;
  private hidden = false;
  private started = false;
  /** The browser refused to start without a gesture. The radio stays on, armed for the next one, but nothing is heard yet. */
  private blocked = false;
  enabled = true;
  /** Every control that shows the state: the loading screen's button, then the game's toolbar and menu. */
  private readonly listeners = new Set<(enabled: boolean) => void>();
  constructor(private readonly tracks: readonly string[]) {}
  onStateChange(listener: (enabled: boolean) => void): void { this.listeners.add(listener); }
  /** What the sound buttons show: on only while the radio is on and the browser lets it play. */
  get audible(): boolean { return this.enabled && !this.blocked; }
  private changed(): void { for (const listener of this.listeners) listener(this.audible); }
  // A first press on a sound button is that button's toggle: starting playback for it too would make the toggle silence it.
  private readonly unlock = (event: Event): void => { if (!(event.target instanceof Element && event.target.closest('[data-sound-toggle]'))) this.resume(); };
  start(): void {
    if (this.started) return; this.started = true;
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
    if (this.blocked) { this.blocked = false; this.changed(); }
    if (!this.enabled || this.hidden) audio.pause();
    else {
      window.removeEventListener('pointerdown', this.unlock, true);
      window.removeEventListener('keydown', this.unlock, true);
    }
  }
  private failure(error: unknown, token: number): void {
    if (token !== this.generation) return;
    // A blocked autoplay remains armed for the visitor's first gesture; until then the buttons show the silence.
    if (error instanceof DOMException && error.name === 'NotAllowedError') { if (!this.blocked) { this.blocked = true; this.changed(); } return; }
    this.enabled = false; this.audio?.pause(); this.changed();
  }
  async toggle(): Promise<boolean> {
    const token = ++this.generation;
    clearTimeout(this.timer); this.timer = undefined;
    // While blocked the buttons read off, so a press there means play: turning the radio off would leave the town silent.
    this.enabled = this.blocked || !this.enabled;
    if (!this.enabled) this.audio?.pause();
    else try { await this.play(); } catch (error) { this.failure(error, token); }
    this.changed();
    return this.audible;
  }
  suspend(): void { this.hidden = true; clearTimeout(this.timer); this.timer = undefined; this.audio?.pause(); }
  resume(): void {
    this.hidden = document.hidden;
    const token = this.generation;
    if (this.enabled) void this.play().catch(error => this.failure(error, token));
  }
}
