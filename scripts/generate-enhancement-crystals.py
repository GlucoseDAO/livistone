"""Grow one crystal per gene category with the Materialized Enhancements sculpture pipeline.

Run inside a checkout of https://github.com/longevity-genie/materialized-enhancements, e.g.
  cd ../materialized-enhancements && .venv/bin/python ../livistone/scripts/generate-enhancement-crystals.py ../livistone/data/enhancement/crystals
Each crystal uses the character name "Livistone" and every game-enabled gene whose primary category matches,
exactly as the website's Materialize button would for that selection.
"""
import hashlib, json, subprocess, sys
from pathlib import Path
from materialized_enhancements.gene_data import GAME_GENE_LIBRARY, UNIQUE_CATEGORIES
from materialized_enhancements.sculpture import generate_sculpture

out = Path(sys.argv[1]).resolve(); out.mkdir(parents=True, exist_ok=True)
work = out / '.work'; work.mkdir(exist_ok=True)
commit = subprocess.run(['git', 'rev-parse', '--short', 'HEAD'], capture_output=True, text=True).stdout.strip()
dolt = Path('data/.dolthub-hash').read_text().strip() if Path('data/.dolthub-hash').exists() else ''
crystals = []
for category in UNIQUE_CATEGORIES:
    pool = [g for g in GAME_GENE_LIBRARY if g['category'] == category]
    path, params, stats = generate_sculpture('Livistone', [category], UNIQUE_CATEGORIES, pool, work, 10)
    slug = category.lower().replace(' & ', '-').replace(' ', '-')
    target = out / f'{slug}.stl'; path.replace(target)
    crystals.append({'category': category, 'file': target.name, 'sha256': hashlib.sha256(target.read_bytes()).hexdigest(),
                     'seed': params['seed'], 'finalSeed': stats.get('final_seed', params['seed']), 'genes': len(pool),
                     'faces': stats.get('face_count'), 'watertight': stats.get('is_watertight')})
work.rmdir()
(out / 'meta.json').write_text(json.dumps({'name': 'Livistone', 'sourceCommit': commit, 'doltHash': dolt, 'crystals': crystals}, indent=1) + '\n')
