// Every painted texture (posters, captions, signs, atlases) is a 2D canvas uploaded once to the GPU. A GPU-backed canvas makes
// that upload a synchronous readback, 5–70 ms each and over a second in all on an integrated GPU, during the shader warm-up
// before the first view; a CPU-backed one uploads as a plain copy. Set before any module paints, so future canvases share it.
const getContext = HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, options?: Record<string, unknown>) {
  return getContext.call(this, type as '2d', type === '2d' ? { willReadFrequently: true, ...options } : options);
} as typeof getContext;
import { loadingStage } from './loading';
import { ambience } from './game/audio';
// The radio plays from the loading screen on (after the first gesture, where autoplay is blocked); its button there toggles it.
const music = document.querySelector<HTMLButtonElement>('#loading-sound');
const showMusic = (enabled: boolean): void => {
  if (!music) return;
  music.setAttribute('aria-pressed', String(enabled)); music.setAttribute('aria-label', enabled ? 'Mute music' : 'Play music'); music.title = enabled ? 'Mute music' : 'Play music';
  music.querySelector('.loading-sound-on')!.toggleAttribute('hidden', !enabled); music.querySelector('.loading-sound-off')!.toggleAttribute('hidden', enabled);
  music.querySelector('.loading-sound-label')!.textContent = enabled ? 'Music on' : 'Music off';
};
ambience.onStateChange(showMusic); showMusic(ambience.enabled);
music?.addEventListener('click', () => { void ambience.toggle().catch(() => undefined); });
ambience.start();
await loadingStage(5, 'Opening the town…');
try { await import('./main'); }
catch (error) {
  console.error('Startup failed', error);
  document.querySelector('#loading-status')!.textContent = 'The town could not load. Check your connection and reload to try again.';
  document.querySelector('#loading-progress')?.remove();
  document.querySelector('#loading-count')?.remove();
  const retry = document.createElement('button'); retry.textContent = 'Reload'; retry.onclick = () => location.reload(); document.querySelector('.loading-meta')?.append(retry);
}
