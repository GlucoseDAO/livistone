/** Let the browser paint each completed startup stage before the next CPU-heavy task. */
export function showLoadingStage(value: number, label: string): void {
  const progress = document.querySelector<HTMLProgressElement>('#loading-progress');
  if (progress && progress.value !== value) progress.value = value;
  const status = document.querySelector('#loading-status'); if (status && status.textContent !== label) status.textContent = label;
  const count = document.querySelector('#loading-count'); if (count && count.textContent !== `${value}%`) count.textContent = `${value}%`;
}
export async function loadingStage(value: number, label: string): Promise<void> {
  showLoadingStage(value, label);
  await new Promise<void>(resolve => requestAnimationFrame(() => { setTimeout(resolve, 0); }));
}
