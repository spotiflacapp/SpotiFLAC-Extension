#!/usr/bin/env python3
"""Build reproducible source-backed extensions and refresh registry digests."""

import argparse
import hashlib
import io
import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo


ROOT = Path(__file__).resolve().parents[1]


def package(source):
    buffer = io.BytesIO()
    with ZipFile(buffer, "w") as archive:
        for filename in ("manifest.json", "index.js"):
            entry = ZipInfo(filename, date_time=(2020, 1, 1, 0, 0, 0))
            entry.create_system = 3
            entry.external_attr = 0o100644 << 16
            archive.writestr(
                entry, (source / filename).read_bytes(),
                compress_type=ZIP_DEFLATED, compresslevel=9,
            )
    return buffer.getvalue()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("providers", nargs="*", help="Source directory names (default: all)")
    parser.add_argument("--check", action="store_true", help="Verify without writing")
    args = parser.parse_args()
    providers = args.providers or sorted(path.name for path in (ROOT / "sources").iterdir() if path.is_dir())
    registry_path = ROOT / "registry.json"
    registry = json.loads(registry_path.read_text())
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT00:00:00Z")
    changed = False
    stale = []
    # Validate every selected source before writing any artifacts.
    builds = []
    for provider in dict.fromkeys(providers):
        if Path(provider).name != provider or provider in (".", ".."):
            parser.error(f"Invalid provider directory: {provider}")
        source = ROOT / "sources" / provider
        manifest = json.loads((source / "manifest.json").read_text())
        matches = [entry for entry in registry["extensions"] if entry["id"] == manifest["name"]]
        if len(matches) != 1:
            parser.error(f"Expected one registry entry for {manifest['name']}")
        entry = matches[0]
        filename = Path(urlparse(entry["download_url"]).path).name
        if not filename.endswith(".sflx"):
            parser.error(f"Expected .sflx download URL for {provider}")
        builds.append((provider, manifest, entry, ROOT / "extensions" / filename, package(source)))

    for provider, manifest, entry, destination, data in builds:
        digest = hashlib.sha256(data).hexdigest()
        archive_matches = destination.exists() and destination.read_bytes() == data
        registry_matches = entry["version"] == manifest["version"] and entry.get("sha256") == digest
        if not archive_matches or not registry_matches:
            if args.check:
                stale.append(provider)
                continue
            destination.write_bytes(data)
            entry.update(version=manifest["version"], sha256=digest, updated_at=timestamp)
            changed = True
        print(f"{provider} {manifest['version']} {digest}")

    if stale:
        parser.exit(1, "Stale packages or registry entries: " + ", ".join(stale) + "\n")
    if changed:
        registry["updated_at"] = timestamp
        registry_path.write_text(json.dumps(registry, indent=2, ensure_ascii=False) + "\n")


if __name__ == "__main__":
    main()
