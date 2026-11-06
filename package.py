#!/usr/bin/env python3
"""Build independent extension ZIPs from explicitly selected runtime sources."""
import hashlib
import json
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parent
OUTPUT = ROOT / "dist"
PACKAGES = {"interactive-ui": "interactive", "anatomy": "anatomy"}


def package(name, guide):
    manifest = json.loads((ROOT / "extensions" / name / "package.json").read_text())
    files = [ROOT / name for name in (
        "README.md", "LICENSE", "docs/TESTING.md", "docs/IMPLEMENTATION.md"
    )]
    files.extend((ROOT / "lib").glob("*.mjs"))
    if name == "interactive-ui":
        files = [file for file in files if file.name != "anatomy.mjs"]
    files.extend((ROOT / "extensions" / name).glob("*.mjs"))
    files.append(ROOT / "guides" / (guide + ".md"))
    files.extend((ROOT / "vendor/open-intelligent-ui").glob("*"))
    if name == "anatomy":
        files.extend(file for file in (ROOT / "vendor/anatomy").rglob("*") if file.is_file())

    entries = [("package.json", json.dumps(manifest, indent=2).encode())]
    for file in sorted(files):
        data = file.read_bytes()
        if file.name == "README.md":
            data = data.decode().replace(
                'src="docs/screenshots/',
                'src="https://raw.githubusercontent.com/josephm1/aether-visuals/main/docs/screenshots/'
            ).encode()
        entries.append((file.relative_to(ROOT).as_posix(), data))

    archive = OUTPUT / f"{manifest['name']}-{manifest['version']}.zip"
    with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as output:
        for path, data in entries:
            info = zipfile.ZipInfo(path, (2026, 11, 6, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            output.writestr(info, data)
    with zipfile.ZipFile(archive) as output:
        assert output.testzip() is None
    return {
        "file": archive.name,
        "bytes": archive.stat().st_size,
        "sha256": hashlib.sha256(archive.read_bytes()).hexdigest(),
        "platform_device_tested": False,
    }


def main():
    OUTPUT.mkdir(exist_ok=True)
    artifacts = [package(name, guide) for name, guide in PACKAGES.items()]
    (OUTPUT / "ARTIFACTS.json").write_text(json.dumps(artifacts, indent=2) + "\n")
    (OUTPUT / "SHA256SUMS").write_text("".join(
        f"{item['sha256']}  {item['file']}\n" for item in artifacts
    ))
    print(json.dumps(artifacts, indent=2))


if __name__ == "__main__":
    main()
