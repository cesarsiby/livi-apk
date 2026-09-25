from pathlib import Path
import subprocess
import sys

ROOT=Path(__file__).resolve().parent
repo=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else Path.cwd().resolve()

steps=[
    ('V57 — modèle marché/logistique interville', 'apply_v57_full.py'),
    ('V58 — délais/préparation/périssables', 'apply_v58.py'),
    ('V58 — finalisation robuste timing/interville/comptabilité', 'apply_v58_final.py'),
]

for label, script in steps:
    p=ROOT/script
    if not p.exists(): raise SystemExit(f'{label}: fichier manquant {p}')
    print(f'== {label} ==')
    subprocess.run([sys.executable,str(p)],cwd=repo,check=True)

print('\nLIVI V57 + V58 préparés dans le checkout local.')
print('Avant commit/deploy : appliquer les migrations PostgreSQL, exécuter les tests backend, transpiler TypeScript/TSX, construire Expo et effectuer les tests appareil/intégration fournisseur.')
