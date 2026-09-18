export class Ambience {
  private context?: AudioContext;
  private gain?: GainNode;
  private filter?: BiquadFilterNode;
  private garden = false;
  enabled = false;
  async toggle(): Promise<boolean> {
    if (!this.context) {
      this.context = new AudioContext();
      const length = this.context.sampleRate * 4;
      const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
      const data = buffer.getChannelData(0); let last = 0;
      for (let i = 0; i < length; i++) { last = (last + (Math.random() * 2 - 1) * 0.02) / 1.02; data[i] = last * 3; }
      const source = this.context.createBufferSource(); source.buffer = buffer; source.loop = true;
      const filter = this.context.createBiquadFilter(); this.filter = filter; filter.type = 'lowpass'; filter.frequency.value = this.garden ? 1500 : 850;
      this.gain = this.context.createGain(); this.gain.gain.value = 0;
      source.connect(filter).connect(this.gain).connect(this.context.destination); source.start();
    }
    this.enabled = !this.enabled;
    if (this.enabled) await this.context.resume();
    this.gain!.gain.setTargetAtTime(this.enabled ? 0.1 : 0, this.context.currentTime, 0.5);
    return this.enabled;
  }
  setGarden(garden: boolean): void { this.garden = garden; if (this.context && this.filter) this.filter.frequency.setTargetAtTime(garden ? 1500 : 850, this.context.currentTime, 1); }
  suspend(): void { void this.context?.suspend(); }
  resume(): void { if (this.enabled) void this.context?.resume(); }
}
