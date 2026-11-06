#!/usr/bin/env python3
"""Build two independently installable extensions from one shared renderer source."""
from pathlib import Path
import hashlib,json,zipfile
root=Path(__file__).resolve().parent;out=root/'dist';out.mkdir(exist_ok=True)
artifacts=[]
for name,guide in [('interactive-ui','interactive'),('anatomy','anatomy')]:
 manifest=json.loads((root/'extensions'/name/'package.json').read_text());version=manifest['version']
 files=[root/n for n in ['README.md','LICENSE','docs/TESTING.md','docs/IMPLEMENTATION.md']]
 files.extend((root/'lib').glob('*.mjs'))
 if name=='interactive-ui':files=[p for p in files if p.name!='anatomy.mjs']
 # The shared agent imports Anatomy lazily; Interactive UI never ships or loads it.
 files.extend((root/'extensions'/name).glob('*.mjs'))
 files.append(root/'guides'/(guide+'.md'))
 files.extend((root/'vendor/open-intelligent-ui').glob('*'))
 if name=='anatomy':files.extend(p for p in (root/'vendor/anatomy').rglob('*') if p.is_file())
 archive=out/(manifest['name']+'-'+version+'.zip')
 with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
  entries=[('package.json',json.dumps(manifest,indent=2).encode())]+[(p.relative_to(root).as_posix(),p.read_bytes()) for p in sorted(files)]
  for path,data in entries:
   if path=='README.md':
    data=data.decode().replace('src="docs/screenshots/', 'src="https://raw.githubusercontent.com/josephm1/aether-visuals/main/docs/screenshots/').encode()
   info=zipfile.ZipInfo(path,(2026,11,6,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o100644<<16;z.writestr(info,data)
 with zipfile.ZipFile(archive) as z:assert z.testzip() is None
 artifacts.append({'file':archive.name,'bytes':archive.stat().st_size,'sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'platform_device_tested':False})
(out/'ARTIFACTS.json').write_text(json.dumps(artifacts,indent=2)+'\n');(out/'SHA256SUMS').write_text(''.join(a['sha256']+'  '+a['file']+'\n' for a in artifacts));print(json.dumps(artifacts,indent=2))
