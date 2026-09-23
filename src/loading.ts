/** Let the browser paint each completed startup stage before the next CPU-heavy task. */
export async function loadingStage(value: number, label: string): Promise<void> {
  const progress = document.querySelector<HTMLProgressElement>('#loading-progress');
  if (progress) progress.value = value;
  const status = document.querySelector('#loading-status'); if (status) status.textContent = label;
  const count = document.querySelector('#loading-count'); if (count) count.textContent = `${value}%`;
  await new Promise<void>(resolve => requestAnimationFrame(() => { setTimeout(resolve, 0); }));
}
