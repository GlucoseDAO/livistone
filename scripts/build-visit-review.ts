import { readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2] ?? 'output/testing/gate-arrivals';
const labels: Record<string, string> = {
  'snow-gully': 'Snow across the gully', 'snow-prints': 'Footprints across the snow',
  'winter-gate-front': 'Eye of Winter', 'eyelense-gate-front': 'Eyelense Gate',
  'winter-poster': 'Eye of Winter — source photograph', 'eyelense-poster': 'Eyelense — source photograph',
  'arrival-enhancement': 'Materialized Enhancements — arrival', 'arrival-energy': 'Energy — arrival',
  'arrival-science': 'Science — arrival', 'arrival-city-hall': 'City Hall — arrival',
  'arrival-winter-gate': 'Eye of Winter — arrival', 'arrival-eyelense-gate': 'Eyelense — arrival',
  'time-tower': 'Timeface Tower', 'future-house-entry': 'Future House',
};
const cards: { src: string; name: string; label: string; category: string; profile: string; phase: string; before: string | null }[] = [];
for (const profile of ['desktop', 'touch', 'software']) for (const phase of ['day', 'night']) {
  const folder = join(dir, 'after', profile, phase); if (!existsSync(folder)) continue;
  for (const name of Object.keys(labels)) {
    if (!readdirSync(folder).includes(name + '.png')) continue;
    const before = `before/${profile}/${phase}/${name}.png`;
    cards.push({ src: `after/${profile}/${phase}/${name}.png`, name, label: labels[name], profile, phase,
      category: name.startsWith('snow-') ? 'snow' : name.includes('poster') ? 'posters' : name.startsWith('arrival-') ? 'arrivals' : 'buildings',
      before: existsSync(join(dir, before)) ? before : null });
  }
}
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Livistone — visual review</title>
<style>*{box-sizing:border-box}body{margin:0;background:#14201b;color:#f3edda;font:16px/1.5 system-ui,sans-serif}main{max-width:1440px;margin:auto;padding:28px 22px 60px}h1{font:38px Georgia,serif;margin:0}p{color:#c3ccbb;max-width:75ch}a{color:#eed599}nav{position:sticky;top:0;background:#14201bf2;padding:16px 0;display:flex;gap:12px;flex-wrap:wrap;z-index:1}select,button{background:#21352a;color:#f3edda;border:1px solid #a89360;border-radius:6px;padding:10px;font:inherit}label{display:flex;gap:8px;align-items:center}#grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,520px),1fr));gap:22px}article{border:1px solid #65745e;border-radius:8px;overflow:hidden;background:#203025}h2{font:23px Georgia,serif;margin:14px 16px 0}.meta{margin:3px 16px 14px;font-size:14px}img{display:block;width:100%;height:auto}.actions{padding:10px 16px;display:flex;gap:14px;align-items:center}.actions button{font-size:14px;padding:6px 12px}footer{margin-top:24px;color:#c3ccbb}@media(min-width:1100px){article:first-child{grid-column:1/-1;max-width:1100px;margin:auto}} </style>
<main><h1>Livistone — quick visual review</h1><p>Check the snow and wider hiking tracks, the farther arrival views, both source-photo boards, and the buildings at night. Click any image to see it full size.</p><p><a href="/">Open the playable preview ↗</a></p>
<nav><label>Show <select id="category"><option value="all">Everything</option><option value="snow">Snow & footprints</option><option value="arrivals">Teleport arrivals</option><option value="posters">Photo boards</option><option value="buildings">Buildings & lighting</option></select></label><label>Time <select id="phase"><option value="all">Day & night</option><option value="day">Day</option><option value="night">Night</option></select></label><label>View <select id="profile"><option value="desktop">Desktop</option><option value="touch">Touch detail</option><option value="software">Software detail</option></select></label></nav><div id="grid"></div><footer>Touch views are emulated; physical phones have not been checked. These are captured views of the running preview.</footer></main>
<script>const cards=${JSON.stringify(cards)}, grid=document.getElementById('grid');function render(){grid.replaceChildren();for(const c of cards){if(c.profile!==profile.value||(phase.value!=='all'&&c.phase!==phase.value)||(category.value!=='all'&&c.category!==category.value))continue;const a=document.createElement('article');a.innerHTML='<h2>'+c.label+'</h2><p class="meta">'+(c.phase==='night'?'Night':'Day')+'</p><a href="'+c.src+'" target="_blank"><img src="'+c.src+'" alt="'+c.label+' — '+c.phase+'" loading="lazy"></a><div class="actions"><a href="'+c.src+'" target="_blank">Full-size screenshot ↗</a></div>';if(c.before){const b=document.createElement('button');b.textContent='Show before';let old=false;b.onclick=()=>{old=!old;const img=a.querySelector('img');img.src=old?c.before:c.src;img.parentElement.href=img.src;b.textContent=old?'Show updated':'Show before'};a.querySelector('.actions').append(b)}grid.append(a)}}for(const id of ['category','phase','profile'])document.getElementById(id).onchange=render;render();</script></html>`;
writeFileSync(join(dir, 'review.html'), html); console.log(`${dir}/review.html — ${cards.length} screenshots`);
