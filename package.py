#!/usr/bin/env python3
"""Allowlisted runtime package: no dependencies, captures, credentials or user data."""
from pathlib import Path
import hashlib,json,zipfile
root=Path(__file__).resolve().parent;out=root/'dist';out.mkdir(exist_ok=True)
manifest=json.loads((root/'package.json').read_text());version=manifest['version']
files=[root/n for n in ['package.json','README.md','LICENSE','agent.mjs','aether.mjs']]
for folder in ['lib','guides','examples','vendor']:
 files.extend(p for p in (root/folder).rglob('*') if p.is_file())
archive=out/('aether-visuals-'+version+'.zip')
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
 for file in sorted(files):
  if file.is_symlink():raise ValueError('No runtime source links')
  name=file.relative_to(root).as_posix()
  if any(p.startswith('.') for p in Path(name).parts):raise ValueError('Unexpected hidden runtime source')
  info=zipfile.ZipInfo(name,(2026,11,6,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o100644<<16;z.writestr(info,file.read_bytes())
with zipfile.ZipFile(archive) as z:
 assert z.testzip() is None
 assert all(not n.startswith(('node_modules/','verification/','tests/','.artifacts/')) for n in z.namelist())
 for name in ['agent.mjs','aether.mjs','vendor/anatomy/LICENSE','vendor/open-intelligent-ui/LICENSE']:assert name in z.namelist()
metadata={'file':archive.name,'bytes':archive.stat().st_size,'sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'entries':len(files),'platform_device_tested':False}
(out/'ARTIFACTS.json').write_text(json.dumps(metadata,indent=2)+'\n');(out/'SHA256SUMS').write_text(metadata['sha256']+'  '+archive.name+'\n');print(json.dumps(metadata,indent=2))
