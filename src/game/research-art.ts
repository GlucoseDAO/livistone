export type ResearchFigure = 'trace' | 'cgm' | 'insulin' | 'network' | 'forecast' | 'glucose';

/** Shared chapter illustrations for Glucose Commons posters and the slide dialog. */
export function drawResearchFigure(ctx: CanvasRenderingContext2D, figure: ResearchFigure, x: number, y: number, width: number, height: number): void {
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, width, height); ctx.clip();
  ctx.fillStyle = '#1f3d36'; ctx.fillRect(x, y, width, height);
  if (figure === 'trace' || figure === 'forecast' || figure === 'cgm') {
    const points = figure === 'cgm'
      ? [0.18, 0.42, 0.38, 0.55, 0.72, 0.48, 0.4, 0.62, 0.7, 0.44, 0.36]
      : [0.55, 0.48, 0.62, 0.35, 0.28, 0.4, 0.58, 0.72, 0.45, 0.38, 0.5];
    const line = (colour: string, shift: number, widthPx: number): void => {
      ctx.strokeStyle = colour; ctx.lineWidth = widthPx; ctx.lineJoin = 'round'; ctx.beginPath();
      points.forEach((value, i) => {
        const px = x + 28 + i / (points.length - 1) * (width - 56);
        const py = y + height * (0.22 + (value + shift) * 0.58);
        if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      }); ctx.stroke();
    };
    ctx.strokeStyle = '#2f564c'; ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(x + 20, y + height * i / 4); ctx.lineTo(x + width - 20, y + height * i / 4); ctx.stroke(); }
    line('#7ec8b3', 0, 5); if (figure === 'forecast') line('#d4a05a', 0.08, 3.5);
    if (figure === 'cgm') {
      ctx.fillStyle = '#e6c27a'; ctx.beginPath(); ctx.arc(x + width * 0.82, y + height * 0.28, 10, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#c9d6c4'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x + width * 0.82, y + height * 0.28 + 10); ctx.lineTo(x + width * 0.82, y + height * 0.72); ctx.stroke();
    }
  } else if (figure === 'network') {
    const nodes = [[0.22, 0.35], [0.5, 0.22], [0.78, 0.38], [0.38, 0.7], [0.68, 0.68]];
    ctx.strokeStyle = '#7aa898'; ctx.lineWidth = 3;
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
      ctx.beginPath(); ctx.moveTo(x + nodes[i][0] * width, y + nodes[i][1] * height); ctx.lineTo(x + nodes[j][0] * width, y + nodes[j][1] * height); ctx.stroke();
    }
    for (const [nx, ny] of nodes) { ctx.fillStyle = '#e8c56a'; ctx.beginPath(); ctx.arc(x + nx * width, y + ny * height, 11, 0, Math.PI * 2); ctx.fill(); }
  } else if (figure === 'insulin') {
    ctx.strokeStyle = '#7eb8ad'; ctx.lineWidth = 8; ctx.beginPath();
    ctx.moveTo(x + width * 0.18, y + height * 0.7); ctx.bezierCurveTo(x + width * 0.3, y + height * 0.15, x + width * 0.55, y + height * 0.2, x + width * 0.72, y + height * 0.45);
    ctx.stroke(); ctx.strokeStyle = '#d08a6a'; ctx.beginPath();
    ctx.moveTo(x + width * 0.22, y + height * 0.55); ctx.bezierCurveTo(x + width * 0.4, y + height * 0.85, x + width * 0.7, y + height * 0.75, x + width * 0.82, y + height * 0.32);
    ctx.stroke();
  } else {
    const cx = x + width * 0.5, cy = y + height * 0.5, r = Math.min(width, height) * 0.22;
    ctx.strokeStyle = '#d7c7a4'; ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    for (const angle of [0, 60, 120, 180, 240, 300]) {
      const rad = angle * Math.PI / 180; ctx.fillStyle = angle % 120 ? '#bd765f' : '#eeeade';
      ctx.beginPath(); ctx.arc(cx + Math.cos(rad) * r, cy + Math.sin(rad) * r, 14, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}
