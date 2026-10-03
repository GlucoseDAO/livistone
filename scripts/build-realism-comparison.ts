// Local before/after review page for one realism sub-plan (docs/realism/00-harness.md). Not shipped with the game.
// Usage: bun scripts/build-realism-comparison.ts <dir> [--base before] [--title "01 — Sun shadows"]
// Reads <dir>/<variant>/<profile>/<time>/captures.json written by scripts/screenshot-realism.ts.
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

interface Capture { name: string; snapshot: { calls?: number; triangles?: number; fps?: number; graphicsTier?: string; backend?: string } }
interface CaptureFile { profile: string; time: string; commit: string; url: string; capturedAt: string; errors: string[]; captures: Capture[]; readyMs?: number | null }

const args = process.argv.slice(2);
const option = (flag: string) => { const index = args.indexOf(flag); return index >= 0 ? args.splice(index, 2)[1] : undefined; };
const base = option('--base') ?? 'before', titleArg = option('--title');
const dir = args[0];
if (!dir || !existsSync(dir)) throw new Error('Usage: bun scripts/build-realism-comparison.ts <dir> [--base before] [--title text]');
const subdirs = (path: string) => existsSync(path) ? readdirSync(path).filter(name => statSync(join(path, name)).isDirectory()).sort() : [];

// variant → "profile/time" → record
const data: { [variant: string]: { [key: string]: CaptureFile } } = {};
for (const variant of subdirs(dir)) for (const profile of subdirs(join(dir, variant))) for (const time of subdirs(join(dir, variant, profile))) {
  const file = join(dir, variant, profile, time, 'captures.json');
  if (existsSync(file)) (data[variant] ??= {})[`${profile}/${time}`] = JSON.parse(readFileSync(file, 'utf8')) as CaptureFile;
}
if (!data[base]) throw new Error(`No "${base}" captures under ${dir}; found: ${Object.keys(data).join(', ') || 'none'}`);
const variants = Object.keys(data).filter(name => name !== base);
if (!variants.length) throw new Error(`Only "${base}" exists under ${dir}; capture an after/ variant first.`);
const title = titleArg ?? basename(dir.replace(/\/$/, ''));

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} — before/after</title>
<style>
:root{--bg:#121718;--panel:#1b2224;--line:#2d3739;--text:#e8ece9;--muted:#9fb0aa;--accent:#d9b36a;--good:#8fcf9a;--bad:#e59a8c}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:15px/1.5 system-ui,sans-serif}
main{max-width:1500px;margin:auto;padding:24px 16px 64px}h1{font-size:26px;margin:0 0 4px;font-weight:600}p.meta{color:var(--muted);margin:0 0 18px}
.bar{position:sticky;top:0;z-index:5;background:var(--bg);padding:10px 0;display:flex;flex-wrap:wrap;gap:10px 18px;align-items:center;border-bottom:1px solid var(--line);margin-bottom:18px}
label{color:var(--muted);font-size:13px;display:flex;gap:6px;align-items:center}select,button{background:var(--panel);color:var(--text);border:1px solid var(--line);border-radius:6px;padding:5px 9px;font:inherit}
button.on{border-color:var(--accent);color:var(--accent)}
table{border-collapse:collapse;width:100%;margin:0 0 22px;font-size:13px}th,td{border-bottom:1px solid var(--line);padding:5px 8px;text-align:right}th:first-child,td:first-child{text-align:left}th{color:var(--muted);font-weight:500}
.good{color:var(--good)}.bad{color:var(--bad)}
.grid{display:grid;gap:22px}.card{background:var(--panel);border:1px solid var(--line);border-radius:10px;overflow:hidden}
.card h2{font-size:15px;margin:0;padding:10px 12px;display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap}.card h2 span{color:var(--muted);font-weight:400;font-size:13px}
.cmp{position:relative;aspect-ratio:16/10;background:#000;cursor:ew-resize;user-select:none;touch-action:pan-y}.cmp img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;display:block}
.cmp .after{clip-path:inset(0 0 0 var(--split,50%))}.cmp .handle{position:absolute;top:0;bottom:0;left:var(--split,50%);width:2px;background:var(--accent);pointer-events:none}
.cmp .tag{position:absolute;top:8px;padding:2px 8px;border-radius:4px;background:#000a;font-size:12px}.cmp .tag.l{left:8px}.cmp .tag.r{right:8px}
.side{display:grid;grid-template-columns:1fr 1fr;gap:2px;background:#000}.side img{width:100%;display:block}
.diff{display:block;width:100%;background:#000}.missing{padding:40px;text-align:center;color:var(--muted)}.errors{color:var(--bad);font-size:13px;padding:0 12px 10px}
</style></head><body><main>
<h1>${title}</h1><p class="meta" id="meta"></p>
<div class="bar">
<label>Compare with <select id="variant"></select></label><label>Profile <select id="profile"></select></label><label>Time <select id="time"></select></label>
<span><button id="mode-side" class="on">Side by side</button> <button id="mode-slider">Slider</button> <button id="mode-flip">Flip</button> <button id="mode-diff">Difference</button></span>
<span class="meta" style="margin:0">In Slider mode, drag across an image to move the split. Fps is headless and informational only.</span>
</div>
<table id="summary"></table><div class="grid" id="views"></div>
</main><script>
const BASE=${JSON.stringify(base)}, DATA=${JSON.stringify(data)};
const $=id=>document.getElementById(id); let mode='side'; // The owner reviews side by side first; the slider, flip and difference modes stay one click away.
const keys=v=>Object.keys(DATA[v]||{}); const fmt=n=>n==null?'—':n.toLocaleString('en');
function delta(a,b){if(a==null||b==null)return'';const d=b-a,p=a?d/a*100:0;if(!d)return'<span>±0</span>';return '<span class="'+(d>0?'bad':'good')+'">'+(d>0?'+':'')+fmt(d)+' ('+(d>0?'+':'')+p.toFixed(1)+'%)</span>'}
function options(sel,values){const cur=sel.value;sel.innerHTML=values.map(v=>'<option>'+v+'</option>').join('');if(values.includes(cur))sel.value=cur}
function refresh(){
  const variant=$('variant').value, pairs=keys(variant).filter(k=>DATA[BASE][k]);
  options($('profile'),[...new Set(pairs.map(k=>k.split('/')[0]))]); options($('time'),[...new Set(pairs.filter(k=>k.startsWith($('profile').value+'/')).map(k=>k.split('/')[1]))]);
  const key=$('profile').value+'/'+$('time').value, before=DATA[BASE][key], after=DATA[variant]?.[key];
  if(!before||!after){$('views').innerHTML='<p class="missing">No matching captures for '+key+'.</p>';$('summary').innerHTML='';return}
  const how=f=>{const s=f.captures[0]?.snapshot||{};return [s.backend,s.graphicsTier,f.readyMs?'ready '+(f.readyMs/1000).toFixed(1)+' s':''].filter(Boolean).join(' ')};
  $('meta').textContent=BASE+' @ '+before.commit+(how(before)?' ('+how(before)+')':'')+'  →  '+variant+' @ '+after.commit+(how(after)?' ('+how(after)+')':'')+'  ·  '+key+'  ·  captured '+after.capturedAt.slice(0,16).replace('T',' ');
  const byName=Object.fromEntries(after.captures.map(c=>[c.name,c])); let rows='',sum={c0:0,c1:0,t0:0,t1:0};
  $('views').innerHTML=before.captures.filter(c=>byName[c.name]).map(b=>{const a=byName[b.name],s0=b.snapshot,s1=a.snapshot;sum.c0+=s0.calls||0;sum.c1+=s1.calls||0;sum.t0+=s0.triangles||0;sum.t1+=s1.triangles||0;
    rows+='<tr><td>'+b.name+'</td><td>'+fmt(s0.calls)+'</td><td>'+fmt(s1.calls)+'</td><td>'+delta(s0.calls,s1.calls)+'</td><td>'+fmt(s0.triangles)+'</td><td>'+fmt(s1.triangles)+'</td><td>'+delta(s0.triangles,s1.triangles)+'</td><td>'+(s0.fps??'—')+' → '+(s1.fps??'—')+'</td></tr>';
    const i0=BASE+'/'+key+'/'+b.name+'.png', i1=variant+'/'+key+'/'+b.name+'.png';
    const body=mode==='diff'?'<canvas class="diff" data-a="'+i0+'" data-b="'+i1+'"></canvas>':mode==='side'?'<div class="side"><img loading="lazy" src="'+i0+'" alt="'+b.name+' '+BASE+'"><img loading="lazy" src="'+i1+'" alt="'+b.name+' '+variant+'"></div>'
      :'<div class="cmp" data-flip="'+(mode==='flip')+'"><img loading="lazy" src="'+i0+'" alt="'+b.name+' '+BASE+'"><img class="after" loading="lazy" src="'+i1+'" alt="'+b.name+' '+variant+'"><div class="handle"></div><span class="tag l">'+BASE+'</span><span class="tag r">'+variant+'</span></div>';
    return '<section class="card"><h2>'+b.name+'<span>calls '+fmt(s0.calls)+' → '+fmt(s1.calls)+' · triangles '+fmt(s0.triangles)+' → '+fmt(s1.triangles)+'</span></h2>'+body+'</section>'}).join('');
  $('summary').innerHTML='<tr><th>View</th><th>Calls before</th><th>after</th><th>Δ</th><th>Triangles before</th><th>after</th><th>Δ</th><th>Fps (headless)</th></tr>'+rows+'<tr><th>Total</th><th>'+fmt(sum.c0)+'</th><th>'+fmt(sum.c1)+'</th><th>'+delta(sum.c0,sum.c1)+'</th><th>'+fmt(sum.t0)+'</th><th>'+fmt(sum.t1)+'</th><th>'+delta(sum.t0,sum.t1)+'</th><th></th></tr>';
  const errs=[...before.errors.map(e=>BASE+': '+e),...after.errors.map(e=>variant+': '+e)]; if(errs.length)$('views').insertAdjacentHTML('afterbegin','<p class="errors">'+errs.join('<br>')+'</p>');
  document.querySelectorAll('canvas.diff').forEach(drawDiff);
  document.querySelectorAll('.cmp').forEach(el=>{const set=x=>{const r=el.getBoundingClientRect();el.style.setProperty('--split',Math.max(0,Math.min(100,(x-r.left)/r.width*100))+'%')};
    if(el.dataset.flip==='true'){el.style.setProperty('--split','100%');el.style.cursor='pointer';el.onclick=()=>el.style.setProperty('--split',el.style.getPropertyValue('--split')==='0%'?'100%':'0%');return}
    el.onpointerdown=e=>{set(e.clientX);el.setPointerCapture(e.pointerId)};el.onpointermove=e=>{if(e.buttons)set(e.clientX)}});
}
// Changed pixels in amber over a dimmed copy of the after image, so subtle changes are still visible.
function drawDiff(canvas){const load=src=>new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.onerror=()=>r(null);i.src=src});
  Promise.all([load(canvas.dataset.a),load(canvas.dataset.b)]).then(([a,b])=>{if(!a||!b)return;canvas.width=b.naturalWidth;canvas.height=b.naturalHeight;const c=canvas.getContext('2d');
    c.drawImage(a,0,0);const pa=c.getImageData(0,0,canvas.width,canvas.height);c.drawImage(b,0,0);const pb=c.getImageData(0,0,canvas.width,canvas.height),o=pb.data,x=pa.data;let changed=0;
    for(let k=0;k<o.length;k+=4){const d=Math.max(Math.abs(o[k]-x[k]),Math.abs(o[k+1]-x[k+1]),Math.abs(o[k+2]-x[k+2]));const g=(o[k]+o[k+1]+o[k+2])/12;
      if(d>20){changed++;const t=Math.min(1,d/64);o[k]=g+(255-g)*t;o[k+1]=g+(180-g)*t;o[k+2]=g*(1-t)}else{o[k]=o[k+1]=o[k+2]=g}}
    c.putImageData(pb,0,0);const h=canvas.closest('.card')?.querySelector('h2 span');if(h)h.textContent+=' · '+(changed/(o.length/4)*100).toFixed(1)+'% of pixels changed'})}
options($('variant'),Object.keys(DATA).filter(v=>v!==BASE)); $('variant').selectedIndex=$('variant').options.length-1;
for(const id of ['variant','profile','time'])$(id).onchange=refresh;
for(const m of ['slider','side','flip','diff'])$('mode-'+m).onclick=()=>{mode=m;document.querySelectorAll('.bar button').forEach(b=>b.classList.toggle('on',b.id==='mode-'+m));refresh()};
refresh();
</script></body></html>
`;
writeFileSync(join(dir, 'index.html'), html);
console.log(`${join(dir, 'index.html')}: ${base} vs ${variants.join(', ')} (${Object.keys(data[base]).join(', ')})`);
