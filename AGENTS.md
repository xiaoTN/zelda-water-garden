# Mini-tool repository guide

This is an independent Xiaohongshu offline H5 mini-tool repository. It can be cloned directly or checked out as a collection submodule.

## Development

- Treat this repository as the working root for code, tests, assets, documentation, and release artifacts.
- When creating, modifying, validating, or packaging the tool, read [the bundled mini-tool skill](.codex/minitool-zip-builder-1.6.0/minitool-zip-builder/SKILL.md) before editing. Follow the references selected by that skill.
- Use this repository's package.json as the source of truth for development and validation commands. Install its dependencies locally when required.
- Keep source in src/, tests in tests/, build helpers in scripts/, original images and media in assets-source/, and release notes and validation evidence in docs/.
- User-provided assets: the user authorizes descriptive renaming and placement in the appropriate project directories without reconfirmation. Preserve original media in assets-source/ and record its origin and any generated runtime asset.
- Keep upload ZIPs in artifacts/ and temporary files in tmp/. These directories stay local and are ignored by Git.
- For icon-heavy tools, preserve individual source images in assets-source/, package atlases in src/, and verify the ZIP entry count in package checks.
- Commit tool changes in this repository. When used as a submodule, the collection records a separate pinned commit; push the tool commit before publishing an updated collection pointer.

## Completion

- Finish only after this tool's tests, package checks, build, and artifact audit pass, or report the exact failing gate.
- Keep tool-specific release notes and validation evidence in docs/.
