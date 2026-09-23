import { loadingStage } from './loading';
await loadingStage(5, 'Opening the town…');
try { await import('./main'); }
catch (error) {
  console.error('Startup failed', error);
  document.querySelector('#loading-status')!.textContent = 'The town could not load. Check your connection and reload to try again.';
  document.querySelector('#loading-progress')?.remove();
  document.querySelector('#loading-count')?.remove();
  const retry = document.createElement('button'); retry.textContent = 'Reload'; retry.onclick = () => location.reload(); document.querySelector('#boot-loading')?.append(retry);
}
