/** Original transit campaign: bold color fields, oversized type and a diagram of Livistone's destinations. */
export function paintTransitAd(ctx: CanvasRenderingContext2D, w: number, h: number, kind: 'science' | 'art' | 'future'): void {
  const science = kind === 'science', future = kind === 'future', cream = '#eee8d6', ink = '#171f2c', red = '#e84435', teal = '#146073', yellow = '#f5b629';
  ctx.fillStyle = cream; ctx.fillRect(0, 0, w, h);
  const header = h * .39;
  // Keep every line of copy above the seat backs; the lower field is artwork only.
  ctx.save(); ctx.translate(0, header); ctx.scale(1, (h - header) / h);
  const bottom = h;
  ctx.save(); ctx.beginPath(); ctx.rect(18, 18, w - 36, bottom - 18); ctx.clip();
  ctx.fillStyle = science ? ink : teal; ctx.fillRect(18, 18, w - 36, bottom);
  // Sweeping parallel ribbons echo the reference's train silhouettes without copying the artwork.
  for (let i = 0; i < 4; i++) {
    ctx.strokeStyle = [red, yellow, cream, science ? teal : ink][i]; ctx.lineWidth = w * .073; ctx.lineCap = 'butt';
    ctx.beginPath(); ctx.moveTo(w * (.12 + i * .09), -50); ctx.bezierCurveTo(w * (.12 + i * .09), bottom * .5, w * (.8 - i * .11), bottom * .35, w * (.8 - i * .11), bottom + 60); ctx.stroke();
  }
  if (science || future) {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = 7; ctx.strokeStyle = cream;
    const stations = [[.1,.24,'DATA'],[.3,.43,'MODELS'],[.51,.24,'GLUCOSE'],[.72,.48,'YOU'],[.9,.26,'NEXT']];
    ctx.beginPath(); stations.forEach(([x,y],i) => { if(i===0) ctx.moveTo(Number(x)*w,Number(y)*bottom+70); else ctx.lineTo(Number(x)*w,Number(y)*bottom+70); }); ctx.stroke();
    for (const [x,y,label] of stations) { const px=Number(x)*w,py=Number(y)*bottom+70; ctx.beginPath(); ctx.arc(px,py,11,0,Math.PI*2); ctx.fillStyle=ink; ctx.fill();ctx.stroke();ctx.font='700 23px sans-serif';ctx.fillStyle=cream;ctx.textAlign='center';ctx.fillText(String(label),px,py-25); }
  } else {
    // A flat, oversized open ring and offset stone turn geometry into a memorable graphic mark.
    ctx.strokeStyle = cream; ctx.lineWidth = 34; ctx.beginPath(); ctx.ellipse(w*.54,bottom*.5,w*.19,bottom*.32,-.4,.3,Math.PI*1.94);ctx.stroke();
    ctx.fillStyle=red;ctx.beginPath();ctx.ellipse(w*.64,bottom*.28,w*.092,bottom*.17,-.4,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle=ink;ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(w*.57,bottom*.2);ctx.lineTo(w*.64,bottom*.44);ctx.lineTo(w*.71,bottom*.24);ctx.stroke();
  }
  ctx.restore();
  ctx.restore();
  ctx.fillStyle = cream; ctx.fillRect(18, 18, w - 36, header - 18);
  ctx.fillStyle = ink; ctx.textAlign = 'left';
  ctx.font = '700 24px sans-serif';
  ctx.fillText('LIVISTONE / ' + (science ? 'SCIENCE LINE' : future ? 'NEXT STOP' : 'ART LINE'), 38, h * .065, w - 76);
  ctx.font = '800 ' + Math.min(142, h * .19) + 'px sans-serif';
  ctx.fillText(science ? 'SCIENCE' : future ? 'FUTURE' : 'ART', 32, h * .235, w - 160);
  ctx.font = '700 25px sans-serif';
  ctx.fillText(science ? 'READ THE PATTERNS. EXPLORE GLUCOSEDAO.' : future ? 'STEP INTO THE FUTURE.' : 'LIVIA ZAHARIA / WEAR A NEW WORLD.', 38, h * .30, w - 76);
  ctx.font = '24px sans-serif';
  ctx.fillText(science ? 'livia.glucosedao.org/science-tech/glucosedao' : 'livia.glucosedao.org/pieces', 38, h * .355, w - 76);
  const arrowX = w - 103, arrowY = h * .175;
  ctx.lineWidth = 13; ctx.strokeStyle = red; ctx.beginPath(); ctx.moveTo(arrowX - 45, arrowY); ctx.lineTo(arrowX + 40, arrowY); ctx.lineTo(arrowX + 8, arrowY - 32); ctx.moveTo(arrowX + 40, arrowY); ctx.lineTo(arrowX + 8, arrowY + 32); ctx.stroke();
  ctx.lineWidth=5;ctx.strokeStyle=ink;ctx.strokeRect(9,9,w-18,h-18);
}
