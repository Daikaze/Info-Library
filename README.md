# World Codex & Gazette — Foundry V14 (v14.0.1)

This is the **separate V14 release** of Info-Library. The `main` branch
remains the original **V11 v0.1.5** with the original manifest and ZIP.
Do not install both versions at once because both use module ID `world-codex`.

## Installation — Foundry V14 / D&D 5e 6.0.6

In **Setup → Add-on Modules → Install Module**, paste this **V14 manifest**:

`https://raw.githubusercontent.com/Daikaze/Info-Library/foundry-v14/module.json`

The versioned GitHub release ZIP is `world-codex-v14.zip` under tag `v14.0.1`.
V11 players should continue using the manifest in the repository's `main` branch.

**Back up your entire Foundry world before switching to V14.**

## What remains compatible

- The same private GM JournalEntry (`world-codex` flags `storage`, `database`).
- Public encyclopedia entries, categories and category sorting/filtering.
- Custom Cities/NPC/PC categories; drag-and-drop movement among categories.
- The Gazette newspaper articles and WYSIWYG text/imagery.
- The freely positioned text and image blocks, zoom and resize handles.
- Newspaper publication: public and restricted audience via individual
  permissioned Journal mirrors; restricted editions do not go to `publicData`.
- Import/export JSON and PNG/WebP image paths, including older backup schemas.
- Player open-through-chat/GM sharing, with permission checks unchanged.

## Foundry V14 changes

- Main window migrated to native `ApplicationV2` frame: Foundry resize,
  titlebar double-click minimize and native window controls.
- Updated Foundry `DialogV2` confirmations and image path input; native
  FilePicker and ImagePopout for artwork.
- Migrated toolbar scene control registration to the V14 keyed scene controls.
- Added a V14-specific theme override, preserving the original styled/printable
  newspaper page itself rather than flattening its design.
- Preserved delegated jQuery editor events where the rich WYSIWYG, drag/resize,
  text selection and inline-image editor depend on them. No global DOM overrides.

## Testing and limitations

Automated tests cover module syntax, data storage, restricted Journal publication,
category moves, image validation, and page designer canvas persistence. They
do **not** replace an in-game end-to-end test of browser editing, cursor
selection, drag-and-drop and live newspaper preview in Foundry 14.367+.
Third-party sheet integrations have not been tested.

## Development

- V11 source remains in `main` as `scripts/main.js`.
- V14 uses `scripts/v14-main.js`, the original scoped CSS plus
  `styles/v14-native.css`.
- The `foundry-v14` branch has its own CI/release workflow.
