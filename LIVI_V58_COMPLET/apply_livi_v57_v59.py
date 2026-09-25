from pathlib import Path
import subprocess, sys

ROOT=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else Path.cwd()
BASE=Path(__file__).resolve().parent
steps=[
    BASE/'apply_v57_full.py',
    BASE/'apply_v58.py',
    BASE/'apply_v58_final.py',
    BASE/'apply_v59_coherence.py',
]
for step in steps:
    print(f'==> {step.name}')
    subprocess.run([sys.executable,str(step),str(ROOT)],check=True,cwd=str(ROOT))
print('LIVI V57 -> V58 -> V59 terminé.')
