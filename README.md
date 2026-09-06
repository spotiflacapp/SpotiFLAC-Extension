# SpotiFLAC Extension Store

## Submit Your Extension

1. Fork this repository
2. Add your `.spotiflac-ext` file to `extensions/` folder
3. Add your icon image (PNG/JPG, 512x512 recommended) to `icons/` folder
4. Add entry to `registry.json`
   - Ensure `iconUrl` points to the raw file in the repository (e.g. `https://raw.githubusercontent.com/zarzet/SpotiFLAC-Extension/main/icons/your-icon.png`)
5. Create Pull Request

## Requirements

- Extension must follow [Extension Development Guide](https://spotiflac.zarz.moe/docs)
- No malicious code
- Clear description of what extension does
- Working download URL and icon URL

## Developing the bundled providers

Amazon, Tidal, and Qobuz have reviewable source in `sources/<provider>/` and
offline regression tests in `tests/`. Edit the source, bump its manifest
version, and run:

```sh
node --test tests/*.test.cjs
python3 scripts/build_packages.py
python3 scripts/build_packages.py --check
```

The tests use Node.js 22 or newer and mock provider responses; they do not
contact music services. The Python 3 script creates reproducible `.sflx`
archives and updates their versions and SHA-256 digests in `registry.json`.
Pass provider directory names to rebuild a subset, for example
`python3 scripts/build_packages.py amazon tidal-web`.

Commit source, tests, packages, and registry changes together. Other providers
remain package-only until their source is added to this layout.

## Review Process

All submissions are reviewed before being added to the store.

## License

Copyright 2026 zarzet

This project is licensed under the Apache License, Version 2.0 - see the [LICENSE](LICENSE) file for details.
