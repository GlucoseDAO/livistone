/** Drawn stand-in for Dewdrop: the public catalogue has no local studio photograph. */
export function drawDewdropRing(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number): void {
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, width, height); ctx.clip();
  ctx.fillStyle = '#f4f0e5'; ctx.fillRect(x, y, width, height);
  const cx = x + width * 0.5, cy = y + height * 0.46, drop = Math.min(width, height) * 0.18;
  ctx.strokeStyle = '#87988e'; ctx.lineWidth = 7; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx - drop * 1.7, cy + drop * 0.2);
  ctx.bezierCurveTo(cx - drop * 1.9, cy - drop * 1.4, cx - drop * 0.2, cy - drop * 2.1, cx, cy - drop * 0.35);
  ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + drop * 1.7, cy + drop * 0.2);
  ctx.bezierCurveTo(cx + drop * 1.9, cy - drop * 1.4, cx + drop * 0.2, cy - drop * 2.1, cx, cy - drop * 0.35);
  ctx.stroke();
  ctx.beginPath(); ctx.ellipse(cx, cy + drop * 0.85, drop * 1.15, drop * 0.22, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#4aa4c4'; ctx.beginPath();
  ctx.moveTo(cx, cy - drop * 1.15);
  ctx.bezierCurveTo(cx + drop * 0.85, cy - drop * 0.15, cx + drop * 0.55, cy + drop * 1.05, cx, cy + drop * 1.25);
  ctx.bezierCurveTo(cx - drop * 0.55, cy + drop * 1.05, cx - drop * 0.85, cy - drop * 0.15, cx, cy - drop * 1.15);
  ctx.fill();
  ctx.strokeStyle = '#9ad4e2'; ctx.lineWidth = 2;
  for (const t of [-0.45, 0, 0.45]) {
    ctx.beginPath(); ctx.moveTo(cx + t * drop, cy - drop * 0.7); ctx.lineTo(cx + t * drop * 0.7, cy + drop * 0.95); ctx.stroke();
  }
  ctx.restore();
}
