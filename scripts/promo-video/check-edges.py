"""Frozen-content transition regression: the feather must not change at a cut."""
from pathlib import Path
import json
import subprocess
import sys
import numpy as np
from PIL import Image

HERE=Path(__file__).resolve().parent
OUT=HERE.parents[1]/'tmp/promo-edge-repro'
OUT.mkdir(parents=True,exist_ok=True)
for frame in [137,138]:
    subprocess.run(['node','node_modules/@remotion/cli/remotion-cli.js','still',
        'src/edge-repro.tsx','EdgeRepro',str(OUT/f'{frame}.png'),f'--frame={frame}',
        '--log=error'],cwd=HERE,check=True)
before=np.asarray(Image.open(OUT/'137.png').convert('RGB')).astype(float)
after=np.asarray(Image.open(OUT/'138.png').convert('RGB')).astype(float)
edge=np.zeros(before.shape[:2],dtype=bool)
edge[362:408,120:960]=True
edge[1030:1078,120:960]=True
delta=np.abs(before-after)[edge]
report={'edge_mean_absolute_change':float(delta.mean()),'edge_max_change':float(delta.max()),
        'threshold_mean':.5,'passed':bool(delta.mean()<.5)}
(OUT/'result.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
sys.exit(0 if report['passed'] else 1)
