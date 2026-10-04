# Mini-tool repository guide

This is an independent Xiaohongshu offline H5 mini-tool repository. It can be cloned directly or checked out as a collection submodule.

## Development

- Treat this repository as the working root for code, tests, assets, documentation, and release artifacts.
- When creating, modifying, validating, or packaging the tool, read [the bundled mini-tool skill](.codex/minitool-zip-builder-1.6.0/minitool-zip-builder/SKILL.md) before editing. Follow the references selected by that skill.
- Use this repository's package.json as the source of truth for development and validation commands. Install its dependencies locally when required.
- Keep source in src/, tests in tests/, build helpers in scripts/, original images and media in assets-source/, and release notes and validation evidence in docs/.
- Keep upload ZIPs in artifacts/ and temporary files in tmp/. These directories stay local and are ignored by Git.
- For icon-heavy tools, preserve individual source images in assets-source/, package atlases in src/, and verify the ZIP entry count in package checks.
- Commit tool changes in this repository. When used as a submodule, the collection records a separate pinned commit; push the tool commit before publishing an updated collection pointer.

## 3D game contract

- Build the playable world with real WebGL 3D geometry, world-space lighting, depth testing, and a camera. Snowballs must be sphere meshes; snow and clouds must have spatial depth and deform in world space. Canvas 2D, CSS gradients, and painted sprites must not substitute for these objects.
- Resolve pointer interactions against the 3D scene. Keep object placement, rolling, surface contact, shadows, and occlusion consistent with the same world coordinates.
- Reduce resolution, geometry, and optional effects on slow devices. If 3D is unavailable, show an explicit unavailable/recovery state rather than a simulated 2D game. DOM/CSS remain appropriate for interface controls.
- When changing rendering, validate geometry and camera picking as well as screenshots, interactions, context recovery, and both quality tiers before release.

## Completion

- Finish only after this tool's tests, package checks, build, and artifact audit pass, or report the exact failing gate.
- Keep tool-specific release notes and validation evidence in docs/.
