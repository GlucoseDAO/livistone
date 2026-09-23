/** Use the largest body type that fits the panel, reserving its footer and keeping every word. */
export function fitPosterText(ctx: CanvasRenderingContext2D, text: string, width: number, height: number, maximum: number): { lines: string[]; size: number; leading: number } {
  let size = maximum, lines: string[] = [];
  for (; size >= 8; size--) {
    ctx.font = `${size}px sans-serif`; lines = [];
    for (const word of text.split(/\s+/)) {
      const last = lines.at(-1);
      if (last && ctx.measureText(last + ' ' + word).width <= width) lines[lines.length - 1] = last + ' ' + word;
      else lines.push(word);
    }
    if (lines.length * size * 1.3 <= height) break;
  }
  return { lines, size, leading: size * 1.3 };
}
export function paintPosterText(ctx: CanvasRenderingContext2D, text: string, x: number, top: number, width: number, height: number, maximum: number): void {
  const layout = fitPosterText(ctx, text, width, height, maximum);
  ctx.font = `${layout.size}px sans-serif`;
  layout.lines.forEach((line, i) => ctx.fillText(line, x, top + layout.size + i * layout.leading));
}
