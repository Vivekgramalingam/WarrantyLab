"""Bundle the portable, dependency-free project without Site identity or Git metadata."""
from pathlib import Path
import zipfile,shutil
root=Path(__file__).resolve().parents[1]
dest=root/'dist/downloads'
for source in [root/'README.md',root/'reference/analysis.sql',root/'reference/measures.dax',root/'src/generate_data.py']:
    shutil.copyfile(source,dest/source.name)
archive=dest/'service-intelligence-project.zip'
files=[root/'README.md']
for folder in ['src','reference','tests','dist']:
    files += [p for p in (root/folder).rglob('*') if p.is_file() and p!=archive and '__pycache__' not in str(p)]
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
    for p in files:z.write(p,Path('service-intelligence-lab')/p.relative_to(root))
print(f'Packaged {len(files)} files in {archive.name} ({archive.stat().st_size:,} bytes).')
